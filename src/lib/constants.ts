/**
 * Day-specific opening hours.
 * Keys: 0 = Sunday … 6 = Saturday (JS Date.getDay() convention).
 * `open`  — first bookable hour
 * `close` — last bookable departure hour (may be past midnight, e.g. "01:00")
 */
export const PUB_SCHEDULE: Record<number, { open: string; close: string }> = {
  0: { open: "16:00", close: "23:00" }, // Sunday
  1: { open: "16:00", close: "00:00" }, // Monday
  2: { open: "16:00", close: "00:00" }, // Tuesday
  3: { open: "16:00", close: "00:00" }, // Wednesday
  4: { open: "16:00", close: "00:00" }, // Thursday
  5: { open: "16:00", close: "01:00" }, // Friday
  6: { open: "16:00", close: "01:00" }, // Saturday
};

/** All distinct time slots used across any day — kept for backwards compat (schema, etc.) */
export const PUB_HOURS = [
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
  "00:00",
  "01:00",
] as const;

/**
 * Return the bookable time slots for a specific day-of-week.
 * `dayOfWeek` uses JS convention: 0 = Sunday … 6 = Saturday.
 */
export function getHoursForDay(dayOfWeek: number): typeof PUB_HOURS[number][] {
  const schedule = PUB_SCHEDULE[dayOfWeek] ?? PUB_SCHEDULE[1]; // fallback to Mon
  const openIdx = PUB_HOURS.indexOf(schedule.open as typeof PUB_HOURS[number]);
  const closeIdx = PUB_HOURS.indexOf(schedule.close as typeof PUB_HOURS[number]);

  if (closeIdx >= openIdx) {
    // Same-day range (e.g. Sunday 16:00–23:00)
    return PUB_HOURS.slice(openIdx, closeIdx + 1) as unknown as typeof PUB_HOURS[number][];
  }
  // Wraps past midnight (e.g. Friday 16:00–01:00)
  return [
    ...PUB_HOURS.slice(openIdx),
    ...PUB_HOURS.slice(0, closeIdx + 1),
  ] as unknown as typeof PUB_HOURS[number][];
}

/**
 * Check whether a time string is a valid bookable slot for the given day.
 */
export function isValidPubHour(time: string, dayOfWeek: number): boolean {
  return (getHoursForDay(dayOfWeek) as string[]).includes(time);
}

export const MIN_BOOKING_DURATION = 1; // hours
export const MAX_BOOKING_DURATION = 6; // hours
export const MAX_SEATS_PER_TABLE = 20;
export const PUB_NAME = "Passport Pub";
export const PUB_URL = "https://www.passportpub.hu/?lang=hu#";

/** Returns today's date as YYYY-MM-DD in local timezone (not UTC). */
export function getLocalToday(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
