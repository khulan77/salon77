import { SERVICE_TYPES, type ServiceType } from "./salon-application";
// Starter services offered for the service types a salon chose at
// onboarding. The owner only adds prices; names and durations stay here.
export type ServiceTemplate = {
  id: string;
  type: ServiceType;
  name: string;
  category: string;
  durationMinutes: number;
};
const catalog: Record<
  ServiceType,
  [id: string, name: string, minutes: number][]
> = {
  HAIR: [
    ["hair-women-cut", "Эмэгтэй үс засалт", 45],
    ["hair-men-cut", "Эрэгтэй үс засалт", 30],
    ["hair-kids-cut", "Хүүхдийн үс засалт", 30],
    ["hair-color", "Үс будалт", 120],
    ["hair-wash-style", "Үс угааж янзлах", 45],
  ],
  NAILS: [
    ["nails-gel", "Гел будалт", 60],
    ["nails-manicure", "Маникюр", 45],
    ["nails-pedicure", "Педикюр", 60],
    ["nails-removal", "Хумс салгах", 30],
    ["nails-extension", "Хумс уртасгах", 90],
  ],
  LASHES: [
    ["lashes-extension", "Сормуус суулгах", 120],
    ["lashes-refill", "Сормуус засвар", 60],
    ["lashes-lift", "Сормуус ламинаци", 60],
    ["lashes-removal", "Сормуус салгах", 30],
  ],
  BROWS: [
    ["brows-shape", "Хөмсөг засалт", 30],
    ["brows-tint", "Хөмсөг будалт", 30],
    ["brows-lamination", "Хөмсөг ламинаци", 45],
  ],
  MAKEUP: [
    ["makeup-day", "Өдрийн нүүр будалт", 60],
    ["makeup-evening", "Үдшийн нүүр будалт", 90],
    ["makeup-bridal", "Хуримын нүүр будалт", 120],
  ],
  SKIN: [
    ["skin-cleansing", "Нүүр цэвэрлэгээ", 60],
    ["skin-hydrating", "Чийгшүүлэх арчилгаа", 60],
    ["skin-deep-cleansing", "Гүн цэвэрлэгээ", 90],
  ],
  MASSAGE: [
    ["massage-body", "Биеийн массаж", 60],
    ["massage-back-neck", "Нуруу, хүзүүний массаж", 30],
    ["massage-foot", "Хөлийн массаж", 45],
    ["massage-hot-stone", "Халуун чулуун массаж", 90],
  ],
  WAXING: [
    ["waxing-legs", "Хөлний вакс", 45],
    ["waxing-arms", "Гарын вакс", 30],
    ["waxing-underarm", "Суганы вакс", 15],
    ["waxing-bikini", "Бикини вакс", 30],
  ],
  // "Other" is too broad for useful defaults.
  OTHER: [],
};
export const SERVICE_TEMPLATES: ServiceTemplate[] = (
  Object.keys(catalog) as ServiceType[]
).flatMap((type) =>
  catalog[type].map(([id, name, durationMinutes]) => ({
    id,
    type,
    name,
    category: SERVICE_TYPES[type],
    durationMinutes,
  })),
);
export const serviceTemplateIds = SERVICE_TEMPLATES.map((t) => t.id) as [
  string,
  ...string[],
];
export const templatesFor = (types: string[]) =>
  SERVICE_TEMPLATES.filter((t) => types.includes(t.type));
