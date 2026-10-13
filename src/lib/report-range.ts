// Date ranges for reports, worked out in the shop's own time zone (a month starts at the shop's midnight, not UTC's).
// Plain functions with no imports so they can be tested on their own.

export const REPORT_PERIODS = ["this-month", "last-month", "ytd", "last-year", "custom"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  ytd: "Year to date",
  "last-year": "Last year",
  custom: "Custom range",
};

/** The shop's local calendar day for an instant, as numbers. */
function localParts(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Minutes the zone is ahead of UTC at a given instant (negative west of Greenwich). */
function offsetMinutes(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(instant / 1000) * 1000) / 60000);
}

/** The instant the shop's local calendar day (y, m, d) begins. Month and day may overflow (month 13 = January next year). */
export function localMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  let instant = guess - offsetMinutes(guess, timeZone) * 60000;
  // the offset can differ on the day itself (a clock change): settle on the one that applies at the result
  instant = guess - offsetMinutes(instant, timeZone) * 60000;
  return new Date(instant);
}

export function resolveRange(period: ReportPeriod, from: string | undefined, to: string | undefined, timeZone: string, nowMs: number): { start: Date; end: Date; label: string } | { error: string } {
  const today = localParts(nowMs, timeZone);
  const { year, month } = today;
  switch (period) {
    case "this-month":
      return { start: localMidnight(year, month, 1, timeZone), end: localMidnight(year, month + 1, 1, timeZone), label: "This month" };
    case "last-month":
      return { start: localMidnight(year, month - 1, 1, timeZone), end: localMidnight(year, month, 1, timeZone), label: "Last month" };
    case "ytd":
      return { start: localMidnight(year, 1, 1, timeZone), end: localMidnight(year, month, today.day + 1, timeZone), label: "Year to date" };
    case "last-year":
      return { start: localMidnight(year - 1, 1, 1, timeZone), end: localMidnight(year, 1, 1, timeZone), label: "Last year" };
    case "custom": {
      const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
      if (!ok(from) || !ok(to)) return { error: "Pick a start and an end date." };
      const [fy, fm, fd] = from!.split("-").map(Number);
      const [ty, tm, td] = to!.split("-").map(Number);
      const start = localMidnight(fy, fm, fd, timeZone);
      const end = localMidnight(ty, tm, td + 1, timeZone);
      if (!(end.getTime() > start.getTime())) return { error: "The end date has to be on or after the start date." };
      return { start, end, label: `${from} to ${to}` };
    }
  }
}
