import type { MetadataRoute } from "next";

const SITE_URL = "https://www.kartikey.fyi";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/record`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/record.json`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/llms.txt`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
