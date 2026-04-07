export type AudienceCheerAnimation = 'bounce' | 'wave' | 'clap' | 'lean';
export type AudienceSpriteStance =
  | 'idle'
  | 'walk'
  | 'win'
  | 'attack1'
  | 'attack2'
  | 'special'
  | 'special-pose';

export interface AudienceCharacterDefinition {
  id: string;
  label: string;
  fighterId: string;
  cheerAnimation: AudienceCheerAnimation;
  preferredStances: readonly AudienceSpriteStance[];
  frameDurationFrames: number;
}

export interface ArenaAudienceRowDefinition {
  yPercent: number;
  count: number;
  minScale: number;
  maxScale: number;
  minBlurPx: number;
  maxBlurPx: number;
  opacity: number;
  spreadPercent: number;
  verticalJitterPercent: number;
}

export interface ArenaAudienceDefinition {
  leftInsetPercent: number;
  rightInsetPercent: number;
  barrierTopPercent: number;
  barrierHeightPercent: number;
  barrierOpacity: number;
  barrierTint: string;
  highlightTint: string;
  hazeOpacity: number;
  hazeTint: string;
  rows: readonly ArenaAudienceRowDefinition[];
}

export interface AudienceFanPlacement {
  key: string;
  rowIndex: number;
  depth: number;
  character: AudienceCharacterDefinition;
  xPercent: number;
  yPercent: number;
  scale: number;
  blurPx: number;
  opacity: number;
  durationMs: number;
  delayMs: number;
  bobPx: number;
  swayDeg: number;
  leanDeg: number;
  flipX: boolean;
  frameOffsetFrames: number;
}

export const audienceCharacterTable = [
  {
    id: 'morana-chant',
    label: 'Morana Chant',
    fighterId: 'morana',
    cheerAnimation: 'wave',
    preferredStances: ['idle', 'win', 'special-pose'],
    frameDurationFrames: 10,
  },
  {
    id: 'morana-cheer',
    label: 'Morana Cheer',
    fighterId: 'morana',
    cheerAnimation: 'lean',
    preferredStances: ['win', 'idle', 'special-pose'],
    frameDurationFrames: 8,
  },
  {
    id: 'mcbalut-hype',
    label: 'mcbalut Hype',
    fighterId: 'mcbalut',
    cheerAnimation: 'bounce',
    preferredStances: ['win', 'idle', 'attack1'],
    frameDurationFrames: 7,
  },
  {
    id: 'digv-nod',
    label: 'DigV Nod',
    fighterId: 'digv',
    cheerAnimation: 'clap',
    preferredStances: ['idle', 'walk', 'attack1'],
    frameDurationFrames: 9,
  },
  {
    id: 'parak-holler',
    label: 'Parak Holler',
    fighterId: 'paraktaktak',
    cheerAnimation: 'bounce',
    preferredStances: ['win', 'idle', 'walk'],
    frameDurationFrames: 7,
  },
  {
    id: 'distorted-loop',
    label: 'Distorted Loop',
    fighterId: 'distorted',
    cheerAnimation: 'wave',
    preferredStances: ['walk', 'idle', 'attack1'],
    frameDurationFrames: 8,
  },
  {
    id: 'distorted-lean',
    label: 'Distorted Lean',
    fighterId: 'distorted',
    cheerAnimation: 'lean',
    preferredStances: ['idle', 'walk', 'attack2'],
    frameDurationFrames: 11,
  },
  {
    id: 'quane-sway',
    label: 'Quaneshalatonya Sway',
    fighterId: 'quaneshalatonya',
    cheerAnimation: 'lean',
    preferredStances: ['win', 'idle', 'walk'],
    frameDurationFrames: 8,
  },
  {
    id: 'quane-clap',
    label: 'Quaneshalatonya Clap',
    fighterId: 'quaneshalatonya',
    cheerAnimation: 'clap',
    preferredStances: ['idle', 'walk', 'win'],
    frameDurationFrames: 10,
  },
] as const satisfies readonly AudienceCharacterDefinition[];

export const audienceFighterIds = Array.from(
  new Set(audienceCharacterTable.map((character) => character.fighterId)),
);
const MAX_AUDIENCE_FANS = 3;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function hashString(value: string) {
  let hash = 1779033703 ^ value.length;

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return hash >>> 0;
  };
}

function createSeededRandom(seedKey: string) {
  const seed = hashString(seedKey);
  let state = seed();

  return () => {
    state += 0x6d2b79f5;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function randomRange(random: () => number, min: number, max: number) {
  return lerp(min, max, random());
}

export function createAudienceCrowd(
  audience: ArenaAudienceDefinition,
  seedKey: string,
  excludedFighterIds: readonly string[] = [],
): AudienceFanPlacement[] {
  const random = createSeededRandom(seedKey);
  const placements: AudienceFanPlacement[] = [];
  const minX = audience.leftInsetPercent;
  const maxX = 100 - audience.rightInsetPercent;
  const excludedFighterIdSet = new Set(
    excludedFighterIds.filter((fighterId) => fighterId.length > 0),
  );
  const availableCharacters = audienceCharacterTable.filter(
    (character) => !excludedFighterIdSet.has(character.fighterId),
  );

  if (availableCharacters.length === 0) {
    return placements;
  }

  let remainingFans = MAX_AUDIENCE_FANS;

  audience.rows.forEach((row, rowIndex) => {
    if (remainingFans <= 0) {
      return;
    }

    const rowsLeft = audience.rows.length - rowIndex;
    const slotCount = Math.max(
      1,
      Math.min(row.count, remainingFans - Math.max(0, rowsLeft - 1)),
    );
    const spacing = (maxX - minX) / Math.max(1, slotCount - 1);

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      const anchorProgress = slotCount === 1 ? 0.5 : slotIndex / (slotCount - 1);
      const anchorX = lerp(minX, maxX, anchorProgress);
      const positionJitter = randomRange(
        random,
        -row.spreadPercent,
        row.spreadPercent,
      );
      const xPercent = clamp(
        anchorX + positionJitter * Math.min(1, spacing / 16),
        minX,
        maxX,
      );
      const yPercent =
        row.yPercent +
        randomRange(random, -row.verticalJitterPercent, row.verticalJitterPercent);
      const character =
        availableCharacters[
          Math.floor(random() * availableCharacters.length)
        ] ?? availableCharacters[0];

      placements.push({
        key: `${rowIndex}-${slotIndex}-${character.id}`,
        rowIndex,
        depth: rowIndex + 1,
        character,
        xPercent,
        yPercent,
        scale: lerp(row.minScale, row.maxScale, random()),
        blurPx: lerp(row.minBlurPx, row.maxBlurPx, random()),
        opacity: clamp(row.opacity * lerp(0.92, 1.08, random()), 0.1, 0.94),
        durationMs: Math.round(860 + rowIndex * 120 + random() * 520),
        delayMs: Math.round(random() * 1800),
        bobPx: lerp(4, 10, random()),
        swayDeg: randomRange(random, -5, 5),
        leanDeg: randomRange(random, -4.5, 4.5),
        flipX: random() >= 0.5,
        frameOffsetFrames: Math.floor(random() * 36),
      });
      remainingFans -= 1;
    }
  });

  return placements.sort((left, right) => {
    if (left.depth !== right.depth) {
      return left.depth - right.depth;
    }

    return left.xPercent - right.xPercent;
  });
}
