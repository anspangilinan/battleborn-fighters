"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { fighterRoster } from "@battleborn/content";

import { ArcadeMenuItem } from "@/components/arcade-menu-item";

const fighters = Object.values(fighterRoster);
const MAX_IDLE_FRAME_SCAN = 24;
const IDLE_FRAME_MS = 120;

type FightCharacterSelectProps = {
  mode: "local" | "training";
  initialFighterId?: string;
  initialOpponentId?: string;
};

type CharacterPreviewProps = {
  fighter: (typeof fighters)[number];
  facing: "left" | "right";
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
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadIdleAnimation() {
      if (!fighter) {
        setIdleFrames([]);
        setCurrentFrame(0);
        return;
      }

      setIdleFrames([]);
      setCurrentFrame(0);
      const discoveredFrames = await discoverIdleFrames(fighter);

      if (cancelled) {
        return;
      }

      setIdleFrames(discoveredFrames);
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

  return idleFrames[currentFrame] ?? null;
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
      <p className="fight-character-select-name">{fighter.name}</p>
    </div>
  );
}

export function FightCharacterSelect({
  mode,
  initialFighterId,
  initialOpponentId,
}: FightCharacterSelectProps) {
  const router = useRouter();
  const [selectedFighterId, setSelectedFighterId] = useState(() =>
    initialFighterId && fighterRoster[initialFighterId] ? initialFighterId : fighters[0]?.id ?? "",
  );
  const [selectedOpponentId, setSelectedOpponentId] = useState(() =>
    initialOpponentId && fighterRoster[initialOpponentId]
      ? initialOpponentId
      : fighters.find((fighter) => fighter.id !== initialFighterId)?.id ?? fighters[0]?.id ?? "",
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
      if (event.key !== "Escape" || event.repeat) {
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

  if (!selectedFighter || !selectedOpponent) {
    return null;
  }

  const ctaLabel = mode === "training" ? "Go To Training" : "Fight";
  const ctaHref = mode === "training"
    ? `/fight?mode=training&fighter=${selectedFighter.id}&opponent=${selectedOpponent.id}`
    : `/fight?mode=local&fighter=${selectedFighter.id}`;

  return (
    <div className={`fight-character-select fight-character-select-${mode}`}>
      <div className="fight-character-select-roster fight-character-select-roster-left" role="list" aria-label="Player roster">
        {fighters.map((fighter) => (
          <button
            key={fighter.id}
            type="button"
            className={`fight-character-select-headshot-button${fighter.id === selectedFighter.id ? " fight-character-select-headshot-button-active" : ""}`}
            onClick={() => setSelectedFighterId(fighter.id)}
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
          <div className="fight-character-select-roster fight-character-select-roster-right" role="list" aria-label="Opponent roster">
            {fighters.map((fighter) => (
              <button
                key={`${fighter.id}-opponent`}
                type="button"
                className={`fight-character-select-headshot-button fight-character-select-headshot-button-right${fighter.id === selectedOpponent.id ? " fight-character-select-headshot-button-active" : ""}`}
                onClick={() => setSelectedOpponentId(fighter.id)}
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
        <ArcadeMenuItem cta href={ctaHref} className="fight-character-select-cta">
          {ctaLabel}
        </ArcadeMenuItem>
      </div>
    </div>
  );
}
