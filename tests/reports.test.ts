import test from "node:test";
import assert from "node:assert/strict";
import { aggregateRevenue, reportQuery } from "../lib/services/reports";
import { localInstant } from "../lib/business-time";
import { formatCompactMnt, formatDayLabel } from "../lib/ui-language";
const row = (at: string, price: number, service = "s1", staff = "a") => ({
  startAt: localInstant(at),
  priceSnapshot: price,
  serviceId: service,
  serviceNameSnapshot: service === "s1" ? "Маникюр" : "Педикюр",
  staffId: staff,
});
test("revenue aggregation buckets by Ulaanbaatar day and ranks breakdowns", () => {
  const report = aggregateRevenue(
    [
      // 00:30 local is still the previous UTC day; it must count on 09-02.
      row("2026-09-02T00:30", 50000),
      row("2026-09-02T15:00", 30000, "s2", "b"),
      row("2026-09-03T10:00", 80000, "s2", "b"),
    ],
    { from: "2026-09-01", to: "2026-09-03" },
    { a: "Ану", b: "Болор" },
  );
  assert.equal(report.granularity, "day");
  assert.deepEqual(
    report.series.map((b) => [b.key, b.revenue, b.count]),
    [
      ["2026-09-01", 0, 0],
      ["2026-09-02", 80000, 2],
      ["2026-09-03", 80000, 1],
    ],
  );
  assert.equal(report.revenue, 160000);
  assert.equal(report.completed, 3);
  assert.equal(report.average, 53333);
  assert.deepEqual(
    report.byService.map((s) => [s.name, s.count, s.revenue]),
    [
      ["Педикюр", 2, 110000],
      ["Маникюр", 1, 50000],
    ],
  );
  assert.deepEqual(
    report.byStaff.map((s) => [s.name, s.revenue]),
    [
      ["Болор", 110000],
      ["Ану", 50000],
    ],
  );
});
test("long report ranges switch to monthly buckets and ignore rows outside", () => {
  const report = aggregateRevenue(
    [row("2026-01-15T10:00", 10000), row("2026-04-01T10:00", 5000)],
    { from: "2026-01-01", to: "2026-03-31" },
  );
  assert.equal(report.granularity, "month");
  assert.deepEqual(
    report.series.map((b) => [b.key, b.revenue]),
    [
      ["2026-01", 10000],
      ["2026-02", 0],
      ["2026-03", 0],
    ],
  );
  assert.equal(report.revenue, 10000);
});
test("report query validation and Mongolian labels", () => {
  assert.ok(
    reportQuery.safeParse({ from: "2026-09-01", to: "2026-09-30" }).success,
  );
  for (const bad of [
    { from: "2026-09-30", to: "2026-09-01" },
    { from: "2025-01-01", to: "2026-09-01" },
    { from: "2026-09-01", to: "2026-09-30", salonId: "b" },
    { from: "bad", to: "2026-09-30" },
  ])
    assert.equal(reportQuery.safeParse(bad).success, false);
  assert.equal(formatDayLabel("2026-09-01"), "9 сарын 1, Мягмар");
  assert.equal(formatCompactMnt(1_500_000), "1.5 сая");
  assert.equal(formatCompactMnt(500_000), "500 мянга");
});
