import type { NotificationEvent } from "@prisma/client";
import { localStamp } from "../business-time";
import { formatMnt } from "../ui-language";
export type NoticeData = {
  salonName: string;
  branchName: string;
  salonPhone: string;
  services: string[];
  startAt: Date;
  deposit?: { amountMnt: number; bankName: string; accountNumber: string };
};
// "10/31 11:00" — short enough for a single SMS segment where possible.
function when(date: Date) {
  const stamp = localStamp(date);
  return `${Number(stamp.slice(5, 7))}/${Number(stamp.slice(8, 10))} ${stamp.slice(11)}`;
}
export const eventLabels: Record<NotificationEvent, string> = {
  BOOKING_RECEIVED: "Захиалга хүлээн авлаа",
  BOOKING_CONFIRMED: "Баталгаажлаа",
  BOOKING_CANCELLED: "Цуцлагдлаа",
  BOOKING_RESCHEDULED: "Цаг өөрчлөгдлөө",
};
export function renderNotice(event: NotificationEvent, d: NoticeData) {
  const head = `${d.salonName}: ${when(d.startAt)} ${d.services.join(", ")}`;
  switch (event) {
    case "BOOKING_RECEIVED":
      return [
        `${head} захиалгыг хүлээн авлаа. Баталгаажмагц мэдэгдэнэ.`,
        d.deposit &&
          `Урьдчилгаа ${formatMnt(d.deposit.amountMnt)}: ${d.deposit.bankName} ${d.deposit.accountNumber}.`,
      ]
        .filter(Boolean)
        .join(" ");
    case "BOOKING_CONFIRMED":
      return `${head} захиалга баталгаажлаа. ${d.branchName}.`;
    case "BOOKING_CANCELLED":
      return `${head} захиалга цуцлагдлаа. Лавлах: ${d.salonPhone}.`;
    case "BOOKING_RESCHEDULED":
      return `${d.salonName}: Таны захиалга ${when(d.startAt)} болж өөрчлөгдлөө (${d.services.join(", ")}).`;
  }
}
