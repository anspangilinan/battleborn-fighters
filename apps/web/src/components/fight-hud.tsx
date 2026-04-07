"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { fighterRoster } from "@battleborn/content";
import {
  DEFAULT_CONFIG,
  MAX_OVERCHARGE_METER,
  OVERCHARGE_DURATION_FRAMES,
  type MatchState,
} from "@battleborn/game-core";

import { FightDisplayName } from "@/components/fight-display-name";

type FightHudProps = {
  state: MatchState;
  headshots: Partial<Record<string, string | null>>;
};

type FightHudSlotProps = {
  fighter: MatchState["fighters"][number];
  headshotSource?: string | null;
  side: "left" | "right";
  comboCount: number;
  wins: number;
};

type FightHudRoundsProps = {
  wins: number;
  side: "left" | "right";
};

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

function FightHudSlot({ fighter, headshotSource, side, comboCount, wins }: FightHudSlotProps) {
  const maxHealth = fighterRoster[fighter.fighterId].stats.maxHealth;
  const healthRatio = Math.max(0, Math.min(1, fighter.health / maxHealth));
  const recoverableHealthRatio = Math.max(
    healthRatio,
    Math.min(1, (fighter.health + fighter.recoverableHealth) / maxHealth),
  );
  const overchargeRatio = fighter.overchargeActiveFrames > 0
    ? Math.max(0, Math.min(1, fighter.overchargeActiveFrames / OVERCHARGE_DURATION_FRAMES))
    : Math.max(0, Math.min(1, fighter.overchargeMeter / MAX_OVERCHARGE_METER));
  const isOverchargeReady =
    fighter.overchargeActiveFrames === 0 &&
    fighter.overchargeMeter >= MAX_OVERCHARGE_METER;
  const previousRatioRef = useRef(healthRatio);
  const damageFlashTimeoutRef = useRef<number | null>(null);
  const [isTakingDamage, setIsTakingDamage] = useState(false);
  const nameNode = (
    <FightDisplayName
      className={`fight-hud-name fight-hud-name-${side}`}
      name={fighter.name}
    />
  );
  const overchargeNode = (
    <div
      className={
        `fight-hud-overcharge-track fight-hud-overcharge-track-${side}` +
        `${fighter.overchargeActiveFrames > 0 ? " fight-hud-overcharge-track-active" : ""}` +
        `${isOverchargeReady ? " fight-hud-overcharge-track-ready" : ""}`
      }
    >
      <div
        className={`fight-hud-overcharge-fill fight-hud-overcharge-fill-${side}`}
        style={{ width: `${overchargeRatio * 100}%` }}
      />
    </div>
  );
  const roundNode = <FightHudRounds wins={wins} side={side} />;
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
      <div className={`fight-hud-side fight-hud-side-${side}`}>
        {headshotSource ? (
          <img
            src={headshotSource}
            alt={fighter.name}
            className={`fight-hud-headshot fight-hud-headshot-${side}`}
          />
        ) : (
          <div className={`fight-hud-headshot fight-hud-headshot-${side} fight-hud-headshot-placeholder`} />
        )}
        <div className={`fight-hud-name-slot fight-hud-name-slot-${side}`}>
          {nameNode}
        </div>
      </div>
      <div className={`fight-hud-life-track fight-hud-life-track-${side}`}>
        <div
          className={`fight-hud-life-fill fight-hud-life-fill-recoverable fight-hud-life-fill-${side}`}
          style={{ width: `${recoverableHealthRatio * 100}%` }}
        />
        <div
          className={`fight-hud-life-fill fight-hud-life-fill-health fight-hud-life-fill-${side}${isTakingDamage ? " fight-hud-life-fill-hit" : ""}`}
          style={{ width: `${healthRatio * 100}%` }}
        />
      </div>
      <div className={`fight-hud-meta fight-hud-meta-${side}`}>
        {side === "left" ? (
          <>
            {overchargeNode}
            {roundNode}
          </>
        ) : (
          <>
            {roundNode}
            {overchargeNode}
          </>
        )}
      </div>
      {comboCount >= 2 ? (
        <div className={`fight-hud-combo fight-hud-combo-${side}`}>
          <div className="fight-hud-combo-count">{comboCount} hit</div>
          <div className="fight-hud-combo-label">COMBO</div>
        </div>
      ) : null}
    </div>
  );
}

export function FightHud({ state, headshots }: FightHudProps) {
  const [leftFighter, rightFighter] = useMemo(
    () => [...state.fighters].sort((first, second) => first.slot - second.slot),
    [state.fighters],
  );
  const leftComboCount =
    rightFighter.comboOwnerSlot === leftFighter.slot ? rightFighter.comboCount : 0;
  const rightComboCount =
    leftFighter.comboOwnerSlot === rightFighter.slot ? leftFighter.comboCount : 0;
  const timerLabel = Number.isFinite(state.timerFramesRemaining)
    ? Math.max(0, Math.ceil(state.timerFramesRemaining / 60))
    : "∞";

  return (
    <div className="fight-hud-shell" aria-hidden="true">
      <FightHudSlot
        fighter={leftFighter}
        headshotSource={headshots[leftFighter.fighterId]}
        side="left"
        comboCount={leftComboCount}
        wins={leftFighter.wins}
      />
      <div className="fight-hud-center">
        <div className="fight-hud-timer">{timerLabel}</div>
        <div className="fight-hud-round-label">Round {state.round}</div>
      </div>
      <FightHudSlot
        fighter={rightFighter}
        headshotSource={headshots[rightFighter.fighterId]}
        side="right"
        comboCount={rightComboCount}
        wins={rightFighter.wins}
      />
    </div>
  );
}
