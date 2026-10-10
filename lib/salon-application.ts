import { z } from "zod";
// What a salon tells the platform when it applies. Shared by the onboarding
// form, the resubmit form and the platform review screen.
export const SERVICE_TYPES = {
  HAIR: "Үс",
  NAILS: "Хумс",
  LASHES: "Сормуус",
  BROWS: "Хөмсөг",
  MAKEUP: "Нүүр будалт",
  SKIN: "Арьс арчилгаа",
  MASSAGE: "Массаж",
  WAXING: "Үс авалт",
  OTHER: "Бусад",
} as const;
export type ServiceType = keyof typeof SERVICE_TYPES;
export const serviceTypeKeys = Object.keys(SERVICE_TYPES) as ServiceType[];
export const serviceTypeLabel = (key: string) =>
  SERVICE_TYPES[key as ServiceType] ?? key;
export const REVIEW_LABELS = {
  PENDING: "Хянагдаж байна",
  APPROVED: "Баталгаажсан",
  REJECTED: "Буцаасан",
} as const;
export type ReviewStatus = keyof typeof REVIEW_LABELS;
// A handle or a link without spaces; the reviewer opens it to check the salon.
const social = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .regex(/^\S*$/, "Хаягийг зайгүй бичнэ үү.")
    .default("");
export const applicationFields = {
  instagram: social(100),
  facebook: social(200),
  serviceTypes: z
    .array(z.enum(serviceTypeKeys))
    .min(1, "Үйлчилгээний төрлөөс дор хаяж нэгийг сонгоно уу.")
    .max(serviceTypeKeys.length)
    .transform((v) => [...new Set(v)]),
  staffCount: z
    .number()
    .int("Ажилтны тоог бүхэл тоогоор оруулна уу.")
    .min(1, "Ажилтны тоо 1-ээс багагүй байна.")
    .max(1000, "Ажилтны тоо 1000-аас ихгүй байна."),
};
export const socialRequired =
  "Инстаграм эсвэл Фэйсбүүк хаягийнхаа аль нэгийг заавал оруулна уу.";
export const hasSocial = (v: { instagram?: string; facebook?: string }) =>
  Boolean(v.instagram || v.facebook);
// Only ever an https link to the named network, whatever the salon typed.
export function socialUrl(kind: "instagram" | "facebook", value: string) {
  const host = kind === "instagram" ? "instagram.com" : "facebook.com";
  const bare = value.trim().replace(/^https?:\/\//i, "");
  const own = /^(www\.|m\.)?(instagram|facebook|fb)\.com\//i;
  // A link to any other site is not turned into a profile link.
  if (bare.includes("/") && !own.test(bare)) return null;
  const handle = bare
    .replace(own, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
  return /^[A-Za-z0-9._-]{1,100}$/.test(handle)
    ? `https://${host}/${handle}`
    : null;
}
