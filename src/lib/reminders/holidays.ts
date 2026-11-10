/**
 * Kuala Lumpur (Wilayah Persekutuan) public holidays, used to hold reminders until the next working day.
 * Admins can edit the list in Settings (one "yyyy-MM-dd Name" per line); this is the starting list.
 *
 * 2026: from the published federal + Wilayah Persekutuan list. 2027: base dates agree across public listings of the
 * JPM table (kabinet.gov.my/storage/2026/08/HKA_2027.pdf); replacement days follow the Holidays Act rule that a
 * holiday on a Sunday moves to Monday (or the next free day). Islamic dates depend on moon sighting, so check them
 * against the official announcement and correct them in Settings.
 */
export const DEFAULT_PUBLIC_HOLIDAYS = `2026-01-01 New Year's Day
2026-02-01 Thaipusam
2026-02-01 Federal Territory Day
2026-02-02 Thaipusam (replacement)
2026-02-03 Federal Territory Day (replacement)
2026-02-17 Chinese New Year
2026-02-18 Chinese New Year (day 2)
2026-03-07 Nuzul Al-Quran
2026-03-20 Hari Raya Aidilfitri (additional)
2026-03-21 Hari Raya Aidilfitri
2026-03-22 Hari Raya Aidilfitri (day 2)
2026-03-23 Hari Raya Aidilfitri (replacement)
2026-05-01 Labour Day
2026-05-27 Hari Raya Haji
2026-05-31 Wesak Day
2026-06-01 Agong's Birthday
2026-06-02 Wesak Day (replacement)
2026-06-17 Awal Muharram
2026-08-25 Maulidur Rasul
2026-08-31 National Day
2026-09-16 Malaysia Day
2026-11-08 Deepavali
2026-11-09 Deepavali (replacement)
2026-12-25 Christmas Day
2027-01-01 New Year's Day
2027-01-22 Thaipusam
2027-02-01 Federal Territory Day
2027-02-06 Chinese New Year
2027-02-07 Chinese New Year (day 2)
2027-02-08 Chinese New Year (replacement)
2027-02-24 Nuzul Al-Quran
2027-03-10 Hari Raya Aidilfitri
2027-03-11 Hari Raya Aidilfitri (day 2)
2027-05-01 Labour Day
2027-05-17 Hari Raya Haji
2027-05-20 Wesak Day
2027-06-06 Awal Muharram
2027-06-07 Agong's Birthday
2027-06-08 Awal Muharram (replacement)
2027-08-15 Maulidur Rasul
2027-08-16 Maulidur Rasul (replacement)
2027-08-31 National Day
2027-09-16 Malaysia Day
2027-10-28 Deepavali
2027-12-25 Christmas Day`;

export type Holiday = { date: string; name: string };

/** Parses "yyyy-MM-dd Name" lines; blank lines and lines starting with # are ignored. Throws on a bad line. */
export function parseHolidays(text: string): Holiday[] {
  const out: Holiday[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;
    const m = /^(\d{4}-\d{2}-\d{2})\s*(.*)$/.exec(line);
    if (!m || Number.isNaN(Date.parse(`${m[1]}T00:00:00Z`))) throw new Error(`Line ${i + 1}: start with a date like 2027-03-10.`);
    out.push({ date: m[1], name: m[2].trim() || "Public holiday" });
  });
  return out;
}

/** The set of holiday dates, ignoring any malformed lines (sending must never stop over a typo). */
export function holidayDates(text: string): Set<string> {
  const dates = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*(\d{4}-\d{2}-\d{2})/.exec(line);
    if (m) dates.add(m[1]);
  }
  return dates;
}
