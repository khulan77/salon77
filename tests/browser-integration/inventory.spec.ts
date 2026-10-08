import { test, expect } from "@playwright/test";
test("owner registers a product and adjusts branch stock", async ({
  page,
}, info) => {
  const name = `Гель лак ${info.project.name === "mobile" ? "Утас" : "Дэлгэц"}`;
  await page.goto("/sign-in");
  await page
    .getByLabel("Имэйл хаяг", { exact: true })
    .fill("owner@example.test");
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/inventory");
  await expect(
    page.getByRole("heading", { name: "Бараа бүртгэл.", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Бараа нэмэх" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Бараа нэмэх" });
  await dialog.getByLabel("Барааны нэр", { exact: true }).fill(name);
  await dialog.getByLabel("Ангилал", { exact: true }).fill("Хумс");
  await dialog.getByLabel("Өртөг үнэ · ₮", { exact: true }).fill("18000");
  await dialog.getByLabel("Зарах үнэ · ₮", { exact: true }).fill("35000");
  await dialog
    .getByRole("combobox", { name: "Хэмжих нэгж", exact: true })
    .selectOption("шил");
  await dialog.getByLabel("Доод үлдэгдэл", { exact: true }).fill("3");
  await dialog.getByLabel("Зайсан", { exact: true }).fill("4");
  await dialog.getByLabel("Яармаг", { exact: true }).fill("1");
  await dialog.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const row = page.getByRole("article", { name });
  await expect(row).toContainText("35,000₮");
  await expect(row).toContainText("5 шил");
  await page.getByRole("tab", { name: "Зайсан" }).click();
  await expect(row).toContainText("4 шил");
  await row.getByRole("button", { name: `${name} · 1 хасах` }).click();
  await expect(row).toContainText("3 шил");
  await expect(row.locator("b.low")).toBeVisible();
  await row.getByRole("button", { name: `${name} · 1 нэмэх` }).click();
  await expect(row).toContainText("4 шил");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/inventory-${info.project.name}.png`,
    fullPage: true,
  });
});
