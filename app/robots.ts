import type { MetadataRoute } from "next";
// Public pages and each salon's booking page are meant for search engines.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: ["/$", "/business", "/home", "/*/book"],
      disallow: ["/api/", "/platform", "/*/manage", "/sign-in", "/sign-up"],
    },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
