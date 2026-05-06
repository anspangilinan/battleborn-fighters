import type { CharacterDefinition, SpriteAnimationStance } from "@battleborn/game-core";

import {
  getFighterAnimationDirectories,
  getFighterHeadshotCandidates,
  getFighterPortraitCandidates,
} from "@/lib/fighter-assets";

type VisualAwareFighter = Pick<CharacterDefinition, "id" | "name" | "sprites">;

const MAX_FRAME_SCAN = 24;
const MAX_CONSECUTIVE_MISSING_FRAMES_AFTER_START = 2;
const imageAvailabilityPromiseCache = new Map<string, Promise<boolean>>();
const stanceFramePromiseCache = new Map<string, Promise<string[]>>();
const portraitSourcePromiseCache = new Map<string, Promise<string | null>>();
const headshotSourcePromiseCache = new Map<string, Promise<string | null>>();
const frameSetPromiseCache = new Map<string, Promise<string[]>>();

export function preloadImage(src: string) {
  const normalizedSrc = src.trim();
  const cached = imageAvailabilityPromiseCache.get(normalizedSrc);
  if (cached) {
    return cached;
  }

  const nextPromise = new Promise<boolean>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = normalizedSrc;
  });

  imageAvailabilityPromiseCache.set(normalizedSrc, nextPromise);
  return nextPromise;
}

export async function discoverImageSource(
  candidates: Array<string | null | undefined>,
) {
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

export function loadSequentialFrameSet(assetBasePath: string) {
  const normalizedBasePath = assetBasePath.trim();
  const cached = frameSetPromiseCache.get(normalizedBasePath);
  if (cached) {
    return cached;
  }

  const nextPromise = (async () => {
    const namingStrategies = [
      (index: number) => `${String(index + 1).padStart(2, "0")}.png`,
      (index: number) => `${index}.png`,
      (index: number) => `${index + 1}.png`,
    ];

    for (const getFrameName of namingStrategies) {
      const discoveredFrames: string[] = [];
      let consecutiveMissingFrames = 0;
      for (let index = 0; index < MAX_FRAME_SCAN; index += 1) {
        const src = `${normalizedBasePath}${getFrameName(index)}`;
        const exists = await preloadImage(src);
        if (!exists) {
          if (discoveredFrames.length === 0) {
            break;
          }

          consecutiveMissingFrames += 1;
          if (
            consecutiveMissingFrames >=
            MAX_CONSECUTIVE_MISSING_FRAMES_AFTER_START
          ) {
            break;
          }
          continue;
        }
        consecutiveMissingFrames = 0;
        discoveredFrames.push(src);
      }

      if (discoveredFrames.length > 0) {
        return discoveredFrames;
      }
    }

    return [];
  })().catch((error) => {
    frameSetPromiseCache.delete(normalizedBasePath);
    throw error;
  });

  frameSetPromiseCache.set(normalizedBasePath, nextPromise);
  return nextPromise;
}

export async function discoverStanceFrames(
  fighter: VisualAwareFighter,
  stance: SpriteAnimationStance,
) {
  for (const directory of getFighterAnimationDirectories(fighter, stance)) {
    const frames = await loadSequentialFrameSet(directory);
    if (frames.length > 0) {
      return frames;
    }
  }

  return [];
}

export function getCachedStanceFrames(
  fighter: VisualAwareFighter,
  stance: SpriteAnimationStance,
) {
  const cacheKey = `${fighter.id}:${stance}`;
  const cached = stanceFramePromiseCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const nextPromise = discoverStanceFrames(fighter, stance).catch((error) => {
    stanceFramePromiseCache.delete(cacheKey);
    throw error;
  });
  stanceFramePromiseCache.set(cacheKey, nextPromise);
  return nextPromise;
}

export function getCachedIdleFrames(fighter: VisualAwareFighter) {
  return getCachedStanceFrames(fighter, "idle");
}

export function getCachedPortraitSource(fighter: VisualAwareFighter) {
  const cached = portraitSourcePromiseCache.get(fighter.id);
  if (cached) {
    return cached;
  }

  const nextPromise = discoverImageSource(getFighterPortraitCandidates(fighter)).catch(
    (error) => {
      portraitSourcePromiseCache.delete(fighter.id);
      throw error;
    },
  );
  portraitSourcePromiseCache.set(fighter.id, nextPromise);
  return nextPromise;
}

export function getCachedHeadshotSource(fighter: VisualAwareFighter) {
  const cached = headshotSourcePromiseCache.get(fighter.id);
  if (cached) {
    return cached;
  }

  const nextPromise = discoverImageSource(getFighterHeadshotCandidates(fighter)).catch(
    (error) => {
      headshotSourcePromiseCache.delete(fighter.id);
      throw error;
    },
  );
  headshotSourcePromiseCache.set(fighter.id, nextPromise);
  return nextPromise;
}

type PrimeFighterVisualCacheOptions = {
  headshot?: boolean;
  idle?: boolean;
  portrait?: boolean;
  stances?: SpriteAnimationStance[];
};

export async function primeFighterVisualCaches(
  fighters: VisualAwareFighter[],
  {
    headshot = false,
    idle = false,
    portrait = false,
    stances = [],
  }: PrimeFighterVisualCacheOptions = {},
) {
  const uniqueFighters = Array.from(
    new Map(fighters.map((fighter) => [fighter.id, fighter])).values(),
  );

  await Promise.all(
    uniqueFighters.flatMap((fighter) => {
      const tasks: Array<Promise<unknown>> = [];

      if (idle) {
        tasks.push(getCachedIdleFrames(fighter));
      }

      for (const stance of stances) {
        tasks.push(getCachedStanceFrames(fighter, stance));
      }

      if (portrait) {
        tasks.push(getCachedPortraitSource(fighter));
      }

      if (headshot) {
        tasks.push(getCachedHeadshotSource(fighter));
      }

      return tasks;
    }),
  );
}
