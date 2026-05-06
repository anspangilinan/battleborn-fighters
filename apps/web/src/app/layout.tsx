import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";

const charybdis = localFont({
  src: "./fonts/chary___.ttf",
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://fighters.battleborn.online"),
  title: "Battleborn Fighters",
  description: "Fight against your favorite dumbasses from Battleborn. More characters coming soon!",
  openGraph: {
    title: "Battleborn Fighters",
    description: "Fight against your favorite dumbasses from Battleborn. More characters coming soon!",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Battleborn Fighters logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Battleborn Fighters",
    description: "Fight against your favorite dumbasses from Battleborn. More characters coming soon!",
    images: ["/og-image.png"],
  },
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
      <body className={charybdis.variable}>
        <div className="app-shell">
          <div className="app-frame">
            <div className="app-content">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
