import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { addDays, localInstant, localStamp } from "../../lib/business-time";
test("settings preview and deposit instructions for guests", async ({
  page,
  baseURL,
}, info) => {
  await page.goto("/sign-in");
  await page
    .getByLabel("Имэйл хаяг", { exact: true })
    .fill("owner@example.test");
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/(calendar|schedules)$/);
  await page.goto("/settings");
  // The shareable link opens this salon's own booking page.
  const share = page.getByRole("textbox", { name: "Захиалгын линк" });
  await expect(share).toHaveValue(/^https?:\/\/[^/]+\/salon-a\/book$/);
  await expect(page.getByRole("button", { name: "Хуулах" })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Захиалгын линкийн QR код" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "QR татах" })).toBeEnabled();
  await expect(page.getByRole("region", { name: "Салоны лого" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Лого оруулах" }),
  ).toBeVisible();
  // Instagram goes onto the booking page as a real profile link.
  const social = page.getByRole("region", { name: "Инстаграм, Фэйсбүүк" });
  await social.getByLabel("Инстаграм", { exact: true }).fill("@test.salon");
  await social.getByRole("button", { name: "Хаяг хадгалах" }).click();
  await expect(social).toContainText("Хадгаллаа.");
  const preview = page.getByRole("complementary", {
    name: "Үйлчлүүлэгчид харагдах байдал",
  });
  await expect(preview).toContainText("Туршилтын салон");
  await expect(preview).toContainText("Цаг сонгох");
  await page.getByRole("checkbox", { name: "Урьдчилгаа авах" }).check();
  await page.getByLabel("Банк", { exact: true }).fill("Хаан банк");
  await page.getByLabel("Дансны дугаар", { exact: true }).fill("5000123456");
  await page
    .getByLabel("Данс эзэмшигч", { exact: true })
    .fill("Туршилтын салон ХХК");
  await expect(preview).toContainText("Урьдчилгаа 30%");
  await expect(preview).toContainText("Хаан банк");
  await page.getByRole("checkbox", { name: "Онлайн захиалга авах" }).uncheck();
  await expect(preview).toContainText(
    "Онлайн захиалга одоогоор хаалттай байна.",
  );
  await page.getByRole("checkbox", { name: "Онлайн захиалга авах" }).check();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/settings-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await expect(page.locator(".settings-save")).toContainText(
    "Тохиргоог хадгаллаа.",
  );
  // A guest booking now returns transfer instructions.
  const day = addDays(
    localStamp(new Date()).slice(0, 10),
    info.project.name === "mobile" ? 52 : 50,
  );
  const created = await page.request.post("/api/public/salon-a/bookings", {
    headers: { Origin: new URL(baseURL!).origin },
    data: {
      branchId: "z",
      serviceId: "book-service-a-60",
      startAt: localInstant(`${day}T10:00`).toISOString(),
      customer: { name: "Урьдчилгаа Зочин", phone: "88990011" },
      idempotencyKey: randomUUID(),
    },
  });
  expect(created.status()).toBe(201);
  const receipt = await created.json();
  expect(receipt.status).toBe("PENDING");
  expect(receipt.deposit).toMatchObject({
    amountMnt: 19500,
    bankName: "Хаан банк",
    reference: "88990011",
  });
  // The guest sees the account and reference, each with a copy button.
  const guestDay = addDays(
    localStamp(new Date()).slice(0, 10),
    info.project.name === "mobile" ? 28 : 27,
  );
  const guest = await page.context().newPage();
  await guest.goto("/salon-a/book");
  await expect(guest.getByRole("link", { name: "Инстаграм" })).toHaveAttribute(
    "href",
    "https://instagram.com/test.salon",
  );
  await expect(guest.getByRole("link", { name: "Чиглэл" })).toHaveAttribute(
    "href",
    /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/,
  );
  await guest.getByRole("button", { name: "Зайсан" }).click();
  await guest
    .locator(".pb-service")
    .filter({ hasText: "Хумс арчилгаа" })
    .first()
    .click();
  await guest.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await guest.getByRole("button", { name: guestDay, exact: true }).click();
  await guest.getByRole("button", { name: "11:00", exact: true }).click();
  await guest.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await guest.getByLabel("Нэр", { exact: true }).fill("Хуулах Зочин");
  await guest
    .getByLabel("Утасны дугаар", { exact: true })
    .fill(info.project.name === "mobile" ? "88990013" : "88990012");
  await guest.getByRole("button", { name: "Захиалах", exact: true }).click();
  const box = guest.locator(".deposit-instructions");
  await expect(box).toContainText("5000123456");
  await expect(
    box.getByRole("button", { name: "Дансны дугаар хуулах" }),
  ).toBeVisible();
  await expect(
    box.getByRole("button", { name: "Гүйлгээний утга хуулах" }),
  ).toBeVisible();
  await box.screenshot({
    path: `test-results/deposit-copy-${info.project.name}.png`,
  });
  // The guest can check whether the salon has confirmed it yet.
  const check = guest.getByRole("button", {
    name: "Баталгаажсан эсэхийг шалгах",
  });
  await check.click();
  await expect(guest.locator(".pb-status")).toContainText(
    "Хараахан баталгаажаагүй",
  );
  const listed = await (
    await page.request.get(`/api/bookings?date=${guestDay}`)
  ).json();
  const pendingVisit = listed.find(
    (b: { customerName: string }) => b.customerName === "Хуулах Зочин",
  );
  const confirm = await page.request.patch(
    `/api/bookings?id=${pendingVisit.id}`,
    {
      headers: { Origin: new URL(baseURL!).origin },
      data: {
        action: "status",
        status: "CONFIRMED",
        version: pendingVisit.version,
      },
    },
  );
  expect(confirm.status()).toBe(200);
  await check.click();
  await expect(guest.locator(".pb-status")).toContainText("Баталгаажсан.");
  await guest.close();
  // Restore defaults so later suites keep their expectations.
  await page.getByRole("checkbox", { name: "Урьдчилгаа авах" }).uncheck();
  await page.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await expect(page.locator(".settings-save")).toContainText(
    "Тохиргоог хадгаллаа.",
  );
});
