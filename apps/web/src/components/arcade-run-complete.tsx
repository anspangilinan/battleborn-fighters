"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { CharacterDefinition } from "@battleborn/game-core";

import { ArcadeMenuItem } from "@/components/arcade-menu-item";
import { FightDisplayName } from "@/components/fight-display-name";
import { MenuControlsHint } from "@/components/menu-controls";
import { getFighterPortraitCandidates } from "@/lib/fighter-assets";
import {
  isEditableTarget,
  isMenuBackKey,
  isMenuConfirmKey,
} from "@/lib/menu-input";

type ArcadeRunCompleteScreenProps = {
  fighter: CharacterDefinition;
  finalBossName: string;
  playerName?: string;
  totalScore: number;
  totalStages: number;
};

function preloadImage(src: string) {
  return new Promise<boolean>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

async function discoverPortraitSource(fighter: CharacterDefinition) {
  for (const candidate of getFighterPortraitCandidates(fighter)) {
    if (await preloadImage(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function ArcadeRunCompleteScreen({
  fighter,
  finalBossName,
  playerName,
  totalScore,
  totalStages,
}: ArcadeRunCompleteScreenProps) {
  const router = useRouter();
  const [portraitSource, setPortraitSource] = useState<string | null>(null);

  const retryHref = useMemo(() => {
    const params = new URLSearchParams({
      mode: "arcade",
      fighter: fighter.id,
    });

    if (playerName) {
      params.set("name", playerName);
    }

    return `/fight?${params.toString()}`;
  }, [fighter.id, playerName]);

  useEffect(() => {
    let cancelled = false;

    async function loadPortrait() {
      const discoveredPortrait = await discoverPortraitSource(fighter);
      if (!cancelled) {
        setPortraitSource(discoveredPortrait);
      }
    }

    void loadPortrait();

    return () => {
      cancelled = true;
    };
  }, [fighter]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isEditableTarget(event.target)) {
        return;
      }

      if (isMenuConfirmKey(event)) {
        event.preventDefault();
        router.push(retryHref);
        return;
      }

      if (event.code === "Escape" || isMenuBackKey(event)) {
        event.preventDefault();
        router.push("/");
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [retryHref, router]);

  return (
    <div className="arcade-clear-screen">
      <div className="arcade-clear-panel">
        <div className="arcade-clear-portrait-shell" aria-hidden="true">
          {portraitSource ? (
            <img
              src={portraitSource}
              alt=""
              className="arcade-clear-portrait"
            />
          ) : (
            <div className="animation-spinner" aria-hidden="true" />
          )}
        </div>
        <div className="arcade-clear-copy">
          <div className="arcade-clear-eyebrow">Arcade Complete</div>
          <div className="arcade-clear-title">Congratulations</div>
          <FightDisplayName className="arcade-clear-name" name={fighter.name} />
          <p className="arcade-clear-subtitle">
            {playerName
              ? `${playerName}, you cleared the ladder and put ${finalBossName} down for good.`
              : `You cleared the ladder and put ${finalBossName} down for good.`}
          </p>
          <div className="arcade-clear-stats">
            <div className="arcade-clear-stat">
              <div className="arcade-clear-stat-label">Total Score</div>
              <div className="arcade-clear-stat-value">
                {totalScore.toLocaleString("en-US")}
              </div>
            </div>
            <div className="arcade-clear-stat">
              <div className="arcade-clear-stat-label">Stages Cleared</div>
              <div className="arcade-clear-stat-value">{totalStages}</div>
            </div>
            <div className="arcade-clear-stat">
              <div className="arcade-clear-stat-label">High Score Standing</div>
              <div className="arcade-clear-stat-value arcade-clear-stat-value-muted">
                Pending
              </div>
            </div>
          </div>
          <p className="arcade-clear-note">
            This screen is the handoff point for total-score and leaderboard
            placement once highscores are wired in.
          </p>
          <div className="arcade-clear-actions">
            <ArcadeMenuItem cta href={retryHref} className="arcade-clear-action">
              Run Again
            </ArcadeMenuItem>
            <ArcadeMenuItem href="/" className="arcade-clear-action">
              Main Menu
            </ArcadeMenuItem>
          </div>
          <MenuControlsHint />
        </div>
      </div>
    </div>
  );
}
