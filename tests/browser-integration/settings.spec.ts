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
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/settings");
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
  // Restore defaults so later suites keep their expectations.
  await page.getByRole("checkbox", { name: "Урьдчилгаа авах" }).uncheck();
  await page.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await expect(page.locator(".settings-save")).toContainText(
    "Тохиргоог хадгаллаа.",
  );
});
