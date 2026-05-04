import { fighterRoster } from "@battleborn/content";

export const randomFighterSelectionId = "__random__";
type FighterSelectionRoster = Record<string, { name: string }>;

export function isRandomFighterSelection(value: string | null | undefined) {
  return value === randomFighterSelectionId;
}

export function isSelectableFighterSelection(
  value: string | null | undefined,
  roster: FighterSelectionRoster = fighterRoster,
): value is string {
  if (!value) {
    return false;
  }

  return isRandomFighterSelection(value) || Boolean(roster[value]);
}

export function pickRandomFighterId(
  excludingId?: string | null,
  roster: FighterSelectionRoster = fighterRoster,
) {
  const fighterIds = Object.keys(roster);
  const eligibleIds = fighterIds.filter((fighterId) => fighterId !== excludingId);
  const pool = eligibleIds.length > 0 ? eligibleIds : fighterIds;

  if (pool.length === 0) {
    return "";
  }

  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0] ?? "";
}

export function getFighterSelectionLabel(
  selectionId: string | null | undefined,
  roster: FighterSelectionRoster = fighterRoster,
) {
  if (isRandomFighterSelection(selectionId)) {
    return "Random";
  }

  return roster[selectionId ?? ""]?.name ?? "Random";
}

export function resolveFighterSelection(
  selectionId: string | null | undefined,
  excludingId?: string | null,
  fallbackId?: string | null,
  roster: FighterSelectionRoster = fighterRoster,
) {
  if (isRandomFighterSelection(selectionId)) {
    return pickRandomFighterId(excludingId, roster);
  }

  if (selectionId && roster[selectionId]) {
    return selectionId;
  }

  if (fallbackId && roster[fallbackId]) {
    return fallbackId;
  }

  return pickRandomFighterId(excludingId, roster);
}
