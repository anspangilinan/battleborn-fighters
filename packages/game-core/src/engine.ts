import type {
  Box,
  CharacterDefinition,
  Facing,
  FighterRuntimeState,
  FrameBoxes,
  HitBox,
  InputState,
  MatchConfig,
  MatchState,
  PlayerSlot,
  ProjectileRuntimeState,
} from "./types";

export const FPS = 60;
const DASH_TAP_WINDOW_FRAMES = 10;
const DEFAULT_ATTACK_PROJECTILE_TIER = 1;
const DEFAULT_CHIP_DAMAGE_RATIO = 0.05;
const BLOCK_MELEE_THREAT_GAP = 22;
const BLOCK_PROJECTILE_THREAT_FRAMES = 4;
const ROUND_OVER_MIN_FRAMES = FPS * 3;
const COMBO_TIMEOUT_FRAMES = Math.round(FPS * 0.5);
const JUGGLE_DROP_RECOVERY_FRAMES = Math.round(FPS * 0.5);
const JUGGLE_GRAVITY_MULTIPLIER = 0.68;

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
  guard: false,
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
    (input.guard ? 1 << 3 : 0) |
    (input.punch ? 1 << 4 : 0) |
    (input.kick ? 1 << 5 : 0) |
    (input.special ? 1 << 6 : 0);
}

export function decodeInput(mask: number): InputState {
  return {
    left: Boolean(mask & 1),
    right: Boolean(mask & (1 << 1)),
    up: Boolean(mask & (1 << 2)),
    guard: Boolean(mask & (1 << 3)),
    punch: Boolean(mask & (1 << 4)),
    kick: Boolean(mask & (1 << 5)),
    special: Boolean(mask & (1 << 6)),
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
    roundOverFramesRemaining: 0,
    timerFramesRemaining: config.roundSeconds * FPS,
    round: 1,
    status: "countdown",
    winner: null,
    nextProjectileId: 1,
    projectiles: [],
    events: [],
    fighters: [
      createFighterState(1, left, playerOneName, 240, config.groundY),
      createFighterState(2, right, playerTwoName, 720, config.groundY),
    ],
  };
}

function getInitialMoveCooldownFrames(
  move: CharacterDefinition["moves"][string],
) {
  if (move.button !== "special") {
    return 0;
  }

  return Math.ceil(getMoveCooldownFrames(move) * 0.5);
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
    actionFrames: 0,
    health: definition.stats.maxHealth,
    attackId: null,
    attackFrame: 0,
    specialMovePhase: null,
    specialMovePhaseFrame: 0,
    attackConnected: false,
    pendingFollowUpMoveId: null,
    hitstun: 0,
    juggleState: null,
    invulnerableFrames: 0,
    comboCount: 0,
    comboOwnerSlot: null,
    comboTimerFrames: 0,
    wins: 0,
    ready: false,
    meter: 0,
    moveCooldownFrames: Object.fromEntries(
      Object.entries(definition.moves).map(([moveId, move]) => [moveId, getInitialMoveCooldownFrames(move)]),
    ),
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
  }

  const specialCinematicOwnerSlotBeforeFighterA = getActiveSpecialCinematicOwnerSlot(state, roster);
  updateFighter(
    state,
    fighterA,
    fighterB,
    definitionA,
    definitionB,
    inputA,
    config,
    specialCinematicOwnerSlotBeforeFighterA != null &&
      specialCinematicOwnerSlotBeforeFighterA !== fighterA.slot,
  );

  const specialCinematicOwnerSlotBeforeFighterB = getActiveSpecialCinematicOwnerSlot(state, roster);
  updateFighter(
    state,
    fighterB,
    fighterA,
    definitionB,
    definitionA,
    inputB,
    config,
    specialCinematicOwnerSlotBeforeFighterB != null &&
      specialCinematicOwnerSlotBeforeFighterB !== fighterB.slot,
  );

  resolvePushboxes(
    fighterA,
    fighterB,
    definitionA,
    definitionB,
    previousFighterAX,
    previousFighterBX,
  );
  resolveFacing(fighterA, fighterB);
  if (state.status === "fighting") {
    const specialCinematicFrozen = getActiveSpecialCinematicOwnerSlot(state, roster) != null;

    if (!specialCinematicFrozen && Number.isFinite(state.timerFramesRemaining)) {
      state.timerFramesRemaining = Math.max(0, state.timerFramesRemaining - 1);
    }

    if (!specialCinematicFrozen) {
      updateProjectiles(state, config);
      resolveProjectileClashes(state);
      resolveAttackProjectileClashes(state, fighterA, definitionA);
      resolveAttackProjectileClashes(state, fighterB, definitionB);
      updateDefensiveGuardState(
        state,
        fighterA,
        fighterB,
        definitionA,
        definitionB,
        inputA,
      );
      updateDefensiveGuardState(
        state,
        fighterB,
        fighterA,
        definitionB,
        definitionA,
        inputB,
      );
      resolveHits(state, fighterA, fighterB, definitionA, definitionB);
      resolveHits(state, fighterB, fighterA, definitionB, definitionA);
      resolveProjectileHits(state, roster);
    }

    if (fighterA.health <= 0 || fighterB.health <= 0 || state.timerFramesRemaining === 0) {
      startRoundOver(state);
    }
  } else if (state.status === "round-over") {
    state.projectiles = [];
    if (state.roundOverFramesRemaining > 0) {
      state.roundOverFramesRemaining = Math.max(0, state.roundOverFramesRemaining - 1);
    }
    if (
      state.roundOverFramesRemaining === 0 &&
      shouldAdvanceRoundOver(state, inputA, inputB)
    ) {
      resolveRoundResult(state, roster, config);
    }
  }

  state.fighters[0].lastInput = cloneInput(inputA);
  state.fighters[1].lastInput = cloneInput(inputB);
  return state;
}

