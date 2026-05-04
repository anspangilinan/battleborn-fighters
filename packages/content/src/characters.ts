import type { CharacterDefinition, HitBox } from '@battleborn/game-core';

function hitbox(hit: HitBox): HitBox {
  return hit;
}

const morana: CharacterDefinition = {
  id: 'morana',
  name: 'Morana',
  palette: {
    primary: '#37d4ff',
    accent: '#fff07f',
    shadow: '#0d2f44',
  },
  sprites: {
    portrait: '/characters/morana/portrait.png',
    renderHeight: 120,
  },
  bot: {
    aggressiveness: 0.42,
    arenaMovement: {
      preferredDistanceMultiplier: 1.18,
      approachBias: 0.34,
      retreatBias: 0.82,
      jumpInChance: 0.18,
      dashJumpForwardChance: 0.22,
      dashJumpBackwardChance: 0.76,
    },
    skillChoice: {
      punchWeight: 1.5,
      kickWeight: 0.85,
      specialWeight: 1.15,
      attackCadenceMultiplier: 1.02,
    },
    defense: {
      blockChance: 0.96,
      projectileDodgeChance: 0.68,
      meleeBlockReactionFrames: 1,
      projectileBlockReactionFrames: 6,
    },
  },
  stats: {
    maxHealth: 1000,
    movement: {
      walkSpeed: 5.5,
      jumpVelocity: 18,
      gravity: 1.1,
      dash: {
        distance: 92.4,
        speed: 6.55,
        lift: 8.2,
      },
    },
    pushWidth: 24,
  },
  standingBoxes: {
    hurtboxes: [{ x: -22, y: -110, width: 44, height: 110 }],
  },
  jumpingBoxes: {
    hurtboxes: [{ x: -24, y: -96, width: 48, height: 96 }],
  },
  moves: {
    punch: {
      id: 'punch',
      label: 'Q1',
      button: 'punch',
      startup: 3,
      active: 1,
      recovery: 9,
      cooldownSeconds: 1.2,
      projectile: {
        sprite: 'morana/iceball',
        tier: 2,
        offsetX: 24,
        offsetY: -55,
        speed: 8,
        minimumDistanceRatio: 0.5,
        maximumDistanceRatio: 0.5,
        apexHeight: 0,
        landing: 'origin',
        hitbox: hitbox({
          x: -16,
          y: -16,
          width: 32,
          height: 32,
          damage: 60,
          hitstun: 10,
          knockbackX: 7,
        }),
      },
    },
    kick: {
      id: 'kick',
      label: 'Flash Arc',
      button: 'kick',
      startup: 5,
      active: 3,
      recovery: 12,
      cooldownSeconds: 0.9,
      frameBoxes: {
        5: {
          hitboxes: [
            hitbox({
              x: 20,
              y: -72,
              width: 30,
              height: 18,
              damage: 85,
              hitstun: 12,
              knockbackX: 9,
              launchY: 4,
            }),
          ],
        },
      },
    },
    special: {
      id: 'special',
      label: 'Frost Barrage',
      button: 'special',
      startup: 10,
      active: 1,
      recovery: 60,
      cooldownSeconds: 1.6,
      interruptible: false,
      specialSequence: {
        buildUpFrames: 10,
        animationBuildUpFrames: 10,
        buildUpAnimation: 'special-pose',
        animationMode: 'loop',
        loopFrameDuration: 4,
        channelMoveSpeed: 3.2,
        hoverHeight: 10,
        zoomOutFrames: 6,
        zoomScale: 1.76,
      },
      projectile: {
        sprite: 'morana/special',
        tier: 2,
        spawnFrame: 11,
        shotCount: 3,
        shotIntervalFrames: 30,
        offsetX: 26,
        offsetY: -58,
        speed: 10.5,
        minimumDistanceRatio: 0.7,
        maximumDistanceRatio: 0.7,
        apexHeight: 0,
        landing: 'origin',
        hitbox: hitbox({
          x: -18,
          y: -18,
          width: 36,
          height: 36,
          damage: 42,
          hitstun: 9,
          knockbackX: 6,
        }),
      },
    },
  },
};

