import { fighterRoster } from "@battleborn/content";

import { FightCharacterSelect } from "@/components/fight-character-select";
import { FightScene } from "@/components/fight-scene";
import { defaultArenaId, isArenaId, pickRandomArenaId } from "@/lib/arenas";
import {
  isRandomFighterSelection,
  isSelectableFighterSelection,
  resolveFighterSelection,
} from "@/lib/fighter-select";

interface FightPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function shuffleFighterIds(fighterIds: string[]) {
  const shuffledIds = [...fighterIds];

  for (let index = shuffledIds.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffledIds[index], shuffledIds[swapIndex]] = [shuffledIds[swapIndex], shuffledIds[index]];
  }

  return shuffledIds;
}

function pickRandomOpponent(fighterId: string) {
  const opponentOptions = Object.keys(fighterRoster).filter((id) => id !== fighterId);

  if (opponentOptions.length === 0) {
    return fighterId;
  }

  return opponentOptions[Math.floor(Math.random() * opponentOptions.length)];
}

function parseArcadeOrder(rawArcadeOrder: string | string[] | undefined, fighterId: string) {
  const eligibleOpponentIds = Object.keys(fighterRoster).filter((id) => id !== fighterId);
  if (eligibleOpponentIds.length === 0) {
    return [];
  }

  if (typeof rawArcadeOrder !== "string") {
    return shuffleFighterIds(eligibleOpponentIds);
  }

  const parsedIds = rawArcadeOrder
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry, index, entries) =>
      entry.length > 0 &&
      entry !== fighterId &&
      Boolean(fighterRoster[entry]) &&
      entries.indexOf(entry) === index,
    );

  if (parsedIds.length !== eligibleOpponentIds.length) {
    return shuffleFighterIds(eligibleOpponentIds);
  }

  const eligibleOpponentSet = new Set(eligibleOpponentIds);
  if (parsedIds.some((entry) => !eligibleOpponentSet.has(entry))) {
    return shuffleFighterIds(eligibleOpponentIds);
  }

  return parsedIds;
}

export default async function FightPage({ searchParams }: FightPageProps) {
  const params = await searchParams;
  const mode = params.mode === "online"
    ? "online"
    : params.mode === "training"
      ? "training"
      : params.mode === "arcade"
        ? "arcade"
      : "local";
  const defaultFighterId = fighterRoster.mcbalut ? "mcbalut" : Object.keys(fighterRoster)[0];
  const explicitFighterSelection =
    typeof params.fighter === "string" && isSelectableFighterSelection(params.fighter)
      ? params.fighter
      : null;
  const explicitOpponentSelection =
    typeof params.opponent === "string" && isSelectableFighterSelection(params.opponent)
      ? params.opponent
      : null;
  const explicitArenaId = typeof params.arena === "string" && isArenaId(params.arena) ? params.arena : null;
  const fighterId = resolveFighterSelection(explicitFighterSelection, null, defaultFighterId);
  const arcadeOrder = mode === "arcade"
    ? parseArcadeOrder(params.arcadeOrder, fighterId)
    : [];
  const parsedArcadeIndex = mode === "arcade" && typeof params.arcadeIndex === "string"
    ? Number.parseInt(params.arcadeIndex, 10)
    : Number.NaN;
  const arcadeIndex = mode === "arcade" && Number.isInteger(parsedArcadeIndex) && parsedArcadeIndex >= 0
    ? Math.min(parsedArcadeIndex, Math.max(0, arcadeOrder.length - 1))
    : 0;
  const fallbackOpponent = mode === "local"
    ? pickRandomOpponent(fighterId)
    : mode === "arcade"
      ? arcadeOrder[arcadeIndex] ?? resolveFighterSelection(explicitOpponentSelection, fighterId) ?? pickRandomOpponent(fighterId)
    : fighterId === "digv" && fighterRoster.mcbalut
    ? "mcbalut"
    : fighterId === "mcbalut" && fighterRoster.digv
      ? "digv"
      : Object.keys(fighterRoster).find((id) => id !== fighterId) ?? fighterId;
  const opponentId = mode === "training"
    ? resolveFighterSelection(explicitOpponentSelection, fighterId, fallbackOpponent)
    : mode === "arcade"
      ? fallbackOpponent
      : resolveFighterSelection(explicitOpponentSelection, fighterId, fallbackOpponent);
  const arenaId = mode === "arcade"
    ? explicitArenaId ?? pickRandomArenaId()
    : explicitArenaId ?? defaultArenaId;
  const roomCode = typeof params.roomCode === "string" ? params.roomCode : undefined;
  const token = typeof params.token === "string" ? params.token : undefined;
  const playerName = typeof params.name === "string" ? params.name : undefined;
  const shouldShowCharacterSelect =
    (mode === "arcade" && !explicitFighterSelection) ||
    (mode === "local" && (!explicitFighterSelection || !explicitArenaId)) ||
    (mode === "training" &&
      (!explicitFighterSelection || !explicitOpponentSelection || !explicitArenaId));
  const initialStep =
    mode !== "arcade" &&
    !explicitArenaId &&
    ((mode === "local" && explicitFighterSelection) ||
      (mode === "training" && explicitFighterSelection && explicitOpponentSelection))
      ? "stage"
      : "fighters";

  if (shouldShowCharacterSelect) {
    return (
      <main className="fight-page fight-character-select-page">
        <FightCharacterSelect
          mode={mode}
          initialFighterId={explicitFighterSelection ?? defaultFighterId}
          initialOpponentId={explicitOpponentSelection ?? fallbackOpponent}
          initialArenaId={arenaId}
          initialStep={initialStep}
        />
      </main>
    );
  }

  return (
    <main className="fight-page">
      <FightScene
        mode={mode}
        fighterId={fighterId}
        opponentId={opponentId}
        arenaId={arenaId}
        concealFighterOnLoading={isRandomFighterSelection(explicitFighterSelection)}
        concealOpponentOnLoading={
          mode === "local" || isRandomFighterSelection(explicitOpponentSelection)
        }
        arcadeOrder={mode === "arcade" ? arcadeOrder : undefined}
        arcadeIndex={mode === "arcade" ? arcadeIndex : undefined}
        roomCode={roomCode}
        token={token}
        playerName={playerName}
      />
    </main>
  );
}
