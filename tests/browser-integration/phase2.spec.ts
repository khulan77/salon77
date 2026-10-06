import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, email: string) {
  await page.getByLabel("Имэйл хаяг", { exact: true }).fill(email);
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}
async function responsive(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function save(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
test("owner setup, schedules, invitation acceptance and reception scope work end to end", async ({
  page,
  browser,
  baseURL,
}, info) => {
  const mobile = info.project.name === "mobile",
    suffix = mobile ? "Утас" : "Дэлгэц",
    category = `Хумс ${suffix}`,
    service = `Гелэн маникюр ${suffix}`,
    staff = `Ану ${suffix}`;
  await page.goto("/sign-in");
  await login(page, "owner@example.test");
  await page.goto("/services");
  await page
    .getByRole("button", { name: "Ангилал нэмэх", exact: true })
    .click();
  await page.getByLabel("Ангиллын нэр", { exact: true }).fill(category);
  await save(page);
  await expect(
    page.getByRole("button", { name: category, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Үйлчилгээ нэмэх", exact: true })
    .first()
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Үйлчилгээний нэр", { exact: true }).fill(service);
  await dialog
    .getByRole("combobox", { name: "Ангилал", exact: true })
    .selectOption({ label: category });
  await dialog.getByLabel("Үнэ · ₮", { exact: true }).fill("65000");
  await dialog.getByLabel("Хугацаа · минут", { exact: true }).fill("60");
  await dialog.getByLabel("Зайсан", { exact: true }).check();
  await dialog.getByLabel("Яармаг", { exact: true }).check();
  await dialog
    .getByLabel("Онлайнаар захиалахыг зөвшөөрөх", { exact: true })
    .check();
  await responsive(page);
  await save(page);
  await expect(
    page.getByRole("heading", { name: service, exact: true }),
  ).toBeVisible();
  await responsive(page);
  await page.screenshot({
    path: `test-results/phase2-services-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/employees");
  await page
    .getByRole("button", { name: "Ажилтан нэмэх", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Нэр", { exact: true }).fill(staff);
  await dialog
    .getByLabel("Албан тушаал", { exact: true })
    .fill("Хумсны мастер");
  await dialog.getByLabel("Утас", { exact: true }).fill("99112233");
  await dialog.getByLabel("Зайсан", { exact: true }).check();
  await dialog.getByLabel("Яармаг", { exact: true }).check();
  await dialog.getByLabel(service, { exact: true }).check();
  await responsive(page);
  await save(page);
  await expect(
    page.getByRole("heading", { name: staff, exact: true }),
  ).toBeVisible();
  await responsive(page);
  await page.screenshot({
    path: `test-results/phase2-staff-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: staff, exact: true }) })
    .getByRole("link", { name: "Ажлын хуваарь" })
    .click();
  await page
    .getByRole("button", { name: "Ажлын цаг нэмэх", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Салбар", exact: true })
    .selectOption("z");
  await dialog
    .getByRole("combobox", { name: "Гараг", exact: true })
    .selectOption("1");
  await dialog.getByLabel("Эхлэх цаг", { exact: true }).fill("10:00");
  await dialog.getByLabel("Дуусах цаг", { exact: true }).fill("19:00");
  await dialog.getByRole("button", { name: "Завсарлага нэмэх" }).click();
  await responsive(page);
  await save(page);
  await expect(
    page.getByText("Завсарлага: 13:00 — 14:00", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Даваа хуваарь засах" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Завсарлага нэмэх" }).click();
  await dialog.getByLabel("Эхлэх цаг", { exact: true }).nth(2).fill("16:00");
  await dialog.getByLabel("Дуусах цаг", { exact: true }).nth(2).fill("16:15");
  await save(page);
  await expect(
    page.getByText("Завсарлага: 16:00 — 16:15", { exact: true }),
  ).toBeVisible();
  // A shift and break ending at midnight must round-trip through native time inputs.
  await page
    .getByRole("button", { name: "Ажлын цаг нэмэх", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Салбар", exact: true })
    .selectOption("y");
  await dialog
    .getByRole("combobox", { name: "Гараг", exact: true })
    .selectOption("2");
  await dialog.getByLabel("Эхлэх цаг", { exact: true }).fill("23:00");
  await dialog.getByLabel("Дуусах цаг", { exact: true }).fill("00:00");
  await dialog.getByRole("button", { name: "Завсарлага нэмэх" }).click();
  await dialog.getByLabel("Эхлэх цаг", { exact: true }).nth(1).fill("23:30");
  await dialog.getByLabel("Дуусах цаг", { exact: true }).nth(1).fill("00:00");
  await save(page);
  await expect(
    page.getByText("Завсарлага: 23:30 — 24:00", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Мягмар хуваарь засах" }).click();
  dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Дуусах цаг", { exact: true }).nth(0),
  ).toHaveValue("00:00");
  await expect(
    dialog.getByLabel("Дуусах цаг", { exact: true }).nth(1),
  ).toHaveValue("00:00");
  await dialog.getByRole("button", { name: "Цуцлах", exact: true }).click();
  await page
    .getByRole("button", { name: "Чөлөө нэмэх", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("combobox", { name: "Салбар", exact: true })
    .selectOption("z");
  await dialog.getByLabel("Эхлэх өдөр", { exact: true }).fill("2026-10-20");
  await dialog.getByLabel("Дуусах өдөр", { exact: true }).fill("2026-10-20");
  await dialog
    .getByLabel("Шалтгаан · заавал биш", { exact: true })
    .fill("Хувийн шалтгаан");
  await save(page);
  await expect(
    page.getByText("Хувийн шалтгаан", { exact: true }),
  ).toBeVisible();
  await responsive(page);
  await page.screenshot({
    path: `test-results/phase2-schedules-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/team");
  await page.getByRole("button", { name: "Гишүүн урих", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Нэр", { exact: true }).fill(`Сараа ${suffix}`);
  const email = mobile ? "invite-mobile@example.test" : "invite@example.test";
  await dialog.getByLabel("Имэйл", { exact: true }).fill(email);
  await dialog
    .getByRole("combobox", { name: "Эрх", exact: true })
    .selectOption("RECEPTIONIST");
  await dialog.getByLabel("Зайсан", { exact: true }).check();
  await dialog.getByRole("button", { name: "Урилга үүсгэх" }).click();
  await expect(dialog).not.toBeVisible();
  const invitePath = await page
    .getByLabel("Урилгын холбоос", { exact: true })
    .inputValue();
  expect(invitePath).toContain("/invite?token=");
  await responsive(page);
  const context = await browser.newContext({
    baseURL,
    viewport: mobile
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 },
  });
  const reception = await context.newPage();
  await reception.goto(invitePath);
  await expect(reception).toHaveURL(/\/sign-in\?next=/);
  await login(reception, email);
  await expect(
    reception.getByRole("heading", { name: "Багт нэгдэх урилга" }),
  ).toBeVisible();
  await reception.getByRole("button", { name: "Урилга хүлээн авах" }).click();
  await expect(reception).toHaveURL(`${baseURL}/`);
  expect(
    (await context.cookies()).find((c) => c.name === "salon77-tenant")?.value,
  ).toBe("a");
  await reception.goto("/services");
  await expect(
    reception.getByRole("heading", { name: service, exact: true }),
  ).toBeVisible();
  await expect(
    reception.getByText("Хаалттай үйлчилгээ", { exact: true }),
  ).toHaveCount(0);
  await expect(
    reception.getByRole("button", { name: "Үйлчилгээ нэмэх", exact: true }),
  ).toHaveCount(0);
  const services = await (await reception.request.get("/api/services")).json();
  for (const row of services.services) expect(row.branchIds).toEqual(["z"]);
  for (const route of [
    "branches",
    "services",
    "staff",
    "working-hours",
    "time-off",
  ])
    expect(
      (await reception.request.get(`/api/${route}?branchId=y`)).status(),
    ).toBe(403);
  const schedules = await (
    await reception.request.get("/api/working-hours")
  ).json();
  expect(
    schedules.timeOff.some((t: Record<string, unknown>) => "reason" in t),
  ).toBe(false);
  expect(
    schedules.hours.every((h: { branchId: string }) => h.branchId === "z"),
  ).toBe(true);
  expect(
    (
      await reception.request.post("/api/categories", {
        headers: { Origin: baseURL! },
        data: { name: "Хак", sortOrder: 0, active: true },
      })
    ).status(),
  ).toBe(403);
  await reception.goto("/schedules");
  await expect(
    reception.getByText("Хувийн шалтгаан", { exact: true }),
  ).toHaveCount(0);
  await responsive(reception);
  await reception.goto(invitePath);
  await expect(
    reception.getByRole("alert").filter({ hasText: "хүчингүй" }),
  ).toContainText("хүчингүй");
  await context.close();
});

test("HTTP authorization rejects cross-tenant resource IDs and cross-origin writes", async ({
  page,
  baseURL,
}) => {
  await page.goto("/sign-in");
  await login(page, "owner@example.test");
  const headers = { Origin: baseURL! };
  const input = {
    staffId: "staff-b",
    branchId: "other",
    dayOfWeek: 2,
    startMinute: 600,
    endMinute: 1000,
    active: true,
    breaks: [],
  };
  for (const [url, data] of [
    [
      "/api/categories?id=category-b",
      { name: "Өөрчлөх", sortOrder: 0, active: true },
    ],
    [
      "/api/services?id=service-b",
      {
        name: "Өөрчлөх",
        description: "",
        categoryId: "category-a",
        priceMnt: 1,
        durationMinutes: 30,
        active: true,
        onlineBookable: false,
        branchIds: ["z"],
      },
    ],
    [
      "/api/staff?id=staff-b",
      {
        name: "Өөрчлөх",
        title: "Мастер",
        phone: "",
        bio: "",
        active: true,
        memberId: null,
        branchIds: ["z"],
        serviceIds: [],
      },
    ],
    ["/api/working-hours?id=hours-b", input],
    [
      "/api/time-off?id=off-b",
      {
        staffId: "staff-a",
        branchId: "y",
        startsAt: "2026-11-01T00:00:00Z",
        endsAt: "2026-11-01T01:00:00Z",
        fullDay: false,
        reason: "",
      },
    ],
    [
      "/api/members?id=other",
      { role: "MANAGER", active: true, branchIds: ["z"] },
    ],
  ] as const) {
    const res = await page.request.patch(url, { headers, data });
    expect(res.status(), `${url}: ${await res.text()}`).toBe(404);
  }
  expect(
    (
      await page.request.post("/api/working-hours", { headers, data: input })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/categories", {
        headers: { Origin: "https://attacker.invalid" },
        data: { name: "Хак", sortOrder: 0, active: true },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.patch("/api/members?id=owner", {
        headers,
        data: { role: "STAFF", active: false, branchIds: ["z"] },
      })
    ).status(),
  ).toBe(409);
});

test("manager reads both assigned branches while staff without a linked profile sees no schedule", async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto("/sign-in");
  await login(page, "manager@example.test");
  for (const id of ["z", "y"])
    expect(
      (await page.request.get(`/api/working-hours?branchId=${id}`)).status(),
    ).toBe(200);
  const response = await page.request.get("/api/working-hours?branchId=y");
  expect((await response.json()).timeOff[0].reason).toBe("Нууц шалтгаан");
  const context = await browser.newContext({ baseURL });
  const staff = await context.newPage();
  await staff.goto("/sign-in");
  await login(staff, "staff@example.test");
  const data = await (await staff.request.get("/api/working-hours")).json();
  expect(data.staff).toEqual([]);
  expect(data.hours).toEqual([]);
  expect(
    (await staff.request.get("/api/working-hours?branchId=z")).status(),
  ).toBe(403);
  await context.close();
});
