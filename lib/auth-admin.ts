// Server-only: uses the Supabase secret key. Never import from client components.
import { storageConfig } from "./storage";
export type CreatedUser =
  { ok: true } | { ok: false; reason: "exists" | "unavailable" | "failed" };
// Creates an already confirmed account for an invited email. The invitation
// link proves the salon admin chose this person; the password is theirs.
export async function createInvitedUser(
  input: { email: string; password: string; name: string },
  env: Record<string, string | undefined> = process.env,
  send: typeof fetch = fetch,
): Promise<CreatedUser> {
  const config = storageConfig(env);
  if (!config.ok) return { ok: false, reason: "unavailable" };
  try {
    const response = await send(`${config.url}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { name: input.name },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) return { ok: true };
    const body = await response.json().catch(() => ({}));
    if (
      response.status === 422 &&
      /email_exists|already/i.test(`${body.error_code ?? ""} ${body.msg ?? ""}`)
    )
      return { ok: false, reason: "exists" };
    console.error(`Salon77 invited user creation failed: ${response.status}`);
    return { ok: false, reason: "failed" };
  } catch {
    console.error("Salon77 invited user creation failed");
    return { ok: false, reason: "failed" };
  }
}
