// Local test-only auth fixture. Production authentication has no bypass.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { testDatabase, seed, userIds } from "./database";
import { bookingSeed } from "./bookings";
async function main() {
  const fixture = await testDatabase(55479);
  await seed(fixture.db);
  await bookingSeed(fixture.db);
  const mobileId = "00000000-0000-0000-0000-000000000007";
  await fixture.db.user.create({
    data: { id: mobileId, email: "invite-mobile@example.test", name: "Сараа" },
  });
  // Platform operator with no salon membership (test fixture only).
  const platformId = "00000000-0000-0000-0000-000000000008";
  await fixture.db.user.create({
    data: {
      id: platformId,
      email: "platform@example.test",
      name: "Платформ",
      isSuperAdmin: true,
    },
  });
  for (const [salonId, branchId] of [
    ["a", "y"],
    ["b", "other"],
  ]) {
    await fixture.db.serviceCategory.create({
      data: { id: `category-${salonId}`, salonId, name: "Суурь ангилал" },
    });
    await fixture.db.service.create({
      data: {
        id: `service-${salonId}`,
        salonId,
        categoryId: `category-${salonId}`,
        name: "Хаалттай үйлчилгээ",
        priceMnt: 50000,
        durationMinutes: 60,
        branches: { create: { branchId } },
      },
    });
    await fixture.db.staff.create({
      data: {
        id: `staff-${salonId}`,
        salonId,
        name: "Хуваарьтай ажилтан",
        title: "Мастер",
        branches: { create: { branchId } },
        services: { create: { serviceId: `service-${salonId}` } },
      },
    });
    await fixture.db.workingHours.create({
      data: {
        id: `hours-${salonId}`,
        salonId,
        staffId: `staff-${salonId}`,
        branchId,
        dayOfWeek: 1,
        startMinute: 600,
        endMinute: 1140,
      },
    });
    await fixture.db.timeOff.create({
      data: {
        id: `off-${salonId}`,
        salonId,
        staffId: `staff-${salonId}`,
        branchId,
        startsAt: new Date("2026-10-19T16:00:00Z"),
        endsAt: new Date("2026-10-20T16:00:00Z"),
        fullDay: true,
        reason: "Нууц шалтгаан",
      },
    });
  }
  const identities = [
    ...Object.entries(userIds).map(([name, id]) => ({
      id,
      email: `${name}@example.test`,
    })),
    { id: mobileId, email: "invite-mobile@example.test" },
    { id: platformId, email: "platform@example.test" },
  ];
  const users = new Map(
    identities.map(({ id, email }) => [
      email,
      {
        id,
        email,
        aud: "authenticated",
        role: "authenticated",
        email_confirmed_at: "2026-01-01T00:00:00Z",
        confirmed_at: "2026-01-01T00:00:00Z",
        created_at: "2026-01-01T00:00:00Z",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: { name: "Туршилтын хэрэглэгч" },
        identities: [],
      },
    ]),
  );
  const sessions = new Map<string, ReturnType<typeof users.get>>();
  const auth = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    const path = new URL(req.url!, "http://127.0.0.1").pathname;
    if (path === "/auth/v1/token") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const input = JSON.parse(raw),
        user = users.get(input.email);
      if (!user || input.password !== "TestPassword123!") {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            error: "invalid_grant",
            error_description: "Invalid credentials",
          }),
        );
        return;
      }
      const encode = (v: unknown) =>
        Buffer.from(JSON.stringify(v)).toString("base64url");
      const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, email: user.email, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000) })}.local-test-signature`;
      sessions.set(token, user);
      res.end(
        JSON.stringify({
          access_token: token,
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: `refresh-${user.id}`,
          user,
        }),
      );
      return;
    }
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    if (path === "/auth/v1/user" && token && sessions.has(token)) {
      res.end(JSON.stringify(sessions.get(token)));
      return;
    }
    if (path === "/auth/v1/logout") {
      if (token) sessions.delete(token);
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(401);
    res.end(JSON.stringify({ message: "Invalid token" }));
  });
  await new Promise<void>((resolve) =>
    auth.listen(55480, "127.0.0.1", resolve),
  );
  await fixture.db.$disconnect();
  await fixture.pg.exec("DEALLOCATE ALL");
  const port = process.env.PHASE2_PORT ?? "32178";
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      port,
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        SALON77_INTEGRATION_TEST: "1",
        DATABASE_URL: fixture.url,
        DIRECT_URL: fixture.url,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55480",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_test_key",
        ALLOW_DEVELOPMENT_INVITE_LINKS: "true",
      },
    },
  );
  let closing = false;
  async function close() {
    if (closing) return;
    closing = true;
    child.kill("SIGTERM");
    auth.close();
    await fixture.close();
    process.exit(0);
  }
  process.on("SIGTERM", close);
  process.on("SIGINT", close);
  child.on("exit", close);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
