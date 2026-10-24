import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// The fonts are files in this project (src/app/fonts), not downloaded from Google while building, so a deploy can
// never fail because the build server couldn't reach Google. Same typefaces as before: Inter and JetBrains Mono.
const inter = localFont({
  variable: "--font-sans",
  src: "./fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
});

const jetbrainsMono = localFont({
  variable: "--font-mono",
  src: [
    { path: "./fonts/jetbrains-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/jetbrains-mono-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mechanic Shop Hub",
  description: "Shop management for small engine repair shops.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
