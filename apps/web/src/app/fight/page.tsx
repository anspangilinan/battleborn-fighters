import { fighterRoster } from "@battleborn/content";

import { FightCharacterSelect } from "@/components/fight-character-select";
import { FightScene } from "@/components/fight-scene";

interface FightPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function pickRandomOpponent(fighterId: string) {
  const opponentOptions = Object.keys(fighterRoster).filter((id) => id !== fighterId);

  if (opponentOptions.length === 0) {
    return fighterId;
  }

  return opponentOptions[Math.floor(Math.random() * opponentOptions.length)];
}

export default async function FightPage({ searchParams }: FightPageProps) {
  const params = await searchParams;
  const mode = params.mode === "online" ? "online" : params.mode === "training" ? "training" : "local";
  const defaultFighterId = fighterRoster.mcbalut ? "mcbalut" : Object.keys(fighterRoster)[0];
  const explicitFighterId = typeof params.fighter === "string" && fighterRoster[params.fighter] ? params.fighter : null;
  const explicitOpponentId = typeof params.opponent === "string" && fighterRoster[params.opponent] ? params.opponent : null;
  const fighterId = explicitFighterId ?? defaultFighterId;
  const fallbackOpponent = mode === "local"
    ? pickRandomOpponent(fighterId)
    : fighterId === "digv" && fighterRoster.mcbalut
    ? "mcbalut"
    : fighterId === "mcbalut" && fighterRoster.digv
      ? "digv"
      : Object.keys(fighterRoster).find((id) => id !== fighterId) ?? fighterId;
  const opponentId = explicitOpponentId ?? fallbackOpponent;
  const roomCode = typeof params.roomCode === "string" ? params.roomCode : undefined;
  const token = typeof params.token === "string" ? params.token : undefined;
  const playerName = typeof params.name === "string" ? params.name : undefined;

  if ((mode === "local" && !explicitFighterId) || (mode === "training" && (!explicitFighterId || !explicitOpponentId))) {
    return (
      <main className="fight-page fight-character-select-page">
        <FightCharacterSelect
          mode={mode}
          initialFighterId={explicitFighterId ?? defaultFighterId}
          initialOpponentId={explicitOpponentId ?? fallbackOpponent}
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
        roomCode={roomCode}
        token={token}
        playerName={playerName}
      />
    </main>
  );
}
