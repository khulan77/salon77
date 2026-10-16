import type { CSSProperties } from "react";
export const bookingThemeKeys = [
  "LIGHT",
  "DARK",
  "PINK",
  "NATURAL",
  "GOLD",
] as const;
export type BookingTheme = (typeof bookingThemeKeys)[number];
// Scoped semantic tokens: surfaces, text, controls and focus share one palette.
// Each theme also sets its corner radius and heading typeface, so the themes
// differ in character, not only in colour. Contrast pairs meet WCAG AA:
// text ≥ 4.5:1 on background, surface and soft; borders ≥ 3:1.
export const bookingThemes = {
  LIGHT: {
    label: "Цайвар",
    hint: "Цэвэрхэн, бүх төрлийн салонд",
    radius: "16px",
    headingFont: "inherit",
    background: "#faf9f7",
    surface: "#ffffff",
    foreground: "#25242b",
    muted: "#625b6b",
    accent: "#6242cc",
    onAccent: "#ffffff",
    soft: "#eee8fc",
    border: "#81778e",
  },
  DARK: {
    label: "Бараан",
    hint: "Үсчин, барбер",
    radius: "14px",
    headingFont: "inherit",
    background: "#17181c",
    surface: "#24262c",
    foreground: "#f6f4f0",
    muted: "#c4c0cd",
    accent: "#d4bdff",
    onAccent: "#21152f",
    soft: "#363044",
    border: "#948c9f",
  },
  PINK: {
    label: "Зөөлөн ягаан",
    hint: "Хумс, сормуус, хөмсөг",
    radius: "22px",
    headingFont: "inherit",
    background: "#fff5f8",
    surface: "#ffffff",
    foreground: "#392330",
    muted: "#765262",
    accent: "#a42c61",
    onAccent: "#ffffff",
    soft: "#fbe4ee",
    border: "#a27086",
  },
  NATURAL: {
    label: "Байгалийн",
    hint: "Арьс арчилгаа, спа, массаж",
    radius: "18px",
    headingFont: "inherit",
    background: "#f3f6ef",
    surface: "#ffffff",
    foreground: "#243427",
    muted: "#52664f",
    accent: "#38633c",
    onAccent: "#ffffff",
    soft: "#e2eddb",
    border: "#7a8b71",
  },
  GOLD: {
    label: "Алтлаг",
    hint: "Дээд зэрэглэлийн үйлчилгээ",
    radius: "8px",
    headingFont: 'Georgia, "Times New Roman", serif',
    background: "#faf6ed",
    surface: "#fffdf7",
    foreground: "#382e1e",
    muted: "#716043",
    accent: "#806018",
    onAccent: "#ffffff",
    soft: "#f2e6c8",
    border: "#9a8251",
  },
} as const;
export function recommendedBookingTheme(
  types: readonly string[],
): BookingTheme {
  if (types.includes("HAIR")) return "DARK";
  if (types.some((t) => ["NAILS", "LASHES", "BROWS", "MAKEUP"].includes(t)))
    return "PINK";
  if (types.some((t) => ["SKIN", "MASSAGE", "WAXING"].includes(t)))
    return "NATURAL";
  return "LIGHT";
}
export function bookingThemeStyle(theme: BookingTheme): CSSProperties {
  const p = bookingThemes[theme];
  return {
    "--background": p.background,
    "--surface": p.surface,
    "--foreground": p.foreground,
    "--muted": p.muted,
    "--accent": p.accent,
    "--on-accent": p.onAccent,
    "--accent-soft": p.soft,
    "--border": p.border,
    "--pb-radius": p.radius,
    "--pb-heading-font": p.headingFont,
    colorScheme: theme === "DARK" ? "dark" : "light",
  } as CSSProperties;
}
