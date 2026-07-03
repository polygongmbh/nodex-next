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

export function formatTimelineTimestamp(
  date: Date,
  locale?: string,
  now: Date = new Date()
): string {
  const dayDelta = calendarDayDelta(now, date);
  if (dayDelta <= 0) {
    return formatTime(date, locale);
  }
  if (dayDelta === 1) {
    const yesterday = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day");
    return `${yesterday} ${formatTime(date, locale)}`;
  }
  if (monthDelta(now, date) >= 10) {
    return new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(date);
  }
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
}
