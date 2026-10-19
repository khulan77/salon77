import { notFound, redirect } from "next/navigation";
import { platformSession } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { PlatformVerify } from "@/components/platform-verify";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Платформ · Баталгаажуулалт",
  robots: { index: false, follow: false },
};
// The authenticator-code step in front of the platform console.
export default async function Page() {
  const session = await platformSession();
  if (!session) notFound();
  if (session.verified) redirect("/platform");
  const { data } = await (await supabase()).auth.mfa.listFactors();
  return <PlatformVerify enrolled={Boolean(data?.totp.length)} />;
}
