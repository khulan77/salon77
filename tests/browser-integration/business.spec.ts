import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Имэйл хаяг", { exact: true }).fill(email);
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}
// Without DIRECTORY_MIN_SALONS the root opens straight on the directory.
test("the root shows the salon directory", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("h1")).toContainText("хэдхэн товшилтоор");
  await expect(
    page.locator(".hx-card").filter({ hasText: "Туршилтын салон" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Бизнесээ бүртгүүлэх/ }).first(),
  ).toHaveAttribute("href", "/business");
});
test("the salon directory stays at /home", async ({ page }, info) => {
  await page.goto("/home");
  await expect(page.locator("h1")).toContainText("хэдхэн товшилтоор");
  const card = page.locator(".hx-card").filter({ hasText: "Туршилтын салон" });
  await expect(
    card.getByRole("link", { name: /Цаг захиалах/ }),
  ).toHaveAttribute("href", "/salon-a/book");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/home-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByPlaceholder("Хумс, үс засалт, салоны нэр…").fill("Өөр салон");
  await page.getByRole("button", { name: "Хайх", exact: true }).click();
  await expect(page.locator(".hx-card")).toHaveCount(1);
  await expect(page.locator(".hx-card")).toContainText("Өөр салон");
  await page.goto("/home");
  await page
    .locator(".hx-card")
    .filter({ hasText: "Туршилтын салон" })
    .getByRole("link", { name: /Цаг захиалах/ })
    .click();
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
    page.locator("header").getByRole("link", { name: "Нэвтрэх", exact: true }),
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
