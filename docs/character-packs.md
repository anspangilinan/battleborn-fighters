# Character Pack Guide

The MVP is set up so a fighter is a content problem first and an engine problem second.

## What defines a fighter

Every fighter needs:
- `id`
- display `name`
- `style` label
- `palette`
- `portrait` asset path
- `stats`
- standing and jumping hurtboxes
- three starter moves: `punch`, `kick`, `special`

In the current MVP, those live in [packages/content/src/index.ts](/home/dev/Projects/battleborn/battleborn-fighters/packages/content/src/index.ts).

## Current archetypes

The engine still uses the same three move slots for every fighter:
- `punch`
- `kick`
- `special`

For the roster you described, map those slots like this.

### Dual Wield

- `punch`: fast poke
- `kick`: overhead / anti-air
- `special`: signature special attack

### Ranged

- `punch`: horizontal projectile
- `kick`: diagonal projectile
- `special`: signature special attack

## Current move shape

Each move defines:
- `id`
- `label`
- `button`: `punch`, `kick`, or `special`
- `startup`
- `active`
- `recovery`
- optional `rootVelocityX`
- optional `frameBoxes`

`frameBoxes` is keyed by animation frame and can include:
- `hitboxes`
- `hurtboxes`
- `pushboxes`

Each hitbox includes:
- position and size
- `damage`
- `hitstun`
- `knockbackX`
- optional `launchY`

## Practical workflow for a new fighter

1. Copy one of the existing fighters in [packages/content/src/index.ts](/home/dev/Projects/battleborn/battleborn-fighters/packages/content/src/index.ts).
2. Change the identity fields:
   - `id`
   - `name`
   - `style`
   - `palette`
3. Add a portrait file under [apps/web/public/characters](/home/dev/Projects/battleborn/battleborn-fighters/apps/web/public/characters).
4. Add the raw stance reference image under [docs/character-reference](/home/dev/Projects/battleborn/battleborn-fighters/docs/character-reference).
5. Tune movement stats:
   - `walkSpeed`
   - `jumpVelocity`
   - `gravity`
   - `pushWidth`
   - dash feel is currently derived from walk speed and the shared engine dash tuning
6. Replace the standing and jumping hurtboxes.
7. Define the three starter moves with frame-indexed hitboxes.
8. Add a link to practice as that fighter on the home screen if you want it featured there.
9. Run:

```bash
npm run check
npm test
```

## Where to put stance art

Put the four fighting-stance reference images here:

```text
docs/character-reference/<fighter-id>/stance.png
docs/character-reference/<fighter-id>/notes.md
```

Guidelines:
- use one folder per fighter
- keep the folder name in kebab-case so it can become the future fighter id
- keep the background plain
- keep the full body and the full weapon visible
- prefer a clean side-view or near-side-view fighting stance
- use `notes.md` for archetype, weapon type, handedness, and any motion notes that matter for animation

Keep these reference images under `docs/` for now. They are source material for animation planning, not shipped game assets. Only final portraits, spritesheets, and exported runtime art should go under `apps/web/public`.

## Recommended asset pipeline

Use generated or hand-drawn placeholder art first:
- create a portrait
- drop the stance reference image into `docs/character-reference/<fighter-id>/stance.png`
- create a spritesheet later when you want to replace the current debug-style Phaser body rendering
- keep the silhouette simple and readable

Once the stance image is in the repo, it is enough to plan:
- idle loop
- walk cycle
- jump
- dash
- `attack1`
- `attack2`
- `special` attack
- hurt reaction
- KO

For consistency, use the prompt pack in [docs/character-prompts.md](/home/dev/Projects/battleborn/battleborn-fighters/docs/character-prompts.md).

## Runtime animation folders

Use these folder names under `apps/web/public/characters/<fighter-id>/animations/`:

```text
idle/
walk/
jump/
dash/
hurt/
ko/
attack1/
attack2/
special/
```

Use sequential frame files inside each folder:

```text
01.png
02.png
03.png
```

## Suggested future upgrade

The current content package is TypeScript-first for speed. The next upgrade is to move each fighter into a directory-based pack such as:

```text
characters/<id>/
  manifest.json
  reference/
    stance.png
    notes.md
  animations.json
  spritesheet.png
  spritesheet.json
  portrait.png
  moves/
    punch.json
    kick.json
    special.json
```

That migration is straightforward because the engine already expects structured move and box data.
