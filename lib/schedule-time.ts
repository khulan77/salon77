export const weekdays = [
  "Даваа",
  "Мягмар",
  "Лхагва",
  "Пүрэв",
  "Баасан",
  "Бямба",
  "Ням",
];
export function clockTime(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
export function parseClock(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
export function localDateTime(value: string) {
  return new Date(new Date(value).getTime() + 8 * 3600000)
    .toISOString()
    .slice(0, 16);
}
export function localToISO(value: string) {
  return new Date(`${value}:00+08:00`).toISOString();
}
export function nextDate(value: string) {
  return new Date(new Date(`${value}T00:00:00Z`).getTime() + 86400000)
    .toISOString()
    .slice(0, 10);
}

export function timeOffLabel(
  startsAt: string,
  endsAt: string,
  fullDay: boolean,
) {
  if (!fullDay)
    return `${localDateTime(startsAt).replace("T", " ")} — ${localDateTime(endsAt).replace("T", " ")}`;
  const start = localDateTime(startsAt).slice(0, 10);
  const end = localDateTime(
    new Date(new Date(endsAt).getTime() - 1).toISOString(),
  ).slice(0, 10);
  return start === end ? start : `${start} — ${end}`;
}
