import Link from "next/link";
import type { Metadata } from "next";
import { platformAdminId } from "@/lib/auth";
import { db } from "@/lib/db";
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
  // Shown on every console page so a new application is never missed.
  const [pending, requests] = await Promise.all([
    db.salon.count({ where: { reviewStatus: "PENDING" } }),
    db.feedback.count({ where: { status: "OPEN" } }),
  ]);
  return (
    <div className="pf">
      <header className="pf-header">
        <Link href="/platform" className="pf-logo">
          <span>s</span>salon77<em>.</em>
          <small>Платформ</small>
        </Link>
        <nav aria-label="Платформын цэс">
          <Link href="/platform">Тойм</Link>
          <Link href="/platform#pf-applications">
            Хүсэлтүүд
            {pending > 0 && (
              <b
                className="pf-count"
                aria-label={`${pending} хүсэлт хүлээгдэж байна`}
              >
                {pending}
              </b>
            )}
          </Link>
          <Link href="/platform/feedback">
            Санал хүсэлт
            {requests > 0 && (
              <b
                className="pf-count"
                aria-label={`${requests} санал хүсэлт хариу хүлээж байна`}
              >
                {requests}
              </b>
            )}
          </Link>
        </nav>
      </header>
      <main className="pf-main">{children}</main>
    </div>
  );
}
