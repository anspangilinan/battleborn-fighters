import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_CONFIG, EMPTY_INPUT, createMatchState, decodeInput, encodeInput, getDashDurationFrames, getMoveCooldownFrames, getMoveMeleeRange, stepMatch } from "./engine";
import type { CharacterDefinition } from "./types";

const fighter: CharacterDefinition = {
  id: "test-fighter",
  name: "Test Fighter",
  style: "Balanced",
  palette: {
    primary: "#ff0000",
    accent: "#00ff00",
    shadow: "#000000",
  },
  sprites: {
    portrait: "/test.svg",
  },
  stats: {
    maxHealth: 1000,
    movement: {
      walkSpeed: 5,
      jumpVelocity: 18,
      gravity: 1,
      dash: {
        distance: 80,
        speed: 10,
        lift: 0,
      },
    },
    pushWidth: 20,
  },
  standingBoxes: {
    hurtboxes: [{ x: -18, y: -96, width: 36, height: 96 }],
  },
  jumpingBoxes: {
    hurtboxes: [{ x: -20, y: -88, width: 40, height: 88 }],
  },
  moves: {
    punch: {
      id: "punch",
      label: "Punch",
      button: "punch",
      startup: 1,
      active: 2,
      recovery: 4,
      frameBoxes: {
        1: {
          hitboxes: [{ x: 8, y: -72, width: 18, height: 14, damage: 50, hitstun: 8, knockbackX: 5 }],
        },
      },
    },
    kick: {
      id: "kick",
      label: "Kick",
      button: "kick",
      startup: 3,
      active: 2,
      recovery: 6,
      frameBoxes: {
        3: {
          hitboxes: [{ x: 12, y: -60, width: 26, height: 16, damage: 70, hitstun: 10, knockbackX: 7 }],
        },
      },
    },
    special: {
      id: "special",
      label: "Special",
      button: "special",
      startup: 5,
      active: 3,
      recovery: 12,
      rootVelocityX: 3,
      frameBoxes: {
        5: {
          hitboxes: [{ x: 18, y: -76, width: 24, height: 18, damage: 110, hitstun: 14, knockbackX: 10, launchY: 6 }],
        },
      },
    },
  },
};

function createOffPathDummy(id: string): CharacterDefinition {
  return {
    ...fighter,
    id,
    standingBoxes: {
      hurtboxes: [{ x: -1, y: -240, width: 2, height: 2 }],
    },
    jumpingBoxes: {
      hurtboxes: [{ x: -1, y: -240, width: 2, height: 2 }],
    },
  };
}

const projectileFighter: CharacterDefinition = {
  ...fighter,
  id: "projectile-fighter",
  name: "Projectile Fighter",
  moves: {
    ...fighter.moves,
    punch: {
      ...fighter.moves.punch,
      label: "Bolt Shot",
      startup: 3,
      active: 1,
      recovery: 8,
      frameBoxes: undefined,
      projectile: {
        sprite: "crossbow-bolt",
        tier: 1,
        offsetX: 20,
        offsetY: -72,
        speed: 12,
        minimumDistanceRatio: 0.8,
        apexHeight: 67,
        landing: "floor",
        hitbox: {
          x: -18,
          y: -4,
          width: 36,
          height: 8,
          damage: 55,
          hitstun: 9,
          knockbackX: 6,
        },
      },
    },
  },
};

const highTierProjectileFighter: CharacterDefinition = {
  ...projectileFighter,
  id: "high-tier-projectile-fighter",
  name: "High Tier Projectile Fighter",
  moves: {
    ...projectileFighter.moves,
    punch: {
      ...projectileFighter.moves.punch,
      projectile: {
        ...projectileFighter.moves.punch.projectile!,
        tier: 2,
      },
    },
  },
};

const fastProjectileFighter: CharacterDefinition = {
  ...projectileFighter,
  id: "fast-projectile-fighter",
  name: "Fast Projectile Fighter",
  moves: {
    ...projectileFighter.moves,
    punch: {
      ...projectileFighter.moves.punch,
      projectile: {
        ...projectileFighter.moves.punch.projectile!,
        speed: 18,
      },
    },
  },
};

