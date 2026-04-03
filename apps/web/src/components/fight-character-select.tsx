"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { fighterRoster } from "@battleborn/content";

import { ArcadeMenuItem } from "@/components/arcade-menu-item";
import { FightDisplayName } from "@/components/fight-display-name";
import { MenuControlsHint } from "@/components/menu-controls";
import { arenas, defaultArenaId, getArena, isArenaId, type ArenaDefinition } from "@/lib/arenas";
import {
  getWrappedIndex,
  isMenuBackKey,
  isMenuConfirmKey,
  isMenuDownKey,
  isMenuLeftKey,
  isMenuRightKey,
  isMenuUpKey,
} from "@/lib/menu-input";

const fighters = Object.values(fighterRoster);
const MAX_IDLE_FRAME_SCAN = 24;
const IDLE_FRAME_MS = 120;

type FightCharacterSelectProps = {
  mode: "local" | "training";
  initialFighterId?: string;
  initialOpponentId?: string;
  initialArenaId?: string;
  initialStep?: FightCharacterSelectStep;
};

type FightCharacterSelectStep = "fighters" | "stage";

type CharacterPreviewProps = {
  fighter: (typeof fighters)[number];
  facing: "left" | "right";
};

type StageOptionCardProps = {
  arena: ArenaDefinition;
  onSelect: () => void;
  selected: boolean;
};

