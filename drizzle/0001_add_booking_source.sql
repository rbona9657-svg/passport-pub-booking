-- Add booking source enum and column
CREATE TYPE "booking_source" AS ENUM ('online', 'phone', 'voice');
ALTER TABLE "bookings" ADD COLUMN "source" "booking_source" DEFAULT 'online';
