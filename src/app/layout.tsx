import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Anton, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ruven Dept. — Heavyweight Streetwear Essentials",
    template: "%s · Ruven Dept.",
  },
  description:
    "Ruven Dept. crafts heavyweight streetwear essentials and utility outerwear built for the street and everything past it. Free shipping over $150.",
  keywords: [
    "streetwear",
    "hoodies",
    "heavyweight tees",
    "utility jackets",
    "cargo pants",
    "sneakers",
  ],
  openGraph: {
    title: "Ruven Dept. — Heavyweight Streetwear Essentials",
    description:
      "Heavyweight streetwear essentials and utility outerwear, built to outlast trends.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${anton.variable}`}>
      <body className="bg-bone text-ink antialiased">{children}</body>
    </html>
  );
}
