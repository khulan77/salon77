-- When the platform operator first opened a feedback request; null = unread.
ALTER TABLE "Feedback" ADD COLUMN "readAt" TIMESTAMP(3);
-- Requests that existed before read tracking count as read.
UPDATE "Feedback" SET "readAt" = "createdAt";
CREATE INDEX "Feedback_readAt_idx" ON "Feedback"("readAt");
