-- Platform announcements to every salon, and when each member dismissed them.
ALTER TABLE "SalonMember" ADD COLUMN "noticeSeenAt" TIMESTAMP(3);

CREATE TABLE "PlatformNotice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdById" UUID NOT NULL,
    "emailed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformNotice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformNotice_createdAt_idx" ON "PlatformNotice"("createdAt");

ALTER TABLE "PlatformNotice" ADD CONSTRAINT "PlatformNotice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
