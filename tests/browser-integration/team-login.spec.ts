import { test, expect } from "@playwright/test";
test("settings tabs show team access and the most recent sign-in", async ({
  page,
}, info) => {
  await page.goto("/sign-in");
  await page
    .getByLabel("Имэйл хаяг", { exact: true })
    .fill("owner@example.test");
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const nav = page.getByRole("navigation", { name: "Үндсэн цэс" });
  await expect(nav.getByText("Баг ба эрхийн тохиргоо")).toHaveCount(0);
  await page.goto("/settings");
  const tabs = page.getByRole("navigation", { name: "Тохиргооны хэсгүүд" });
  await tabs.getByRole("link", { name: "Баг ба эрх" }).click();
  await expect(page).toHaveURL(/\/team$/);
  await expect(tabs.getByRole("link", { name: "Баг ба эрх" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const latest = page.getByRole("region", { name: "Сүүлд нэвтэрсэн" });
  await expect(latest).toContainText("Хамгийн сүүлд нэвтэрсэн");
  await expect(latest).toContainText("Эзэмшигч");
  await expect(latest).toContainText("дөнгөж сая");
  await expect(page.locator("table").first()).toContainText("Сүүлд нэвтэрсэн");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/team-${info.project.name}.png`,
    fullPage: true,
  });
});
