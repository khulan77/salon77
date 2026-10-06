import { z } from "zod";
const runtimeEnvSchema = z.object({
  supabaseUrl: z.url({ protocol: /^https?$/ }),
  supabaseKey: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]+$/),
  databaseUrl: z.url({ protocol: /^postgres(?:ql)?$/ }),
});
const raw = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  databaseUrl: process.env.DATABASE_URL,
};
// Configuration detection and client initialization must use the same validation.
const parsed = runtimeEnvSchema.safeParse(raw);
export const configured = parsed.success;
export function authEnv() {
  const result = parsed;
  if (!result.success)
    throw new Error(
      "Invalid Salon77 environment configuration. Check .env.example.",
    );
  return { url: result.data.supabaseUrl, key: result.data.supabaseKey };
}
