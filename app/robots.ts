import type { MetadataRoute } from "next";

const SITE_URL = "https://aurexbank.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/auth/",
        "/cards/",
        "/dashboard/",
        "/devices/",
        "/login",
        "/notifications/",
        "/payments/",
        "/profile/",
        "/receive/",
        "/security/",
        "/send/",
        "/settings/",
        "/transactions/",
      ],
      crawlDelay: 1,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
