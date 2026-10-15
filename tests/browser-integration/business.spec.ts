import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Имэйл хаяг", { exact: true }).fill(email);
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}
// The fixture lists fewer salons than the default threshold (5).
test("with few salons the root shows the business page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("h1")).toContainText("салоноо онлайн болгоё");
  await expect(page.locator(".hp-card")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Бизнесээ бүртгүүлэх/ }).first(),
  ).toHaveAttribute("href", "/sign-up");
});
test("the salon directory stays at /home", async ({ page }, info) => {
  await page.goto("/home");
  await expect(page.locator("h1")).toContainText("хэдхэн товшилтоор");
  const card = page.locator(".hp-card").filter({ hasText: "Туршилтын салон" });
  await expect(card).toContainText("үйлчилгээ");
  await expect(card).toHaveAttribute("href", "/salon-a/book");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/home-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByPlaceholder("Салон эсвэл үйлчилгээ").fill("Өөр салон");
  await page.getByRole("button", { name: "Хайх" }).click();
  await expect(page.locator(".hp-card")).toHaveCount(1);
  await expect(page.locator(".hp-card")).toContainText("Өөр салон");
  await page.goto("/home");
  await page.locator(".hp-card").filter({ hasText: "Туршилтын салон" }).click();
  await expect(page).toHaveURL(/\/salon-a\/book$/);
  await page.goto("/home");
  await page.getByRole("link", { name: "Бизнесээ бүртгүүлэх" }).first().click();
  await expect(page).toHaveURL(/\/business$/);
  await page
    .getByRole("link", { name: /Бизнесээ бүртгүүлэх/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/sign-up$/);
});
test("signed-in owners go to their salon; users without a salon to onboarding", async ({
  page,
}) => {
  await login(page, "owner@example.test");
  await page.goto("/");
  await expect(page.locator(".lp")).toHaveCount(0);
  await page.goto("/business");
  await expect(page.getByRole("link", { name: "Миний салон" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(
    page.getByRole("link", { name: "Нэвтрэх / Бүртгүүлэх" }),
  ).toHaveCount(0);
  await page.context().clearCookies();
  await login(page, "platform@example.test");
  await page.goto("/business");
  await expect(page.getByRole("link", { name: "Миний салон" })).toHaveAttribute(
    "href",
    "/onboarding",
  );
});
test("owners see guest reviews in their own page", async ({ page }) => {
  await login(page, "owner@example.test");
  // The sidebar links here; on phones it sits behind the menu button.
  await expect(page.locator('a[href="/reviews"]').first()).toHaveCount(1);
  await page.goto("/reviews");
  await expect(
    page.getByRole("heading", { name: "Сэтгэгдлүүд.", level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Одоогоор сэтгэгдэл алга")).toBeVisible();
});
