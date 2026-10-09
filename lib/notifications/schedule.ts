import { after } from "next/server";
import { db } from "../db";
import { smsProvider } from "./provider";
import { processNotifications } from "./dispatch";
// Deliver queued notices after the response so customers never wait on SMS.
export function deliverSoon() {
  after(async () => {
    try {
      await processNotifications(db, smsProvider());
    } catch {
      console.error("Salon77 notification delivery failed");
    }
  });
}
