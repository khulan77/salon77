import { identity, HttpError } from "@/lib/auth";
import { configured } from "@/lib/env";
import { db } from "@/lib/db";
import { tokenSchema } from "@/lib/validation";
import { previewInvitation, invalidInvitation } from "@/lib/services/team";
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
  let invitation;
  let error: string | undefined;
  try {
    invitation = await previewInvitation(db, token);
  } catch (e) {
    error = e instanceof HttpError ? e.message : invalidInvitation;
  }
  const user = invitation ? await identity().catch(() => null) : null;
  return (
    <InvitationAccept
      token={token}
      invitation={invitation}
      error={error}
      signedInEmail={user?.email ?? null}
    />
  );
}
