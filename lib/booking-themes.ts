import type { CSSProperties } from "react";
export const bookingThemeKeys = [
  "CLASSIC",
  "GREEN",
  "ROSE",
  "VIOLET",
  "BLUE",
] as const;
export type BookingTheme = (typeof bookingThemeKeys)[number];
// The booking page uses the admin design (serif titles, white cards, quiet
// borders); a theme only picks its colours. Scoped semantic tokens: surfaces,
// text, controls and focus share one palette. Contrast pairs meet WCAG AA:
// text ≥ 4.5:1 on background, surface and soft; borders ≥ 3:1. `highlight`
// is decoration only (the title dot, the selected marker), never text.
export const bookingThemes = {
  CLASSIC: {
    label: "Хар алтлаг",
    hint: "Үндсэн, Salon77-ийн өнгө",
    background: "#f8f6f4",
    surface: "#ffffff",
    foreground: "#121316",
    muted: "#635c57",
    accent: "#121316",
    onAccent: "#ffffff",
    soft: "#f3ead9",
    border: "#8d857f",
    highlight: "#c5a880",
  },
  GREEN: {
    label: "Ногоон",
    hint: "Арьс арчилгаа, спа, массаж",
    background: "#f3f5f2",
    surface: "#ffffff",
    foreground: "#1b2a21",
    muted: "#56685c",
    accent: "#2f4b3c",
    onAccent: "#ffffff",
    soft: "#e1eae3",
    border: "#7d8e83",
    highlight: "#9db3a3",
  },
  ROSE: {
    label: "Сарнай",
    hint: "Хумс, сормуус, хөмсөг",
    background: "#f8f3ef",
    surface: "#ffffff",
    foreground: "#2e2226",
    muted: "#735e66",
    accent: "#94505b",
    onAccent: "#ffffff",
    soft: "#f4e5e3",
    border: "#a5848a",
    highlight: "#b87880",
  },
  VIOLET: {
    label: "Нил ягаан",
    hint: "Үсчин, гоо сайхны студи",
    background: "#f6f5fc",
    surface: "#ffffff",
    foreground: "#1f1b36",
    muted: "#5f5a78",
    accent: "#5443d1",
    onAccent: "#ffffff",
    soft: "#ebe8fc",
    border: "#8d87ae",
    highlight: "#7c6cf0",
  },
  BLUE: {
    label: "Цэнхэр",
    hint: "Цэвэрхэн, тайван өнгө",
    background: "#eef3fa",
    surface: "#ffffff",
    foreground: "#1c2740",
    muted: "#4d5d78",
    accent: "#34578e",
    onAccent: "#ffffff",
    soft: "#dfe8f6",
    border: "#7488a8",
    highlight: "#6f8fc0",
  },
} as const;
export function recommendedBookingTheme(
  types: readonly string[],
): BookingTheme {
  if (types.some((t) => ["NAILS", "LASHES", "BROWS", "MAKEUP"].includes(t)))
    return "ROSE";
  if (types.some((t) => ["SKIN", "MASSAGE", "WAXING"].includes(t)))
    return "GREEN";
  return "CLASSIC";
}
export function bookingThemeStyle(theme: BookingTheme): CSSProperties {
  const p = bookingThemes[theme] ?? bookingThemes.CLASSIC;
  return {
    "--background": p.background,
    "--surface": p.surface,
    "--foreground": p.foreground,
    "--muted": p.muted,
    "--accent": p.accent,
    "--on-accent": p.onAccent,
    "--accent-soft": p.soft,
    "--border": p.border,
    "--highlight": p.highlight,
    // Card edges: a quiet line mixed from the text colour, as in the admin.
    "--line": `color-mix(in srgb, ${p.foreground} 12%, ${p.surface})`,
    "--pb-radius": "10px",
    "--pb-heading-font":
      '"Source Serif 4 Variable", "Source Serif 4", Georgia, "Times New Roman", serif',
    colorScheme: "light",
  } as CSSProperties;
}
