import { z } from "zod";

import type { CharacterDefinition } from "@battleborn/game-core";

const hitboxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  damage: z.number().int().positive(),
  chipDamage: z.number().int().nonnegative().optional(),
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

const projectileSchema = z.object({
  sprite: z.string(),
  tier: z.number().int().positive(),
  spawnFrame: z.number().int().nonnegative().optional(),
  shotCount: z.number().int().positive().optional(),
  shotIntervalFrames: z.number().int().positive().optional(),
  offsetX: z.number(),
  offsetY: z.number(),
  speed: z.number().positive(),
  targeting: z.enum(["forward", "opponent"]).optional(),
  minimumDistanceRatio: z.number().positive().max(1),
  maximumDistanceRatio: z.number().positive().max(1).optional(),
  apexHeight: z.number().nonnegative(),
  landing: z.enum(["origin", "floor"]).optional(),
  hitbox: hitboxSchema,
});

const botBehaviorSchema = z.object({
  aggressiveness: z.number().min(0).max(1).optional(),
  arenaMovement: z.object({
    preferredDistanceMultiplier: z.number().positive().optional(),
    approachBias: z.number().min(0).max(1).optional(),
    retreatBias: z.number().min(0).max(1).optional(),
    jumpInChance: z.number().min(0).max(1).optional(),
    dashJumpForwardChance: z.number().min(0).max(1).optional(),
    dashJumpBackwardChance: z.number().min(0).max(1).optional(),
  }).optional(),
  skillChoice: z.object({
    punchWeight: z.number().nonnegative().optional(),
    kickWeight: z.number().nonnegative().optional(),
    specialWeight: z.number().nonnegative().optional(),
    attackCadenceMultiplier: z.number().positive().optional(),
  }).optional(),
  defense: z.object({
    blockChance: z.number().min(0).max(1).optional(),
    projectileDodgeChance: z.number().min(0).max(1).optional(),
    meleeBlockReactionFrames: z.number().int().nonnegative().optional(),
    projectileBlockReactionFrames: z.number().int().nonnegative().optional(),
  }).optional(),
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
    cooldownSeconds: z.number().nonnegative().optional(),
    meleeRange: z.number().positive().optional(),
    rootVelocityX: z.number().optional(),
    jumpCancelable: z.boolean().optional(),
    interruptible: z.boolean().optional(),
    specialSequence: z.object({
      buildUpFrames: z.number().int().positive(),
      animationBuildUpFrames: z.number().int().positive().optional(),
      buildUpAnimation: z.enum(["special", "special-pose"]).optional(),
      animationMode: z.enum(["segmented", "loop"]).optional(),
      loopFrameDuration: z.number().int().positive().optional(),
      channelMoveSpeed: z.number().positive().optional(),
      hoverHeight: z.number().nonnegative().optional(),
      pauseFrames: z.number().int().nonnegative().optional(),
      zoomOutFrames: z.number().int().nonnegative().optional(),
      holdUntilGroundedAfterBuildUp: z.boolean().optional(),
      freezeOpponentDuringBuildUp: z.boolean().optional(),
      zoomScale: z.number().positive().optional(),
    }).optional(),
    projectile: projectileSchema.optional(),
    frameBoxes: z.record(
      z.string(),
      z.object({
        hitboxes: z.array(hitboxSchema).optional(),
        hurtboxes: z.array(boxSchema).optional(),
        pushboxes: z.array(boxSchema).optional(),
      }),
    ).optional(),
  })),
  bot: botBehaviorSchema.optional(),
});

export function validateRoster(roster: CharacterDefinition[]) {
  return Object.fromEntries(
    roster.map((fighter) => [fighter.id, characterSchema.parse(fighter)]),
  ) as Record<string, CharacterDefinition>;
}
