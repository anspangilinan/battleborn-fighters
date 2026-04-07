'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

import { ArcadeMenuItem } from '@/components/arcade-menu-item';
import { FightHud } from '@/components/fight-hud';
import {
  createAudienceCrowd,
  type AudienceCharacterDefinition,
  type AudienceFanPlacement,
} from '@/lib/audience';
import { getArena, pickRandomArenaId } from '@/lib/arenas';

import { fighterRoster, getFighter } from '@battleborn/content';
import {
  DEFAULT_CONFIG,
  EMPTY_INPUT,
  FPS,
  MAX_OVERCHARGE_METER,
  cloneInput,
  createMatchState,
  decodeInput,
  encodeInput,
  getDashDurationFrames,
  getMoveCooldownFrames,
  getMoveMeleeRange,
  stepMatch,
  type Box,
  type CharacterDefinition,
  type Facing,
  type InputState,
  type MatchState,
} from '@battleborn/game-core';

const roster = fighterRoster;
const matchServiceUrl =
  process.env.NEXT_PUBLIC_MATCH_SERVICE_URL ?? 'ws://localhost:8787';
const defaultFighterRenderHeight = 168;
const TRAINING_CONFIG = {
  ...DEFAULT_CONFIG,
  roundSeconds: Number.POSITIVE_INFINITY,
};
const TRAINING_HEALTH_RECOVERY_PER_FRAME = 48;
const TRAINING_OVERCHARGE_RECOVERY_PER_FRAME = 5;

type OverchargeActivationFlash = {
  key: string;
  xPercent: number;
  yPercent: number;
  intensity: number;
  coreSizePercent: number;
  haloSizePercent: number;
  blurPx: number;
};
type FightMode = 'local' | 'training' | 'online' | 'arcade';
type TrainingOpponentMode = 'idle' | 'bot';
type ControlInputKey = keyof Pick<
  InputState,
  'up' | 'left' | 'right' | 'punch' | 'kick' | 'special' | 'overcharge'
>;
type AttackInputKey = keyof Pick<InputState, 'punch' | 'kick' | 'special'>;
type AttackCooldownDisplay = {
  cooling: boolean;
  remainingFrames: number;
  remainingLabel: string;
  remainingRatio: number;
};
type FightAnnouncementPhase = 'round' | 'fight' | 'ko' | 'result';
type FightAnnouncement = {
  eyebrow: string;
  title: string;
  phase: FightAnnouncementPhase;
};
type AiDirectionKey = 'left' | 'right';
type FightBotDashJumpSequence = {
  directionKey: AiDirectionKey;
  dodgeProjectileId: number | null;
  secondTapFrame: number | null;
  step: 'first-tap' | 'release' | 'second-tap' | 'jump';
};
type FightBotState = {
  dashJumpCooldownUntilFrame: number;
  dashJumpSequence: FightBotDashJumpSequence | null;
  projectileDodgeDecisions: Record<number, boolean>;
};
type NormalizedFightBotProfile = {
  aggressiveness: number;
  arenaMovement: {
    preferredDistanceMultiplier: number;
    approachBias: number;
    retreatBias: number;
    jumpInChance: number;
    dashJumpForwardChance: number;
    dashJumpBackwardChance: number;
  };
  skillChoice: {
    punchWeight: number;
    kickWeight: number;
    specialWeight: number;
    attackCadenceMultiplier: number;
  };
  defense: {
    blockChance: number;
    projectileDodgeChance: number;
    meleeBlockReactionFrames: number;
    projectileBlockReactionFrames: number;
  };
};

