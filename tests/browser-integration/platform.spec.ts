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
  // The platform operator lands on the console straight after signing in.
  await expect(page).toHaveURL(/\/platform$/);
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
  await expect(
    page.getByRole("button", { name: "Идэвхгүй болгох" }),
  ).toBeVisible();
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
test("an unpaid salon is closed and reopened from the salon list", async ({
  page,
}) => {
  await login(page, "platform@example.test");
  await page.goto("/platform");
  const row = page.locator(".pf-table tr").filter({ hasText: "Өөр салон" });
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Идэвхгүй болгох" }).click();
  await expect(row.getByRole("button", { name: "Идэвхжүүлэх" })).toBeVisible();
  await expect(row).toContainText("Хаасан");
  // The owner of the closed salon only sees why it is closed.
  await page.context().clearCookies();
  await login(page, "other@example.test");
  await page.goto("/");
  await expect(page).toHaveURL(/\/suspended$/);
  await expect(page.locator("h1")).toContainText("түр хаагдсан");
  await expect(page.getByText("Сарын төлбөр төлөгдөөгүй")).toBeVisible();
  expect((await page.request.get("/api/services")).status()).toBe(403);
  // Reopening restores access.
  await page.context().clearCookies();
  await login(page, "platform@example.test");
  await page.goto("/platform");
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Идэвхжүүлэх" }).click();
  await expect(
    row.getByRole("button", { name: "Идэвхгүй болгох" }),
  ).toBeVisible();
  await page.context().clearCookies();
  await login(page, "other@example.test");
  await page.goto("/");
  await expect(page).toHaveURL(/\/calendar$/);
});
test("the operator sets the monthly price per branch", async ({
  page,
}, info) => {
  await login(page, "platform@example.test");
  // The price lives on the platform settings page.
  await page.goto("/platform/settings");
  const panel = page.locator(".pf-price-panel");
  if (await panel.getByRole("button", { name: "Өөрчлөх" }).isVisible())
    await panel.getByRole("button", { name: "Өөрчлөх" }).click();
  await panel.getByRole("spinbutton").fill("149000");
  await panel.screenshot({
    path: `test-results/platform-price-form-${info.project.name}.png`,
  });
  await panel.getByRole("button", { name: "Хадгалах" }).click();
  await expect(panel).toContainText("149,000₮");
  await page.goto("/platform");
  await expect(page.locator(".pf-focus")).toContainText("Энэ сарын төлбөр");
  await page.locator(".pf-filters").screenshot({
    path: `test-results/platform-filters-${info.project.name}.png`,
  });
  await page.screenshot({
    path: `test-results/platform-billing-${info.project.name}.png`,
    fullPage: true,
  });
});
