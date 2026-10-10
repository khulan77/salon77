import { BUSINESS_TIME_ZONE } from "./business-time";
import type { z } from "zod";

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Системийн админ",
  SALON_OWNER: "Эзэмшигч",
  MANAGER: "Менежер",
  RECEPTIONIST: "Ресепшн",
  STAFF: "Ажилтан",
};
export function roleLabel(role: string) {
  return roleLabels[role] ?? "Тодорхойгүй эрх";
}

export function userFacingError(error: unknown, fallback: string) {
  // Browser/network exceptions may be English regardless of document language.
  return error instanceof Error && /[А-Яа-яӨөҮүЁё]/.test(error.message)
    ? error.message
    : fallback;
}

const fieldLabels: Record<string, string> = {
  startAt: "Эхлэх цаг",
  serviceId: "Үйлчилгээ",
  customerId: "Үйлчлүүлэгч",
  date: "Өдөр",
  notes: "Тэмдэглэл",
  status: "Төлөв",
  idempotencyKey: "Захиалгын хүсэлт",
  categoryId: "Ангилал",
  priceMnt: "Үнэ",
  durationMinutes: "Хугацаа",
  sortOrder: "Эрэмбэ",
  title: "Албан тушаал",
  bio: "Товч танилцуулга",
  memberId: "Гишүүн",
  serviceIds: "Үйлчилгээнүүд",
  staffId: "Ажилтан",
  branchId: "Салбар",
  dayOfWeek: "Гараг",
  startMinute: "Эхлэх цаг",
  endMinute: "Дуусах цаг",
  startsAt: "Эхлэх хугацаа",
  endsAt: "Дуусах хугацаа",
  reason: "Шалтгаан",
  breaks: "Завсарлага",
  name: "Нэр",
  district: "Дүүрэг",
  address: "Хаяг",
  phone: "Утасны дугаар",
  latitude: "Өргөрөг",
  longitude: "Уртраг",
  active: "Төлөв",
  instagram: "Инстаграм хаяг",
  facebook: "Фэйсбүүк хаяг",
  serviceTypes: "Үйлчилгээний төрөл",
  staffCount: "Ажилтны тоо",
  note: "Шалтгаан",
  description: "Танилцуулга",
  slug: "Цахим хаяг",
  email: "Имэйл хаяг",
  role: "Эрх",
  branchIds: "Хариуцах салбарууд",
  branch: "Салбар",
};
export function validationMessage(issue: z.core.$ZodIssue) {
  if (/[А-Яа-яӨөҮүЁё]/.test(issue.message)) return issue.message;
  const field = fieldLabels[String(issue.path.at(-1))] ?? "Мэдээлэл";
  switch (issue.code) {
    case "invalid_type":
      return `${field}: зөв утга оруулна уу.`;
    case "too_small":
      if (issue.origin === "array") return "Доод тал нь нэг салбар сонгоно уу.";
      if (issue.origin === "number")
        return `${field}: ${issue.minimum}-аас багагүй утга оруулна уу.`;
      return `${field}: доод тал нь ${issue.minimum} тэмдэгт оруулна уу.`;
    case "too_big":
      if (issue.origin === "array")
        return `${field}: хамгийн ихдээ ${issue.maximum} сонголт зөвшөөрнө.`;
      if (issue.origin === "number")
        return `${field}: ${issue.maximum}-аас ихгүй утга оруулна уу.`;
      return `${field}: ${issue.maximum}-аас ихгүй тэмдэгт оруулна уу.`;
    case "invalid_format":
      return issue.format === "email"
        ? "Зөв имэйл хаяг оруулна уу."
        : issue.path.at(-1) === "slug"
          ? "Цахим хаягт латин жижиг үсэг, тоо, дан зураас ашиглана уу."
          : `${field}: зөв хэлбэрээр оруулна уу.`;
    case "invalid_value":
      return `${field}: жагсаалтаас зөв утга сонгоно уу.`;
    case "unrecognized_keys":
      return "Зөвшөөрөөгүй мэдээлэл оруулсан байна.";
    default:
      return `${field}: мэдээллээ шалгаад дахин оролдоно уу.`;
  }
}

export function formatMongolianDate(date: Date) {
  // Some browser builds lack Mongolian ICU data; request numeric parts only.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const year = part("year"),
    month = part("month"),
    day = part("day");
  const weekdays = [
    "Ням",
    "Даваа",
    "Мягмар",
    "Лхагва",
    "Пүрэв",
    "Баасан",
    "Бямба",
  ];
  const weekday =
    weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${year} оны ${month}-р сарын ${day}, ${weekday}`;
}

const weekdayNames = [
  "Ням",
  "Даваа",
  "Мягмар",
  "Лхагва",
  "Пүрэв",
  "Баасан",
  "Бямба",
];
// Calendar-date labels for report ranges: "9 сарын 1, Мягмар".
export function formatDayLabel(date: string, weekday = true) {
  const [, month, day] = date.split("-").map(Number);
  const name = weekdayNames[new Date(`${date}T12:00:00Z`).getUTCDay()];
  return `${month} сарын ${day}${weekday ? `, ${name}` : ""}`;
}
export function weekdayName(date: string) {
  return weekdayNames[new Date(`${date}T12:00:00Z`).getUTCDay()];
}
export function formatMonthLabel(month: string) {
  const [year, value] = month.split("-").map(Number);
  return `${year} оны ${value}-р сар`;
}
export function formatMnt(value: number) {
  return `${value.toLocaleString("en-US")}₮`;
}
// Axis ticks: "500 мянга", "1.5 сая".
export function formatCompactMnt(value: number) {
  if (value >= 1_000_000)
    return `${Number((value / 1_000_000).toFixed(1))} сая`;
  if (value >= 1000) return `${Number((value / 1000).toFixed(1))} мянга`;
  return String(value);
}
// Service durations: "45 мин", "1 цаг", "1 цаг 15 мин".
export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60),
    rest = minutes % 60;
  if (!hours) return `${rest} мин`;
  return rest ? `${hours} цаг ${rest} мин` : `${hours} цаг`;
}
// "дөнгөж сая", "15 минутын өмнө", "3 цагийн өмнө", "өчигдөр", "5 өдрийн өмнө".
export function formatTimeAgo(iso: string, now = new Date()) {
  const minutes = Math.max(0, Math.floor((+now - Date.parse(iso)) / 60000));
  if (minutes < 1) return "дөнгөж сая";
  if (minutes < 60) return `${minutes} минутын өмнө`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} цагийн өмнө`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "өчигдөр";
  if (days < 30) return `${days} өдрийн өмнө`;
  return formatMongolianDate(new Date(iso));
}
