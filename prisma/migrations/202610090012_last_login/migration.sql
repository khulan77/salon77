-- Additive: recorded on each successful sign-in; null until the next login.
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
