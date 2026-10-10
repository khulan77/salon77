import { redirect } from "next/navigation";
import { membership, HttpError } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { configured } from "@/lib/env";
import { db } from "@/lib/db";
import { readApplication } from "@/lib/services/application";
import { ApplicationReview } from "@/components/application-review";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!configured) redirect("/onboarding");
  let application;
  try {
    application = await readApplication(
      db,
      actorFromMember(await membership()),
    );
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/sign-in");
    // No salon yet, or not the owner: nothing to review here.
    if (e instanceof HttpError && e.status === 403) redirect("/");
    throw e;
  }
  return <ApplicationReview initial={application} />;
}
