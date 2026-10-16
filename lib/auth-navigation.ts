// Where sign-in may continue: an exact invitation link, or the page that sets
// a new password after a recovery link. Anything else goes home.
export function safeAuthNext(value: unknown) {
  return typeof value === "string" &&
    (/^\/invite\?token=[a-f0-9]{64}$/.test(value) ||
      value === "/reset-password")
    ? value
    : "/";
}
export function roleHome(role: string) {
  return role === "STAFF" ? "/schedules" : "/";
}