const mcbalut: CharacterDefinition = {
  id: 'mcbalut',
  name: 'mcbalut',
  palette: {
    primary: '#7de06e',
    accent: '#f6dd67',
    shadow: '#1d3b28',
  },
  sprites: {
    portrait: '/characters/mcbalut/portrait.png',
    renderHeight: 110,
  },
  bot: {
    aggressiveness: 1,
    arenaMovement: {
      preferredDistanceMultiplier: 0.72,
      approachBias: 1,
      retreatBias: 0,
      jumpInChance: 1,
      dashJumpForwardChance: 1,
      dashJumpBackwardChance: 1,
    },
    skillChoice: {
      punchWeight: 2,
      kickWeight: 2,
      specialWeight: 2,
      attackCadenceMultiplier: 0.7,
    },
    defense: {
      blockChance: 1,
      projectileDodgeChance: 1,
      meleeBlockReactionFrames: 2,
      projectileBlockReactionFrames: 8,
    },
  },
  stats: {
    maxHealth: 1020,
    movement: {
      walkSpeed: 3,
      jumpVelocity: 17,
      gravity: 1.08,
      dash: {
        distance: 108,
        speed: 13.5,
        lift: 3.4,
      },
    },
    pushWidth: 24,
  },
  standingBoxes: {
    hurtboxes: [{ x: -22, y: -110, width: 44, height: 110 }],
  },
  jumpingBoxes: {
    hurtboxes: [{ x: -24, y: -96, width: 48, height: 96 }],
  },
  moves: {
    punch: {
      id: 'punch',
      label: 'Q1',
      button: 'punch',
      startup: 5,
      active: 1,
      recovery: 11,
      cooldownSeconds: 1,
      projectile: {
        sprite: 'mcbalut/crossbow-bolt',
        tier: 1,
        offsetX: 42,
        offsetY: -60,
        speed: 17.75,
        minimumDistanceRatio: 0.55,
        apexHeight: 42,
        landing: 'floor',
        hitbox: hitbox({
          x: -18,
          y: -4,
          width: 36,
          height: 8,
          damage: 62,
          hitstun: 11,
          knockbackX: 8,
        }),
      },
    },
    kick: {
      id: 'kick',
      label: 'Prototype Arc',
      button: 'kick',
      startup: 6,
      active: 3,
      recovery: 12,
      cooldownSeconds: 0.9,
      frameBoxes: {
        6: {
          hitboxes: [
            hitbox({
              x: 20,
              y: -70,
              width: 30,
              height: 18,
              damage: 90,
              hitstun: 12,
              knockbackX: 10,
              launchY: 4,
            }),
          ],
        },
      },
    },
    special: {
      id: 'special',
      label: 'Prototype Burst',
      button: 'special',
      startup: 16,
      active: 2,
      recovery: 16,
      cooldownSeconds: 10,
      specialSequence: {
        buildUpFrames: 16,
        animationBuildUpFrames: 11,
        pauseFrames: 8,
        zoomOutFrames: 8,
        holdUntilGroundedAfterBuildUp: true,
        zoomScale: 1.88,
      },
      projectile: {
        sprite: 'mcbalut/crossbow-bolt',
        tier: 1,
        spawnFrame: 28,
        offsetX: 42,
        offsetY: -60,
        speed: 35.5,
        targeting: 'opponent',
        minimumDistanceRatio: 1,
        apexHeight: 0,
        landing: 'origin',
        hitbox: hitbox({
          x: -20,
          y: -5,
          width: 40,
          height: 10,
          damage: 115,
          hitstun: 18,
          knockbackX: 14,
        }),
      },
    },
  },
};

