import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configured } from "@/lib/env";
import { publicCatalog } from "@/lib/services/bookings";
import { HttpError } from "@/lib/errors";
import { PublicBooking } from "@/components/public-booking";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Цаг захиалах · Salon77",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  if (!configured) notFound();
  const { module: slug } = await params;
  let catalog;
  try {
    catalog = await publicCatalog(db, slug);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  }
  return (
    <main className="pb-page">
      <PublicBooking slug={slug} catalog={catalog} />
    </main>
  );
}
