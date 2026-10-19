// Emails allowed on the platform console. Production refuses everyone while
// PLATFORM_ADMIN_EMAILS is unset, so a stray super-admin flag grants nothing.
export function platformEmailAllowed(
  email: string,
  env: Record<string, string | undefined> = process.env,
) {
  const list = (env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return env.NODE_ENV !== "production";
  return list.includes(email.trim().toLowerCase());
}
// A console session must have passed an authenticator-app code recently.
export const PLATFORM_MFA_HOURS = 12;
export function platformMfaFresh(
  claims: { aal?: unknown; amr?: unknown },
  now = Date.now(),
) {
  if (claims.aal !== "aal2" || !Array.isArray(claims.amr)) return false;
  return claims.amr.some(
    (m: { method?: unknown; timestamp?: unknown }) =>
      m?.method === "totp" &&
      typeof m.timestamp === "number" &&
      now / 1000 - m.timestamp < PLATFORM_MFA_HOURS * 3600,
  );
}
