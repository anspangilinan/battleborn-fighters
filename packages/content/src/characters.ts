import type { CharacterDefinition, HitBox } from '@battleborn/game-core';

function hitbox(hit: HitBox): HitBox {
  return hit;
}

const morana: CharacterDefinition = {
  id: 'morana',
  name: 'Morana',
  style: 'Shoto / control',
  palette: {
    primary: '#37d4ff',
    accent: '#fff07f',
    shadow: '#0d2f44',
  },
  sprites: {
    portrait: '/characters/morana/portrait.png',
    renderHeight: 120,
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
      label: 'Storm Rush',
      button: 'special',
      startup: 8,
      active: 5,
      recovery: 14,
      rootVelocityX: 4,
      frameBoxes: {
        8: {
          hitboxes: [
            hitbox({
              x: 26,
              y: -86,
              width: 34,
              height: 20,
              damage: 110,
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

const mcbalut: CharacterDefinition = {
  id: 'mcbalut',
  name: 'mcbalut',
  style: 'Prototype / TBD',
  palette: {
    primary: '#7de06e',
    accent: '#f6dd67',
    shadow: '#1d3b28',
  },
  sprites: {
    portrait: '/characters/mcbalut/animations/portrait.png',
    renderHeight: 110,
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
      projectile: {
        sprite: 'mcbalut/crossbow-bolt',
        tier: 1,
        offsetX: 22,
        offsetY: -84,
        speed: 17.75,
        minimumDistanceRatio: 0.55,
        apexHeight: 56,
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
      startup: 8,
      active: 5,
      recovery: 15,
      rootVelocityX: 4.4,
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

const digv: CharacterDefinition = {
  id: 'digv',
  name: 'DigV',
  style: 'Prototype / TBD',
  palette: {
    primary: '#7d8fff',
    accent: '#f2be67',
    shadow: '#1d2550',
  },
  sprites: {
    portrait: '/characters/digv/portrait.png',
    renderHeight: 100,
  },
  stats: {
    maxHealth: 1010,
    movement: {
      walkSpeed: 2.8,
      jumpVelocity: 17,
      gravity: 1.08,
      dash: {
        distance: 108.04,
        speed: 5.505,
        lift: 8.1,
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
      active: 2,
      recovery: 10,
      frameBoxes: {
        4: {
          hitboxes: [
            hitbox({
              x: 14,
              y: -82,
              width: 24,
              height: 16,
              damage: 65,
              hitstun: 10,
              knockbackX: 8,
            }),
          ],
        },
      },
    },
    kick: {
      id: 'kick',
      label: 'Prototype Arc',
      button: 'kick',
      startup: 6,
      active: 3,
      recovery: 12,
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
      startup: 8,
      active: 5,
      recovery: 15,
      rootVelocityX: 4.4,
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

const paraktaktak: CharacterDefinition = {
  id: 'paraktaktak',
  name: 'ParakTakTak',
  style: 'Prototype / rushdown',
  palette: {
    primary: '#e3c25d',
    accent: '#f79642',
    shadow: '#403117',
  },
  sprites: {
    portrait: '/characters/paraktaktak/portrait.png',
    renderHeight: 165,
  },
  stats: {
    maxHealth: 1030,
    movement: {
      walkSpeed: 3.1,
      jumpVelocity: 17,
      gravity: 1.08,
      dash: {
        distance: 93,
        speed: 11.625,
        lift: 4.8,
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
      active: 2,
      recovery: 10,
      frameBoxes: {
        4: {
          hitboxes: [
            hitbox({
              x: 14,
              y: -82,
              width: 24,
              height: 16,
              damage: 65,
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

const quaneshalatonya: CharacterDefinition = {
  id: 'quaneshalatonya',
  name: 'Quaneshalatonya',
  style: 'Grace / midrange',
  palette: {
    primary: '#ff78b0',
    accent: '#ffd670',
    shadow: '#4d1437',
  },
  sprites: {
    portrait: '/characters/quaneshalatonya/portrait.png',
    renderHeight: 152,
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

export const characterDefinitions: CharacterDefinition[] = [
  quaneshalatonya,
  paraktaktak,
  digv,
  mcbalut,
  morana,
];