const cappedProjectileFighter: CharacterDefinition = {
  ...projectileFighter,
  id: "capped-projectile-fighter",
  name: "Capped Projectile Fighter",
  moves: {
    ...projectileFighter.moves,
    punch: {
      ...projectileFighter.moves.punch,
      projectile: {
        ...projectileFighter.moves.punch.projectile!,
        tier: 2,
        apexHeight: 0,
        landing: "origin",
        minimumDistanceRatio: 0.5,
        maximumDistanceRatio: 0.5,
      },
    },
  },
};

const cooldownFighter: CharacterDefinition = {
  ...fighter,
  id: "cooldown-fighter",
  name: "Cooldown Fighter",
  moves: {
    ...fighter.moves,
    punch: {
      ...fighter.moves.punch,
      cooldownSeconds: 0.5,
    },
  },
};

const extendedRangeFighter: CharacterDefinition = {
  ...fighter,
  id: "extended-range-fighter",
  name: "Extended Range Fighter",
  moves: {
    ...fighter.moves,
    punch: {
      ...fighter.moves.punch,
      meleeRange: 52,
    },
  },
};

test("input encoding round-trips", () => {
  const mask = encodeInput({ left: true, right: false, up: true, punch: true, kick: false, special: true });
  assert.deepEqual(decodeInput(mask), { left: true, right: false, up: true, punch: true, kick: false, special: true });
});

test("fighters take damage when an attack overlaps hurtboxes", () => {
  const roster = { [fighter.id]: fighter };
  let state = createMatchState(roster, fighter.id, fighter.id);
  state.countdownFrames = 0;
  state.status = "fighting";
  state.fighters[0].x = 420;
  state.fighters[1].x = 448;

  state = stepMatch(
    state,
    roster,
    { left: false, right: false, up: false, punch: true, kick: false, special: false },
    { left: false, right: false, up: false, punch: false, kick: false, special: false },
  );
  state = stepMatch(state, roster, { left: false, right: false, up: false, punch: false, kick: false, special: false }, { left: false, right: false, up: false, punch: false, kick: false, special: false });

  assert.equal(state.fighters[1].health, 950);
  assert.ok(state.events.some((entry) => entry.includes("landed Punch")));
});

test("configured melee range extends attack reach", () => {
  const baseRoster = { [fighter.id]: fighter };
  let baseState = createMatchState(baseRoster, fighter.id, fighter.id);
  baseState.countdownFrames = 0;
  baseState.status = "fighting";
  baseState.fighters[0].x = 420;
  baseState.fighters[1].x = 476;

  baseState = stepMatch(
    baseState,
    baseRoster,
    { left: false, right: false, up: false, punch: true, kick: false, special: false },
    EMPTY_INPUT,
  );
  baseState = stepMatch(baseState, baseRoster, EMPTY_INPUT, EMPTY_INPUT);

  assert.equal(baseState.fighters[1].health, fighter.stats.maxHealth);

  const rangedRoster = {
    [extendedRangeFighter.id]: extendedRangeFighter,
    [fighter.id]: fighter,
  };
  let rangedState = createMatchState(rangedRoster, extendedRangeFighter.id, fighter.id);
  rangedState.countdownFrames = 0;
  rangedState.status = "fighting";
  rangedState.fighters[0].x = 420;
  rangedState.fighters[1].x = 476;

  rangedState = stepMatch(
    rangedState,
    rangedRoster,
    { left: false, right: false, up: false, punch: true, kick: false, special: false },
    EMPTY_INPUT,
  );
  rangedState = stepMatch(rangedState, rangedRoster, EMPTY_INPUT, EMPTY_INPUT);

  assert.equal(getMoveMeleeRange(extendedRangeFighter.moves.punch), 52);
  assert.equal(rangedState.fighters[1].health, fighter.stats.maxHealth - 50);
  assert.ok(rangedState.events.some((entry) => entry.includes("landed Punch")));
});

