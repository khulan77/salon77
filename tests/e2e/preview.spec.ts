import { expect, test } from "@playwright/test";
test("the admin home is the calendar, with first steps for a new salon", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByText("Танилцах горим", { exact: true })).toHaveCount(
    1,
  );
  const steps = page.getByRole("region", {
    name: "Салоноо захиалга авахад бэлдэе",
  });
  await expect(steps).toContainText("4 алхмаас 0 нь бэлэн");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/home-calendar-${info.project.name}.png`,
    fullPage: true,
  });
  await steps.getByRole("link", { name: /Салбар/ }).click();
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
  await page.getByPlaceholder("Хуудасны нэрээр хайх…").fill("Календарь");
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Календарь", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Шинэ захиалга", exact: true }),
  ).toBeVisible();
});
test("preview onboarding validates and does not pretend to save", async ({
  page,
}) => {
  await page.goto("/onboarding");
  // The first step lists what to prepare and why salons are verified.
  await expect(
    page.getByRole("heading", { name: "Бүртгүүлэхэд бэлдэх зүйлс" }),
  ).toBeVisible();
  await expect(page.getByText("24 цагийн дотор")).toBeVisible();
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
  // One step for the address; a single-location salon has no branch name
  // or second phone to fill.
  await expect(page.getByText("2 / 3")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Салбарын нэр" }),
  ).not.toBeVisible();
  await expect(page.getByRole("textbox", { name: /утас/i })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Дүүрэг" }).selectOption("Хан-Уул");
  await page.getByRole("textbox", { name: "Байршлын хаяг" }).fill("Street 1");
  await page.getByRole("button", { name: "Олон салбартай" }).click();
  await expect(page.getByRole("textbox", { name: "Салбарын нэр" })).toHaveValue(
    "Үндсэн салбар",
  );
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await expect(
    page.getByRole("heading", { name: "Салоноо баталгаажуулахад туслаарай." }),
  ).toBeVisible();
  // A social page and at least one service type are required to apply.
  await page.getByRole("spinbutton", { name: "Ажилтны тоо" }).fill("3");
  await page.getByRole("button", { name: "Хүсэлт илгээх" }).click();
  await expect(page.locator(".error-message")).toContainText(
    "Инстаграм эсвэл Фэйсбүүк",
  );
  await page.getByRole("textbox", { name: "Инстаграм хаяг" }).fill("@salon77");
  await page.getByRole("button", { name: "Хүсэлт илгээх" }).click();
  await expect(page.locator(".error-message")).toContainText(
    "Үйлчилгээний төрлөөс",
  );
  await page.getByRole("checkbox", { name: "Хумс" }).check();
  await page.getByRole("button", { name: "Хүсэлт илгээх" }).click();
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
  await page.getByRole("button", { name: "Ресепшн урих" }).click();
  await expect(
    page.getByText(
      "Танилцах горимд урилга үүсгэх боломжгүй. Эхлээд салоноо бүртгэнэ үү.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Урилга үүсгэх" }),
  ).toBeDisabled();
});
