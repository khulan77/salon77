import { test, expect, type Page } from "@playwright/test";
import { addDays, localStamp } from "../../lib/business-time";
async function responsive(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
test("manual booking, reschedule, completion and customer history", async ({
  page,
}, info) => {
  const date = addDays(
    localStamp(new Date()).slice(0, 10),
    info.project.name === "mobile" ? 12 : 11,
  );
  const name = `Үйлчлүүлэгч ${info.project.name === "mobile" ? "Утас" : "Дэлгэц"}`;
  await page.goto("/sign-in");
  await page
    .getByLabel("Имэйл хаяг", { exact: true })
    .fill("reception@example.test");
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/(calendar|schedules)$/);
  await page.goto("/calendar");
  await page
    .getByRole("button", { name: "Шинэ захиалга", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Шинэ захиалга",
    exact: true,
  });
  await dialog.getByRole("checkbox", { name: /Гел маникюр/ }).check();
  await dialog
    .getByRole("combobox", { name: "Ажилтан", exact: true })
    .selectOption("book-staff-a-1");
  await dialog.getByLabel("Огноо", { exact: true }).fill(date);
  await dialog.getByRole("button", { name: "15:00", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "13:00", exact: true }),
  ).toHaveCount(0);
  await dialog.getByLabel("Нэр", { exact: true }).fill(name);
  await dialog
    .getByLabel("Утас", { exact: true })
    .fill(info.project.name === "mobile" ? "9911 2202" : "9911 2201");
  await dialog
    .getByLabel("Тэмдэглэл", { exact: true })
    .fill("Хувийн захиалгын тэмдэглэл");
  // An extra charge adds to the total; payment method is one tap.
  await dialog.getByRole("button", { name: "Нэмэлт төлбөр" }).click();
  await dialog.getByLabel("Нэмэлт төлбөр", { exact: true }).fill("15000");
  await expect(dialog.locator(".pay-total")).toContainText("80,000₮");
  await dialog
    .getByRole("group", { name: "Төлбөрийн хэрэгсэл" })
    .getByRole("button", { name: "Бэлэн" })
    .click();
  await expect(dialog.locator(".quick-footer")).toContainText(
    "80,000₮ · 15:00 · Гел маникюр",
  );
  await dialog.screenshot({
    path: `test-results/new-booking-${info.project.name}.png`,
  });
  await responsive(page);
  await dialog.getByRole("button", { name: "Захиалах", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Захиалга амжилттай нэмэгдлээ.")).toBeVisible();
  const card = page.locator(".booking-card").filter({ hasText: name });
  await expect(card).toContainText("15:00 — 16:30");
  await expect(card.locator(".grid-booking-price.paid")).toBeVisible();
  // A recorded payment counts as paid, not as remaining.
  await expect(page.locator(".calendar-total")).toContainText(
    "Төлсөн 80,000₮ · Үлдэгдэл 0₮",
  );
  await card.click();
  const detail = page.getByRole("dialog", { name: "Захиалгын дэлгэрэнгүй" });
  await expect(detail).toContainText(name);
  await expect(detail.locator(".pay-total")).toContainText("80,000₮");
  await expect(detail.locator(".pay-state")).toContainText("Төлсөн · Бэлэн");
  await detail
    .getByRole("group", { name: "Төлбөрийн хэрэгсэл" })
    .getByRole("button", { name: "Шилжүүлэг" })
    .click();
  await detail.getByLabel("Нэмэлт төлбөр", { exact: true }).fill("20000");
  await expect(detail.locator(".pay-total")).toContainText("85,000₮");
  if (info.project.name === "desktop")
    await detail.screenshot({ path: "test-results/booking-detail.png" });
  await detail.getByRole("button", { name: "Төлбөр хадгалах" }).click();
  await expect(detail).not.toBeVisible();
  await expect(page.getByText("Төлбөрийг бүртгэлээ.")).toBeVisible();
  await expect(card).toContainText("85,000₮");
  await card.click();
  await expect(detail.locator(".pay-state")).toContainText(
    "Төлсөн · Шилжүүлэг",
  );
  await detail
    .getByRole("button", { name: "Цаг өөрчлөх", exact: true })
    .click();
  await detail.getByRole("button", { name: "10:00", exact: true }).click();
  await detail.getByRole("button", { name: "Шинэ цагийг хадгалах" }).click();
  await expect(detail).not.toBeVisible();
  await expect(card).toContainText("10:00 — 11:30");
  await page
    .getByRole("group", { name: "Харагдац", exact: true })
    .getByRole("button", { name: "7 хоног", exact: true })
    .click();
  await expect(page.locator(".calendar-day")).toHaveCount(7);
  await responsive(page);
  await page.screenshot({
    path: `test-results/bookings-calendar-${info.project.name}.png`,
    fullPage: true,
  });
  await card.click();
  page.once("dialog", (d) => d.accept());
  await detail.getByRole("button", { name: "Дуусгах", exact: true }).click();
  await expect(detail).not.toBeVisible();
  await card.click();
  await detail.getByRole("link", { name: "Үйлчлүүлэгчийн түүх" }).click();
  await expect(page).toHaveURL(/\/customers\?id=/);
  await expect(
    page.getByRole("dialog", { name: "Үйлчлүүлэгчийн дэлгэрэнгүй" }),
  ).toContainText("Дууссан");
  await expect(
    page
      .getByRole("dialog", { name: "Үйлчлүүлэгчийн дэлгэрэнгүй" })
      .getByLabel("Нэр", { exact: true }),
  ).toHaveValue(name);
  await responsive(page);
  await page.screenshot({
    path: `test-results/bookings-customer-${info.project.name}.png`,
    fullPage: true,
  });
});
test("guest any-staff booking and public-safe responses", async ({
  page,
  baseURL,
}, info) => {
  const date = addDays(
    localStamp(new Date()).slice(0, 10),
    info.project.name === "mobile" ? 14 : 13,
  );
  await page.goto("/salon-a/book");
  await expect(
    page.getByRole("heading", { name: "Туршилтын салон", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("group", { name: "Салбар сонгох" })
    .getByRole("button", { name: /Зайсан/ })
    .click();
  await page
    .locator(".pb-service")
    .filter({ hasText: "Гел маникюр" })
    .first()
    .click();
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByRole("button", { name: date, exact: true }).click();
  await page.getByRole("button", { name: "14:00", exact: true }).click();
  await responsive(page);
  await page.screenshot({
    path: `test-results/bookings-public-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByLabel("Нэр", { exact: true }).fill("Онлайн үйлчлүүлэгч");
  await page.getByLabel("Утасны дугаар", { exact: true }).fill("88112233");
  const response = page.waitForResponse(
    (r) =>
      r.url().includes("/api/public/salon-a/visits") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Захиалах", exact: true }).click();
  const res = await response;
  expect(res.status()).toBe(201);
  const receipt = await res.json();
  expect(receipt.items[0].staffName).toBe("Ану");
  expect(receipt.status).toBe("PENDING");
  for (const key of [
    "customerId",
    "phone",
    "notes",
    "salonId",
    "requestHash",
    "idempotencyKey",
    "createdByMemberId",
  ])
    for (const part of [receipt, ...receipt.items])
      expect(part).not.toHaveProperty(key);
  await expect(
    page.getByRole("heading", { name: "Захиалга амжилттай" }),
  ).toBeVisible();
  await responsive(page);
  expect((await page.request.get(`/api/bookings?date=${date}`)).status()).toBe(
    401,
  );
  expect((await page.request.get("/api/customers")).status()).toBe(401);
  expect(
    (
      await page.request.get(
        `/api/public/salon-a/availability?date=${date}&branchId=other&serviceId=book-service-b-90`,
      )
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.post("/api/public/salon-a/bookings", {
        headers: { Origin: "https://attacker.invalid" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(baseURL).toBeTruthy();
  await page.goto("/sign-in");
  await page
    .getByLabel("Имэйл хаяг", { exact: true })
    .fill("owner@example.test");
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/(calendar|schedules)$/);
  await page.goto("/calendar");
  await page
    .locator(".calendar-date-nav")
    .getByLabel("Өдөр", { exact: true })
    .fill(date);
  const card = page
    .locator(".booking-card")
    .filter({ hasText: "Онлайн үйлчлүүлэгч" });
  await expect(card).toContainText("14:00 — 15:30");
  // An empty corner box means not confirmed yet; the price is on the card.
  await expect(card).toContainText("65,000₮");
  await card.getByRole("button", { name: "Баталгаажуулах" }).click();
  await expect(page.getByText("Захиалгыг баталгаажууллаа.")).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Баталгаажсан" }),
  ).toBeVisible();
  // A star keeps the booking with its staff member.
  const star = card.getByRole("button", { name: "Зөвхөн энэ ажилтан" });
  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");
  await card.screenshot({
    path: `test-results/calendar-card-${info.project.name}.png`,
  });
  if (info.project.name !== "desktop") return;
  // Drag the card to the other staff member at the same time.
  // Pin the target column by position: a filtered locator would follow the card.
  const columns = page.locator(".staff-column");
  let target = 0;
  while (
    (await columns
      .nth(target)
      .locator(".booking-card")
      .filter({ hasText: "Онлайн үйлчлүүлэгч" })
      .count()) > 0
  )
    target++;
  const other = columns.nth(target);
  const move = async () => {
    const [from, to] = [await card.boundingBox(), await other.boundingBox()];
    await card.dragTo(other, {
      sourcePosition: { x: 10, y: 4 },
      targetPosition: { x: 20, y: from!.y - to!.y + 4 },
    });
  };
  await move();
  await expect(page.getByText(/зөвхөн .* үйлчлүүлэхийг хүссэн/)).toBeVisible();
  await expect(other).not.toContainText("Онлайн үйлчлүүлэгч");
  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "false");
  page.once("dialog", (dialog) => dialog.accept());
  await move();
  await expect(page.getByText("Захиалгыг шилжүүллээ.")).toBeVisible();
  await expect(
    other.locator(".booking-card", { hasText: "Онлайн үйлчлүүлэгч" }),
  ).toContainText("14:00 — 15:30");
});
test("one customer, two services started together by two staff", async ({
  page,
}, info) => {
  const date = addDays(
    localStamp(new Date()).slice(0, 10),
    info.project.name === "mobile" ? 16 : 15,
  );
  await page.goto("/sign-in");
  await page
    .getByLabel("Имэйл хаяг", { exact: true })
    .fill("reception@example.test");
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/(calendar|schedules)$/);
  await page.goto("/calendar");
  await page
    .getByRole("button", { name: "Шинэ захиалга", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Шинэ захиалга",
    exact: true,
  });
  const name = `Хос ${info.project.name}`;
  await dialog.getByLabel("Нэр", { exact: true }).fill(name);
  await dialog
    .getByLabel("Утас", { exact: true })
    .fill(info.project.name === "mobile" ? "9911 2204" : "9911 2203");
  await dialog.getByRole("checkbox", { name: /Гел маникюр/ }).check();
  await dialog.getByRole("checkbox", { name: /Хумс арчилгаа/ }).check();
  await dialog
    .getByRole("combobox", { name: "Гел маникюр · ажилтан" })
    .selectOption("book-staff-a-1");
  // The first staff member is no longer offered for the second service.
  await expect(
    dialog
      .getByRole("combobox", { name: "Хумс арчилгаа · ажилтан" })
      .locator('option[value="book-staff-a-1"]'),
  ).toHaveCount(0);
  await dialog.getByLabel("Огноо", { exact: true }).fill(date);
  await expect(dialog.locator(".quick-section-head small")).toContainText(
    "Хоёр үйлчилгээ зэрэг эхэлнэ",
  );
  await dialog.getByRole("button", { name: "11:00", exact: true }).click();
  await expect(dialog.locator(".pay-total")).toContainText("130,000₮");
  await expect(dialog.locator(".quick-footer")).toContainText(
    "130,000₮ · 11:00 · Гел маникюр + Хумс арчилгаа",
  );
  await dialog.getByRole("button", { name: "Захиалах", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .locator(".calendar-date-nav")
    .getByLabel("Өдөр", { exact: true })
    .fill(date);
  const cards = page.locator(".booking-card").filter({ hasText: name });
  await expect(cards).toHaveCount(2);
  await expect(cards.filter({ hasText: "Гел маникюр" })).toContainText("11:00");
  await expect(cards.filter({ hasText: "Хумс арчилгаа" })).toContainText(
    "11:00",
  );
  // One customer's two services read as one visit: same colour, linked.
  const tones = await cards.evaluateAll((els) =>
    els.map((el) => [...el.classList].find((c) => c.startsWith("tone-"))),
  );
  expect(new Set(tones).size).toBe(1);
  await expect(cards.getByLabel("Хамт захиалсан үйлчилгээ")).toHaveCount(2);
  // Another customer's booking of the same service gets its own colour.
  await page
    .getByRole("button", { name: "Шинэ захиалга", exact: true })
    .click();
  const other = `Ганц ${info.project.name}`;
  await dialog.getByLabel("Нэр", { exact: true }).fill(other);
  await dialog
    .getByLabel("Утас", { exact: true })
    .fill(info.project.name === "mobile" ? "9911 2206" : "9911 2205");
  await dialog.getByRole("checkbox", { name: /Гел маникюр/ }).check();
  await dialog
    .getByRole("combobox", { name: "Ажилтан", exact: true })
    .selectOption("book-staff-a-1");
  await dialog.getByLabel("Огноо", { exact: true }).fill(date);
  await dialog.getByRole("button", { name: "14:00", exact: true }).click();
  await dialog.getByRole("button", { name: "Захиалах", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page
    .locator(".calendar-date-nav")
    .getByLabel("Өдөр", { exact: true })
    .fill(date);
  const single = page.locator(".booking-card").filter({ hasText: other });
  await expect(single).toHaveCount(1);
  const own = await single.evaluate((el) =>
    [...el.classList].find((c) => c.startsWith("tone-")),
  );
  expect(own).not.toBe(tones[0]);
  // No payment yet: the amount is marked unpaid.
  await expect(single.locator(".grid-booking-price.unpaid")).toBeVisible();
  // A cancelled booking leaves the grid but stays listed with who cancelled.
  await single.click();
  const detail = page.getByRole("dialog", { name: "Захиалгын дэлгэрэнгүй" });
  page.once("dialog", (d) => d.accept());
  await detail.getByRole("button", { name: "Цуцлах", exact: true }).click();
  await expect(detail).not.toBeVisible();
  await expect(single).toHaveCount(0);
  await page.locator(".stat-link").click();
  const list = page.getByRole("dialog", { name: "Цуцлагдсан захиалгууд" });
  await expect(list).toContainText(other);
  await expect(list).toContainText("Цуцалсан:");
  await list.getByRole("button", { name: new RegExp(other) }).click();
  await expect(detail.locator(".detail-cancelled")).toContainText("Цуцалсан:");
  if (info.project.name === "desktop")
    await detail.screenshot({ path: "test-results/booking-cancelled.png" });
  await detail.getByRole("button", { name: "Хаах" }).click();
  if (info.project.name === "desktop")
    await page.locator(".day-grid-panel").screenshot({
      path: "test-results/calendar-two-services.png",
    });
});
test("customers are listed newest first with visits, spend and delete", async ({
  page,
}, info) => {
  await page.goto("/sign-in");
  await page
    .getByLabel("Имэйл хаяг", { exact: true })
    .fill("owner@example.test");
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/(calendar|schedules)$/);
  await page.goto("/customers");
  const rows = page.locator(".customer-list li");
  await expect(rows.first()).toBeVisible();
  await expect(page.locator(".customer-count")).toContainText("бүртгэлтэй");
  await expect(rows.first()).toContainText("удаа");
  await responsive(page);
  if (info.project.name === "desktop")
    await page.locator(".customer-list").screenshot({
      path: "test-results/customers-list.png",
    });
  // Someone with an upcoming booking cannot be deleted.
  const upcoming = rows.filter({ hasText: "Онлайн үйлчлүүлэгч" }).first();
  page.once("dialog", (d) => d.accept());
  await upcoming.getByRole("button", { name: /устгах/ }).click();
  await expect(page.getByText(/Ирэх захиалгатай үйлчлүүлэгчийг/)).toBeVisible();
});