test("move cooldowns block attacks until the configured frames expire", () => {
  const roster = {
    [cooldownFighter.id]: cooldownFighter,
    [fighter.id]: fighter,
  };
  let state = createMatchState(roster, cooldownFighter.id, fighter.id);
  state.countdownFrames = 0;
  state.status = "fighting";

  state = stepMatch(
    state,
    roster,
    { left: false, right: false, up: false, punch: true, kick: false, special: false },
    EMPTY_INPUT,
  );

  const expectedCooldownFrames = getMoveCooldownFrames(cooldownFighter.moves.punch);
  assert.equal(state.fighters[0].attackId, "punch");
  assert.equal(state.fighters[0].moveCooldownFrames.punch, expectedCooldownFrames);

  for (let index = 0; index < 12 && state.fighters[0].attackId; index += 1) {
    state = stepMatch(state, roster, EMPTY_INPUT, EMPTY_INPUT);
  }

  assert.equal(state.fighters[0].attackId, null);
  assert.ok(state.fighters[0].moveCooldownFrames.punch > 0);

  state = stepMatch(
    state,
    roster,
    { left: false, right: false, up: false, punch: true, kick: false, special: false },
    EMPTY_INPUT,
  );

  assert.equal(state.fighters[0].attackId, null);

  for (let index = 0; index < expectedCooldownFrames && state.fighters[0].moveCooldownFrames.punch > 0; index += 1) {
    state = stepMatch(state, roster, EMPTY_INPUT, EMPTY_INPUT);
  }

  assert.equal(state.fighters[0].moveCooldownFrames.punch, 0);

  state = stepMatch(
    state,
    roster,
    { left: false, right: false, up: false, punch: true, kick: false, special: false },
    EMPTY_INPUT,
  );

  assert.equal(state.fighters[0].attackId, "punch");
});

test("fighters can dash with a quick double tap", () => {
  const roster = { [fighter.id]: fighter };
  let state = createMatchState(roster, fighter.id, fighter.id);
  state.countdownFrames = 0;
  state.status = "fighting";

  state = stepMatch(
    state,
    roster,
    { left: true, right: false, up: false, punch: false, kick: false, special: false },
    { left: false, right: false, up: false, punch: false, kick: false, special: false },
  );
  state = stepMatch(
    state,
    roster,
    { left: false, right: false, up: false, punch: false, kick: false, special: false },
    { left: false, right: false, up: false, punch: false, kick: false, special: false },
  );
  state = stepMatch(
    state,
    roster,
    { left: true, right: false, up: false, punch: false, kick: false, special: false },
    { left: false, right: false, up: false, punch: false, kick: false, special: false },
  );

  assert.equal(state.fighters[0].action, "dash");
  assert.equal(state.fighters[0].vx, -fighter.stats.movement.dash.speed);
  assert.equal(state.fighters[0].dashFramesRemaining, getDashDurationFrames(fighter) - 1);
  assert.equal(state.fighters[0].grounded, true);
});

test("dash lift is visual only and keeps fighters grounded", () => {
  const liftedFighter: CharacterDefinition = {
    ...fighter,
    id: "lifted-fighter",
    stats: {
      ...fighter.stats,
      movement: {
        ...fighter.stats.movement,
        dash: {
          ...fighter.stats.movement.dash,
          lift: 4,
        },
      },
    },
  };
  const roster = { [liftedFighter.id]: liftedFighter };
  let state = createMatchState(roster, liftedFighter.id, liftedFighter.id);
  state.countdownFrames = 0;
  state.status = "fighting";

  state = stepMatch(
    state,
    roster,
    { left: true, right: false, up: false, punch: false, kick: false, special: false },
    EMPTY_INPUT,
  );
  state = stepMatch(state, roster, EMPTY_INPUT, EMPTY_INPUT);
  state = stepMatch(
    state,
    roster,
    { left: true, right: false, up: false, punch: false, kick: false, special: false },
    EMPTY_INPUT,
  );

  assert.equal(state.fighters[0].action, "dash");
  assert.equal(state.fighters[0].grounded, true);
  assert.equal(state.fighters[0].y, DEFAULT_CONFIG.groundY);
  assert.equal(state.fighters[0].vy, 0);
});

