function isEnabled(value: string | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function isLabEnabled() {
  return isEnabled(process.env.ENABLE_LAB);
}

export function isMasterModeEnabled() {
  return isEnabled(process.env.MASTER_MODE) || isEnabled(process.env.MASTEER_MODE);
}

export const isMasteerModeEnabled = isMasterModeEnabled;
