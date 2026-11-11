// -----------------------------------------------------------------------------
// Calendar days, in the household's time zone.
//
// Melimelo speaks in days — a task due on the 12th, the bins collected on the
// 13th, a birthday on the 14th — and so do the triggers: "today", "tomorrow",
// "in 3 days". The container clock runs in UTC, so a household in Paris would
// see "tomorrow" begin at 1 a.m. Every comparison goes through the calendar
// date of the configured time zone instead.
// -----------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether the runtime knows this IANA time zone (e.g. `Europe/Paris`). */
export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

function parts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
}

/** The calendar date `YYYY-MM-DD` of an instant, in a time zone. */
export function localDate(date, timeZone) {
  const { year, month, day } = parts(date, timeZone);
  return `${year}-${month}-${day}`;
}

/** The hour (0-23) of an instant, in a time zone. */
export function localHour(date, timeZone) {
  return Number(parts(date, timeZone).hour);
}

/** The time `HH:MM` of an instant, in a time zone. */
export function localTime(date, timeZone) {
  const { hour, minute } = parts(date, timeZone);
  return `${hour}:${minute}`;
}

/** `YYYY-MM-DD` shifted by a number of days (calendar arithmetic, no time zone involved). */
export function addDays(day, days) {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, date) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to`, both `YYYY-MM-DD` (negative when `to` is earlier). */
export function daysBetween(from, to) {
  const toUtc = (day) => {
    const [year, month, date] = day.split('-').map(Number);
    return Date.UTC(year, month - 1, date);
  };
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

/** Whether a string is a valid `YYYY-MM-DD` calendar date. */
export function isDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, date] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1;
}

/**
 * The calendar date of a value the API may send as `YYYY-MM-DD` or as a full
 * ISO date-time; `null` for anything else.
 */
export function toDay(value, timeZone) {
  if (isDay(value)) return value;
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : localDate(date, timeZone);
}
