-- A starred booking stays with its staff member: the customer asked for them.
ALTER TABLE "Booking" ADD COLUMN "staffLocked" BOOLEAN NOT NULL DEFAULT false;
