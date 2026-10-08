import { test, expect } from "@playwright/test";
test("owner sets a service discount and guests see the sale price", async ({
  page,
}, info) => {
  await page.goto("/sign-in");
  await page
    .getByLabel("Имэйл хаяг", { exact: true })
    .fill("owner@example.test");
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/services");
  const row = page
    .locator(".service-row")
    .filter({ has: page.getByRole("heading", { name: "Хумс арчилгаа" }) });
  await row.getByRole("button", { name: "Хумс арчилгаа засах" }).click();
  const editor = page.getByRole("region", { name: "Үйлчилгээ засах" });
  await editor.getByRole("checkbox", { name: "Хямдралтай болгох" }).check();
  await editor.getByRole("button", { name: "20%", exact: true }).click();
  await expect(editor.locator(".discount-preview")).toContainText("52,000₮");
  await editor.getByLabel("Хямдралын хувь").fill("10");
  await expect(editor.locator(".discount-preview")).toContainText("58,500₮");
  await page.screenshot({
    path: `test-results/discount-editor-${info.project.name}.png`,
    fullPage: true,
  });
  await editor.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(row).toContainText("−10%");
  await expect(row.locator(".price-was")).toHaveText("65,000₮");
  await expect(row.locator(".sale-text")).toHaveText("58,500₮");
  await expect(page.locator(".page-heading")).toContainText("1 нь хямдралтай");
  await page.screenshot({
    path: `test-results/discount-list-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/salon-a/book");
  await expect(page.locator("main")).toContainText("58,500₮");
  // Restore the fixture price so later suites keep their expectations.
  await page.goto("/services");
  await row.getByRole("button", { name: "Хумс арчилгаа засах" }).click();
  await editor.getByRole("checkbox", { name: "Хямдралтай болгох" }).uncheck();
  await editor.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await expect(editor).not.toBeVisible();
  await expect(row).not.toContainText("−10%");
});
