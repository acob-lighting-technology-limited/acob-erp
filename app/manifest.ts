import type { MetadataRoute } from "next"

/**
 * Web app manifest, served at /manifest.webmanifest.
 *
 * This is what lets staff install Matrix to a phone home screen. On iOS it is
 * also a hard prerequisite for web push: Safari only grants notification
 * permission to a PWA that has been added to the Home Screen, never to a
 * regular browser tab.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Matrix — ACOB Lighting",
    short_name: "Matrix",
    description: "Matrix — the internal workspace platform for ACOB Lighting Technology Limited",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Splash background matches the icon ground so the launch screen reads as
    // one surface rather than a dark square on white.
    background_color: "#080707",
    theme_color: "#080707",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Kept separate from the "any" icons: Android crops maskable icons to a
      // platform shape, so this one holds the mark inside the 80% safe zone.
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
