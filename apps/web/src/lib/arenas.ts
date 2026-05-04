import type { ArenaAudienceDefinition } from '@/lib/audience';

interface ArenaConfig {
  id: string;
  label: string;
  backgroundPath: string;
  backgroundOffsetY: number;
  combatOffsetY: number;
  groundShadowOpacity: number;
  audience: ArenaAudienceDefinition | null;
}

export const arenas = [
  {
    id: 'underway',
    label: 'Underway',
    backgroundPath: '/arenas/underway.png',
    backgroundOffsetY: 0,
    combatOffsetY: 0,
    groundShadowOpacity: 0,
    audience: null,
  },
  {
    id: 'fort-sterling-bridge',
    label: 'Fort Sterling',
    backgroundPath: '/arenas/fort-sterling.gif',
    backgroundOffsetY: 36,
    combatOffsetY: 52,
    groundShadowOpacity: 0.34,
    audience: null,
  },
  {
    id: 'mist',
    label: 'The Mists',
    backgroundPath: '/arenas/the-mists.png',
    backgroundOffsetY: 0,
    combatOffsetY: 0,
    groundShadowOpacity: 0.22,
    audience: null,
  },
  {
    id: 'corrupted-dungeon',
    label: 'Corrupted Dungeon',
    backgroundPath: '/arenas/corrupted-dungeon.png',
    backgroundOffsetY: 0,
    combatOffsetY: 0,
    groundShadowOpacity: 0.32,
    audience: null,
  },
] as const satisfies readonly ArenaConfig[];

export type ArenaId = (typeof arenas)[number]['id'];
export type ArenaDefinition = ArenaConfig & { id: ArenaId };

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
