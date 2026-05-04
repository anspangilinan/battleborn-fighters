"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { fighterRoster } from "@battleborn/content";
import { getFighterAnimationDirectories } from "@/lib/fighter-assets";
import { isMenuBackKey } from "@/lib/menu-input";

const fighters = Object.values(fighterRoster);
const defaultSelectedFighterIds = fighters.map((entry) => entry.id);

const animationStances = [
  "idle",
  "walk",
  "jump",
  "block",
  "dash",
  "hurt",
  "ko",
  "win",
  "attack1",
  "attack2",
  "special",
  "special-pose",
] as const;
type AnimationStanceId = (typeof animationStances)[number];

const previewOptions = [
  { id: "idle", label: "Idle" },
  { id: "walk", label: "Walk" },
  { id: "jump", label: "Jump" },
  { id: "block", label: "Block" },
  { id: "dash", label: "Dash" },
  { id: "hurt", label: "Hurt" },
  { id: "ko", label: "KO" },
  { id: "win", label: "Win" },
  { id: "attack1", label: "Attack 1" },
  { id: "attack2", label: "Attack 2" },
  { id: "special", label: "Special" },
  { id: "special-pose", label: "Special Pose" },
  { id: "special-sequence", label: "Special Seq" },
] as const;
type PreviewId = (typeof previewOptions)[number]["id"];
type FighterFrameState = Record<string, string[] | null>;

const MAX_FRAME_SCAN = 24;
const FRAME_DURATION_MS = 120;

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

function isAnimationStanceId(value: PreviewId): value is AnimationStanceId {
  return animationStances.includes(value as AnimationStanceId);
}

function buildProgressFrames(frameSources: string[], duration: number) {
  if (duration <= 0 || frameSources.length === 0) {
    return [];
  }

  if (frameSources.length === 1 || duration === 1) {
    return Array.from({ length: duration }, () => frameSources[0]);
  }

  return Array.from({ length: duration }, (_, index) => {
    const frameIndex = Math.floor(
      (index * (frameSources.length - 1)) / Math.max(1, duration - 1),
    );
    return frameSources[frameIndex];
  });
}

function buildLoopFrames(
  frameSources: string[],
  duration: number,
  frameDuration: number,
) {
  if (duration <= 0 || frameSources.length === 0) {
    return [];
  }

  return Array.from({ length: duration }, (_, index) => (
    frameSources[Math.floor(index / Math.max(1, frameDuration)) % frameSources.length]
  ));
}

function repeatLastFrame(frameSources: string[], duration: number) {
  if (duration <= 0 || frameSources.length === 0) {
    return [];
  }

  const lastFrameSource = frameSources[frameSources.length - 1];
  return Array.from({ length: duration }, () => lastFrameSource);
}

async function discoverFrameSources(
  fighter: (typeof fighters)[number],
  stance: AnimationStanceId,
) {
  for (const directory of getFighterAnimationDirectories(fighter, stance)) {
    const frames = await loadSequentialFrames(directory);
    if (frames.length > 0) {
      return frames;
    }
  }

  return [];
}

