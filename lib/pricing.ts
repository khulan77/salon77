// Shared by the server (authoritative booking price) and the UI (preview).
export const DISCOUNT_PRESETS = [10, 15, 20, 30, 50] as const;
export const MAX_DISCOUNT_PERCENT = 90;
// Discounted prices round to the nearest 100₮; integer math avoids float drift.
export function discountedPrice(priceMnt: number, discountPercent: number) {
  if (!discountPercent) return priceMnt;
  return Math.round((priceMnt * (100 - discountPercent)) / 10000) * 100;
}
