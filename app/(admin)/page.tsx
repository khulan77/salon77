import { adminData } from "@/lib/admin-data";
import { Dashboard } from "@/components/dashboard";
export default async function Page() {
  return <Dashboard data={await adminData()} />;
}
