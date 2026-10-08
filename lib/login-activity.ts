import { db } from "./db";
// Best effort: a failed write must never block signing in.
export async function recordLogin(userId: string) {
  try {
    await db.user.updateMany({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  } catch {
    console.error("Salon77 login activity was not recorded");
  }
}
