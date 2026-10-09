import { test, expect } from "@playwright/test";
test("business page explains the product and leads to sign-up", async ({
  page,
}, info) => {
  await page.goto("/business");
  await expect(page.locator("h1")).toContainText("салоноо онлайн болгоё");
  for (const heading of [
    "Онлайн захиалгын систем",
    "Салоны бүрэн удирдлага",
    "Баг ба эрх",
    "Найдвартай, аюулгүй",
  ])
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  await expect(page.getByText("salon77.mn/таны-салон/book")).toBeVisible();
  const start = page.getByRole("link", { name: /Үнэгүй эхлэх/ });
  await expect(start.first()).toHaveAttribute("href", "/sign-up");
  await expect(page.getByRole("link", { name: "Нэвтрэх" })).toHaveAttribute(
    "href",
    "/sign-in",
  );
  // FAQ opens without JavaScript-only widgets.
  await page.getByText("Бүртгүүлэхэд төлбөртэй юу?").click();
  await expect(
    page.getByText("Бүртгүүлэх, ашиглаж эхлэх нь үнэгүй."),
  ).toBeVisible();
  // No invented contacts: the block is hidden until real values exist.
  await expect(page.getByRole("heading", { name: "Холбоо барих" })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/business-${info.project.name}.png`,
    fullPage: true,
  });
});
