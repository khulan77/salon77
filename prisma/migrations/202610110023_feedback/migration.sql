-- Requests from salons to the platform operator: bugs, suggestions, questions.
CREATE TYPE "FeedbackKind" AS ENUM ('BUG', 'SUGGESTION', 'QUESTION');
CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'DONE');
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "FeedbackKind" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Feedback_message_check" CHECK (char_length("message") BETWEEN 1 AND 2000),
    CONSTRAINT "Feedback_reply_check" CHECK ("reply" IS NULL OR char_length("reply") <= 2000)
);
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");
CREATE INDEX "Feedback_salonId_createdAt_idx" ON "Feedback"("salonId", "createdAt");
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Feedback" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "Feedback" FROM anon, authenticated;
