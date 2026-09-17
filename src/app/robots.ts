import type { MetadataRoute } from "next";

const SITE_URL = "https://www.kartikey.fyi";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/record", "/record.json", "/llms.txt"],
      disallow: ["/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
