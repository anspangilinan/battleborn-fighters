import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_CONFIG, EMPTY_INPUT, createMatchState, decodeInput, encodeInput, stepMatch } from "./engine";
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
    walkSpeed: 5,
    dashDistance: 80,
    jumpVelocity: 18,
    gravity: 1,
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
  assert.equal(state.fighters[0].vx, -(fighter.stats.dashDistance / 8));
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
