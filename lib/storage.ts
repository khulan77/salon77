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
export function supabaseMediaStore(): MediaStore | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, ""),
    key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || !/^sb_secret_[A-Za-z0-9_-]+$/.test(key)) return null;
  const storage = `${url}/storage/v1`;
  const auth = { apikey: key, Authorization: `Bearer ${key}` };
  const prefix = `${storage}/object/public/${MEDIA_BUCKET}/`;
  return {
    async upload(path, bytes, contentType) {
      const response = await fetch(`${storage}/object/${MEDIA_BUCKET}/${path}`, {
        method: "POST",
        headers: {
          ...auth,
          "Content-Type": contentType,
          "Cache-Control": "max-age=31536000",
          "x-upsert": "false",
        },
        body: new Blob([bytes as BlobPart], { type: contentType }),
      });
      // Never surface the provider's response; it may echo request details.
      if (!response.ok) throw new Error("Storage upload failed");
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