test("fighters can jump out of a floating dash if jump is unused", () => {
  const liftedFighter: CharacterDefinition = {
    ...fighter,
    id: "lifted-fighter",
    stats: {
      ...fighter.stats,
      movement: {
        ...fighter.stats.movement,
        dash: {
          ...fighter.stats.movement.dash,
          lift: 4,
        },
      },
    },
  };
  const roster = { [liftedFighter.id]: liftedFighter };
  let state = createMatchState(roster, liftedFighter.id, liftedFighter.id);
  state.countdownFrames = 0;
  state.status = "fighting";

  state = stepMatch(
    state,
    roster,
    { left: true, right: false, up: false, punch: false, kick: false, special: false },
    EMPTY_INPUT,
  );
  state = stepMatch(state, roster, EMPTY_INPUT, EMPTY_INPUT);
  state = stepMatch(
    state,
    roster,
    { left: true, right: false, up: false, punch: false, kick: false, special: false },
    EMPTY_INPUT,
  );
  state = stepMatch(
    state,
    roster,
    { left: false, right: false, up: true, punch: false, kick: false, special: false },
    EMPTY_INPUT,
  );

  assert.equal(state.fighters[0].action, "jump");
  assert.equal(state.fighters[0].dashFramesRemaining, 0);
  assert.equal(state.fighters[0].grounded, false);
  assert.ok(state.fighters[0].y < DEFAULT_CONFIG.groundY);
  assert.ok(state.fighters[0].vy < 0);
});

test("fighters can jump over each other and switch facing after crossing", () => {
  const roster = { [fighter.id]: fighter };
  let state = createMatchState(roster, fighter.id, fighter.id);
  state.countdownFrames = 0;
  state.status = "fighting";
  state.fighters[0].x = 420;
  state.fighters[1].x = 460;

  state = stepMatch(
    state,
    roster,
    { left: false, right: true, up: false, punch: false, kick: false, special: false },
    EMPTY_INPUT,
  );
  state = stepMatch(
    state,
    roster,
    { left: false, right: true, up: true, punch: false, kick: false, special: false },
    EMPTY_INPUT,
  );

  for (let index = 0; index < 10 && state.fighters[0].x <= state.fighters[1].x; index += 1) {
    state = stepMatch(state, roster, EMPTY_INPUT, EMPTY_INPUT);
  }

  assert.ok(state.fighters[0].x > state.fighters[1].x);
  assert.equal(state.fighters[0].facing, -1);
  assert.equal(state.fighters[1].facing, 1);
});

test("dash grants invulnerability while active", () => {
  const roster = { [fighter.id]: fighter };
  let state = createMatchState(roster, fighter.id, fighter.id);
  state.countdownFrames = 0;
  state.status = "fighting";
  state.fighters[0].x = 420;
  state.fighters[1].x = 436;
  state.fighters[0].attackId = "punch";
  state.fighters[0].attackFrame = 0;
  state.fighters[0].action = "attack";
  state.fighters[1].action = "dash";
  state.fighters[1].dashDirection = 1;
  state.fighters[1].dashFramesRemaining = 2;

  state = stepMatch(state, roster, EMPTY_INPUT, EMPTY_INPUT);

  assert.equal(state.fighters[1].health, fighter.stats.maxHealth);
  assert.equal(state.fighters[1].hitstun, 0);
  assert.ok(!state.events.some((entry) => entry.includes("landed Punch")));
});

