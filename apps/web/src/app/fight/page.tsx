import { fighterRoster, hiddenFighterRoster } from "@battleborn/content";
import type { CharacterDefinition } from "@battleborn/game-core";

import { ArcadeRunCompleteScreen } from "@/components/arcade-run-complete";
import { FightCharacterSelect } from "@/components/fight-character-select";
import { FightScene } from "@/components/fight-scene";
import { defaultArenaId, isArenaId, pickRandomArenaId } from "@/lib/arenas";
import { arcadeFinalBossId, parseArcadeOrder } from "@/lib/arcade";
import { isMasterModeEnabled } from "@/lib/feature-flags";
import {
  isRandomFighterSelection,
  pickRandomFighterId,
  isSelectableFighterSelection,
  resolveFighterSelection,
} from "@/lib/fighter-select";

interface FightPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

type FighterRosterMap = Record<string, CharacterDefinition>;

function pickRandomOpponent(
  fighterId: string,
  roster: FighterRosterMap,
) {
  return pickRandomFighterId(fighterId, roster) || fighterId;
}

function parseNonNegativeInteger(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return 0;
  }

  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
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
  const publicRoster: FighterRosterMap = fighterRoster;
  const masterRoster: FighterRosterMap = isMasterModeEnabled()
    ? { ...publicRoster, ...hiddenFighterRoster }
    : publicRoster;
  const playableRoster: FighterRosterMap =
    mode === "online"
      ? publicRoster
      : masterRoster;
  const arcadeRoster: FighterRosterMap =
    hiddenFighterRoster[arcadeFinalBossId]
      ? {
          ...playableRoster,
          [arcadeFinalBossId]: hiddenFighterRoster[arcadeFinalBossId],
        }
      : playableRoster;
  const matchRoster = mode === "arcade" ? arcadeRoster : playableRoster;
  const fighterOptions = Object.values(playableRoster);
  const opponentOptions = Object.values(mode === "arcade" ? arcadeRoster : playableRoster);
  const defaultFighterId = playableRoster.mcbalut ? "mcbalut" : Object.keys(playableRoster)[0];
  const explicitFighterSelection =
    typeof params.fighter === "string" && isSelectableFighterSelection(params.fighter, playableRoster)
      ? params.fighter
      : null;
  const explicitOpponentSelection =
    typeof params.opponent === "string" &&
      isSelectableFighterSelection(
        params.opponent,
        mode === "arcade" ? arcadeRoster : playableRoster,
      )
      ? params.opponent
      : null;
  const explicitArenaId = typeof params.arena === "string" && isArenaId(params.arena) ? params.arena : null;
  const fighterId = resolveFighterSelection(
    explicitFighterSelection,
    null,
    defaultFighterId,
    playableRoster,
  );
  const arcadeOrder = mode === "arcade"
    ? parseArcadeOrder(params.arcadeOrder, fighterId, arcadeRoster)
    : [];
  const parsedArcadeIndex = mode === "arcade" && typeof params.arcadeIndex === "string"
    ? Number.parseInt(params.arcadeIndex, 10)
    : Number.NaN;
  const arcadeIndex = mode === "arcade" && Number.isInteger(parsedArcadeIndex) && parsedArcadeIndex >= 0
    ? Math.min(parsedArcadeIndex, Math.max(0, arcadeOrder.length - 1))
    : 0;
  const fallbackOpponent = mode === "local"
    ? pickRandomOpponent(fighterId, playableRoster)
    : mode === "arcade"
      ? arcadeOrder[arcadeIndex] ??
        resolveFighterSelection(explicitOpponentSelection, fighterId, undefined, arcadeRoster) ??
        pickRandomOpponent(fighterId, arcadeRoster)
    : fighterId === "digv" && playableRoster.mcbalut
    ? "mcbalut"
    : fighterId === "mcbalut" && playableRoster.digv
      ? "digv"
      : Object.keys(playableRoster).find((id) => id !== fighterId) ?? fighterId;
  const opponentId = mode === "training"
    ? resolveFighterSelection(
        explicitOpponentSelection,
        fighterId,
        fallbackOpponent,
        playableRoster,
      )
    : mode === "arcade"
      ? fallbackOpponent
      : resolveFighterSelection(
          explicitOpponentSelection,
          fighterId,
          fallbackOpponent,
          playableRoster,
        );
  const arenaId = mode === "arcade"
    ? explicitArenaId ?? pickRandomArenaId()
    : explicitArenaId ?? defaultArenaId;
  const roomCode = typeof params.roomCode === "string" ? params.roomCode : undefined;
  const token = typeof params.token === "string" ? params.token : undefined;
  const playerName = typeof params.name === "string" ? params.name : undefined;
  const arcadeResult = mode === "arcade" && params.arcadeResult === "clear"
    ? "clear"
    : null;
  const arcadeScore = parseNonNegativeInteger(params.arcadeScore);
  const arcadeStagesCleared = parseNonNegativeInteger(params.arcadeStagesCleared);

  if (arcadeResult === "clear") {
    const finalBossName =
      arcadeRoster[arcadeFinalBossId]?.name ?? "mcbalut anomaly";

    return (
      <main className="fight-page arcade-complete-page">
        <ArcadeRunCompleteScreen
          fighter={playableRoster[fighterId] ?? fighterOptions[0]!}
          finalBossName={finalBossName}
          playerName={playerName}
          totalScore={arcadeScore}
          totalStages={arcadeStagesCleared || arcadeOrder.length}
        />
      </main>
    );
  }

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
          fighters={fighterOptions}
          opponents={opponentOptions}
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
        roster={matchRoster}
        fighterId={fighterId}
        opponentId={opponentId}
        arenaId={arenaId}
        concealFighterOnLoading={isRandomFighterSelection(explicitFighterSelection)}
        concealOpponentOnLoading={
          mode === "local" || isRandomFighterSelection(explicitOpponentSelection)
        }
        arcadeOrder={mode === "arcade" ? arcadeOrder : undefined}
        arcadeIndex={mode === "arcade" ? arcadeIndex : undefined}
        arcadeScore={mode === "arcade" ? arcadeScore : undefined}
        roomCode={roomCode}
        token={token}
        playerName={playerName}
      />
    </main>
  );
}
