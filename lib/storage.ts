// Server-only: uses the Supabase secret key. Never import from client components.
import { createClient } from "@supabase/supabase-js";
export const MEDIA_BUCKET = "salon-media";
export type MediaStore = {
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<string>;
  remove(path: string): Promise<void>;
  // The bucket path of a URL this store issued, or null for foreign URLs.
  pathOf(url: string): string | null;
};
export function supabaseMediaStore(): MediaStore | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || !/^sb_secret_[A-Za-z0-9_-]+$/.test(key)) return null;
  const bucket = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(MEDIA_BUCKET);
  const prefix = `${url.replace(/\/$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/`;
  return {
    async upload(path, bytes, contentType) {
      const { error } = await bucket.upload(path, bytes, {
        contentType,
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw new Error("Storage upload failed");
      return prefix + path;
    },
    async remove(path) {
      await bucket.remove([path]);
    },
    pathOf(value) {
      return value.startsWith(prefix) ? value.slice(prefix.length) : null;
    },
  };
}
