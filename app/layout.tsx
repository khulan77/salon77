import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import "./booking-theme.css";
import "./responsive.css";
export const metadata: Metadata = {
  title: {
    default: "Salon77 — Таны салон нэг дор",
    template: "%s · Salon77",
  },
  // Icons and the share image come from app/icon.png, favicon.ico,
  // apple-icon.png and opengraph-image.png; absolute links need the site URL.
  ...(process.env.APP_URL && URL.canParse(process.env.APP_URL)
    ? { metadataBase: new URL(process.env.APP_URL) }
    : {}),
  description:
    "Салбар, багийн мэдээллээ нэг дороос удирдаж, салоныхоо ажлыг хялбарчлаарай.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mn">
      <body>{children}</body>
    </html>
  );
}
