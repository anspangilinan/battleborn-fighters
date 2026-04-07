import type { ArenaAudienceDefinition } from '@/lib/audience';

const underwayAudience = {
  leftInsetPercent: 12,
  rightInsetPercent: 12,
  barrierTopPercent: 53,
  barrierHeightPercent: 13,
  barrierOpacity: 0.24,
  barrierTint: 'rgba(21, 33, 45, 0.92)',
  highlightTint: 'rgba(180, 226, 255, 0.12)',
  hazeOpacity: 0.34,
  hazeTint: 'rgba(112, 156, 186, 0.34)',
  rows: [
    {
      yPercent: 57,
      count: 4,
      minScale: 0.6,
      maxScale: 0.68,
      minBlurPx: 3.4,
      maxBlurPx: 4.6,
      opacity: 0.2,
      spreadPercent: 6,
      verticalJitterPercent: 1.2,
    },
    {
      yPercent: 60.5,
      count: 5,
      minScale: 0.68,
      maxScale: 0.76,
      minBlurPx: 2.4,
      maxBlurPx: 3.4,
      opacity: 0.3,
      spreadPercent: 8,
      verticalJitterPercent: 1.5,
    },
    {
      yPercent: 64,
      count: 6,
      minScale: 0.76,
      maxScale: 0.84,
      minBlurPx: 1.4,
      maxBlurPx: 2.4,
      opacity: 0.4,
      spreadPercent: 10,
      verticalJitterPercent: 1.8,
    },
  ],
} satisfies ArenaAudienceDefinition;

const fortSterlingAudience = {
  leftInsetPercent: 16,
  rightInsetPercent: 16,
  barrierTopPercent: 40,
  barrierHeightPercent: 12,
  barrierOpacity: 0.42,
  barrierTint: 'rgba(112, 118, 134, 0.88)',
  highlightTint: 'rgba(255, 233, 174, 0.2)',
  hazeOpacity: 0.22,
  hazeTint: 'rgba(255, 216, 174, 0.26)',
  rows: [
    {
      yPercent: 44,
      count: 4,
      minScale: 0.58,
      maxScale: 0.66,
      minBlurPx: 3.2,
      maxBlurPx: 4.2,
      opacity: 0.2,
      spreadPercent: 6,
      verticalJitterPercent: 1.1,
    },
    {
      yPercent: 47.5,
      count: 5,
      minScale: 0.66,
      maxScale: 0.74,
      minBlurPx: 2.2,
      maxBlurPx: 3.1,
      opacity: 0.3,
      spreadPercent: 8,
      verticalJitterPercent: 1.4,
    },
    {
      yPercent: 51,
      count: 6,
      minScale: 0.74,
      maxScale: 0.82,
      minBlurPx: 1.3,
      maxBlurPx: 2.1,
      opacity: 0.4,
      spreadPercent: 10,
      verticalJitterPercent: 1.6,
    },
  ],
} satisfies ArenaAudienceDefinition;

export const arenas = [
  {
    id: 'underway',
    label: 'Underway',
    backgroundPath: '/arenas/underway.gif',
    backgroundOffsetY: 0,
    audience: underwayAudience,
  },
  {
    id: 'fort-sterling-bridge',
    label: 'Fort Sterling',
    backgroundPath: '/arenas/fort-sterling-bridge.gif',
    backgroundOffsetY: -36,
    audience: fortSterlingAudience,
  },
] as const;

export type ArenaDefinition = (typeof arenas)[number];
export type ArenaId = ArenaDefinition['id'];

export const defaultArenaId: ArenaId = 'underway';

const arenaMap = Object.fromEntries(
  arenas.map((arena) => [arena.id, arena] as const),
) as Record<ArenaId, ArenaDefinition>;

export function isArenaId(value: string): value is ArenaId {
  return value in arenaMap;
}

export function getArena(id: string | null | undefined): ArenaDefinition {
  if (id && isArenaId(id)) {
    return arenaMap[id];
  }

  return arenaMap[defaultArenaId];
}

export function pickRandomArenaId(excludingArenaId?: string | null): ArenaId {
  const availableArenas = arenas.filter((arena) => arena.id !== excludingArenaId);
  const arenaPool = availableArenas.length > 0 ? availableArenas : arenas;
  const randomIndex = Math.floor(Math.random() * arenaPool.length);

  return arenaPool[randomIndex]?.id ?? defaultArenaId;
}