function isSpecialCinematicPhase(phase: FighterRuntimeState["specialMovePhase"]) {
  return phase != null && phase !== "follow-through";
}

function getActiveSpecialCinematicOwnerSlot(
  state: MatchState,
  roster: Record<string, CharacterDefinition>,
): PlayerSlot | null {
  if (state.status !== "fighting") {
    return null;
  }

  for (const fighter of state.fighters) {
    if (fighter.action !== "attack" || !isSpecialCinematicPhase(fighter.specialMovePhase) || !fighter.attackId) {
      continue;
    }

    const move = roster[fighter.fighterId]?.moves[fighter.attackId];
    if (move?.specialSequence && (move.specialSequence.freezeOpponentDuringBuildUp ?? true)) {
      return fighter.slot;
    }
  }

  return null;
}

function hasFreshInput(
  currentInput: InputState,
  previousInput: InputState,
) {
  return (currentInput.left && !previousInput.left) ||
    (currentInput.right && !previousInput.right) ||
    (currentInput.up && !previousInput.up) ||
    (currentInput.guard && !previousInput.guard) ||
    (currentInput.punch && !previousInput.punch) ||
    (currentInput.kick && !previousInput.kick) ||
    (currentInput.special && !previousInput.special);
}

function shouldAdvanceRoundOver(
  state: MatchState,
  inputA: InputState,
  inputB: InputState,
) {
  return hasFreshInput(inputA, state.fighters[0].lastInput) ||
    hasFreshInput(inputB, state.fighters[1].lastInput);
}

function clearComboState(fighter: FighterRuntimeState) {
  fighter.comboCount = 0;
  fighter.comboOwnerSlot = null;
  fighter.comboTimerFrames = 0;
}

function tickComboState(fighter: FighterRuntimeState) {
  if (fighter.comboTimerFrames <= 0) {
    return;
  }

  fighter.comboTimerFrames = Math.max(0, fighter.comboTimerFrames - 1);
  if (fighter.comboTimerFrames === 0) {
    clearComboState(fighter);
  }
}

function registerComboHit(
  attacker: FighterRuntimeState,
  defender: FighterRuntimeState,
) {
  if (
    defender.comboOwnerSlot === attacker.slot &&
    defender.comboCount > 0 &&
    defender.comboTimerFrames > 0
  ) {
    defender.comboCount += 1;
  } else {
    defender.comboOwnerSlot = attacker.slot;
    defender.comboCount = 1;
  }

  defender.comboTimerFrames = COMBO_TIMEOUT_FRAMES;
}

function clearAttackState(fighter: FighterRuntimeState) {
  fighter.attackId = null;
  fighter.attackFrame = 0;
  fighter.specialMovePhase = null;
  fighter.specialMovePhaseFrame = 0;
  fighter.attackConnected = false;
}

function interruptAttack(fighter: FighterRuntimeState) {
  clearAttackState(fighter);
  fighter.pendingFollowUpMoveId = null;
}

function getRequestedAttackButton(input: InputState, lastInput: InputState) {
  if (input.special && !lastInput.special) {
    return "special" as const;
  }

  if (input.kick && !lastInput.kick) {
    return "kick" as const;
  }

  if (input.punch && !lastInput.punch) {
    return "punch" as const;
  }

  return null;
}

function getDefaultMoveForButton(
  definition: CharacterDefinition,
  button: "punch" | "kick" | "special",
) {
  if (button === "special") {
    return definition.moves.special;
  }

  if (button === "kick") {
    return definition.moves.kick;
  }

  return definition.moves.punch;
}

function shouldEnterJuggle(
  defender: FighterRuntimeState,
  launchY: number,
) {
  return launchY > 0 || defender.juggleState === "airborne" || !defender.grounded;
}

function unlockFollowUpMove(
  attacker: FighterRuntimeState,
  move: CharacterDefinition["moves"][string] | undefined,
) {
  if (!move?.followUpMoveId) {
    return;
  }

  attacker.pendingFollowUpMoveId = move.followUpMoveId;
}

