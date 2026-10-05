export async function requestJson<T = { success: boolean }>(
  url: string,
  method: string,
  data?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "Хүсэлт амжилтгүй боллоо. Дахин оролдоно уу.",
    );
  return result as T;
}