test("dash can pass through when its landing position is behind the opponent", () => {
  const roster = { [fighter.id]: fighter };
  let state = createMatchState(roster, fighter.id, fighter.id);
  state.countdownFrames = 0;
  state.status = "fighting";
  state.fighters[0].x = 433;
  state.fighters[1].x = 442;
  state.fighters[0].action = "dash";
  state.fighters[0].dashDirection = 1;
  state.fighters[0].dashFramesRemaining = 1;

  state = stepMatch(state, roster, EMPTY_INPUT, EMPTY_INPUT);

  assert.ok(state.fighters[0].x > state.fighters[1].x);
  assert.equal(state.fighters[0].facing, -1);
  assert.equal(state.fighters[1].facing, 1);
});

test("infinite timer configs do not tick down or end the round on time", () => {
  const roster = { [fighter.id]: fighter };
  const trainingConfig = { ...DEFAULT_CONFIG, roundSeconds: Number.POSITIVE_INFINITY };
  let state = createMatchState(roster, fighter.id, fighter.id, "Player One", "Player Two", trainingConfig);
  state.countdownFrames = 0;
  state.status = "fighting";

  state = stepMatch(state, roster, EMPTY_INPUT, EMPTY_INPUT, trainingConfig);

  assert.equal(state.timerFramesRemaining, Number.POSITIVE_INFINITY);
  assert.equal(state.status, "fighting");
});

test("projectile punches spawn an arcing shot that can hit at range", () => {
  const roster = {
    [projectileFighter.id]: projectileFighter,
    [fighter.id]: fighter,
  };
  let state = createMatchState(roster, projectileFighter.id, fighter.id);
  state.countdownFrames = 0;
  state.status = "fighting";
  state.fighters[0].x = 180;
  state.fighters[1].x = 920;

  state = stepMatch(
    state,
    roster,
    { left: false, right: false, up: false, punch: true, kick: false, special: false },
    EMPTY_INPUT,
  );

  for (let index = 0; index < 8 && state.projectiles.length === 0; index += 1) {
    state = stepMatch(state, roster, EMPTY_INPUT, EMPTY_INPUT);
  }

  assert.equal(state.projectiles.length, 1);
  assert.ok(state.projectiles[0].vx > 0);
  assert.ok(state.projectiles[0].vy < 0);

  for (let index = 0; index < 60 && state.fighters[1].health === fighter.stats.maxHealth; index += 1) {
    state = stepMatch(state, roster, EMPTY_INPUT, EMPTY_INPUT);
  }

  assert.equal(state.fighters[1].health, fighter.stats.maxHealth - 55);
  assert.ok(state.events.some((entry) => entry.includes("landed Bolt Shot")));
});

test("projectile apex height stays stable when speed changes", () => {
  function simulateProjectileArc(attacker: CharacterDefinition) {
    const offPathDummy = createOffPathDummy(`${attacker.id}-dummy`);
    const roster = {
      [attacker.id]: attacker,
      [offPathDummy.id]: offPathDummy,
    };
    let state = createMatchState(roster, attacker.id, offPathDummy.id);
    state.countdownFrames = 0;
    state.status = "fighting";
    state.fighters[0].x = 180;
    state.fighters[1].x = 920;

    state = stepMatch(
      state,
      roster,
      { left: false, right: false, up: false, punch: true, kick: false, special: false },
      EMPTY_INPUT,
    );

    let minY = Number.POSITIVE_INFINITY;
    let aliveFrames = 0;
    let hasSpawned = false;
    for (let index = 0; index < 90; index += 1) {
      state = stepMatch(state, roster, EMPTY_INPUT, EMPTY_INPUT);
      const projectile = state.projectiles[0];
      if (!projectile) {
        if (hasSpawned) {
          break;
        }

        continue;
      }

      hasSpawned = true;
      minY = Math.min(minY, projectile.y);
      aliveFrames += 1;
    }

    return { minY, aliveFrames };
  }

  const normalArc = simulateProjectileArc(projectileFighter);
  const fastArc = simulateProjectileArc(fastProjectileFighter);

  assert.ok(Math.abs(normalArc.minY - fastArc.minY) <= 2);
  assert.ok(fastArc.aliveFrames < normalArc.aliveFrames);
});

