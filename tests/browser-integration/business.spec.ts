import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Имэйл хаяг", { exact: true }).fill(email);
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}
test("signed-out visitors see the business page at the root", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("h1")).toContainText("салоноо онлайн болгоё");
  await page
    .getByRole("link", { name: /Үнэгүй эхлэх/ })
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
  const enter = page.getByRole("link", { name: /Удирдлага руу орох/ }).first();
  await expect(enter).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: "Нэвтрэх" })).toHaveCount(0);
  await page.context().clearCookies();
  await login(page, "platform@example.test");
  await page.goto("/business");
  await expect(
    page.getByRole("link", { name: /Удирдлага руу орох/ }).first(),
  ).toHaveAttribute("href", "/onboarding");
});
