import type { Metadata } from "next";
import { Bodoni_Moda, Geist_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";
import { GoogleOAuthProvider } from "@react-oauth/google"
import { ToastProvider } from "@/components/ui/toast"


// Royal Peacock type (V3): Instrument Sans for all text, Bodoni Moda for headlines.
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const bodoniModa = Bodoni_Moda({
  variable: "--font-bodoni-moda",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Template so every page can set its own title without repeating the brand.
  title: {
    default: "Crewaa — brands, businesses and creators. One crew.",
    template: "%s · Crewaa",
  },
  description:
    "Crewaa brings brands, businesses and creators together: creator collaborations with an Authenticity Score, managed business growth, AI influencers, an AI marketing suite, and a crew of editors and writers for creators.",
  metadataBase: new URL("https://crewaa.in"),
  openGraph: {
    title: "Crewaa — brands, businesses and creators. One crew.",
    description:
      "Creator collaborations, business growth, AI influencers and a crew for creators — built for India.",
    url: "https://crewaa.in",
    siteName: "Crewaa",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Crewaa",
    description:
      "Creator collaborations, business growth, AI influencers and a crew for creators — built for India.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `dark` is pinned here rather than chosen at runtime. globals.css defines
    // the Tailwind variant as `&:is(.dark *)` and `:root` sets a white
    // `--background`, so without this class the ~48 `dark:` utilities across
    // the dashboard silently do not apply — which is exactly what anyone whose
    // OS was set to light used to get: light component internals inside a
    // hardcoded dark shell. Crewaa is dark-only, so the class is a constant,
    // not a preference. `suppressHydrationWarning` is no longer needed for the
    // theme (nothing mutates the class now) but is kept for browser extensions
    // that inject attributes into <html>.
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${instrumentSans.variable} ${bodoniModa.variable} ${geistMono.variable} antialiased`}
      >
         <GoogleOAuthProvider
          clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}
        >
        <ToastProvider>{children}</ToastProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
