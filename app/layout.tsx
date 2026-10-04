import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Salon77 — Таны салон нэг дор",
    template: "%s · Salon77",
  },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
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
