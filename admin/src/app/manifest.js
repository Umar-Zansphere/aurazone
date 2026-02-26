export default function manifest() {
  return {
    name: "AuraZone Admin",
    short_name: "AuraAdmin",
    description: "Mobile-first admin dashboard for AuraZone",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FAFAF8",
    theme_color: "#FF6B6B",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}
