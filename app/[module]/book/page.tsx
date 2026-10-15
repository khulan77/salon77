import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { configured } from "@/lib/env";
import { publicCatalog } from "@/lib/services/bookings";
import { HttpError } from "@/lib/errors";
import { identity } from "@/lib/auth";
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
  const load = (previewUserId?: string) =>
    publicCatalog(db, slug, previewUserId).catch((e) => {
      if (e instanceof HttpError && e.status === 404) return null;
      throw e;
    });
  // Visitors get the public catalog; only when that is hidden do we check
  // whether the signed-in user may preview their own salon under review.
  let catalog = await load();
  if (!catalog) {
    const user = await identity().catch(() => null);
    if (user) catalog = await load(user.id);
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
      <PublicBooking slug={slug} catalog={catalog} />
    </main>
  );
}
