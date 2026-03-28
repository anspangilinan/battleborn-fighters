import type {
  Box,
  CharacterDefinition,
  Facing,
  FighterRuntimeState,
  FrameBoxes,
  InputState,
  MatchConfig,
  MatchState,
  PlayerSlot,
} from "./types";

export const FPS = 60;
const DASH_TAP_WINDOW_FRAMES = 10;
const DASH_DURATION_FRAMES = 8;

export const DEFAULT_CONFIG: MatchConfig = {
  width: 960,
  height: 540,
  groundY: 420,
  roundSeconds: 99,
  roundsToWin: 2,
};

export const EMPTY_INPUT: InputState = {
  left: false,
  right: false,
  up: false,
  punch: false,
  kick: false,
  special: false,
};

export function cloneInput(input?: Partial<InputState>): InputState {
  return { ...EMPTY_INPUT, ...input };
}

export function encodeInput(input: InputState): number {
  return (input.left ? 1 : 0) |
    (input.right ? 1 << 1 : 0) |
    (input.up ? 1 << 2 : 0) |
    (input.punch ? 1 << 3 : 0) |
    (input.kick ? 1 << 4 : 0) |
    (input.special ? 1 << 5 : 0);
}

export function decodeInput(mask: number): InputState {
  return {
    left: Boolean(mask & 1),
    right: Boolean(mask & (1 << 1)),
    up: Boolean(mask & (1 << 2)),
    punch: Boolean(mask & (1 << 3)),
    kick: Boolean(mask & (1 << 4)),
    special: Boolean(mask & (1 << 5)),
  };
}

export function createMatchState(
  roster: Record<string, CharacterDefinition>,
  playerOneId: string,
  playerTwoId: string,
  playerOneName = "Player One",
  playerTwoName = "Player Two",
  config: MatchConfig = DEFAULT_CONFIG,
): MatchState {
  const left = roster[playerOneId];
  const right = roster[playerTwoId];
  if (!left || !right) {
    throw new Error("Unknown fighter selection");
  }

  return {
    frame: 0,
    countdownFrames: FPS * 2,
    timerFramesRemaining: config.roundSeconds * FPS,
    round: 1,
    status: "countdown",
    winner: null,
    events: [],
    fighters: [
      createFighterState(1, left, playerOneName, 240, config.groundY),
      createFighterState(2, right, playerTwoName, 720, config.groundY),
    ],
  };
}

function createFighterState(
  slot: PlayerSlot,
  definition: CharacterDefinition,
  name: string,
  x: number,
  groundY: number,
): FighterRuntimeState {
  return {
    slot,
    fighterId: definition.id,
    name,
    x,
    y: groundY,
    vx: 0,
    vy: 0,
    facing: slot === 1 ? 1 : -1,
    grounded: true,
    dashDirection: 0,
    dashFramesRemaining: 0,
    lastTapDirection: 0,
    lastTapFrame: DASH_TAP_WINDOW_FRAMES + 1,
    action: "idle",
    health: definition.stats.maxHealth,
    attackId: null,
    attackFrame: 0,
    attackConnected: false,
    hitstun: 0,
    wins: 0,
    ready: false,
    meter: 0,
    lastInput: cloneInput(),
  };
}

export function resetRound(
  state: MatchState,
  roster: Record<string, CharacterDefinition>,
  config: MatchConfig = DEFAULT_CONFIG,
): MatchState {
  return createMatchState(
    roster,
    state.fighters[0].fighterId,
    state.fighters[1].fighterId,
    state.fighters[0].name,
    state.fighters[1].name,
    config,
  );
}

