import { ResetPasswordForm } from "@/components/auth-form";
import { sessionUser } from "@/lib/auth";
export const metadata = { title: "Шинэ нууц үг" };
export const dynamic = "force-dynamic";
// The recovery link signs the user in on the way here.
export default async function Page() {
  const signedIn = Boolean(await sessionUser().catch(() => null));
  return <ResetPasswordForm signedIn={signedIn} />;
}
