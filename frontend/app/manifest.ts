import type { MetadataRoute } from "next";

/**
 * Web app manifest, served by Next at /manifest.webmanifest.
 *
 * This is what a creator gets when they add Crewaa to an Android home screen,
 * and what Chrome reads for the install prompt. Without it the shortcut falls
 * back to a screenshot of the page with a generic globe icon.
 *
 * `theme_color` and `background_color` are the brand Night and Ink from the
 * brand sheet rather than white, because the app is dark-only — a white splash
 * screen followed by a black app is a visible flash on every cold start.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Crewaa — where brands and creators collaborate with intelligence",
    short_name: "Crewaa",
    description:
      "A curated collaboration platform connecting brands with verified creators.",
    start_url: "/",
    display: "standalone",
    background_color: "#070913",
    theme_color: "#0B0D17",
    icons: [
      // `any`, not `maskable`. These are drawn as finished app icons — a
      // rounded square with transparent corners — so they already carry their
      // own shape. A maskable icon has to be full-bleed with the artwork
      // inside the central 80% safe zone; declaring these maskable would let
      // a square launcher mask reveal the transparent corners.
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // The vector too, so a launcher that wants a larger or oddly-sized icon
      // scales the mark rather than the 512px raster.
      { src: "/crewaa-mark.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