function updateFighter(
  state: MatchState,
  fighter: FighterRuntimeState,
  opponent: FighterRuntimeState,
  definition: CharacterDefinition,
  opponentDefinition: CharacterDefinition,
  input: InputState,
  config: MatchConfig,
  frozenBySpecialCinematic = false,
) {
  if (frozenBySpecialCinematic) {
    return;
  }

  const previousAction = fighter.action;
  fighter.lastTapFrame = Math.min(fighter.lastTapFrame + 1, DASH_TAP_WINDOW_FRAMES + 1);
  tickMoveCooldowns(fighter, definition);
  tickComboState(fighter);
  const activeMove = fighter.attackId ? definition.moves[fighter.attackId] : null;
  const recoveringFromJuggle = fighter.juggleState === "recovery" && fighter.invulnerableFrames > 0;

  if (recoveringFromJuggle) {
    interruptAttack(fighter);
    cancelDash(fighter);
    fighter.action = "idle";
    fighter.vx = 0;
    fighter.vy = 0;
    fighter.grounded = true;
    fighter.hitstun = 0;
    fighter.invulnerableFrames = Math.max(0, fighter.invulnerableFrames - 1);
    if (fighter.invulnerableFrames === 0) {
      fighter.juggleState = null;
    }
  } else if (fighter.health <= 0) {
    interruptAttack(fighter);
    cancelDash(fighter);
    fighter.juggleState = null;
    fighter.invulnerableFrames = 0;
    clearComboState(fighter);
    fighter.action = "ko";
    fighter.vx = 0;
    fighter.hitstun = 0;
  } else if (fighter.hitstun > 0 && activeMove?.interruptible !== false) {
    cancelDash(fighter);
    fighter.hitstun -= 1;
    fighter.action = "hit";
    fighter.vx *= 0.9;
  } else if (fighter.attackId) {
    if (fighter.hitstun > 0) {
      fighter.hitstun -= 1;
    }
    fighter.action = "attack";
    if (activeMove) {
      updateSpecialChannelMovement(fighter, definition, activeMove, input);
    }
    advanceAttack(state, fighter, opponent, definition, opponentDefinition, config);
  } else if (fighter.juggleState === "airborne") {
    cancelDash(fighter);
    fighter.action = "hit";
    fighter.vx *= 0.82;
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
    const gravityMultiplier = fighter.juggleState === "airborne"
      ? JUGGLE_GRAVITY_MULTIPLIER
      : 1;
    fighter.vy += definition.stats.movement.gravity * gravityMultiplier;
  }

  fighter.x += fighter.vx;
  fighter.y += fighter.vy;

  if (fighter.y >= config.groundY) {
    const landedThisFrame = !fighter.grounded;
    fighter.y = config.groundY;
    fighter.vy = 0;
    fighter.grounded = true;
    if (fighter.juggleState === "airborne" && landedThisFrame && fighter.health > 0) {
      fighter.juggleState = "recovery";
      fighter.invulnerableFrames = JUGGLE_DROP_RECOVERY_FRAMES;
      fighter.action = "idle";
      fighter.vx = 0;
      clearComboState(fighter);
    } else if (fighter.action === "jump") {
      fighter.action = Math.abs(fighter.vx) > 0.2 ? "walk" : "idle";
    }
  } else {
    fighter.grounded = false;
    if (fighter.juggleState === "airborne") {
      fighter.action = "hit";
    } else if (!fighter.attackId && fighter.hitstun === 0 && fighter.action !== "dash") {
      fighter.action = "jump";
    }
  }

  fighter.x = Math.max(40, Math.min(config.width - 40, fighter.x));

  if (opponent.health <= 0) {
    fighter.vx *= 0.8;
  }

  fighter.actionFrames = fighter.action === previousAction
    ? fighter.actionFrames + 1
    : 0;
}

function maybeStartAttack(fighter: FighterRuntimeState, definition: CharacterDefinition, input: InputState) {
  const requestedButton = getRequestedAttackButton(input, fighter.lastInput);
  if (!requestedButton) {
    return;
  }

  const pendingMove = fighter.pendingFollowUpMoveId
    ? definition.moves[fighter.pendingFollowUpMoveId]
    : null;
  const move = pendingMove?.button === requestedButton
    ? pendingMove
    : getDefaultMoveForButton(definition, requestedButton);

  if (!move) {
    return;
  }

  if ((fighter.moveCooldownFrames[move.id] ?? 0) > 0) {
    return;
  }

  fighter.pendingFollowUpMoveId = null;
  fighter.attackId = move.id;
  fighter.attackFrame = 0;
  setSpecialMovePhase(fighter, move.specialSequence ? "build-up" : null);
  fighter.attackConnected = false;
  fighter.moveCooldownFrames[move.id] = getMoveCooldownFrames(move);
  cancelDash(fighter);
  fighter.action = "attack";
  fighter.vx = (move.rootVelocityX ?? 0) * fighter.facing;
}

function tickMoveCooldowns(
  fighter: FighterRuntimeState,
  definition: CharacterDefinition,
) {
  for (const moveId of Object.keys(definition.moves)) {
    const framesRemaining = fighter.moveCooldownFrames[moveId] ?? 0;
    fighter.moveCooldownFrames[moveId] = Math.max(0, framesRemaining - 1);
  }
}

export function getMoveCooldownFrames(
  move: Pick<NonNullable<CharacterDefinition["moves"][string]>, "cooldownSeconds">,
) {
  return Math.max(0, Math.round((move.cooldownSeconds ?? 0) * FPS));
}

export function getMoveMeleeRange(
  move: Pick<
    NonNullable<CharacterDefinition["moves"][string]>,
    "meleeRange" | "projectile" | "frameBoxes"
  >,
) {
  if (move.projectile) {
    return 0;
  }

  if (move.meleeRange != null) {
    return move.meleeRange;
  }

  const hitboxes = Object.values(move.frameBoxes ?? {}).flatMap(
    (frameBoxes) => frameBoxes.hitboxes ?? [],
  );
  if (hitboxes.length === 0) {
    return 0;
  }

  return Math.max(...hitboxes.map((hitbox) => hitbox.x + hitbox.width));
}