export function stepMatch(
  previous: MatchState,
  roster: Record<string, CharacterDefinition>,
  inputA: InputState,
  inputB: InputState,
  config: MatchConfig = DEFAULT_CONFIG,
): MatchState {
  const state: MatchState = structuredClone(previous);
  const fighterA = state.fighters[0];
  const fighterB = state.fighters[1];
  const definitionA = roster[fighterA.fighterId];
  const definitionB = roster[fighterB.fighterId];
  const previousFighterAX = fighterA.x;
  const previousFighterBX = fighterB.x;
  state.events = [];
  state.frame += 1;

  if (state.status === "countdown") {
    state.countdownFrames -= 1;
    if (state.countdownFrames <= 0) {
      state.status = "fighting";
    }
  } else if (state.status === "fighting" && Number.isFinite(state.timerFramesRemaining)) {
    state.timerFramesRemaining = Math.max(0, state.timerFramesRemaining - 1);
  }

  updateFighter(state, fighterA, fighterB, definitionA, inputA, config);
  updateFighter(state, fighterB, fighterA, definitionB, inputB, config);

  resolvePushboxes(
    fighterA,
    fighterB,
    definitionA,
    definitionB,
    previousFighterAX,
    previousFighterBX,
  );
  resolveFacing(fighterA, fighterB);
  resolveHits(state, fighterA, fighterB, definitionA, definitionB);
  resolveHits(state, fighterB, fighterA, definitionB, definitionA);

  if (fighterA.health <= 0 || fighterB.health <= 0 || state.timerFramesRemaining === 0) {
    resolveRoundResult(state, roster, config);
  }

  fighterA.lastInput = cloneInput(inputA);
  fighterB.lastInput = cloneInput(inputB);
  return state;
}

function updateFighter(
  state: MatchState,
  fighter: FighterRuntimeState,
  opponent: FighterRuntimeState,
  definition: CharacterDefinition,
  input: InputState,
  config: MatchConfig,
) {
  fighter.lastTapFrame = Math.min(fighter.lastTapFrame + 1, DASH_TAP_WINDOW_FRAMES + 1);

  if (fighter.health <= 0) {
    cancelDash(fighter);
    fighter.action = "ko";
    fighter.vx = 0;
    fighter.hitstun = 0;
  } else if (fighter.hitstun > 0) {
    cancelDash(fighter);
    fighter.hitstun -= 1;
    fighter.action = "hit";
    fighter.vx *= 0.9;
  } else if (fighter.attackId) {
    advanceAttack(fighter, definition);
  } else if (state.status === "fighting") {
    maybeStartAttack(fighter, definition, input);
    if (!fighter.attackId) {
      updateLocomotion(fighter, definition, input);
    }
  } else {
    cancelDash(fighter);
    fighter.vx = 0;
    fighter.action = "idle";
  }

  if (!fighter.grounded) {
    fighter.vy += definition.stats.gravity;
  }

  fighter.x += fighter.vx;
  fighter.y += fighter.vy;

  if (fighter.y >= config.groundY) {
    fighter.y = config.groundY;
    fighter.vy = 0;
    fighter.grounded = true;
    if (fighter.action === "jump") {
      fighter.action = Math.abs(fighter.vx) > 0.2 ? "walk" : "idle";
    }
  } else {
    fighter.grounded = false;
    if (!fighter.attackId && fighter.hitstun === 0) {
      fighter.action = "jump";
    }
  }

  fighter.x = Math.max(40, Math.min(config.width - 40, fighter.x));

  if (opponent.health <= 0) {
    fighter.vx *= 0.8;
  }
}

function maybeStartAttack(fighter: FighterRuntimeState, definition: CharacterDefinition, input: InputState) {
  const move = input.special
    ? definition.moves.special
    : input.kick
      ? definition.moves.kick
      : input.punch
        ? definition.moves.punch
        : null;

  if (!move) {
    return;
  }

  const justPressed =
    (input.special && !fighter.lastInput.special) ||
    (input.kick && !fighter.lastInput.kick) ||
    (input.punch && !fighter.lastInput.punch);

  if (!justPressed) {
    return;
  }

  fighter.attackId = move.id;
  fighter.attackFrame = 0;
  fighter.attackConnected = false;
  cancelDash(fighter);
  fighter.action = "attack";
  fighter.vx = (move.rootVelocityX ?? 0) * fighter.facing;
}

function advanceAttack(fighter: FighterRuntimeState, definition: CharacterDefinition) {
  const move = definition.moves[fighter.attackId ?? ""];
  if (!move) {
    fighter.attackId = null;
    fighter.attackFrame = 0;
    fighter.action = "idle";
    return;
  }

  fighter.attackFrame += 1;
  if (fighter.attackFrame > move.startup + move.active + move.recovery) {
    fighter.attackId = null;
    fighter.attackFrame = 0;
    fighter.attackConnected = false;
    fighter.action = Math.abs(fighter.vx) > 0.1 ? "walk" : "idle";
  }
}

