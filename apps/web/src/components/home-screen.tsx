"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { fighterRoster } from "@battleborn/content";

import { ArcadeMenuItem } from "@/components/arcade-menu-item";
import { MenuControlsHint } from "@/components/menu-controls";
import {
  getCachedHeadshotSource,
  getCachedIdleFrames,
  getCachedPortraitSource,
} from "@/lib/fighter-visuals";
import {
  getWrappedIndex,
  isMenuBackKey,
  isMenuConfirmKey,
  isMenuNextKey,
  isMenuPreviousKey,
} from "@/lib/menu-input";

const fighters = Object.values(fighterRoster);
const MENU_IDLE_FRAME_MS = 120;
const TITLE_ROSTER_SLOT_SPREAD = 96;
const TITLE_ROSTER_JITTER_X = 0.6;
const TITLE_ROSTER_JITTER_Y = 0.8;
const TITLE_ROSTER_BASE_TOP_PERCENT = -1.5;
const TITLE_ROSTER_DEPTH_RANGE = 0;

type HomeScreenStage = "title" | "menu";
type HomeScreenFighter = (typeof fighters)[number];

type MenuCharacterDisplayProps = {
  fighter: HomeScreenFighter | undefined;
  side: "left" | "right";
};

type TitleRosterPhotoSpriteProps = {
  facing: "left" | "right";
  fighter: HomeScreenFighter;
  height: number;
  leftPercent: number;
  topPercent: number;
  zIndex: number;
};

type TitleRosterLayoutEntry = TitleRosterPhotoSpriteProps;

type MenuEntry = {
  disabled?: boolean;
  href: string;
  label: string;
};

type HomeScreenProps = {
  showLab?: boolean;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function shuffleItems<T>(sourceItems: T[]) {
  const nextItems = [...sourceItems];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [
      nextItems[swapIndex],
      nextItems[index],
    ];
  }

  return nextItems;
}

function useAnimatedFighterSource(fighter: HomeScreenFighter | undefined) {
  const [frameSources, setFrameSources] = useState<string[]>([]);
  const [portraitSource, setPortraitSource] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadFrames() {
      if (!fighter) {
        setFrameSources([]);
        setPortraitSource(null);
        setCurrentFrame(0);
        return;
      }

      setFrameSources([]);
      setPortraitSource(null);
      setCurrentFrame(0);
      const [discoveredFrames, discoveredPortrait] = await Promise.all([
        getCachedIdleFrames(fighter),
        getCachedPortraitSource(fighter),
      ]);

      if (cancelled) {
        return;
      }

      setFrameSources(discoveredFrames);
      setPortraitSource(discoveredPortrait);
    }

    void loadFrames();

    return () => {
      cancelled = true;
    };
  }, [fighter]);

  useEffect(() => {
    if (frameSources.length <= 1) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCurrentFrame((previous) => (previous + 1) % frameSources.length);
    }, MENU_IDLE_FRAME_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentFrame, frameSources]);

  return frameSources[currentFrame] ?? portraitSource;
}

function getTitleSpriteHeight(fighter: HomeScreenFighter) {
  return clamp(
    Math.round((fighter.sprites.renderHeight ?? 96) * 1.44),
    123,
    195,
  );
}

