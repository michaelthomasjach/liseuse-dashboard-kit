import * as d3 from "d3";

/** The kit's default locale for dates read by a human: French, like every other default text. */
export const DEFAULT_DATE_LOCALE = "fr-FR";

/** "01 juin 2026" — day, short month, year, in `locale`. The default date format of the charts
 *  (it used to be d3's `%d %b %Y`, whose month names are English only). */
export function dayMonthYearFormat(locale: string = DEFAULT_DATE_LOCALE): (date: Date) => string {
  // One function per locale, kept: callers use it as an effect/memo dependency, and a fresh one per
  // render would re-run all of them.
  let cached = dayMonthYearCache.get(locale);
  if (cached === undefined) {
    const format = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" });
    cached = (date) => format.format(date);
    dayMonthYearCache.set(locale, cached);
  }
  return cached;
}
const dayMonthYearCache = new Map<string, (date: Date) => string>();

/** A time-axis tick format in `locale`, stepping up the way d3's own default multi-scale format
 *  does — the time of day inside a day, "3 juin" inside a month, "juin" on the first of a month,
 *  "2026" on the first of a year — without d3's English month and weekday names. */
export function timeTickFormat(locale: string = DEFAULT_DATE_LOCALE): (date: Date) => string {
  const cached = timeTickCache.get(locale);
  if (cached !== undefined) return cached;
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const month = new Intl.DateTimeFormat(locale, { month: "short" });
  const year = new Intl.DateTimeFormat(locale, { year: "numeric" });
  const tick = (date: Date) => {
    if (d3.timeDay(date) < date) return time.format(date);
    if (d3.timeMonth(date) < date) return day.format(date);
    if (d3.timeYear(date) < date) return month.format(date);
    return year.format(date);
  };
  timeTickCache.set(locale, tick);
  return tick;
}
const timeTickCache = new Map<string, (date: Date) => string>();
