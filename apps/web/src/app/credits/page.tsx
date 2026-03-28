"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CreditsPage() {
  const router = useRouter();

  useEffect(() => {
    const returnToMenu = () => {
      router.push("/");
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      returnToMenu();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", returnToMenu);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", returnToMenu);
    };
  }, [router]);

  return (
    <main
      className="landing-page credits-page"
      role="button"
      tabIndex={0}
      aria-label="Credits screen. Press any button to return to the menu."
    >
      <p className="credits-copy">fuck credits lol</p>
    </main>
  );
}
