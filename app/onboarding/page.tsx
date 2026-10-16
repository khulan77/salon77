import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";
import { configured } from "@/lib/env";
import { db } from "@/lib/db";
import { Onboarding } from "@/components/onboarding";
export const dynamic = "force-dynamic";
export default async function Page() {
  let hasSalon = false;
  if (configured) {
    let user;
    try {
      user = await sessionUser();
    } catch {
      redirect("/sign-in");
    }
    hasSalon = Boolean(
      await db.salonMember.findFirst({
        where: { userId: user.id, active: true },
        select: { id: true },
      }),
    );
  }
  return <Onboarding preview={!configured} hasSalon={hasSalon} />;
}
