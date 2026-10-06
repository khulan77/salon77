import { test, expect } from "@playwright/test";
test("configured signup and login forms are enabled without creating accounts", async ({
  page,
}) => {
  await page.goto("/sign-up");
  await expect(page.locator("html")).toHaveAttribute("lang", "mn");
  await expect(
    page.getByText(
      "Нэвтрэхийн тулд системийн холболтыг тохируулах шаардлагатай.",
      { exact: false },
    ),
  ).toHaveCount(0);
  await page.getByLabel("Таны нэр", { exact: true }).fill("Тохиргооны шалгалт");
  await page
    .getByLabel("Имэйл хаяг", { exact: true })
    .fill("configuration-check@example.invalid");
  await page.getByLabel("Нууц үг", { exact: true }).fill("LocalFormCheck123!");
  await expect(
    page.getByRole("button", { name: "Бүртгүүлэх", exact: true }),
  ).toBeEnabled();
  expect(
    await page
      .locator("form")
      .evaluate((form: HTMLFormElement) => form.checkValidity()),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // Submitting a valid signup requires the developer's chosen email address.
  await page.goto("/sign-in");
  await expect(
    page.getByRole("button", { name: "Нэвтрэх", exact: true }),
  ).toBeEnabled();
});
