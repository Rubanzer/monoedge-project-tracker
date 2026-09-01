import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

/**
 * The MonoEdge type system is two faces, no more. JetBrains Mono carries the
 * interface — every label, value, date and count in here is data or
 * measurement, which is what a mono face is for. Monument Extended is display
 * only: the wordmark and the few places that need to sound like the brand.
 * It is very wide, so it never runs longer than a couple of words.
 */
const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const display = localFont({
  src: "./fonts/MonumentExtended-Regular.ttf",
  variable: "--font-monument",
  weight: "400",
  display: "swap",
  // Monument is set in caps at small sizes; the fallback needs to be wide
  // enough that a swap does not reflow the wordmark.
  fallback: ["Arial Black", "Impact", "sans-serif"],
});

export const metadata: Metadata = {
  title: "MonoEdge Tracker",
  description:
    "Kanban tracking for MonoEdge project work, backed by the team tracking sheet.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#05070d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${mono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
