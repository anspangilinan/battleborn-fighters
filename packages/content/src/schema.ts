import { z } from "zod";

import type { CharacterDefinition } from "@battleborn/game-core";

const hitboxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  damage: z.number().int().positive(),
  chipDamage: z.number().int().nonnegative().optional(),
  freezeFrames: z.number().int().positive().optional(),
  hitstun: z.number().int().nonnegative(),
  knockbackX: z.number(),
  launchY: z.number().optional(),
});

const projectileEffectHitboxSchema = hitboxSchema.extend({
  // Sprite-option effects can be non-damaging, e.g. heal pickups.
  damage: z.number().int().nonnegative(),
});

const boxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const projectileSchema = z.object({
  sprite: z.string(),
  spriteOptions: z.array(z.string()).min(1).optional(),
  spriteOptionEffects: z.record(
    z.string(),
    z.object({
      hitbox: projectileEffectHitboxSchema.optional(),
      healTargetRatio: z.number().positive().max(1).optional(),
    }),
  ).optional(),
  tier: z.number().int().positive(),
  rotateToVelocity: z.boolean().optional(),
  rotationOffsetRadians: z.number().optional(),
  spawnFrame: z.number().int().nonnegative().optional(),
  lifetimeFrames: z.number().int().positive().optional(),
  persistsOnHit: z.boolean().optional(),
  hitIntervalFrames: z.number().int().positive().optional(),
  maxHits: z.number().int().positive().optional(),
  shotCount: z.number().int().positive().optional(),
  shotIntervalFrames: z.number().int().positive().optional(),
  shotHitboxes: z.array(hitboxSchema).optional(),
  spawnAnchor: z.enum(["attacker", "opponent"]).optional(),
  spriteScale: z.number().positive().optional(),
  animationFrameDurationFrames: z.number().int().positive().optional(),
  offsetX: z.number(),
  offsetY: z.number(),
  speed: z.number().positive(),
  targeting: z.enum(["forward", "opponent"]).optional(),
  homing: z.boolean().optional(),
  tumbleRotation: z.boolean().optional(),
  minimumDistanceRatio: z.number().positive().max(1),
  maximumDistanceRatio: z.number().positive().max(1).optional(),
  apexHeight: z.number().nonnegative(),
  landing: z.enum(["origin", "floor"]).optional(),
  hitbox: hitboxSchema,
});

const relocationSchema = z.object({
  startFrame: z.number().int().positive(),
  endFrame: z.number().int().positive(),
  distanceXRatio: z.number().positive().max(1),
  fromDistanceXRatio: z.number().nonnegative().max(1).optional(),
  distanceY: z.number().optional(),
  fromDistanceY: z.number().optional(),
}).refine(
  (value) => value.endFrame >= value.startFrame,
  {
    message: "endFrame must be greater than or equal to startFrame",
    path: ["endFrame"],
  },
);

const effectAnimationSchema = z.object({
  sprite: z.string(),
  startFrame: z.number().int().positive(),
  offsetX: z.number(),
  offsetY: z.number(),
  anchor: z.enum(["fighter", "attack-origin"]).optional(),
  spriteScale: z.number().positive().optional(),
  playbackRate: z.number().positive().optional(),
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
  palette: z.object({
    primary: z.string(),
    accent: z.string(),
    shadow: z.string(),
  }),
  sprites: z.object({
    portrait: z.string(),
    renderHeight: z.number().positive().optional(),
    assetRoot: z.string().optional(),
    stanceAliases: z.record(z.string(), z.array(z.string())).optional(),
    stanceFrameDurations: z.record(z.string(), z.number().int().positive()).optional(),
    stanceRenderOffsets: z.record(
      z.string(),
      z.object({
        x: z.number().optional(),
        y: z.number().optional(),
      }),
    ).optional(),
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
    multiHit: z.boolean().optional(),
    phaseThroughProjectiles: z.boolean().optional(),
    finishOnHit: z.boolean().optional(),
    startsReady: z.boolean().optional(),
    selfHealRatio: z.number().positive().max(1).optional(),
    healAura: z.enum(["holy", "leaf"]).optional(),
    channelSpecial: z.object({
      durationFrames: z.number().int().positive(),
      initialMode: z.enum(["heal", "drain"]),
      toggleModes: z.array(z.enum(["heal", "drain"])).optional(),
      tickIntervalFrames: z.number().int().positive().optional(),
      healPerSecondRatio: z.number().positive().max(1).optional(),
      damagePerSecondRatio: z.number().positive().max(1).optional(),
      slowMultiplier: z.number().positive().max(1).optional(),
    }).optional(),
    grantsInvulnerability: z.boolean().optional(),
    animationStance: z.enum([
      "attack1",
      "attack1a",
      "attack1b",
      "attack1c",
      "attack1d",
      "attack2",
      "attack3",
      "special",
      "special-a",
      "special-b",
      "special-c",
    ]).optional(),
    loopAnimation: z.boolean().optional(),
    animationFrameDurationFrames: z.number().int().positive().optional(),
    followUpMoveId: z.string().optional(),
    followUpWindowFrames: z.number().int().positive().optional(),
    followUpExpireCooldownSeconds: z.number().nonnegative().optional(),
    passThroughOpponent: z.boolean().optional(),
    specialSequence: z.object({
      buildUpFrames: z.number().int().positive(),
      animationBuildUpFrames: z.number().int().positive().optional(),
      buildUpAnimation: z.enum(["special", "special-pose", "special-wind-up"]).optional(),
      animationMode: z.enum(["segmented", "loop"]).optional(),
      loopFrameDuration: z.number().int().positive().optional(),
      channelMoveSpeed: z.number().positive().optional(),
      hoverHeight: z.number().nonnegative().optional(),
      pauseFrames: z.number().int().nonnegative().optional(),
      zoomOutFrames: z.number().int().nonnegative().optional(),
      skipToFollowThroughOnSpecialInput: z.boolean().optional(),
      completeAnimationDuringZoomOut: z.boolean().optional(),
      holdUntilGroundedAfterBuildUp: z.boolean().optional(),
      freezeOpponentDuringBuildUp: z.boolean().optional(),
      zoomScale: z.number().positive().optional(),
    }).optional(),
    projectile: projectileSchema.optional(),
    relocation: relocationSchema.optional(),
    relocations: z.array(relocationSchema).optional(),
    hitboxAnchor: z.enum(["fighter", "attack-origin"]).optional(),
    effectAnimation: effectAnimationSchema.optional(),
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
