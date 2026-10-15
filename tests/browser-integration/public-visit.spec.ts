import { test, expect, type Page } from "@playwright/test";
import { addDays, localStamp } from "../../lib/business-time";
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
test("guest books two services done in parallel by two staff", async ({
  page,
}, info) => {
  const date = addDays(
    localStamp(new Date()).slice(0, 10),
    info.project.name === "mobile" ? 22 : 21,
  );
  await page.goto("/salon-a/book");
  await expect(page.locator("h1")).toHaveText("Туршилтын салон");
  await page.getByRole("button", { name: "Зайсан" }).click();
  const services = page.locator(".pb-service");
  await services.filter({ hasText: "Гел маникюр" }).first().click();
  await services.filter({ hasText: "Хумс арчилгаа" }).first().click();
  await expect(page.locator(".pb-bar")).toContainText("130,000₮");
  await expect(page.locator(".pb-bar")).toContainText("2 үйлчилгээ");
  await fits(page);
  await page.screenshot({
    path: `test-results/public-menu-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  // Picking the same person for both services is blocked.
  const first = page.getByRole("group", { name: "Гел маникюр ажилтан" });
  const second = page.getByRole("group", { name: "Хумс арчилгаа ажилтан" });
  // Each button reads "<name> <title>", e.g. "Ану Мастер".
  await first.getByRole("button", { name: /^Ану(\s|$)/ }).click();
  await second.getByRole("button", { name: /^Ану(\s|$)/ }).click();
  await expect(page.locator(".pb-error")).toContainText("өөр өөр ажилтан");
  await second.getByRole("button", { name: "Аль ч ажилтан" }).click();
  await page.getByRole("button", { name: date, exact: true }).click();
  await page.getByRole("button", { name: "11:00", exact: true }).click();
  await fits(page);
  await page.screenshot({
    path: `test-results/public-time-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByLabel("Нэр", { exact: true }).fill("Зэрэг үйлчлүүлэгч");
  await page.getByLabel("Утасны дугаар", { exact: true }).fill("80112233");
  const response = page.waitForResponse(
    (r) => r.url().includes("/visits") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Захиалах", exact: true }).click();
  const receipt = await (await response).json();
  expect(receipt.items.map((i: { staffName: string }) => i.staffName)).toEqual([
    "Ану",
    "Болор",
  ]);
  await expect(
    page.getByRole("heading", { name: "Захиалга амжилттай" }),
  ).toBeVisible();
  await expect(page.locator(".pb-ticket")).toContainText("130,000₮");
  await fits(page);
  await page.screenshot({
    path: `test-results/public-done-${info.project.name}.png`,
    fullPage: true,
  });
});
test("guests meet the masters before booking", async ({ page }, info) => {
  await page.goto("/salon-a/book");
  const masters = page.getByRole("region", { name: "Манай мастерууд" });
  await expect(masters).toContainText("Ану");
  await masters
    .getByRole("button", { name: /^Ану(\s|$)/ })
    .first()
    .click();
  const profile = page.getByRole("dialog", { name: "Ану" });
  await expect(profile).toContainText("Хийдэг үйлчилгээ");
  await expect(profile).toContainText("Гел маникюр");
  await page.screenshot({
    path: `test-results/masters-${info.project.name}.png`,
  });
  await profile.getByRole("button", { name: "Хаах" }).click();
  await expect(profile).toHaveCount(0);
});
test("booking pages describe the salon to search and link previews", async ({
  page,
}) => {
  await page.goto("/salon-a/book");
  await expect(page).toHaveTitle("Туршилтын салон · Цаг захиалах · Salon77");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Туршилтын салон · Цаг захиалах",
  );
  await expect(
    page.locator('meta[name="robots"][content*="noindex"]'),
  ).toHaveCount(0);
  const data = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ??
      "{}",
  );
  expect(data["@type"]).toBe("BeautySalon");
  expect(data.name).toBe("Туршилтын салон");
  // A missing salon answers 404, which search engines never index.
  const missing = await page.goto("/no-such-salon/book");
  expect(missing?.status()).toBe(404);
});
