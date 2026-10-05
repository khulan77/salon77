import { redirect } from "next/navigation";
import { identity, HttpError } from "@/lib/auth";
import { configured } from "@/lib/env";
import { db } from "@/lib/db";
import { tokenSchema } from "@/lib/validation";
import { inspectInvitation, invalidInvitation } from "@/lib/services/team";
import { InvitationAccept } from "@/components/invitation-accept";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Багт нэгдэх урилга",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const parsed = tokenSchema.safeParse((await searchParams).token);
  if (!parsed.success || !configured)
    return <InvitationAccept token="" error={invalidInvitation} />;
  const token = parsed.data;
  let user;
  try {
    user = await identity();
  } catch (e) {
    if (e instanceof HttpError && e.status === 401)
      redirect(`/sign-in?next=${encodeURIComponent(`/invite?token=${token}`)}`);
    throw e;
  }
  let invitation;
  let error: string | undefined;
  try {
    invitation = await inspectInvitation(
      db,
      {
        id: user.id,
        email: user.email!,
        emailConfirmed: Boolean(user.email_confirmed_at),
      },
      token,
    );
  } catch (e) {
    error = e instanceof HttpError ? e.message : invalidInvitation;
  }
  return (
    <InvitationAccept token={token} invitation={invitation} error={error} />
  );
}
