import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PocketMinder",
    short_name: "PocketMinder",
    description: "Your brain for the dates you can't afford to forget.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4ef",
    theme_color: "#2f5d50",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
