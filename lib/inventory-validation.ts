import { z } from "zod";
export const productUnits = [
  "ш",
  "мл",
  "гр",
  "л",
  "кг",
  "багц",
  "шил",
  "хайрцаг",
] as const;
const money = z
  .number({ error: "Үнийг тоогоор оруулна уу." })
  .int("Үнийг бүхэл төгрөгөөр оруулна уу.")
  .min(0, "Үнэ сөрөг байж болохгүй.")
  .max(1_000_000_000);
const quantity = z
  .number({ error: "Тоо хэмжээг тоогоор оруулна уу." })
  .int("Тоо хэмжээг бүхэл тоогоор оруулна уу.")
  .min(0, "Үлдэгдэл сөрөг байж болохгүй.")
  .max(1_000_000);
export const productSchema = z
  .object({
    name: z.string().trim().min(1, "Барааны нэрийг оруулна уу.").max(150),
    sku: z
      .string()
      .trim()
      .max(64)
      .transform((v) => v || null),
    category: z.string().trim().max(60),
    unit: z.enum(productUnits, { error: "Хэмжих нэгжийг сонгоно уу." }),
    costMnt: money,
    priceMnt: money,
    lowStock: quantity,
    active: z.boolean(),
    // Exact quantities per branch; branches left out keep their stock.
    stock: z
      .array(
        z.object({ branchId: z.string().min(1).max(100), quantity }).strict(),
      )
      .max(100),
  })
  .strict();
export const stockAdjustSchema = z
  .object({
    productId: z.string().min(1).max(100),
    branchId: z.string().min(1).max(100),
    delta: z
      .number()
      .int()
      .min(-1_000_000)
      .max(1_000_000)
      .refine((v) => v !== 0, "Өөрчлөх тоог оруулна уу."),
  })
  .strict();
