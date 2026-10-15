import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configured } from "@/lib/env";
import { publicCatalog, type PublicCatalog } from "@/lib/services/bookings";
import { HttpError } from "@/lib/errors";
import { identity } from "@/lib/auth";
import { PublicBooking } from "@/components/public-booking";
export const dynamic = "force-dynamic";
// Shared by the metadata and the page so the catalog is read once.
const visitorCatalog = cache((slug: string) =>
  publicCatalog(db, slug).catch((e) => {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  }),
);
const siteUrl = () => process.env.APP_URL?.replace(/\/$/, "") ?? "";
// Search engines and link previews (Facebook, Messenger, Viber) read these.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string }>;
}): Promise<Metadata> {
  const { module: slug } = await params;
  const catalog = configured ? await visitorCatalog(slug) : null;
  if (!catalog)
    return {
      title: "Цаг захиалах · Salon77",
      robots: { index: false, follow: false },
    };
  const { salon, reviews } = catalog,
    branch = catalog.branches[0];
  const description = [
    salon.description ||
      `${salon.name}${branch ? ` · ${branch.district}` : ""}. Онлайнаар цагаа захиалаарай.`,
    reviews.average !== null &&
      `★ ${reviews.average.toFixed(1)} (${reviews.count} үнэлгээ)`,
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 200);
  const image = branch?.imageUrl ?? salon.coverUrl ?? salon.images[0]?.url;
  const url = siteUrl() ? `${siteUrl()}/${slug}/book` : undefined;
  return {
    title: `${salon.name} · Цаг захиалах`,
    description,
    ...(url ? { alternates: { canonical: url } } : {}),
    openGraph: {
      title: `${salon.name} · Цаг захиалах`,
      description,
      type: "website",
      locale: "mn_MN",
      siteName: "Salon77",
      ...(url ? { url } : {}),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: `${salon.name} · Цаг захиалах`,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  if (!configured) notFound();
  const { module: slug } = await params;
  // Visitors get the public catalog; only when that is hidden do we check
  // whether the signed-in user may preview their own salon under review.
  let catalog = await visitorCatalog(slug);
  if (!catalog) {
    const user = await identity().catch(() => null);
    if (user)
      catalog = await publicCatalog(db, slug, user.id).catch((e) => {
        if (e instanceof HttpError && e.status === 404) return null;
        throw e;
      });
  }
  if (!catalog) notFound();
  return (
    <main className="pb-page">
      {catalog.preview && (
        <p className="pb-preview" role="status">
          <strong>Урьдчилан харах горим</strong> · Салон тань баталгаажих хүртэл
          энэ хуудас зөвхөн танд харагдана.
        </p>
      )}
      {!catalog.preview && (
        <script
          type="application/ld+json"
          // Structured data for search results: name, address, rating.
          dangerouslySetInnerHTML={{ __html: structuredData(catalog, slug) }}
        />
      )}
      <PublicBooking slug={slug} catalog={catalog} />
    </main>
  );
}
function structuredData(catalog: PublicCatalog, slug: string) {
  const { salon, reviews } = catalog,
    branch = catalog.branches[0];
  const data = {
    "@context": "https://schema.org",
    "@type": "BeautySalon",
    name: salon.name,
    ...(salon.description ? { description: salon.description } : {}),
    ...(siteUrl() ? { url: `${siteUrl()}/${slug}/book` } : {}),
    telephone: branch?.phone || salon.phone,
    ...(branch
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: branch.address,
            addressLocality: branch.district,
            addressRegion: "Улаанбаатар",
            addressCountry: "MN",
          },
        }
      : {}),
    ...(salon.coverUrl ? { image: salon.coverUrl } : {}),
    ...(reviews.average !== null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviews.average,
            reviewCount: reviews.count,
          },
        }
      : {}),
  };
  // "<" is escaped so salon text can never close the script tag.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