function toAssetSegment(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function preloadImage(src: string) {
  return new Promise<boolean>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

async function discoverImageSource(candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (await preloadImage(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function loadSequentialFrames(assetDirectory: string) {
  const namingStrategies = [
    (index: number) => `${String(index + 1).padStart(2, "0")}.png`,
    (index: number) => `${index}.png`,
    (index: number) => `${index + 1}.png`,
  ];

  for (const getFrameName of namingStrategies) {
    const discoveredFrames: string[] = [];
    for (let index = 0; index < MAX_IDLE_FRAME_SCAN; index += 1) {
      const src = `${assetDirectory}${getFrameName(index)}`;
      const exists = await preloadImage(src);
      if (!exists) {
        break;
      }
      discoveredFrames.push(src);
    }

    if (discoveredFrames.length > 0) {
      return discoveredFrames;
    }
  }

  return [];
}

function getFighterAssetRoots(fighter: (typeof fighters)[number]) {
  return Array.from(
    new Set([
      `/characters/${fighter.id}`,
      `/characters/${toAssetSegment(fighter.name)}`,
    ]),
  );
}

async function discoverHeadshotSource(fighter: (typeof fighters)[number]) {
  const assetRoots = getFighterAssetRoots(fighter);
  return discoverImageSource([
    ...assetRoots.flatMap((root) => [`${root}/headshot.png`, `${root}/animations/headshot.png`]),
    fighter.sprites.portrait,
  ]);
}

async function discoverPortraitSource(fighter: (typeof fighters)[number]) {
  const assetRoots = getFighterAssetRoots(fighter);
  return discoverImageSource([
    fighter.sprites.portrait,
    ...assetRoots.flatMap((root) => [`${root}/portrait.png`, `${root}/animations/portrait.png`]),
  ]);
}

async function discoverIdleFrames(fighter: (typeof fighters)[number]) {
  const assetRoots = getFighterAssetRoots(fighter);
  const candidateDirectories = assetRoots.flatMap((root) => [
    `${root}/animations/idle/`,
    `${root}/idle/`,
  ]);

  for (const directory of candidateDirectories) {
    const frames = await loadSequentialFrames(directory);
    if (frames.length > 0) {
      return frames;
    }
  }

  return [];
}

function useIdleAnimation(fighter: (typeof fighters)[number] | undefined) {
  const [idleFrames, setIdleFrames] = useState<string[]>([]);
  const [portraitSource, setPortraitSource] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadIdleAnimation() {
      if (!fighter) {
        setIdleFrames([]);
        setPortraitSource(null);
        setCurrentFrame(0);
        return;
      }

      setIdleFrames([]);
      setPortraitSource(null);
      setCurrentFrame(0);
      const [discoveredFrames, discoveredPortrait] = await Promise.all([
        discoverIdleFrames(fighter),
        discoverPortraitSource(fighter),
      ]);

      if (cancelled) {
        return;
      }

      setIdleFrames(discoveredFrames);
      setPortraitSource(discoveredPortrait);
    }

    void loadIdleAnimation();

    return () => {
      cancelled = true;
    };
  }, [fighter]);

  useEffect(() => {
    if (idleFrames.length <= 1) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCurrentFrame((previous) => (previous + 1) % idleFrames.length);
    }, IDLE_FRAME_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentFrame, idleFrames]);

  return idleFrames[currentFrame] ?? portraitSource;
}

function CharacterPreview({ fighter, facing }: CharacterPreviewProps) {
  const currentIdleFrame = useIdleAnimation(fighter);

  return (
    <div className="fight-character-select-preview-stack">
      <div className={`fight-character-select-stage fight-character-select-stage-${facing}`}>
        {currentIdleFrame ? (
          <img
            src={currentIdleFrame}
            alt={fighter.name}
            className={`fight-character-select-preview-image fight-character-select-preview-image-${facing}`}
            style={{ height: `${(fighter.sprites.renderHeight ?? 168) * 4}px` }}
          />
        ) : (
          <div className="animation-spinner" aria-hidden="true" />
        )}
      </div>
      <FightDisplayName className="fight-character-select-name" name={fighter.name} />
    </div>
  );
}

function StageOptionCard({ arena, onSelect, selected }: StageOptionCardProps) {
  return (
    <button
      type="button"
      className={`fight-stage-card${selected ? " fight-stage-card-selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
      >
      <img src={arena.backgroundPath} alt={arena.label} className="fight-stage-card-preview" />
      <div className="fight-stage-card-scrim" />
      <div className="fight-stage-card-copy">
        <div className="fight-stage-card-name">{arena.label}</div>
      </div>
    </button>
  );
}

function buildFightHref(
  mode: "local" | "training",
  fighterId: string,
  opponentId: string,
  arenaId: string,
) {
  const params = new URLSearchParams({
    mode,
    fighter: fighterId,
    arena: arenaId,
  });

  if (mode === "training") {
    params.set("opponent", opponentId);
  }

  return `/fight?${params.toString()}`;
}

export function FightCharacterSelect({
  mode,
  initialFighterId,
  initialOpponentId,
  initialArenaId,
  initialStep = "fighters",
}: FightCharacterSelectProps) {
  const router = useRouter();
  const [step, setStep] = useState<FightCharacterSelectStep>(initialStep);
  const [activeRoster, setActiveRoster] = useState<"fighter" | "opponent">("fighter");
  const [selectedFighterId, setSelectedFighterId] = useState(() =>
    initialFighterId && fighterRoster[initialFighterId] ? initialFighterId : fighters[0]?.id ?? "",
  );
  const [selectedOpponentId, setSelectedOpponentId] = useState(() =>
    initialOpponentId && fighterRoster[initialOpponentId]
      ? initialOpponentId
      : fighters.find((fighter) => fighter.id !== initialFighterId)?.id ?? fighters[0]?.id ?? "",
  );
  const [selectedArenaId, setSelectedArenaId] = useState(() =>
    initialArenaId && isArenaId(initialArenaId) ? initialArenaId : defaultArenaId,
  );
  const [headshots, setHeadshots] = useState<Record<string, string | null>>({});

  const selectedFighter = useMemo(
    () => fighters.find((fighter) => fighter.id === selectedFighterId) ?? fighters[0],
    [selectedFighterId],
  );
  const selectedOpponent = useMemo(
    () => fighters.find((fighter) => fighter.id === selectedOpponentId) ?? fighters[1] ?? fighters[0],
    [selectedOpponentId],
  );
  const selectedArena = useMemo(() => getArena(selectedArenaId), [selectedArenaId]);
  const ctaLabel = step === "fighters"
    ? "Select Stage"
    : mode === "training"
      ? "Start Training"
      : "Start Fight";
  const ctaHref = selectedFighter && selectedOpponent && step === "stage"
    ? buildFightHref(
        mode,
        selectedFighter.id,
        selectedOpponent.id,
        selectedArena.id,
      )
    : undefined;
  const matchupLabel = mode === "training"
    ? `${selectedFighter?.name ?? ""} vs ${selectedOpponent?.name ?? ""}`
    : `${selectedFighter?.name ?? ""} vs Random`;
  const matchupHint = mode === "training"
    ? "Matchup locked. Pick the arena."
    : "Opponent is rolled when the fight starts.";

  useEffect(() => {
    let cancelled = false;

    async function loadHeadshots() {
      const headshotEntries = await Promise.all(
        fighters.map(async (fighter) => [fighter.id, await discoverHeadshotSource(fighter)] as const),
      );

      if (cancelled) {
        return;
      }

      setHeadshots(Object.fromEntries(headshotEntries));
    }

    void loadHeadshots();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      if (event.code === "Escape" || isMenuBackKey(event)) {
        event.preventDefault();
        if (step === "stage") {
          setStep("fighters");
          return;
        }

        router.push("/");
        return;
      }

      if (step === "fighters") {
        if (mode === "training") {
          if (isMenuLeftKey(event)) {
            event.preventDefault();
            setActiveRoster("fighter");
            return;
          }

          if (isMenuRightKey(event)) {
            event.preventDefault();
            setActiveRoster("opponent");
            return;
          }
        }

        if (isMenuUpKey(event) || (mode !== "training" && isMenuLeftKey(event))) {
          event.preventDefault();
          const currentId = activeRoster === "opponent" ? selectedOpponentId : selectedFighterId;
          const currentIndex = fighters.findIndex((fighter) => fighter.id === currentId);
          const nextIndex = getWrappedIndex(currentIndex, -1, fighters.length);
          const nextId = fighters[nextIndex]?.id;
          if (!nextId) {
            return;
          }

          if (activeRoster === "opponent" && mode === "training") {
            setSelectedOpponentId(nextId);
          } else {
            setSelectedFighterId(nextId);
          }
          return;
        }

        if (isMenuDownKey(event) || (mode !== "training" && isMenuRightKey(event))) {
          event.preventDefault();
          const currentId = activeRoster === "opponent" ? selectedOpponentId : selectedFighterId;
          const currentIndex = fighters.findIndex((fighter) => fighter.id === currentId);
          const nextIndex = getWrappedIndex(currentIndex, 1, fighters.length);
          const nextId = fighters[nextIndex]?.id;
          if (!nextId) {
            return;
          }

          if (activeRoster === "opponent" && mode === "training") {
            setSelectedOpponentId(nextId);
          } else {
            setSelectedFighterId(nextId);
          }
          return;
        }

        if (isMenuConfirmKey(event)) {
          event.preventDefault();
          setStep("stage");
        }
        return;
      }

      if (isMenuUpKey(event) || isMenuLeftKey(event)) {
        event.preventDefault();
        const currentIndex = arenas.findIndex((arena) => arena.id === selectedArenaId);
        const nextIndex = getWrappedIndex(currentIndex, -1, arenas.length);
        const nextId = arenas[nextIndex]?.id;
        if (nextId) {
          setSelectedArenaId(nextId);
        }
        return;
      }

      if (isMenuDownKey(event) || isMenuRightKey(event)) {
        event.preventDefault();
        const currentIndex = arenas.findIndex((arena) => arena.id === selectedArenaId);
        const nextIndex = getWrappedIndex(currentIndex, 1, arenas.length);
        const nextId = arenas[nextIndex]?.id;
        if (nextId) {
          setSelectedArenaId(nextId);
        }
        return;
      }

      if (isMenuConfirmKey(event) && ctaHref) {
        event.preventDefault();
        router.push(ctaHref);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [
    activeRoster,
    ctaHref,
    mode,
    router,
    selectedArenaId,
    selectedFighterId,
    selectedOpponentId,
    step,
  ]);

  if (!selectedFighter || !selectedOpponent) {
    return null;
  }

  if (step === "stage") {
    return (
      <div className="fight-stage-select">
        <div className="fight-stage-select-head">
          <div className="fight-stage-select-kicker">Stage Select</div>
          <div className="fight-stage-select-title">{matchupLabel}</div>
          <div className="fight-stage-select-subtitle">{matchupHint}</div>
        </div>

        <div className="fight-stage-select-grid" role="list" aria-label="Arena list">
          {arenas.map((arena) => (
            <StageOptionCard
              key={arena.id}
              arena={arena}
              selected={arena.id === selectedArena.id}
              onSelect={() => setSelectedArenaId(arena.id)}
            />
          ))}
        </div>

        <div className="fight-character-select-actions">
          <ArcadeMenuItem className="fight-character-select-back" onClick={() => setStep("fighters")}>
            {"<"}
          </ArcadeMenuItem>
          <ArcadeMenuItem cta href={ctaHref} className="fight-character-select-cta">
            {ctaLabel}
          </ArcadeMenuItem>
        </div>
        <MenuControlsHint />
      </div>
    );
  }

  return (
    <div className={`fight-character-select fight-character-select-${mode}`}>
      <div
        className={`fight-character-select-roster fight-character-select-roster-left${activeRoster === "fighter" ? " fight-character-select-roster-active" : ""}`}
        role="list"
        aria-label="Player roster"
      >
        {fighters.map((fighter) => (
          <button
            key={fighter.id}
            type="button"
            className={`fight-character-select-headshot-button${fighter.id === selectedFighter.id ? " fight-character-select-headshot-button-active" : ""}${activeRoster === "fighter" && fighter.id === selectedFighter.id ? " fight-character-select-headshot-button-cursor" : ""}`}
            onClick={() => {
              setActiveRoster("fighter");
              setSelectedFighterId(fighter.id);
            }}
          >
            {headshots[fighter.id] ? (
              <img src={headshots[fighter.id] ?? undefined} alt={fighter.name} className="fight-hud-headshot fight-character-select-headshot" />
            ) : (
              <div className="fight-hud-headshot fight-hud-headshot-placeholder" />
            )}
          </button>
        ))}
      </div>

      <div className="fight-character-select-preview fight-character-select-preview-left">
        <CharacterPreview fighter={selectedFighter} facing="right" />
      </div>

      {mode === "training" ? (
        <>
          <div className="fight-character-select-versus">VS</div>
          <div className="fight-character-select-preview fight-character-select-preview-right">
            <CharacterPreview fighter={selectedOpponent} facing="left" />
          </div>
          <div
            className={`fight-character-select-roster fight-character-select-roster-right${activeRoster === "opponent" ? " fight-character-select-roster-active" : ""}`}
            role="list"
            aria-label="Opponent roster"
          >
            {fighters.map((fighter) => (
              <button
                key={`${fighter.id}-opponent`}
                type="button"
                className={`fight-character-select-headshot-button fight-character-select-headshot-button-right${fighter.id === selectedOpponent.id ? " fight-character-select-headshot-button-active" : ""}${activeRoster === "opponent" && fighter.id === selectedOpponent.id ? " fight-character-select-headshot-button-cursor" : ""}`}
                onClick={() => {
                  setActiveRoster("opponent");
                  setSelectedOpponentId(fighter.id);
                }}
              >
                {headshots[fighter.id] ? (
                  <img src={headshots[fighter.id] ?? undefined} alt={fighter.name} className="fight-hud-headshot fight-character-select-headshot" />
                ) : (
                  <div className="fight-hud-headshot fight-hud-headshot-placeholder" />
                )}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="fight-character-select-actions">
        <ArcadeMenuItem href="/" className="fight-character-select-back">
          {"<"}
        </ArcadeMenuItem>
        <ArcadeMenuItem cta className="fight-character-select-cta" onClick={() => setStep("stage")}>
          {ctaLabel}
        </ArcadeMenuItem>
      </div>
      <MenuControlsHint />
    </div>
  );
}