function getMoveTotalFrames(
  move: Pick<NonNullable<CharacterDefinition["moves"][string]>, "startup" | "active" | "recovery">,
) {
  return move.startup + move.active + move.recovery;
}

function setSpecialMovePhase(
  fighter: FighterRuntimeState,
  phase: FighterRuntimeState["specialMovePhase"],
) {
  fighter.specialMovePhase = phase;
  fighter.specialMovePhaseFrame = 0;
}

function advanceSpecialPhaseAfterLanding(
  fighter: FighterRuntimeState,
  specialSequence: NonNullable<CharacterDefinition["moves"][string]["specialSequence"]>,
) {
  if ((specialSequence.pauseFrames ?? 0) > 0) {
    setSpecialMovePhase(fighter, "pause");
    return;
  }

  if ((specialSequence.zoomOutFrames ?? 0) > 0) {
    setSpecialMovePhase(fighter, "zoom-out");
    return;
  }

  setSpecialMovePhase(fighter, "follow-through");
}

function advanceSpecialPhaseAfterBuildUp(
  fighter: FighterRuntimeState,
  specialSequence: NonNullable<CharacterDefinition["moves"][string]["specialSequence"]>,
) {
  if (specialSequence.holdUntilGroundedAfterBuildUp && !fighter.grounded) {
    setSpecialMovePhase(fighter, "landing-hold");
    return;
  }

  advanceSpecialPhaseAfterLanding(fighter, specialSequence);
}

function updateSpecialChannelMovement(
  fighter: FighterRuntimeState,
  definition: CharacterDefinition,
  move: NonNullable<CharacterDefinition["moves"][string]>,
  input: InputState,
) {
  const channelMoveSpeed = move.specialSequence?.channelMoveSpeed;
  if (move.specialSequence?.animationMode !== "loop" || fighter.specialMovePhase !== "follow-through") {
    return;
  }

  if (channelMoveSpeed == null) {
    fighter.vx *= 0.82;
    return;
  }

  const direction = input.left === input.right
    ? 0
    : input.left
      ? -1
      : 1;
  fighter.vx = direction * channelMoveSpeed;
}

function finishAttack(fighter: FighterRuntimeState) {
  clearAttackState(fighter);
  fighter.action = Math.abs(fighter.vx) > 0.1 ? "walk" : "idle";
}

function advanceAttack(
  state: MatchState,
  fighter: FighterRuntimeState,
  opponent: FighterRuntimeState,
  definition: CharacterDefinition,
  opponentDefinition: CharacterDefinition,
  config: MatchConfig,
) {
  const move = definition.moves[fighter.attackId ?? ""];
  if (!move) {
    clearAttackState(fighter);
    fighter.action = "idle";
    return;
  }

  const totalFrames = getMoveTotalFrames(move);
  const specialSequence = move.specialSequence;
  if (specialSequence) {
    const buildUpFrames = Math.min(specialSequence.buildUpFrames, totalFrames);
    const pauseFrames = Math.max(0, specialSequence.pauseFrames ?? 0);
    const zoomOutFrames = Math.max(0, specialSequence.zoomOutFrames ?? 0);

    switch (fighter.specialMovePhase) {
      case "landing-hold":
        fighter.specialMovePhaseFrame += 1;
        fighter.vx *= 0.86;
        if (!fighter.grounded) {
          return;
        }

        advanceSpecialPhaseAfterLanding(fighter, specialSequence);
        return;
      case "pause":
        fighter.specialMovePhaseFrame += 1;
        fighter.vx *= 0.82;
        if (fighter.specialMovePhaseFrame < pauseFrames) {
          return;
        }

        if (zoomOutFrames > 0) {
          setSpecialMovePhase(fighter, "zoom-out");
          return;
        }

        setSpecialMovePhase(fighter, "follow-through");
        return;
      case "zoom-out":
        fighter.specialMovePhaseFrame += 1;
        fighter.vx *= 0.82;
        if (fighter.specialMovePhaseFrame < zoomOutFrames) {
          return;
        }

        setSpecialMovePhase(fighter, "follow-through");
        return;
      default:
        fighter.attackFrame += 1;
        maybeSpawnProjectile(
          state,
          fighter,
          opponent,
          definition,
          opponentDefinition,
          fighter.attackFrame,
          config,
        );

        if (fighter.specialMovePhase !== "follow-through") {
          if (fighter.attackFrame >= buildUpFrames) {
            advanceSpecialPhaseAfterBuildUp(fighter, specialSequence);
          }
          return;
        }

        if (fighter.attackFrame > totalFrames) {
          finishAttack(fighter);
        }
        return;
    }
  }

  fighter.attackFrame += 1;
  maybeSpawnProjectile(
    state,
    fighter,
    opponent,
    definition,
    opponentDefinition,
    fighter.attackFrame,
    config,
  );
  if (fighter.attackFrame > totalFrames) {
    finishAttack(fighter);
  }
}

