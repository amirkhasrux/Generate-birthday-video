import type { Metadata } from "next";
import { Inter, Dancing_Script } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing",
  display: "swap",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Birthday Video Creator – Personalized Birthday Animations",
  description:
    "Create a personalized birthday animation video in seconds. Enter a name and birth date, watch the magic happen, and download your unique birthday video to share with loved ones.",
  keywords: ["birthday video", "birthday animation", "happy birthday", "personalized birthday"],
  openGraph: {
    title: "Birthday Video Creator",
    description: "Generate personalized birthday animation videos instantly.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${dancingScript.variable}`}>
      <body>{children}</body>
    </html>
  );
}
