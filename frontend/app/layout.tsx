import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GoogleOAuthProvider } from "@react-oauth/google"
import { ToastProvider } from "@/components/ui/toast"


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Template so every page can set its own title without repeating the brand.
  title: {
    default: "Crewaa — where brands and creators collaborate with intelligence",
    template: "%s · Crewaa",
  },
  description:
    "Crewaa is a curated collaboration platform connecting brands with verified creators — without agencies, without noise, and with complete transparency.",
  metadataBase: new URL("https://crewaa.in"),
  openGraph: {
    title: "Crewaa — where brands and creators collaborate with intelligence",
    description:
      "A curated collaboration platform connecting brands with verified creators.",
    url: "https://crewaa.in",
    siteName: "Crewaa",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Crewaa",
    description:
      "A curated collaboration platform connecting brands with verified creators.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
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
