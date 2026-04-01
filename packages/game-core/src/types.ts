export type PlayerSlot = 1 | 2;
export type Facing = -1 | 1;
export type Button = "punch" | "kick" | "special";
export type FighterAction = "idle" | "walk" | "dash" | "jump" | "guard" | "attack" | "hit" | "ko";
export type SpecialMovePhase = "build-up" | "landing-hold" | "pause" | "zoom-out" | "follow-through";

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  guard: boolean;
  punch: boolean;
  kick: boolean;
  special: boolean;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HitBox extends Box {
  damage: number;
  chipDamage?: number;
  hitstun: number;
  knockbackX: number;
  launchY?: number;
}

export interface FrameBoxes {
  hitboxes?: HitBox[];
  hurtboxes?: Box[];
  pushboxes?: Box[];
}

export interface MoveDefinition {
  id: string;
  label: string;
  button: Button;
  startup: number;
  active: number;
  recovery: number;
  cooldownSeconds?: number;
  meleeRange?: number;
  rootVelocityX?: number;
  jumpCancelable?: boolean;
  interruptible?: boolean;
  specialSequence?: SpecialSequenceDefinition;
  projectile?: ProjectileDefinition;
  frameBoxes?: Record<number, FrameBoxes>;
}

export interface SpecialSequenceDefinition {
  buildUpFrames: number;
  animationBuildUpFrames?: number;
  buildUpAnimation?: "special" | "special-pose";
  animationMode?: "segmented" | "loop";
  loopFrameDuration?: number;
  channelMoveSpeed?: number;
  hoverHeight?: number;
  pauseFrames?: number;
  zoomOutFrames?: number;
  holdUntilGroundedAfterBuildUp?: boolean;
  freezeOpponentDuringBuildUp?: boolean;
  zoomScale?: number;
}

export interface ProjectileDefinition {
  sprite: string;
  tier: number;
  spawnFrame?: number;
  shotCount?: number;
  shotIntervalFrames?: number;
  offsetX: number;
  offsetY: number;
  speed: number;
  targeting?: "forward" | "opponent";
  minimumDistanceRatio: number;
  maximumDistanceRatio?: number;
  apexHeight: number;
  landing?: "origin" | "floor";
  hitbox: HitBox;
}

export interface BotArenaMovementDefinition {
  preferredDistanceMultiplier?: number;
  approachBias?: number;
  retreatBias?: number;
  jumpInChance?: number;
  dashJumpForwardChance?: number;
  dashJumpBackwardChance?: number;
}

export interface BotSkillChoiceDefinition {
  punchWeight?: number;
  kickWeight?: number;
  specialWeight?: number;
  attackCadenceMultiplier?: number;
}

export interface BotDefenseDefinition {
  blockChance?: number;
  projectileDodgeChance?: number;
  meleeBlockReactionFrames?: number;
  projectileBlockReactionFrames?: number;
}

export interface BotBehaviorDefinition {
  aggressiveness?: number;
  arenaMovement?: BotArenaMovementDefinition;
  skillChoice?: BotSkillChoiceDefinition;
  defense?: BotDefenseDefinition;
}

export interface CharacterDefinition {
  id: string;
  name: string;
  palette: {
    primary: string;
    accent: string;
    shadow: string;
  };
  stats: {
    maxHealth: number;
    movement: {
      walkSpeed: number;
      jumpVelocity: number;
      gravity: number;
      dash: {
        distance: number;
        speed: number;
        lift: number;
      };
    };
    pushWidth: number;
  };
  sprites: {
    portrait: string;
    renderHeight?: number;
  };
  standingBoxes: FrameBoxes;
  jumpingBoxes: FrameBoxes;
  moves: Record<string, MoveDefinition>;
  bot?: BotBehaviorDefinition;
}

export interface FighterRuntimeState {
  slot: PlayerSlot;
  fighterId: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: Facing;
  grounded: boolean;
  dashDirection: Facing | 0;
  dashFramesRemaining: number;
  lastTapDirection: Facing | 0;
  lastTapFrame: number;
  action: FighterAction;
  actionFrames: number;
  health: number;
  attackId: string | null;
  attackFrame: number;
  specialMovePhase: SpecialMovePhase | null;
  specialMovePhaseFrame: number;
  attackConnected: boolean;
  hitstun: number;
  wins: number;
  ready: boolean;
  meter: number;
  moveCooldownFrames: Record<string, number>;
  lastInput: InputState;
}

export interface ProjectileRuntimeState {
  id: number;
  ownerSlot: PlayerSlot;
  ownerFighterId: string;
  moveId: string;
  sprite: string;
  tier: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  facing: Facing;
  originX: number;
  minimumDistance: number;
  maximumDistance?: number;
  hitbox: HitBox;
}

export interface MatchConfig {
  width: number;
  height: number;
  groundY: number;
  roundSeconds: number;
  roundsToWin: number;
}

export interface MatchState {
  frame: number;
  countdownFrames: number;
  roundOverFramesRemaining: number;
  timerFramesRemaining: number;
  roomCode?: string;
  round: number;
  status: "waiting" | "countdown" | "fighting" | "round-over" | "match-over";
  winner: PlayerSlot | null;
  fighters: [FighterRuntimeState, FighterRuntimeState];
  nextProjectileId: number;
  projectiles: ProjectileRuntimeState[];
  events: string[];
}
