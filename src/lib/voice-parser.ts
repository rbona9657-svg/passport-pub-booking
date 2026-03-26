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
 * Supports Hungarian and English.
 *
 * Hungarian examples:
 * - "Vendég neve Kovács Géza 19.00-kor jön március 26-án 24.00-ig maradna hat vendég"
 * - "Foglalás Kiss János névre, 4 fő, holnap 7 órára"
 * - "Szabó Péter, 6 fő, szombaton 8-tól 10-ig"
 */
export function parseBookingFromText(transcript: string): ParsedBooking {
  const text = transcript.toLowerCase().trim();
  const result: ParsedBooking = {};

  // --- NAME EXTRACTION ---
  // Hungarian patterns
  const huNamePatterns = [
    // "vendég neve [Name]" / "neve [Name]" — the name follows the keyword
    /(?:vendég\s+neve|a?\s*neve|név)\s+([a-záéíóöőúüű][a-záéíóöőúüű\s]{1,40}?)(?:\s+\d|,|\.|$|\s+fő|\s+személy|\s+vendég|\s+asztal|\s+holnap|\s+ma\b|\s+jön|\s+érkezik|\s+megy)/i,
    // "[Name] névre" / "[Name] nevére" / "[Name] részére"
    /(?:foglalás\s+)?([a-záéíóöőúüű][a-záéíóöőúüű\s]{1,40}?)\s+(?:névre|nevére|részére)/i,
    // "névre [Name]"
    /(?:névre|nevére)\s+([a-záéíóöőúüű][a-záéíóöőúüű\s]{1,40}?)(?:,|\.|$|\d|\s+fő|\s+személy|\s+vendég)/i,
    // "foglalás [Name]"
    /(?:foglalás|foglalást|rendelés)\s+(?:a\s+)?([a-záéíóöőúüű][a-záéíóöőúüű\s]{1,40}?)(?:\s+(?:névre|nevére|részére)|,|\.|$|\d|\s+fő)/i,
  ];

  // English patterns
  const enNamePatterns = [
    /(?:for|name is|name)\s+([a-z][a-z\s]{1,40}?)(?:,|\.|$|\d| people| person| guest| party| table| at | tomorrow| today| tonight| monday| tuesday| wednesday| thursday| friday| saturday| sunday)/i,
    /(?:reservation|booking)\s+(?:for\s+)?([a-z][a-z\s]{1,40}?)(?:,|\.|$|\d| people| person| guest| party| table| at )/i,
  ];

  const namePatterns = [...huNamePatterns, ...enNamePatterns];

  for (const pattern of namePatterns) {
    const match = transcript.match(pattern);
    if (match) {
      result.name = match[1].trim().replace(/\s+/g, " ");
      // Capitalize each word
      result.name = result.name.replace(/\b\w/g, (c) => c.toUpperCase());
      break;
    }
  }

  // --- GUEST COUNT EXTRACTION ---
  const huNumberWords: Record<string, number> = {
    "egy": 1, "két": 2, "kettő": 2, "három": 3, "négy": 4, "öt": 5,
    "hat": 6, "hét": 7, "nyolc": 8, "kilenc": 9, "tíz": 10,
    "tizenegy": 11, "tizenkét": 12, "tizenkettő": 12, "tizenhárom": 13,
    "tizennégy": 14, "tizenöt": 15,
  };

  const guestPatterns = [
    // Hungarian numeric: "4 fő", "4 személy", "4 vendég", "4 főre"
    /(\d{1,2})\s*(?:fő|főre|főt|személy|személyre|vendég|vendégre|ember|emberre)/i,
    // Hungarian: "4-en", "4-re"
    /(\d{1,2})\s*[-–]?\s*(?:en|an|re|ra|nek|nak)\b/i,
    // English: "4 people", "4 guests"
    /(\d{1,2})\s*(?:people|guests|persons|pax)/i,
    // English: "party of 4"
    /party\s+of\s+(\d{1,2})/i,
    // English: "for 4" / "group of 4"
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

  // Try Hungarian number words if no digit match: "négy fő", "hat vendég"
  if (!result.guestCount) {
    for (const [word, num] of Object.entries(huNumberWords)) {
      const wordPattern = new RegExp(`\\b${word}\\s*(?:fő|főre|főt|személy|személyre|vendég|vendégre|ember|emberre)`, "i");
      if (wordPattern.test(text)) {
        result.guestCount = num;
        break;
      }
    }
  }

  // --- DATE EXTRACTION ---
  const today = new Date();

  // Hungarian month names with day: "március 26-án", "április 5"
  const huMonths: Record<string, number> = {
    "január": 0, "február": 1, "március": 2, "április": 3,
    "május": 4, "június": 5, "július": 6, "augusztus": 7,
    "szeptember": 8, "október": 9, "november": 10, "december": 11,
  };

  const monthPattern = new RegExp(
    `(${Object.keys(huMonths).join("|")})\\s+(\\d{1,2})(?:\\s*[-–.]?\\s*(?:án|én|jén|ján|a|e|je|ja))?`,
    "i"
  );
  const monthMatch = text.match(monthPattern);
  if (monthMatch) {
    const month = huMonths[monthMatch[1].toLowerCase()];
    const day = parseInt(monthMatch[2]);
    if (month !== undefined && day >= 1 && day <= 31) {
      const d = new Date(today.getFullYear(), month, day);
      // If the date has passed this year, use next year
      if (d < today) {
        d.setFullYear(d.getFullYear() + 1);
      }
      result.date = formatDate(d);
    }
  }

  // Hungarian/English date keywords
  if (!result.date) {
    if (/\bma\b|\bma\s+este\b|\bma\s+délután\b/.test(text)) {
      result.date = formatDate(today);
    } else if (/\bholnap\b|\bholnapra\b/.test(text)) {
      const d = new Date(today);
      d.setDate(d.getDate() + 1);
      result.date = formatDate(d);
    } else if (/\bholnapután\b/.test(text)) {
      const d = new Date(today);
      d.setDate(d.getDate() + 2);
      result.date = formatDate(d);
    } else if (/\btoday\b|\btonight\b/.test(text)) {
      result.date = formatDate(today);
    } else if (/\btomorrow\b/.test(text)) {
      const d = new Date(today);
      d.setDate(d.getDate() + 1);
      result.date = formatDate(d);
    }
  }

  // Day name matching (Hungarian + English)
  if (!result.date) {
    const dayNamesHu = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
    const dayNamesEn = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    for (let i = 0; i < 7; i++) {
      const huBase = dayNamesHu[i];
      const huPattern = new RegExp(`\\b${huBase}[a-záéíóöőúüű]*\\b`, "i");
      if (huPattern.test(text) || text.includes(dayNamesEn[i])) {
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

  // --- TIME EXTRACTION ---
  const times: string[] = [];

  // Normalize dots to colons for time parsing: "19.00" → "19:00"
  const normalizedText = text.replace(/(\d{1,2})\.(\d{2})/g, "$1:$2");

  const huTimePatterns = [
    // "19:00-kor", "19:30-ig", "19:00-tól" (after dot→colon normalization)
    /(\d{1,2}):(\d{2})\s*[-–]?\s*(?:kor|ra|re|tól|től|ig|tol|hez|t[öo]l)/gi,
    // "19:00" standalone (24h format)
    /(\d{1,2}):(\d{2})/gi,
    // "7 órára", "7 órakor", "7 órától", "7 óráig"
    /(\d{1,2})\s*(?:órára|órakor|órától|óráig|órátol|oráig|óra)/gi,
    // "7-kor", "7-re", "7-től", "7-ig"
    /(\d{1,2})\s*[-–]\s*(?:kor|ra|re|tól|től|ig|tol|hez)/gi,
    // "7kor" without dash
    /(\d{1,2})\s*(?:kor)\b/gi,
  ];

  for (const pattern of huTimePatterns) {
    let match;
    while ((match = pattern.exec(normalizedText)) !== null) {
      let hour = parseInt(match[1]);
      const minutes = match[2] && !isNaN(parseInt(match[2])) ? match[2] : "00";

      // Handle 24:00 as 00:00 (midnight)
      if (hour === 24) hour = 0;

      // Normalize to pub hours (16:00-02:00) only for small numbers without minutes
      if (hour >= 1 && hour <= 11 && minutes === "00" && !match[2]) {
        if (hour >= 1 && hour <= 6) hour += 12; // 1-6 → afternoon
        if (hour >= 7 && hour <= 11) hour += 12; // 7-11 → evening
      }

      const timeStr = `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      if (!times.includes(timeStr)) {
        times.push(timeStr);
      }
    }
    if (times.length > 0) break;
  }

  // Hungarian number-word times: "héttől", "kilencig", "nyolckor"
  if (times.length === 0) {
    const huTimeWords: Record<string, number> = {
      "egy": 1, "két": 2, "kettő": 2, "három": 3, "négy": 4, "öt": 5,
      "hat": 6, "hét": 7, "nyolc": 8, "kilenc": 9, "tíz": 10,
      "tizenegy": 11, "tizenkét": 12, "tizenkettő": 12,
    };

    // Sort by length descending to match longer words first (e.g. "tizenkét" before "két")
    const sortedWords = Object.entries(huTimeWords).sort(([a], [b]) => b.length - a.length);

    for (const [word, num] of sortedWords) {
      const timeWordPattern = new RegExp(`\\b${word}\\s*(?:órára|órakor|órától|óráig|órátol|oráig|óra|kor|tól|től|ig|ra|re|hez)`, "gi");
      let match;
      while ((match = timeWordPattern.exec(text)) !== null) {
        let hour = num;
        if (hour >= 1 && hour <= 6) hour += 12;
        if (hour >= 7 && hour <= 11) hour += 12;
        const timeStr = `${String(hour).padStart(2, "0")}:00`;
        if (!times.includes(timeStr)) {
          times.push(timeStr);
        }
      }
    }
  }

  // English time patterns (fallback)
  if (times.length === 0) {
    const enTimePatterns = [
      /(?:at\s+)?(\d{1,2}):(\d{2})\s*(am|pm)?/gi,
      /(?:at\s+)?(\d{1,2})\s*(am|pm)/gi,
      /(?:at\s+)(\d{1,2})\s*(?:o'?clock)?/gi,
    ];

    for (const pattern of enTimePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        let hour = parseInt(match[1]);
        const minutes = match[2] && !isNaN(parseInt(match[2])) ? match[2] : "00";
        const ampm = match[3]?.toLowerCase() || match[2]?.toLowerCase();

        if (ampm === "pm" && hour < 12) hour += 12;
        if (ampm === "am" && hour === 12) hour = 0;

        if (!ampm || !["am", "pm"].includes(ampm)) {
          if (hour >= 1 && hour <= 6) hour += 12;
          if (hour >= 7 && hour <= 11) hour += 12;
        }

        const timeStr = `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
        if (!times.includes(timeStr)) {
          times.push(timeStr);
        }
      }
      if (times.length > 0) break;
    }
  }

  if (times.length >= 1) result.arrivalTime = times[0];
  if (times.length >= 2) result.departureTime = times[1];

  // --- TABLE NUMBER EXTRACTION ---
  const tablePatterns = [
    /(?:asztal|asztalt?)\s+(?:szám\s+)?(\d{1,3})/i,
    /(\d{1,3})\s*[-–]?\s*(?:ös|os|es|as|ás|ős)?\s*(?:asztal)/i,
    /table\s+(?:number\s+)?(\d{1,3}|[a-z]\d{0,2})/i,
  ];

  for (const pattern of tablePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.tableNumber = match[1].toUpperCase();
      break;
    }
  }

  return result;
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
