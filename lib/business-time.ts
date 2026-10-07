// Defaults are centralized; domain boundaries accept a timezone for future salon settings.
export const BUSINESS_TIME_ZONE = "Asia/Ulaanbaatar";
export const SLOT_INTERVAL_MINUTES = 15;
const formatters = new Map<string, Intl.DateTimeFormat>();
export function localStamp(
  value: Date | string,
  timeZone = BUSINESS_TIME_ZONE,
) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(new Date(value));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
export function localInstant(
  value: string,
  timeZone = BUSINESS_TIME_ZONE,
): Date {
  const target = Date.parse(`${value}:00Z`);
  let candidate = target;
  for (let i = 0; i < 4; i++) {
    const actual = Date.parse(
      `${localStamp(new Date(candidate), timeZone)}:00Z`,
    );
    const delta = target - actual;
    if (!delta) break;
    candidate += delta;
  }
  const result = new Date(candidate);
  if (localStamp(result, timeZone) !== value)
    throw new Error("Эхлэх болон дуусах цагийг шалгана уу.");
  return result;
}
export function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function dayWindow(date: string, timeZone = BUSINESS_TIME_ZONE) {
  return {
    start: localInstant(`${date}T00:00`, timeZone),
    end: localInstant(`${addDays(date, 1)}T00:00`, timeZone),
  };
}
export function minuteInstant(
  date: string,
  minute: number,
  timeZone = BUSINESS_TIME_ZONE,
) {
  return minute === 1440
    ? dayWindow(date, timeZone).end
    : localInstant(
        `${date}T${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
        timeZone,
      );
}
