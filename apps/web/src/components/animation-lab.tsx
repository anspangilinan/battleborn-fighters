"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { fighterRoster } from "@battleborn/content";

const fighters = Object.values(fighterRoster);
const defaultSelectedFighterIds = fighters.map((entry) => entry.id);

const stanceOptions = [
  { id: "idle", label: "Idle" },
  { id: "walk", label: "Walk" },
  { id: "jump", label: "Jump" },
  { id: "dash", label: "Dash" },
  { id: "hurt", label: "Hurt" },
  { id: "ko", label: "KO" },
  { id: "win", label: "Win" },
  { id: "attack1", label: "Attack 1" },
  { id: "attack2", label: "Attack 2" },
  { id: "special", label: "Special" },
] as const;
type StanceId = (typeof stanceOptions)[number]["id"];
type FighterFrameState = Record<string, string[] | null>;

const MAX_FRAME_SCAN = 24;
const FRAME_DURATION_MS = 120;

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

async function loadSequentialFrames(assetDirectory: string) {
  const namingStrategies = [
    (index: number) => `${String(index + 1).padStart(2, "0")}.png`,
    (index: number) => `${index}.png`,
    (index: number) => `${index + 1}.png`,
  ];

  for (const getFrameName of namingStrategies) {
    const discoveredFrames: string[] = [];
    for (let index = 0; index < MAX_FRAME_SCAN; index += 1) {
      const src = `${assetDirectory}${getFrameName(index)}`;
      // Stop on the first missing frame so each stance can stay sequential.
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

async function discoverFrameSources(fighterId: string, fighterName: string, stance: StanceId) {
  const candidateRoots = Array.from(new Set([fighterId, toAssetSegment(fighterName)]));
  const candidateDirectories = candidateRoots.flatMap((root) => [
    `/characters/${root}/animations/${stance}/`,
    `/characters/${root}/${stance}/`,
  ]);

  for (const directory of candidateDirectories) {
    const frames = await loadSequentialFrames(directory);
    if (frames.length > 0) {
      return frames;
    }
  }

  return [];
}

function orderFighterIds(fighterIds: string[]) {
  const selectedIds = new Set(fighterIds);
  return fighters.filter((entry) => selectedIds.has(entry.id)).map((entry) => entry.id);
}

function getCurrentFrameSource(frameSources: string[], currentFrame: number) {
  if (frameSources.length === 0) {
    return "";
  }

  return frameSources[currentFrame % frameSources.length];
}

export function AnimationLab() {
  const router = useRouter();
  const [selectedFighterIds, setSelectedFighterIds] = useState<string[]>(defaultSelectedFighterIds);
  const [stance, setStance] = useState<StanceId>("walk");
  const [frameSourcesByFighter, setFrameSourcesByFighter] = useState<FighterFrameState>({});
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const selectedFighters = useMemo(
    () => fighters.filter((entry) => selectedFighterIds.includes(entry.id)),
    [selectedFighterIds],
  );
  const maxFrameCount = selectedFighters.reduce(
    (highestFrameCount, fighter) => {
      const frameSources = frameSourcesByFighter[fighter.id];
      return Math.max(highestFrameCount, Array.isArray(frameSources) ? frameSources.length : 1);
    },
    1,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadFrames() {
      if (selectedFighterIds.length === 0) {
        setFrameSourcesByFighter({});
        setIsLoading(false);
        setCurrentFrame(0);
        return;
      }

      setIsLoading(true);
      setCurrentFrame(0);
      setFrameSourcesByFighter({});
      const selectedEntries = fighters.filter((entry) => selectedFighterIds.includes(entry.id));
      const frameEntries = await Promise.all(
        selectedEntries.map(async (fighter) => {
          const discoveredFrames = await discoverFrameSources(fighter.id, fighter.name, stance);
          return [fighter.id, discoveredFrames.length > 0 ? discoveredFrames : null] as const;
        }),
      );

      if (cancelled) {
        return;
      }

      setFrameSourcesByFighter(Object.fromEntries(frameEntries));
      setIsLoading(false);
    }

    void loadFrames();

    return () => {
      cancelled = true;
    };
  }, [selectedFighterIds, stance]);

  useEffect(() => {
    if (isLoading || maxFrameCount <= 1) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCurrentFrame((previous) => (previous + 1) % maxFrameCount);
    }, FRAME_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentFrame, isLoading, maxFrameCount]);

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

  const toggleFighter = (fighterId: string) => {
    setSelectedFighterIds((previous) => {
      if (previous.includes(fighterId)) {
        return previous.filter((entry) => entry !== fighterId);
      }

      return orderFighterIds([...previous, fighterId]);
    });
  };

  const handleSelectAll = () => {
    setSelectedFighterIds(defaultSelectedFighterIds);
  };

  const handleClearAll = () => {
    setSelectedFighterIds([]);
  };

  return (
    <div className="animation-lab">
      <section className="animation-panel">
        <div className="animation-panel-stack">
          <div className="animation-section">
            <div className="animation-panel-head">
              <div>
                <p className="panel-title">Characters</p>
                <p className="animation-selection-summary">
                  {selectedFighterIds.length} selected
                </p>
              </div>
              <div className="animation-link-actions">
                <button type="button" className="animation-text-link" onClick={handleSelectAll}>
                  Select all
                </button>
                <button type="button" className="animation-text-link" onClick={handleClearAll}>
                  Clear
                </button>
              </div>
            </div>

            <div className="animation-checkbox-list" role="group" aria-label="Select characters">
              {fighters.map((entry) => {
                const isSelected = selectedFighterIds.includes(entry.id);
                return (
                  <label key={entry.id} className="animation-checkbox-row">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleFighter(entry.id)}
                    />
                    <span>{entry.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="animation-section">
            <div>
              <p className="panel-title">Animations</p>
            </div>
            <div className="animation-stance-grid" role="group" aria-label="Select animation">
              {stanceOptions.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`animation-stance-button${stance === entry.id ? " animation-stance-button-active" : ""}`}
                  aria-pressed={stance === entry.id}
                  onClick={() => setStance(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="animation-preview" aria-busy={isLoading}>
        {selectedFighters.length === 0 ? (
          <div className="animation-empty">Select at least one character to preview.</div>
        ) : (
          <div className="animation-gallery">
            {selectedFighters.map((fighter) => {
              const frameSources = frameSourcesByFighter[fighter.id];
              const isFighterLoading = isLoading || typeof frameSources === "undefined";
              const isAnimationMissing = frameSources === null;
              const currentSource = Array.isArray(frameSources) ? getCurrentFrameSource(frameSources, currentFrame) : "";
              const renderHeight = fighter.sprites.renderHeight ?? 168;
              const stageHeight = renderHeight + 72;

              return (
                <div key={fighter.id} className="animation-gallery-item">
                  <div
                    className="animation-gallery-stage"
                    style={{ minHeight: `${stageHeight}px` }}
                    title={`${fighter.name} · ${stance}`}
                  >
                    {isFighterLoading ? (
                      <div className="animation-loading" aria-label={`Loading ${fighter.name} ${stance}`}>
                        <span className="animation-spinner" aria-hidden="true" />
                      </div>
                    ) : isAnimationMissing ? (
                      <div className="animation-missing" aria-label={`${fighter.name} has no ${stance} animation`}>
                        <span className="animation-missing-icon" aria-hidden="true">
                          <span className="animation-missing-icon-frame" />
                          <span className="animation-missing-icon-slash" />
                        </span>
                      </div>
                    ) : (
                      <img
                        src={currentSource}
                        alt={`${fighter.name} ${stance}`}
                        className="animation-sprite animation-sprite-render-height"
                        style={{ height: `${renderHeight}px` }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
