import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Battleborn Fighters",
  description: "A browser-based 2D fighting game MVP with local practice and online room play.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <div className="app-frame">
            <div className="app-content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
