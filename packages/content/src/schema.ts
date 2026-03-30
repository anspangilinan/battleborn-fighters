import { z } from "zod";

import type { CharacterDefinition } from "@battleborn/game-core";

const hitboxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  damage: z.number().int().positive(),
  hitstun: z.number().int().nonnegative(),
  knockbackX: z.number(),
  launchY: z.number().optional(),
});

const boxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const characterSchema = z.object({
  id: z.string(),
  name: z.string(),
  style: z.string(),
  palette: z.object({
    primary: z.string(),
    accent: z.string(),
    shadow: z.string(),
  }),
  sprites: z.object({
    portrait: z.string(),
    renderHeight: z.number().positive().optional(),
  }),
  stats: z.object({
    maxHealth: z.number().int().positive(),
    movement: z.object({
      walkSpeed: z.number().positive(),
      jumpVelocity: z.number().positive(),
      gravity: z.number().positive(),
      dash: z.object({
        distance: z.number().positive(),
        speed: z.number().positive(),
        lift: z.number().nonnegative(),
      }),
    }),
    pushWidth: z.number().positive(),
  }),
  standingBoxes: z.object({
    hurtboxes: z.array(boxSchema),
  }),
  jumpingBoxes: z.object({
    hurtboxes: z.array(boxSchema),
  }),
  moves: z.record(z.string(), z.object({
    id: z.string(),
    label: z.string(),
    button: z.enum(["punch", "kick", "special"]),
    startup: z.number().int().nonnegative(),
    active: z.number().int().positive(),
    recovery: z.number().int().nonnegative(),
    rootVelocityX: z.number().optional(),
    jumpCancelable: z.boolean().optional(),
    frameBoxes: z.record(
      z.string(),
      z.object({
        hitboxes: z.array(hitboxSchema).optional(),
        hurtboxes: z.array(boxSchema).optional(),
        pushboxes: z.array(boxSchema).optional(),
      }),
    ).optional(),
  })),
});

export function validateRoster(roster: CharacterDefinition[]) {
  return Object.fromEntries(
    roster.map((fighter) => [fighter.id, characterSchema.parse(fighter)]),
  ) as Record<string, CharacterDefinition>;
}
