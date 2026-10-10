import type { MetadataRoute } from "next";
// Absolute URLs are required, so the sitemap stays empty until APP_URL is set.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  if (!base || !/^https?:\/\//.test(base)) return [];
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/business`, changeFrequency: "weekly", priority: 0.8 },
  ];
}
