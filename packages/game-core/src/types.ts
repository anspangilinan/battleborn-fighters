export type PlayerSlot = 1 | 2;
export type Facing = -1 | 1;
export type Button = "punch" | "kick" | "special";
export type FighterAction = "idle" | "walk" | "dash" | "jump" | "attack" | "hit" | "ko";

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
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
  rootVelocityX?: number;
  jumpCancelable?: boolean;
  frameBoxes?: Record<number, FrameBoxes>;
}

export interface CharacterDefinition {
  id: string;
  name: string;
  style: string;
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
  health: number;
  attackId: string | null;
  attackFrame: number;
  attackConnected: boolean;
  hitstun: number;
  wins: number;
  ready: boolean;
  meter: number;
  lastInput: InputState;
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
  timerFramesRemaining: number;
  roomCode?: string;
  round: number;
  status: "waiting" | "countdown" | "fighting" | "round-over" | "match-over";
  winner: PlayerSlot | null;
  fighters: [FighterRuntimeState, FighterRuntimeState];
  events: string[];
}
