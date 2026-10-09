import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { addDays, localInstant, localStamp } from "../../lib/business-time";
test("guest moves and cancels a visit from the private link", async ({
  page,
  baseURL,
}, info) => {
  const today = localStamp(new Date()).slice(0, 10);
  const date = addDays(today, info.project.name === "mobile" ? 9 : 8);
  const created = await page.request.post("/api/public/salon-a/visits", {
    headers: { Origin: new URL(baseURL!).origin },
    data: {
      branchId: "z",
      items: [{ serviceId: "book-service-a-60" }],
      startAt: localInstant(`${date}T10:00`).toISOString(),
      customer: { name: "Холбоос Зочин", phone: "80553311" },
      idempotencyKey: randomUUID(),
    },
  });
  expect(created.status()).toBe(201);
  const { manageUrl } = await created.json();
  expect(manageUrl).toMatch(/^\/salon-a\/manage\?token=[A-Za-z0-9_-]{43}$/);
  await page.goto(manageUrl);
  await expect(
    page.getByRole("heading", { name: "Таны захиалга" }),
  ).toBeVisible();
  await expect(page.locator(".pb-ticket")).toContainText("Хумс арчилгаа");
  await page.getByRole("button", { name: "Цаг өөрчлөх" }).click();
  await page.getByRole("button", { name: date, exact: true }).click();
  await page.getByRole("button", { name: "15:00", exact: true }).click();
  await page.getByRole("button", { name: "Энэ цагаар солих" }).click();
  await expect(page.locator(".pb-ok")).toHaveText("Цаг амжилттай өөрчлөгдлөө.");
  await expect(page.locator(".pb-ticket")).toContainText(`${date} 15:00`);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/manage-${info.project.name}.png`,
    fullPage: true,
  });
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Захиалга цуцлах" }).click();
  await expect(page.locator(".pb-ok")).toHaveText("Захиалга цуцлагдлаа.");
  await expect(page.locator(".pb-state")).toHaveText("Цуцлагдсан");
  await expect(page.getByRole("button", { name: "Цаг өөрчлөх" })).toHaveCount(
    0,
  );
  await page.goto("/salon-a/manage?token=wrong");
  await expect(
    page.getByRole("heading", { name: "Захиалга олдсонгүй" }),
  ).toBeVisible();
});
