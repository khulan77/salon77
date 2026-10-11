import { z } from "zod";
// Shared by the salon's request form and the platform inbox.
export const FEEDBACK_KINDS = {
  BUG: "Алдаа, засвар",
  SUGGESTION: "Санал",
  QUESTION: "Асуулт",
} as const;
export type FeedbackKind = keyof typeof FEEDBACK_KINDS;
export const feedbackKinds = Object.keys(FEEDBACK_KINDS) as FeedbackKind[];
export const feedbackInput = z
  .object({
    kind: z.enum(feedbackKinds),
    message: z
      .string()
      .trim()
      .min(5, "Хүсэлтээ арай дэлгэрэнгүй бичнэ үү.")
      .max(2000, "Хүсэлт 2000 тэмдэгтээс ихгүй байна."),
  })
  .strict();
export const feedbackAnswer = z
  .object({
    status: z.enum(["OPEN", "DONE"]),
    reply: z
      .string()
      .trim()
      .max(2000, "Хариу 2000 тэмдэгтээс ихгүй байна.")
      .default(""),
  })
  .strict();
