// Server-only: uses the Supabase secret key. Never import from client components.
// Talks to the Storage REST API directly: the full supabase-js client also
// starts a realtime socket, which is unavailable on Node 20 and not needed here.
export const MEDIA_BUCKET = "salon-media";
export type MediaStore = {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<string>;
  remove(path: string): Promise<void>;
  // The bucket path of a URL this store issued, or null for foreign URLs.
  pathOf(url: string): string | null;
};
// Why uploads are off, named for the operator's log. Never includes the key.
export type StorageProblem =
  | "missing_url"
  | "missing_key"
  | "legacy_jwt_key"
  | "publishable_key"
  | "invalid_key";
export function storageConfig(
  env: Record<string, string | undefined> = process.env,
):
  | { ok: true; url: string; key: string }
  | { ok: false; problem: StorageProblem } {
  // Pasted values often carry quotes or a trailing newline.
  const clean = (v?: string) => v?.trim().replace(/^["']|["']$/g, "") ?? "";
  const url = clean(env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/$/, ""),
    key = clean(env.SUPABASE_SECRET_KEY);
  if (!/^https?:\/\/\S+$/.test(url))
    return { ok: false, problem: "missing_url" };
  if (!key) return { ok: false, problem: "missing_key" };
  if (/^sb_secret_[A-Za-z0-9_-]+$/.test(key)) return { ok: true, url, key };
  return {
    ok: false,
    problem: key.startsWith("eyJ")
      ? "legacy_jwt_key"
      : key.startsWith("sb_publishable_")
        ? "publishable_key"
        : "invalid_key",
  };
}
const hints: Record<StorageProblem, string> = {
  missing_url: "NEXT_PUBLIC_SUPABASE_URL is not set",
  missing_key: "SUPABASE_SECRET_KEY is not set",
  legacy_jwt_key:
    "SUPABASE_SECRET_KEY is a legacy service_role JWT; use an sb_secret_ key from Settings → API Keys",
  publishable_key:
    "SUPABASE_SECRET_KEY holds the publishable key; use the sb_secret_ key",
  invalid_key: "SUPABASE_SECRET_KEY is not an sb_secret_ key",
};
let warned = false;
export function supabaseMediaStore(): MediaStore | null {
  const config = storageConfig();
  if (!config.ok) {
    if (!warned)
      console.error(
        `Salon77 image uploads disabled: ${hints[config.problem]}.`,
      );
    warned = true;
    return null;
  }
  const { url, key } = config;
  const storage = `${url}/storage/v1`;
  const auth = { apikey: key, Authorization: `Bearer ${key}` };
  const prefix = `${storage}/object/public/${MEDIA_BUCKET}/`;
  return {
    async upload(path, bytes, contentType) {
      const response = await fetch(
        `${storage}/object/${MEDIA_BUCKET}/${path}`,
        {
          method: "POST",
          headers: {
            ...auth,
            "Content-Type": contentType,
            "Cache-Control": "max-age=31536000",
            "x-upsert": "false",
          },
          body: new Blob([bytes as BlobPart], { type: contentType }),
        },
      );
      // Never surface the provider's response; it may echo request details.
      if (!response.ok) {
        console.error(
          `Salon77 image upload failed: Supabase Storage answered ${response.status}` +
            (response.status === 404
              ? ` (does the "${MEDIA_BUCKET}" bucket exist?)`
              : [401, 403].includes(response.status)
                ? " (is SUPABASE_SECRET_KEY from this project?)"
                : ""),
        );
        throw new Error("Storage upload failed");
      }
      return prefix + path;
    },
    async remove(path) {
      await fetch(`${storage}/object/${MEDIA_BUCKET}`, {
        method: "DELETE",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [path] }),
      });
    },
    pathOf(value) {
      return value.startsWith(prefix) ? value.slice(prefix.length) : null;
    },
  };
}
