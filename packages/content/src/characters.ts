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
        speed: 8.55,
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
      label: 'Voltage Jab',
      button: 'punch',
      startup: 3,
      active: 2,
      recovery: 9,
      frameBoxes: {
        3: {
          hitboxes: [
            hitbox({
              x: 12,
              y: -84,
              width: 22,
              height: 14,
              damage: 60,
              hitstun: 10,
              knockbackX: 7,
            }),
          ],
        },
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
    renderHeight: 180,
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

export const characterDefinitions: CharacterDefinition[] = [
  paraktaktak,
  digv,
  mcbalut,
  morana,
];
