import type { CharacterDefinition, SpriteAnimationStance } from "@battleborn/game-core";

type AssetAwareFighter = Pick<CharacterDefinition, "id" | "name" | "sprites">;

export function toAssetSegment(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function getFighterAnimationAssetRoots(fighter: AssetAwareFighter) {
  return Array.from(
    new Set(
      [
        fighter.sprites.assetRoot ? `/characters/${fighter.sprites.assetRoot}` : null,
        `/characters/${fighter.id}`,
      ].filter((root): root is string => Boolean(root)),
    ),
  );
}

export function getFighterAssetRoots(fighter: AssetAwareFighter) {
  return Array.from(
    new Set(
      [
        ...getFighterAnimationAssetRoots(fighter),
        `/characters/${toAssetSegment(fighter.name)}`,
      ].filter((root): root is string => Boolean(root)),
    ),
  );
}

export function getFighterAnimationDirectories(
  fighter: AssetAwareFighter,
  stance: SpriteAnimationStance,
) {
  const stanceNames = Array.from(
    new Set([stance, ...(fighter.sprites.stanceAliases?.[stance] ?? [])]),
  );

  return getFighterAnimationAssetRoots(fighter).flatMap((root) =>
    stanceNames.flatMap((stanceName) => [
      `${root}/animations/${stanceName}/`,
      `${root}/Animations/${stanceName}/`,
      `${root}/${stanceName}/`,
    ]),
  );
}

export function getFighterPortraitCandidates(fighter: AssetAwareFighter) {
  return [
    fighter.sprites.portrait,
    ...getFighterAssetRoots(fighter).flatMap((root) => [
      `${root}/portrait.png`,
      `${root}/profile.png`,
      `${root}/animations/portrait.png`,
      `${root}/animations/profile.png`,
      `${root}/Animations/portrait.png`,
      `${root}/Animations/profile.png`,
    ]),
  ];
}

export function getFighterHeadshotCandidates(fighter: AssetAwareFighter) {
  return [
    ...getFighterAssetRoots(fighter).flatMap((root) => [
      `${root}/headshot.png`,
      `${root}/animations/headshot.png`,
      `${root}/Animations/headshot.png`,
    ]),
    ...getFighterPortraitCandidates(fighter),
  ];
}
