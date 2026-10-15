import { redirect } from "next/navigation";
import { adminData } from "@/lib/admin-data";
import { moduleAllowed } from "@/lib/access";
// The admin home is the calendar; staff, who do not see it, get their schedule.
export default async function Page() {
  const data = await adminData();
  redirect(moduleAllowed(data.role, "/calendar") ? "/calendar" : "/schedules");
}
