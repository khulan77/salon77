-- Owner calendar: bookings of every branch in a time window.
CREATE INDEX "Booking_salonId_startAt_idx" ON "Booking"("salonId", "startAt");

-- Breaks loaded per working-hours row.
CREATE INDEX "WorkingBreak_workingHoursId_salonId_idx" ON "WorkingBreak"("workingHoursId", "salonId");
