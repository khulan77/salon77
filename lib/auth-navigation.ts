export function safeAuthNext(value: unknown) {
  return typeof value === "string" &&
    /^\/invite\?token=[a-f0-9]{64}$/.test(value)
    ? value
    : "/";
}
export function roleHome(role: string) {
  return role === "STAFF" ? "/schedules" : "/";
}