test("ground-launched floor projectiles reach the floor around their minimum distance", () => {
  const offPathDummy = createOffPathDummy("ground-arc-dummy");
  const roster = {
    [projectileFighter.id]: projectileFighter,
    [offPathDummy.id]: offPathDummy,
  };
  let state = createMatchState(roster, projectileFighter.id, offPathDummy.id);
  state.countdownFrames = 0;
  state.status = "fighting";
  state.fighters[0].x = 100;
  state.fighters[1].x = 920;

  state = stepMatch(
    state,
    roster,
    { left: false, right: false, up: false, punch: true, kick: false, special: false },
    EMPTY_INPUT,
  );

  let lastTravelDistance = 0;
  for (let index = 0; index < 90 && (state.projectiles.length > 0 || state.fighters[0].attackId); index += 1) {
    state = stepMatch(state, roster, EMPTY_INPUT, EMPTY_INPUT);
    const projectile = state.projectiles[0];
    if (!projectile) {
      continue;
    }

    lastTravelDistance = Math.abs(projectile.x - projectile.originX);
  }

  const minimumDistance =
    DEFAULT_CONFIG.width * projectileFighter.moves.punch.projectile!.minimumDistanceRatio;
  assert.equal(state.projectiles.length, 0);
  assert.ok(lastTravelDistance >= minimumDistance - projectileFighter.moves.punch.projectile!.speed * 1.5);
});

test("aerial floor projectiles travel past their minimum distance before disappearing", () => {
  const offPathDummy = createOffPathDummy("aerial-arc-dummy");
  const roster = {
    [projectileFighter.id]: projectileFighter,
    [offPathDummy.id]: offPathDummy,
  };
  let state = createMatchState(roster, projectileFighter.id, offPathDummy.id);
  state.countdownFrames = 0;
  state.status = "fighting";
  state.fighters[0].x = 100;
  state.fighters[0].y = DEFAULT_CONFIG.groundY - 180;
  state.fighters[0].grounded = false;
  state.fighters[0].action = "jump";
  state.fighters[1].x = 920;

  state = stepMatch(
    state,
    roster,
    { left: false, right: false, up: false, punch: true, kick: false, special: false },
    EMPTY_INPUT,
  );

  let lastTravelDistance = 0;
  for (let index = 0; index < 140 && (state.projectiles.length > 0 || state.fighters[0].attackId); index += 1) {
    state = stepMatch(state, roster, EMPTY_INPUT, EMPTY_INPUT);
    const projectile = state.projectiles[0];
    if (!projectile) {
      continue;
    }

    lastTravelDistance = Math.abs(projectile.x - projectile.originX);
  }

  const minimumDistance =
    DEFAULT_CONFIG.width * projectileFighter.moves.punch.projectile!.minimumDistanceRatio;
  assert.equal(state.projectiles.length, 0);
  assert.ok(lastTravelDistance > minimumDistance + projectileFighter.moves.punch.projectile!.speed);
});

test("straight projectiles can disperse at a fixed maximum distance", () => {
  const offPathDummy = createOffPathDummy("capped-arc-dummy");
  const roster = {
    [cappedProjectileFighter.id]: cappedProjectileFighter,
    [offPathDummy.id]: offPathDummy,
  };
  let state = createMatchState(roster, cappedProjectileFighter.id, offPathDummy.id);
  state.countdownFrames = 0;
  state.status = "fighting";
  state.fighters[0].x = 100;
  state.fighters[1].x = 920;

  state = stepMatch(
    state,
    roster,
    { left: false, right: false, up: false, punch: true, kick: false, special: false },
    EMPTY_INPUT,
  );

  let lastTravelDistance = 0;
  for (let index = 0; index < 90 && (state.projectiles.length > 0 || state.fighters[0].attackId); index += 1) {
    state = stepMatch(state, roster, EMPTY_INPUT, EMPTY_INPUT);
    const projectile = state.projectiles[0];
    if (!projectile) {
      continue;
    }

    lastTravelDistance = Math.abs(projectile.x - projectile.originX);
  }

  const maximumDistance =
    DEFAULT_CONFIG.width * cappedProjectileFighter.moves.punch.projectile!.maximumDistanceRatio!;
  assert.equal(state.projectiles.length, 0);
  assert.ok(lastTravelDistance >= maximumDistance - cappedProjectileFighter.moves.punch.projectile!.speed);
  assert.ok(lastTravelDistance <= maximumDistance + cappedProjectileFighter.moves.punch.projectile!.speed);
});

