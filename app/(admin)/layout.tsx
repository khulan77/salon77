import { adminData } from "@/lib/admin-data";
import { AdminShell } from "@/components/admin-shell";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell data={await adminData()}>{children}</AdminShell>;
}
