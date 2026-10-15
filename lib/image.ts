// Public Supabase Storage objects can go through Next's image optimizer;
// anything else (tests, foreign URLs) is served as-is.
const storageHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  } catch {
    return "";
  }
})();

export function optimizable(src: string) {
  if (!storageHost) return false;
  try {
    const url = new URL(src);
    return (
      url.protocol === "https:" &&
      url.host === storageHost &&
      url.pathname.startsWith("/storage/v1/object/public/")
    );
  } catch {
    return false;
  }
}
