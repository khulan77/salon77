import { clockTime } from "./schedule-time";
// Opening hours per weekday, Monday first; null is a day off.
export type DayHours = { open: number; close: number } | null;
const shortDays = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];
// "Да–Ба 10:00–19:00 · Бя 11:00–18:00 · Ня амарна"; equal neighbours merge.
export function weekSummary(days: DayHours[]) {
  const label = (d: DayHours) =>
    d ? `${clockTime(d.open)}–${clockTime(d.close)}` : "амарна";
  if (days.every((d) => d && label(d) === label(days[0])))
    return `Өдөр бүр ${label(days[0])}`;
  const parts: string[] = [];
  for (let i = 0; i < days.length;) {
    let j = i;
    while (j + 1 < days.length && label(days[j + 1]) === label(days[i])) j++;
    const span = i === j ? shortDays[i] : `${shortDays[i]}–${shortDays[j]}`;
    parts.push(`${span} ${label(days[i])}`);
    i = j + 1;
  }
  return parts.join(" · ");
}
// A branch's hours from its staff shifts: earliest start to latest end.
export function branchWeek(
  shifts: { dayOfWeek: number; startMinute: number; endMinute: number }[],
): DayHours[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = shifts.filter((s) => s.dayOfWeek === i + 1);
    return day.length
      ? {
          open: Math.min(...day.map((s) => s.startMinute)),
          close: Math.max(...day.map((s) => s.endMinute)),
        }
      : null;
  });
}
