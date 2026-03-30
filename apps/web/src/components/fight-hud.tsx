"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { fighterRoster } from "@battleborn/content";
import { DEFAULT_CONFIG, type MatchState } from "@battleborn/game-core";

type FightHudProps = {
  state: MatchState;
  headshots: Partial<Record<string, string | null>>;
};

type FightHudSlotProps = {
  fighter: MatchState["fighters"][number];
  headshotSource?: string | null;
  side: "left" | "right";
};

type FightHudRoundsProps = {
  wins: number;
  side: "left" | "right";
};

function FightHudSlot({ fighter, headshotSource, side }: FightHudSlotProps) {
  const maxHealth = fighterRoster[fighter.fighterId].stats.maxHealth;
  const healthRatio = Math.max(0, Math.min(1, fighter.health / maxHealth));
  const previousRatioRef = useRef(healthRatio);
  const damageFlashTimeoutRef = useRef<number | null>(null);
  const [isTakingDamage, setIsTakingDamage] = useState(false);

  useEffect(() => {
    if (healthRatio < previousRatioRef.current) {
      setIsTakingDamage(true);
      if (damageFlashTimeoutRef.current !== null) {
        window.clearTimeout(damageFlashTimeoutRef.current);
      }

      damageFlashTimeoutRef.current = window.setTimeout(() => {
        setIsTakingDamage(false);
        damageFlashTimeoutRef.current = null;
      }, 220);
    }

    previousRatioRef.current = healthRatio;
  }, [healthRatio]);

  useEffect(
    () => () => {
      if (damageFlashTimeoutRef.current !== null) {
        window.clearTimeout(damageFlashTimeoutRef.current);
      }
    },
    [],
  );

  return (
    <div className={`fight-hud-slot fight-hud-slot-${side}`}>
      {headshotSource ? (
        <img
          src={headshotSource}
          alt={fighter.name}
          className={`fight-hud-headshot fight-hud-headshot-${side}`}
        />
      ) : (
        <div className={`fight-hud-headshot fight-hud-headshot-${side} fight-hud-headshot-placeholder`} />
      )}
      <div className={`fight-hud-life-track fight-hud-life-track-${side}`}>
        <div
          className={`fight-hud-life-fill fight-hud-life-fill-${side}${isTakingDamage ? " fight-hud-life-fill-hit" : ""}`}
          style={{ width: `${healthRatio * 100}%` }}
        />
      </div>
      <div className={`fight-hud-name fight-hud-name-${side}`}>{fighter.name}</div>
    </div>
  );
}

function FightHudRounds({ wins, side }: FightHudRoundsProps) {
  return (
    <div className={`fight-hud-rounds fight-hud-rounds-${side}`}>
      {Array.from({ length: DEFAULT_CONFIG.roundsToWin }).map((_, index) => (
        <span
          key={`${side}-round-${index}`}
          className={`fight-hud-round-dot${wins > index ? " fight-hud-round-dot-filled" : ""}`}
        />
      ))}
    </div>
  );
}

export function FightHud({ state, headshots }: FightHudProps) {
  const [leftFighter, rightFighter] = useMemo(
    () => [...state.fighters].sort((first, second) => first.slot - second.slot),
    [state.fighters],
  );
  const timerLabel = Number.isFinite(state.timerFramesRemaining)
    ? Math.max(0, Math.ceil(state.timerFramesRemaining / 60))
    : "∞";

  return (
    <div className="fight-hud-shell" aria-hidden="true">
      <FightHudSlot fighter={leftFighter} headshotSource={headshots[leftFighter.fighterId]} side="left" />
      <div className="fight-hud-center">
        <FightHudRounds wins={leftFighter.wins} side="left" />
        <div className="fight-hud-timer">{timerLabel}</div>
        <FightHudRounds wins={rightFighter.wins} side="right" />
      </div>
      <FightHudSlot fighter={rightFighter} headshotSource={headshots[rightFighter.fighterId]} side="right" />
    </div>
  );
}