function buildSpecialSequenceFrames(
  fighter: (typeof fighters)[number],
  specialSources: string[],
  specialPoseSources: string[],
) {
  const move = fighter.moves.special;
  if (!move || specialSources.length === 0) {
    return [];
  }

  const specialSequence = move.specialSequence;
  if (!specialSequence) {
    return specialSources;
  }

  const totalFrames = Math.max(1, move.startup + move.active + move.recovery);
  const buildUpDuration = Math.max(1, Math.min(specialSequence.buildUpFrames, totalFrames));
  const pauseFrames = Math.max(0, specialSequence.pauseFrames ?? 0);
  const zoomOutFrames = Math.max(0, specialSequence.zoomOutFrames ?? 0);
  const usesDedicatedPose =
    specialSequence.buildUpAnimation === "special-pose" &&
    specialPoseSources.length > 0;
  const buildUpSourcePool = usesDedicatedPose ? specialPoseSources : specialSources;
  const buildUpSourceCount = usesDedicatedPose
    ? buildUpSourcePool.length
    : Math.min(
        buildUpSourcePool.length,
        Math.max(1, specialSequence.animationBuildUpFrames ?? buildUpDuration),
      );
  const buildUpSources = buildUpSourcePool.slice(0, Math.max(1, buildUpSourceCount));
  const buildUpFrames = buildProgressFrames(buildUpSources, buildUpDuration);

  if (specialSequence.animationMode === "loop") {
    const loopDuration =
      pauseFrames +
      zoomOutFrames +
      Math.max(1, totalFrames - buildUpDuration);
    const loopFrames = buildLoopFrames(
      specialSources,
      loopDuration,
      Math.max(1, specialSequence.loopFrameDuration ?? 4),
    );
    return [...buildUpFrames, ...loopFrames];
  }

  const followThroughSources = (
    usesDedicatedPose
      ? specialSources
      : specialSources.slice(buildUpSources.length)
  );
  const resolvedFollowThroughSources = followThroughSources.length > 0
    ? followThroughSources
    : [specialSources[specialSources.length - 1]];
  const followThroughDuration = Math.max(1, totalFrames - buildUpDuration);
  const pauseHoldFrames = repeatLastFrame(buildUpSources, pauseFrames);
  const zoomOutSequenceFrames = specialSequence.completeAnimationDuringZoomOut
    ? buildProgressFrames(resolvedFollowThroughSources, zoomOutFrames)
    : repeatLastFrame(buildUpSources, zoomOutFrames);
  const followThroughFrames = specialSequence.completeAnimationDuringZoomOut
    ? repeatLastFrame(resolvedFollowThroughSources, followThroughDuration)
    : buildProgressFrames(resolvedFollowThroughSources, followThroughDuration);

  return [
    ...buildUpFrames,
    ...pauseHoldFrames,
    ...zoomOutSequenceFrames,
    ...followThroughFrames,
  ];
}

async function discoverPreviewFrameSources(
  fighter: (typeof fighters)[number],
  previewId: PreviewId,
) {
  if (isAnimationStanceId(previewId)) {
    return discoverFrameSources(fighter, previewId);
  }

  const [specialSources, specialPoseSources] = await Promise.all([
    discoverFrameSources(fighter, "special"),
    discoverFrameSources(fighter, "special-pose"),
  ]);

  return buildSpecialSequenceFrames(fighter, specialSources, specialPoseSources);
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
  const [previewId, setPreviewId] = useState<PreviewId>("walk");
  const [frameSourcesByFighter, setFrameSourcesByFighter] = useState<FighterFrameState>({});
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const selectedPreview = previewOptions.find((entry) => entry.id === previewId) ?? previewOptions[0];

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
          const discoveredFrames = await discoverPreviewFrameSources(fighter, previewId);
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
  }, [previewId, selectedFighterIds]);

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
      if (event.repeat || (event.key !== "Escape" && !isMenuBackKey(event))) {
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
              {previewOptions.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`animation-stance-button${previewId === entry.id ? " animation-stance-button-active" : ""}`}
                  aria-pressed={previewId === entry.id}
                  onClick={() => setPreviewId(entry.id)}
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
                    title={`${fighter.name} · ${selectedPreview.label}`}
                  >
                    {isFighterLoading ? (
                      <div className="animation-loading" aria-label={`Loading ${fighter.name} ${selectedPreview.label}`}>
                        <span className="animation-spinner" aria-hidden="true" />
                      </div>
                    ) : isAnimationMissing ? (
                      <div className="animation-missing" aria-label={`${fighter.name} has no ${selectedPreview.label} animation`}>
                        <span className="animation-missing-icon" aria-hidden="true">
                          <span className="animation-missing-icon-frame" />
                          <span className="animation-missing-icon-slash" />
                        </span>
                      </div>
                    ) : (
                      <img
                        src={currentSource}
                        alt={`${fighter.name} ${selectedPreview.label}`}
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
