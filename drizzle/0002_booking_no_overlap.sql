-- 0002_booking_no_overlap.sql
-- Add an exclusion constraint to prevent overlapping active bookings
-- on the same table + date.  Requires the btree_gist extension.
-- Handles midnight-crossing slots (departure_time <= arrival_time).

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Immutable helper: converts arrival/departure TIME pair into a tsrange,
-- pushing departure to the next day when it crosses midnight.
CREATE OR REPLACE FUNCTION booking_time_range(arr time, dep time)
RETURNS tsrange
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT tsrange(
    ('2000-01-01 ' || arr)::timestamp,
    CASE WHEN dep <= arr
         THEN ('2000-01-02 ' || dep)::timestamp
         ELSE ('2000-01-01 ' || dep)::timestamp
    END
  )
$$;

ALTER TABLE bookings
  ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    table_id     WITH =,
    booking_date WITH =,
    booking_time_range(arrival_time, departure_time) WITH &&
  )
  WHERE (status IN ('pending','approved'));
