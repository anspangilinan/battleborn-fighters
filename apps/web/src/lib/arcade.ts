export const arcadeFinalBossId = "mcbalut-anomaly";

type ArcadeRoster = Record<string, { name: string }>;

function getArcadeBossEnabled(roster: ArcadeRoster) {
  return Boolean(roster[arcadeFinalBossId]);
}

function getArcadeRegularOpponentIds(
  fighterId: string,
  roster: ArcadeRoster,
) {
  const bossEnabled = getArcadeBossEnabled(roster);
  return Object.keys(roster).filter(
    (id) => id !== fighterId && (!bossEnabled || id !== arcadeFinalBossId),
  );
}

function shuffleFighterIds(fighterIds: string[]) {
  const shuffledIds = [...fighterIds];

  for (let index = shuffledIds.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffledIds[index], shuffledIds[swapIndex]] = [
      shuffledIds[swapIndex],
      shuffledIds[index],
    ];
  }

  return shuffledIds;
}

export function buildArcadeOrder(
  fighterId: string,
  roster: ArcadeRoster,
) {
  const regularOpponentIds = shuffleFighterIds(
    getArcadeRegularOpponentIds(fighterId, roster),
  );

  if (!getArcadeBossEnabled(roster)) {
    return regularOpponentIds;
  }

  return [...regularOpponentIds, arcadeFinalBossId];
}

export function parseArcadeOrder(
  rawArcadeOrder: string | string[] | undefined,
  fighterId: string,
  roster: ArcadeRoster,
) {
  const regularOpponentIds = getArcadeRegularOpponentIds(fighterId, roster);
  const bossEnabled = getArcadeBossEnabled(roster);
  const expectedLength = regularOpponentIds.length + (bossEnabled ? 1 : 0);

  if (expectedLength === 0) {
    return [];
  }

  if (typeof rawArcadeOrder !== "string") {
    return buildArcadeOrder(fighterId, roster);
  }

  const parsedIds = rawArcadeOrder
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry, index, entries) => entry.length > 0 && entries.indexOf(entry) === index);

  if (parsedIds.length !== expectedLength) {
    return buildArcadeOrder(fighterId, roster);
  }

  if (bossEnabled) {
    if (parsedIds[parsedIds.length - 1] !== arcadeFinalBossId) {
      return buildArcadeOrder(fighterId, roster);
    }

    if (parsedIds.slice(0, -1).includes(arcadeFinalBossId)) {
      return buildArcadeOrder(fighterId, roster);
    }
  }

  const allowedOpponentIds = new Set(regularOpponentIds);
  if (bossEnabled) {
    allowedOpponentIds.add(arcadeFinalBossId);
  }

  if (parsedIds.some((entry) => !allowedOpponentIds.has(entry))) {
    return buildArcadeOrder(fighterId, roster);
  }

  const parsedRegularIds = bossEnabled ? parsedIds.slice(0, -1) : parsedIds;
  if (parsedRegularIds.length !== regularOpponentIds.length) {
    return buildArcadeOrder(fighterId, roster);
  }

  const remainingRegularIds = new Set(regularOpponentIds);
  for (const opponentId of parsedRegularIds) {
    if (!remainingRegularIds.delete(opponentId)) {
      return buildArcadeOrder(fighterId, roster);
    }
  }

  if (remainingRegularIds.size > 0) {
    return buildArcadeOrder(fighterId, roster);
  }

  return parsedIds;
}