function updateLocomotion(fighter: FighterRuntimeState, definition: CharacterDefinition, input: InputState) {
  const direction = Number(input.right) - Number(input.left);

  if (fighter.grounded && input.up && !fighter.lastInput.up) {
    cancelDash(fighter);
    fighter.vy = -definition.stats.jumpVelocity;
    fighter.grounded = false;
    fighter.action = "jump";
    return;
  }

  if (!fighter.grounded) {
    fighter.action = "jump";
    return;
  }

  const tappedLeft = input.left && !fighter.lastInput.left && !input.right;
  const tappedRight = input.right && !fighter.lastInput.right && !input.left;
  if (tappedLeft) {
    registerDashTap(fighter, -1);
  } else if (tappedRight) {
    registerDashTap(fighter, 1);
  }

  if (fighter.dashFramesRemaining > 0) {
    fighter.dashFramesRemaining -= 1;
    fighter.vx = fighter.dashDirection * getDashSpeed(definition);
    fighter.action = "dash";
    if (fighter.dashFramesRemaining === 0) {
      fighter.dashDirection = 0;
    }
    return;
  }

  fighter.vx = direction * definition.stats.walkSpeed;
  if (direction !== 0) {
    fighter.action = "walk";
  } else {
    fighter.action = "idle";
    fighter.vx *= 0.75;
  }
}

function registerDashTap(fighter: FighterRuntimeState, direction: Facing) {
  const withinWindow = fighter.lastTapDirection === direction && fighter.lastTapFrame <= DASH_TAP_WINDOW_FRAMES;

  if (withinWindow) {
    fighter.dashDirection = direction;
    fighter.dashFramesRemaining = DASH_DURATION_FRAMES;
    fighter.lastTapDirection = 0;
    fighter.lastTapFrame = DASH_TAP_WINDOW_FRAMES + 1;
    return;
  }

  fighter.lastTapDirection = direction;
  fighter.lastTapFrame = 0;
}

function cancelDash(fighter: FighterRuntimeState) {
  fighter.dashDirection = 0;
  fighter.dashFramesRemaining = 0;
}

function getDashSpeed(definition: CharacterDefinition) {
  return definition.stats.dashDistance / DASH_DURATION_FRAMES;
}

function resolvePushboxes(
  fighterA: FighterRuntimeState,
  fighterB: FighterRuntimeState,
  definitionA: CharacterDefinition,
  definitionB: CharacterDefinition,
  previousFighterAX: number,
  previousFighterBX: number,
) {
  if (
    !fighterA.grounded ||
    !fighterB.grounded ||
    canDashPassThrough(fighterA, fighterB, definitionA, previousFighterAX, previousFighterBX) ||
    canDashPassThrough(fighterB, fighterA, definitionB, previousFighterBX, previousFighterAX)
  ) {
    return;
  }

  const overlap = definitionA.stats.pushWidth + definitionB.stats.pushWidth - Math.abs(fighterA.x - fighterB.x);
  if (overlap > 0) {
    const direction = fighterA.x <= fighterB.x ? -1 : 1;
    fighterA.x += direction * overlap * 0.5;
    fighterB.x -= direction * overlap * 0.5;
  }
}

function canDashPassThrough(
  fighter: FighterRuntimeState,
  opponent: FighterRuntimeState,
  definition: CharacterDefinition,
  previousFighterX: number,
  previousOpponentX: number,
) {
  if (fighter.action !== "dash") {
    return false;
  }

  if (didSwitchSides(previousFighterX, previousOpponentX, fighter.x, opponent.x)) {
    return true;
  }

  if (fighter.dashDirection === 0) {
    return false;
  }

  const projectedLandingX = fighter.x + fighter.dashDirection * getDashSpeed(definition) * fighter.dashFramesRemaining;

  if (fighter.dashDirection > 0) {
    return fighter.x <= opponent.x && projectedLandingX > opponent.x;
  }

  return fighter.x >= opponent.x && projectedLandingX < opponent.x;
}

function didSwitchSides(
  previousFighterX: number,
  previousOpponentX: number,
  fighterX: number,
  opponentX: number,
) {
  if (previousFighterX === previousOpponentX || fighterX === opponentX) {
    return false;
  }

  return (previousFighterX < previousOpponentX) !== (fighterX < opponentX);
}

