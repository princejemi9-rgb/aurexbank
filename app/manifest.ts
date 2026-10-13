import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aurex Bank Operations",
    short_name: "Aurex Ops",
    description: "Secure simulated banking operations console.",
    start_url: "/admin",
    display: "standalone",
    background_color: "#050606",
    theme_color: "#05df72",
    icons: [
      { src: "/aurex-bank-logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
