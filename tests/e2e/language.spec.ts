import { expect, test, type Page } from "@playwright/test";
import { navigation } from "../../lib/navigation";

async function expectMongolian(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("lang", "mn");
  const text = await page.locator("body").innerText();
  // Brands and timezone notation are deliberately not translated.
  const remaining = text.replace(/salon77|salon|UTC|s\./gi, "");
  expect(remaining.match(/[a-zA-Z]{2,}/g) ?? []).toEqual([]);
  const untranslatedAttributes = await page
    .locator("[aria-label], [placeholder], [title], img[alt]")
    .evaluateAll((elements) =>
      elements
        .flatMap((element) =>
          ["aria-label", "placeholder", "title", "alt"].map(
            (attribute) => element.getAttribute(attribute) ?? "",
          ),
        )
        .filter((value) =>
          /[A-Za-z]{2,}/.test(
            value.replace(
              /Salon77|you@your-salon\.com|name@example\.com|@salon77|tanii-salon/gi,
              "",
            ),
          ),
        ),
    );
  expect(untranslatedAttributes).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("all implemented pages and future navigation remain Mongolian on desktop and mobile", async ({
  page,
}, info) => {
  const routes = [
    ...navigation.flatMap((group) => group.items.map((item) => item.href)),
    "/sign-in",
    "/sign-up",
    "/onboarding",
    "/not-a-real-page",
  ];
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    await expectMongolian(page);
    if (
      ["/", "/branches", "/team", "/sign-in", "/onboarding"].includes(route)
    ) {
      await page.screenshot({
        path: `test-results/mn-${route.replace(/\//g, "") || "dashboard"}-${info.project.name}.png`,
        fullPage: true,
      });
    }
  }
});

test("search, user menu, branch form and invitation form have Mongolian text", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Хэрэглэгчийн цэс" }).click();
  await expect(page.getByRole("link", { name: "Нэвтрэх" })).toBeVisible();
  await expectMongolian(page);
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Цэс нээх" }).click();
    await expect(
      page.getByRole("navigation", { name: "Үндсэн цэс" }),
    ).toBeVisible();
    await expectMongolian(page);
    const backdrop = page.getByRole("button", { name: "Цэс хаах" });
    const bounds = await backdrop.boundingBox();
    expect(bounds).not.toBeNull();
    // Tap the exposed backdrop; its center is covered by the mobile drawer.
    await backdrop.click({
      position: { x: bounds!.width - 12, y: bounds!.height / 2 },
    });
    await expect(backdrop).not.toBeVisible();
  }
  await page.getByRole("button", { name: "Хуудас хайх" }).click();
  await page.getByPlaceholder("Хуудасны нэрээр хайх…").fill("Тохиргоо");
  await expectMongolian(page);
  await page.getByRole("button", { name: "Хайлт хаах" }).click();
  await page.goto("/branches");
  await page.getByRole("button", { name: "Салбар нэмэх", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectMongolian(page);
  await page.goto("/team");
  await page.getByRole("button", { name: "Гишүүн урих" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectMongolian(page);
});

test("browser form validation stays Mongolian in an English browser", async ({
  page,
}) => {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  const name = page.getByRole("textbox", { name: "Салоны нэр", exact: true });
  await expect(name).toHaveJSProperty(
    "validationMessage",
    "Энэ талбарыг бөглөнө үү.",
  );
  await name.fill("Тест салон");
  await expect(name).toHaveJSProperty("validationMessage", "");
  await page
    .getByRole("textbox", { name: "Утасны дугаар", exact: true })
    .fill("99112233");
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await expect(
    page.getByRole("heading", { name: "Салоныхоо цахим хаягийг сонгоорой." }),
  ).toBeVisible();
});

test("API errors use Mongolian while keeping status codes", async ({
  request,
  baseURL,
}) => {
  const response = await request.post("/api/branches", {
    headers: { Origin: baseURL! },
    data: {},
  });
  expect(response.status()).toBe(503);
  expect((await response.json()).error).toBe(
    "Системийн холболт тохируулагдаагүй байна. Одоогоор танилцах горим ашиглана уу.",
  );
  const blocked = await request.post("/api/branches", {
    headers: { Origin: "https://attacker.invalid" },
    data: {},
  });
  expect(blocked.status()).toBe(403);
  expect((await blocked.json()).error).toBe(
    "Хүсэлтийг зөвшөөрөөгүй эх сурвалжаас илгээсэн байна.",
  );
});
