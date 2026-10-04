import { redirect } from "next/navigation";
import { identity } from "@/lib/auth";
import { configured } from "@/lib/env";
import { Onboarding } from "@/components/onboarding";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (configured) {
    try {
      await identity();
    } catch {
      redirect("/sign-in");
    }
  }
  return <Onboarding preview={!configured} />;
}