export const mcbalutAnomaly: CharacterDefinition = {
  id: 'mcbalut-anomaly',
  name: 'mcbalut',
  palette: {
    primary: '#7de06e',
    accent: '#f6dd67',
    shadow: '#1d3b28',
  },
  sprites: {
    portrait: '/characters/mcbalut-anomaly/profile.png',
    renderHeight: 128,
    assetRoot: 'mcbalut-anomaly',
    stanceAliases: {
      special: ['attack2'],
    },
  },
  bot: {
    aggressiveness: 1,
    arenaMovement: {
      preferredDistanceMultiplier: 1.04,
      approachBias: 0.78,
      retreatBias: 0.16,
      jumpInChance: 0.22,
      dashJumpForwardChance: 0.36,
      dashJumpBackwardChance: 0.18,
    },
    skillChoice: {
      punchWeight: 2.8,
      kickWeight: 2.5,
      specialWeight: 1.9,
      attackCadenceMultiplier: 0.4,
    },
    defense: {
      blockChance: 1,
      projectileDodgeChance: 1,
      meleeBlockReactionFrames: 1,
      projectileBlockReactionFrames: 2,
    },
  },
  stats: {
    maxHealth: 1060,
    movement: {
      walkSpeed: 6.2,
      jumpVelocity: 18.5,
      gravity: 1.02,
      dash: {
        distance: 138,
        speed: 15.5,
        lift: 4.4,
      },
    },
    pushWidth: 24,
  },
  standingBoxes: {
    hurtboxes: [{ x: -22, y: -110, width: 44, height: 110 }],
  },
  jumpingBoxes: {
    hurtboxes: [{ x: -24, y: -96, width: 48, height: 96 }],
  },
  moves: {
    punch: {
      id: 'punch',
      label: 'Anomaly Shot',
      button: 'punch',
      startup: 4,
      active: 1,
      recovery: 8,
      cooldownSeconds: 0.35,
      projectile: {
        sprite: 'mcbalut/crossbow-bolt',
        tier: 99,
        guardBypass: true,
        offsetX: 44,
        offsetY: -62,
        speed: 27,
        minimumDistanceRatio: 1,
        apexHeight: 0,
        landing: 'origin',
        hitbox: hitbox({
          x: -20,
          y: -5,
          width: 40,
          height: 10,
          damage: 82,
          hitstun: 13,
          knockbackX: 11,
        }),
      },
    },
    kick: {
      id: 'kick',
      label: 'Rift Splitter',
      button: 'kick',
      startup: 5,
      active: 1,
      recovery: 10,
      cooldownSeconds: 0.45,
      projectile: {
        sprite: 'mcbalut/crossbow-bolt',
        tier: 99,
        guardBypass: true,
        spriteScale: 1.25,
        offsetX: 46,
        offsetY: -58,
        speed: 32,
        minimumDistanceRatio: 1,
        apexHeight: 0,
        landing: 'origin',
        hitbox: hitbox({
          x: -24,
          y: -6,
          width: 48,
          height: 12,
          damage: 108,
          hitstun: 16,
          knockbackX: 14,
        }),
      },
    },
    special: {
      id: 'special',
      label: 'Anomaly Barrage',
      button: 'special',
      startup: 14,
      active: 2,
      recovery: 104,
      cooldownSeconds: 6.5,
      specialSequence: {
        buildUpFrames: 37,
        animationBuildUpFrames: 37,
        loopFrameDuration: 6,
        freezeOpponentDuringBuildUp: false,
        holdUntilGroundedAfterBuildUp: true,
        zoomScale: 1.9,
      },
      projectile: {
        sprite: 'characters/mcbalut-anomaly/animations/special-projectile',
        tier: 99,
        guardBypass: true,
        spawnFrame: 38,
        lifetimeFrames: 84,
        persistsOnHit: true,
        hitIntervalFrames: 60,
        spriteScale: 2.76,
        animationFrameDurationFrames: 6,
        offsetX: 518,
        offsetY: -60,
        speed: 0.001,
        targeting: 'forward',
        minimumDistanceRatio: 1,
        apexHeight: 0,
        landing: 'origin',
        hitbox: hitbox({
          x: -22,
          y: -6,
          width: 44,
          height: 12,
          damage: 78,
          chipDamage: 0,
          hitstun: 14,
          knockbackX: 10,
        }),
      },
    },
  },
};

const digv: CharacterDefinition = {
  id: 'digv',
  name: 'DigV',
  palette: {
    primary: '#7d8fff',
    accent: '#f2be67',
    shadow: '#1d2550',
  },
  sprites: {
    portrait: '/characters/digv/portrait.png',
    renderHeight: 100,
  },
  bot: {
    aggressiveness: 0.64,
    arenaMovement: {
      preferredDistanceMultiplier: 0.98,
      approachBias: 0.7,
      retreatBias: 0.4,
      jumpInChance: 0.46,
      dashJumpForwardChance: 0.62,
      dashJumpBackwardChance: 0.34,
    },
    skillChoice: {
      punchWeight: 1.1,
      kickWeight: 0.94,
      specialWeight: 1.28,
      attackCadenceMultiplier: 0.92,
    },
    defense: {
      blockChance: 0.86,
      projectileDodgeChance: 0.58,
      meleeBlockReactionFrames: 1,
      projectileBlockReactionFrames: 4,
    },
  },
  stats: {
    maxHealth: 1010,
    movement: {
      walkSpeed: 2.8,
      jumpVelocity: 17,
      gravity: 1.08,
      dash: {
        distance: 108.04,
        speed: 5.7,
        lift: 8.4,
      },
    },
    pushWidth: 24,
  },
  standingBoxes: {
    hurtboxes: [{ x: -22, y: -110, width: 44, height: 110 }],
  },
  jumpingBoxes: {
    hurtboxes: [{ x: -24, y: -96, width: 48, height: 96 }],
  },
  moves: {
    punch: {
      id: 'punch',
      label: 'Prototype Jab',
      button: 'punch',
      startup: 4,
      active: 1,
      recovery: 10,
      cooldownSeconds: 0.6,
      projectile: {
        sprite: 'digv/fireball',
        tier: 2,
        offsetX: 24,
        offsetY: -55,
        speed: 8,
        minimumDistanceRatio: 0.6,
        maximumDistanceRatio: 0.6,
        apexHeight: 0,
        landing: 'origin',
        hitbox: hitbox({
          x: -10.67,
          y: -10.67,
          width: 21.33,
          height: 21.33,
          damage: 65,
          hitstun: 10,
          knockbackX: 8,
        }),
      },
    },
    kick: {
      id: 'kick',
      label: 'Prototype Arc',
      button: 'kick',
      startup: 6,
      active: 3,
      recovery: 12,
      cooldownSeconds: 0.9,
      frameBoxes: {
        6: {
          hitboxes: [
            hitbox({
              x: 20,
              y: -70,
              width: 30,
              height: 18,
              damage: 90,
              hitstun: 12,
              knockbackX: 10,
              launchY: 4,
            }),
          ],
        },
      },
    },
    special: {
      id: 'special',
      label: 'Meteor Drop',
      button: 'special',
      startup: 10,
      active: 1,
      recovery: 18,
      cooldownSeconds: 0,
      specialSequence: {
        buildUpFrames: 10,
        pauseFrames: 6,
        zoomOutFrames: 7,
        completeAnimationDuringZoomOut: true,
        zoomScale: 1.82,
      },
      projectile: {
        sprite: 'digv/special',
        tier: 2,
        spriteScale: 2,
        spawnFrame: 11,
        spawnAnchor: 'opponent',
        offsetX: 0,
        offsetY: -240,
        speed: 24,
        targeting: 'opponent',
        minimumDistanceRatio: 1,
        apexHeight: 0,
        landing: 'origin',
        hitbox: hitbox({
          x: -22,
          y: -26,
          width: 44,
          height: 44,
          damage: 120,
          hitstun: 18,
          knockbackX: 12,
          launchY: 7,
        }),
      },
    },
  },
};

