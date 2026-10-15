import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { configured } from "@/lib/env";
import { listedSalonSlugs } from "@/lib/services/directory";
// Absolute URLs are required, so the sitemap stays empty until APP_URL is set.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  if (!base || !/^https?:\/\//.test(base)) return [];
  // Each listed salon's booking page, so search engines find them.
  const salons = configured ? await listedSalonSlugs(db).catch(() => []) : [];
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/business`, changeFrequency: "weekly", priority: 0.8 },
    ...salons.map((s) => ({
      url: `${base}/${s.slug}/book`,
      lastModified: s.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
  ];
}