function getFighterAimPoint(
  fighter: FighterRuntimeState,
  definition: CharacterDefinition,
) {
  const source = fighter.grounded ? definition.standingBoxes : definition.jumpingBoxes;
  const box = source.hurtboxes?.[0];

  if (!box) {
    return { x: fighter.x, y: fighter.y - 60 };
  }

  const worldBox = toWorldBox(fighter, box);
  return {
    x: worldBox.x + worldBox.width * 0.5,
    y: worldBox.y + worldBox.height * 0.5,
  };
}

function maybeSpawnProjectile(
  state: MatchState,
  fighter: FighterRuntimeState,
  opponent: FighterRuntimeState,
  definition: CharacterDefinition,
  opponentDefinition: CharacterDefinition,
  attackFrame: number,
  config: MatchConfig,
) {
  const move = definition.moves[fighter.attackId ?? ""];
  const projectile = move?.projectile;
  if (!move || !projectile) {
    return;
  }

  const spawnFrame = projectile.spawnFrame ?? move.startup;
  const shotCount = Math.max(1, projectile.shotCount ?? 1);
  const shotIntervalFrames = Math.max(1, projectile.shotIntervalFrames ?? 1);
  const attackFrameOffset = attackFrame - spawnFrame;

  if (attackFrameOffset < 0) {
    return;
  }

  if (attackFrameOffset % shotIntervalFrames !== 0) {
    return;
  }

  if (attackFrameOffset / shotIntervalFrames >= shotCount) {
    return;
  }

  const minimumDistance = config.width * projectile.minimumDistanceRatio;
  const maximumDistance = projectile.maximumDistanceRatio == null
    ? undefined
    : config.width * projectile.maximumDistanceRatio;
  const opponentAimPoint = getFighterAimPoint(opponent, opponentDefinition);
  const spawnX = projectile.spawnAnchor === "opponent"
    ? opponentAimPoint.x + projectile.offsetX
    : fighter.x + fighter.facing * projectile.offsetX;
  const spawnY = projectile.spawnAnchor === "opponent"
    ? opponentAimPoint.y + projectile.offsetY
    : fighter.y + projectile.offsetY;

  let velocityX = projectile.speed * fighter.facing;
  let velocityY = 0;
  let gravity = 0;
  let facing = fighter.facing;

  if (projectile.targeting === "opponent") {
    const deltaX = opponentAimPoint.x - spawnX;
    const deltaY = opponentAimPoint.y - spawnY;
    const magnitude = Math.max(0.0001, Math.hypot(deltaX, deltaY));
    velocityX = (deltaX / magnitude) * projectile.speed;
    velocityY = (deltaY / magnitude) * projectile.speed;
    facing = velocityX >= 0 ? 1 : -1;
  } else {
    const travelFrames = Math.max(1, minimumDistance / projectile.speed);
    const referenceSpawnY = config.groundY + projectile.offsetY;
    const landingY = getProjectileLandingY(projectile, config, referenceSpawnY);
    const verticalMotion = getProjectileVerticalMotion(
      referenceSpawnY,
      landingY,
      projectile.apexHeight,
      travelFrames,
    );

    velocityY = verticalMotion.velocityY;
    gravity = verticalMotion.gravity;
  }

  state.projectiles.push({
    id: state.nextProjectileId,
    ownerSlot: fighter.slot,
    ownerFighterId: fighter.fighterId,
    moveId: move.id,
    sprite: projectile.sprite,
    tier: projectile.tier,
    spriteScale: projectile.spriteScale,
    x: spawnX,
    y: spawnY,
    vx: velocityX,
    vy: velocityY,
    gravity,
    facing,
    originX: spawnX,
    minimumDistance,
    maximumDistance,
    hitbox: projectile.hitbox,
  });
  state.nextProjectileId += 1;
}

function getProjectileLandingY(
  projectile: NonNullable<CharacterDefinition["moves"][string]["projectile"]>,
  config: MatchConfig,
  referenceSpawnY: number,
) {
  if (projectile.landing === "floor") {
    return config.groundY - projectile.hitbox.y - projectile.hitbox.height;
  }

  return referenceSpawnY;
}

function getProjectileVerticalMotion(
  spawnY: number,
  landingY: number,
  apexHeight: number,
  travelFrames: number,
) {
  if (apexHeight <= 0) {
    return {
      velocityY: (landingY - spawnY) / travelFrames,
      gravity: 0,
    };
  }

  const peakY = Math.min(spawnY, landingY) - apexHeight;
  const peakRise = spawnY - peakY;
  const landingDelta = landingY - spawnY;
  const vertexFrame = Math.abs(landingDelta) < 0.0001
    ? travelFrames / 2
    : (travelFrames * (Math.sqrt(peakRise * (peakRise + landingDelta)) - peakRise)) / landingDelta;
  const safeVertexFrame = Math.max(0.0001, vertexFrame);
  const gravity = (2 * peakRise) / (safeVertexFrame * safeVertexFrame);

  return {
    velocityY: -gravity * (safeVertexFrame + 0.5),
    gravity,
  };
}

