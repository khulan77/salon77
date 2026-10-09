import Link from "next/link";
import type { Metadata } from "next";
import { platformAdminId } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Платформ · Salon77",
  robots: { index: false, follow: false },
};
export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await platformAdminId();
  return (
    <div className="pf">
      <header className="pf-header">
        <Link href="/platform" className="pf-logo">
          <span>s</span>salon77<em>.</em>
          <small>Платформ</small>
        </Link>
        <nav aria-label="Платформын цэс">
          <Link href="/platform">Тойм</Link>
        </nav>
      </header>
      <main className="pf-main">{children}</main>
    </div>
  );
}