function buildTitleRosterLayout(
  sourceFighters: HomeScreenFighter[],
): TitleRosterLayoutEntry[] {
  const shuffledFighters = shuffleItems(sourceFighters);
  const slotCount = shuffledFighters.length;
  const slotSpread = clamp(slotCount * 9.2, 52, TITLE_ROSTER_SLOT_SPREAD);
  const leftPercents = shuffleItems(
    Array.from({ length: slotCount }, (_, index) => {
      if (slotCount <= 1) {
        return 0;
      }

      return (index / (slotCount - 1) - 0.5) * slotSpread;
    }),
  );

  return shuffledFighters.map((fighter, index) => {
    const depth = Math.random();
    const baseLeftPercent = leftPercents[index] ?? 0;
    const sizePenalty = Math.max(0, slotCount - 8) * 3;
    const facing =
      Math.abs(baseLeftPercent) <= 3
        ? Math.random() > 0.5
          ? "left"
          : "right"
        : baseLeftPercent < 0
          ? "right"
          : "left";
    const topPercent =
      TITLE_ROSTER_BASE_TOP_PERCENT +
      depth * TITLE_ROSTER_DEPTH_RANGE +
      (Math.random() * TITLE_ROSTER_JITTER_Y * 2 - TITLE_ROSTER_JITTER_Y);

    return {
      facing,
      fighter,
      height: clamp(
        getTitleSpriteHeight(fighter) +
          Math.round(Math.random() * 8 - 4) -
          sizePenalty,
        114,
        195,
      ),
      leftPercent: Number(
        (
          baseLeftPercent +
          (Math.random() * TITLE_ROSTER_JITTER_X * 2 - TITLE_ROSTER_JITTER_X)
        ).toFixed(2),
      ),
      topPercent: Number(topPercent.toFixed(2)),
      zIndex: 12 + Math.round(depth * 12) + Math.round(topPercent / 5),
    };
  });
}

function MenuCharacterDisplay({ fighter, side }: MenuCharacterDisplayProps) {
  const currentSource = useAnimatedFighterSource(fighter);

  if (!fighter) {
    return null;
  }

  const renderHeight = (fighter.sprites.renderHeight ?? 168) * 2;

  return (
    <div className={`landing-menu-character landing-menu-character-${side}`}>
      {currentSource ? (
        <img
          src={currentSource}
          alt={fighter.name}
          className={`landing-menu-character-image landing-menu-character-image-${side}`}
          style={{ height: `${renderHeight}px` }}
        />
      ) : null}
    </div>
  );
}

function TitleRosterPhotoSprite({
  facing,
  fighter,
  height,
  leftPercent,
  topPercent,
  zIndex,
}: TitleRosterPhotoSpriteProps) {
  const currentSource = useAnimatedFighterSource(fighter);

  return (
    <div
      className="landing-title-roster-photo-member"
      aria-label={fighter.name}
      style={{
        left: `${50 + leftPercent}%`,
        top: `${50 + topPercent}%`,
        zIndex,
      }}
    >
      {currentSource ? (
        <img
          src={currentSource}
          alt={fighter.name}
          className={`landing-title-roster-photo-image landing-title-roster-photo-image-${facing}`}
          style={{ height: `${height}px` }}
        />
      ) : null}
    </div>
  );
}

function pickRandomMenuPair(previousPair?: [string, string]): [string, string] {
  if (fighters.length === 0) {
    return ["", ""];
  }

  if (fighters.length === 1) {
    return [fighters[0].id, fighters[0].id];
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const leftIndex = Math.floor(Math.random() * fighters.length);
    let rightIndex = Math.floor(Math.random() * fighters.length);
    while (rightIndex === leftIndex) {
      rightIndex = Math.floor(Math.random() * fighters.length);
    }

    const nextPair: [string, string] = [fighters[leftIndex].id, fighters[rightIndex].id];
    if (!previousPair || previousPair[0] !== nextPair[0] || previousPair[1] !== nextPair[1]) {
      return nextPair;
    }
  }

  return [fighters[0].id, fighters[1]?.id ?? fighters[0].id];
}

function getMenuEntries(showLab: boolean): MenuEntry[] {
  return [
    { href: "/fight?mode=arcade", label: "Arcade" },
    { href: "/fight?mode=training", label: "Training" },
    { href: "/online", label: "Find Match", disabled: true },
    ...(showLab ? [{ href: "/animation-lab", label: "Lab" }] : []),
    { href: "/credits", label: "Credits" },
  ];
}