const paraktaktak: CharacterDefinition = {
  id: 'paraktaktak',
  name: 'ParakTakTak',
  palette: {
    primary: '#e3c25d',
    accent: '#f79642',
    shadow: '#403117',
  },
  sprites: {
    portrait: '/characters/paraktaktak/portrait.png',
    renderHeight: 135,
    stanceAliases: {
      special: ['attack2'],
    },
  },
  bot: {
    aggressiveness: 0.84,
    arenaMovement: {
      preferredDistanceMultiplier: 0.84,
      approachBias: 0.92,
      retreatBias: 0.16,
      jumpInChance: 0.82,
      dashJumpForwardChance: 0.9,
      dashJumpBackwardChance: 0.12,
    },
    skillChoice: {
      punchWeight: 1.4,
      kickWeight: 1.08,
      specialWeight: 0.92,
      attackCadenceMultiplier: 0.76,
    },
    defense: {
      blockChance: 0.74,
      projectileDodgeChance: 0.34,
      meleeBlockReactionFrames: 1,
      projectileBlockReactionFrames: 3,
    },
  },
  stats: {
    maxHealth: 1030,
    movement: {
      walkSpeed: 3.1,
      jumpVelocity: 17,
      gravity: 1.08,
      dash: {
        distance: 104,
        speed: 8.625,
        lift: 6,
      },
    },
    pushWidth: 24,
  },
  standingBoxes: {
    hurtboxes: [{ x: -22, y: -110, width: 44, height: 110 }],
  },
  jumpingBoxes: {
    hurtboxes: [{ x: -24, y: -96, width: 48, height: 96 }],
  },
  moves: {
    punch: {
      id: 'punch',
      label: 'Tak Strike',
      button: 'punch',
      startup: 4,
      active: 6,
      recovery: 10,
      cooldownSeconds: 0.55,
      meleeRange: 150,
      frameBoxes: {
        4: {
          hitboxes: [
            hitbox({
              x: 14,
              y: -82,
              width: 24,
              height: 16,
              damage: 90,
              hitstun: 10,
              knockbackX: 8,
            }),
          ],
        },
      },
    },
    kick: {
      id: 'kick',
      label: 'Parak Sweep',
      button: 'kick',
      startup: 6,
      active: 3,
      recovery: 12,
      cooldownSeconds: 0.85,
      meleeRange: 64,
      frameBoxes: {
        6: {
          hitboxes: [
            hitbox({
              x: 20,
              y: -70,
              width: 30,
              height: 18,
              damage: 90,
              hitstun: 12,
              knockbackX: 10,
              launchY: 4,
            }),
          ],
        },
      },
    },
    special: {
      id: 'special',
      label: 'Tak Breaker',
      button: 'special',
      startup: 8,
      active: 5,
      recovery: 15,
      cooldownSeconds: 1.45,
      meleeRange: 74,
      rootVelocityX: 4.6,
      frameBoxes: {
        8: {
          hitboxes: [
            hitbox({
              x: 24,
              y: -86,
              width: 34,
              height: 20,
              damage: 115,
              hitstun: 18,
              knockbackX: 14,
              launchY: 6,
            }),
          ],
          hurtboxes: [{ x: -20, y: -108, width: 52, height: 108 }],
        },
      },
    },
  },
};

