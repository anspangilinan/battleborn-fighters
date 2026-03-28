# Character Animation Pose Checklist

This checklist is the baseline pose set for a fluid first playable roster.

Current input assumptions:
- `A`: move left
- `D`: move right
- `W`: jump
- `J`: attack 1
- `K`: attack 2
- `L`: special attack
- movement is left, right, and jump only

## Core pose set per character

1. `idle`
   - 3 to 4 poses
   - neutral combat loop used most of the time

2. `walk`
   - 5 to 6 poses
   - one side-view walk loop is usually enough if the sprite is mirrored for facing

3. `jump`
   - 5 poses
   - takeoff
   - rise
   - apex
   - fall
   - land

4. `dash`
   - 4 to 6 poses
   - quick forward burst with readable startup and finish

5. `hurt`
   - 3 to 4 poses
   - light hurt
   - heavy hurt
   - airborne hurt
   - optional stagger

6. `KO`
   - 5 to 6 poses
   - launch or fall
   - ground impact
   - downed hold
   - get-up or end hold if you do not animate recovery yet

7. `attack 1`
   - 4 to 5 poses
   - startup
   - active strike
   - follow-through
   - recovery

8. `attack 2`
   - 4 to 6 poses
   - usually needs a larger silhouette than attack 1

9. `special attack`
   - 6 to 8 poses
   - telegraph
   - active
   - recovery

## Recommended total

- baseline body poses per fighter: roughly `39` to `50`
- this does not include projectile sprites, effects, or weapon-only overlays

## Archetype add-ons

### Dual Wield

- `attack 1`: fast poke
- `attack 2`: overhead or anti-air
- `special`: signature special attack
- optional add-ons:
  - weapon trail effect
  - off-hand accent frame

### Ranged

- `attack 1`: horizontal projectile shot
- `attack 2`: diagonal projectile shot
- `special`: signature special attack
- extra sprite needs:
  - horizontal projectile: 2 to 3 frames
  - diagonal projectile: 2 to 3 frames
  - projectile hit or dissipate: 2 to 4 frames

## Naming suggestion

Use a predictable naming set for planning:

```text
idle_01
idle_02
idle_03
walk_01
walk_02
jump_takeoff
jump_rise
jump_apex
jump_fall
jump_land
dash_01
dash_02
hurt_01
hurt_02
hurt_03
ko_01
ko_02
ko_03
attack1_01
attack1_02
attack1_03
attack2_01
attack2_02
special_01
special_02
```

## Production note

- mirror left/right facing whenever possible
- keep weapons fully readable in the neutral stance
- prioritize silhouette clarity over tiny costume detail
- if a pose is hard to read at small size, simplify it before adding more frames
