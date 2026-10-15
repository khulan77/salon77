import test from "node:test";
import assert from "node:assert/strict";
import { branchWeek, weekSummary } from "../lib/week-hours";
test("weekly hours read naturally and merge equal days", () => {
  const ten = { open: 600, close: 1140 };
  assert.equal(weekSummary(Array(7).fill(ten)), "Өдөр бүр 10:00–19:00");
  assert.equal(
    weekSummary([ten, ten, ten, ten, ten, { open: 660, close: 1080 }, null]),
    "Да–Ба 10:00–19:00 · Бя 11:00–18:00 · Ня амарна",
  );
  assert.equal(
    weekSummary([null, ten, null, ten, ten, ten, null]),
    "Да амарна · Мя 10:00–19:00 · Лх амарна · Пү–Бя 10:00–19:00 · Ня амарна",
  );
});
test("branch hours span its staff shifts per weekday", () => {
  const week = branchWeek([
    { dayOfWeek: 1, startMinute: 600, endMinute: 1080 },
    { dayOfWeek: 1, startMinute: 660, endMinute: 1200 },
    { dayOfWeek: 6, startMinute: 720, endMinute: 960 },
  ]);
  assert.deepEqual(week[0], { open: 600, close: 1200 });
  assert.equal(week[1], null);
  assert.deepEqual(week[5], { open: 720, close: 960 });
});
