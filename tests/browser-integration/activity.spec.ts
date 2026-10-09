import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { addDays, localInstant, localStamp } from "../../lib/business-time";
test("the bell shows new online bookings and clears when opened", async ({
  page,
  baseURL,
}, info) => {
  const date = addDays(
    localStamp(new Date()).slice(0, 10),
    info.project.name === "mobile" ? 26 : 25,
  );
  const guest = info.project.name === "mobile" ? "Хонх Утас" : "Хонх Дэлгэц";
  const made = await page.request.post("/api/public/salon-a/visits", {
    headers: { Origin: new URL(baseURL!).origin },
    data: {
      branchId: "z",
      items: [{ serviceId: "book-service-a-60" }],
      startAt: localInstant(`${date}T11:00`).toISOString(),
      customer: {
        name: guest,
        phone: info.project.name === "mobile" ? "80660001" : "80660002",
      },
      idempotencyKey: randomUUID(),
    },
  });
  expect(made.status()).toBe(201);
  await page.goto("/sign-in");
  await page
    .getByLabel("Имэйл хаяг", { exact: true })
    .fill("owner@example.test");
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const bell = page.getByRole("button", { name: /^Мэдэгдэл, \d+ шинэ$/ });
  await expect(bell).toBeVisible();
  await bell.click();
  const panel = page.getByRole("region", { name: "Мэдэгдлүүд" });
  await expect(panel).toContainText("Шинэ онлайн захиалга");
  await expect(panel).toContainText(guest);
  await expect(panel.locator(".bell-pending")).toContainText(
    "баталгаажуулахыг хүлээж байна",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({ path: `test-results/bell-${info.project.name}.png` });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Мэдэгдэл", exact: true }),
  ).toBeVisible();
});
