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
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/calendar");
  await page
    .getByRole("button", { name: "Шинэ захиалга", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Шинэ захиалга",
    exact: true,
  });
  await dialog.getByRole("radio", { name: /Гел маникюр/ }).check();
  await dialog
    .getByRole("combobox", { name: "Үндсэн ажилтан", exact: true })
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
  await expect(dialog.locator(".quick-footer")).toContainText(
    "Гел маникюр · 15:00",
  );
  await responsive(page);
  await dialog.getByRole("button", { name: "Захиалах", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Захиалга амжилттай нэмэгдлээ.")).toBeVisible();
  const card = page.locator(".booking-card").filter({ hasText: name });
  await expect(card).toContainText("15:00 — 16:30");
  await card.click();
  const detail = page.getByRole("dialog", { name: "Захиалгын дэлгэрэнгүй" });
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
  await page.getByRole("button", { name: "Зайсан" }).click();
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
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/calendar");
  await page.getByLabel("Өдөр", { exact: true }).fill(date);
  const card = page
    .locator(".booking-card")
    .filter({ hasText: "Онлайн үйлчлүүлэгч" });
  await expect(card).toContainText("14:00 — 15:30");
  await expect(card).toContainText("Хүлээгдэж буй");
});
