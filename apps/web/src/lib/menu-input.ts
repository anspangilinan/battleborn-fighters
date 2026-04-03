export function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}

export function isMenuBackKey(event: KeyboardEvent) {
  return event.code === "KeyK";
}

export function isMenuConfirmKey(event: KeyboardEvent) {
  return (
    event.code === "KeyJ" ||
    event.code === "Enter" ||
    event.code === "Space"
  );
}

export function isMenuPreviousKey(event: KeyboardEvent) {
  return (
    event.code === "KeyW" ||
    event.code === "KeyA" ||
    event.code === "ArrowUp" ||
    event.code === "ArrowLeft"
  );
}

export function isMenuNextKey(event: KeyboardEvent) {
  return (
    event.code === "KeyS" ||
    event.code === "KeyD" ||
    event.code === "ArrowDown" ||
    event.code === "ArrowRight"
  );
}

export function isMenuUpKey(event: KeyboardEvent) {
  return event.code === "KeyW" || event.code === "ArrowUp";
}

export function isMenuDownKey(event: KeyboardEvent) {
  return event.code === "KeyS" || event.code === "ArrowDown";
}

export function isMenuLeftKey(event: KeyboardEvent) {
  return event.code === "KeyA" || event.code === "ArrowLeft";
}

export function isMenuRightKey(event: KeyboardEvent) {
  return event.code === "KeyD" || event.code === "ArrowRight";
}

export function getWrappedIndex(currentIndex: number, delta: number, length: number) {
  if (length <= 0) {
    return -1;
  }

  const safeIndex = currentIndex < 0 ? 0 : currentIndex;
  return (safeIndex + delta + length) % length;
}
