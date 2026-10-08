import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { addDays, localInstant, localStamp } from "../../lib/business-time";
test("owner revenue report shows completed bookings by day, service and staff", async ({
  page,
  baseURL,
}, info) => {
  // Separate future days per project keep both runs independent.
  const offset = info.project.name === "mobile" ? 40 : 30;
  const today = localStamp(new Date()).slice(0, 10),
    from = addDays(today, offset),
    to = addDays(today, offset + 6);
  await page.goto("/sign-in");
  await page
    .getByLabel("Имэйл хаяг", { exact: true })
    .fill("owner@example.test");
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const headers = { Origin: new URL(baseURL!).origin };
  for (const [day, time, service, staff] of [
    [0, "10:00", "book-service-a-90", "book-staff-a-1"],
    [0, "10:00", "book-service-a-60", "book-staff-a-2"],
    [2, "15:00", "book-service-a-90", "book-staff-a-1"],
  ] as const) {
    const created = await page.request.post("/api/bookings", {
      headers,
      data: {
        branchId: "z",
        serviceId: service,
        staffId: staff,
        startAt: localInstant(`${addDays(from, day)}T${time}`).toISOString(),
        customer: { name: "Тайлан Үйлчлүүлэгч", phone: "88001122" },
        idempotencyKey: randomUUID(),
      },
    });
    expect(created.status()).toBe(201);
    const booking = await created.json();
    const done = await page.request.patch(`/api/bookings?id=${booking.id}`, {
      headers,
      data: { action: "status", status: "COMPLETED", version: booking.version },
    });
    expect(done.status()).toBe(200);
  }
  await page.goto(`/reports?from=${from}&to=${to}`);
  await expect(page.locator("main h1")).toContainText("Тайлан");
  await expect(page.locator(".report-hero strong")).toHaveText("195,000₮");
  await expect(page.locator(".chart-column")).toHaveCount(7);
  const services = page.locator(".breakdown-list li");
  await expect(services).toHaveCount(2);
  await expect(services.first()).toContainText("Гел маникюр");
  await expect(services.first()).toContainText("2 удаа");
  await page.getByRole("button", { name: "Ажилтнаар" }).click();
  await expect(services.first()).toContainText("Ану");
  await expect(services.first()).toContainText("130,000₮");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.locator(".chart-column").first().hover();
  await expect(page.locator(".chart-tooltip")).toContainText("130,000₮");
  await page.screenshot({
    path: `test-results/reports-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Өнөөдөр" }).click();
  await expect(page).toHaveURL(new RegExp(`from=${today}&to=${today}`));
  await page.goto("/");
  await expect(page.locator(".insight-revenue")).toBeVisible();
  await page.screenshot({
    path: `test-results/dashboard-revenue-${info.project.name}.png`,
    fullPage: true,
  });
});
test("reception cannot open the revenue report", async ({ page }) => {
  await page.goto("/sign-in");
  await page
    .getByLabel("Имэйл хаяг", { exact: true })
    .fill("reception@example.test");
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("navigation", { name: "Үндсэн цэс" }).getByText("Тайлан"),
  ).toHaveCount(0);
  await page.goto("/reports");
  await expect(page.locator("main h1")).toHaveText("Хандах эрхгүй");
});
