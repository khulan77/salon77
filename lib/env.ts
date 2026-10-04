import { z } from "zod";
const runtimeEnvSchema = z.object({
  supabaseUrl: z.url(),
  supabaseKey: z.string().min(1),
  databaseUrl: z
    .string()
    .startsWith("postgresql://")
    .or(z.string().startsWith("postgres://")),
});
const raw = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  databaseUrl: process.env.DATABASE_URL,
};
export const configured = Boolean(
  raw.supabaseUrl && raw.supabaseKey && raw.databaseUrl,
);
export function authEnv() {
  const result = runtimeEnvSchema.safeParse(raw);
  if (!result.success)
    throw new Error(
      "Invalid Salon77 environment configuration. Check .env.example.",
    );
  return { url: result.data.supabaseUrl, key: result.data.supabaseKey };
}
