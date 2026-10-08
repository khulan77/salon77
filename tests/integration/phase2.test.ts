import { test } from "node:test";
import assert from "node:assert/strict";
import { testDatabase, seed, userIds } from "../fixtures/database";
import { actorFromMember } from "../../lib/access";
import {
  saveCategory,
  saveService,
  readCatalog,
} from "../../lib/services/catalog";
import {
  saveStaff,
  readStaff,
  saveHours,
  readSchedules,
  saveTimeOff,
  removeSchedule,
} from "../../lib/services/staff";
import {
  createInvitation,
  acceptInvitation,
  inspectInvitation,
  cancelInvitation,
  updateMember,
  tokenHash,
} from "../../lib/services/team";
import { HttpError } from "../../lib/errors";
const denied = (status: number) => (e: unknown) =>
  e instanceof HttpError && e.status === status;

test(
  "Phase 2 real Prisma/PostgreSQL services and authorization",
  { timeout: 120000 },
  async (t) => {
    const fixture = await testDatabase(55478),
      { db, pg } = fixture;
    try {
      await seed(db);
      const actor = async (id: string) =>
        actorFromMember(
          await db.salonMember.findUniqueOrThrow({
            where: { id },
            include: {
              branches: { where: { branch: { active: true } } },
              staff: { include: { branches: true } },
            },
          }),
        );
      const owner = await actor("owner"),
        other = await actor("other"),
        reception = await actor("reception"),
        manager = await actor("manager");
      const category = { name: "Хумс", sortOrder: 0, active: true };
      const ca = await saveCategory(db, owner, category),
        cb = await saveCategory(db, other, category);
      const service = {
        name: "Гелэн маникюр",
        description: "",
        categoryId: ca.id,
        priceMnt: 65000,
        durationMinutes: 60,
        onlineBookable: true,
        active: true,
        branchIds: ["z"],
      };
      const sa = await saveService(db, owner, service),
        sy = await saveService(db, owner, {
          ...service,
          name: "Яармаг үйлчилгээ",
          branchIds: ["y"],
        }),
        sb = await saveService(db, other, {
          ...service,
          categoryId: cb.id,
          branchIds: ["other"],
        });
      const staff = {
        name: "Ану",
        title: "Хумсны мастер",
        phone: "99112233",
        bio: "",
        active: true,
        memberId: null,
        branchIds: ["z", "y"],
        serviceIds: [sa.id],
      };
      const a = await saveStaff(db, owner, staff),
        b = await saveStaff(db, other, {
          ...staff,
          branchIds: ["other"],
          serviceIds: [sb.id],
        });
      const hours = {
        staffId: a.id,
        branchId: "z",
        dayOfWeek: 1,
        startMinute: 600,
        endMinute: 1140,
        active: true,
        breaks: [
          { startMinute: 780, endMinute: 840 },
          { startMinute: 960, endMinute: 975 },
        ],
      };
      const ha = await saveHours(db, owner, hours),
        hb = await saveHours(db, other, {
          ...hours,
          staffId: b.id,
          branchId: "other",
        });
      const off = {
        staffId: a.id,
        branchId: "z",
        startsAt: "2026-10-19T16:00:00Z",
        endsAt: "2026-10-20T16:00:00Z",
        fullDay: true,
        reason: "Хувийн шалтгаан",
      };
      const ta = await saveTimeOff(db, owner, off),
        tb = await saveTimeOff(db, other, {
          ...off,
          staffId: b.id,
          branchId: "other",
        });
      await t.test(
        "staff form saves a weekly shift from branch hours without a title",
        async () => {
          const branch = await db.branch.findUniqueOrThrow({
            where: { id: "z" },
          });
          assert.equal(branch.openMinute, 600);
          assert.equal(branch.closeMinute, 1140);
          const input = {
            name: "Сараа",
            phone: "",
            bio: "",
            active: true,
            memberId: null,
            branchIds: ["z"],
            serviceIds: [],
          };
          const shift = (days: number[]) => [
            { branchId: "z", days, startMinute: 600, endMinute: 1140 },
          ];
          const created = await saveStaff(db, owner, {
            ...input,
            schedule: shift([1, 2, 3, 3]),
          });
          const days = async () =>
            (
              await db.workingHours.findMany({
                where: { staffId: created.id },
                orderBy: { dayOfWeek: "asc" },
              })
            ).map((h) => h.dayOfWeek);
          assert.deepEqual(await days(), [1, 2, 3]);
          await saveStaff(
            db,
            owner,
            { ...input, schedule: shift([2, 6]) },
            created.id,
          );
          assert.deepEqual(await days(), [2, 6]);
          await saveStaff(db, owner, input, created.id);
          assert.deepEqual(await days(), [2, 6]);
          await assert.rejects(
            saveStaff(db, owner, {
              ...input,
              schedule: [{ ...shift([1])[0], branchId: "y" }],
            }),
          );
          await assert.rejects(
            saveStaff(
              db,
              owner,
              {
                ...input,
                branchIds: ["z", "y"],
                schedule: [
                  ...shift([2]),
                  { ...shift([2, 3])[0], branchId: "y", startMinute: 900 },
                ],
              },
              created.id,
            ),
            denied(409),
          );
          assert.deepEqual(await days(), [2, 6]);
          await db.workingHours.deleteMany({ where: { staffId: created.id } });
          await db.staff.delete({ where: { id: created.id } });
        },
      );
      await t.test(
        "categories and service edits cannot cross tenants",
        async () => {
          await assert.rejects(
            saveCategory(db, owner, category, cb.id),
            denied(404),
          );
          await assert.rejects(
            saveService(db, owner, service, sb.id),
            denied(404),
          );
          await assert.rejects(
            saveService(db, owner, { ...service, categoryId: cb.id }),
            denied(400),
          );
          await assert.rejects(
            saveService(db, owner, { ...service, branchIds: ["other"] }),
            denied(403),
          );
          await assert.rejects(
            saveCategory(db, reception, category),
            denied(403),
          );
          assert.equal((await readCatalog(db, other)).services.length, 1);
        },
      );
      await t.test(
        "staff, branch, service and optional member references are tenant scoped",
        async () => {
          await assert.rejects(saveStaff(db, owner, staff, b.id), denied(404));
          await assert.rejects(
            saveStaff(db, owner, { ...staff, branchIds: ["other"] }),
            denied(403),
          );
          await assert.rejects(
            saveStaff(db, owner, { ...staff, serviceIds: [sb.id] }),
            denied(400),
          );
          await assert.rejects(
            saveStaff(db, owner, { ...staff, memberId: "other" }),
            denied(400),
          );
          await assert.rejects(
            saveStaff(db, owner, { ...staff, branchIds: ["y"] }),
            denied(400),
          );
          await assert.rejects(saveStaff(db, manager, staff), denied(403));
          await saveStaff(db, owner, { ...staff, branchIds: ["z"] }, a.id);
          await assert.rejects(
            saveService(db, owner, { ...service, branchIds: ["y"] }, sa.id),
            denied(409),
          );
          await saveStaff(db, owner, staff, a.id);
        },
      );
      await t.test(
        "working hours and breaks cannot be edited through foreign IDs",
        async () => {
          await assert.rejects(saveHours(db, owner, hours, hb.id), denied(404));
          await assert.rejects(
            saveHours(db, owner, { ...hours, staffId: b.id }),
            denied(403),
          );
          await assert.rejects(
            saveHours(db, owner, { ...hours, branchId: "other" }),
            denied(403),
          );
          await assert.rejects(
            removeSchedule(db, owner, "hours", hb.id),
            denied(404),
          );
          assert.equal(
            await db.workingBreak.count({ where: { workingHoursId: hb.id } }),
            2,
          );
        },
      );
      await t.test("time-off cannot cross tenants", async () => {
        await assert.rejects(saveTimeOff(db, owner, off, tb.id), denied(404));
        await assert.rejects(
          saveTimeOff(db, owner, { ...off, staffId: b.id }),
          denied(403),
        );
        await assert.rejects(
          removeSchedule(db, owner, "timeOff", tb.id),
          denied(404),
        );
      });
      await t.test(
        "overlapping shifts across branches, invalid breaks and invalid time off are rejected",
        async () => {
          await assert.rejects(
            saveHours(db, owner, { ...hours, branchId: "y" }),
            denied(409),
          );
          await assert.rejects(
            saveHours(db, owner, { ...hours, endMinute: 500 }),
          );
          await assert.rejects(
            saveHours(db, owner, {
              ...hours,
              breaks: [{ startMinute: 500, endMinute: 650 }],
            }),
          );
          await assert.rejects(
            saveHours(db, owner, {
              ...hours,
              breaks: [
                { startMinute: 700, endMinute: 800 },
                { startMinute: 790, endMinute: 850 },
              ],
            }),
          );
          await assert.rejects(
            saveTimeOff(db, owner, { ...off, endsAt: off.startsAt }),
          );
          await assert.rejects(
            saveTimeOff(db, owner, {
              ...off,
              startsAt: "2026-10-20T00:00:00Z",
            }),
          );
          await assert.rejects(saveTimeOff(db, owner, off), denied(409));
          const adjacent = await saveHours(db, owner, {
            ...hours,
            startMinute: 1140,
            endMinute: 1200,
            breaks: [],
            branchId: "y",
          });
          await removeSchedule(db, owner, "hours", adjacent.id!);
        },
      );
      await t.test(
        "reception sees only assigned resources and no private time-off reason",
        async () => {
          assert.deepEqual(
            (await readCatalog(db, reception)).services.map((s) => s.id),
            [sa.id],
          );
          const result = await readSchedules(db, reception);
          assert.deepEqual(result.staff[0].branchIds, ["z"]);
          assert.equal(result.staff[0].phone, "");
          assert.equal("reason" in result.timeOff[0], false);
          for (const read of [readCatalog, readStaff, readSchedules])
            await assert.rejects(read(db, reception, "y"), denied(403));
          await assert.rejects(
            saveHours(db, reception, hours, ha.id),
            denied(403),
          );
          await assert.rejects(
            saveTimeOff(db, reception, off, ta.id),
            denied(403),
          );
        },
      );
      await t.test(
        "manager accesses two granted branches but revocation is rechecked on write",
        async () => {
          assert.equal(
            (await readCatalog(db, manager, "y")).services[0].id,
            sy.id,
          );
          await saveHours(db, manager, hours, ha.id);
          await db.memberBranch.delete({
            where: {
              memberId_branchId: { memberId: "manager", branchId: "y" },
            },
          });
          await assert.rejects(
            saveHours(db, manager, { ...hours, branchId: "y", dayOfWeek: 2 }),
            denied(403),
          );
          await assert.rejects(
            saveTimeOff(db, manager, { ...off, branchId: "y" }),
            denied(403),
          );
        },
      );
      await t.test(
        "staff sees only own profile with intersection of membership and staff branches",
        async () => {
          assert.equal(
            (await readSchedules(db, await actor("staff"))).staff.length,
            0,
          );
          await saveStaff(db, owner, { ...staff, memberId: "staff" }, a.id);
          const staffActor = await actor("staff");
          assert.equal((await readSchedules(db, staffActor)).staff[0].id, a.id);
          assert.equal(
            (await readSchedules(db, staffActor)).timeOff[0].reason,
            off.reason,
          );
          assert.equal((await readCatalog(db, staffActor)).services.length, 1);
          await db.memberBranch.delete({
            where: { memberId_branchId: { memberId: "staff", branchId: "y" } },
          });
          await assert.rejects(
            readSchedules(db, await actor("staff"), "y"),
            denied(403),
          );
          await assert.rejects(
            saveHours(db, staffActor, hours, ha.id),
            denied(403),
          );
        },
      );
      await t.test(
        "team permission edits cannot cross tenants or remove owner",
        async () => {
          const edit = {
            role: "RECEPTIONIST",
            active: false,
            branchIds: ["z"],
          };
          await assert.rejects(
            updateMember(db, owner, "other", edit),
            denied(404),
          );
          await assert.rejects(
            updateMember(db, owner, "owner", edit),
            denied(409),
          );
          await assert.rejects(
            updateMember(db, reception, "manager", edit),
            denied(403),
          );
          await assert.rejects(
            updateMember(db, owner, "reception", {
              ...edit,
              branchIds: ["other"],
            }),
            denied(403),
          );
          await updateMember(db, owner, "reception", {
            ...edit,
            active: true,
            branchIds: ["z", "y"],
          });
          assert.equal((await actor("reception")).branchIds.length, 2);
        },
      );
      const inviteInput = {
        name: "Сараа",
        email: "invite@example.test",
        role: "RECEPTIONIST",
        branchIds: ["z"],
      };
      const inviteUser = {
        id: userIds.invite,
        email: "invite@example.test",
        emailConfirmed: true,
      };
      await t.test(
        "invitation tokens are hashed, verified-email-bound and single-use",
        async () => {
          const invite = await createInvitation(db, owner, inviteInput);
          const stored = await db.invitation.findUniqueOrThrow({
            where: { id: invite.id },
          });
          assert.equal(stored.tokenHash, tokenHash(invite.token));
          assert.notEqual(stored.tokenHash, invite.token);
          await assert.rejects(
            inspectInvitation(
              db,
              { ...inviteUser, email: "other@example.test" },
              invite.token,
            ),
            denied(403),
          );
          await assert.rejects(
            acceptInvitation(
              db,
              { ...inviteUser, emailConfirmed: false },
              invite.token,
            ),
            denied(403),
          );
          assert.equal(
            (await inspectInvitation(db, inviteUser, invite.token)).role,
            "RECEPTIONIST",
          );
          assert.deepEqual(
            await acceptInvitation(db, inviteUser, invite.token),
            { salonId: "a", role: "RECEPTIONIST" },
          );
          await assert.rejects(
            acceptInvitation(db, inviteUser, invite.token),
            denied(410),
          );
          const member = await db.salonMember.findUniqueOrThrow({
            where: { salonId_userId: { salonId: "a", userId: userIds.invite } },
            include: { branches: true },
          });
          assert.deepEqual(
            member.branches.map((b) => b.branchId),
            ["z"],
          );
        },
      );
      await t.test(
        "expired/cancelled/reissued invitations and cross-tenant assignments fail closed",
        async () => {
          const input = { ...inviteInput, email: "future@example.test" };
          await assert.rejects(
            createInvitation(db, owner, { ...input, branchIds: ["other"] }),
            denied(403),
          );
          await assert.rejects(
            createInvitation(db, reception, input),
            denied(403),
          );
          const first = await createInvitation(db, owner, input),
            second = await createInvitation(db, owner, input);
          const user = { ...inviteUser, email: input.email };
          await assert.rejects(
            acceptInvitation(db, user, first.token),
            denied(410),
          );
          await assert.rejects(
            cancelInvitation(db, other, second.id),
            denied(404),
          );
          await db.invitation.update({
            where: { id: second.id },
            data: { expiresAt: new Date(0) },
          });
          await assert.rejects(
            acceptInvitation(db, user, second.token),
            denied(410),
          );
          const third = await createInvitation(db, owner, input);
          await cancelInvitation(db, owner, third.id);
          await assert.rejects(
            acceptInvitation(db, user, third.token),
            denied(410),
          );
        },
      );
      await t.test(
        "PostgreSQL composite FKs block direct cross-tenant writes for every new relationship",
        async () => {
          const queries = [
            `UPDATE "Service" SET "categoryId"='${cb.id}' WHERE id='${sa.id}'`,
            `INSERT INTO "ServiceBranch" VALUES ('${sa.id}','other','a')`,
            `INSERT INTO "StaffBranch" VALUES ('${a.id}','other','a')`,
            `INSERT INTO "StaffService" VALUES ('${a.id}','${sb.id}','a')`,
            `UPDATE "Staff" SET "memberId"='other' WHERE id='${a.id}'`,
            `UPDATE "WorkingHours" SET "staffId"='${b.id}', "dayOfWeek"=2 WHERE id='${ha.id}'`,
            `UPDATE "WorkingBreak" SET "salonId"='b' WHERE "workingHoursId"='${ha.id}'`,
            `UPDATE "TimeOff" SET "staffId"='${b.id}' WHERE id='${ta.id}'`,
          ];
          for (const sql of queries)
            await assert.rejects(pg.exec(sql), /foreign key|Break must/);
        },
      );
      await t.test(
        "database enforces time ranges, shift overlap and break containment independent of application",
        async () => {
          await assert.rejects(
            pg.exec(
              `UPDATE "WorkingHours" SET "endMinute"=500 WHERE id='${ha.id}'`,
            ),
            /Shift must|check constraint/,
          );
          await assert.rejects(
            pg.exec(
              `INSERT INTO "WorkingHours" VALUES ('overlap','a','${a.id}','y',1,700,900,true)`,
            ),
            /exclusion constraint/,
          );
          await assert.rejects(
            pg.exec(
              `UPDATE "WorkingBreak" SET "startMinute"=100 WHERE "workingHoursId"='${ha.id}'`,
            ),
            /Break must/,
          );
          await assert.rejects(
            pg.exec(
              `UPDATE "TimeOff" SET "endsAt"="startsAt" WHERE id='${ta.id}'`,
            ),
            /check constraint/,
          );
          await assert.rejects(
            pg.exec(`UPDATE "Service" SET "priceMnt"=-1 WHERE id='${sa.id}'`),
            /check constraint/,
          );
        },
      );
      await t.test(
        "Supabase public roles have no access to new private tables",
        async () => {
          for (const role of ["anon", "authenticated"]) {
            await pg.exec(`SET ROLE ${role}`);
            try {
              for (const table of [
                "ServiceCategory",
                "Service",
                "ServiceBranch",
                "Staff",
                "StaffBranch",
                "StaffService",
                "WorkingHours",
                "WorkingBreak",
                "TimeOff",
              ])
                await assert.rejects(
                  pg.exec(`SELECT * FROM "${table}"`),
                  /permission denied/,
                );
            } finally {
              await pg.exec("RESET ROLE");
            }
          }
        },
      );
      await t.test(
        "deactivation preserves history and removes operational availability",
        async () => {
          await saveService(db, owner, { ...service, active: false }, sa.id);
          assert.equal(
            (await readCatalog(db, await actor("staff"))).services.length,
            0,
          );
          await saveStaff(
            db,
            owner,
            { ...staff, active: false, memberId: "staff" },
            a.id,
          );
          assert.equal(
            (await readSchedules(db, await actor("staff"))).staff.length,
            0,
          );
          assert.equal(
            await db.workingHours.count({ where: { staffId: a.id } }),
            1,
          );
          await assert.rejects(saveHours(db, owner, hours, ha.id), denied(403));
          assert.equal(
            (await db.staff.findUniqueOrThrow({ where: { id: a.id } })).active,
            false,
          );
        },
      );
    } finally {
      await fixture.close();
    }
  },
);
