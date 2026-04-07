export const arenas = [
  {
    id: "underway",
    label: "Underway",
    backgroundPath: "/arenas/underway.gif",
    backgroundOffsetY: 0,
  },
  {
    id: "fort-sterling-bridge",
    label: "Fort Sterling",
    backgroundPath: "/arenas/fort-sterling-bridge.gif",
    backgroundOffsetY: -36,
  },
] as const;

export type ArenaDefinition = (typeof arenas)[number];
export type ArenaId = ArenaDefinition["id"];

export const defaultArenaId: ArenaId = "underway";

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
