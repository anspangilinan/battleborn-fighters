"use client";

export function MenuControlsHint() {
  return (
    <div className="menu-controls-hint" aria-hidden="true">
      <span className="menu-controls-hint-key">WASD</span>
      <span className="menu-controls-hint-label">Move</span>
      <span className="menu-controls-hint-separator">·</span>
      <span className="menu-controls-hint-key">J</span>
      <span className="menu-controls-hint-label">Confirm</span>
      <span className="menu-controls-hint-separator">·</span>
      <span className="menu-controls-hint-key">K / Esc</span>
      <span className="menu-controls-hint-label">Back</span>
    </div>
  );
}
