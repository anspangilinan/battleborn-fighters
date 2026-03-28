"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { fighterRoster } from "@battleborn/content";

import { ArcadeMenuItem } from "@/components/arcade-menu-item";

const fighters = Object.values(fighterRoster);
const MAX_IDLE_FRAME_SCAN = 24;
const MENU_IDLE_FRAME_MS = 120;
const ACCESS_PASSWORD = "what it is";
const ACCESS_SESSION_KEY = "battleborn-access-granted";

type HomeScreenStage = "title" | "password" | "menu";

type MenuCharacterDisplayProps = {
  fighter: (typeof fighters)[number] | undefined;
  side: "left" | "right";
};

type MenuEntry = {
  disabled?: boolean;
  href: string;
  label: string;
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
  const roots = Array.from(new Set([fighter.id, toAssetSegment(fighter.name)]));
  const candidateDirectories = roots.flatMap((root) => [
    `/characters/${root}/animations/idle/`,
    `/characters/${root}/idle/`,
  ]);

  for (const directory of candidateDirectories) {
    const frames = await loadSequentialFrames(directory);
    if (frames.length > 0) {
      return frames;
    }
  }

  return [];
}

function MenuCharacterDisplay({ fighter, side }: MenuCharacterDisplayProps) {
  const [frameSources, setFrameSources] = useState<string[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadFrames() {
      if (!fighter) {
        setFrameSources([]);
        setCurrentFrame(0);
        return;
      }

      setFrameSources([]);
      setCurrentFrame(0);
      const discoveredFrames = await discoverIdleFrames(fighter);

      if (cancelled) {
        return;
      }

      setFrameSources(discoveredFrames);
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

  const currentSource = frameSources[currentFrame];
  const renderHeight = (fighter.sprites.renderHeight ?? 168) * 3;

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

const menuEntries: MenuEntry[] = [
  { href: "/fight?mode=local", label: "Fight" },
  { href: "/fight?mode=training", label: "Training" },
  { href: "/online", label: "Find Match", disabled: true },
  { href: "/animation-lab", label: "Lab" },
  { href: "/credits", label: "Credits" },
];

export function HomeScreen() {
  const [stage, setStage] = useState<HomeScreenStage>("title");
  const [menuPair, setMenuPair] = useState<[string, string]>(() => pickRandomMenuPair());
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  const leftFighter = useMemo(
    () => fighters.find((fighter) => fighter.id === menuPair[0]) ?? fighters[0],
    [menuPair],
  );
  const rightFighter = useMemo(
    () => fighters.find((fighter) => fighter.id === menuPair[1]) ?? fighters[1] ?? fighters[0],
    [menuPair],
  );

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(ACCESS_SESSION_KEY) === "true") {
        setStage("menu");
      }
    } catch {
      // Ignore storage access failures and require the password again.
    }
  }, []);

  useEffect(() => {
    if (stage !== "title") {
      return;
    }

    const openPasswordPrompt = () => {
      setPassword("");
      setPasswordError("");
      setStage("password");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      openPasswordPrompt();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", openPasswordPrompt);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", openPasswordPrompt);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== "password") {
      return;
    }

    passwordInputRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPassword("");
        setPasswordError("");
        setStage("title");
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [stage]);

  useEffect(() => {
    if (stage !== "menu") {
      return;
    }

    setMenuPair((previousPair) => pickRandomMenuPair(previousPair));
    const interval = window.setInterval(() => {
      setMenuPair((previousPair) => pickRandomMenuPair(previousPair));
    }, 10_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [stage]);

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (password.trim().toLowerCase() !== ACCESS_PASSWORD) {
      setPasswordError("That isn't it.");
      return;
    }

    try {
      window.sessionStorage.setItem(ACCESS_SESSION_KEY, "true");
    } catch {
      // Ignore storage access failures and continue for the current session.
    }

    setPassword("");
    setPasswordError("");
    setStage("menu");
  };

  if (stage === "title" || stage === "password") {
    return (
      <main
        className={`landing-page landing-title-screen${stage === "password" ? " landing-title-screen-password-open" : ""}`}
        role={stage === "title" ? "button" : undefined}
        tabIndex={stage === "title" ? 0 : -1}
        aria-label={stage === "title" ? "Press any button to open the password prompt" : undefined}
      >
        <div className="landing-title-content">
          <div className="landing-title-logo" aria-label="Battleborn Fighters">
            <span className="landing-title-logo-top">Battleborn</span>
            <span className="landing-title-logo-bottom">Fighters</span>
          </div>
          <p className="landing-title-prompt">Press Any Button</p>
        </div>

        {stage === "password" ? (
          <div className="landing-password-overlay" role="presentation">
            <form
              className="landing-password-panel"
              onSubmit={submitPassword}
              role="dialog"
              aria-modal="true"
              aria-labelledby="landing-password-label"
            >
              <p className="landing-password-kicker">Password Required</p>
              <label id="landing-password-label" className="landing-password-label" htmlFor="landing-password-input">
                It is...
              </label>
              <input
                ref={passwordInputRef}
                id="landing-password-input"
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (passwordError) {
                    setPasswordError("");
                  }
                }}
                className="landing-password-input"
                autoComplete="off"
                spellCheck={false}
                aria-describedby={passwordError ? "landing-password-error" : undefined}
              />
              <div className="landing-password-actions">
                <button type="submit" className="landing-password-submit">
                  Enter
                </button>
              </div>
              <p className={`landing-password-error${passwordError ? " landing-password-error-visible" : ""}`} id="landing-password-error">
                {passwordError || " "}
              </p>
            </form>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="landing-page landing-menu-screen">
      <MenuCharacterDisplay fighter={leftFighter} side="left" />

      <nav className="landing-menu-nav" aria-label="Main menu">
        {menuEntries.map((entry, index) => (
          <ArcadeMenuItem
            key={entry.label}
            href={entry.href}
            disabled={entry.disabled}
            className="landing-menu-link"
            style={{ animationDelay: `${index * 120}ms` }}
          >
            {entry.label}
          </ArcadeMenuItem>
        ))}
      </nav>

      <MenuCharacterDisplay fighter={rightFighter} side="right" />
    </main>
  );
}
