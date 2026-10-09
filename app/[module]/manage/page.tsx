import type { Metadata } from "next";
import { db } from "@/lib/db";
import { configured } from "@/lib/env";
import { HttpError } from "@/lib/errors";
import { readManagedVisit } from "@/lib/services/manage";
import { ManageVisit } from "@/components/manage-visit";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Захиалга удирдах · Salon77",
  robots: { index: false, follow: false },
  // The token is a secret; never leak it to other sites.
  referrer: "no-referrer",
};
export default async function ManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { module: slug } = await params;
  const { token } = await searchParams;
  let visit = null;
  if (configured)
    try {
      visit = await readManagedVisit(db, slug, token);
    } catch (e) {
      if (!(e instanceof HttpError)) throw e;
    }
  return (
    <main className="pb-page">
      <ManageVisit slug={slug} token={token ?? ""} initial={visit} />
    </main>
  );
}
