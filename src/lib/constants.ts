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
  "02:00",
] as const;

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
