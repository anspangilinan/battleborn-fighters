'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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
    case 'dash':
      return Math.min(
        frameCount - 1,
        Math.floor(((8 - fighter.dashFramesRemaining) / 8) * frameCount),
      );
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

function createAiInput(state: MatchState): InputState {
  const player = state.fighters[1];
  const target = state.fighters[0];
  if (state.status !== 'fighting') {
    return EMPTY_INPUT;
  }

  const distance = target.x - player.x;
  return {
    left: distance < -70,
    right: distance > 70,
    up: !player.grounded && player.y < target.y - 40,
    punch: Math.abs(distance) < 46 && state.frame % 50 === 0,
    kick: Math.abs(distance) < 72 && state.frame % 80 === 0,
    special: Math.abs(distance) < 120 && state.frame % 160 === 0,
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
  const baseY = fighter.y;
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const keyboardInputRef = useRef<InputState>(cloneInput());
  const pointerInputRef = useRef<InputState>(cloneInput());
  const liveInputRef = useRef<InputState>(cloneInput());
  const isPausedRef = useRef(false);
  const [hudState, setHudState] = useState<MatchState | null>(null);
  const [fighterAssetManifests, setFighterAssetManifests] = useState<
    Record<string, FighterAssetManifest>
  >({});
  const [connectionState, setConnectionState] = useState('Loading');
  const [isSceneBooting, setIsSceneBooting] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
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
    if (!containerRef.current) {
      return;
    }

    setIsSceneBooting(true);
    setConnectionState('Loading');
    setFighterAssetManifests({});
    isPausedRef.current = false;
    setIsPaused(false);
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

    void (async () => {
      const fightersToLoad = Array.from(
        new Map(
          [fighterDefinition, opponentDefinition].map((fighter) => [
            fighter.id,
            fighter,
          ]),
        ).values(),
      );
      const fighterAssetEntries = await Promise.all(
        fightersToLoad.map(
          async (fighter) =>
            [fighter.id, await discoverFighterAssets(fighter)] as const,
        ),
      );

      if (destroyed) {
        return;
      }

      const fighterAssetManifests = Object.fromEntries(
        fighterAssetEntries,
      ) as Record<string, FighterAssetManifest>;
      setFighterAssetManifests(fighterAssetManifests);
      const PhaserModule = await import('phaser');
      const Phaser = PhaserModule.default;

      class ArenaScene extends Phaser.Scene {
        private readonly simulationStepMs = 1000 / FPS;
        private arenaBackground?: InstanceType<typeof Phaser.GameObjects.Image>;
        private backgroundGraphics!: InstanceType<
          typeof Phaser.GameObjects.Graphics
        >;
        private fighterGraphics!: InstanceType<
          typeof Phaser.GameObjects.Graphics
        >;
        private fighterSprites = new Map<
          1 | 2,
          InstanceType<typeof Phaser.GameObjects.Image>
        >();
        private simulationAccumulatorMs = 0;

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

          for (const [fighterId, manifest] of Object.entries(
            fighterAssetManifests,
          )) {
            for (const stance of fightAnimationStances) {
              manifest.stanceSources[stance].forEach((source, frameIndex) => {
                const textureKey = getAnimationTextureKey(
                  fighterId,
                  stance,
                  frameIndex,
                );
                if (!this.textures.exists(textureKey)) {
                  this.load.image(textureKey, source);
                }
              });
            }
          }
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
                localState.current = message.state;
                setHudState(message.state);
              } else if (message.type === 'room_state') {
                setConnectionState(
                  `Room ${message.roomCode} · connected ${message.connectedSlots.length}/2`,
                );
              } else if (message.type === 'info') {
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
            const manifest = fighterAssetManifests[fighter.fighterId];
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
              const sourceImage = this.textures
                .get(textureKey)
                .getSourceImage() as { height: number };
              const spriteScale =
                (definition.sprites.renderHeight ??
                  defaultFighterRenderHeight) / sourceImage.height;
              const fighterSprite =
                existingSprite ??
                this.add.image(fighter.x, fighter.y + 6, textureKey);

              fighterSprite.setTexture(textureKey);
              fighterSprite.setVisible(true);
              fighterSprite.setDepth(3);
              fighterSprite.setOrigin(0.5, 1);
              fighterSprite.setPosition(fighter.x, fighter.y + 6);
              fighterSprite.setFlipX(fighter.facing < 0);
              fighterSprite.setScale(spriteScale);
              this.fighterSprites.set(fighter.slot, fighterSprite);
            } else {
              existingSprite?.setVisible(false);
              renderFighterFallback(this.fighterGraphics, fighter, definition);
            }
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

  return (
    <div
      className={`fight-screen${isPaused ? ' fight-screen-paused' : ''}`}
      onPointerDown={focusMatch}
    >
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
                    {control.label}
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
                    {control.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
