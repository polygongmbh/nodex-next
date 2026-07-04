// Timeline timestamp format, ported from nodex: time today, "yesterday HH:MM",
// month+day within ~10 months, short date beyond.

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function calendarDayDelta(now: Date, date: Date): number {
  return Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
}

function monthDelta(now: Date, date: Date): number {
  return (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
}

function formatTime(date: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date);
}

export type TimestampBucket = "time" | "yesterday" | "monthDay" | "shortDate";

/**
 * Locale-independent bucket decision — the cross-client contract (see
 * spec/vectors/timestamps.json); rendering per bucket is locale-specific.
 */
export function timelineTimestampBucket(date: Date, now: Date): TimestampBucket {
  const dayDelta = calendarDayDelta(now, date);
  if (dayDelta <= 0) return "time";
  if (dayDelta === 1) return "yesterday";
  if (monthDelta(now, date) >= 10) return "shortDate";
  return "monthDay";
}

export function formatTimelineTimestamp(
  date: Date,
  locale?: string,
  now: Date = new Date()
): string {
  switch (timelineTimestampBucket(date, now)) {
    case "time":
      return formatTime(date, locale);
    case "yesterday": {
      const yesterday = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day");
      return `${yesterday} ${formatTime(date, locale)}`;
    }
    case "shortDate":
      return new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(date);
    case "monthDay":
      return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
  }
}
