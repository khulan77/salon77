// Delivery is pluggable: SMS_PROVIDER picks one of the providers below.
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
// Generic HTTP gateway. TODO: once a gateway is chosen, match its request
// body, auth header and response fields; the shape below is a placeholder,
// not any specific company's API.
function httpProvider(url: string, apiKey: string, sender: string) {
  return {
    name: "http",
    async send(to, body) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ to, from: sender, text: body }),
        signal: AbortSignal.timeout(10000),
      });
      // Stored in the owner's notification log, so it stays in Mongolian.
      if (!response.ok)
        throw new Error(`Мессеж илгээгч алдаа буцаалаа (${response.status}).`);
      const data = await response.json().catch(() => null);
      const id = data?.messageId ?? data?.id;
      return { messageId: id == null ? undefined : String(id) };
    },
  } satisfies SmsProvider;
}
export function smsProvider(): SmsProvider | null {
  switch (process.env.SMS_PROVIDER) {
    case "log":
      return logProvider;
    case "http": {
      const url = process.env.SMS_HTTP_URL,
        apiKey = process.env.SMS_HTTP_API_KEY,
        sender = process.env.SMS_SENDER;
      return url && apiKey && sender ? httpProvider(url, apiKey, sender) : null;
    }
    default:
      return null;
  }
}
// True only when customers actually receive messages. Pages use it to keep
// SMS promises off the screen while delivery is off or only logged.
export function smsDelivers() {
  const provider = smsProvider();
  return provider !== null && provider.name !== "log";
}
