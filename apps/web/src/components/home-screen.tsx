"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { fighterRoster } from "@battleborn/content";
import {
  getFighterAnimationDirectories,
  getFighterPortraitCandidates,
} from "@/lib/fighter-assets";

import { ArcadeMenuItem } from "@/components/arcade-menu-item";
import { MenuControlsHint } from "@/components/menu-controls";
import {
  getWrappedIndex,
  isMenuBackKey,
  isMenuConfirmKey,
  isMenuNextKey,
  isMenuPreviousKey,
} from "@/lib/menu-input";

const fighters = Object.values(fighterRoster);
const MAX_IDLE_FRAME_SCAN = 24;
const MENU_IDLE_FRAME_MS = 120;

type HomeScreenStage = "title" | "menu";

type MenuCharacterDisplayProps = {
  fighter: (typeof fighters)[number] | undefined;
  side: "left" | "right";
};

type MenuEntry = {
  disabled?: boolean;
  href: string;
  label: string;
};

type HomeScreenProps = {
  showLab?: boolean;
};

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

async function discoverIdleFrames(fighter: (typeof fighters)[number]) {
  for (const directory of getFighterAnimationDirectories(fighter, "idle")) {
    const frames = await loadSequentialFrames(directory);
    if (frames.length > 0) {
      return frames;
    }
  }

  return [];
}

async function discoverPortraitSource(fighter: (typeof fighters)[number]) {
  for (const candidate of getFighterPortraitCandidates(fighter)) {
    if (await preloadImage(candidate)) {
      return candidate;
    }
  }

  return null;
}

function MenuCharacterDisplay({ fighter, side }: MenuCharacterDisplayProps) {
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
        discoverIdleFrames(fighter),
        discoverPortraitSource(fighter),
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

  if (!fighter) {
    return null;
  }

  const currentSource = frameSources[currentFrame] ?? portraitSource;
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

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      if (event.code === "Escape" || isMenuBackKey(event)) {
        event.preventDefault();
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
          <img
            className="landing-title-logo"
            src="/fighters-pixel-logo.png"
            alt="Battleborn Fighters"
          />
          <p className="landing-title-prompt">Press Any Button</p>
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
