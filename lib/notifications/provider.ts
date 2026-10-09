// Delivery is pluggable: add a real SMS gateway here once one is chosen.
export type SmsProvider = {
  name: string;
  send(to: string, body: string): Promise<{ messageId?: string }>;
};
// Development stand-in: writes a masked line to the server log, sends nothing.
const logProvider: SmsProvider = {
  name: "log",
  async send(to, body) {
    console.info(
      `[sms:log] ${to.slice(0, -4).replace(/\d/g, "•")}${to.slice(-4)} · ${body.length} тэмдэгт`,
    );
    return { messageId: `log-${Date.now()}` };
  },
};
export function smsProvider(): SmsProvider | null {
  switch (process.env.SMS_PROVIDER) {
    case "log":
      return logProvider;
    default:
      return null;
  }
}
