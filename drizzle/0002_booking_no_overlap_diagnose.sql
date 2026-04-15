-- 0002_booking_no_overlap_diagnose.sql
-- Find overlapping bookings on the same table+date where both are active (pending/approved).
-- Handles midnight-crossing slots (departure_time <= arrival_time means next-day end).

WITH normalised AS (
  SELECT
    id, table_id, booking_date, reservation_name,
    arrival_time, departure_time, status, created_at,
    -- anchor times to a fake date so midnight-crossing works
    ('2000-01-01 ' || arrival_time)::timestamp AS t_from,
    CASE
      WHEN departure_time <= arrival_time          -- crosses midnight
      THEN ('2000-01-02 ' || departure_time)::timestamp
      ELSE ('2000-01-01 ' || departure_time)::timestamp
    END AS t_to
  FROM bookings
  WHERE status IN ('pending','approved')
)
SELECT
  a.id            AS booking_a_id,
  b.id            AS booking_b_id,
  a.table_id,
  a.booking_date,
  a.reservation_name AS name_a,
  b.reservation_name AS name_b,
  a.arrival_time  AS a_from,  a.departure_time AS a_to,
  b.arrival_time  AS b_from,  b.departure_time AS b_to,
  a.status AS status_a,
  b.status AS status_b,
  a.created_at AS created_a,
  b.created_at AS created_b
FROM normalised a
JOIN normalised b
  ON  a.table_id     = b.table_id
  AND a.booking_date = b.booking_date
  AND a.id           < b.id
  AND a.t_from       < b.t_to
  AND b.t_from       < a.t_to
ORDER BY a.booking_date, a.table_id, a.arrival_time;
