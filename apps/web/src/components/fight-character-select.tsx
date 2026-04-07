"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { fighterRoster } from "@battleborn/content";

import { ArcadeMenuItem } from "@/components/arcade-menu-item";
import { FightDisplayName } from "@/components/fight-display-name";
import { MenuControlsHint } from "@/components/menu-controls";
import {
  arenas,
  defaultArenaId,
  getArena,
  isArenaId,
  pickRandomArenaId,
  type ArenaDefinition,
} from "@/lib/arenas";
import {
  getFighterSelectionLabel,
  isRandomFighterSelection,
  isSelectableFighterSelection,
  randomFighterSelectionId,
} from "@/lib/fighter-select";
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
const fighterSelectOptionIds = [...fighters.map((fighter) => fighter.id), randomFighterSelectionId];
const MAX_IDLE_FRAME_SCAN = 24;
const IDLE_FRAME_MS = 120;
const RANDOM_CYCLE_MS = 90;

type FightCharacterSelectProps = {
  mode: "local" | "training" | "arcade";
  initialFighterId?: string;
  initialOpponentId?: string;
  initialArenaId?: string;
  initialStep?: FightCharacterSelectStep;
};

type FightCharacterSelectStep = "fighters" | "stage";

type CharacterPreviewProps = {
  fighter?: (typeof fighters)[number];
  facing: "left" | "right";
  label?: string;
  plainLabel?: boolean;
  portraitOnly?: boolean;
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

function useRosterCycle(active: boolean, startingOffset = 0) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (fighters.length === 0) {
      return 0;
    }

    const normalizedOffset = ((startingOffset % fighters.length) + fighters.length) % fighters.length;
    return normalizedOffset;
  });

  useEffect(() => {
    if (!active || fighters.length === 0) {
      return;
    }

    setCurrentIndex(() => (Math.floor(Math.random() * fighters.length) + startingOffset) % fighters.length);

    if (fighters.length === 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentIndex((previous) => (previous + 1) % fighters.length);
    }, RANDOM_CYCLE_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [active, startingOffset]);

  return fighters[currentIndex];
}

function CharacterPreview({
  fighter,
  facing,
  label,
  plainLabel = false,
  portraitOnly = false,
}: CharacterPreviewProps) {
  const currentIdleFrame = useIdleAnimation(portraitOnly ? undefined : fighter);

  if (!fighter) {
    return null;
  }

  const currentSprite = portraitOnly ? fighter.sprites.portrait : currentIdleFrame;
  const displayName = label ?? fighter.name;

  return (
    <div className="fight-character-select-preview-stack">
      <div className={`fight-character-select-stage fight-character-select-stage-${facing}`}>
        {currentSprite ? (
          <img
            src={currentSprite}
            alt={fighter.name}
            className={`fight-character-select-preview-image fight-character-select-preview-image-${facing}`}
            style={{ height: `${(fighter.sprites.renderHeight ?? 168) * 4}px` }}
          />
        ) : (
          <div className="animation-spinner" aria-hidden="true" />
        )}
      </div>
      {plainLabel ? (
        <span className="fight-character-select-name fight-character-select-name-plain">
          {displayName}
        </span>
      ) : (
        <FightDisplayName className="fight-character-select-name" name={displayName} />
      )}
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
  mode: "local" | "training" | "arcade",
  fighterId: string,
  opponentId: string,
  arenaId: string,
  arcadeOrder: string[] = [],
) {
  const params = new URLSearchParams({
    mode,
    fighter: fighterId,
    arena: arenaId,
  });

  if (mode === "training") {
    params.set("opponent", opponentId);
  } else if (mode === "arcade") {
    if (arcadeOrder.length > 0 && !isRandomFighterSelection(fighterId)) {
      params.set("arcadeOrder", arcadeOrder.join(","));
      params.set("arcadeIndex", "0");
      params.set("opponent", arcadeOrder[0] ?? fighterId);
    } else if (!isRandomFighterSelection(fighterId)) {
      params.set("opponent", fighterId);
    }
  }

  return `/fight?${params.toString()}`;
}

function shuffleFighterIds(fighterIds: string[]) {
  const shuffledIds = [...fighterIds];

  for (let index = shuffledIds.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffledIds[index], shuffledIds[swapIndex]] = [shuffledIds[swapIndex], shuffledIds[index]];
  }

  return shuffledIds;
}

