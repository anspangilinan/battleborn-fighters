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
  title: "Battleborn Fighters",
  description: "A browser-based 2D fighting game MVP with local practice and online room play.",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico",
  },
  openGraph: {
    title: "Battleborn Fighters",
    description: "A browser-based 2D fighting game MVP with local practice and online room play.",
    images: [
      {
        url: "/fighters-pixel-logo.png",
        width: 256,
        height: 170,
        alt: "Battleborn Fighters logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Battleborn Fighters",
    description: "A browser-based 2D fighting game MVP with local practice and online room play.",
    images: ["/fighters-pixel-logo.png"],
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
