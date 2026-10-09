import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaClient } from "@prisma/client";
import { readdir, readFile } from "node:fs/promises";
export async function testDatabase(port = 0) {
  const pg = await PGlite.create({ extensions: { btree_gist } });
  await pg.exec("CREATE ROLE anon; CREATE ROLE authenticated;");
  for (const dir of (await readdir("prisma/migrations")).sort()) {
    if (/^\d/.test(dir))
      await pg.exec(
        await readFile(`prisma/migrations/${dir}/migration.sql`, "utf8"),
      );
  }
  const server = new PGLiteSocketServer({
    db: pg,
    host: "127.0.0.1",
    port,
    maxConnections: 8,
  });
  await server.start();
  const address = server.getServerConn();
  const url = `postgresql://postgres:postgres@${address}/postgres?connection_limit=1&socket_timeout=30&statement_cache_size=0&pgbouncer=true`;
  const db = new PrismaClient({ datasources: { db: { url } } });
  await db.$connect();
  return {
    db,
    pg,
    url,
    async close() {
      await db.$disconnect();
      await server.stop();
      // Prisma's engine may still flush its last frames through the socket;
      // closing PGlite before they land makes it throw after the test ends.
      await new Promise((resolve) => setTimeout(resolve, 250));
      await pg.close();
    },
  };
}
export const userIds = {
  owner: "00000000-0000-0000-0000-000000000001",
  other: "00000000-0000-0000-0000-000000000002",
  reception: "00000000-0000-0000-0000-000000000003",
  manager: "00000000-0000-0000-0000-000000000004",
  staff: "00000000-0000-0000-0000-000000000005",
  invite: "00000000-0000-0000-0000-000000000006",
};
export async function seed(db: PrismaClient) {
  for (const [name, id] of Object.entries(userIds))
    await db.user.create({
      data: {
        id,
        email: `${name}@example.test`,
        name:
          name === "owner"
            ? "Эзэмшигч"
            : name === "invite"
              ? "Сараа"
              : "Гишүүн",
      },
    });
  for (const id of ["a", "b"])
    await db.salon.create({
      data: {
        id,
        name: id === "a" ? "Туршилтын салон" : "Өөр салон",
        slug: `salon-${id}`,
        phone: "99112233",
      },
    });
  for (const [id, salonId, name] of [
    ["z", "a", "Зайсан"],
    ["y", "a", "Яармаг"],
    ["other", "b", "Нөгөө салбар"],
  ])
    await db.branch.create({
      data: {
        id,
        salonId,
        name,
        district: "Хан-Уул",
        address: "Туршилтын хаяг",
        phone: "99112233",
      },
    });
  const members = [
    ["owner", "a", "SALON_OWNER", []],
    ["other", "b", "SALON_OWNER", []],
    ["reception", "a", "RECEPTIONIST", ["z"]],
    ["manager", "a", "MANAGER", ["z", "y"]],
    ["staff", "a", "STAFF", ["z", "y"]],
  ] as const;
  for (const [id, salonId, role, branches] of members)
    await db.salonMember.create({
      data: {
        id,
        salonId,
        userId: userIds[id],
        role,
        branches: {
          create: branches.map((branchId) => ({ branchId })),
        },
      },
    });
}
