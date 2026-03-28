# Character Reference Art

Put each fighter's stance image in its own folder:

```text
docs/character-reference/<fighter-id>/stance.png
docs/character-reference/<fighter-id>/notes.md
```

Example:

```text
docs/character-reference/ember-vane/stance.png
docs/character-reference/ember-vane/notes.md
```

Use kebab-case for `<fighter-id>` so it can become the content id later.

`stance.png` should be:
- full body
- plain background
- side-view or near-side-view
- full weapon visible
- one clean neutral fighting stance

`notes.md` should capture:
- archetype: `dual-wield` or `ranged`
- weapon type
- dominant hand
- special attack idea
- any costume or motion detail that must survive animation

These files are reference inputs for animation planning. Do not put them in `apps/web/public` unless they become finalized runtime assets.
