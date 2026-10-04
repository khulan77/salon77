import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("PostgreSQL migration and tenant integrity", async (t) => {
  const db = new PGlite();
  try {
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated;");
    await db.exec(
      await readFile(
        "prisma/migrations/202610050001_foundation/migration.sql",
        "utf8",
      ),
    );
    await db.exec(`
      INSERT INTO "User" (id,email) VALUES ('00000000-0000-0000-0000-000000000001','a@example.com'),('00000000-0000-0000-0000-000000000002','b@example.com');
      INSERT INTO "Salon" (id,name,slug,phone,"updatedAt") VALUES ('a','Salon A','salon-a','1',now()),('b','Salon B','salon-b','2',now());
      INSERT INTO "SalonMember" (id,"salonId","userId",role) VALUES ('ma','a','00000000-0000-0000-0000-000000000001','SALON_OWNER'),('mb','b','00000000-0000-0000-0000-000000000002','SALON_OWNER');
      INSERT INTO "Branch" (id,"salonId",name,district,address,phone,"updatedAt") VALUES ('ba','a','Branch A','District','Address','1',now()),('bb','b','Branch B','District','Address','2',now());
    `);
    await t.test("unique slugs are enforced by PostgreSQL", async () => {
      await assert.rejects(
        db.exec(
          `INSERT INTO "Salon" (id,name,slug,phone,"updatedAt") VALUES ('c','Salon C','salon-a','3',now())`,
        ),
        /unique/,
      );
    });
    await t.test(
      "cross-tenant member branch assignments are impossible",
      async () => {
        await assert.rejects(
          db.exec(
            `INSERT INTO "MemberBranch" ("memberId","branchId","salonId") VALUES ('ma','bb','a')`,
          ),
          /foreign key/,
        );
        await assert.rejects(
          db.exec(
            `INSERT INTO "MemberBranch" ("memberId","branchId","salonId") VALUES ('ma','bb','b')`,
          ),
          /foreign key/,
        );
        await db.exec(
          `INSERT INTO "MemberBranch" ("memberId","branchId","salonId") VALUES ('ma','ba','a')`,
        );
      },
    );
    await t.test(
      "membership uniqueness prevents duplicate tenant grants",
      async () => {
        await assert.rejects(
          db.exec(
            `INSERT INTO "SalonMember" (id,"salonId","userId",role) VALUES ('other','a','00000000-0000-0000-0000-000000000001','MANAGER')`,
          ),
          /unique/,
        );
      },
    );
    await t.test(
      "scoped branch updates cannot change another salon",
      async () => {
        const result = await db.query(
          `UPDATE "Branch" SET active = false WHERE id = $1 AND "salonId" = $2 RETURNING id`,
          ["bb", "a"],
        );
        assert.equal(result.rows.length, 0);
        const branch = await db.query<{ active: boolean }>(
          `SELECT active FROM "Branch" WHERE id='bb'`,
        );
        assert.equal(branch.rows[0].active, true);
      },
    );
    await t.test(
      "cross-tenant invitation assignments and owner invites are blocked",
      async () => {
        await db.exec(
          `INSERT INTO "Invitation" (id,"salonId",name,email,role,"tokenHash","expiresAt") VALUES ('ia','a','Person','p@example.com','MANAGER','hash',now()+interval '7 days')`,
        );
        await assert.rejects(
          db.exec(
            `INSERT INTO "InvitationBranch" ("invitationId","branchId","salonId") VALUES ('ia','bb','a')`,
          ),
          /foreign key/,
        );
        await assert.rejects(
          db.exec(
            `INSERT INTO "Invitation" (id,"salonId",name,email,role,"tokenHash","expiresAt") VALUES ('ib','a','Person','p@example.com','SALON_OWNER','hash2',now()+interval '7 days')`,
          ),
          /check constraint/,
        );
      },
    );
    await t.test(
      "anonymous and authenticated Supabase API roles cannot read or write private tables",
      async () => {
        for (const role of ["anon", "authenticated"]) {
          await db.exec(`SET ROLE ${role}`);
          try {
            await assert.rejects(
              db.exec('SELECT * FROM "Salon"'),
              /permission denied/,
            );
            await assert.rejects(
              db.exec('SELECT * FROM "Branch"'),
              /permission denied/,
            );
            await assert.rejects(
              db.exec(`UPDATE "Salon" SET name='hacked' WHERE id='b'`),
              /permission denied/,
            );
            await assert.rejects(
              db.exec(`DELETE FROM "Salon" WHERE id='b'`),
              /permission denied/,
            );
            await assert.rejects(
              db.exec(
                `INSERT INTO "SalonMember" (id,"salonId","userId",role) VALUES ('hack','b','00000000-0000-0000-0000-000000000001','SALON_OWNER')`,
              ),
              /permission denied/,
            );
          } finally {
            await db.exec("RESET ROLE");
          }
        }
      },
    );
    await t.test(
      "onboarding transaction rolls back salon on branch failure",
      async () => {
        await db.exec("BEGIN");
        await db.exec(
          `INSERT INTO "Salon" (id,name,slug,phone,"updatedAt") VALUES ('rollback','Test','rollback-test','3',now())`,
        );
        await assert.rejects(
          db.exec(
            `INSERT INTO "Branch" (id,"salonId",name,district,address,phone,latitude,"updatedAt") VALUES ('bad','rollback','Bad','D','A','1',999,now())`,
          ),
          /check constraint/,
        );
        await db.exec("ROLLBACK");
        assert.equal(
          (await db.query(`SELECT id FROM "Salon" WHERE id='rollback'`)).rows
            .length,
          0,
        );
      },
    );
  } finally {
    await db.close();
  }
});
