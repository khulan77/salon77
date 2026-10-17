import { test, expect } from "@playwright/test";
test("business page explains the product and leads to sign-up", async ({
  page,
}, info) => {
  await page.goto("/business");
  await expect(page.locator("h1")).toContainText("салоноо онлайн болгоё");
  // One short page: pains, the product on one screen, the booking link,
  // price, preparation, questions.
  for (const heading of [
    "Орлого, захиалга, ажилтнаа тоогоор хараарай",
    "Нэг линкээр 24/7 цаг захиалга авна",
    "Ил тод, уян хатан нөхцөл",
  ])
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  // The pains come first, each with how the product handles it.
  await expect(page.getByText("ТАНД ТАНИЛ УУ?")).toBeVisible();
  for (const pain of [
    "Инстаграм, утасны мессежинд хариулж амжихгүй",
    "Давхар захиалга, дэвтэрт бичсэн хуваарь",
    "Ирээгүй үйлчлүүлэгч",
    "Сарын орлогоо мэдэхгүй",
  ])
    await expect(page.getByRole("heading", { name: pain })).toBeVisible();
  await expect(page.locator(".lp-fix")).toHaveCount(4);
  await expect(
    page.getByRole("heading", { name: "Бизнес туршилт" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Бүртгүүлэхэд бэлдэх зүйлс" }),
  ).toBeVisible();
  await expect(
    page.getByText("Яагаад бид шалгаж баталгаажуулдаг вэ?"),
  ).toBeVisible();
  await expect(page.getByText("salon77.mn/tanii-salon/book")).toBeVisible();
  const start = page.getByRole("link", { name: /Бизнесээ бүртгүүлэх/ });
  // Hero, pricing, final call to action and the shared footer.
  await expect(start).toHaveCount(4);
  await expect(start.first()).toHaveAttribute("href", "/sign-up");
  await expect(
    page.locator("header").getByRole("link", { name: "Нэвтрэх", exact: true }),
  ).toHaveAttribute("href", "/sign-in");
  // FAQ opens without JavaScript-only widgets.
  await page.getByText("Төлбөр хэд вэ?").click();
  await expect(
    page.getByText(/14 хоног бүх боломж бүрэн үнэгүй/),
  ).toBeVisible();
  // Only real contacts are shown: the phone is set, Instagram is not yet.
  await expect(
    page.getByRole("heading", { name: "Холбоо барих" }),
  ).toBeVisible();
  // The checklist and the footer both show the phone; check the footer one.
  await expect(
    page.locator("footer").getByRole("link", { name: "8556 3793" }),
  ).toHaveAttribute("href", "tel:85563793");
  await expect(page.locator('a[href^="https://instagram.com"]')).toHaveCount(0);
  // The shared footer: e-mail, and no social icons while none is configured.
  const footer = page.locator("footer.hx-footer");
  await expect(
    footer.getByRole("link", { name: "salon77.mn@gmail.com" }),
  ).toHaveAttribute("href", "mailto:salon77.mn@gmail.com");
  await expect(
    footer.getByRole("link", { name: /Фэйсбүүк|Инстаграм/ }),
  ).toHaveCount(0);
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
