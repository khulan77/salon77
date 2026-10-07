import { expect, test } from "@playwright/test";
test("dashboard is honest, responsive, and links to working branch form", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Өнөөдрийг бүтээлчээр эхэлье." }),
  ).toBeVisible();
  await expect(page.getByText("Танилцах горим", { exact: true })).toHaveCount(
    1,
  );
  await expect(page.getByText("Өнөөдрийн захиалга алга.")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/dashboard-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Эхний салбараа нэмэх" }).click();
  await page.getByRole("button", { name: "Эхний салбараа нэмэх" }).click();
  await expect(
    page.getByRole("heading", { name: "Шинэ салбар нэмэх" }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Салбарын нэр" }).fill("Zaisan");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Бүртгүүлэх", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Цуцлах", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Шинэ салбар нэмэх" }),
  ).not.toBeVisible();
});
test("search navigates to the booking calendar", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Хуудас хайх" }).click();
  await page.getByPlaceholder("Хуудасны нэрээр хайх…").fill("Календар");
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Календар", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Шинэ захиалга", exact: true }),
  ).toBeVisible();
});
test("preview onboarding validates and does not pretend to save", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await page
    .getByRole("textbox", { name: "Салоны нэр", exact: true })
    .fill("Cloud Nail");
  await page
    .getByRole("textbox", { name: "Утасны дугаар", exact: true })
    .fill("99112233");
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await expect(
    page.getByRole("textbox", { name: "Салоны цахим хаяг" }),
  ).toHaveValue("cloud-nail");
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByRole("textbox", { name: "Салбарын нэр" }).fill("Main branch");
  await page.getByRole("textbox", { name: "Дүүрэг" }).fill("Khan-Uul");
  await page.getByRole("textbox", { name: "Хаяг" }).fill("Street 1");
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByRole("button", { name: "Алгасаж, салон үүсгэх" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Салоноо үүсгэхийн тулд бүртгүүлж" }),
  ).toContainText("Салоноо үүсгэхийн тулд бүртгүүлж");
});
test("preview APIs reject writes and external origins", async ({
  request,
  baseURL,
}) => {
  const response = await request.post("/api/branches", {
    headers: { Origin: baseURL! },
    data: { salonId: "victim" },
  });
  expect(response.status()).toBe(503);
  const crossOrigin = await request.post("/api/branches", {
    headers: { Origin: "https://attacker.invalid" },
    data: {},
  });
  expect(crossOrigin.status()).toBe(403);
  expect((await request.get("/api/branches")).status()).toBe(503);
  expect(
    (await request.delete("/api/branches?id=another-salon")).status(),
  ).toBe(405);
});
test("preview invitations do not pretend to send email", async ({ page }) => {
  await page.goto("/team");
  await page.getByRole("button", { name: "Гишүүн урих" }).click();
  await expect(
    page.getByText(
      "Танилцах горимд урилга үүсгэх боломжгүй. Эхлээд салоноо бүртгэнэ үү.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Урилга үүсгэх" }),
  ).toBeDisabled();
});
