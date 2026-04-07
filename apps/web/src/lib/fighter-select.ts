import { fighterRoster } from "@battleborn/content";

export const randomFighterSelectionId = "__random__";

export function isRandomFighterSelection(value: string | null | undefined) {
  return value === randomFighterSelectionId;
}

export function isSelectableFighterSelection(
  value: string | null | undefined,
): value is string {
  if (!value) {
    return false;
  }

  return isRandomFighterSelection(value) || Boolean(fighterRoster[value]);
}

export function pickRandomFighterId(excludingId?: string | null) {
  const fighterIds = Object.keys(fighterRoster);
  const eligibleIds = fighterIds.filter((fighterId) => fighterId !== excludingId);
  const pool = eligibleIds.length > 0 ? eligibleIds : fighterIds;

  if (pool.length === 0) {
    return "";
  }

  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0] ?? "";
}

export function getFighterSelectionLabel(selectionId: string | null | undefined) {
  if (isRandomFighterSelection(selectionId)) {
    return "Random";
  }

  return fighterRoster[selectionId ?? ""]?.name ?? "Random";
}

export function resolveFighterSelection(
  selectionId: string | null | undefined,
  excludingId?: string | null,
  fallbackId?: string | null,
) {
  if (isRandomFighterSelection(selectionId)) {
    return pickRandomFighterId(excludingId);
  }

  if (selectionId && fighterRoster[selectionId]) {
    return selectionId;
  }

  if (fallbackId && fighterRoster[fallbackId]) {
    return fallbackId;
  }

  return pickRandomFighterId(excludingId);
}
