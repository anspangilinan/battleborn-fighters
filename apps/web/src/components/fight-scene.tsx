'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { ArcadeMenuItem } from '@/components/arcade-menu-item';
import { FightHud } from '@/components/fight-hud';

import { fighterRoster, getFighter } from '@battleborn/content';
import {
  DEFAULT_CONFIG,
  EMPTY_INPUT,
  FPS,
  cloneInput,
  createMatchState,
  decodeInput,
  encodeInput,
  getDashDurationFrames,
  getMoveCooldownFrames,
  getMoveMeleeRange,
  stepMatch,
  type CharacterDefinition,
  type InputState,
  type MatchState,
} from '@battleborn/game-core';

const roster = fighterRoster;
const matchServiceUrl =
  process.env.NEXT_PUBLIC_MATCH_SERVICE_URL ?? 'ws://localhost:8787';
const defaultArenaBackgroundPath = '/arenas/underway.png';
const defaultArenaBackgroundKey = 'default-arena-background';
const defaultFighterRenderHeight = 168;
const TRAINING_CONFIG = {
  ...DEFAULT_CONFIG,
  roundSeconds: Number.POSITIVE_INFINITY,
};

type FightMode = 'local' | 'training' | 'online';
type ControlInputKey = keyof Pick<
  InputState,
  'up' | 'left' | 'right' | 'punch' | 'kick' | 'special'
>;
type AttackInputKey = keyof Pick<InputState, 'punch' | 'kick' | 'special'>;
type AttackCooldownDisplay = {
  cooling: boolean;
  remainingFrames: number;
  remainingLabel: string;
  remainingRatio: number;
};

export interface FightSceneProps {
  mode: FightMode;
  fighterId: string;
  opponentId: string;
  roomCode?: string;
  token?: string;
  playerName?: string;
}

type SnapshotMessage = {
  type: 'snapshot';
  state: MatchState;
};

type RoomStateMessage = {
  type: 'room_state';
  roomCode: string;
  readySlots: number[];
  connectedSlots: number[];
  selections: Record<string, string | undefined>;
};

type InfoMessage = {
  type: 'info';
  slot: 1 | 2;
  message: string;
};

type ServerMessage = SnapshotMessage | RoomStateMessage | InfoMessage;

const fightAnimationStances = [
  'idle',
  'walk',
  'jump',
  'dash',
  'hurt',
  'ko',
  'attack1',
  'attack2',
  'special',
] as const;
type FightAnimationStance = (typeof fightAnimationStances)[number];

type FighterAssetManifest = {
  headshotSource: string | null;
  portraitSource: string | null;
  stanceSources: Record<FightAnimationStance, string[]>;
};

type FullscreenCapableElement = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenCapableDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
};

const phaserModulePromise = import('phaser').then(
  (PhaserModule) => PhaserModule.default,
);
const fighterAssetManifestPromiseCache = new Map<
  string,
  Promise<FighterAssetManifest>
>();
const projectileAssetSourcePromiseCache = new Map<
  string,
  Promise<string | null>
>();
const projectileAssetExtensions = ['png', 'webp', 'svg', 'jpg', 'jpeg'];

const movementControls: Array<Array<{ key: ControlInputKey; label: string }>> =
  [
    [{ key: 'up', label: 'W' }],
    [
      { key: 'left', label: 'A' },
      { key: 'right', label: 'D' },
    ],
  ];

const attackControls: Array<Array<{ key: ControlInputKey; label: string }>> = [
  [
    { key: 'punch', label: 'J' },
    { key: 'kick', label: 'K' },
    { key: 'special', label: 'L' },
  ],
];
const attackControlKeys: AttackInputKey[] = ['punch', 'kick', 'special'];
const zeroAttackCooldownDisplay: AttackCooldownDisplay = {
  cooling: false,
  remainingFrames: 0,
  remainingLabel: '',
  remainingRatio: 0,
};

function toAssetSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function preloadImage(src: string) {
  return new Promise<boolean>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

async function discoverImageSource(
  candidates: Array<string | null | undefined>,
) {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (await preloadImage(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getProjectileSpriteName(sprite: string) {
  const basename = sprite.split('/').at(-1) ?? sprite;
  return basename.replace(/\.[^.]+$/, '');
}

function formatCooldownLabel(remainingFrames: number) {
  if (remainingFrames <= 0) {
    return '';
  }

  const roundedUpSeconds = Math.ceil((remainingFrames / FPS) * 10) / 10;
  return `${roundedUpSeconds.toFixed(1)}s`;
}

function getProjectileAssetSourceCandidates(sprite: string) {
  const normalizedSprite = sprite.trim().replace(/^\/+/, '');
  const basePath = normalizedSprite.startsWith('projectiles/')
    ? `/${normalizedSprite}`
    : `/projectiles/${normalizedSprite}`;

  if (/\.[a-z0-9]+$/i.test(basePath)) {
    return [basePath];
  }

  return projectileAssetExtensions.map((extension) => `${basePath}.${extension}`);
}

function getUniqueProjectileSprites(fighters: CharacterDefinition[]) {
  return Array.from(
    new Set(
      fighters.flatMap((fighter) =>
        Object.values(fighter.moves).flatMap((move) =>
          move.projectile ? [move.projectile.sprite] : [],
        ),
      ),
    ),
  );
}

function getCachedProjectileAssetSource(sprite: string) {
  const cached = projectileAssetSourcePromiseCache.get(sprite);
  if (cached) {
    return cached;
  }

  const nextPromise = discoverImageSource(
    getProjectileAssetSourceCandidates(sprite),
  )
    .then((source) => {
      if (!source) {
        projectileAssetSourcePromiseCache.delete(sprite);
      }

      return source;
    })
    .catch((error) => {
      projectileAssetSourcePromiseCache.delete(sprite);
      throw error;
    });
  projectileAssetSourcePromiseCache.set(sprite, nextPromise);
  return nextPromise;
}

async function loadSequentialFrames(assetDirectory: string) {
  const namingStrategies = [
    (index: number) => `${String(index + 1).padStart(2, '0')}.png`,
    (index: number) => `${index}.png`,
    (index: number) => `${index + 1}.png`,
  ];

  for (const getFrameName of namingStrategies) {
    const discoveredFrames: string[] = [];
    for (let index = 0; index < 24; index += 1) {
      const src = `${assetDirectory}${getFrameName(index)}`;
      const exists = await preloadImage(src);
      if (!exists) {
        break;
      }
      discoveredFrames.push(src);
    }

    if (discoveredFrames.length > 0) {
      return discoveredFrames;
    }
  }

  return [];
}

function getFighterAssetRoots(fighter: CharacterDefinition) {
  return Array.from(
    new Set([
      `/characters/${fighter.id}`,
      `/characters/${toAssetSegment(fighter.name)}`,
    ]),
  );
}

function getUniqueFighters(fighters: CharacterDefinition[]) {
  return Array.from(
    new Map(fighters.map((fighter) => [fighter.id, fighter])).values(),
  );
}

async function discoverStanceFrames(
  assetRoots: string[],
  stance: FightAnimationStance,
) {
  const candidateDirectories = assetRoots.flatMap((root) => [
    `${root}/animations/${stance}/`,
    `${root}/${stance}/`,
  ]);

  for (const directory of candidateDirectories) {
    const frames = await loadSequentialFrames(directory);
    if (frames.length > 0) {
      return frames;
    }
  }

  return [];
}

async function discoverFighterAssets(
  fighter: CharacterDefinition,
): Promise<FighterAssetManifest> {
  const assetRoots = getFighterAssetRoots(fighter);
  const portraitSource = await discoverImageSource([
    fighter.sprites.portrait,
    ...assetRoots.flatMap((root) => [
      `${root}/portrait.png`,
      `${root}/animations/portrait.png`,
    ]),
  ]);
  const headshotSource = await discoverImageSource([
    ...assetRoots.flatMap((root) => [
      `${root}/headshot.png`,
      `${root}/animations/headshot.png`,
    ]),
    portraitSource,
  ]);
  const stanceEntries = await Promise.all(
    fightAnimationStances.map(
      async (stance) =>
        [stance, await discoverStanceFrames(assetRoots, stance)] as const,
    ),
  );

  return {
    headshotSource,
    portraitSource,
    stanceSources: Object.fromEntries(stanceEntries) as Record<
      FightAnimationStance,
      string[]
    >,
  };
}

function getCachedFighterAssets(fighter: CharacterDefinition) {
  const cachedManifest = fighterAssetManifestPromiseCache.get(fighter.id);

  if (cachedManifest) {
    return cachedManifest;
  }

  const manifestPromise = discoverFighterAssets(fighter).catch((error) => {
    fighterAssetManifestPromiseCache.delete(fighter.id);
    throw error;
  });

  fighterAssetManifestPromiseCache.set(fighter.id, manifestPromise);
  return manifestPromise;
}

function queueManifestTextures(
  scene: any,
  manifests: Record<string, FighterAssetManifest>,
  startIfNeeded = true,
) {
  const queuedBefore = scene.load.list.size;

  for (const [fighterId, manifest] of Object.entries(manifests)) {
    for (const stance of fightAnimationStances) {
      manifest.stanceSources[stance].forEach((source, frameIndex) => {
        const textureKey = getAnimationTextureKey(
          fighterId,
          stance,
          frameIndex,
        );

        if (!scene.textures.exists(textureKey)) {
          scene.load.image(textureKey, source);
        }
      });
    }
  }

  if (
    startIfNeeded &&
    scene.load.list.size > queuedBefore &&
    !scene.load.isLoading()
  ) {
    scene.load.start();
  }
}

function queueProjectileTextures(
  scene: any,
  projectileSources: Record<string, string>,
  startIfNeeded = true,
) {
  const queuedBefore = scene.load.list.size;

  for (const [sprite, source] of Object.entries(projectileSources)) {
    const textureKey = getProjectileTextureKey(sprite);
    if (scene.textures.exists(textureKey)) {
      continue;
    }

    if (source.endsWith('.svg') && typeof scene.load.svg === 'function') {
      scene.load.svg(textureKey, source);
    } else {
      scene.load.image(textureKey, source);
    }
  }

  if (
    startIfNeeded &&
    scene.load.list.size > queuedBefore &&
    !scene.load.isLoading()
  ) {
    scene.load.start();
  }
}

function getDesiredAnimationStance(
  fighter: MatchState['fighters'][number],
): FightAnimationStance {
  if (fighter.action === 'attack') {
    if (fighter.attackId === 'kick') {
      return 'attack2';
    }

    if (fighter.attackId === 'special') {
      return 'special';
    }

    return 'attack1';
  }

  if (fighter.action === 'hit') {
    return 'hurt';
  }

  if (fighter.action === 'ko') {
    return 'ko';
  }

  if (fighter.action === 'dash') {
    return 'dash';
  }

  if (fighter.action === 'jump') {
    return 'jump';
  }

  if (fighter.action === 'walk') {
    return 'walk';
  }

  return 'idle';
}

function getAvailableAnimationStance(
  fighter: MatchState['fighters'][number],
  manifest: FighterAssetManifest | undefined,
): FightAnimationStance | null {
  if (!manifest) {
    return null;
  }

  const desiredStance = getDesiredAnimationStance(fighter);
  if (manifest.stanceSources[desiredStance].length > 0) {
    return desiredStance;
  }

  return manifest.stanceSources.idle.length > 0 ? 'idle' : null;
}

function getAnimationFrameIndex(
  fighter: MatchState['fighters'][number],
  definition: CharacterDefinition,
  stance: FightAnimationStance,
  frameCount: number,
  matchFrame: number,
) {
  if (frameCount <= 1) {
    return 0;
  }

  switch (stance) {
    case 'walk':
      return Math.floor(matchFrame / 5) % frameCount;
    case 'jump':
      if (frameCount >= 5) {
        if (fighter.grounded) {
          return frameCount - 1;
        }

        if (fighter.vy < -8) {
          return 0;
        }

        if (fighter.vy < -2) {
          return 1;
        }

        if (fighter.vy <= 2) {
          return 2;
        }

        if (fighter.vy <= 8) {
          return Math.min(3, frameCount - 1);
        }

        return Math.min(4, frameCount - 1);
      }

      return Math.floor(matchFrame / 5) % frameCount;
    case 'dash': {
      const dashDurationFrames = getDashDurationFrames(definition);
      return Math.min(
        frameCount - 1,
        Math.floor(
          ((dashDurationFrames - fighter.dashFramesRemaining) /
            dashDurationFrames) *
            frameCount,
        ),
      );
    }
    case 'hurt':
      return Math.floor(matchFrame / 4) % frameCount;
    case 'ko':
      return Math.min(frameCount - 1, Math.floor(matchFrame / 8) % frameCount);
    case 'attack1':
    case 'attack2':
    case 'special': {
      const move = fighter.attackId ? definition.moves[fighter.attackId] : null;
      const totalFrames = move
        ? move.startup + move.active + move.recovery + 1
        : frameCount;
      return Math.min(
        frameCount - 1,
        Math.floor(
          (fighter.attackFrame / Math.max(1, totalFrames)) * frameCount,
        ),
      );
    }
    case 'idle':
    default:
      return Math.floor(matchFrame / 8) % frameCount;
  }
}

function getAnimationTextureKey(
  fighterId: string,
  stance: FightAnimationStance,
  frameIndex: number,
) {
  return `${fighterId}:animation:${stance}:${frameIndex}`;
}

function getProjectileTextureKey(sprite: string) {
  return `projectile:${sprite}`;
}

function getProjectileSpriteScale(
  projectile: MatchState['projectiles'][number],
  sourceImage: { width: number; height: number },
) {
  if (getProjectileSpriteName(projectile.sprite) === 'iceball') {
    return Math.max(
      (projectile.hitbox.width * 1.5) / sourceImage.width,
      (projectile.hitbox.height * 1.5) / sourceImage.height,
    );
  }

  return Math.max(
    (projectile.hitbox.width * 1.8) / sourceImage.width,
    (projectile.hitbox.height * 3.2) / sourceImage.height,
  );
}

function getProjectileTrailAlphas(projectile: MatchState['projectiles'][number]) {
  if (getProjectileSpriteName(projectile.sprite) === 'iceball') {
    return [0.42, 0.28, 0.18, 0.1];
  }

  return [];
}

function getFullscreenElement(currentDocument: FullscreenCapableDocument) {
  return currentDocument.fullscreenElement ?? currentDocument.webkitFullscreenElement ?? null;
}

async function requestElementFullscreen(element: FullscreenCapableElement) {
  if (typeof element.requestFullscreen === 'function') {
    await element.requestFullscreen();
    return;
  }

  await element.webkitRequestFullscreen?.();
}

async function exitElementFullscreen(currentDocument: FullscreenCapableDocument) {
  if (typeof currentDocument.exitFullscreen === 'function') {
    await currentDocument.exitFullscreen();
    return;
  }

  await currentDocument.webkitExitFullscreen?.();
}

function getDashVisualLift(
  fighter: MatchState['fighters'][number],
  definition: CharacterDefinition,
) {
  const { dash } = definition.stats.movement;
  if (fighter.action !== 'dash' || dash.lift <= 0) {
    return 0;
  }

  const dashDurationFrames = getDashDurationFrames(definition);
  const progress =
    (dashDurationFrames - fighter.dashFramesRemaining) / dashDurationFrames;
  return dash.lift * Math.sin(Math.PI * progress);
}

function getMoveAiRange(move: CharacterDefinition['moves'][string] | undefined) {
  if (!move) {
    return 0;
  }

  if (move.projectile) {
    return (
      DEFAULT_CONFIG.width *
      (move.projectile.maximumDistanceRatio ?? move.projectile.minimumDistanceRatio) *
      0.45
    );
  }

  return getMoveMeleeRange(move) + 18 + Math.max(0, (move.rootVelocityX ?? 0) * move.startup);
}

function createAiInput(state: MatchState): InputState {
  const player = state.fighters[1];
  const target = state.fighters[0];
  const playerDefinition = roster[player.fighterId];
  const punchRange = getMoveAiRange(playerDefinition?.moves.punch);
  const kickRange = getMoveAiRange(playerDefinition?.moves.kick);
  const specialRange = getMoveAiRange(playerDefinition?.moves.special);
  if (state.status !== 'fighting') {
    return EMPTY_INPUT;
  }

  const distance = target.x - player.x;
  return {
    left: distance < -70,
    right: distance > 70,
    up: !player.grounded && player.y < target.y - 40,
    punch: Math.abs(distance) < punchRange && state.frame % 50 === 0,
    kick: Math.abs(distance) < kickRange && state.frame % 80 === 0,
    special: Math.abs(distance) < specialRange && state.frame % 160 === 0,
  };
}

function renderFighterFallback(
  graphics: any,
  fighter: MatchState['fighters'][number],
  definition: CharacterDefinition,
) {
  const headRadius = 18;
  const torsoHeight = 54;
  const baseX = fighter.x;
  const baseY = fighter.y - getDashVisualLift(fighter, definition);
  const direction = fighter.facing;

  graphics.fillStyle(colorToNumber(definition.palette.primary), 1);
  graphics.fillCircle(baseX, baseY - 92, headRadius);
  graphics.fillStyle(colorToNumber(definition.palette.shadow), 1);
  graphics.fillRoundedRect(baseX - 18, baseY - 76, 36, torsoHeight, 10);
  graphics.fillStyle(colorToNumber(definition.palette.accent), 1);
  graphics.fillRect(baseX - 26 * direction, baseY - 68, 16, 10);
  graphics.fillRect(baseX + 10 * direction, baseY - 68, 16, 10);

  graphics.lineStyle(8, colorToNumber(definition.palette.accent), 1);
  graphics.beginPath();
  graphics.moveTo(baseX - 10, baseY - 26);
  graphics.lineTo(baseX - 18, baseY + 10);
  graphics.moveTo(baseX + 10, baseY - 26);
  graphics.lineTo(baseX + 18, baseY + 10);
  graphics.strokePath();

  if (fighter.action === 'dash') {
    graphics.fillStyle(0xffffff, 0.18);
    graphics.fillEllipse(baseX - direction * 34, baseY - 62, 60, 30);
  } else if (fighter.action === 'attack') {
    graphics.fillStyle(0xffffff, 0.35);
    graphics.fillEllipse(baseX + direction * 30, baseY - 70, 54, 26);
  }
}

function renderProjectileFallback(
  graphics: any,
  projectile: MatchState['projectiles'][number],
) {
  if (getProjectileSpriteName(projectile.sprite) === 'iceball') {
    graphics.fillStyle(0x5af6ff, 0.18);
    graphics.fillCircle(projectile.x, projectile.y, 28);
    graphics.fillStyle(0x9ffcff, 0.34);
    graphics.fillCircle(projectile.x, projectile.y, 20);
    graphics.lineStyle(5, 0xd9ffff, 0.85);
    graphics.strokeCircle(projectile.x, projectile.y, 15);

    graphics.lineStyle(4, 0x8de8ff, 0.5);
    graphics.beginPath();
    graphics.moveTo(projectile.x - projectile.facing * 28, projectile.y - 10);
    graphics.lineTo(projectile.x - projectile.facing * 8, projectile.y - 4);
    graphics.moveTo(projectile.x - projectile.facing * 26, projectile.y + 8);
    graphics.lineTo(projectile.x - projectile.facing * 10, projectile.y + 4);
    graphics.strokePath();
    return;
  }

  const angle = Math.atan2(projectile.vy, projectile.vx);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const baseX = projectile.x;
  const baseY = projectile.y;

  graphics.lineStyle(8, 0x44dfff, 0.28);
  graphics.beginPath();
  graphics.moveTo(baseX - cos * 34, baseY - sin * 34);
  graphics.lineTo(baseX + cos * 8, baseY + sin * 8);
  graphics.strokePath();

  graphics.fillStyle(0xfff3b1, 0.22);
  graphics.fillEllipse(baseX, baseY, 40, 18);

  graphics.lineStyle(6, 0xd8b35d, 1);
  graphics.beginPath();
  graphics.moveTo(baseX - cos * 20, baseY - sin * 20);
  graphics.lineTo(baseX + cos * 16, baseY + sin * 16);
  graphics.strokePath();

  graphics.fillStyle(0xe9ecef, 1);
  graphics.beginPath();
  graphics.moveTo(baseX + cos * 24, baseY + sin * 24);
  graphics.lineTo(baseX + cos * 8 - sin * 8, baseY + sin * 8 + cos * 8);
  graphics.lineTo(baseX + cos * 8 + sin * 8, baseY + sin * 8 - cos * 8);
  graphics.closePath();
  graphics.fillPath();

  graphics.lineStyle(5, 0x7f2f1c, 1);
  graphics.beginPath();
  graphics.moveTo(baseX - cos * 20, baseY - sin * 20);
  graphics.lineTo(baseX - cos * 11 - sin * 9, baseY - sin * 11 + cos * 9);
  graphics.moveTo(baseX - cos * 20, baseY - sin * 20);
  graphics.lineTo(baseX - cos * 11 + sin * 9, baseY - sin * 11 - cos * 9);
  graphics.strokePath();
}

function colorToNumber(hex: string) {
  return Number.parseInt(hex.replace('#', ''), 16);
}

function getCountdownAnnouncement(state: MatchState) {
  if (state.status !== 'countdown') {
    return null;
  }

  if (state.countdownFrames > FPS) {
    return {
      eyebrow: 'Next Bout',
      title: `Round ${state.round}`,
      phase: 'round' as const,
    };
  }

  return {
    eyebrow: '',
    title: 'Fight!',
    phase: 'fight' as const,
  };
}

export function FightScene(props: FightSceneProps) {
  const screenRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const arenaSceneRef = useRef<any>(null);
  const keyboardInputRef = useRef<InputState>(cloneInput());
  const pointerInputRef = useRef<InputState>(cloneInput());
  const liveInputRef = useRef<InputState>(cloneInput());
  const isPausedRef = useRef(false);
  const fighterAssetManifestsRef = useRef<Record<string, FighterAssetManifest>>(
    {},
  );
  const projectileAssetSourcesRef = useRef<Record<string, string>>({});
  const [hudState, setHudState] = useState<MatchState | null>(null);
  const [fighterAssetManifests, setFighterAssetManifests] = useState<
    Record<string, FighterAssetManifest>
  >({});
  const [connectionState, setConnectionState] = useState('Loading');
  const [isSceneBooting, setIsSceneBooting] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreenSupported, setIsFullscreenSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerSlot, setPlayerSlot] = useState<1 | 2>(1);
  const [visualInput, setVisualInput] = useState<InputState>(() =>
    cloneInput(),
  );
  const hasReportedResult = useRef(false);

  const opponentDefinition = useMemo(
    () => getFighter(props.opponentId),
    [props.opponentId],
  );
  const fighterDefinition = useMemo(
    () => getFighter(props.fighterId),
    [props.fighterId],
  );
  const controlledFighterRuntime = useMemo(
    () => hudState?.fighters.find((fighter) => fighter.slot === playerSlot) ?? null,
    [hudState, playerSlot],
  );
  const controlledFighterDefinition = useMemo(
    () =>
      controlledFighterRuntime
        ? roster[controlledFighterRuntime.fighterId]
        : fighterDefinition,
    [controlledFighterRuntime, fighterDefinition],
  );
  const attackCooldowns = useMemo(
    () =>
      Object.fromEntries(
        attackControlKeys.map((key) => {
          const move = controlledFighterDefinition.moves[key];
          const totalCooldownFrames = move ? getMoveCooldownFrames(move) : 0;
          const remainingFrames = move
            ? controlledFighterRuntime?.moveCooldownFrames[move.id] ?? 0
            : 0;
          const cooldownDisplay: AttackCooldownDisplay = {
            cooling: remainingFrames > 0,
            remainingFrames,
            remainingLabel: formatCooldownLabel(remainingFrames),
            remainingRatio:
              totalCooldownFrames > 0
                ? Math.min(1, remainingFrames / totalCooldownFrames)
                : 0,
          };

          return [key, cooldownDisplay];
        }),
      ) as Record<AttackInputKey, AttackCooldownDisplay>,
    [controlledFighterDefinition, controlledFighterRuntime],
  );

  const syncVisualInput = () => {
    const nextInput = {
      left: keyboardInputRef.current.left || pointerInputRef.current.left,
      right: keyboardInputRef.current.right || pointerInputRef.current.right,
      up: keyboardInputRef.current.up || pointerInputRef.current.up,
      punch: keyboardInputRef.current.punch || pointerInputRef.current.punch,
      kick: keyboardInputRef.current.kick || pointerInputRef.current.kick,
      special:
        keyboardInputRef.current.special || pointerInputRef.current.special,
    };

    liveInputRef.current = nextInput;
    setVisualInput(nextInput);
  };

  const clearInputs = () => {
    keyboardInputRef.current = cloneInput();
    pointerInputRef.current = cloneInput();
    liveInputRef.current = cloneInput();
    setVisualInput(cloneInput());
  };

  const setInputSourceValue = (
    source: 'keyboard' | 'pointer',
    key: ControlInputKey,
    value: boolean,
  ) => {
    const target =
      source === 'keyboard'
        ? keyboardInputRef.current
        : pointerInputRef.current;
    if (target[key] === value) {
      return;
    }

    target[key] = value;
    syncVisualInput();
  };

  const focusMatch = () => {
    containerRef.current?.focus({ preventScroll: true });
  };

  const pauseMatch = () => {
    clearInputs();
    isPausedRef.current = true;
    setIsPaused(true);
  };

  const resumeMatch = () => {
    isPausedRef.current = false;
    setIsPaused(false);
    window.requestAnimationFrame(() => {
      focusMatch();
    });
  };

  useEffect(() => {
    focusMatch();
  }, [props.fighterId, props.mode, props.opponentId, props.roomCode]);

  useEffect(() => {
    const currentDocument = document as FullscreenCapableDocument;

    const syncFullscreenState = () => {
      const fullscreenCapableScreen = screenRef.current as FullscreenCapableElement | null;
      setIsFullscreenSupported(
        Boolean(
          fullscreenCapableScreen &&
            (
              typeof fullscreenCapableScreen.requestFullscreen === 'function' ||
              typeof fullscreenCapableScreen.webkitRequestFullscreen === 'function'
            ),
        ),
      );
      setIsFullscreen(getFullscreenElement(currentDocument) === screenRef.current);
    };

    syncFullscreenState();
    currentDocument.addEventListener('fullscreenchange', syncFullscreenState);
    currentDocument.addEventListener(
      'webkitfullscreenchange',
      syncFullscreenState as EventListener,
    );

    return () => {
      currentDocument.removeEventListener('fullscreenchange', syncFullscreenState);
      currentDocument.removeEventListener(
        'webkitfullscreenchange',
        syncFullscreenState as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    setIsSceneBooting(true);
    setConnectionState('Loading');
    fighterAssetManifestsRef.current = {};
    projectileAssetSourcesRef.current = {};
    setFighterAssetManifests({});
    isPausedRef.current = false;
    setIsPaused(false);
    setPlayerSlot(1);
    clearInputs();
    hasReportedResult.current = false;
    let destroyed = false;
    let socket: WebSocket | null = null;
    const localMatchConfig =
      props.mode === 'training' ? TRAINING_CONFIG : DEFAULT_CONFIG;

    const createLocalMatch = () =>
      createMatchState(
        roster,
        fighterDefinition.id,
        opponentDefinition.id,
        props.playerName || fighterDefinition.name,
        opponentDefinition.name,
        localMatchConfig,
      );

    const localState = {
      current: createLocalMatch(),
    };

    setHudState(props.mode === 'online' ? null : localState.current);

    const keyMap: Record<string, keyof InputState> = {
      KeyW: 'up',
      KeyA: 'left',
      KeyD: 'right',
      KeyJ: 'punch',
      KeyK: 'kick',
      KeyL: 'special',
    };

    const cleanupKeyboard = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        if (isPausedRef.current) {
          resumeMatch();
        } else {
          pauseMatch();
        }
        return;
      }

      if (isPausedRef.current) {
        return;
      }

      const key = keyMap[event.code];
      if (key) {
        event.preventDefault();
        setInputSourceValue('keyboard', key, true);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const key = keyMap[event.code];
      if (key) {
        event.preventDefault();
        setInputSourceValue('keyboard', key, false);
      }
    };

    const onWindowBlur = () => {
      clearInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);

    let phaserGame: any = null;

    const mergeFighterAssetEntries = (
      entries: ReadonlyArray<readonly [string, FighterAssetManifest]>,
    ) => {
      if (destroyed || entries.length === 0) {
        return;
      }

      const nextEntries = entries.filter(
        ([fighterId, manifest]) =>
          fighterAssetManifestsRef.current[fighterId] !== manifest,
      );

      if (nextEntries.length === 0) {
        return;
      }

      const nextManifestMap = Object.fromEntries(
        nextEntries,
      ) as Record<string, FighterAssetManifest>;
      fighterAssetManifestsRef.current = {
        ...fighterAssetManifestsRef.current,
        ...nextManifestMap,
      };
      setFighterAssetManifests((current) => ({
        ...current,
        ...nextManifestMap,
      }));

      if (arenaSceneRef.current) {
        queueManifestTextures(arenaSceneRef.current, nextManifestMap);
      }
    };

    const mergeProjectileAssetEntries = (
      entries: ReadonlyArray<readonly [string, string]>,
    ) => {
      if (destroyed || entries.length === 0) {
        return;
      }

      const nextEntries = entries.filter(
        ([sprite, source]) => projectileAssetSourcesRef.current[sprite] !== source,
      );

      if (nextEntries.length === 0) {
        return;
      }

      const nextProjectileSourceMap = Object.fromEntries(
        nextEntries,
      ) as Record<string, string>;
      projectileAssetSourcesRef.current = {
        ...projectileAssetSourcesRef.current,
        ...nextProjectileSourceMap,
      };

      if (arenaSceneRef.current) {
        queueProjectileTextures(
          arenaSceneRef.current,
          nextProjectileSourceMap,
        );
      }
    };

    const ensureFighterAssets = async (fightersToLoad: CharacterDefinition[]) => {
      const missingFighters = getUniqueFighters(fightersToLoad).filter(
        (fighter) => !fighterAssetManifestsRef.current[fighter.id],
      );

      if (missingFighters.length === 0) {
        return;
      }

      const assetEntries = await Promise.all(
        missingFighters.map(
          async (fighter) =>
            [fighter.id, await getCachedFighterAssets(fighter)] as const,
        ),
      );

      mergeFighterAssetEntries(assetEntries);
    };

    const ensureProjectileAssets = async (
      fightersToLoad: CharacterDefinition[],
    ) => {
      const projectileSprites = getUniqueProjectileSprites(
        getUniqueFighters(fightersToLoad),
      );

      if (projectileSprites.length === 0) {
        return;
      }

      const assetEntries = (
        await Promise.all(
          projectileSprites.map(async (sprite) => {
            const source = await getCachedProjectileAssetSource(sprite);
            return source ? ([sprite, source] as const) : null;
          }),
        )
      ).flatMap((entry) => (entry ? [entry] : []));

      mergeProjectileAssetEntries(assetEntries);
    };

    const ensureAssetsByIds = async (
      fighterIds: Array<string | undefined>,
    ) => {
      const fightersToLoad = getUniqueFighters(
        fighterIds.flatMap((fighterId) =>
          fighterId && roster[fighterId] ? [roster[fighterId]] : [],
        ),
      );

      await Promise.all([
        ensureFighterAssets(fightersToLoad),
        ensureProjectileAssets(fightersToLoad),
      ]);
    };

    void (async () => {
      await Promise.all([
        ensureFighterAssets([fighterDefinition, opponentDefinition]),
        ensureProjectileAssets([fighterDefinition, opponentDefinition]),
      ]);

      if (destroyed) {
        return;
      }

      const Phaser = await phaserModulePromise;

      if (destroyed) {
        return;
      }

      class ArenaScene extends Phaser.Scene {
        private readonly simulationStepMs = 1000 / FPS;
        private arenaBackground?: InstanceType<typeof Phaser.GameObjects.Image>;
        private backgroundGraphics!: InstanceType<
          typeof Phaser.GameObjects.Graphics
        >;
        private fighterGraphics!: InstanceType<
          typeof Phaser.GameObjects.Graphics
        >;
        private projectileGraphics!: InstanceType<
          typeof Phaser.GameObjects.Graphics
        >;
        private fighterSprites = new Map<
          1 | 2,
          InstanceType<typeof Phaser.GameObjects.Image>
        >();
        private projectileSprites = new Map<
          number,
          InstanceType<typeof Phaser.GameObjects.Image>
        >();
        private projectileTrailSprites = new Map<
          number,
          Array<InstanceType<typeof Phaser.GameObjects.Image>>
        >();
        private simulationAccumulatorMs = 0;

        private destroyProjectileVisual(projectileId: number) {
          const projectileSprite = this.projectileSprites.get(projectileId);
          projectileSprite?.destroy();
          this.projectileSprites.delete(projectileId);

          this.clearProjectileTrailSprites(projectileId);
        }

        private clearProjectileTrailSprites(projectileId: number) {
          const trailSprites = this.projectileTrailSprites.get(projectileId) ?? [];
          trailSprites.forEach((trailSprite) => trailSprite.destroy());
          this.projectileTrailSprites.delete(projectileId);
        }

        private syncProjectileTrailSprites(
          projectile: MatchState['projectiles'][number],
          textureKey: string,
          scale: number,
        ) {
          const trailAlphas = getProjectileTrailAlphas(projectile);
          const existingTrailSprites =
            this.projectileTrailSprites.get(projectile.id) ?? [];

          if (trailAlphas.length === 0) {
            existingTrailSprites.forEach((trailSprite) => trailSprite.destroy());
            this.projectileTrailSprites.delete(projectile.id);
            return;
          }

          const velocityMagnitude = Math.hypot(projectile.vx, projectile.vy);
          const directionX =
            velocityMagnitude > 0.001 ? projectile.vx / velocityMagnitude : projectile.facing;
          const directionY =
            velocityMagnitude > 0.001 ? projectile.vy / velocityMagnitude : 0;
          const spacing = Math.max(projectile.hitbox.width * 0.6, 14);
          const rotation = Math.atan2(projectile.vy, projectile.vx);
          const nextTrailSprites = trailAlphas.map((alpha, index) => {
            const trailSprite =
              existingTrailSprites[index] ??
              this.add.image(projectile.x, projectile.y, textureKey);
            const offset = spacing * (index + 1);

            trailSprite.setTexture(textureKey);
            trailSprite.setVisible(true);
            trailSprite.setDepth(3.9 - index * 0.01);
            trailSprite.setOrigin(0.5, 0.5);
            trailSprite.setPosition(
              projectile.x - directionX * offset,
              projectile.y - directionY * offset,
            );
            trailSprite.setRotation(rotation);
            trailSprite.setScale(scale * (1 - index * 0.08));
            trailSprite.setAlpha(alpha);
            return trailSprite;
          });

          existingTrailSprites
            .slice(trailAlphas.length)
            .forEach((trailSprite) => trailSprite.destroy());

          this.projectileTrailSprites.set(projectile.id, nextTrailSprites);
        }

        constructor() {
          super('arena');
        }

        preload() {
          if (!this.textures.exists(defaultArenaBackgroundKey)) {
            this.load.image(
              defaultArenaBackgroundKey,
              defaultArenaBackgroundPath,
            );
          }

          queueManifestTextures(this, fighterAssetManifestsRef.current, false);
          queueProjectileTextures(
            this,
            projectileAssetSourcesRef.current,
            false,
          );
        }

        create() {
          this.cameras.main.setBackgroundColor('#08101b');
          if (this.textures.exists(defaultArenaBackgroundKey)) {
            const arenaSource = this.textures
              .get(defaultArenaBackgroundKey)
              .getSourceImage() as {
              width: number;
              height: number;
            };
            const arenaScale = Math.max(
              DEFAULT_CONFIG.width / arenaSource.width,
              DEFAULT_CONFIG.height / arenaSource.height,
            );
            this.arenaBackground = this.add.image(
              DEFAULT_CONFIG.width / 2,
              DEFAULT_CONFIG.height / 2,
              defaultArenaBackgroundKey,
            );
            this.arenaBackground.setScale(arenaScale);
            this.arenaBackground.setAlpha(0.92);
            this.arenaBackground.setDepth(0);
          }
          this.backgroundGraphics = this.add.graphics();
          this.backgroundGraphics.setDepth(1);
          this.fighterGraphics = this.add.graphics();
          this.fighterGraphics.setDepth(3);
          this.projectileGraphics = this.add.graphics();
          this.projectileGraphics.setDepth(4);
          arenaSceneRef.current = this;
          setIsSceneBooting(false);

          if (props.mode === 'online') {
            if (!props.token || !props.roomCode) {
              setConnectionState('Missing room token.');
              return;
            }

            socket = new WebSocket(
              `${matchServiceUrl}/match?token=${encodeURIComponent(props.token)}`,
            );
            socket.addEventListener('open', () => {
              setConnectionState('Connected to match service.');
              socket?.send(
                JSON.stringify({
                  type: 'select_fighter',
                  fighterId: fighterDefinition.id,
                  playerName: props.playerName || fighterDefinition.name,
                }),
              );
              socket?.send(JSON.stringify({ type: 'ready' }));
            });

            socket.addEventListener('message', (event) => {
              const message: ServerMessage = JSON.parse(event.data);
              if (message.type === 'snapshot') {
                void ensureAssetsByIds(
                  message.state.fighters.map((fighter) => fighter.fighterId),
                );
                localState.current = message.state;
                setHudState(message.state);
              } else if (message.type === 'room_state') {
                void ensureAssetsByIds([
                  message.selections.host,
                  message.selections.guest,
                ]);
                setConnectionState(
                  `Room ${message.roomCode} · connected ${message.connectedSlots.length}/2`,
                );
              } else if (message.type === 'info') {
                setPlayerSlot(message.slot);
                setConnectionState(message.message);
              }
            });

            socket.addEventListener('close', () => {
              setConnectionState('Match service disconnected.');
            });
          } else if (props.mode === 'training') {
            setConnectionState(
              'Training mode running against an immobile dummy.',
            );
          } else {
            setConnectionState('Fight mode running against a bot.');
          }
        }

        update(_time: number, delta: number) {
          if (destroyed) {
            return;
          }

          if (isPausedRef.current) {
            this.draw(localState.current);
            return;
          }

          if (props.mode === 'local' || props.mode === 'training') {
            this.simulationAccumulatorMs += Math.min(delta, 100);
            let didAdvanceSimulation = false;

            while (this.simulationAccumulatorMs >= this.simulationStepMs) {
              const opponentInput =
                props.mode === 'training'
                  ? EMPTY_INPUT
                  : createAiInput(localState.current);
              localState.current = stepMatch(
                localState.current,
                roster,
                liveInputRef.current,
                opponentInput,
                localMatchConfig,
              );
              this.simulationAccumulatorMs -= this.simulationStepMs;
              didAdvanceSimulation = true;
            }

            if (didAdvanceSimulation && localState.current.frame % 2 === 0) {
              setHudState(localState.current);
            }
          } else if (socket?.readyState === WebSocket.OPEN) {
            socket.send(
              JSON.stringify({
                type: 'input',
                input: encodeInput(liveInputRef.current),
              }),
            );
          }

          this.draw(localState.current);
        }

        draw(state: MatchState) {
          this.backgroundGraphics.clear();
          this.fighterGraphics.clear();
          this.projectileGraphics.clear();
          if (!this.arenaBackground) {
            this.backgroundGraphics.fillGradientStyle(
              0x13233a,
              0x13233a,
              0x08101b,
              0x08101b,
              1,
            );
            this.backgroundGraphics.fillRect(
              0,
              0,
              DEFAULT_CONFIG.width,
              DEFAULT_CONFIG.height,
            );
            this.backgroundGraphics.lineStyle(2, 0x1f3554, 0.5);
            for (let x = 0; x < DEFAULT_CONFIG.width; x += 48) {
              this.backgroundGraphics.beginPath();
              this.backgroundGraphics.moveTo(x, 0);
              this.backgroundGraphics.lineTo(x, DEFAULT_CONFIG.height);
              this.backgroundGraphics.strokePath();
            }
            for (let y = 80; y < DEFAULT_CONFIG.height; y += 48) {
              this.backgroundGraphics.beginPath();
              this.backgroundGraphics.moveTo(0, y);
              this.backgroundGraphics.lineTo(DEFAULT_CONFIG.width, y);
              this.backgroundGraphics.strokePath();
            }

            this.backgroundGraphics.fillStyle(0x0f3322, 1);
            this.backgroundGraphics.fillRect(
              0,
              DEFAULT_CONFIG.groundY + 12,
              DEFAULT_CONFIG.width,
              DEFAULT_CONFIG.height - DEFAULT_CONFIG.groundY,
            );
            this.backgroundGraphics.fillStyle(0x122e47, 1);
            this.backgroundGraphics.fillRect(
              0,
              DEFAULT_CONFIG.groundY,
              DEFAULT_CONFIG.width,
              12,
            );
          } else {
            this.backgroundGraphics.fillStyle(0x07101a, 0.18);
            this.backgroundGraphics.fillRect(
              0,
              0,
              DEFAULT_CONFIG.width,
              DEFAULT_CONFIG.height,
            );
            this.backgroundGraphics.fillStyle(0x02050a, 0.2);
            this.backgroundGraphics.fillEllipse(
              DEFAULT_CONFIG.width / 2,
              DEFAULT_CONFIG.groundY + 34,
              DEFAULT_CONFIG.width * 0.76,
              90,
            );
          }

          state.fighters.forEach((fighter) => {
            const definition = roster[fighter.fighterId];
            const manifest = fighterAssetManifestsRef.current[fighter.fighterId];
            const activeStance = getAvailableAnimationStance(fighter, manifest);
            const existingSprite = this.fighterSprites.get(fighter.slot);

            if (activeStance && manifest) {
              const frames = manifest.stanceSources[activeStance];
              const frameIndex = getAnimationFrameIndex(
                fighter,
                definition,
                activeStance,
                frames.length,
                state.frame,
              );
              const textureKey = getAnimationTextureKey(
                fighter.fighterId,
                activeStance,
                frameIndex,
              );
              if (!this.textures.exists(textureKey)) {
                existingSprite?.setVisible(false);
                renderFighterFallback(this.fighterGraphics, fighter, definition);
                return;
              }
              const sourceImage = this.textures
                .get(textureKey)
                .getSourceImage() as { height: number };
              const spriteScale =
                (definition.sprites.renderHeight ??
                  defaultFighterRenderHeight) / sourceImage.height;
              const fighterSprite =
                existingSprite ??
                this.add.image(fighter.x, fighter.y + 6, textureKey);
              const visualLift = getDashVisualLift(fighter, definition);

              fighterSprite.setTexture(textureKey);
              fighterSprite.setVisible(true);
              fighterSprite.setDepth(3);
              fighterSprite.setOrigin(0.5, 1);
              fighterSprite.setPosition(fighter.x, fighter.y + 6 - visualLift);
              fighterSprite.setFlipX(fighter.facing < 0);
              fighterSprite.setScale(spriteScale);
              this.fighterSprites.set(fighter.slot, fighterSprite);
            } else {
              existingSprite?.setVisible(false);
              renderFighterFallback(this.fighterGraphics, fighter, definition);
            }
          });

          const activeProjectileIds = new Set(
            state.projectiles.map((projectile) => projectile.id),
          );
          for (const projectileId of new Set([
            ...this.projectileSprites.keys(),
            ...this.projectileTrailSprites.keys(),
          ])) {
            if (activeProjectileIds.has(projectileId)) {
              continue;
            }

            this.destroyProjectileVisual(projectileId);
          }

          state.projectiles.forEach((projectile) => {
            const textureKey = getProjectileTextureKey(projectile.sprite);
            const existingSprite = this.projectileSprites.get(projectile.id);

            if (!this.textures.exists(textureKey)) {
              renderProjectileFallback(this.projectileGraphics, projectile);
              existingSprite?.setVisible(false);
              this.clearProjectileTrailSprites(projectile.id);
              return;
            }

            const sourceImage = this.textures
              .get(textureKey)
              .getSourceImage() as { width: number; height: number };
            const spriteScale = getProjectileSpriteScale(projectile, sourceImage);
            const projectileSprite =
              existingSprite ??
              this.add.image(projectile.x, projectile.y, textureKey);

            projectileSprite.setTexture(textureKey);
            projectileSprite.setVisible(true);
            projectileSprite.setDepth(4);
            projectileSprite.setOrigin(0.5, 0.5);
            projectileSprite.setPosition(projectile.x, projectile.y);
            projectileSprite.setRotation(
              Math.atan2(projectile.vy, projectile.vx),
            );
            projectileSprite.setScale(spriteScale);
            projectileSprite.setAlpha(1);
            this.projectileSprites.set(projectile.id, projectileSprite);
            this.syncProjectileTrailSprites(
              projectile,
              textureKey,
              spriteScale,
            );
          });
        }
      }

      phaserGame = new Phaser.Game({
        type: Phaser.AUTO,
        width: DEFAULT_CONFIG.width,
        height: DEFAULT_CONFIG.height,
        parent: containerRef.current!,
        backgroundColor: '#08101b',
        scene: ArenaScene,
      });
    })();

    return () => {
      destroyed = true;
      arenaSceneRef.current = null;
      cleanupKeyboard();
      socket?.close();
      phaserGame?.destroy(true);
    };
  }, [
    fighterDefinition,
    opponentDefinition,
    props.fighterId,
    props.mode,
    props.opponentId,
    props.playerName,
    props.roomCode,
    props.token,
  ]);

  useEffect(() => {
    if (
      props.mode !== 'online' ||
      !props.roomCode ||
      !hudState ||
      hudState.status !== 'match-over' ||
      hasReportedResult.current
    ) {
      return;
    }

    hasReportedResult.current = true;
    void fetch('/api/match/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomCode: props.roomCode,
        winnerSlot: hudState.winner,
        players: hudState.fighters.map((fighter) => ({
          slot: fighter.slot,
          name: fighter.name,
          fighterId: fighter.fighterId,
        })),
        summary: {
          rounds: hudState.round,
          events: hudState.events,
        },
      }),
    });
  }, [hudState, props.mode, props.roomCode]);

  const hudHeadshots = useMemo(
    () => ({
      [fighterDefinition.id]:
        fighterAssetManifests[fighterDefinition.id]?.headshotSource ?? null,
      [opponentDefinition.id]:
        fighterAssetManifests[opponentDefinition.id]?.headshotSource ?? null,
    }),
    [fighterAssetManifests, fighterDefinition.id, opponentDefinition.id],
  );
  const countdownAnnouncement = hudState
    ? getCountdownAnnouncement(hudState)
    : null;

  const toggleFullscreen = async () => {
    const fullscreenCapableScreen = screenRef.current as FullscreenCapableElement | null;
    if (!fullscreenCapableScreen) {
      return;
    }

    const currentDocument = document as FullscreenCapableDocument;

    try {
      if (getFullscreenElement(currentDocument) === screenRef.current) {
        await exitElementFullscreen(currentDocument);
      } else {
        await requestElementFullscreen(fullscreenCapableScreen);
      }
    } catch {
      return;
    }

    window.requestAnimationFrame(() => {
      focusMatch();
    });
  };

  return (
    <div
      ref={screenRef}
      className={`fight-screen${isPaused ? ' fight-screen-paused' : ''}`}
      onPointerDown={focusMatch}
    >
      {!isSceneBooting && isFullscreenSupported ? (
        <button
          type="button"
          className={`fight-fullscreen-toggle${isFullscreen ? ' fight-fullscreen-toggle-active' : ''}`}
          onClick={() => {
            void toggleFullscreen();
          }}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="fight-fullscreen-toggle-icon"
          >
            {isFullscreen ? (
              <path
                d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5M8 8l4 4M16 8l-4 4M8 16l4-4M16 16l-4-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5M8 8L4 4M16 8l4-4M8 16l-4 4M16 16l4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </button>
      ) : null}
      <div
        ref={containerRef}
        className="fight-canvas"
        tabIndex={0}
        aria-label={`Fight match viewport. ${connectionState}`}
        aria-busy={isSceneBooting}
      >
        {isSceneBooting ? (
          <div className="fight-loading-overlay">
            <div className="fight-loading-faceoff">
              <img
                src={fighterDefinition.sprites.portrait}
                alt={fighterDefinition.name}
                className="fight-loading-portrait fight-loading-portrait-player"
              />
              <img
                src={opponentDefinition.sprites.portrait}
                alt={opponentDefinition.name}
                className="fight-loading-portrait fight-loading-portrait-opponent"
              />
            </div>
          </div>
        ) : null}
      </div>
      {!isSceneBooting && hudState ? (
        <FightHud
          state={hudState}
          headshots={hudHeadshots}
        />
      ) : null}
      {!isSceneBooting && countdownAnnouncement ? (
        <div
          className={`fight-countdown-overlay fight-countdown-phase-${countdownAnnouncement.phase}`}
          aria-live="polite"
        >
          <div className="fight-countdown-panel">
            {countdownAnnouncement.eyebrow ? (
              <div className="fight-countdown-eyebrow">
                {countdownAnnouncement.eyebrow}
              </div>
            ) : null}
            <div className="fight-countdown-title">
              {countdownAnnouncement.title}
            </div>
          </div>
        </div>
      ) : null}
      {!isSceneBooting && isPaused ? (
        <div className="fight-pause-overlay">
          <div className="fight-pause-panel">
            <div className="fight-pause-title">Paused</div>
            <div className="fight-pause-actions">
              <ArcadeMenuItem
                cta
                className="fight-pause-action"
                onClick={resumeMatch}
              >
                Continue
              </ArcadeMenuItem>
              <ArcadeMenuItem
                href="/"
                className="fight-pause-action"
              >
                Menu
              </ArcadeMenuItem>
            </div>
          </div>
        </div>
      ) : null}
      {!isSceneBooting && !isPaused ? (
        <div
          className="fight-controls-shell"
          aria-hidden="true"
        >
          <div className="fight-controls fight-controls-left">
            {movementControls.map((row, rowIndex) => (
              <div
                key={`movement-${rowIndex}`}
                className="fight-controls-row"
              >
                {row.map((control) => (
                  <button
                    key={control.key}
                    type="button"
                    className={`fight-control-button${visualInput[control.key] ? ' fight-control-button-active' : ''}`}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      focusMatch();
                      setInputSourceValue('pointer', control.key, true);
                    }}
                    onPointerUp={() =>
                      setInputSourceValue('pointer', control.key, false)
                    }
                    onPointerLeave={() =>
                      setInputSourceValue('pointer', control.key, false)
                    }
                    onPointerCancel={() =>
                      setInputSourceValue('pointer', control.key, false)
                    }
                  >
                    <span className="fight-control-button-face">
                      {control.label}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="fight-controls fight-controls-right">
            {attackControls.map((row, rowIndex) => (
              <div
                key={`attack-${rowIndex}`}
                className="fight-controls-row"
              >
                {row.map((control) => {
                  const cooldown = attackCooldowns[control.key as AttackInputKey] ??
                    zeroAttackCooldownDisplay;
                  const coolingClass = cooldown.cooling
                    ? ' fight-control-button-cooling'
                    : '';
                  const activeClass = visualInput[control.key]
                    ? ' fight-control-button-active'
                    : '';
                  const cooldownStyle = cooldown.cooling
                    ? ({ '--cooldown-ratio': `${cooldown.remainingRatio}` } as CSSProperties)
                    : undefined;

                  return (
                    <div
                      key={control.key}
                      className="fight-control-stack"
                    >
                      <button
                        type="button"
                        className={`fight-control-button${activeClass}${coolingClass}`}
                        aria-disabled={cooldown.cooling}
                        style={cooldownStyle}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          focusMatch();
                          if (cooldown.cooling) {
                            setInputSourceValue('pointer', control.key, false);
                            return;
                          }

                          setInputSourceValue('pointer', control.key, true);
                        }}
                        onPointerUp={() =>
                          setInputSourceValue('pointer', control.key, false)
                        }
                        onPointerLeave={() =>
                          setInputSourceValue('pointer', control.key, false)
                        }
                        onPointerCancel={() =>
                          setInputSourceValue('pointer', control.key, false)
                        }
                      >
                        <span className="fight-control-button-face">
                          {control.label}
                        </span>
                        {cooldown.cooling ? (
                          <span
                            className="fight-control-button-cooldown-sweep"
                            aria-hidden="true"
                          />
                        ) : null}
                      </button>
                      <span
                        className={`fight-control-cooldown-label${cooldown.cooling ? ' fight-control-cooldown-label-active' : ''}`}
                      >
                        {cooldown.remainingLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
