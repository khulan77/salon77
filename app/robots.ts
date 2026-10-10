import type { MetadataRoute } from "next";
// Only the public marketing pages are meant for search engines.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: ["/$", "/business"],
      disallow: ["/api/", "/platform", "/*/manage", "/sign-in", "/sign-up"],
    },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