const distorted: CharacterDefinition = {
  id: 'distorted',
  name: 'Distorted',
  palette: {
    primary: '#91b3ff',
    accent: '#f2d06a',
    shadow: '#1b1f36',
  },
  sprites: {
    portrait: '/characters/distorted09/animations/portrait.png',
    renderHeight: 108,
    assetRoot: 'distorted09',
    stanceAliases: {
      attack1: ['attack1a'],
      attack2: ['attack1b'],
    },
  },
  bot: {
    aggressiveness: 0.72,
    arenaMovement: {
      preferredDistanceMultiplier: 0.88,
      approachBias: 0.8,
      retreatBias: 0.22,
      jumpInChance: 0.54,
      dashJumpForwardChance: 0.7,
      dashJumpBackwardChance: 0.18,
    },
    skillChoice: {
      punchWeight: 1.16,
      kickWeight: 1.04,
      specialWeight: 1.18,
      attackCadenceMultiplier: 0.84,
    },
    defense: {
      blockChance: 0.74,
      projectileDodgeChance: 0.4,
      meleeBlockReactionFrames: 1,
      projectileBlockReactionFrames: 3,
    },
  },
  stats: {
    maxHealth: 990,
    movement: {
      walkSpeed: 4.35,
      jumpVelocity: 18.4,
      gravity: 1.06,
      dash: {
        distance: 114,
        speed: 9.5,
        lift: 6.2,
      },
    },
    pushWidth: 22,
  },
  standingBoxes: {
    hurtboxes: [{ x: -21, y: -104, width: 42, height: 104 }],
  },
  jumpingBoxes: {
    hurtboxes: [{ x: -23, y: -92, width: 46, height: 92 }],
  },
  moves: {
    punch: {
      id: 'punch',
      label: 'Glitch Jab',
      button: 'punch',
      startup: 4,
      active: 3,
      recovery: 9,
      cooldownSeconds: 0,
      animationStance: 'attack1',
      followUpMoveId: 'punchFollowUp',
      meleeRange: 74,
      frameBoxes: {
        4: {
          hitboxes: [
            hitbox({
              x: 18,
              y: -78,
              width: 28,
              height: 16,
              damage: 64,
              hitstun: 10,
              knockbackX: 8,
            }),
          ],
        },
      },
    },
    punchFollowUp: {
      id: 'punchFollowUp',
      label: 'Phase Split',
      button: 'punch',
      startup: 5,
      active: 4,
      recovery: 11,
      cooldownSeconds: 0,
      animationStance: 'attack2',
      meleeRange: 86,
      rootVelocityX: 2.8,
      frameBoxes: {
        5: {
          hitboxes: [
            hitbox({
              x: 24,
              y: -84,
              width: 36,
              height: 18,
              damage: 84,
              hitstun: 14,
              knockbackX: 11,
              launchY: 5,
            }),
          ],
        },
      },
    },
    kick: {
      id: 'kick',
      label: 'Static Slice',
      button: 'kick',
      startup: 6,
      active: 4,
      recovery: 12,
      cooldownSeconds: 0.9,
      meleeRange: 82,
      frameBoxes: {
        6: {
          hitboxes: [
            hitbox({
              x: 20,
              y: -82,
              width: 34,
              height: 18,
              damage: 92,
              hitstun: 13,
              knockbackX: 10,
              launchY: 4,
            }),
          ],
        },
      },
    },
    special: {
      id: 'special',
      label: 'Reality Break',
      button: 'special',
      startup: 8,
      active: 5,
      recovery: 16,
      cooldownSeconds: 1.35,
      meleeRange: 90,
      rootVelocityX: 5.1,
      frameBoxes: {
        8: {
          hitboxes: [
            hitbox({
              x: 24,
              y: -86,
              width: 40,
              height: 22,
              damage: 118,
              hitstun: 18,
              knockbackX: 14,
              launchY: 6,
            }),
          ],
          hurtboxes: [{ x: -20, y: -102, width: 50, height: 102 }],
        },
      },
    },
  },
};

const quaneshalatonya: CharacterDefinition = {
  id: 'quaneshalatonya',
  name: 'Quaneshalatonya',
  palette: {
    primary: '#ff78b0',
    accent: '#ffd670',
    shadow: '#4d1437',
  },
  sprites: {
    portrait: '/characters/quaneshalatonya/portrait.png',
    renderHeight: 152,
  },
  bot: {
    aggressiveness: 0.58,
    arenaMovement: {
      preferredDistanceMultiplier: 1,
      approachBias: 0.62,
      retreatBias: 0.42,
      jumpInChance: 0.36,
      dashJumpForwardChance: 0.5,
      dashJumpBackwardChance: 0.28,
    },
    skillChoice: {
      punchWeight: 1.1,
      kickWeight: 1,
      specialWeight: 1.04,
      attackCadenceMultiplier: 0.96,
    },
    defense: {
      blockChance: 0.88,
      projectileDodgeChance: 0.52,
      meleeBlockReactionFrames: 1,
      projectileBlockReactionFrames: 4,
    },
  },
  stats: {
    maxHealth: 980,
    movement: {
      walkSpeed: 4.2,
      jumpVelocity: 18.2,
      gravity: 1.05,
      dash: {
        distance: 116,
        speed: 9.667,
        lift: 6.4,
      },
    },
    pushWidth: 23,
  },
  standingBoxes: {
    hurtboxes: [{ x: -21, y: -108, width: 42, height: 108 }],
  },
  jumpingBoxes: {
    hurtboxes: [{ x: -23, y: -94, width: 46, height: 94 }],
  },
  moves: {
    punch: {
      id: 'punch',
      label: 'Crown Flick',
      button: 'punch',
      startup: 3,
      active: 2,
      recovery: 9,
      cooldownSeconds: 0.5,
      frameBoxes: {
        3: {
          hitboxes: [
            hitbox({
              x: 16,
              y: -88,
              width: 24,
              height: 14,
              damage: 58,
              hitstun: 11,
              knockbackX: 7,
            }),
          ],
        },
      },
    },
    kick: {
      id: 'kick',
      label: 'Velvet Heel',
      button: 'kick',
      startup: 5,
      active: 3,
      recovery: 11,
      cooldownSeconds: 0.85,
      frameBoxes: {
        5: {
          hitboxes: [
            hitbox({
              x: 20,
              y: -74,
              width: 32,
              height: 18,
              damage: 88,
              hitstun: 13,
              knockbackX: 10,
              launchY: 5,
            }),
          ],
        },
      },
    },
    special: {
      id: 'special',
      label: 'Royal Break',
      button: 'special',
      startup: 8,
      active: 5,
      recovery: 14,
      cooldownSeconds: 1.4,
      rootVelocityX: 4.9,
      frameBoxes: {
        8: {
          hitboxes: [
            hitbox({
              x: 28,
              y: -90,
              width: 34,
              height: 20,
              damage: 112,
              hitstun: 18,
              knockbackX: 15,
              launchY: 6,
            }),
          ],
          hurtboxes: [{ x: -20, y: -106, width: 52, height: 106 }],
        },
      },
    },
  },
};

