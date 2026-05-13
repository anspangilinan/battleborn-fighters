"use client";

import Link from "next/link";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

type ArcadeMenuItemProps = {
  children: ReactNode;
  className?: string;
  cta?: boolean;
  disabled?: boolean;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  style?: CSSProperties;
  type?: "button" | "submit" | "reset";
};

export function ArcadeMenuItem({
  children,
  className,
  cta = false,
  disabled = false,
  href,
  onClick,
  style,
  type = "button",
}: ArcadeMenuItemProps) {
  const classes = [
    "arcade-menu-item",
    cta ? "arcade-menu-item-cta" : "",
    disabled ? "arcade-menu-item-disabled" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (href && !disabled) {
    const onLinkClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      // In production we've seen occasional stalled client transitions.
      // Fall back to a hard navigation when the URL does not change.
      const sourceHref = window.location.href;
      window.setTimeout(() => {
        if (window.location.href === sourceHref) {
          window.location.assign(href);
        }
      }, 700);
    };

    return (
      <Link href={href} className={classes} style={style} prefetch={false} onClick={onLinkClick}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} style={style} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