export function FightCharacterSelect({
  mode,
  initialFighterId,
  initialOpponentId,
  initialArenaId,
  initialStep = "fighters",
}: FightCharacterSelectProps) {
  const router = useRouter();
  const defaultFighter = fighters[0];
  const defaultOpponent = fighters[1] ?? fighters[0];
  const [step, setStep] = useState<FightCharacterSelectStep>(
    mode === "arcade" ? "fighters" : initialStep,
  );
  const [activeRoster, setActiveRoster] = useState<"fighter" | "opponent">("fighter");
  const [selectedFighterId, setSelectedFighterId] = useState(() =>
    isSelectableFighterSelection(initialFighterId)
      ? initialFighterId
      : defaultFighter?.id ?? "",
  );
  const [selectedOpponentId, setSelectedOpponentId] = useState(() =>
    isSelectableFighterSelection(initialOpponentId)
      ? initialOpponentId
      : fighters.find((fighter) => fighter.id !== initialFighterId)?.id ??
        defaultOpponent?.id ??
        "",
  );
  const [selectedArenaId, setSelectedArenaId] = useState(() =>
    initialArenaId && isArenaId(initialArenaId) ? initialArenaId : defaultArenaId,
  );
  const [headshots, setHeadshots] = useState<Record<string, string | null>>({});
  const [hoveredRandomRoster, setHoveredRandomRoster] = useState<
    "fighter" | "opponent" | null
  >(null);

  const selectedFighter = useMemo(
    () => fighters.find((fighter) => fighter.id === selectedFighterId) ?? null,
    [selectedFighterId],
  );
  const selectedOpponent = useMemo(
    () => fighters.find((fighter) => fighter.id === selectedOpponentId) ?? null,
    [selectedOpponentId],
  );
  const selectedArena = useMemo(() => getArena(selectedArenaId), [selectedArenaId]);
  const arcadeOrder = useMemo(
    () => mode === "arcade" && !isRandomFighterSelection(selectedFighterId)
      ? shuffleFighterIds(
          fighters
            .map((fighter) => fighter.id)
            .filter((fighterId) => fighterId !== selectedFighterId),
        )
      : [],
    [mode, selectedFighterId],
  );
  const arcadeArenaId = useMemo(
    () => (mode === "arcade" ? pickRandomArenaId() : selectedArena.id),
    [mode, selectedArena.id, selectedFighterId],
  );
  const showFighterRandomCycle =
    hoveredRandomRoster === "fighter" || isRandomFighterSelection(selectedFighterId);
  const showOpponentRandomCycle =
    hoveredRandomRoster === "opponent" || isRandomFighterSelection(selectedOpponentId);
  const fighterRandomPreview = useRosterCycle(showFighterRandomCycle);
  const opponentRandomPreview = useRosterCycle(
    showOpponentRandomCycle,
    Math.max(1, Math.floor(fighters.length / 2)),
  );
  const previewFighter = showFighterRandomCycle ? fighterRandomPreview ?? defaultFighter : selectedFighter ?? defaultFighter;
  const previewOpponent = showOpponentRandomCycle ? opponentRandomPreview ?? defaultOpponent : selectedOpponent ?? defaultOpponent;
  const ctaLabel = step === "fighters"
    ? mode === "arcade"
      ? "Start Arcade"
      : "Select Stage"
    : mode === "training"
      ? "Start Training"
    : mode === "arcade"
        ? "Start Arcade"
      : "Start Fight";
  const ctaHref = mode === "arcade" || step === "stage"
    ? buildFightHref(
        mode,
        selectedFighterId,
        selectedOpponentId,
        arcadeArenaId,
        arcadeOrder,
      )
    : undefined;
  const matchupLabel = mode === "training"
    ? `${getFighterSelectionLabel(selectedFighterId)} vs ${getFighterSelectionLabel(selectedOpponentId)}`
    : mode === "arcade"
      ? `${getFighterSelectionLabel(selectedFighterId)} vs Arcade`
      : `${getFighterSelectionLabel(selectedFighterId)} vs Random`;
  const matchupHint = mode === "training"
    ? "Matchup locked. Pick the arena."
    : mode === "arcade"
      ? "Arcade seeds the ladder on start and randomizes the stage each match."
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
          const currentIndex = fighterSelectOptionIds.indexOf(currentId);
          const nextIndex = getWrappedIndex(
            currentIndex >= 0 ? currentIndex : 0,
            -1,
            fighterSelectOptionIds.length,
          );
          const nextId = fighterSelectOptionIds[nextIndex];
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
          const currentIndex = fighterSelectOptionIds.indexOf(currentId);
          const nextIndex = getWrappedIndex(
            currentIndex >= 0 ? currentIndex : 0,
            1,
            fighterSelectOptionIds.length,
          );
          const nextId = fighterSelectOptionIds[nextIndex];
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
          if (mode === "arcade" && ctaHref) {
            router.push(ctaHref);
            return;
          }

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

  if (!defaultFighter || !defaultOpponent) {
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
            className={`fight-character-select-headshot-button${fighter.id === selectedFighterId ? " fight-character-select-headshot-button-active" : ""}${activeRoster === "fighter" && fighter.id === selectedFighterId ? " fight-character-select-headshot-button-cursor" : ""}`}
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
        <button
          type="button"
          className={`fight-character-select-headshot-button${isRandomFighterSelection(selectedFighterId) ? " fight-character-select-headshot-button-active" : ""}${activeRoster === "fighter" && isRandomFighterSelection(selectedFighterId) ? " fight-character-select-headshot-button-cursor" : ""}`}
          onMouseEnter={() => setHoveredRandomRoster("fighter")}
          onMouseLeave={() => setHoveredRandomRoster((current) => current === "fighter" ? null : current)}
          onClick={() => {
            setActiveRoster("fighter");
            setSelectedFighterId(randomFighterSelectionId);
          }}
          aria-label="Random fighter"
        >
          <div className="fight-hud-headshot fight-character-select-headshot fight-character-select-random-headshot">
            <span className="fight-character-select-random-headshot-glyph">?</span>
          </div>
        </button>
      </div>

      <div className="fight-character-select-preview fight-character-select-preview-left">
        <CharacterPreview
          fighter={previewFighter ?? undefined}
          facing="right"
          label={showFighterRandomCycle ? "Random" : undefined}
          plainLabel={showFighterRandomCycle}
          portraitOnly={showFighterRandomCycle}
        />
      </div>

      {mode === "training" ? (
        <>
          <div className="fight-character-select-versus">VS</div>
          <div className="fight-character-select-preview fight-character-select-preview-right">
            <CharacterPreview
              fighter={previewOpponent ?? undefined}
              facing="left"
              label={showOpponentRandomCycle ? "Random" : undefined}
              plainLabel={showOpponentRandomCycle}
              portraitOnly={showOpponentRandomCycle}
            />
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
                className={`fight-character-select-headshot-button fight-character-select-headshot-button-right${fighter.id === selectedOpponentId ? " fight-character-select-headshot-button-active" : ""}${activeRoster === "opponent" && fighter.id === selectedOpponentId ? " fight-character-select-headshot-button-cursor" : ""}`}
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
            <button
              type="button"
              className={`fight-character-select-headshot-button fight-character-select-headshot-button-right${isRandomFighterSelection(selectedOpponentId) ? " fight-character-select-headshot-button-active" : ""}${activeRoster === "opponent" && isRandomFighterSelection(selectedOpponentId) ? " fight-character-select-headshot-button-cursor" : ""}`}
              onMouseEnter={() => setHoveredRandomRoster("opponent")}
              onMouseLeave={() => setHoveredRandomRoster((current) => current === "opponent" ? null : current)}
              onClick={() => {
                setActiveRoster("opponent");
                setSelectedOpponentId(randomFighterSelectionId);
              }}
              aria-label="Random opponent"
            >
              <div className="fight-hud-headshot fight-character-select-headshot fight-character-select-random-headshot">
                <span className="fight-character-select-random-headshot-glyph">?</span>
              </div>
            </button>
          </div>
        </>
      ) : null}

      <div className="fight-character-select-actions">
        <ArcadeMenuItem href="/" className="fight-character-select-back">
          {"<"}
        </ArcadeMenuItem>
        <ArcadeMenuItem
          cta
          className="fight-character-select-cta"
          href={mode === "arcade" ? ctaHref : undefined}
          onClick={mode === "arcade" ? undefined : () => setStep("stage")}
        >
          {ctaLabel}
        </ArcadeMenuItem>
      </div>
      <MenuControlsHint />
    </div>
  );
}