const corgi: CharacterDefinition = {
  id: 'corgi',
  name: 'Corgi',
  palette: {
    primary: '#c8894b',
    accent: '#fff0c7',
    shadow: '#4d2f1b',
  },
  sprites: {
    portrait: '/characters/corgi/animations/idle/0.png',
    renderHeight: 110,
  },
  bot: {
    aggressiveness: 0.82,
    arenaMovement: {
      preferredDistanceMultiplier: 0.74,
      approachBias: 0.92,
      retreatBias: 0.18,
      jumpInChance: 0.58,
      dashJumpForwardChance: 0.76,
      dashJumpBackwardChance: 0.14,
    },
    skillChoice: {
      punchWeight: 1.5,
      kickWeight: 1.1,
      specialWeight: 0.95,
      attackCadenceMultiplier: 0.88,
    },
    defense: {
      blockChance: 0.72,
      projectileDodgeChance: 0.38,
      meleeBlockReactionFrames: 1,
      projectileBlockReactionFrames: 4,
    },
  },
  stats: {
    maxHealth: 960,
    movement: {
      walkSpeed: 5.1,
      jumpVelocity: 15.6,
      gravity: 1.18,
      dash: {
        distance: 102,
        speed: 10.2,
        lift: 4.2,
      },
    },
    pushWidth: 20,
  },
  standingBoxes: {
    hurtboxes: [{ x: -26, y: -72, width: 52, height: 72 }],
  },
  jumpingBoxes: {
    hurtboxes: [{ x: -24, y: -64, width: 48, height: 64 }],
  },
  moves: {
    punch: {
      id: 'punch',
      label: 'Snout Boop',
      button: 'punch',
      startup: 3,
      active: 2,
      recovery: 8,
      cooldownSeconds: 0.45,
      meleeRange: 48,
      frameBoxes: {
        3: {
          hitboxes: [
            hitbox({
              x: 18,
              y: -46,
              width: 24,
              height: 12,
              damage: 58,
              hitstun: 9,
              knockbackX: 7,
            }),
          ],
        },
      },
    },
    kick: {
      id: 'kick',
      label: 'Ankle Biter',
      button: 'kick',
      startup: 5,
      active: 3,
      recovery: 10,
      cooldownSeconds: 0.75,
      meleeRange: 58,
      frameBoxes: {
        5: {
          hitboxes: [
            hitbox({
              x: 20,
              y: -34,
              width: 30,
              height: 14,
              damage: 86,
              hitstun: 12,
              knockbackX: 10,
              launchY: 3,
            }),
          ],
        },
      },
    },
    special: {
      id: 'special',
      label: 'Zoomies',
      button: 'special',
      startup: 7,
      active: 5,
      recovery: 14,
      cooldownSeconds: 1.2,
      meleeRange: 84,
      rootVelocityX: 6.8,
      frameBoxes: {
        7: {
          hitboxes: [
            hitbox({
              x: 24,
              y: -40,
              width: 36,
              height: 16,
              damage: 112,
              hitstun: 17,
              knockbackX: 14,
              launchY: 5,
            }),
          ],
          hurtboxes: [{ x: -28, y: -70, width: 56, height: 70 }],
        },
      },
    },
  },
};

