import type { Metadata } from "next";
import { Cinzel, EB_Garamond } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const heading = Cinzel({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const body = EB_Garamond({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tomoi's Tavern",
  description:
    "Step into the tavern. The fire crackles. The mirror waits. The bard tunes their lute.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${heading.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-tavern-night text-tavern-parchment">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
