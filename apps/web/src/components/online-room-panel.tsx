"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { fighterRoster } from "@battleborn/content";
import { isEditableTarget, isMenuBackKey } from "@/lib/menu-input";

const fighters = Object.values(fighterRoster);

type FormMode = "create" | "join";

export function OnlineRoomPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<FormMode>("create");
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("Arcade Ace");
  const [fighterId, setFighterId] = useState(fighters[0]?.id ?? "morana");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isEditableTarget(event.target)) {
        return;
      }

      if (event.code !== "Escape" && !isMenuBackKey(event)) {
        return;
      }

      event.preventDefault();
      router.push("/");
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [router]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const endpoint = mode === "create" ? "/api/session/create" : "/api/session/join";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode,
          playerName,
          fighterId,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "Unable to open the room flow.");
        return;
      }

      const params = new URLSearchParams({
        mode: "online",
        roomCode: payload.roomCode,
        token: payload.token,
        fighter: fighterId,
        name: playerName,
      });

      router.push(`/fight?${params.toString()}`);
    });
  }

  return (
    <div className="online-shell">
      <div className="mode-switch">
        <button className={mode === "create" ? "mode-active" : ""} onClick={() => setMode("create")} type="button">
          Create room
        </button>
        <button className={mode === "join" ? "mode-active" : ""} onClick={() => setMode("join")} type="button">
          Join room
        </button>
      </div>

      <label className="field">
        <span>Player name</span>
        <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} maxLength={20} />
      </label>

      <label className="field">
        <span>Fighter</span>
        <select value={fighterId} onChange={(event) => setFighterId(event.target.value)}>
          {fighters.map((fighter) => (
            <option key={fighter.id} value={fighter.id}>
              {fighter.name}
            </option>
          ))}
        </select>
      </label>

      {mode === "join" ? (
        <label className="field">
          <span>Room code</span>
          <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} maxLength={6} />
        </label>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      <button className="button button-primary" type="button" disabled={isPending} onClick={submit}>
        {isPending ? "Opening room..." : mode === "create" ? "Create live room" : "Join live room"}
      </button>
    </div>
  );
}
