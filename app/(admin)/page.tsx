import { adminData } from "@/lib/admin-data";
import { Dashboard } from "@/components/dashboard";
import { membership } from "@/lib/auth";
import { actorFromMember } from "@/lib/access";
import { db } from "@/lib/db";
import { listBookings } from "@/lib/services/bookings";
import { localStamp } from "@/lib/business-time";
export default async function Page() {
  const data = await adminData();
  const bookings =
    !data.preview && data.role !== "STAFF"
      ? await listBookings(db, actorFromMember(await membership()), {
          date: localStamp(new Date()).slice(0, 10),
          days: 1,
        })
      : [];
  return <Dashboard data={data} bookings={bookings} />;
}