test("tier one projectiles can be broken by attacks", () => {
  const roster = {
    [projectileFighter.id]: projectileFighter,
    [fighter.id]: fighter,
  };
  let state = createMatchState(roster, projectileFighter.id, fighter.id);
  state.countdownFrames = 0;
  state.status = "fighting";
  state.fighters[0].x = 300;
  state.fighters[1].x = 460;
  state.projectiles = [
    {
      id: 1,
      ownerSlot: 1,
      ownerFighterId: projectileFighter.id,
      moveId: "punch",
      sprite: "crossbow-bolt",
      tier: 1,
      x: 440,
      y: 355,
      vx: 0,
      vy: 0,
      gravity: 0,
      facing: 1,
      originX: 440,
      minimumDistance: DEFAULT_CONFIG.width * 0.8,
      hitbox: {
        x: -18,
        y: -4,
        width: 36,
        height: 8,
        damage: 55,
        hitstun: 9,
        knockbackX: 6,
      },
    },
  ];
  state.nextProjectileId = 2;
  state.fighters[1].attackId = "punch";
  state.fighters[1].attackFrame = 0;
  state.fighters[1].action = "attack";

  state = stepMatch(state, roster, EMPTY_INPUT, EMPTY_INPUT);

  assert.equal(state.projectiles.length, 0);
  assert.equal(state.fighters[1].health, fighter.stats.maxHealth);
});

test("higher-tier projectiles break lower-tier projectiles on contact", () => {
  const roster = {
    [projectileFighter.id]: projectileFighter,
    [highTierProjectileFighter.id]: highTierProjectileFighter,
  };
  let state = createMatchState(
    roster,
    projectileFighter.id,
    highTierProjectileFighter.id,
  );
  state.countdownFrames = 0;
  state.status = "fighting";
  state.projectiles = [
    {
      id: 1,
      ownerSlot: 1,
      ownerFighterId: projectileFighter.id,
      moveId: "punch",
      sprite: "crossbow-bolt",
      tier: 1,
      x: 450,
      y: 340,
      vx: 0,
      vy: 0,
      gravity: 0,
      facing: 1,
      originX: 450,
      minimumDistance: DEFAULT_CONFIG.width * 0.8,
      hitbox: {
        x: -18,
        y: -4,
        width: 36,
        height: 8,
        damage: 55,
        hitstun: 9,
        knockbackX: 6,
      },
    },
    {
      id: 2,
      ownerSlot: 2,
      ownerFighterId: highTierProjectileFighter.id,
      moveId: "punch",
      sprite: "crossbow-bolt",
      tier: 2,
      x: 450,
      y: 340,
      vx: 0,
      vy: 0,
      gravity: 0,
      facing: -1,
      originX: 450,
      minimumDistance: DEFAULT_CONFIG.width * 0.8,
      hitbox: {
        x: -18,
        y: -4,
        width: 36,
        height: 8,
        damage: 55,
        hitstun: 9,
        knockbackX: 6,
      },
    },
  ];
  state.nextProjectileId = 3;

  state = stepMatch(state, roster, EMPTY_INPUT, EMPTY_INPUT);

  assert.equal(state.projectiles.length, 1);
  assert.equal(state.projectiles[0].tier, 2);
});