export function HomeScreen({ showLab = false }: HomeScreenProps) {
  const router = useRouter();
  const menuEntries = useMemo(() => getMenuEntries(showLab), [showLab]);
  const [stage, setStage] = useState<HomeScreenStage>("title");
  const [menuPair, setMenuPair] = useState<[string, string]>(() => pickRandomMenuPair());
  const [selectedMenuIndex, setSelectedMenuIndex] = useState(() =>
    menuEntries.findIndex((entry) => !entry.disabled),
  );
  const [titleRosterLayout, setTitleRosterLayout] = useState<TitleRosterLayoutEntry[]>([]);

  const leftFighter = useMemo(
    () => fighters.find((fighter) => fighter.id === menuPair[0]) ?? fighters[0],
    [menuPair],
  );
  const rightFighter = useMemo(
    () => fighters.find((fighter) => fighter.id === menuPair[1]) ?? fighters[1] ?? fighters[0],
    [menuPair],
  );

  useEffect(() => {
    if (stage !== "title") {
      return;
    }

    setTitleRosterLayout(buildTitleRosterLayout(fighters));

    const advanceToMenu = () => {
      setStage("menu");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      advanceToMenu();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", advanceToMenu);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", advanceToMenu);
    };
  }, [menuEntries, stage]);

  useEffect(() => {
    if (stage !== "menu") {
      return;
    }

    setSelectedMenuIndex(menuEntries.findIndex((entry) => !entry.disabled));
    setMenuPair((previousPair) => pickRandomMenuPair(previousPair));
    const interval = window.setInterval(() => {
      setMenuPair((previousPair) => pickRandomMenuPair(previousPair));
    }, 10_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== "menu") {
      return;
    }

    void Promise.all(fighters.map((fighter) => getCachedHeadshotSource(fighter)));
  }, [stage]);

  useEffect(() => {
    if (stage !== "menu") {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      if (event.code === "Escape" || isMenuBackKey(event)) {
        event.preventDefault();
        setTitleRosterLayout(buildTitleRosterLayout(fighters));
        setStage("title");
        return;
      }

      if (isMenuConfirmKey(event)) {
        const entry = menuEntries[selectedMenuIndex];
        if (!entry || entry.disabled) {
          return;
        }

        event.preventDefault();
        router.push(entry.href);
        return;
      }

      const delta = isMenuPreviousKey(event) ? -1 : isMenuNextKey(event) ? 1 : 0;
      if (delta === 0) {
        return;
      }

      event.preventDefault();
      let nextIndex = selectedMenuIndex;
      for (let attempt = 0; attempt < menuEntries.length; attempt += 1) {
        nextIndex = getWrappedIndex(nextIndex, delta, menuEntries.length);
        if (!menuEntries[nextIndex]?.disabled) {
          setSelectedMenuIndex(nextIndex);
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuEntries, router, selectedMenuIndex, stage]);

  if (stage === "title") {
    return (
      <main className="landing-page landing-title-screen" role="button" tabIndex={0} aria-label="Press any button to open the main menu">
        <div className="landing-title-content">
          <div className="landing-title-center">
            <img
              className="landing-title-logo"
              src="/fighters-pixel-logo.png"
              alt="Battleborn Fighters"
            />
            <div className="landing-title-roster-photo" aria-hidden="true">
              {titleRosterLayout.map(({ fighter, ...layout }) => (
                <TitleRosterPhotoSprite
                  key={fighter.id}
                  fighter={fighter}
                  {...layout}
                />
              ))}
            </div>
            <p className="landing-title-prompt">Press Any Button</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="landing-page landing-menu-screen">
      <img
        className="landing-menu-logo"
        src="/fighters-pixel-logo.png"
        alt="Battleborn Fighters"
      />

      <div className="landing-menu-main">
        <MenuCharacterDisplay fighter={leftFighter} side="left" />

        <nav className="landing-menu-nav" aria-label="Main menu">
          {menuEntries.map((entry, index) => (
            <ArcadeMenuItem
              key={entry.label}
              href={entry.href}
              disabled={entry.disabled}
              className={`landing-menu-link${index === selectedMenuIndex ? " arcade-menu-item-active" : ""}`}
              style={{ animationDelay: `${index * 120}ms` }}
            >
              {entry.label}
            </ArcadeMenuItem>
          ))}
        </nav>

        <MenuCharacterDisplay fighter={rightFighter} side="right" />
      </div>
      <MenuControlsHint />
    </main>
  );
}
