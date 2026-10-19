import { db } from "./db";
import {
  createNotice,
  noticeRecipients,
  recordEmailed,
} from "./services/notices";
import { notifyNotice } from "./notifications/platform-email";
// Saves an announcement for every salon dashboard and emails the owners
// when mail to them is set up.
export async function announce(adminUserId: string, raw: unknown) {
  const notice = await createNotice(db, adminUserId, raw);
  const emailing = notifyNotice(notice, await noticeRecipients(db), (sent) =>
    recordEmailed(db, notice.id, sent),
  );
  return { ...notice, emailing };
}
