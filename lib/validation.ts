import { z } from "zod";
const text = (max: number) => z.string().trim().min(1).max(max);
export const branchSchema = z
  .object({
    name: text(100),
    district: text(100),
    address: text(500),
    phone: text(30),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    active: z.boolean().optional(),
  })
  .strict();
const reserved = [
  "api",
  "auth",
  "sign-in",
  "sign-up",
  "onboarding",
  "dashboard",
  "branches",
  "team",
  "settings",
  "calendar",
  "bookings",
  "customers",
  "reviews",
  "services",
  "packages",
  "promotions",
  "inventory",
  "sales",
  "employees",
  "schedules",
  "salon-page",
  "gallery",
  "reports",
  "plan",
  "partnership",
  "support",
];
export const onboardingSchema = z.object({
  name: text(100),
  phone: text(30),
  instagram: z.string().trim().max(100).optional(),
  description: z.string().trim().max(1000).optional(),
  slug: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .refine(
      (s) => !reserved.includes(s),
      "Энэ хаягийг системд ашигладаг тул өөр хаяг сонгоно уу.",
    ),
  branch: branchSchema,
});
export const inviteSchema = z
  .object({
    name: text(100),
    email: z.email().transform((s) => s.toLowerCase()),
    role: z.enum(["MANAGER", "RECEPTIONIST", "STAFF"]),
    branchIds: z.array(z.string().min(1)).min(1).max(100),
  })
  .strict();
