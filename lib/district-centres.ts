import type { District } from "./districts";
// Rough district centres as [lat, lng, zoom], where maps open before a pin
// is placed.
export const DISTRICT_CENTRES: Record<District, [number, number, number]> = {
  Багануур: [47.78, 108.37, 12],
  Багахангай: [47.33, 107.47, 12],
  Баянгол: [47.912, 106.86, 13],
  Баянзүрх: [47.92, 106.98, 13],
  Налайх: [47.77, 107.25, 13],
  Сонгинохайрхан: [47.92, 106.8, 13],
  Сүхбаатар: [47.93, 106.92, 13],
  "Хан-Уул": [47.885, 106.89, 13],
  Чингэлтэй: [47.93, 106.9, 13],
};
export const CITY_CENTRE: [number, number, number] = [47.918, 106.917, 12];
