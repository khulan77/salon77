import { test, expect } from "@playwright/test";
import { addDays, localStamp } from "../../lib/business-time";
test("reception marks attendance on the timesheet", async ({ page }, info) => {
  await page.goto("/sign-in");
  await page
    .getByLabel("Имэйл хаяг", { exact: true })
    .fill("reception@example.test");
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const nav = page.getByRole("navigation", { name: "Үндсэн цэс" });
  await expect(nav.getByText("Цагийн бүртгэл")).toHaveCount(1);
  await expect(nav.getByText("Ажлын хуваарь")).toHaveCount(0);
  await page.goto("/timesheet");
  await expect(page.locator("main h1")).toContainText("Цагийн бүртгэл");
  const today = localStamp(new Date()).slice(0, 10);
  // Desktop and mobile use different past days so the runs stay independent.
  const day = addDays(today, info.project.name === "mobile" ? -2 : -1);
  if (day.slice(0, 7) !== today.slice(0, 7))
    await page.getByRole("button", { name: "Өмнөх сар" }).click();
  const cell = page.getByRole("button", { name: new RegExp(`^Ану, ${day}:`) });
  await expect(cell).toHaveAccessibleName(`Ану, ${day}: Тэмдэглээгүй`);
  await cell.click();
  await expect(cell).toHaveAccessibleName(`Ану, ${day}: Ажилласан`);
  await cell.click();
  await expect(cell).toHaveAccessibleName(`Ану, ${day}: Амарсан`);
  const future = page.getByRole("button", {
    name: new RegExp(`^Ану, ${addDays(today, 1)}:`),
  });
  if (await future.count()) {
    await future.click();
    await expect(future).toHaveAccessibleName(new RegExp("Амарсан$"));
    await future.click();
    await expect(future).toHaveAccessibleName(new RegExp("Тэмдэглээгүй$"));
  }
  await page.reload();
  await expect(cell).toHaveAccessibleName(`Ану, ${day}: Амарсан`);
  await expect(page.locator(".timesheet-table tbody tr").first()).toContainText(
    "амралт",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Хүснэгт татах" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  await page.screenshot({
    path: `test-results/timesheet-${info.project.name}.png`,
    fullPage: true,
  });
  await cell.click();
  await expect(cell).toHaveAccessibleName(`Ану, ${day}: Тэмдэглээгүй`);
});