export interface FightSceneProps {
  mode: FightMode;
  fighterId: string;
  opponentId: string;
  arenaId: string;
  concealFighterOnLoading?: boolean;
  concealOpponentOnLoading?: boolean;
  arcadeOrder?: string[];
  arcadeIndex?: number;
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

function buildArcadeFightHref(
  fighterId: string,
  arcadeOrder: string[],
  arcadeIndex: number,
  currentArenaId?: string,
  playerName?: string,
) {
  const params = new URLSearchParams({
    mode: 'arcade',
    fighter: fighterId,
    arena: pickRandomArenaId(currentArenaId),
    arcadeOrder: arcadeOrder.join(','),
    arcadeIndex: String(arcadeIndex),
  });
  const opponentId = arcadeOrder[arcadeIndex];
  if (opponentId) {
    params.set('opponent', opponentId);
  }

  if (playerName) {
    params.set('name', playerName);
  }

  return `/fight?${params.toString()}`;
}

const fightAnimationStances = [
  'idle',
  'walk',
  'jump',
  'block',
  'dash',
  'hurt',
  'ko',
  'win',
  'attack1',
  'attack2',
  'special',
  'special-pose',
] as const;
type FightAnimationStance = (typeof fightAnimationStances)[number];
const KO_SLOWDOWN_DURATION_MS = 260;
const KO_SLOWDOWN_TIME_SCALE = 1 / 3;
const KO_ANNOUNCEMENT_DURATION_MS = 2000;
const PARAK_WIN_COMPANION_FIGHTER_ID = 'paraktaktak';
const PARAK_WIN_COMPANION_RENDER_HEIGHT = 55;
const PARAK_WIN_COMPANION_WALK_FRAME_DURATION = 6;
const PARAK_WIN_COMPANION_FINISH_FRAME_DURATION = 7;
const PARAK_WIN_COMPANION_WALK_SPEED = 4.1;
const PARAK_WIN_COMPANION_SCREEN_MARGIN = 44;
const PARAK_WIN_COMPANION_TARGET_OFFSET = 58;

type FighterAssetManifest = {
  headshotSource: string | null;
  portraitSource: string | null;
  stanceSources: Record<FightAnimationStance, string[]>;
  winCompanion: {
    walkSources: string[];
    finishSources: string[];
  } | null;
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

const movementControls: Array<{ key: ControlInputKey; label: string }> = [
  { key: 'left', label: 'A' },
  { key: 'up', label: 'W' },
  { key: 'right', label: 'D' },
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

function getAudienceShellStyle(
  audience: NonNullable<ReturnType<typeof getArena>['audience']>,
): CSSProperties {
  return {
    '--fight-audience-barrier-top': `${audience.barrierTopPercent}%`,
    '--fight-audience-barrier-height': `${audience.barrierHeightPercent}%`,
    '--fight-audience-barrier-opacity': `${audience.barrierOpacity}`,
    '--fight-audience-barrier-tint': audience.barrierTint,
    '--fight-audience-highlight-tint': audience.highlightTint,
    '--fight-audience-haze-opacity': `${audience.hazeOpacity}`,
    '--fight-audience-haze-tint': audience.hazeTint,
  } as CSSProperties;
}

function getAudienceFrameSources(
  character: AudienceCharacterDefinition,
  manifest: FighterAssetManifest | undefined,
) {
  if (!manifest) {
    return [];
  }

  const preferredStances = [
    ...character.preferredStances,
    'idle',
    'walk',
    'win',
    'attack1',
    'attack2',
    'special',
    'special-pose',
  ] as const satisfies readonly FightAnimationStance[];

  for (const stance of preferredStances) {
    const frames = manifest.stanceSources[stance];
    if (frames.length > 0) {
      return frames;
    }
  }

  return [];
}

function getAudienceFrameSource(
  fan: AudienceFanPlacement,
  manifest: FighterAssetManifest | undefined,
  matchFrame: number,
) {
  const frames = getAudienceFrameSources(fan.character, manifest);
  if (frames.length === 0) {
    return null;
  }

  const frameDuration = Math.max(1, fan.character.frameDurationFrames);
  const frameIndex =
    Math.floor((matchFrame + fan.frameOffsetFrames) / frameDuration) %
    frames.length;

  return frames[frameIndex] ?? frames[0] ?? null;
}

function getAudienceFanStyle(
  fan: AudienceFanPlacement,
  definition: CharacterDefinition | undefined,
): CSSProperties {
  const renderHeight = definition?.sprites.renderHeight ?? defaultFighterRenderHeight;
  const heightPercent = Math.min(
    26,
    Math.max(13, (renderHeight * fan.scale / DEFAULT_CONFIG.height) * 100),
  );

  return {
    '--fight-audience-depth': `${fan.depth}`,
    '--fight-audience-x': `${fan.xPercent}%`,
    '--fight-audience-y': `${fan.yPercent}%`,
    '--fight-audience-height': `${heightPercent}%`,
    '--fight-audience-blur': `${fan.blurPx}px`,
    '--fight-audience-opacity': `${fan.opacity}`,
    '--fight-audience-duration': `${fan.durationMs}ms`,
    '--fight-audience-delay': `-${fan.delayMs}ms`,
    '--fight-audience-bob': `${fan.bobPx}px`,
    '--fight-audience-sway': `${fan.swayDeg}deg`,
    '--fight-audience-lean': `${fan.leanDeg}deg`,
    '--fight-audience-flip': fan.flipX ? '-1' : '1',
  } as CSSProperties;
}

function getOverchargeActivationFlashStyle(
  flash: OverchargeActivationFlash,
): CSSProperties {
  return {
    '--fight-overcharge-flash-x': `${flash.xPercent}%`,
    '--fight-overcharge-flash-y': `${flash.yPercent}%`,
    '--fight-overcharge-flash-intensity': `${flash.intensity}`,
    '--fight-overcharge-flash-core-size': `${flash.coreSizePercent}%`,
    '--fight-overcharge-flash-halo-size': `${flash.haloSizePercent}%`,
    '--fight-overcharge-flash-blur': `${flash.blurPx}px`,
  } as CSSProperties;
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
  return loadSequentialFrameSet(assetDirectory);
}

async function loadSequentialFrameSet(assetBasePath: string) {
  const namingStrategies = [
    (index: number) => `${String(index + 1).padStart(2, '0')}.png`,
    (index: number) => `${index}.png`,
    (index: number) => `${index + 1}.png`,
  ];

  for (const getFrameName of namingStrategies) {
    const discoveredFrames: string[] = [];
    for (let index = 0; index < 24; index += 1) {
      const src = `${assetBasePath}${getFrameName(index)}`;
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

async function discoverPrefixedFrames(
  assetRoots: string[],
  prefixes: string[],
) {
  for (const root of assetRoots) {
    for (const prefix of prefixes) {
      const frames = await loadSequentialFrameSet(`${root}/${prefix}`);
      if (frames.length > 0) {
        return frames;
      }
    }
  }

  return [];
}

async function discoverWinCompanionAssets(
  fighter: CharacterDefinition,
  assetRoots: string[],
) {
  if (fighter.id !== PARAK_WIN_COMPANION_FIGHTER_ID) {
    return null;
  }

  const walkSources = await discoverPrefixedFrames(assetRoots, [
    'animations/win/comp-walk-',
    'win/comp-walk-',
  ]);
  const finishSources = await discoverPrefixedFrames(assetRoots, [
    'animations/win/comp-',
    'win/comp-',
  ]);

  if (walkSources.length === 0 && finishSources.length === 0) {
    return null;
  }

  return { walkSources, finishSources };
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
  const winCompanion = await discoverWinCompanionAssets(fighter, assetRoots);

  return {
    headshotSource,
    portraitSource,
    stanceSources: Object.fromEntries(stanceEntries) as Record<
      FightAnimationStance,
      string[]
    >,
    winCompanion,
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

    manifest.winCompanion?.walkSources.forEach((source, frameIndex) => {
      const textureKey = getWinCompanionTextureKey(
        fighterId,
        'walk',
        frameIndex,
      );
      if (!scene.textures.exists(textureKey)) {
        scene.load.image(textureKey, source);
      }
    });

    manifest.winCompanion?.finishSources.forEach((source, frameIndex) => {
      const textureKey = getWinCompanionTextureKey(
        fighterId,
        'finish',
        frameIndex,
      );
      if (!scene.textures.exists(textureKey)) {
        scene.load.image(textureKey, source);
      }
    });
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
  state: MatchState,
  fighter: MatchState['fighters'][number],
  definition: CharacterDefinition,
): FightAnimationStance {
  if (shouldUseWinStance(state, fighter)) {
    return 'win';
  }

  if (fighter.action === 'attack') {
    const move = fighter.attackId ? definition.moves[fighter.attackId] : null;
    if (move?.animationStance) {
      return move.animationStance;
    }

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

  if (fighter.action === 'guard') {
    return 'block';
  }

  if (fighter.action === 'jump') {
    return 'jump';
  }

  if (fighter.action === 'walk') {
    return 'walk';
  }

  return 'idle';
}

function getRoundWinnerSlot(state: MatchState) {
  if (state.status === 'match-over') {
    return state.winner;
  }

  if (state.status !== 'round-over') {
    return null;
  }

  const [leftFighter, rightFighter] = state.fighters;
  if (leftFighter.health === rightFighter.health) {
    return null;
  }

  return leftFighter.health > rightFighter.health
    ? leftFighter.slot
    : rightFighter.slot;
}

function shouldUseWinStance(
  state: MatchState,
  fighter: MatchState['fighters'][number],
) {
  return getRoundWinnerSlot(state) === fighter.slot &&
    fighter.health > 0 &&
    fighter.grounded;
}

function getAvailableAnimationStance(
  state: MatchState,
  fighter: MatchState['fighters'][number],
  definition: CharacterDefinition,
  manifest: FighterAssetManifest | undefined,
): FightAnimationStance | null {
  if (!manifest) {
    return null;
  }

  const desiredStance = getDesiredAnimationStance(state, fighter, definition);
  if (manifest.stanceSources[desiredStance].length > 0) {
    return desiredStance;
  }

  return manifest.stanceSources.idle.length > 0 ? 'idle' : null;
}

function isBlinkFrameVisible(
  fighter: MatchState['fighters'][number],
  frame: number,
) {
  if (fighter.invulnerableFrames <= 0) {
    return true;
  }

  return Math.floor(frame / 4) % 2 === 0;
}

function getAttackTotalFrames(move: CharacterDefinition['moves'][string]) {
  return move.startup + move.active + move.recovery;
}

function isSpecialCinematicPhase(phase: MatchState['fighters'][number]['specialMovePhase']) {
  return phase != null && phase !== 'follow-through';
}

function getSpecialBuildUpAnimation(
  manifest: FighterAssetManifest | undefined,
  move: CharacterDefinition['moves'][string],
) {
  const specialPoseSources = manifest?.stanceSources['special-pose'] ?? [];
  if (
    move.specialSequence?.buildUpAnimation === 'special-pose' &&
    specialPoseSources.length > 0
  ) {
    return { frameSources: specialPoseSources, usesDedicatedPose: true };
  }

  return {
    frameSources: manifest?.stanceSources.special ?? [],
    usesDedicatedPose: false,
  };
}

function getSpecialZoomOutFrameIndex(
  fighter: MatchState['fighters'][number],
  specialSequence: NonNullable<CharacterDefinition['moves'][string]['specialSequence']>,
  frameCount: number,
  buildUpFrameCount: number,
) {
  const remainingFrameCount = Math.max(0, frameCount - buildUpFrameCount);
  if (
    fighter.specialMovePhase !== 'zoom-out' ||
    !specialSequence.completeAnimationDuringZoomOut ||
    remainingFrameCount <= 0
  ) {
    return null;
  }

  const zoomOutDuration = Math.max(1, specialSequence.zoomOutFrames ?? 1);
  const zoomOutProgress = zoomOutDuration <= 1
    ? 1
    : Math.max(
        0,
        Math.min(1, fighter.specialMovePhaseFrame / Math.max(1, zoomOutDuration - 1)),
      );

  return Math.min(
    frameCount - 1,
    buildUpFrameCount +
      Math.min(
        remainingFrameCount - 1,
        Math.floor(zoomOutProgress * remainingFrameCount),
      ),
  );
}

function getSpecialBuildUpFrameIndex(
  fighter: MatchState['fighters'][number],
  move: CharacterDefinition['moves'][string],
  frameCount: number,
  usesDedicatedPose: boolean,
) {
  if (frameCount <= 1) {
    return 0;
  }

  const totalFrames = Math.max(1, getAttackTotalFrames(move));
  const specialSequence = move.specialSequence;
  if (!specialSequence) {
    return 0;
  }

  const buildUpDuration = Math.max(1, Math.min(specialSequence.buildUpFrames, totalFrames));
  const buildUpFrameCount = usesDedicatedPose
    ? frameCount
    : Math.min(
        frameCount,
        Math.max(1, specialSequence.animationBuildUpFrames ?? buildUpDuration),
      );
  const lastBuildUpFrameIndex = Math.max(0, buildUpFrameCount - 1);

  if (fighter.specialMovePhase === 'landing-hold' || fighter.specialMovePhase === 'pause') {
    return lastBuildUpFrameIndex;
  }

  const zoomOutFrameIndex = getSpecialZoomOutFrameIndex(
    fighter,
    specialSequence,
    frameCount,
    buildUpFrameCount,
  );
  if (zoomOutFrameIndex != null) {
    return zoomOutFrameIndex;
  }

  if (fighter.specialMovePhase === 'zoom-out') {
    return lastBuildUpFrameIndex;
  }

  const buildUpProgress = Math.max(
    0,
    Math.min(1, fighter.attackFrame / Math.max(1, buildUpDuration)),
  );
  return Math.min(
    lastBuildUpFrameIndex,
    Math.floor(buildUpProgress * buildUpFrameCount),
  );
}

function getSpecialAnimationFrameIndex(
  fighter: MatchState['fighters'][number],
  definition: CharacterDefinition,
  frameCount: number,
) {
  const move = fighter.attackId ? definition.moves[fighter.attackId] : definition.moves.special;
  if (!move || frameCount <= 1) {
    return 0;
  }

  const totalFrames = Math.max(1, getAttackTotalFrames(move));
  const specialSequence = move.specialSequence;
  if (!specialSequence) {
    return Math.min(
      frameCount - 1,
      Math.floor((fighter.attackFrame / Math.max(1, totalFrames)) * frameCount),
    );
  }

  if (specialSequence.animationMode === 'loop') {
    const loopFrameDuration = Math.max(1, specialSequence.loopFrameDuration ?? 4);
    return Math.floor(fighter.actionFrames / loopFrameDuration) % frameCount;
  }

  const buildUpDuration = Math.max(1, Math.min(specialSequence.buildUpFrames, totalFrames));
  const buildUpFrameCount = Math.min(
    frameCount,
    Math.max(1, specialSequence.animationBuildUpFrames ?? buildUpDuration),
  );
  const remainingFrameCount = Math.max(0, frameCount - buildUpFrameCount);
  const followThroughFrameCount = Math.max(1, frameCount - buildUpFrameCount);
  const lastBuildUpFrameIndex = Math.max(0, buildUpFrameCount - 1);

  if (fighter.specialMovePhase === 'landing-hold' || fighter.specialMovePhase === 'pause') {
    return lastBuildUpFrameIndex;
  }

  const zoomOutFrameIndex = getSpecialZoomOutFrameIndex(
    fighter,
    specialSequence,
    frameCount,
    buildUpFrameCount,
  );
  if (zoomOutFrameIndex != null) {
    return zoomOutFrameIndex;
  }

  if (fighter.specialMovePhase === 'zoom-out') {
    return lastBuildUpFrameIndex;
  }

  if (
    fighter.specialMovePhase === 'follow-through' &&
    specialSequence.completeAnimationDuringZoomOut &&
    remainingFrameCount > 0
  ) {
    return frameCount - 1;
  }

  if (fighter.attackFrame <= buildUpDuration || buildUpFrameCount >= frameCount) {
    const buildUpProgress = Math.max(
      0,
      Math.min(1, fighter.attackFrame / Math.max(1, buildUpDuration)),
    );
    return Math.min(
      lastBuildUpFrameIndex,
      Math.floor(buildUpProgress * buildUpFrameCount),
    );
  }

  const followThroughDuration = Math.max(1, totalFrames - buildUpDuration);
  const followThroughProgress = Math.max(
    0,
    Math.min(1, (fighter.attackFrame - buildUpDuration) / followThroughDuration),
  );
  return Math.min(
    frameCount - 1,
    buildUpFrameCount +
      Math.min(
        followThroughFrameCount - 1,
        Math.floor(followThroughProgress * followThroughFrameCount),
      ),
  );
}

function getActiveSpecialCinematicState(state: MatchState | null) {
  if (!state || state.status !== 'fighting') {
    return null;
  }

  for (const fighter of state.fighters) {
    if (fighter.action !== 'attack' || !fighter.attackId) {
      continue;
    }

    const definition = roster[fighter.fighterId];
    const move = definition?.moves[fighter.attackId];
    if (!move?.specialSequence || !isSpecialCinematicPhase(fighter.specialMovePhase)) {
      continue;
    }

    const totalFrames = Math.max(1, getAttackTotalFrames(move));
    const buildUpFrames = Math.max(
      1,
      Math.min(move.specialSequence.buildUpFrames, totalFrames),
    );
    const zoomOutFrames = Math.max(1, move.specialSequence.zoomOutFrames ?? 1);

    let cameraProgress = 1;
    switch (fighter.specialMovePhase) {
      case 'build-up':
        cameraProgress = Math.max(0, Math.min(1, fighter.attackFrame / buildUpFrames));
        break;
      case 'zoom-out':
        cameraProgress = Math.max(
          0,
          Math.min(1, 1 - fighter.specialMovePhaseFrame / zoomOutFrames),
        );
        break;
      default:
        cameraProgress = 1;
        break;
    }

    return {
      fighter,
      definition,
      move,
      phase: fighter.specialMovePhase,
      buildUpProgress: cameraProgress,
      overlayOpacity: cameraProgress,
      zoomScale: 1 + ((move.specialSequence.zoomScale ?? 1.82) - 1) * cameraProgress,
    };
  }

  return null;
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
    case 'walk': {
      const walkFrame = Math.floor(matchFrame / 5) % frameCount;
      return fighter.vx * fighter.facing < 0
        ? frameCount - 1 - walkFrame
        : walkFrame;
    }
    case 'block':
      return Math.min(frameCount - 1, Math.floor(fighter.actionFrames / 5));
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
      return Math.min(frameCount - 1, Math.floor(fighter.actionFrames / 16));
    case 'win':
      return Math.floor(fighter.actionFrames / 7) % frameCount;
    case 'special':
      return getSpecialAnimationFrameIndex(fighter, definition, frameCount);
    case 'attack1':
    case 'attack2': {
      const move = fighter.attackId ? definition.moves[fighter.attackId] : null;
      const totalFrames = move
        ? getAttackTotalFrames(move) + 1
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

function getWinCompanionTextureKey(
  fighterId: string,
  phase: 'walk' | 'finish',
  frameIndex: number,
) {
  return `${fighterId}:win-companion:${phase}:${frameIndex}`;
}

function getParakWinCompanionState(
  state: MatchState,
  fighter: MatchState['fighters'][number],
  manifest: FighterAssetManifest | undefined,
) {
  if (
    fighter.fighterId !== PARAK_WIN_COMPANION_FIGHTER_ID ||
    !shouldUseWinStance(state, fighter) ||
    !manifest?.winCompanion
  ) {
    return null;
  }

  const { walkSources, finishSources } = manifest.winCompanion;
  if (walkSources.length === 0 && finishSources.length === 0) {
    return null;
  }

  const startSide = fighter.x >= DEFAULT_CONFIG.width / 2 ? 'left' : 'right';
  const startX =
    startSide === 'left'
      ? -PARAK_WIN_COMPANION_SCREEN_MARGIN
      : DEFAULT_CONFIG.width + PARAK_WIN_COMPANION_SCREEN_MARGIN;
  const targetDirection = startSide === 'left' ? -1 : 1;
  const unclampedTargetX =
    fighter.x + targetDirection * PARAK_WIN_COMPANION_TARGET_OFFSET;
  const targetX = Math.max(
    PARAK_WIN_COMPANION_SCREEN_MARGIN,
    Math.min(
      DEFAULT_CONFIG.width - PARAK_WIN_COMPANION_SCREEN_MARGIN,
      unclampedTargetX,
    ),
  );
  const totalDistance = Math.abs(targetX - startX);
  const walkDurationFrames =
    totalDistance <= 0
      ? 0
      : Math.ceil(totalDistance / PARAK_WIN_COMPANION_WALK_SPEED);
  const walkProgress =
    walkDurationFrames <= 0
      ? 1
      : Math.min(1, fighter.actionFrames / walkDurationFrames);
  const x = startX + (targetX - startX) * walkProgress;
  const flipX = startSide === 'right';

  if (walkProgress < 1 && walkSources.length > 0) {
    return {
      textureKey: getWinCompanionTextureKey(
        fighter.fighterId,
        'walk',
        Math.floor(
          fighter.actionFrames / PARAK_WIN_COMPANION_WALK_FRAME_DURATION,
        ) % walkSources.length,
      ),
      x,
      y: fighter.y + 6,
      flipX,
      depth: 3.08,
    };
  }

  if (finishSources.length > 0) {
    const finishFrame = Math.min(
      finishSources.length - 1,
      Math.max(
        0,
        Math.floor(
          (fighter.actionFrames - walkDurationFrames) /
            PARAK_WIN_COMPANION_FINISH_FRAME_DURATION,
        ),
      ),
    );

    return {
      textureKey: getWinCompanionTextureKey(fighter.fighterId, 'finish', finishFrame),
      x: targetX,
      y: fighter.y + 6,
      flipX,
      depth: 3.08,
    };
  }

  if (walkSources.length > 0) {
    return {
      textureKey: getWinCompanionTextureKey(
        fighter.fighterId,
        'walk',
        Math.floor(
          fighter.actionFrames / PARAK_WIN_COMPANION_WALK_FRAME_DURATION,
        ) % walkSources.length,
      ),
      x: targetX,
      y: fighter.y + 6,
      flipX,
      depth: 3.08,
    };
  }

  return null;
}

function getSpecialHoverVisualLift(
  fighter: MatchState['fighters'][number],
  definition: CharacterDefinition,
) {
  if (fighter.attackId !== 'special' || fighter.specialMovePhase !== 'follow-through') {
    return 0;
  }

  const hoverHeight = definition.moves.special?.specialSequence?.hoverHeight;
  if (definition.moves.special?.specialSequence?.animationMode !== 'loop' || hoverHeight == null) {
    return 0;
  }

  return hoverHeight;
}

function getOverchargeActivationProgress(
  fighter: MatchState['fighters'][number],
) {
  if (fighter.overchargeActivationFrames <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(1, 1 - fighter.overchargeActivationFrames / 20),
  );
}

function strokeOverchargeSparkleRay(
  graphics: any,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  glowWidth: number,
  glowColor: number,
  glowAlpha: number,
  coreWidth: number,
  coreColor: number,
  coreAlpha: number,
) {
  graphics.lineStyle(glowWidth, glowColor, glowAlpha);
  graphics.beginPath();
  graphics.moveTo(fromX, fromY);
  graphics.lineTo(toX, toY);
  graphics.strokePath();

  graphics.lineStyle(coreWidth, coreColor, coreAlpha);
  graphics.beginPath();
  graphics.moveTo(fromX, fromY);
  graphics.lineTo(toX, toY);
  graphics.strokePath();
}

function renderOverchargeSparkle(
  graphics: any,
  x: number,
  y: number,
  size: number,
  alpha: number,
  rotation: number,
) {
  const primaryLength = size;
  const secondaryLength = size * 0.62;
  const diagonalLength = size * 0.42;
  const axisCos = Math.cos(rotation);
  const axisSin = Math.sin(rotation);
  const perpCos = Math.cos(rotation + Math.PI / 2);
  const perpSin = Math.sin(rotation + Math.PI / 2);
  const diagCos = Math.cos(rotation + Math.PI / 4);
  const diagSin = Math.sin(rotation + Math.PI / 4);
  const diagPerpCos = Math.cos(rotation - Math.PI / 4);
  const diagPerpSin = Math.sin(rotation - Math.PI / 4);

  strokeOverchargeSparkleRay(
    graphics,
    x - axisCos * primaryLength,
    y - axisSin * primaryLength,
    x + axisCos * primaryLength,
    y + axisSin * primaryLength,
    4.8,
    0xffefaf,
    alpha * 0.34,
    2,
    0xffffff,
    alpha * 0.95,
  );
  strokeOverchargeSparkleRay(
    graphics,
    x - perpCos * secondaryLength,
    y - perpSin * secondaryLength,
    x + perpCos * secondaryLength,
    y + perpSin * secondaryLength,
    4,
    0x8af7ff,
    alpha * 0.28,
    1.7,
    0xfffcf0,
    alpha * 0.88,
  );
  strokeOverchargeSparkleRay(
    graphics,
    x - diagCos * diagonalLength,
    y - diagSin * diagonalLength,
    x + diagCos * diagonalLength,
    y + diagSin * diagonalLength,
    2.8,
    0x93efff,
    alpha * 0.18,
    1.1,
    0xe8ffff,
    alpha * 0.58,
  );
  strokeOverchargeSparkleRay(
    graphics,
    x - diagPerpCos * diagonalLength,
    y - diagPerpSin * diagonalLength,
    x + diagPerpCos * diagonalLength,
    y + diagPerpSin * diagonalLength,
    2.8,
    0xffefb1,
    alpha * 0.16,
    1.1,
    0xf7ffff,
    alpha * 0.54,
  );

  graphics.fillStyle(0xfff7d8, alpha * 0.74);
  graphics.fillCircle(x, y, Math.max(1.8, size * 0.18));
  graphics.fillStyle(0xffffff, alpha * 0.95);
  graphics.fillCircle(x, y, Math.max(1.1, size * 0.09));
}

function renderOverchargeAura(
  graphics: any,
  fighter: MatchState['fighters'][number],
  definition: CharacterDefinition,
  matchFrame: number,
  layer: 'back' | 'front',
) {
  if (fighter.overchargeActiveFrames <= 0) {
    return;
  }

  const visualLift =
    getDashVisualLift(fighter, definition) +
    getSpecialHoverVisualLift(fighter, definition);
  const baseX = fighter.x;
  const baseY = fighter.y + 6 - visualLift;
  const pulse = 0.5 + 0.5 * Math.sin(matchFrame * 0.28 + fighter.slot * 1.9);
  const auraWidth = 36 + pulse * 7;
  const auraHeight = 78 + pulse * 11;
  const activationProgress = getOverchargeActivationProgress(fighter);
  const auraCenterY = baseY - 64;

  if (layer === 'back') {
    graphics.fillStyle(0xffe7a0, 0.05 + pulse * 0.035);
    graphics.fillEllipse(baseX, auraCenterY, auraWidth * 1.12, auraHeight * 0.92);
    graphics.fillStyle(0x9af8ff, 0.04 + pulse * 0.03);
    graphics.fillEllipse(baseX, auraCenterY - 2, auraWidth * 0.84, auraHeight * 0.66);
    graphics.lineStyle(2.6, 0xfff8d7, 0.11 + pulse * 0.08);
    graphics.strokeEllipse(baseX, auraCenterY, auraWidth * 0.72, auraHeight * 0.5);
  } else {
    graphics.lineStyle(1.8, 0xfff8d7, 0.08 + pulse * 0.06);
    graphics.strokeEllipse(baseX, auraCenterY - 1, auraWidth * 0.54, auraHeight * 0.4);
  }

  for (let sparkleIndex = 0; sparkleIndex < 7; sparkleIndex += 1) {
    const sparkleInFront = sparkleIndex % 2 === 0;
    if ((layer === 'front') !== sparkleInFront) {
      continue;
    }

    const sparkleSeed =
      matchFrame * (0.07 + sparkleIndex * 0.004) +
      fighter.slot * 1.9 +
      sparkleIndex * 1.47;
    const orbitX = 16 + (sparkleIndex % 3) * 10 + pulse * 4;
    const orbitY = 18 + (sparkleIndex % 2) * 16 + pulse * 6;
    const sparkleX =
      baseX +
      Math.cos(sparkleSeed * 1.18 + sparkleIndex) * orbitX +
      Math.sin(sparkleSeed * 0.7) * 4;
    const sparkleY =
      auraCenterY +
      Math.sin(sparkleSeed * 0.92 + sparkleIndex * 0.6) * orbitY -
      4 +
      Math.cos(sparkleSeed * 1.54) * 4;
    const sparkleSize =
      4.8 +
      (sparkleIndex % 3) * 1.35 +
      (0.5 + 0.5 * Math.sin(sparkleSeed * 2.4)) * 2.8;
    const sparkleAlpha = 0.22 + (0.5 + 0.5 * Math.sin(sparkleSeed * 2.1)) * 0.4;
    renderOverchargeSparkle(
      graphics,
      sparkleX,
      sparkleY,
      sparkleSize,
      sparkleAlpha * (layer === 'front' ? 1 : 0.76),
      sparkleSeed * 1.7,
    );
  }

  for (let moteIndex = 0; moteIndex < 9; moteIndex += 1) {
    const moteInFront = moteIndex % 2 === 1;
    if ((layer === 'front') !== moteInFront) {
      continue;
    }

    const moteSeed = matchFrame * 0.055 + fighter.slot * 2.1 + moteIndex * 0.88;
    const driftX =
      baseX +
      Math.sin(moteSeed * 1.4 + moteIndex) * (18 + (moteIndex % 3) * 8);
    const driftY =
      auraCenterY +
      38 -
      ((moteSeed * 28 + moteIndex * 11) % 88) +
      Math.cos(moteSeed * 1.8) * 3;
    const moteRadius = 1.4 + (moteIndex % 2) * 0.7;
    graphics.fillStyle(
      moteIndex % 3 === 0 ? 0xfff0bb : 0xbaf9ff,
      (layer === 'front' ? 0.2 : 0.13) + ((moteIndex + fighter.slot) % 3) * 0.06,
    );
    graphics.fillCircle(driftX, driftY, moteRadius);
  }

  if (fighter.overchargeActivationFrames > 0) {
    const burstProgress = 1 - fighter.overchargeActivationFrames / 20;
    const burstRadius = 18 + burstProgress * 72;
    if (layer === 'back') {
      graphics.fillStyle(0xfff6d2, (1 - burstProgress) * 0.16);
      graphics.fillCircle(baseX, auraCenterY, 18 + burstProgress * 30);
    }
    for (let burstIndex = 0; burstIndex < 8; burstIndex += 1) {
      const burstInFront = burstIndex % 2 === 0;
      if ((layer === 'front') !== burstInFront) {
        continue;
      }

      const angle = (Math.PI * 2 * burstIndex) / 8 + burstProgress * 0.42;
      const sparkleX = baseX + Math.cos(angle) * burstRadius;
      const sparkleY = auraCenterY + Math.sin(angle) * burstRadius * 0.72;
      renderOverchargeSparkle(
        graphics,
        sparkleX,
        sparkleY,
        10 + (1 - burstProgress) * 8,
        (1 - burstProgress) * (layer === 'front' ? 0.88 : 0.64),
        angle,
      );
    }
  } else if (activationProgress > 0) {
    renderOverchargeSparkle(
      graphics,
      baseX,
      auraCenterY,
      13 + pulse * 4,
      0.28 + pulse * 0.18,
      matchFrame * 0.1,
    );
  }
}

function getProjectileTextureKey(sprite: string) {
  return `projectile:${sprite}`;
}

function getProjectileSpriteScale(
  projectile: MatchState['projectiles'][number],
  sourceImage: { width: number; height: number },
) {
  const projectileSpriteName = getProjectileSpriteName(projectile.sprite);
  const scaleMultiplier = projectile.spriteScale ?? 1;
  if (
    projectileSpriteName === 'iceball' ||
    projectileSpriteName === 'fireball'
  ) {
    return Math.max(
      (projectile.hitbox.width * 1.5) / sourceImage.width,
      (projectile.hitbox.height * 1.5) / sourceImage.height,
    ) * scaleMultiplier;
  }

  return Math.max(
    (projectile.hitbox.width * 1.8) / sourceImage.width,
    (projectile.hitbox.height * 3.2) / sourceImage.height,
  ) * scaleMultiplier;
}

function getProjectileTrailScales(projectile: MatchState['projectiles'][number]) {
  const projectileSpriteName = getProjectileSpriteName(projectile.sprite);
  if (projectileSpriteName === 'iceball') {
    return [0.84, 0.68, 0.54, 0.42];
  }

  if (projectileSpriteName === 'fireball') {
    return [0.82, 0.66, 0.5, 0.36];
  }

  return [];
}

function getProjectileTrailAlphas(projectile: MatchState['projectiles'][number]) {
  const projectileSpriteName = getProjectileSpriteName(projectile.sprite);
  if (projectileSpriteName === 'iceball') {
    return [0.4, 0.26, 0.16, 0.08];
  }

  if (projectileSpriteName === 'fireball') {
    return [0.38, 0.24, 0.14, 0.07];
  }

  return [];
}

function getProjectileTrailZigZagOffsets(
  projectile: MatchState['projectiles'][number],
) {
  const projectileSpriteName = getProjectileSpriteName(projectile.sprite);
  if (projectileSpriteName === 'iceball') {
    return [-7, 6, -5, 4];
  }

  if (projectileSpriteName === 'fireball') {
    return [6, -5, 4, -3];
  }

  return [];
}

function getProjectileTrailJiggleAmplitude(
  projectile: MatchState['projectiles'][number],
) {
  const projectileSpriteName = getProjectileSpriteName(projectile.sprite);
  if (projectileSpriteName === 'iceball') {
    return 2.6;
  }

  if (projectileSpriteName === 'fireball') {
    return 2.1;
  }

  return 0;
}

function getProjectileTrailJiggleSpeed(
  projectile: MatchState['projectiles'][number],
) {
  const projectileSpriteName = getProjectileSpriteName(projectile.sprite);
  if (projectileSpriteName === 'iceball') {
    return 12;
  }

  if (projectileSpriteName === 'fireball') {
    return 10;
  }

  return 0;
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

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function lerp(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function getDeterministicAiRoll(seed: number) {
  let value = seed | 0;
  value = Math.imul(value ^ 0x45d9f3b, 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value >>> 0) / 0xffffffff;
}

function doesAiRollPass(seed: number, chance: number) {
  if (chance <= 0) {
    return false;
  }

  if (chance >= 1) {
    return true;
  }

  return getDeterministicAiRoll(seed) < chance;
}

function getFightBotProfile(
  definition: CharacterDefinition,
): NormalizedFightBotProfile {
  const rawProfile = definition.bot;
  const aggressiveness = clamp01(rawProfile?.aggressiveness ?? 0.5);

  return {
    aggressiveness,
    arenaMovement: {
      preferredDistanceMultiplier:
        rawProfile?.arenaMovement?.preferredDistanceMultiplier ??
        lerp(1.14, 0.88, aggressiveness),
      approachBias:
        rawProfile?.arenaMovement?.approachBias ??
        lerp(0.42, 0.74, aggressiveness),
      retreatBias:
        rawProfile?.arenaMovement?.retreatBias ??
        lerp(0.62, 0.3, aggressiveness),
      jumpInChance:
        rawProfile?.arenaMovement?.jumpInChance ??
        lerp(0.38, 0.86, aggressiveness),
      dashJumpForwardChance:
        rawProfile?.arenaMovement?.dashJumpForwardChance ??
        lerp(0.34, 0.82, aggressiveness),
      dashJumpBackwardChance:
        rawProfile?.arenaMovement?.dashJumpBackwardChance ??
        lerp(0.58, 0.24, aggressiveness),
    },
    skillChoice: {
      punchWeight: rawProfile?.skillChoice?.punchWeight ?? 1,
      kickWeight: rawProfile?.skillChoice?.kickWeight ?? 1,
      specialWeight: rawProfile?.skillChoice?.specialWeight ?? 1,
      attackCadenceMultiplier:
        rawProfile?.skillChoice?.attackCadenceMultiplier ??
        lerp(1.14, 0.82, aggressiveness),
    },
    defense: {
      blockChance: rawProfile?.defense?.blockChance ?? 1,
      projectileDodgeChance:
        rawProfile?.defense?.projectileDodgeChance ?? 0.5,
      meleeBlockReactionFrames:
        rawProfile?.defense?.meleeBlockReactionFrames ?? 1,
      projectileBlockReactionFrames:
        rawProfile?.defense?.projectileBlockReactionFrames ?? 4,
    },
  };
}

function isMoveAiReady(
  fighter: MatchState['fighters'][number],
  move: CharacterDefinition['moves'][string] | undefined,
) {
  if (!move) {
    return false;
  }

  return (fighter.moveCooldownFrames[move.id] ?? 0) === 0;
}

function getProjectileAiBand(
  move: CharacterDefinition['moves'][string] | undefined,
) {
  if (!move?.projectile) {
    return null;
  }

  const maxDistance =
    DEFAULT_CONFIG.width *
    (move.projectile.maximumDistanceRatio ?? move.projectile.minimumDistanceRatio);

  return {
    min: Math.max(110, maxDistance * 0.32),
    max: Math.max(170, maxDistance * 0.86),
  };
}

function getAiAttackCadenceFrames(
  button: 'punch' | 'kick' | 'special',
  botProfile: NormalizedFightBotProfile,
) {
  let baseFrames: number;
  switch (button) {
    case 'punch':
      baseFrames = 42;
      break;
    case 'kick':
      baseFrames = 72;
      break;
    case 'special':
      baseFrames = 132;
      break;
    default:
      baseFrames = 60;
  }

  return Math.max(
    12,
    Math.round(baseFrames * botProfile.skillChoice.attackCadenceMultiplier),
  );
}

function getAiAttackPreferenceScore(
  button: AttackInputKey,
  botProfile: NormalizedFightBotProfile,
) {
  const priority =
    button === 'special' ? 3 : button === 'kick' ? 2 : 1;
  const weight =
    button === 'punch'
      ? botProfile.skillChoice.punchWeight
      : button === 'kick'
        ? botProfile.skillChoice.kickWeight
        : botProfile.skillChoice.specialWeight;

  return priority * Math.max(0, weight);
}

function chooseAiAttackButton(
  buttons: AttackInputKey[],
  botProfile: NormalizedFightBotProfile,
) {
  if (buttons.length === 0) {
    return null;
  }

  return buttons.slice(1).reduce(
    (bestButton, button) =>
      getAiAttackPreferenceScore(button, botProfile) >
          getAiAttackPreferenceScore(bestButton, botProfile)
        ? button
        : bestButton,
    buttons[0],
  );
}

function createFightBotState(): FightBotState {
  return {
    dashJumpCooldownUntilFrame: 0,
    dashJumpSequence: null,
    projectileDodgeDecisions: {},
  };
}

function toAiWorldBox(x: number, y: number, facing: Facing, box: Box): Box {
  const mirroredX = facing === 1 ? box.x : -(box.x + box.width);
  return {
    x: x + mirroredX,
    y: y + box.y,
    width: box.width,
    height: box.height,
  };
}

function boxesOverlapVertically(a: Box, b: Box, padding = 0) {
  return a.y < b.y + b.height + padding && a.y + a.height > b.y - padding;
}

function getHorizontalBoxGap(a: Box, b: Box) {
  if (a.x + a.width < b.x) {
    return b.x - (a.x + a.width);
  }

  if (b.x + b.width < a.x) {
    return a.x - (b.x + b.width);
  }

  return 0;
}

function pruneFightBotProjectileDecisions(
  botState: FightBotState,
  activeProjectiles: MatchState['projectiles'],
) {
  const activeProjectileIds = new Set(activeProjectiles.map((projectile) => projectile.id));
  botState.projectileDodgeDecisions = Object.fromEntries(
    Object.entries(botState.projectileDodgeDecisions).filter(([projectileId]) =>
      activeProjectileIds.has(Number(projectileId))
    ),
  );
}

function getFightBotProjectileDodgeDecision(
  botState: FightBotState,
  projectileId: number,
  dodgeChance: number,
  seedOffset = 0,
) {
  const existingDecision = botState.projectileDodgeDecisions[projectileId];
  if (existingDecision != null) {
    return existingDecision;
  }

  const shouldDodge = doesAiRollPass(
    projectileId * 131 + seedOffset,
    dodgeChance,
  );
  botState.projectileDodgeDecisions[projectileId] = shouldDodge;
  return shouldDodge;
}

function beginFightBotDashJumpSequence(
  botState: FightBotState,
  state: MatchState,
  directionKey: AiDirectionKey,
  cooldownFrames: number,
  dodgeProjectileId: number | null = null,
) {
  botState.dashJumpSequence = {
    directionKey,
    dodgeProjectileId,
    secondTapFrame: null,
    step: 'first-tap',
  };
  botState.dashJumpCooldownUntilFrame = state.frame + cooldownFrames;
}

function getFightBotDashJumpInput(
  state: MatchState,
  fighter: MatchState['fighters'][number],
  botState: FightBotState,
) {
  const sequence = botState.dashJumpSequence;
  if (!sequence) {
    return null;
  }

  if (
    state.status !== 'fighting' ||
    fighter.attackId ||
    fighter.hitstun > 0 ||
    !fighter.grounded
  ) {
    botState.dashJumpSequence = null;
    return null;
  }

  const nextInput = cloneInput();
  switch (sequence.step) {
    case 'first-tap':
      nextInput[sequence.directionKey] = true;
      sequence.step = 'release';
      return nextInput;
    case 'release':
      sequence.step = 'second-tap';
      return nextInput;
    case 'second-tap':
      nextInput[sequence.directionKey] = true;
      sequence.secondTapFrame = state.frame;
      sequence.step = 'jump';
      return nextInput;
    case 'jump':
      if (fighter.action === 'dash' || fighter.dashFramesRemaining > 0) {
        nextInput[sequence.directionKey] = true;
        nextInput.up = true;
        botState.dashJumpSequence = null;
        return nextInput;
      }

      if (
        sequence.secondTapFrame != null &&
        state.frame - sequence.secondTapFrame > 2
      ) {
        botState.dashJumpSequence = null;
      }

      return nextInput;
    default:
      botState.dashJumpSequence = null;
      return null;
  }
}

function getAiProjectileThreat(
  state: MatchState,
  fighter: MatchState['fighters'][number],
  definition: CharacterDefinition,
) {
  const hurtboxes = (
    fighter.grounded ? definition.standingBoxes : definition.jumpingBoxes
  ).hurtboxes;

  if (!hurtboxes?.length) {
    return null;
  }

  const worldHurtboxes = hurtboxes.map((box) =>
    toAiWorldBox(fighter.x, fighter.y, fighter.facing, box),
  );
  let nearestThreat: {
    framesUntilImpact: number;
    projectile: MatchState['projectiles'][number];
  } | null = null;

  for (const projectile of state.projectiles) {
    if (projectile.ownerSlot === fighter.slot) {
      continue;
    }

    const relativeX = fighter.x - projectile.x;
    if (Math.abs(projectile.vx) <= 0.001 || relativeX * projectile.vx <= 0) {
      continue;
    }

    const projectileBox = toAiWorldBox(
      projectile.x,
      projectile.y,
      projectile.facing,
      projectile.hitbox,
    );
    const overlappingHurtboxes = worldHurtboxes.filter((hurtbox) =>
      boxesOverlapVertically(projectileBox, hurtbox, 18),
    );

    if (overlappingHurtboxes.length === 0) {
      continue;
    }

    const horizontalGap = Math.min(
      ...overlappingHurtboxes.map((hurtbox) =>
        getHorizontalBoxGap(projectileBox, hurtbox),
      ),
    );
    const framesUntilImpact = horizontalGap / Math.abs(projectile.vx);

    if (horizontalGap > 170 || framesUntilImpact > 18) {
      continue;
    }

    if (
      !nearestThreat ||
      framesUntilImpact < nearestThreat.framesUntilImpact
    ) {
      nearestThreat = {
        framesUntilImpact,
        projectile,
      };
    }
  }

  return nearestThreat;
}

function getAiMoveFrameHitboxes(
  move: NonNullable<CharacterDefinition['moves'][string]>,
  attackFrame: number,
) {
  return move.frameBoxes?.[attackFrame]?.hitboxes ?? [];
}

function applyAiMeleeRangeToHitbox<T extends Box>(
  move: NonNullable<CharacterDefinition['moves'][string]>,
  box: T,
) {
  if (move.projectile || move.meleeRange == null) {
    return box;
  }

  if (move.meleeRange <= box.x) {
    return {
      ...box,
      x: move.meleeRange - 1,
      width: 1,
    };
  }

  return {
    ...box,
    width: move.meleeRange - box.x,
  };
}

function getAiFighterHurtboxes(
  fighter: MatchState['fighters'][number],
  definition: CharacterDefinition,
) {
  if (fighter.attackId) {
    const move = definition.moves[fighter.attackId];
    const override = move?.frameBoxes?.[fighter.attackFrame]?.hurtboxes;
    if (override?.length) {
      return override.map((box) =>
        toAiWorldBox(fighter.x, fighter.y, fighter.facing, box),
      );
    }
  }

  const source = fighter.grounded ? definition.standingBoxes : definition.jumpingBoxes;
  return (source.hurtboxes ?? []).map((box) =>
    toAiWorldBox(fighter.x, fighter.y, fighter.facing, box),
  );
}

function getAiMeleeThreat(
  attacker: MatchState['fighters'][number],
  attackerDefinition: CharacterDefinition,
  defender: MatchState['fighters'][number],
  defenderDefinition: CharacterDefinition,
) {
  if (!attacker.attackId) {
    return null;
  }

  const move = attackerDefinition.moves[attacker.attackId];
  if (!move) {
    return null;
  }

  const predictedAttackFrame = attacker.attackFrame + 1;
  const activeStart = move.startup;
  const activeEnd = move.startup + move.active - 1;
  if (predictedAttackFrame < activeStart || predictedAttackFrame > activeEnd) {
    return null;
  }

  const predictedAttackerX = attacker.x + attacker.vx;
  const predictedAttackerY = attacker.y + attacker.vy;
  const defenderHurtboxes = getAiFighterHurtboxes(defender, defenderDefinition);
  const activeHitboxes = getAiMoveFrameHitboxes(move, predictedAttackFrame);
  let nearestThreat: {
    framesUntilImpact: number;
    horizontalGap: number;
  } | null = null;

  for (const hitbox of activeHitboxes) {
    const worldHitbox = toAiWorldBox(
      predictedAttackerX,
      predictedAttackerY,
      attacker.facing,
      applyAiMeleeRangeToHitbox(move, hitbox),
    );
    const overlappingHurtboxes = defenderHurtboxes.filter((hurtbox) =>
      boxesOverlapVertically(worldHitbox, hurtbox, 12),
    );

    if (overlappingHurtboxes.length === 0) {
      continue;
    }

    const horizontalGap = Math.min(
      ...overlappingHurtboxes.map((hurtbox) =>
        getHorizontalBoxGap(worldHitbox, hurtbox),
      ),
    );

    if (horizontalGap > 24) {
      continue;
    }

    if (!nearestThreat || horizontalGap < nearestThreat.horizontalGap) {
      nearestThreat = {
        framesUntilImpact: 1,
        horizontalGap,
      };
    }
  }

  return nearestThreat;
}

function createAiInput(state: MatchState, botState: FightBotState): InputState {
  const player = state.fighters[1];
  const target = state.fighters[0];
  const playerDefinition = roster[player.fighterId];
  const targetDefinition = roster[target.fighterId];
  if (!playerDefinition || !targetDefinition) {
    botState.dashJumpSequence = null;
    return EMPTY_INPUT;
  }

  const botProfile = getFightBotProfile(playerDefinition);
  const punchMove = playerDefinition?.moves.punch;
  const kickMove = playerDefinition?.moves.kick;
  const specialMove = playerDefinition?.moves.special;
  const punchRange = getMoveAiRange(playerDefinition?.moves.punch);
  const kickRange = getMoveAiRange(playerDefinition?.moves.kick);
  const specialRange = getMoveAiRange(playerDefinition?.moves.special);
  if (
    state.status !== 'fighting' ||
    player.attackId ||
    player.hitstun > 0
  ) {
    botState.dashJumpSequence = null;
    return EMPTY_INPUT;
  }

  pruneFightBotProjectileDecisions(botState, state.projectiles);

  const sequenceInput = getFightBotDashJumpInput(state, player, botState);
  if (sequenceInput) {
    return sequenceInput;
  }

  const distance = target.x - player.x;
  const absoluteDistance = Math.abs(distance);
  const towardKey = distance < 0 ? 'left' : 'right';
  const awayKey = distance < 0 ? 'right' : 'left';
  const punchReady = isMoveAiReady(player, punchMove);
  const kickReady = isMoveAiReady(player, kickMove);
  const specialReady = isMoveAiReady(player, specialMove);
  const projectilePunchBand = getProjectileAiBand(punchMove);
  const preferredProjectileBandMin = projectilePunchBand
    ? projectilePunchBand.min *
      botProfile.arenaMovement.preferredDistanceMultiplier
    : null;
  const preferredProjectileBandMax = projectilePunchBand
    ? projectilePunchBand.max *
      botProfile.arenaMovement.preferredDistanceMultiplier
    : null;
  const meleePunchRange = punchMove?.projectile ? 0 : punchRange;
  const closeMeleeRange = Math.max(
    specialReady ? specialRange : 0,
    kickReady ? kickRange : 0,
    punchReady ? meleePunchRange : 0,
  );
  const preferredCloseRange =
    closeMeleeRange * botProfile.arenaMovement.preferredDistanceMultiplier;
  const approachSlack = lerp(30, 8, botProfile.arenaMovement.approachBias);
  const retreatDistanceMultiplier = lerp(
    0.56,
    0.92,
    botProfile.arenaMovement.retreatBias,
  );
  const retreatSlack = lerp(0, 20, botProfile.arenaMovement.retreatBias);
  const nextInput = cloneInput();
  const projectileThreat = getAiProjectileThreat(
    state,
    player,
    playerDefinition,
  );
  const meleeThreat = getAiMeleeThreat(
    target,
    targetDefinition,
    player,
    playerDefinition,
  );
  const overchargeReady =
    player.overchargeActiveFrames === 0 &&
    player.overchargeMeter >= MAX_OVERCHARGE_METER;
  const playerHealthRatio = player.health / playerDefinition.stats.maxHealth;
  const targetHealthRatio = target.health / targetDefinition.stats.maxHealth;

  if (
    overchargeReady &&
    (
      playerHealthRatio <= 0.75 ||
      player.recoverableHealth >= playerDefinition.stats.maxHealth * 0.12 ||
      targetHealthRatio <= 0.45
    )
  ) {
    nextInput.overcharge = true;
    return nextInput;
  }

  if (!player.grounded) {
    const canThrowAerialProjectile =
      punchReady &&
      projectilePunchBand &&
      absoluteDistance >= projectilePunchBand.min * 0.7 &&
      absoluteDistance <= projectilePunchBand.max;
    const canLandAerialKick = kickReady && absoluteDistance <= kickRange + 18;
    const canLandAerialSpecial =
      specialReady && absoluteDistance <= specialRange + 12;
    const canLandAerialPunch =
      punchReady &&
      !punchMove?.projectile &&
      absoluteDistance <= punchRange + 14;

    const aerialAttackButtons: AttackInputKey[] = [];
    if (
      canLandAerialSpecial &&
      state.frame % getAiAttackCadenceFrames('special', botProfile) === 0
    ) {
      aerialAttackButtons.push('special');
    }
    if (
      canLandAerialKick &&
      state.frame % getAiAttackCadenceFrames('kick', botProfile) === 0
    ) {
      aerialAttackButtons.push('kick');
    }
    if (
      (canThrowAerialProjectile || canLandAerialPunch) &&
      state.frame % getAiAttackCadenceFrames('punch', botProfile) === 0
    ) {
      aerialAttackButtons.push('punch');
    }

    const aerialAttack = chooseAiAttackButton(aerialAttackButtons, botProfile);
    if (aerialAttack) {
      nextInput[aerialAttack] = true;
    }
    return nextInput;
  }

  let moveToward = false;
  let moveAway = false;

  if (projectilePunchBand && punchReady) {
    if (
      preferredProjectileBandMin != null &&
      absoluteDistance < preferredProjectileBandMin &&
      closeMeleeRange === 0
    ) {
      moveAway = true;
    } else if (
      preferredProjectileBandMax != null &&
      absoluteDistance > preferredProjectileBandMax - approachSlack
    ) {
      moveToward = true;
    }
  }

  if (!moveToward && !moveAway && closeMeleeRange > 0) {
    if (absoluteDistance > preferredCloseRange + approachSlack) {
      moveToward = true;
    } else if (
      preferredProjectileBandMin != null &&
      punchReady &&
      absoluteDistance <
        Math.max(56, preferredProjectileBandMin * retreatDistanceMultiplier) +
          retreatSlack
    ) {
      moveAway = true;
    }
  }

  const jumpAttackRange = Math.max(
    specialReady ? specialRange : 0,
    kickReady ? kickRange : 0,
    punchReady ? meleePunchRange : 0,
  );
  const shouldJumpAttack =
    jumpAttackRange > 0 &&
    absoluteDistance >= Math.max(90, jumpAttackRange * 0.82) &&
    absoluteDistance <= jumpAttackRange + 30 &&
    state.frame % 96 === 0 &&
    doesAiRollPass(
      state.frame + player.slot * 113 + Math.round(absoluteDistance),
      botProfile.arenaMovement.jumpInChance,
    );
  const canStartDashJump =
    state.frame >= botState.dashJumpCooldownUntilFrame &&
    player.dashFramesRemaining === 0;
  const shouldDodgeProjectile =
    projectileThreat != null &&
    canStartDashJump &&
    getFightBotProjectileDodgeDecision(
      botState,
      projectileThreat.projectile.id,
      botProfile.defense.projectileDodgeChance,
      player.slot * 79 + playerDefinition.id.length,
    );
  const shouldGuardMeleeThreat =
    meleeThreat != null &&
    meleeThreat.framesUntilImpact <=
      botProfile.defense.meleeBlockReactionFrames;
  const shouldGuardProjectileThreat =
    projectileThreat != null &&
    projectileThreat.framesUntilImpact <=
      botProfile.defense.projectileBlockReactionFrames &&
    !shouldDodgeProjectile;
  const shouldGuardThreat =
    (shouldGuardMeleeThreat || shouldGuardProjectileThreat) &&
    doesAiRollPass(
      shouldGuardProjectileThreat && projectileThreat
        ? projectileThreat.projectile.id * 43 + player.slot
        : state.frame + target.attackFrame * 29 + target.slot * 11,
      botProfile.defense.blockChance,
    );

  if (shouldDodgeProjectile) {
    const dodgeDirection =
      absoluteDistance >= 210 ? towardKey : awayKey;
    beginFightBotDashJumpSequence(
      botState,
      state,
      dodgeDirection,
      34,
      projectileThreat.projectile.id,
    );

    return getFightBotDashJumpInput(state, player, botState) ?? EMPTY_INPUT;
  }

  if (shouldGuardThreat) {
    nextInput[awayKey] = true;
    return nextInput;
  }

  if (canStartDashJump) {
    const shouldDashJumpToward =
      moveToward &&
      absoluteDistance >= Math.max(170, closeMeleeRange + 72) &&
      state.frame % 90 === 0 &&
      doesAiRollPass(
        state.frame + player.slot * 61,
        botProfile.arenaMovement.dashJumpForwardChance,
      );
    const shouldDashJumpAway =
      moveAway &&
      absoluteDistance <= Math.max(220, closeMeleeRange + 64) &&
      state.frame % 120 === 0 &&
      doesAiRollPass(
        state.frame + player.slot * 67,
        botProfile.arenaMovement.dashJumpBackwardChance,
      );

    if (shouldDashJumpToward || shouldDashJumpAway) {
      beginFightBotDashJumpSequence(
        botState,
        state,
        shouldDashJumpToward ? towardKey : awayKey,
        shouldDashJumpToward ? 42 : 54,
      );

      return getFightBotDashJumpInput(state, player, botState) ?? EMPTY_INPUT;
    }
  }

  nextInput[towardKey] = moveToward && !moveAway;
  nextInput[awayKey] = moveAway && !moveToward;
  nextInput.up = shouldJumpAttack;

  const groundAttackButtons: AttackInputKey[] = [];
  if (
    !shouldJumpAttack &&
    specialReady &&
    absoluteDistance <= specialRange + 10 &&
    state.frame % getAiAttackCadenceFrames('special', botProfile) === 0
  ) {
    groundAttackButtons.push('special');
  }
  if (
    !shouldJumpAttack &&
    kickReady &&
    absoluteDistance <= kickRange + 8 &&
    state.frame % getAiAttackCadenceFrames('kick', botProfile) === 0
  ) {
    groundAttackButtons.push('kick');
  }
  if (
    !shouldJumpAttack &&
    punchReady &&
    (
      projectilePunchBand
        ? preferredProjectileBandMin != null &&
          preferredProjectileBandMax != null &&
          absoluteDistance >= preferredProjectileBandMin &&
          absoluteDistance <= preferredProjectileBandMax
        : absoluteDistance <= punchRange + 8
    ) &&
    state.frame % getAiAttackCadenceFrames('punch', botProfile) === 0
  ) {
    groundAttackButtons.push('punch');
  }

  const selectedGroundAttack = chooseAiAttackButton(
    groundAttackButtons,
    botProfile,
  );
  if (selectedGroundAttack) {
    nextInput[selectedGroundAttack] = true;
  }

  return nextInput;
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
  } else if (fighter.action === 'guard') {
    graphics.fillStyle(0xf7f0e0, 0.32);
    graphics.fillRoundedRect(baseX + direction * 8, baseY - 92, 26, 58, 12);
    graphics.lineStyle(4, 0x1a1815, 0.72);
    graphics.strokeRoundedRect(baseX + direction * 8, baseY - 92, 26, 58, 12);
  } else if (fighter.action === 'attack') {
    graphics.fillStyle(0xffffff, 0.35);
    graphics.fillEllipse(baseX + direction * 30, baseY - 70, 54, 26);
  }
}

function renderGuardOverlay(
  graphics: any,
  fighter: MatchState['fighters'][number],
  definition: CharacterDefinition,
) {
  if (fighter.action !== 'guard') {
    return;
  }

  const baseY = fighter.y - getDashVisualLift(fighter, definition);
  const shieldX = fighter.x + fighter.facing * 18;
  const shieldY = baseY - 63;

  graphics.fillStyle(0xf7f0e0, 0.18);
  graphics.fillRoundedRect(shieldX, shieldY, 28, 62, 12);
  graphics.lineStyle(4, 0xfbf5e9, 0.62);
  graphics.strokeRoundedRect(shieldX, shieldY, 28, 62, 12);
  graphics.lineStyle(3, 0x1a1815, 0.38);
  graphics.strokeRoundedRect(shieldX, shieldY, 28, 62, 12);
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

function getRoundResultAnnouncement(
  state: MatchState | null,
  playerSlot: 1 | 2,
): FightAnnouncement | null {
  if (!state) {
    return null;
  }

  if (state.status === 'round-over' && state.roundOverFramesRemaining > 0) {
    return null;
  }

  if (state.status !== 'round-over' && state.status !== 'match-over') {
    return null;
  }

  const winnerSlot = getRoundWinnerSlot(state);
  return {
    eyebrow: '',
    title:
      winnerSlot == null
        ? 'Draw'
        : winnerSlot === playerSlot
          ? 'You Win'
          : 'You Lose',
    phase: 'result',
  };
}

function hasNewKo(previousState: MatchState | null, nextState: MatchState) {
  if (nextState.status !== 'round-over' && nextState.status !== 'match-over') {
    return false;
  }

  return nextState.fighters.some(
    (fighter, index) =>
      fighter.action === 'ko' &&
      previousState?.fighters[index]?.action !== 'ko',
  );
}

function isTrainingReadyState(fighter: MatchState['fighters'][number]) {
  return fighter.health > 0 &&
    fighter.hitstun === 0 &&
    fighter.attackId == null &&
    fighter.overchargeActivationFrames === 0 &&
    fighter.action !== 'ko';
}

function restoreTrainingInfiniteHealthState(
  fighter: MatchState['fighters'][number],
  maxHealth: number,
) {
  fighter.health = 1;
  fighter.recoverableHealth = Math.max(fighter.recoverableHealth, maxHealth - fighter.health);
  fighter.attackId = null;
  fighter.attackFrame = 0;
  fighter.specialMovePhase = null;
  fighter.specialMovePhaseFrame = 0;
  fighter.attackConnected = false;
  fighter.pendingFollowUpMoveId = null;
  fighter.hitstun = 0;
  fighter.comboCount = 0;
  fighter.comboOwnerSlot = null;
  fighter.comboTimerFrames = 0;
  fighter.action = fighter.grounded ? 'idle' : 'jump';
  fighter.vx *= fighter.grounded ? 0.35 : 0.82;
  if (fighter.grounded) {
    fighter.vy = 0;
  }
}

function applyTrainingAssists(
  state: MatchState,
  infiniteHealthEnabled: boolean,
  infiniteOverchargeEnabled: boolean,
) {
  let cancelledRoundOver = false;

  for (const fighter of state.fighters) {
    const maxHealth = roster[fighter.fighterId]?.stats.maxHealth ?? fighter.health;

    if (infiniteHealthEnabled && fighter.health <= 0) {
      restoreTrainingInfiniteHealthState(fighter, maxHealth);
      cancelledRoundOver = true;
    }

    if (infiniteHealthEnabled && isTrainingReadyState(fighter) && fighter.health < maxHealth) {
      fighter.health = Math.min(
        maxHealth,
        fighter.health + TRAINING_HEALTH_RECOVERY_PER_FRAME,
      );
      fighter.recoverableHealth = fighter.health >= maxHealth
        ? 0
        : Math.min(fighter.recoverableHealth, maxHealth - fighter.health);
    }

    if (
      infiniteOverchargeEnabled &&
      fighter.overchargeActiveFrames === 0 &&
      fighter.overchargeActivationFrames === 0
    ) {
      fighter.overchargeMeter = state.status === 'countdown'
        ? MAX_OVERCHARGE_METER
        : Math.min(
            MAX_OVERCHARGE_METER,
            fighter.overchargeMeter + TRAINING_OVERCHARGE_RECOVERY_PER_FRAME,
          );
    }
  }

  if (cancelledRoundOver && (state.status === 'round-over' || state.status === 'match-over')) {
    state.status = 'fighting';
    state.roundOverFramesRemaining = 0;
    state.winner = null;
  }
}

export function FightScene(props: FightSceneProps) {
  const router = useRouter();
  const screenRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const arenaSceneRef = useRef<any>(null);
  const fightBotStateRef = useRef<FightBotState>(createFightBotState());
  const keyboardInputRef = useRef<InputState>(cloneInput());
  const pointerInputRef = useRef<InputState>(cloneInput());
  const liveInputRef = useRef<InputState>(cloneInput());
  const isPausedRef = useRef(false);
  const trainingOpponentModeRef = useRef<TrainingOpponentMode>('idle');
  const trainingInfiniteHealthRef = useRef(false);
  const trainingInfiniteOverchargeRef = useRef(false);
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
  const [trainingOpponentMode, setTrainingOpponentMode] =
    useState<TrainingOpponentMode>('idle');
  const [trainingInfiniteHealth, setTrainingInfiniteHealth] = useState(false);
  const [trainingInfiniteOvercharge, setTrainingInfiniteOvercharge] = useState(false);
  const [visualInput, setVisualInput] = useState<InputState>(() =>
    cloneInput(),
  );
  const [koAnnouncement, setKoAnnouncement] = useState<FightAnnouncement | null>(
    null,
  );
  const hasReportedResult = useRef(false);
  const koAnnouncementTimeoutRef = useRef<number | null>(null);
  const arcadeAdvanceTimeoutRef = useRef<number | null>(null);

  const opponentDefinition = useMemo(
    () => getFighter(props.opponentId),
    [props.opponentId],
  );
  const fighterDefinition = useMemo(
    () => getFighter(props.fighterId),
    [props.fighterId],
  );
  const selectedArena = useMemo(
    () => getArena(props.arenaId),
    [props.arenaId],
  );
  const audienceSeed = useMemo(
    () =>
      [
        props.mode,
        props.arenaId,
        props.fighterId,
        props.opponentId,
        props.roomCode ?? '',
        props.arcadeIndex ?? '',
      ].join(':'),
    [
      props.mode,
      props.arenaId,
      props.fighterId,
      props.opponentId,
      props.roomCode,
      props.arcadeIndex,
    ],
  );
  const hasArenaBackground = Boolean(selectedArena.backgroundPath);
  const arenaBackgroundStyle = useMemo<CSSProperties>(
    () => ({
      '--fight-arena-offset-y': `${selectedArena.backgroundOffsetY}px`,
    }) as CSSProperties,
    [selectedArena.backgroundOffsetY],
  );
  const audienceShellStyle = useMemo(
    () =>
      selectedArena.audience
        ? getAudienceShellStyle(selectedArena.audience)
        : null,
    [selectedArena],
  );
  const audienceCrowd = useMemo(
    () => {
      if (!selectedArena.audience) {
        return [];
      }

      return createAudienceCrowd(selectedArena.audience, audienceSeed, [
        fighterDefinition.id,
        opponentDefinition.id,
      ]);
    },
    [audienceSeed, fighterDefinition.id, opponentDefinition.id, selectedArena],
  );
  const audienceDefinitions = useMemo(
    () =>
      getUniqueFighters(
        audienceCrowd.flatMap((fan) =>
          roster[fan.character.fighterId] ? [roster[fan.character.fighterId]] : [],
        ),
      ),
    [audienceCrowd],
  );
  const audienceMatchFrame = hudState?.frame ?? 0;
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
  const nextArcadeHref = useMemo(() => {
    if (props.mode !== 'arcade' || !props.arcadeOrder?.length) {
      return null;
    }

    const nextArcadeIndex = (props.arcadeIndex ?? 0) + 1;
    if (nextArcadeIndex >= props.arcadeOrder.length) {
      return null;
    }

    return buildArcadeFightHref(
      props.fighterId,
      props.arcadeOrder,
      nextArcadeIndex,
      props.arenaId,
      props.playerName,
    );
  }, [
    props.arcadeIndex,
    props.arcadeOrder,
    props.arenaId,
    props.fighterId,
    props.mode,
    props.playerName,
  ]);
  const overchargeControlState = useMemo(() => {
    const overchargeMeter = controlledFighterRuntime?.overchargeMeter ?? 0;
    const overchargeActiveFrames =
      controlledFighterRuntime?.overchargeActiveFrames ?? 0;
    const ready =
      overchargeActiveFrames === 0 &&
      overchargeMeter >= MAX_OVERCHARGE_METER;

    return {
      active: overchargeActiveFrames > 0,
      ready,
      enabled: ready,
      label:
        overchargeActiveFrames > 0
          ? `${(overchargeActiveFrames / FPS).toFixed(1)}s`
          : ready
            ? 'READY'
            : `${Math.round(overchargeMeter)}%`,
    };
  }, [controlledFighterRuntime]);

  const activeSpecialCinematic = useMemo(() => {
    const activeSpecial = getActiveSpecialCinematicState(hudState);
    if (!activeSpecial) {
      return null;
    }

    const manifest = fighterAssetManifests[activeSpecial.definition.id];
    const buildUpAnimation = getSpecialBuildUpAnimation(manifest, activeSpecial.move);
    const frameIndex = getSpecialBuildUpFrameIndex(
      activeSpecial.fighter,
      activeSpecial.move,
      buildUpAnimation.frameSources.length,
      buildUpAnimation.usesDedicatedPose,
    );
    const renderHeight =
      activeSpecial.definition.sprites.renderHeight ?? defaultFighterRenderHeight;
    const focusTargetY = activeSpecial.fighter.y - renderHeight * 0.62;
    const focusedPanX =
      ((DEFAULT_CONFIG.width * 0.5 - activeSpecial.fighter.x * activeSpecial.zoomScale) /
        DEFAULT_CONFIG.width) *
      100;
    const focusedPanY =
      ((DEFAULT_CONFIG.height * 0.58 - focusTargetY * activeSpecial.zoomScale) /
        DEFAULT_CONFIG.height) *
      100;

    return {
      ...activeSpecial,
      frameSource: buildUpAnimation.frameSources[frameIndex] ?? null,
      focusHeightPx: Math.round(renderHeight * 3.35),
      panX: `${(focusedPanX * activeSpecial.buildUpProgress).toFixed(3)}%`,
      panY: `${(focusedPanY * activeSpecial.buildUpProgress).toFixed(3)}%`,
    };
  }, [fighterAssetManifests, hudState]);

  const overchargeActivationFlashes = useMemo(() => {
    if (!hudState) {
      return [] as OverchargeActivationFlash[];
    }

    return hudState.fighters.flatMap((fighter) => {
      if (fighter.overchargeActivationFrames <= 0) {
        return [];
      }

      const definition = roster[fighter.fighterId];
      if (!definition) {
        return [];
      }

      const renderHeight =
        definition.sprites.renderHeight ?? defaultFighterRenderHeight;
      const visualLift =
        getDashVisualLift(fighter, definition) +
        getSpecialHoverVisualLift(fighter, definition);
      const flashProgress = 1 - getOverchargeActivationProgress(fighter);
      const intensity = Math.pow(Math.max(0, flashProgress), 2.2);

      return [
        {
          key: `${fighter.slot}-${hudState.frame}`,
          xPercent: (fighter.x / DEFAULT_CONFIG.width) * 100,
          yPercent:
            ((fighter.y + 6 - visualLift - renderHeight * 0.56) /
              DEFAULT_CONFIG.height) *
            100,
          intensity,
          coreSizePercent: Math.max(
            7,
            (renderHeight * 0.38 / DEFAULT_CONFIG.width) * 100,
          ),
          haloSizePercent: Math.max(
            18,
            (renderHeight * 1.5 / DEFAULT_CONFIG.width) * 100,
          ),
          blurPx: Math.round(8 + intensity * 16),
        },
      ] satisfies OverchargeActivationFlash[];
    });
  }, [hudState]);

  const specialCinematicStyle = activeSpecialCinematic
    ? ({
        '--fight-special-zoom-scale': `${activeSpecialCinematic.zoomScale}`,
        '--fight-special-pan-x': activeSpecialCinematic.panX,
        '--fight-special-pan-y': activeSpecialCinematic.panY,
        '--fight-special-build-up-progress': `${activeSpecialCinematic.buildUpProgress}`,
        '--fight-special-focus-height': `${activeSpecialCinematic.focusHeightPx}px`,
        '--fight-special-overlay-opacity': `${activeSpecialCinematic.overlayOpacity}`,
      } as CSSProperties)
    : undefined;

  useEffect(
    () => () => {
      if (koAnnouncementTimeoutRef.current !== null) {
        window.clearTimeout(koAnnouncementTimeoutRef.current);
      }

      if (arcadeAdvanceTimeoutRef.current !== null) {
        window.clearTimeout(arcadeAdvanceTimeoutRef.current);
      }
    },
    [],
  );

  const syncVisualInput = () => {
    const nextInput = {
      left: keyboardInputRef.current.left || pointerInputRef.current.left,
      right: keyboardInputRef.current.right || pointerInputRef.current.right,
      up: keyboardInputRef.current.up || pointerInputRef.current.up,
      guard: false,
      punch: keyboardInputRef.current.punch || pointerInputRef.current.punch,
      kick: keyboardInputRef.current.kick || pointerInputRef.current.kick,
      special:
        keyboardInputRef.current.special || pointerInputRef.current.special,
      overcharge:
        keyboardInputRef.current.overcharge ||
        pointerInputRef.current.overcharge,
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
    if (props.mode !== 'training' || isSceneBooting) {
      return;
    }

    setConnectionState(
      trainingOpponentMode === 'bot'
        ? 'Training mode running against a sparring bot.'
        : 'Training mode running against an immobile dummy.',
    );
  }, [isSceneBooting, props.mode, trainingOpponentMode]);

  useEffect(() => {
    if (props.mode !== 'arcade' || !hudState || hudState.status !== 'match-over') {
      if (arcadeAdvanceTimeoutRef.current !== null) {
        window.clearTimeout(arcadeAdvanceTimeoutRef.current);
        arcadeAdvanceTimeoutRef.current = null;
      }
      return;
    }

    if (hudState.winner !== playerSlot || !nextArcadeHref) {
      return;
    }

    arcadeAdvanceTimeoutRef.current = window.setTimeout(() => {
      router.push(nextArcadeHref);
    }, KO_ANNOUNCEMENT_DURATION_MS);

    return () => {
      if (arcadeAdvanceTimeoutRef.current !== null) {
        window.clearTimeout(arcadeAdvanceTimeoutRef.current);
        arcadeAdvanceTimeoutRef.current = null;
      }
    };
  }, [hudState, nextArcadeHref, playerSlot, props.mode, router]);

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
    setTrainingOpponentMode('idle');
    trainingOpponentModeRef.current = 'idle';
    setTrainingInfiniteHealth(false);
    trainingInfiniteHealthRef.current = false;
    setTrainingInfiniteOvercharge(false);
    trainingInfiniteOverchargeRef.current = false;
    fightBotStateRef.current = createFightBotState();
    if (koAnnouncementTimeoutRef.current !== null) {
      window.clearTimeout(koAnnouncementTimeoutRef.current);
      koAnnouncementTimeoutRef.current = null;
    }
    setKoAnnouncement(null);
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

    const showKoAnnouncement = () => {
      if (destroyed) {
        return;
      }

      setKoAnnouncement({
        eyebrow: '',
        title: 'K.O.',
        phase: 'ko',
      });
      if (koAnnouncementTimeoutRef.current !== null) {
        window.clearTimeout(koAnnouncementTimeoutRef.current);
      }
      koAnnouncementTimeoutRef.current = window.setTimeout(() => {
        koAnnouncementTimeoutRef.current = null;
        setKoAnnouncement((current) =>
          current?.phase === 'ko' ? null : current,
        );
      }, KO_ANNOUNCEMENT_DURATION_MS);
    };

    setHudState(props.mode === 'online' ? null : localState.current);

    const keyMap: Record<string, ControlInputKey> = {
      KeyW: 'up',
      KeyA: 'left',
      KeyD: 'right',
      KeyJ: 'punch',
      KeyK: 'kick',
      KeyL: 'special',
      KeyO: 'overcharge',
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
        ensureFighterAssets([
          fighterDefinition,
          opponentDefinition,
          ...audienceDefinitions,
        ]),
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
        private backgroundGraphics!: InstanceType<
          typeof Phaser.GameObjects.Graphics
        >;
        private overchargeBackGraphics!: InstanceType<
          typeof Phaser.GameObjects.Graphics
        >;
        private fighterGraphics!: InstanceType<
          typeof Phaser.GameObjects.Graphics
        >;
        private overchargeFrontGraphics!: InstanceType<
          typeof Phaser.GameObjects.Graphics
        >;
        private projectileGraphics!: InstanceType<
          typeof Phaser.GameObjects.Graphics
        >;
        private fighterSprites = new Map<
          1 | 2,
          InstanceType<typeof Phaser.GameObjects.Image>
        >();
        private fighterCompanionSprites = new Map<
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
        private koSlowdownRemainingMs = 0;

        private startKoDramaticBeat() {
          this.koSlowdownRemainingMs = KO_SLOWDOWN_DURATION_MS;
          window.setTimeout(showKoAnnouncement, KO_SLOWDOWN_DURATION_MS);
        }

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
          const trailScales = getProjectileTrailScales(projectile);
          const trailZigZagOffsets = getProjectileTrailZigZagOffsets(projectile);
          const jiggleAmplitude = getProjectileTrailJiggleAmplitude(projectile);
          const jiggleSpeed = getProjectileTrailJiggleSpeed(projectile);
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
          const perpendicularX = -directionY;
          const perpendicularY = directionX;
          const spacing = Math.max(projectile.hitbox.width * 0.6, 14);
          const rotation = Math.atan2(projectile.vy, projectile.vx);
          const timeSeconds = this.time.now / 1000;
          const nextTrailSprites = trailAlphas.map((alpha, index) => {
            const trailSprite =
              existingTrailSprites[index] ??
              this.add.image(projectile.x, projectile.y, textureKey);
            const offset = spacing * (index + 1);
            const zigZagOffset = trailZigZagOffsets[index] ?? 0;
            const trailScale = trailScales[index] ?? Math.max(0.35, 1 - (index + 1) * 0.14);
            const jiggleOffset =
              jiggleAmplitude > 0
                ? Math.sin(
                    timeSeconds * jiggleSpeed + projectile.id * 0.35 + index * 1.25,
                  ) *
                  jiggleAmplitude *
                  Math.max(0.45, 1 - index * 0.16)
                : 0;
            const perpendicularOffset = zigZagOffset + jiggleOffset;

            trailSprite.setTexture(textureKey);
            trailSprite.setVisible(true);
            trailSprite.setDepth(3.9 - index * 0.01);
            trailSprite.setOrigin(0.5, 0.5);
            trailSprite.setPosition(
              projectile.x - directionX * offset + perpendicularX * perpendicularOffset,
              projectile.y - directionY * offset + perpendicularY * perpendicularOffset,
            );
            trailSprite.setRotation(rotation);
            trailSprite.setScale(scale * trailScale);
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
          queueManifestTextures(this, fighterAssetManifestsRef.current, false);
          queueProjectileTextures(
            this,
            projectileAssetSourcesRef.current,
            false,
          );
        }

        create() {
          this.cameras.main.setBackgroundColor('rgba(0, 0, 0, 0)');
          this.backgroundGraphics = this.add.graphics();
          this.backgroundGraphics.setDepth(1);
          this.overchargeBackGraphics = this.add.graphics();
          this.overchargeBackGraphics.setDepth(2);
          this.fighterGraphics = this.add.graphics();
          this.fighterGraphics.setDepth(3);
          this.overchargeFrontGraphics = this.add.graphics();
          this.overchargeFrontGraphics.setDepth(3.25);
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
                if (hasNewKo(localState.current, message.state)) {
                  showKoAnnouncement();
                }
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
          } else if (props.mode === 'arcade') {
            setConnectionState('Arcade mode running against the current ladder opponent.');
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

          if (props.mode === 'local' || props.mode === 'training' || props.mode === 'arcade') {
            const boundedDelta = Math.min(delta, 100);
            const scaledDelta =
              this.koSlowdownRemainingMs > 0
                ? boundedDelta * KO_SLOWDOWN_TIME_SCALE
                : boundedDelta;
            this.koSlowdownRemainingMs = Math.max(
              0,
              this.koSlowdownRemainingMs - boundedDelta,
            );
            this.simulationAccumulatorMs += scaledDelta;
            let didAdvanceSimulation = false;

            while (this.simulationAccumulatorMs >= this.simulationStepMs) {
              const previousState = localState.current;
              const opponentInput =
                props.mode === 'training'
                  ? trainingOpponentModeRef.current === 'bot'
                    ? createAiInput(localState.current, fightBotStateRef.current)
                    : EMPTY_INPUT
                  : createAiInput(localState.current, fightBotStateRef.current);
              localState.current = stepMatch(
                localState.current,
                roster,
                liveInputRef.current,
                opponentInput,
                localMatchConfig,
              );
              if (props.mode === 'training') {
                applyTrainingAssists(
                  localState.current,
                  trainingInfiniteHealthRef.current,
                  trainingInfiniteOverchargeRef.current,
                );
              }
              this.simulationAccumulatorMs -= this.simulationStepMs;
              didAdvanceSimulation = true;

              if (hasNewKo(previousState, localState.current)) {
                this.startKoDramaticBeat();
                setHudState(localState.current);
                break;
              }
            }

            if (
              didAdvanceSimulation &&
              (
                localState.current.frame % 2 === 0 ||
                getActiveSpecialCinematicState(localState.current)
              )
            ) {
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
          this.overchargeBackGraphics.clear();
          this.fighterGraphics.clear();
          this.overchargeFrontGraphics.clear();
          this.projectileGraphics.clear();
          this.fighterCompanionSprites.forEach((sprite) => sprite.setVisible(false));
          if (!hasArenaBackground) {
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
          }

          state.fighters.forEach((fighter) => {
            const definition = roster[fighter.fighterId];
            const manifest = fighterAssetManifestsRef.current[fighter.fighterId];
            const companionState = getParakWinCompanionState(
              state,
              fighter,
              manifest,
            );
            const activeStance = getAvailableAnimationStance(
              state,
              fighter,
              definition,
              manifest,
            );
            const existingSprite = this.fighterSprites.get(fighter.slot);
            const existingCompanionSprite =
              this.fighterCompanionSprites.get(fighter.slot);
            const visibleThisFrame = isBlinkFrameVisible(fighter, state.frame);

            if (companionState) {
              if (this.textures.exists(companionState.textureKey)) {
                const sourceImage = this.textures
                  .get(companionState.textureKey)
                  .getSourceImage() as { height: number };
                const companionSprite =
                  existingCompanionSprite ??
                  this.add.image(
                    companionState.x,
                    companionState.y,
                    companionState.textureKey,
                  );

                companionSprite.setTexture(companionState.textureKey);
                companionSprite.setVisible(true);
                companionSprite.setDepth(companionState.depth);
                companionSprite.setOrigin(0.5, 1);
                companionSprite.setPosition(companionState.x, companionState.y);
                companionSprite.setFlipX(companionState.flipX);
                companionSprite.setScale(
                  PARAK_WIN_COMPANION_RENDER_HEIGHT / sourceImage.height,
                );
                this.fighterCompanionSprites.set(fighter.slot, companionSprite);
              } else {
                existingCompanionSprite?.setVisible(false);
              }
            } else {
              existingCompanionSprite?.setVisible(false);
            }

            if (!visibleThisFrame) {
              existingSprite?.setVisible(false);
              return;
            }

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
                renderOverchargeAura(
                  this.overchargeBackGraphics,
                  fighter,
                  definition,
                  state.frame,
                  'back',
                );
                renderFighterFallback(this.fighterGraphics, fighter, definition);
                renderOverchargeAura(
                  this.overchargeFrontGraphics,
                  fighter,
                  definition,
                  state.frame,
                  'front',
                );
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
              const visualLift =
                getDashVisualLift(fighter, definition) +
                getSpecialHoverVisualLift(fighter, definition);
              const overchargePulse =
                fighter.overchargeActiveFrames > 0
                  ? 0.5 + 0.5 * Math.sin(state.frame * 0.28 + fighter.slot * 1.9)
                  : 0;
              const overchargeActivationProgress =
                getOverchargeActivationProgress(fighter);
              const activationPulse =
                fighter.overchargeActivationFrames > 0
                  ? 1 + (1 - overchargeActivationProgress) * 0.08
                  : 1;

              fighterSprite.setTexture(textureKey);
              fighterSprite.setVisible(true);
              fighterSprite.setDepth(3);
              fighterSprite.setOrigin(0.5, 1);
              fighterSprite.setPosition(fighter.x, fighter.y + 6 - visualLift);
              fighterSprite.setFlipX(fighter.facing < 0);
              fighterSprite.setScale(
                spriteScale * (1 + overchargePulse * 0.03) * activationPulse,
              );
              if (fighter.overchargeActiveFrames > 0) {
                fighterSprite.setTint(0xfff8dc);
                fighterSprite.setAlpha(0.94 + overchargePulse * 0.06);
              } else {
                fighterSprite.clearTint();
                fighterSprite.setAlpha(1);
              }
              this.fighterSprites.set(fighter.slot, fighterSprite);
              renderOverchargeAura(
                this.overchargeBackGraphics,
                fighter,
                definition,
                state.frame,
                'back',
              );
              renderGuardOverlay(this.fighterGraphics, fighter, definition);
              renderOverchargeAura(
                this.overchargeFrontGraphics,
                fighter,
                definition,
                state.frame,
                'front',
              );
            } else {
              existingSprite?.setVisible(false);
              renderOverchargeAura(
                this.overchargeBackGraphics,
                fighter,
                definition,
                state.frame,
                'back',
              );
              renderFighterFallback(this.fighterGraphics, fighter, definition);
              renderOverchargeAura(
                this.overchargeFrontGraphics,
                fighter,
                definition,
                state.frame,
                'front',
              );
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
        transparent: true,
        parent: containerRef.current!,
        backgroundColor: 'rgba(0, 0, 0, 0)',
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
    hasArenaBackground,
    opponentDefinition,
    props.arenaId,
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
  const roundResultAnnouncement = !koAnnouncement
    ? getRoundResultAnnouncement(hudState, playerSlot)
    : null;
  const fightAnnouncement =
    koAnnouncement ?? countdownAnnouncement ?? roundResultAnnouncement;

  useEffect(() => {
    document.body.classList.add('fight-route-active');

    return () => {
      document.body.classList.remove('fight-route-active');
    };
  }, []);

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
      className={
        `fight-screen${isPaused ? ' fight-screen-paused' : ''}` +
        `${activeSpecialCinematic ? ' fight-screen-special' : ''}` +
        `${activeSpecialCinematic?.phase === 'build-up' ? ' fight-screen-special-building' : ''}` +
        `${activeSpecialCinematic?.phase === 'landing-hold' || activeSpecialCinematic?.phase === 'pause' ? ' fight-screen-special-hold' : ''}`
      }
      style={specialCinematicStyle}
      onPointerDown={focusMatch}
    >
      {hasArenaBackground ? (
        <div className="fight-arena-backdrop-shell" aria-hidden="true">
          <img
            src={selectedArena.backgroundPath}
            alt=""
            className="fight-arena-backdrop"
          />
        </div>
      ) : null}
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
        style={arenaBackgroundStyle}
        tabIndex={0}
        aria-label={`Fight match viewport. ${connectionState}`}
        aria-busy={isSceneBooting}
      >
        {audienceShellStyle ? (
          <div
            className="fight-audience-shell"
            style={audienceShellStyle}
            aria-hidden="true"
          >
            <div className="fight-audience-rail fight-audience-rail-back" />
            {audienceCrowd.map((fan) => {
              const definition = roster[fan.character.fighterId];
              const manifest = fighterAssetManifests[fan.character.fighterId];
              const frameSource = getAudienceFrameSource(
                fan,
                manifest,
                audienceMatchFrame,
              );

              if (!definition || !frameSource) {
                return null;
              }

              return (
                <div
                  key={fan.key}
                  className={`fight-audience-fan fight-audience-cheer-${fan.character.cheerAnimation}`}
                  style={getAudienceFanStyle(fan, definition)}
                >
                  <img
                    src={frameSource}
                    alt=""
                    className="fight-audience-sprite"
                  />
                </div>
              );
            })}
            <div className="fight-audience-rail fight-audience-rail-front" />
            <div className="fight-audience-haze" />
          </div>
        ) : null}
        {isSceneBooting ? (
          <div className="fight-loading-overlay">
            <div className="fight-loading-faceoff">
              <div className="fight-loading-entry fight-loading-entry-player">
                {props.concealFighterOnLoading ? (
                  <div className="fight-loading-random-panel" aria-hidden="true">
                    <div className="fight-loading-random-headshot">
                      <span className="fight-loading-random-glyph">?</span>
                    </div>
                  </div>
                ) : (
                  <img
                    src={fighterDefinition.sprites.portrait}
                    alt={fighterDefinition.name}
                    className="fight-loading-portrait fight-loading-portrait-player"
                  />
                )}
                <div className="fight-loading-label">
                  {props.concealFighterOnLoading ? 'Random' : fighterDefinition.name}
                </div>
              </div>
              <div className="fight-loading-entry fight-loading-entry-opponent">
                {props.concealOpponentOnLoading ? (
                  <div className="fight-loading-random-panel" aria-hidden="true">
                    <div className="fight-loading-random-headshot">
                      <span className="fight-loading-random-glyph">?</span>
                    </div>
                  </div>
                ) : (
                  <img
                    src={opponentDefinition.sprites.portrait}
                    alt={opponentDefinition.name}
                    className="fight-loading-portrait fight-loading-portrait-opponent"
                  />
                )}
                <div className="fight-loading-label">
                  {props.concealOpponentOnLoading ? 'Random' : opponentDefinition.name}
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {!isSceneBooting && activeSpecialCinematic ? (
          <div
            className={`fight-special-overlay fight-special-phase-${activeSpecialCinematic.phase}`}
            aria-hidden="true"
          >
            <div className="fight-special-backlight" />
            {activeSpecialCinematic.frameSource ? (
              <img
                src={activeSpecialCinematic.frameSource}
                alt=""
                className={`fight-special-focus${activeSpecialCinematic.fighter.facing < 0 ? ' fight-special-focus-flipped' : ''}`}
              />
            ) : null}
          </div>
        ) : null}
        {!isSceneBooting && overchargeActivationFlashes.length > 0 ? (
          <div
            className="fight-overcharge-flash-overlay"
            aria-hidden="true"
          >
            {overchargeActivationFlashes.map((flash) => (
              <div
                key={flash.key}
                className="fight-overcharge-flash"
                style={getOverchargeActivationFlashStyle(flash)}
              />
            ))}
          </div>
        ) : null}
        {!isSceneBooting && hudState ? (
          <FightHud
            state={hudState}
            headshots={hudHeadshots}
          />
        ) : null}
        {!isSceneBooting && props.mode === 'training' ? (
          <div
            className="fight-training-panel"
            role="group"
            aria-label="Training options"
          >
            <div className="fight-training-panel-stack">
              <div className="fight-training-group">
                <div className="fight-training-group-label">Opponent</div>
                <div className="fight-training-toggle">
                  {(['idle', 'bot'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`fight-training-toggle-button${trainingOpponentMode === mode ? ' fight-training-toggle-button-active' : ''}`}
                      aria-pressed={trainingOpponentMode === mode}
                      onClick={() => {
                        trainingOpponentModeRef.current = mode;
                        setTrainingOpponentMode(mode);
                        focusMatch();
                      }}
                    >
                      {mode === 'idle' ? 'Idle' : 'Bot'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="fight-training-group">
                <div className="fight-training-group-label">Assist</div>
                <div className="fight-training-toggle">
                  <button
                    type="button"
                    className={`fight-training-toggle-button${trainingInfiniteHealth ? ' fight-training-toggle-button-active' : ''}`}
                    aria-pressed={trainingInfiniteHealth}
                    onClick={() => {
                      const nextValue = !trainingInfiniteHealthRef.current;
                      trainingInfiniteHealthRef.current = nextValue;
                      setTrainingInfiniteHealth(nextValue);
                      focusMatch();
                    }}
                  >
                    HP∞
                  </button>
                  <button
                    type="button"
                    className={`fight-training-toggle-button${trainingInfiniteOvercharge ? ' fight-training-toggle-button-active' : ''}`}
                    aria-pressed={trainingInfiniteOvercharge}
                    onClick={() => {
                      const nextValue = !trainingInfiniteOverchargeRef.current;
                      trainingInfiniteOverchargeRef.current = nextValue;
                      setTrainingInfiniteOvercharge(nextValue);
                      focusMatch();
                    }}
                  >
                    OC∞
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {!isSceneBooting && fightAnnouncement ? (
        <div
          className={`fight-countdown-overlay fight-countdown-phase-${fightAnnouncement.phase}`}
          aria-live="polite"
        >
          <div className="fight-countdown-panel">
            {fightAnnouncement.eyebrow ? (
              <div className="fight-countdown-eyebrow">
                {fightAnnouncement.eyebrow}
              </div>
            ) : null}
            <div className="fight-countdown-title">
              {fightAnnouncement.title}
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
            <div className="fight-controls-row fight-controls-row-movement">
              {movementControls.map((control) => (
                <button
                  key={control.key}
                  type="button"
                  className={`fight-control-button fight-control-button-action fight-control-button-movement fight-control-button-movement-${control.key}${visualInput[control.key] ? ' fight-control-button-active' : ''}`}
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
          </div>
          <div className="fight-controls fight-controls-right">
            {attackControls.map((row, rowIndex) => (
              <div
                key={`attack-${rowIndex}`}
                className="fight-controls-row fight-controls-row-action"
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
                  const attackButton = (
                    <button
                      type="button"
                      className={`fight-control-button fight-control-button-action${activeClass}${coolingClass}`}
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
                  );

                  return (
                    <div
                      key={control.key}
                      className={`fight-control-stack${control.key === 'special' ? ' fight-control-stack-special' : ''}`}
                    >
                      {control.key === 'special' ? (
                        <div className="fight-control-special-buttons">
                          <button
                            type="button"
                            className={
                              `fight-control-button fight-control-button-action fight-control-button-overcharge` +
                              `${visualInput.overcharge ? ' fight-control-button-active' : ''}` +
                              `${overchargeControlState.ready ? ' fight-control-button-overcharge-ready' : ''}` +
                              `${overchargeControlState.active ? ' fight-control-button-overcharge-active' : ''}`
                            }
                            disabled={!overchargeControlState.enabled && !overchargeControlState.active}
                            aria-disabled={!overchargeControlState.enabled && !overchargeControlState.active}
                            title={`Overcharge ${overchargeControlState.label}`}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              focusMatch();
                              if (!overchargeControlState.enabled) {
                                setInputSourceValue('pointer', 'overcharge', false);
                                return;
                              }

                              setInputSourceValue('pointer', 'overcharge', true);
                            }}
                            onPointerUp={() =>
                              setInputSourceValue('pointer', 'overcharge', false)
                            }
                            onPointerLeave={() =>
                              setInputSourceValue('pointer', 'overcharge', false)
                            }
                            onPointerCancel={() =>
                              setInputSourceValue('pointer', 'overcharge', false)
                            }
                          >
                            <span className="fight-control-button-face">
                              O
                            </span>
                          </button>
                          {attackButton}
                        </div>
                      ) : attackButton}
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
