import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Имэйл хаяг", { exact: true }).fill(email);
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}
test("the platform operator sees every salon; salon owners cannot", async ({
  page,
}, info) => {
  await login(page, "platform@example.test");
  await page.goto("/platform");
  await expect(
    page.getByRole("heading", { name: "Платформын тойм" }),
  ).toBeVisible();
  const table = page.locator(".pf-table");
  await expect(table).toContainText("Туршилтын салон");
  await expect(table).toContainText("Өөр салон");
  await expect(table).toContainText("owner@example.test");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/platform-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Туршилтын салон" }).click();
  await expect(
    page.getByRole("heading", { name: "Туршилтын салон" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Түр зогсоох" })).toBeVisible();
  await page.screenshot({
    path: `test-results/platform-salon-${info.project.name}.png`,
    fullPage: true,
  });
  await page.context().clearCookies();
  await login(page, "owner@example.test");
  const denied = await page.goto("/platform");
  expect(denied?.status()).toBe(404);
  await expect(page.locator(".pf")).toHaveCount(0);
  const api = await page.request.patch("/api/platform/salons?id=a", {
    headers: { Origin: new URL(page.url()).origin },
    data: { status: "SUSPENDED" },
  });
  expect(api.status()).toBe(404);
});