const leechingshjt: CharacterDefinition = {
  id: 'leechingshjt',
  name: 'LeechingShjt',
  palette: {
    primary: '#6a274a',
    accent: '#58d8ff',
    shadow: '#140f1d',
  },
  sprites: {
    portrait: '/characters/LeechingShjt/Animations/profile.png',
    renderHeight: 120,
    assetRoot: 'LeechingShjt',
  },
  bot: {
    aggressiveness: 0.68,
    arenaMovement: {
      preferredDistanceMultiplier: 0.92,
      approachBias: 0.78,
      retreatBias: 0.24,
      jumpInChance: 0.42,
      dashJumpForwardChance: 0.62,
      dashJumpBackwardChance: 0.2,
    },
    skillChoice: {
      punchWeight: 1.2,
      kickWeight: 1.05,
      specialWeight: 1.1,
      attackCadenceMultiplier: 0.9,
    },
    defense: {
      blockChance: 0.78,
      projectileDodgeChance: 0.44,
      meleeBlockReactionFrames: 1,
      projectileBlockReactionFrames: 4,
    },
  },
  stats: {
    maxHealth: 995,
    movement: {
      walkSpeed: 4.45,
      jumpVelocity: 17.6,
      gravity: 1.1,
      dash: {
        distance: 106,
        speed: 9.2,
        lift: 5.4,
      },
    },
    pushWidth: 22,
  },
  standingBoxes: {
    hurtboxes: [{ x: -21, y: -104, width: 42, height: 104 }],
  },
  jumpingBoxes: {
    hurtboxes: [{ x: -23, y: -92, width: 46, height: 92 }],
  },
  moves: {
    punch: {
      id: 'punch',
      label: 'Leech Jab',
      button: 'punch',
      startup: 4,
      active: 2,
      recovery: 9,
      cooldownSeconds: 0.5,
      meleeRange: 72,
      frameBoxes: {
        4: {
          hitboxes: [
            hitbox({
              x: 18,
              y: -78,
              width: 26,
              height: 16,
              damage: 62,
              hitstun: 10,
              knockbackX: 8,
            }),
          ],
        },
      },
    },
    kick: {
      id: 'kick',
      label: 'Drain Slice',
      button: 'kick',
      startup: 6,
      active: 3,
      recovery: 11,
      cooldownSeconds: 0.8,
      meleeRange: 82,
      frameBoxes: {
        6: {
          hitboxes: [
            hitbox({
              x: 22,
              y: -72,
              width: 30,
              height: 18,
              damage: 88,
              hitstun: 13,
              knockbackX: 10,
              launchY: 4,
            }),
          ],
        },
      },
    },
    special: {
      id: 'special',
      label: 'Blood Rush',
      button: 'special',
      startup: 8,
      active: 4,
      recovery: 15,
      cooldownSeconds: 1.25,
      meleeRange: 90,
      rootVelocityX: 5.2,
      frameBoxes: {
        8: {
          hitboxes: [
            hitbox({
              x: 24,
              y: -84,
              width: 36,
              height: 20,
              damage: 112,
              hitstun: 17,
              knockbackX: 14,
              launchY: 5,
            }),
          ],
          hurtboxes: [{ x: -20, y: -102, width: 50, height: 102 }],
        },
      },
    },
  },
};

const mrsdoc: CharacterDefinition = {
  id: 'mrsdoc',
  name: 'MrsDoc',
  palette: {
    primary: '#c16f56',
    accent: '#ffe08c',
    shadow: '#3f1f1a',
  },
  sprites: {
    portrait: '/characters/mrsdoc/profile.png',
    renderHeight: 118,
    assetRoot: 'mrsdoc',
  },
  bot: {
    aggressiveness: 0.58,
    arenaMovement: {
      preferredDistanceMultiplier: 0.88,
      approachBias: 0.64,
      retreatBias: 0.28,
      jumpInChance: 0.34,
      dashJumpForwardChance: 0.48,
      dashJumpBackwardChance: 0.22,
    },
    skillChoice: {
      punchWeight: 1.18,
      kickWeight: 1.04,
      specialWeight: 1.08,
      attackCadenceMultiplier: 0.94,
    },
    defense: {
      blockChance: 0.82,
      projectileDodgeChance: 0.46,
      meleeBlockReactionFrames: 1,
      projectileBlockReactionFrames: 4,
    },
  },
  stats: {
    maxHealth: 1005,
    movement: {
      walkSpeed: 4.4,
      jumpVelocity: 17.8,
      gravity: 1.08,
      dash: {
        distance: 104,
        speed: 9.1,
        lift: 5.2,
      },
    },
    pushWidth: 23,
  },
  standingBoxes: {
    hurtboxes: [{ x: -22, y: -102, width: 44, height: 102 }],
  },
  jumpingBoxes: {
    hurtboxes: [{ x: -24, y: -90, width: 48, height: 90 }],
  },
  moves: {
    punch: {
      id: 'punch',
      label: 'Clinic Tap',
      button: 'punch',
      startup: 4,
      active: 2,
      recovery: 9,
      cooldownSeconds: 0.5,
      meleeRange: 74,
      frameBoxes: {
        4: {
          hitboxes: [
            hitbox({
              x: 18,
              y: -74,
              width: 28,
              height: 16,
              damage: 64,
              hitstun: 10,
              knockbackX: 8,
            }),
          ],
        },
      },
    },
    kick: {
      id: 'kick',
      label: 'Case Closed',
      button: 'kick',
      startup: 6,
      active: 3,
      recovery: 11,
      cooldownSeconds: 0.82,
      meleeRange: 84,
      frameBoxes: {
        6: {
          hitboxes: [
            hitbox({
              x: 22,
              y: -70,
              width: 30,
              height: 18,
              damage: 90,
              hitstun: 13,
              knockbackX: 10,
              launchY: 4,
            }),
          ],
        },
      },
    },
    special: {
      id: 'special',
      label: 'Emergency Rounds',
      button: 'special',
      startup: 8,
      active: 4,
      recovery: 16,
      cooldownSeconds: 1.3,
      meleeRange: 92,
      rootVelocityX: 5.4,
      frameBoxes: {
        8: {
          hitboxes: [
            hitbox({
              x: 24,
              y: -82,
              width: 36,
              height: 20,
              damage: 114,
              hitstun: 17,
              knockbackX: 14,
              launchY: 5,
            }),
          ],
          hurtboxes: [{ x: -20, y: -100, width: 50, height: 100 }],
        },
      },
    },
  },
};

