import { redirect } from "next/navigation";
import { membership, HttpError, salonSuspended } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { configured } from "@/lib/env";
import { db } from "@/lib/db";
import { readApplication } from "@/lib/services/application";
import { profileChecklist } from "@/lib/services/publish";
import { ApplicationReview } from "@/components/application-review";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!configured) redirect("/onboarding");
  let application, checklist;
  try {
    const actor = actorFromMember(await membership({ unapproved: true }));
    [application, checklist] = await Promise.all([
      readApplication(db, actor),
      profileChecklist(db, actor.salonId),
    ]);
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/sign-in");
    if (e instanceof HttpError && e.message === salonSuspended)
      redirect("/suspended");
    // No salon yet, or not the owner: nothing to review here.
    if (e instanceof HttpError && e.status === 403) redirect("/");
    throw e;
  }
  return <ApplicationReview initial={application} checklist={checklist} />;
}
