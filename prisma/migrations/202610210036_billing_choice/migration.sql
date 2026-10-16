-- What the owner chose as the free trial ends: keep paying or stop.
CREATE TYPE "RenewalChoice" AS ENUM ('CONTINUE', 'STOP');
ALTER TABLE "Salon" ADD COLUMN "renewalChoice" "RenewalChoice",
  ADD COLUMN "renewalChosenAt" TIMESTAMPTZ(3);