const anjokbal: CharacterDefinition = {
  id: 'anjokbal',
  name: 'Anjokbal',
  palette: {
    primary: '#5fbf8e',
    accent: '#f6d36a',
    shadow: '#173229',
  },
  sprites: {
    portrait: '/characters/anjokbal/profile.png',
    renderHeight: 120,
    assetRoot: 'anjokbal',
  },
  bot: {
    aggressiveness: 0.66,
    arenaMovement: {
      preferredDistanceMultiplier: 0.9,
      approachBias: 0.72,
      retreatBias: 0.22,
      jumpInChance: 0.38,
      dashJumpForwardChance: 0.56,
      dashJumpBackwardChance: 0.24,
    },
    skillChoice: {
      punchWeight: 1.16,
      kickWeight: 1.08,
      specialWeight: 1.12,
      attackCadenceMultiplier: 0.9,
    },
    defense: {
      blockChance: 0.8,
      projectileDodgeChance: 0.48,
      meleeBlockReactionFrames: 1,
      projectileBlockReactionFrames: 4,
    },
  },
  stats: {
    maxHealth: 1010,
    movement: {
      walkSpeed: 4.35,
      jumpVelocity: 17.7,
      gravity: 1.08,
      dash: {
        distance: 105,
        speed: 9.15,
        lift: 5.1,
      },
    },
    pushWidth: 23,
  },
  standingBoxes: {
    hurtboxes: [{ x: -22, y: -104, width: 44, height: 104 }],
  },
  jumpingBoxes: {
    hurtboxes: [{ x: -24, y: -92, width: 48, height: 92 }],
  },
  moves: {
    punch: {
      id: 'punch',
      label: 'Palm Check',
      button: 'punch',
      startup: 4,
      active: 2,
      recovery: 9,
      cooldownSeconds: 0.5,
      meleeRange: 76,
      frameBoxes: {
        4: {
          hitboxes: [
            hitbox({
              x: 18,
              y: -76,
              width: 28,
              height: 16,
              damage: 66,
              hitstun: 10,
              knockbackX: 8,
            }),
          ],
        },
      },
    },
    kick: {
      id: 'kick',
      label: 'Split Appeal',
      button: 'kick',
      startup: 6,
      active: 3,
      recovery: 11,
      cooldownSeconds: 0.84,
      meleeRange: 86,
      frameBoxes: {
        6: {
          hitboxes: [
            hitbox({
              x: 22,
              y: -72,
              width: 30,
              height: 18,
              damage: 92,
              hitstun: 13,
              knockbackX: 10,
              launchY: 4,
            }),
          ],
        },
      },
    },
    special: {
      id: 'special',
      label: 'Tilted Rush',
      button: 'special',
      startup: 8,
      active: 4,
      recovery: 16,
      cooldownSeconds: 1.3,
      meleeRange: 94,
      rootVelocityX: 5.5,
      frameBoxes: {
        8: {
          hitboxes: [
            hitbox({
              x: 24,
              y: -84,
              width: 36,
              height: 20,
              damage: 116,
              hitstun: 17,
              knockbackX: 14,
              launchY: 5,
            }),
          ],
          hurtboxes: [{ x: -20, y: -102, width: 50, height: 102 }],
        },
      },
    },
  },
};

export const characterDefinitions: CharacterDefinition[] = [
  // quaneshalatonya,
  paraktaktak,
  digv,
  mcbalut,
  morana,
  distorted,
  corgi,
  leechingshjt,
  mrsdoc,
  anjokbal,
];

export const hiddenCharacterDefinitions: CharacterDefinition[] = [
  mcbalutAnomaly,
];