function updateLocomotion(fighter: FighterRuntimeState, definition: CharacterDefinition, input: InputState) {
  const direction = Number(input.right) - Number(input.left);

  if (fighter.grounded && input.up && !fighter.lastInput.up) {
    cancelDash(fighter);
    fighter.vy = -definition.stats.movement.jumpVelocity;
    fighter.grounded = false;
    fighter.action = "jump";
    return;
  }

  const tappedLeft = input.left && !fighter.lastInput.left && !input.right;
  const tappedRight = input.right && !fighter.lastInput.right && !input.left;
  if (fighter.grounded) {
    if (tappedLeft) {
      registerDashTap(fighter, definition, -1);
    } else if (tappedRight) {
      registerDashTap(fighter, definition, 1);
    }
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

  if (!fighter.grounded) {
    if (fighter.action === "dash") {
      fighter.vx = 0;
    }
    fighter.action = "jump";
    return;
  }

  fighter.vx = direction * definition.stats.movement.walkSpeed;
  if (direction !== 0) {
    fighter.action = "walk";
  } else {
    fighter.action = "idle";
    fighter.vx *= 0.75;
  }
}

function registerDashTap(fighter: FighterRuntimeState, definition: CharacterDefinition, direction: Facing) {
  const withinWindow = fighter.lastTapDirection === direction && fighter.lastTapFrame <= DASH_TAP_WINDOW_FRAMES;

  if (withinWindow) {
    fighter.dashDirection = direction;
    fighter.dashFramesRemaining = getDashDurationFrames(definition);
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
  return definition.stats.movement.dash.speed;
}

export function getDashDurationFrames(definition: CharacterDefinition) {
  return Math.max(
    1,
    Math.round(
      definition.stats.movement.dash.distance /
        definition.stats.movement.dash.speed,
    ),
  );
}

function updateProjectiles(state: MatchState, config: MatchConfig) {
  state.projectiles = state.projectiles.filter((projectile) => {
    projectile.vy += projectile.gravity;
    projectile.x += projectile.vx;
    projectile.y += projectile.vy;

    const worldHitbox = toWorldProjectileBox(projectile, projectile.hitbox);
    const travelDistance = Math.abs(projectile.x - projectile.originX);
    const reachedGround = worldHitbox.y + worldHitbox.height >= config.groundY;
    const reachedMaximumDistance = projectile.maximumDistance != null &&
      travelDistance >= projectile.maximumDistance;
    const leftArena =
      worldHitbox.x + worldHitbox.width < 0 ||
      worldHitbox.x > config.width ||
      worldHitbox.y > config.height;

    return !reachedGround && !reachedMaximumDistance && !leftArena;
  });
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

function getChipDamage(hitbox: HitBox) {
  return hitbox.chipDamage ?? Math.max(1, Math.round(hitbox.damage * DEFAULT_CHIP_DAMAGE_RATIO));
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

function holdsBackInput(input: InputState, facing: Facing) {
  if (input.guard) {
    return true;
  }

  return facing === 1
    ? input.left && !input.right
    : input.right && !input.left;
}

function isGroundedNeutralState(fighter: FighterRuntimeState) {
  return fighter.grounded &&
    fighter.health > 0 &&
    fighter.hitstun === 0 &&
    fighter.invulnerableFrames === 0 &&
    fighter.juggleState == null &&
    !fighter.attackId &&
    fighter.action !== "dash" &&
    fighter.action !== "jump" &&
    fighter.action !== "ko";
}

function hasNearbyMeleeBlockThreat(
  attacker: FighterRuntimeState,
  defender: FighterRuntimeState,
  attackerDef: CharacterDefinition,
  defenderDef: CharacterDefinition,
) {
  if (!attacker.attackId || attacker.attackConnected) {
    return false;
  }

  const move = attackerDef.moves[attacker.attackId];
  if (!move) {
    return false;
  }

  const activeStart = move.startup;
  const activeEnd = move.startup + move.active - 1;
  if (attacker.attackFrame < activeStart || attacker.attackFrame > activeEnd) {
    return false;
  }

  const hurtboxes = getHurtboxes(defender, defenderDef);
  for (const hitbox of getMoveFrameHitboxes(move, attacker.attackFrame)) {
    const worldHitbox = toWorldBox(
      attacker,
      applyMeleeRangeToHitbox(move, hitbox),
    );

    for (const hurtbox of hurtboxes) {
      if (intersects(worldHitbox, hurtbox)) {
        return true;
      }

      const verticallyAligned =
        worldHitbox.y < hurtbox.y + hurtbox.height + 12 &&
        worldHitbox.y + worldHitbox.height > hurtbox.y - 12;
      if (!verticallyAligned) {
        continue;
      }

      if (getHorizontalBoxGap(worldHitbox, hurtbox) <= BLOCK_MELEE_THREAT_GAP) {
        return true;
      }
    }
  }

  return false;
}

function hasNearbyProjectileBlockThreat(
  state: MatchState,
  defender: FighterRuntimeState,
  defenderDef: CharacterDefinition,
) {
  const hurtboxes = getHurtboxes(defender, defenderDef);
  for (const projectile of state.projectiles) {
    if (projectile.ownerSlot === defender.slot) {
      continue;
    }

    const projectileBox = toWorldProjectileBox(projectile, projectile.hitbox);
    const projectileCenterX = projectileBox.x + projectileBox.width * 0.5;
    const movingTowardDefender = hurtboxes.some((hurtbox) => {
      const hurtboxCenterX = hurtbox.x + hurtbox.width * 0.5;
      return (hurtboxCenterX - projectileCenterX) * projectile.vx > 0;
    });

    if (!movingTowardDefender && !hurtboxes.some((hurtbox) => intersects(projectileBox, hurtbox))) {
      continue;
    }

    for (const hurtbox of hurtboxes) {
      const verticallyAligned =
        projectileBox.y < hurtbox.y + hurtbox.height + 18 &&
        projectileBox.y + projectileBox.height > hurtbox.y - 18;
      if (!verticallyAligned) {
        continue;
      }

      const horizontalGap = getHorizontalBoxGap(projectileBox, hurtbox);
      const framesUntilImpact = horizontalGap / Math.max(0.0001, Math.abs(projectile.vx));
      if (horizontalGap === 0 || framesUntilImpact <= BLOCK_PROJECTILE_THREAT_FRAMES) {
        return true;
      }
    }
  }

  return false;
}

function updateDefensiveGuardState(
  state: MatchState,
  fighter: FighterRuntimeState,
  opponent: FighterRuntimeState,
  fighterDef: CharacterDefinition,
  opponentDef: CharacterDefinition,
  input: InputState,
) {
  if (!isGroundedNeutralState(fighter) || !holdsBackInput(input, fighter.facing)) {
    return;
  }

  const shouldGuard =
    hasNearbyMeleeBlockThreat(opponent, fighter, opponentDef, fighterDef) ||
    hasNearbyProjectileBlockThreat(state, fighter, fighterDef);

  if (!shouldGuard) {
    return;
  }

  fighter.action = "guard";
  fighter.vx = 0;
  fighter.vy = 0;
  cancelDash(fighter);
}

function canBlockIncomingHit(defender: FighterRuntimeState, attackerFacing: Facing) {
  return defender.action === "guard" &&
    defender.grounded &&
    defender.health > 0 &&
    defender.facing === -attackerFacing;
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

  const hitboxes = getMoveFrameHitboxes(move, attacker.attackFrame);
  const hurtboxes = getHurtboxes(defender, defenderDef);

  for (const hitbox of hitboxes) {
    const worldHitbox = toWorldBox(
      attacker,
      applyMeleeRangeToHitbox(move, hitbox),
    );
    const collision = hurtboxes.some((hurtbox) => intersects(worldHitbox, hurtbox));
    if (!collision) {
      continue;
    }

    if (canBlockIncomingHit(defender, attacker.facing)) {
      defender.health = Math.max(0, defender.health - getChipDamage(hitbox));
      defender.hitstun = 0;
      defender.vx = 0;
      defender.vy = 0;
      defender.grounded = true;
      defender.juggleState = null;
      defender.invulnerableFrames = 0;
      defender.action = defender.health <= 0 ? "ko" : "guard";
      attacker.attackConnected = true;
      unlockFollowUpMove(attacker, move);
      attacker.meter = Math.min(100, attacker.meter + 12);
      state.events.push(`${defender.name} blocked ${move.label}`);
      return;
    }

    interruptAttack(defender);
    defender.health = Math.max(0, defender.health - hitbox.damage);
    defender.hitstun = hitbox.hitstun;
    defender.vx = hitbox.knockbackX * attacker.facing;
    defender.vy = -(hitbox.launchY ?? 0);
    defender.grounded = defender.vy === 0;
    if (defender.health <= 0) {
      defender.juggleState = null;
      defender.invulnerableFrames = 0;
      clearComboState(defender);
      defender.action = "ko";
    } else {
      const launchY = hitbox.launchY ?? 0;
      defender.juggleState = shouldEnterJuggle(defender, launchY)
        ? "airborne"
        : null;
      defender.invulnerableFrames = 0;
      defender.action = "hit";
      registerComboHit(attacker, defender);
    }
    attacker.attackConnected = true;
    unlockFollowUpMove(attacker, move);
    attacker.meter = Math.min(100, attacker.meter + 12);
    state.events.push(`${attacker.name} landed ${move.label}`);
    return;
  }
}

function resolveAttackProjectileClashes(
  state: MatchState,
  attacker: FighterRuntimeState,
  attackerDef: CharacterDefinition,
) {
  if (!attacker.attackId || state.status !== "fighting" || state.projectiles.length === 0) {
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

  const hitboxes = getMoveFrameHitboxes(move, attacker.attackFrame);
  if (hitboxes.length === 0) {
    return;
  }

  const attackHitboxes = hitboxes.map((hitbox) =>
    toWorldBox(attacker, applyMeleeRangeToHitbox(move, hitbox))
  );
  const destroyedProjectileIds = new Set<number>();

  for (const projectile of state.projectiles) {
    if (projectile.ownerSlot === attacker.slot || projectile.tier > DEFAULT_ATTACK_PROJECTILE_TIER) {
      continue;
    }

    const projectileHitbox = toWorldProjectileBox(projectile, projectile.hitbox);
    if (attackHitboxes.some((attackHitbox) => intersects(attackHitbox, projectileHitbox))) {
      destroyedProjectileIds.add(projectile.id);
    }
  }

  if (destroyedProjectileIds.size > 0) {
    state.projectiles = state.projectiles.filter(
      (projectile) => !destroyedProjectileIds.has(projectile.id),
    );
  }
}

function resolveProjectileClashes(state: MatchState) {
  if (state.projectiles.length <= 1) {
    return;
  }

  const destroyedProjectileIds = new Set<number>();

  for (let index = 0; index < state.projectiles.length; index += 1) {
    const current = state.projectiles[index];
    if (destroyedProjectileIds.has(current.id)) {
      continue;
    }

    const currentHitbox = toWorldProjectileBox(current, current.hitbox);

    for (let otherIndex = index + 1; otherIndex < state.projectiles.length; otherIndex += 1) {
      const other = state.projectiles[otherIndex];
      if (destroyedProjectileIds.has(other.id)) {
        continue;
      }

      const otherHitbox = toWorldProjectileBox(other, other.hitbox);
      if (!intersects(currentHitbox, otherHitbox)) {
        continue;
      }

      if (current.tier === other.tier) {
        destroyedProjectileIds.add(current.id);
        destroyedProjectileIds.add(other.id);
      } else if (current.tier < other.tier) {
        destroyedProjectileIds.add(current.id);
      } else {
        destroyedProjectileIds.add(other.id);
      }

      if (destroyedProjectileIds.has(current.id)) {
        break;
      }
    }
  }

  if (destroyedProjectileIds.size > 0) {
    state.projectiles = state.projectiles.filter(
      (projectile) => !destroyedProjectileIds.has(projectile.id),
    );
  }
}

function resolveProjectileHits(
  state: MatchState,
  roster: Record<string, CharacterDefinition>,
) {
  if (state.status !== "fighting" || state.projectiles.length === 0) {
    return;
  }

  const survivingProjectiles: ProjectileRuntimeState[] = [];

  for (const projectile of state.projectiles) {
    const attacker = state.fighters[projectile.ownerSlot - 1];
    const defender = state.fighters[projectile.ownerSlot === 1 ? 1 : 0];
    const defenderDef = roster[defender.fighterId];
    const attackerDef = roster[projectile.ownerFighterId];
    const move = attackerDef?.moves[projectile.moveId];
    const projectileHitbox = toWorldProjectileBox(projectile, projectile.hitbox);
    const hurtboxes = getHurtboxes(defender, defenderDef);
    const collision = hurtboxes.some((hurtbox) => intersects(projectileHitbox, hurtbox));

    if (!collision) {
      survivingProjectiles.push(projectile);
      continue;
    }

    if (canBlockIncomingHit(defender, projectile.facing)) {
      defender.health = Math.max(0, defender.health - getChipDamage(projectile.hitbox));
      defender.hitstun = 0;
      defender.vx = 0;
      defender.vy = 0;
      defender.grounded = true;
      defender.juggleState = null;
      defender.invulnerableFrames = 0;
      defender.action = defender.health <= 0 ? "ko" : "guard";
      unlockFollowUpMove(attacker, move);
      if (move) {
        state.events.push(`${defender.name} blocked ${move.label}`);
      }
      continue;
    }

    interruptAttack(defender);
    defender.health = Math.max(0, defender.health - projectile.hitbox.damage);
    defender.hitstun = projectile.hitbox.hitstun;
    defender.vx = projectile.hitbox.knockbackX * projectile.facing;
    defender.vy = -(projectile.hitbox.launchY ?? 0);
    defender.grounded = defender.vy === 0;
    if (defender.health <= 0) {
      defender.juggleState = null;
      defender.invulnerableFrames = 0;
      clearComboState(defender);
      defender.action = "ko";
    } else {
      const launchY = projectile.hitbox.launchY ?? 0;
      defender.juggleState = shouldEnterJuggle(defender, launchY)
        ? "airborne"
        : null;
      defender.invulnerableFrames = 0;
      defender.action = "hit";
      registerComboHit(attacker, defender);
    }
    attacker.meter = Math.min(100, attacker.meter + 12);
    unlockFollowUpMove(attacker, move);
    if (move) {
      state.events.push(`${attacker.name} landed ${move.label}`);
    }
  }

  state.projectiles = survivingProjectiles;
}

function getHurtboxes(fighter: FighterRuntimeState, definition: CharacterDefinition): Box[] {
  if (fighter.action === "dash" || fighter.invulnerableFrames > 0) {
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

function getMoveFrameHitboxes(
  move: NonNullable<CharacterDefinition["moves"][string]>,
  attackFrame: number,
) {
  return move.frameBoxes?.[attackFrame]?.hitboxes ?? [];
}

function applyMeleeRangeToHitbox<T extends Box>(
  move: NonNullable<CharacterDefinition["moves"][string]>,
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

function toWorldBox(fighter: FighterRuntimeState, box: Box): Box {
  const mirroredX = fighter.facing === 1 ? box.x : -(box.x + box.width);
  return {
    x: fighter.x + mirroredX,
    y: fighter.y + box.y,
    width: box.width,
    height: box.height,
  };
}

function toWorldProjectileBox(projectile: ProjectileRuntimeState, box: Box): Box {
  const mirroredX = projectile.facing === 1 ? box.x : -(box.x + box.width);
  return {
    x: projectile.x + mirroredX,
    y: projectile.y + box.y,
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

function startRoundOver(state: MatchState) {
  state.status = "round-over";
  state.roundOverFramesRemaining = ROUND_OVER_MIN_FRAMES;
  state.projectiles = [];
}
