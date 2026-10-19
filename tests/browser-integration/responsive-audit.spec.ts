import { test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
// Opt-in viewport audit: screenshots and layout checks at phone, tablet and
// desktop widths. Run with SALON77_AUDIT=<label>; results go to
// artifacts/responsive/<label>/.
const run = process.env.SALON77_AUDIT;
test.skip(!run, "SALON77_AUDIT is not set");
const widths = [360, 768, 1280];
const out = `artifacts/responsive/${run}`;
type Finding = {
  name: string;
  width: number;
  url: string;
  overflow: number;
  small: string[];
  clipped: string[];
  tables: string[];
};
const findings: Finding[] = [];
async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Имэйл хаяг", { exact: true }).fill(email);
  await page.getByLabel("Нууц үг", { exact: true }).fill("TestPassword123!");
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
}
async function inspect(page: Page, width: number) {
  // 44px on phones and tablets; with a mouse on a wide screen, WCAG 2.5.8's 24px.
  const target = width <= 1024 ? 44 : 24;
  return page.evaluate((target) => {
    const label = (el: Element) => {
      const text = (
        el.getAttribute("aria-label") ||
        (el as HTMLElement).innerText ||
        el.getAttribute("name") ||
        ""
      )
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 40);
      const cls = (el.getAttribute("class") || "").split(" ")[0];
      return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""} «${text}»`;
    };
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect(),
        s = getComputedStyle(el);
      return (
        r.width > 0 &&
        r.height > 0 &&
        s.visibility !== "hidden" &&
        s.display !== "none" &&
        // Screen-reader-only text is clipped on purpose.
        !el.closest(
          "[hidden], [aria-hidden='true'], dialog:not([open]), .sr-only",
        )
      );
    };
    const controls = [
      ...document.querySelectorAll(
        "a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab]",
      ),
    ].filter(visible);
    // Links inside running text are exempt, as WCAG 2.5.8 allows.
    const inline = (el: Element) =>
      el.tagName === "A" && !!el.closest("p, li > span, small, label");
    const small = controls
      .filter((el) => {
        if (inline(el)) return false;
        const input = el as HTMLInputElement;
        if (
          input.type === "radio" ||
          input.type === "checkbox" ||
          input.type === "file"
        )
          return false;
        const r = el.getBoundingClientRect();
        return r.height < target || r.width < target;
      })
      .map(
        (el) =>
          `${label(el)} ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`,
      );
    // Text cut off without an ellipsis.
    const clipped = [
      ...document.querySelectorAll("h1, h2, h3, p, td, th, button, a, span"),
    ]
      .filter(visible)
      .filter((el) => {
        const s = getComputedStyle(el);
        return (
          (s.overflowX === "hidden" || s.overflow === "hidden") &&
          s.textOverflow !== "ellipsis" &&
          el.scrollWidth > el.clientWidth + 2 &&
          (el as HTMLElement).innerText.trim().length > 0
        );
      })
      .map(label);
    // A table wider than the screen must sit in a scrolling container.
    const tables = [...document.querySelectorAll("table")]
      .filter(visible)
      .filter((t) => {
        const r = t.getBoundingClientRect();
        if (r.right <= innerWidth + 1) return false;
        let p = t.parentElement;
        while (p) {
          if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return false;
          p = p.parentElement;
        }
        return true;
      })
      .map(label);
    return {
      overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      small: [...new Set(small)],
      clipped: [...new Set(clipped)],
      tables,
    };
  }, target);
}
// Pages that load their content after the first paint.
const ready: Record<string, string> = {
  settings: "[role=radiogroup]",
  calendar: ".calendar-date-nav, .day-grid-panel",
};
async function capture(page: Page, name: string, url: string) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    // A dev-server reload can abort a navigation; retry before failing.
    for (let attempt = 0; ; attempt++)
      try {
        await page.goto(url);
        await page.waitForLoadState("networkidle");
        break;
      } catch (e) {
        if (attempt === 3) throw e;
        await page.waitForTimeout(3000);
      }
    if (ready[name])
      await page
        .locator(ready[name])
        .first()
        .waitFor({ timeout: 60000 })
        .catch(() => undefined);
    // The development-mode badge is not part of the page.
    await page.addStyleTag({
      content: "nextjs-portal{display:none!important}",
    });
    await page.waitForTimeout(300);
    findings.push({
      name,
      width,
      url: page.url().replace(/^https?:\/\/[^/]+/, ""),
      ...(await inspect(page, width)),
    });
    await page.screenshot({
      path: `${out}/${name}-${width}.png`,
      fullPage: true,
    });
  }
}
async function chooseTheme(page: Page, label: string) {
  await page.setViewportSize({ width: 1280, height: 900 });
  const choice = page
    .getByRole("radiogroup", { name: "Өнгөний загвар" })
    .getByRole("radio", { name: label, exact: true });
  // Settings load after the page; a dev-server reload (another edit landing)
  // can interrupt that, so try a few times.
  for (let attempt = 0; ; attempt++) {
    await page.goto("/settings?tab=page");
    try {
      await choice.waitFor({ timeout: 30000 });
      break;
    } catch (e) {
      if (attempt === 3) throw e;
    }
  }
  await choice.check();
  await page.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await page
    .locator(".settings-save")
    .getByText("Тохиргоог хадгаллаа.")
    .waitFor();
}
test("responsive audit", async ({ browser }) => {
  test.setTimeout(900000);
  mkdirSync(out, { recursive: true });
  const visitor = await browser.newPage();
  for (const [name, url] of [
    ["business", "/business"],
    ["home", "/home"],
    ["sign-up", "/sign-up"],
    ["invite", "/invite"],
  ])
    await capture(visitor, name, url);
  await visitor.close();
  const newcomer = await browser.newPage();
  await signIn(newcomer, "invite-mobile@example.test");
  await capture(newcomer, "onboarding", "/onboarding");
  await newcomer.close();
  const owner = await browser.newPage();
  await signIn(owner, "owner@example.test");
  for (const [name, url] of [
    ["dashboard", "/"],
    ["calendar", "/calendar"],
    ["bookings", "/bookings"],
    ["reports", "/reports"],
    ["settings", "/settings"],
    ["team", "/team"],
    ["branches", "/branches"],
  ])
    await capture(owner, name, url);
  for (const [key, label] of [
    ["classic", "Хар алтлаг"],
    ["green", "Ногоон"],
    ["rose", "Сарнай"],
    ["violet", "Нил ягаан"],
    ["blue", "Цэнхэр"],
  ]) {
    await chooseTheme(owner, label);
    await capture(owner, `book-${key}`, "/salon-a/book");
  }
  await chooseTheme(owner, "Хар алтлаг");
  await owner.close();
  const operator = await browser.newPage();
  await signIn(operator, "platform@example.test");
  await capture(operator, "platform", "/platform");
  await operator.close();
  writeFileSync(`${out}/audit.json`, JSON.stringify(findings, null, 2));
  const problems = findings.filter(
    (f) => f.overflow || f.small.length || f.clipped.length || f.tables.length,
  );
  console.log(
    `${findings.length} views, ${problems.length} with findings:\n` +
      problems
        .map(
          (f) =>
            `${f.name}@${f.width}: overflow ${f.overflow}px; small ${f.small.length}; clipped ${f.clipped.length}; tables ${f.tables.length}`,
        )
        .join("\n"),
  );
});
