import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Имэйл хаяг", { exact: true }).fill(email);
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}
test("a salon sends a request and reads the operator's answer", async ({
  page,
}, info) => {
  const project = info.project.name;
  const message = `Тайлан хуудас удаан ачаалж байна (${project === "mobile" ? "гар утас" : "компьютер"}).`;
  const reply = `Хурдыг сайжрууллаа (${project === "mobile" ? "гар утас" : "компьютер"}).`;
  await login(page, "owner@example.test");
  await page.goto("/support");
  await expect(
    page.getByRole("heading", { name: "Санал хүсэлт", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Санал", exact: true }).click();
  await page.getByRole("textbox", { name: "Хүсэлт" }).fill(message);
  await page.getByRole("button", { name: "Илгээх" }).click();
  await expect(page.getByRole("status")).toContainText("хүлээн авлаа");
  const mine = page.locator(".support-list li").filter({ hasText: message });
  await expect(mine).toContainText("Хүлээгдэж байна");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/feedback-salon-${project}.png`,
    fullPage: true,
  });
  await login(page, "platform@example.test");
  await page.goto("/platform/feedback");
  const item = page.locator(".pf-feedback").filter({ hasText: message });
  await expect(item).toContainText("Туршилтын салон");
  await expect(item).toContainText("owner@example.test");
  await item.getByRole("textbox", { name: "Хариу" }).fill(reply);
  await page.screenshot({
    path: `test-results/feedback-platform-${project}.png`,
    fullPage: true,
  });
  await item
    .getByRole("button", { name: "Шийдвэрлэсэн гэж тэмдэглэх" })
    .click();
  await expect(item.locator(".pf-badge.ok")).toBeVisible();
  await login(page, "owner@example.test");
  await page.goto("/support");
  await expect(mine).toContainText("Шийдвэрлэсэн");
  await expect(mine).toContainText(reply);
  // Another salon never sees it.
  await login(page, "other@example.test");
  await page.goto("/support");
  await expect(page.getByText(message)).toHaveCount(0);
  const denied = await page.request.patch("/api/platform/feedback?id=x", {
    headers: { Origin: new URL(page.url()).origin },
    data: { status: "DONE" },
  });
  expect(denied.status()).toBe(404);
});
