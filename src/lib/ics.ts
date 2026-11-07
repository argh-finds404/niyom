/** Escapes text for an iCalendar property value (RFC 5545 §3.3.11). */
function esc(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/** Folds lines longer than 75 octets, as calendar clients require. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

/**
 * An all-day calendar event for a deadline, with a reminder three days before.
 * DTEND is the day after (all-day events are end-exclusive).
 */
export function buildDeadlineIcs({
  uid,
  title,
  date,
  description,
  url,
  now = new Date(),
}: {
  uid: string;
  title: string;
  date: string;
  description: string;
  url?: string;
  now?: Date;
}): string {
  const day = date.replace(/-/g, "");
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = next.toISOString().slice(0, 10).replace(/-/g, "");
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NIYOM//Readiness ledger//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${esc(title)}`,
    `DESCRIPTION:${esc(description)}`,
    ...(url ? [`URL:${url}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-P3D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(`3 days left: ${title}`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
