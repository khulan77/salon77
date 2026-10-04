import type { z } from "zod";

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Системийн админ",
  SALON_OWNER: "Салоны эзэн",
  MANAGER: "Менежер",
  RECEPTIONIST: "Угтах ажилтан",
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
  name: "Нэр",
  district: "Дүүрэг",
  address: "Хаяг",
  phone: "Утасны дугаар",
  latitude: "Өргөрөг",
  longitude: "Уртраг",
  active: "Төлөв",
  instagram: "Инстаграм хаяг",
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
        return `Хамгийн ихдээ ${issue.maximum} салбар сонгоно уу.`;
      if (issue.origin === "number")
        return `${field}: ${issue.maximum}-аас ихгүй утга оруулна уу.`;
      return `${field}: ${issue.maximum}-аас ихгүй тэмдэгт оруулна уу.`;
    case "invalid_format":
      return issue.format === "email"
        ? "Зөв имэйл хаяг оруулна уу."
        : "Цахим хаягт латин жижиг үсэг, тоо, дан зураас ашиглана уу.";
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
    timeZone: "Asia/Ulaanbaatar",
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