function resolveFacing(fighterA: FighterRuntimeState, fighterB: FighterRuntimeState) {
  if (fighterA.x < fighterB.x) {
    fighterA.facing = 1;
    fighterB.facing = -1;
    return;
  }

  if (fighterA.x > fighterB.x) {
    fighterA.facing = -1;
    fighterB.facing = 1;
  }
}

function resolveHits(
  state: MatchState,
  attacker: FighterRuntimeState,
  defender: FighterRuntimeState,
  attackerDef: CharacterDefinition,
  defenderDef: CharacterDefinition,
) {
  if (!attacker.attackId || attacker.attackConnected || state.status !== "fighting") {
    return;
  }

  const move = attackerDef.moves[attacker.attackId];
  if (!move) {
    return;
  }

  const activeStart = move.startup;
  const activeEnd = move.startup + move.active - 1;
  if (attacker.attackFrame < activeStart || attacker.attackFrame > activeEnd) {
    return;
  }

  const frameBoxes = move.frameBoxes?.[attacker.attackFrame] ?? {};
  const hitboxes = frameBoxes.hitboxes ?? [];
  const hurtboxes = getHurtboxes(defender, defenderDef);

  for (const hitbox of hitboxes) {
    const worldHitbox = toWorldBox(attacker, hitbox);
    const collision = hurtboxes.some((hurtbox) => intersects(worldHitbox, hurtbox));
    if (!collision) {
      continue;
    }

    defender.health = Math.max(0, defender.health - hitbox.damage);
    defender.hitstun = hitbox.hitstun;
    defender.vx = hitbox.knockbackX * attacker.facing;
    defender.vy = -(hitbox.launchY ?? 0);
    defender.grounded = defender.vy === 0;
    defender.action = defender.health <= 0 ? "ko" : "hit";
    attacker.attackConnected = true;
    attacker.meter = Math.min(100, attacker.meter + 12);
    state.events.push(`${attacker.name} landed ${move.label}`);
    return;
  }
}

function getHurtboxes(fighter: FighterRuntimeState, definition: CharacterDefinition): Box[] {
  if (fighter.action === "dash") {
    return [];
  }

  if (fighter.attackId) {
    const move = definition.moves[fighter.attackId];
    const override = move?.frameBoxes?.[fighter.attackFrame]?.hurtboxes;
    if (override?.length) {
      return override.map((box) => toWorldBox(fighter, box));
    }
  }

  const source = fighter.grounded ? definition.standingBoxes : definition.jumpingBoxes;
  return (source.hurtboxes ?? []).map((box) => toWorldBox(fighter, box));
}

function toWorldBox(fighter: FighterRuntimeState, box: Box): Box {
  const mirroredX = fighter.facing === 1 ? box.x : -(box.x + box.width);
  return {
    x: fighter.x + mirroredX,
    y: fighter.y + box.y,
    width: box.width,
    height: box.height,
  };
}

function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}

function resolveRoundResult(
  state: MatchState,
  roster: Record<string, CharacterDefinition>,
  config: MatchConfig,
) {
  const [fighterA, fighterB] = state.fighters;
  if (state.status === "match-over") {
    return;
  }

  let roundWinner: PlayerSlot | null = null;
  if (fighterA.health === fighterB.health) {
    roundWinner = null;
  } else {
    roundWinner = fighterA.health > fighterB.health ? 1 : 2;
  }

  if (roundWinner) {
    state.fighters[roundWinner - 1].wins += 1;
    state.events.push(`${state.fighters[roundWinner - 1].name} wins round ${state.round}`);
  } else {
    state.events.push("Double KO");
  }

  const leftWins = state.fighters[0].wins;
  const rightWins = state.fighters[1].wins;

  if (leftWins >= config.roundsToWin || rightWins >= config.roundsToWin || state.round >= config.roundsToWin * 2 - 1) {
    state.status = "match-over";
    state.winner = leftWins === rightWins ? null : leftWins > rightWins ? 1 : 2;
    return;
  }

  const nextRound = resetRound(state, roster, config);
  nextRound.round = state.round + 1;
  nextRound.fighters[0].wins = leftWins;
  nextRound.fighters[1].wins = rightWins;
  nextRound.events = state.events;
  Object.assign(state, nextRound);
}
