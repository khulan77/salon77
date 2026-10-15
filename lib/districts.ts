// Ulaanbaatar districts. Branch validation, the branch forms and the public
// directory filter all read this one list.
export const DISTRICTS = [
  "Багануур",
  "Багахангай",
  "Баянгол",
  "Баянзүрх",
  "Налайх",
  "Сонгинохайрхан",
  "Сүхбаатар",
  "Хан-Уул",
  "Чингэлтэй",
] as const;
export type District = (typeof DISTRICTS)[number];
const key = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s*дүүрэг$/, "")
    .replace(/[\s.-]+/g, "");
// Abbreviations and Latin spellings found in free-text branch data.
const aliases: Record<string, District> = {
  бнд: "Багануур",
  baganuur: "Багануур",
  бхд: "Багахангай",
  bagakhangai: "Багахангай",
  бгд: "Баянгол",
  bayangol: "Баянгол",
  бзд: "Баянзүрх",
  bayanzurkh: "Баянзүрх",
  нд: "Налайх",
  nalaikh: "Налайх",
  схд: "Сонгинохайрхан",
  songinokhairkhan: "Сонгинохайрхан",
  сбд: "Сүхбаатар",
  sukhbaatar: "Сүхбаатар",
  худ: "Хан-Уул",
  khanuul: "Хан-Уул",
  чд: "Чингэлтэй",
  chingeltei: "Чингэлтэй",
};
for (const d of DISTRICTS) aliases[key(d)] = d;
// The standard name for a stored or typed district, or null if unknown.
export function normalizeDistrict(value: string): District | null {
  return aliases[key(value)] ?? null;
}
