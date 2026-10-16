import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
// Through Supabase's transaction pooler, node-postgres sends a query in one
// round trip; Prisma's built-in `pgbouncer=true` mode needed about five, which
// multiplied the distance to the database on every query.
function adapter() {
  const url = new URL(
    process.env.DATABASE_URL ?? "postgresql://localhost:5432/postgres",
  );
  const max = Number(url.searchParams.get("connection_limit")) || 10;
  // Prisma-only options that node-postgres does not understand.
  for (const key of [
    "pgbouncer",
    "connection_limit",
    "statement_cache_size",
    "socket_timeout",
    "sslmode",
  ])
    url.searchParams.delete(key);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return new PrismaPg({
    connectionString: url.toString(),
    max,
    // Encrypted like Prisma's default `sslmode=prefer`; Supabase signs the
    // pooler certificate with its own CA.
    ssl: local ? false : { rejectUnauthorized: false },
  });
}
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalDb.prisma ?? new PrismaClient({ adapter: adapter() });
if (process.env.NODE_ENV !== "production") globalDb.prisma = db;
