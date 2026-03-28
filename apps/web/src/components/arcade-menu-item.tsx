"use client";

import Link from "next/link";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

type ArcadeMenuItemProps = {
  children: ReactNode;
  className?: string;
  cta?: boolean;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  style?: CSSProperties;
  type?: "button" | "submit" | "reset";
};

export function ArcadeMenuItem({
  children,
  className,
  cta = false,
  href,
  onClick,
  style,
  type = "button",
}: ArcadeMenuItemProps) {
  const classes = ["arcade-menu-item", cta ? "arcade-menu-item-cta" : "", className ?? ""].filter(Boolean).join(" ");

  if (href) {
    return (
      <Link href={href} className={classes} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} style={style} onClick={onClick}>
      {children}
    </button>
  );
}
