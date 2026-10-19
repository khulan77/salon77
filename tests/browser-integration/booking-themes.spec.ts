import { test, expect } from "@playwright/test";
test("owner chooses a theme, public booking inherits it, admin stays unchanged", async ({
  page,
}) => {
  await page.goto("/sign-in");
  await page
    .getByLabel("Имэйл хаяг", { exact: true })
    .fill("owner@example.test");
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/(calendar|schedules)$/);
  await page.goto("/settings?tab=page");
  const choices = page.getByRole("radiogroup", { name: "Өнгөний загвар" });
  await expect(choices.getByRole("radio")).toHaveCount(5);
  await choices.getByRole("radio", { name: "Нил ягаан", exact: true }).check();
  await page.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await expect(page.locator(".settings-save")).toContainText(
    "Тохиргоог хадгаллаа.",
  );
  await page.reload();
  await expect(
    choices.getByRole("radio", { name: "Нил ягаан", exact: true }),
  ).toBeChecked();
  await expect(page.locator("[data-booking-theme]")).toHaveCount(0);
  await page.goto("/salon-a/book");
  await expect(page.locator("main")).toHaveAttribute(
    "data-booking-theme",
    "VIOLET",
  );
  await expect(page.locator("main")).toHaveCSS(
    "background-color",
    "rgb(246, 245, 252)",
  );
  await page.goto("/settings?tab=page");
  await choices.getByRole("radio", { name: "Хар алтлаг", exact: true }).check();
  await page.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await expect(page.locator(".settings-save")).toContainText(
    "Тохиргоог хадгаллаа.",
  );
});
