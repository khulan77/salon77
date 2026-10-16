import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Имэйл хаяг", { exact: true }).fill(email);
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
}
test("a new salon applies, is sent back, corrects itself and is approved", async ({
  page,
}, info) => {
  const project = info.project.name;
  const applicant = `applicant-${project}@example.test`;
  const name = `Шинэ салон ${project === "mobile" ? "хоёр" : "нэг"}`;
  const slug = `shine-salon-${project}`;
  const shot = (step: string) =>
    page.screenshot({
      path: `test-results/application-${step}-${project}.png`,
      fullPage: true,
    });
  await login(page, applicant);
  await page.goto("/onboarding");
  await page
    .getByRole("textbox", { name: "Салоны нэр", exact: true })
    .fill(name);
  await page
    .getByRole("textbox", { name: "Утасны дугаар", exact: true })
    .fill("88001122");
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByRole("textbox", { name: "Салоны цахим хаяг" }).fill(slug);
  await page
    .getByRole("combobox", { name: "Дүүрэг" })
    .selectOption("Сүхбаатар");
  await page
    .getByRole("textbox", { name: "Байршлын хаяг" })
    .fill("Энхтайвны өргөн чөлөө 1");
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page
    .getByRole("textbox", { name: "Инстаграм хаяг" })
    .fill("@shine.salon");
  await page.getByRole("checkbox", { name: "Хумс" }).check();
  await page.getByRole("checkbox", { name: "Сормуус" }).check();
  await page.getByRole("spinbutton", { name: "Ажилтны тоо" }).fill("5");
  await shot("form");
  await page.getByRole("button", { name: "Хүсэлт илгээх" }).click();
  await expect(
    page.getByRole("heading", { name: "Таны хүсэлтийг хүлээн авлаа." }),
  ).toBeVisible();
  // Until approval every admin page leads to the application status.
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding\/review$/);
  const state = page.locator(".review-state");
  await expect(state).toContainText("Хүсэлт хянагдаж байна");
  await page.goto("/services");
  await expect(page).toHaveURL(/\/onboarding\/review$/);
  const blocked = await page.request.get("/api/services");
  expect(blocked.status()).toBe(403);
  await expect(page.getByRole("button", { name: "Гарах" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await shot("pending");
  // The owner may preview the page; the public still gets 404.
  await page.context().clearCookies();
  const closed = await page.goto(`/${slug}/book`);
  expect(closed?.status()).toBe(404);
  // The operator sees the request and sends it back with a reason.
  await login(page, "platform@example.test");
  await page.goto("/platform");
  const row = page.locator(".pf-queue li").filter({ hasText: name });
  await expect(row).toContainText("Хумс, Сормуус · 5 ажилтан");
  await expect(row.getByRole("link", { name: "Инстаграм ↗" })).toHaveAttribute(
    "href",
    "https://instagram.com/shine.salon",
  );
  await shot("queue");
  await row.getByRole("link", { name: "Шалгах" }).click();
  await expect(
    page.getByRole("heading", { name: "Баталгаажуулалт" }),
  ).toBeVisible();
  await shot("detail");
  await page.getByRole("button", { name: "Буцаах", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Буцаах шалтгаан" })
    .fill("Инстаграм хуудас олдсонгүй.");
  await page.getByRole("button", { name: "Шалтгаантай буцаах" }).click();
  await expect(page.locator(".pf-facts")).toContainText(
    "Инстаграм хуудас олдсонгүй.",
  );
  // The owner reads the reason, fixes the details and sends them again.
  await login(page, applicant);
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding\/review$/);
  await expect(page.locator(".review-note")).toContainText(
    "Инстаграм хуудас олдсонгүй.",
  );
  await shot("rejected");
  await page
    .getByRole("textbox", { name: "Инстаграм хаяг" })
    .fill("@shine.salon.ub");
  await page.getByRole("button", { name: "Дахин илгээх" }).click();
  await expect(state).toContainText("Хүсэлт хянагдаж байна");
  // Approval opens the admin area and the public side.
  await login(page, "platform@example.test");
  await page.goto("/platform");
  const again = page.locator(".pf-queue li").filter({ hasText: name });
  await expect(again).toContainText("Дахин илгээсэн");
  await again.getByRole("link", { name: "Шалгах" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Баталгаажуулах" }).click();
  await expect(
    page.getByRole("button", { name: "Баталгаажуулах" }),
  ).toHaveCount(0);
  await login(page, applicant);
  await page.goto("/");
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.locator("main h1").first()).toBeVisible();
  await expect(page.locator(".billing-banner")).toContainText(
    "Үнэгүй хугацаа: 14 хоног үлдлээ.",
  );
  expect((await page.request.get("/api/services")).status()).toBe(200);
  const open = await page.goto(`/${slug}/book`);
  expect(open?.status()).toBe(200);
  // The trial runs from approval; the billing page says where to pay.
  await page.goto("/billing");
  await expect(page.locator(".billing-status")).toContainText(
    "Үнэгүй хугацаа: 14 хоног үлдлээ",
  );
  const bank = page.locator(".billing-bank");
  await expect(bank).toContainText("Голомт банк");
  await expect(bank).toContainText("3665164068");
  await expect(bank).toContainText(slug);
  await shot("billing");
});
test("salon owners cannot approve themselves", async ({ page }) => {
  await login(page, "owner@example.test");
  const api = await page.request.patch("/api/platform/salons?id=a", {
    headers: { Origin: new URL(page.url()).origin },
    data: { decision: "APPROVE" },
  });
  expect(api.status()).toBe(404);
});
