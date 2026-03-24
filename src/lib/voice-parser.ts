export interface ParsedBooking {
  name?: string;
  guestCount?: number;
  date?: string;
  arrivalTime?: string;
  departureTime?: string;
  tableNumber?: string;
  comment?: string;
}

/**
 * Parse natural language transcript into booking fields.
 *
 * Examples:
 * - "Book a table for John Smith, 4 people, tomorrow at 7pm, table 5"
 * - "Reservation for Maria, party of 6, tonight at 8, table 12"
 * - "Name is Alex, 2 guests, Saturday at 9pm"
 */
export function parseBookingFromText(transcript: string): ParsedBooking {
  const text = transcript.toLowerCase().trim();
  const result: ParsedBooking = {};

  // Extract name
  // Patterns: "for [Name]", "name is [Name]", "name [Name]", "reservation [Name]"
  const namePatterns = [
    /(?:for|name is|name)\s+([a-z][a-z\s]{1,40}?)(?:,|\.|$|\d| people| person| guest| party| table| at | tomorrow| today| tonight| monday| tuesday| wednesday| thursday| friday| saturday| sunday)/i,
    /(?:reservation|booking)\s+(?:for\s+)?([a-z][a-z\s]{1,40}?)(?:,|\.|$|\d| people| person| guest| party| table| at )/i,
  ];

  for (const pattern of namePatterns) {
    const match = transcript.match(pattern);
    if (match) {
      result.name = match[1].trim().replace(/\s+/g, " ");
      // Capitalize each word
      result.name = result.name.replace(/\b\w/g, (c) => c.toUpperCase());
      break;
    }
  }

  // Extract guest count
  // Patterns: "[N] people", "[N] guests", "party of [N]", "[N] persons"
  const guestPatterns = [
    /(\d{1,2})\s*(?:people|guests|persons|pax)/i,
    /party\s+of\s+(\d{1,2})/i,
    /(?:for|group of)\s+(\d{1,2})(?:\s|,|$)/i,
  ];

  for (const pattern of guestPatterns) {
    const match = text.match(pattern);
    if (match) {
      const count = parseInt(match[1]);
      if (count >= 1 && count <= 20) {
        result.guestCount = count;
      }
      break;
    }
  }

  // Extract date
  // Patterns: "today", "tomorrow", "tonight", day names, "March 25th"
  const today = new Date();

  if (/\btoday\b|\btonight\b/.test(text)) {
    result.date = formatDate(today);
  } else if (/\btomorrow\b/.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    result.date = formatDate(d);
  } else {
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    for (let i = 0; i < dayNames.length; i++) {
      if (text.includes(dayNames[i])) {
        const d = new Date(today);
        const currentDay = d.getDay();
        let daysUntil = i - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        d.setDate(d.getDate() + daysUntil);
        result.date = formatDate(d);
        break;
      }
    }
  }

  // Extract time
  // Patterns: "at [N]", "[N] pm", "[N] am", "[N] o'clock", "[N]:[MM]"
  const timePatterns = [
    /(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?/gi,
    /(?:at\s+)?(\d{1,2})\s*(am|pm)/gi,
    /(?:at\s+)(\d{1,2})\s*(?:o'?clock)?/gi,
  ];

  const times: string[] = [];
  for (const pattern of timePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let hour = parseInt(match[1]);
      const minutes = match[2] && !isNaN(parseInt(match[2])) ? match[2] : "00";
      const ampm = match[3]?.toLowerCase() || match[2]?.toLowerCase();

      if (ampm === "pm" && hour < 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;

      // If no am/pm, assume pub hours (afternoon/evening)
      if (!ampm || (!["am", "pm"].includes(ampm))) {
        if (hour >= 1 && hour <= 6) hour += 12; // 1-6 → 13-18 (afternoon)
        if (hour >= 7 && hour <= 11) hour += 12; // 7-11 → 19-23 (evening) — only if said "at 7" without am/pm
      }

      const timeStr = `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      if (!times.includes(timeStr)) {
        times.push(timeStr);
      }
    }
    if (times.length > 0) break;
  }

  if (times.length >= 1) result.arrivalTime = times[0];
  if (times.length >= 2) result.departureTime = times[1];

  // Extract table number
  const tableMatch = text.match(/table\s+(?:number\s+)?(\d{1,3}|[a-z]\d{0,2})/i);
  if (tableMatch) {
    result.tableNumber = tableMatch[1].toUpperCase();
  }

  return result;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}
