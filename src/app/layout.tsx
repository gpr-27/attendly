import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { DM_Sans, Fraunces } from "next/font/google";
import { AppFrame } from "@/components/shell/app-frame";
import { AppProviders } from "@/components/shell/app-providers";
import { attendlyClerkAppearance } from "@/lib/clerk-appearance";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Attendly",
  description:
    "Personal attendance co-pilot — mark classes, plan bunks, keep eligibility.",
  applicationName: "Attendly",
  appleWebApp: {
    capable: true,
    title: "Attendly",
    statusBarStyle: "default",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f6e6a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans text-ink">
        <ClerkProvider appearance={attendlyClerkAppearance}>
          <AppProviders>
            <AppFrame>{children}</AppFrame>
          </AppProviders>
        </ClerkProvider>
      </body>
    </html>
  );
}
