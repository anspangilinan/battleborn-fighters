# Arena Background Prompts

These prompts are for generating fighting game stage backgrounds that fit the current project style:
- retro `16-bit` arcade look
- side-view `2D fighting game` camera
- readable for `big-head / chibi` fighters
- strong silhouettes and depth
- low visual noise behind the fighters

The key rule is simple: the arena should look good, but it must never make the fighters hard to read.

## Core Arena Prompt

Use this as the base prompt for most stage generations:

```text
Create an original 2D fighting game arena background for a retro 16-bit arcade-style fighting game.

Style: colorful 16-bit pixel art environment, arcade fighting game stage, side-view composition, layered parallax background, clean readable shapes, bold lighting, strong silhouette design
Camera: straight side view for a 2D fighting game, wide horizontal composition
Mood: lively, memorable, arcade-friendly
Rendering: pixel-art-friendly, limited palette feel, clean edges, simple readable forms, no photorealism, no painterly textures, no 3D render look

Important gameplay constraints:
- keep the center of the stage visually clear for the fighters
- background must not be too busy behind the characters
- strongest details should stay in the far background or edges
- ground plane must read clearly from left to right
- horizon and floor should help show depth and spacing
- avoid clutter in the exact combat area

Stage design requirements:
- one clear foreground floor or platform where the fighters stand
- one midground layer
- one background layer
- side-view fighting game composition
- readable stage boundaries
- visually interesting but gameplay-safe set dressing

Do not include:
- text
- UI
- logos
- watermarks
- first-person perspective
- top-down angle
- extreme perspective distortion
- realistic photography

Make the stage feel like a classic arcade fighting game arena that is easy to use behind super-deformed big-head fighters.
```

## Simple Constraint Add-On

Append this when the result gets too detailed or too realistic:

```text
Keep the center combat space clean and easy to read.
Reduce tiny details.
Use larger shapes and simpler color blocks.
Make it feel suitable for 16-bit sprite-based fighting gameplay.
```

## Ground Plane Prompt

Use this if the floor is not reading clearly enough:

```text
The stage floor must be very readable in side view.
Show a strong horizontal ground plane with simple perspective.
Make the fighter standing area clear, flat, and visually stable.
Avoid floor textures that are too noisy or high-contrast.
```

## Arena Variants

## Rooftop Arena

```text
Create an original rooftop fighting game arena background for a retro 16-bit arcade-style fighting game.

Theme: city rooftop at sunset
Style: 16-bit pixel art, side-view fighting game arena, layered skyline, simple bold building shapes, warm sunset lighting
Foreground: clean rooftop floor with a few readable vents or railings at the edges
Midground: rooftop structures kept away from the center combat area
Background: city skyline, large sunset sky, a few bright windows, strong silhouette shapes
Mood: heroic, energetic, arcade classic

Important:
Keep the middle of the stage clean for character readability.
Do not overcrowd the skyline.
Make it look good behind big-head cartoon fighters.
```

## Temple Arena

```text
Create an original temple fighting game arena background for a retro 16-bit arcade-style fighting game.

Theme: mountain temple courtyard
Style: 16-bit pixel art, side-view fighting game stage, clean stone floor, banners, distant mountain silhouettes, dramatic but readable composition
Foreground: flat temple courtyard floor with large simple stone shapes
Midground: pillars, lanterns, or banners placed mostly near the edges
Background: temple rooflines, mountains, sky gradient, soft atmospheric depth
Mood: disciplined, ceremonial, timeless arcade battle stage

Important:
Keep the central fighting area visually open.
Avoid too many repeated details in the center.
Favor large readable shapes over decoration.
```

## Night Market Arena

```text
Create an original night market fighting game arena background for a retro 16-bit arcade-style fighting game.

Theme: lively street market at night
Style: 16-bit pixel art, side-view fighting game arena, glowing lanterns, shop signs, fabric canopies, strong silhouettes, readable light grouping
Foreground: clean street or tiled ground plane
Midground: stalls and lanterns arranged mostly at the far left and right sides
Background: layered city buildings, hanging lights, subtle crowd silhouettes
Mood: festive, bright, energetic

Important:
Do not let the lanterns or stalls clutter the center combat zone.
Keep the main battle area readable for chibi fighters.
Use grouped lights instead of visual noise.
```

## Industrial Arena

```text
Create an original industrial fighting game arena background for a retro 16-bit arcade-style fighting game.

Theme: factory platform or power station
Style: 16-bit pixel art, side-view fighting game stage, metal platforms, pipes, warning lights, steam, bold mechanical shapes
Foreground: strong horizontal platform or factory floor
Midground: pipes, vents, and machinery near the stage edges
Background: larger machines, smokestacks, steel structures, controlled steam effects
Mood: tense, mechanical, competitive

Important:
Keep the center floor area visually clean.
Avoid overly dense machinery behind the fighters.
Use large industrial silhouettes, not tiny technical detail.
```

## Forest Shrine Arena

```text
Create an original forest shrine fighting game arena background for a retro 16-bit arcade-style fighting game.

Theme: hidden shrine clearing in a forest
Style: 16-bit pixel art, side-view fighting game stage, layered trees, shrine gate, stone path, atmospheric depth
Foreground: clean dirt or stone fighting ground
Midground: shrine gate, lanterns, or small statues placed off-center
Background: layered forest canopy, distant trees, moonlight or dusk lighting
Mood: mystical, calm, dramatic

Important:
Keep the center area free from clutter.
Use background depth and lighting to create atmosphere without distracting from the fighters.
Make it suitable for big-head cartoon fighters in a side-view game.
```

## Best Practices

- Keep the center third of the image the cleanest.
- Put major props near the left and right edges.
- Use larger silhouette shapes instead of many tiny objects.
- Keep contrast behind the fighters moderate, not extreme.
- Make the ground line easy to read.
- Avoid heavy texture where hit reactions and movement happen.

## Recommended Follow-Up Prompt

After you get a stage you like, use this:

```text
Simplify this arena background for sprite-based 16-bit fighting gameplay.
Reduce visual noise in the center.
Preserve the theme and composition.
Improve side-view ground readability and make the stage friendlier for chibi fighters.
```
