import type { CharacterDefinition } from "@battleborn/game-core";

import { characterDefinitions } from "./characters";
import { validateRoster } from "./schema";

export { characterDefinitions, validateRoster };

export const fighterRoster = validateRoster(characterDefinitions);
export type FighterId = keyof typeof fighterRoster;

export function getFighter(id: string): CharacterDefinition {
  const fighter = fighterRoster[id];
  if (!fighter) {
    throw new Error(`Unknown fighter ${id}`);
  }
  return fighter;
}

export const templateCharacterPack = {
  manifest: {
    id: "template-fighter",
    name: "Template Fighter",
    archetype: "dual-wield",
    style: "Copy this pack, then replace archetype, art, and frame data.",
  },
  files: [
    "manifest.json",
    "reference/stance.png",
    "reference/notes.md",
    "animations.json",
    "spritesheet.png",
    "spritesheet.json",
    "portrait.png",
    "moves/punch.json",
    "moves/kick.json",
    "moves/special.json",
  ],
};
