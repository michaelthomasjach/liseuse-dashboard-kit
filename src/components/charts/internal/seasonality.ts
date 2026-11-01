import type { Candle } from "../CandlestickChart";

/** How the reference year is sliced into buckets — "day" is the finest and what SeasonalityView
 *  actually renders with today (a real per-trading-day curve, not smoothed away — every trading
 *  session gets its own bucket, indexed by its ordinal position within its own year rather than
 *  its calendar date, see `computeSeasonality`'s own doc for why). */
export type SeasonalityGranularity = "day" | "week" | "month" | "quarter" | "year";

/** One year's own contribution to a bucket — kept around (not collapsed into just the average)
 *  so future features can be built as pure consumption of this same shape, without touching the
 *  engine's own traversal logic: dispersion bands and individual-occurrence overlays both just
 *  read this array directly, a weighted average re-weights it instead of `average`'s plain mean,
 *  and an automatic filter (e.g. dropping outlier years) can prune it before averaging. */
export interface SeasonalityOccurrence {
  year: number;
  /** % change from that year's own reference (its first available close, at or after Jan 1) to
   *  this bucket's own representative close (its last available one, at or before the bucket's
   *  end) — a cumulative "how far is the typical year at this point" reading, not a
   *  bucket-over-bucket delta. */
  value: number;
}

export interface SeasonalityBucket {
  /** 0-based position within the reference year — 0-364 for "day" (a trading-day *ordinal*, e.g.
   *  index 20 is every included year's own 21st trading session, not its own Jan 21), 0-51 for
   *  "week", 0-11 for "month", 0-3 for "quarter", always 0 for "year" (a single bucket covering
   *  the whole thing) — except -1, the synthetic "start of year" reference bucket every included
   *  year gets an
   *  `average`/every own `occurrences[].value` of exactly 0 at (see `computeSeasonality`'s own
   *  doc), so every line visibly starts from the same shared anchor instead of wherever its own
   *  first real bucket happens to already be. */
  index: number;
  /** Display label, e.g. "Semaine 12", "Mars", "T2", "Année". */
  label: string;
  /** Plain arithmetic mean of `occurrences[].value` — deliberately not configurable (weighting is
   *  a listed future extension, see `SeasonalityOccurrence`'s own doc comment) so this stays a
   *  pure, obvious "average of what's there" today. One exception, "day" only: a year that has
   *  already finished counts at its year-end value in the ordinals past its last session, so the
   *  tail of December is not averaged over a different set of years (see `computeSeasonality`). */
  average: number;
  occurrences: SeasonalityOccurrence[];
}

export interface SeasonalityResult {
  granularity: SeasonalityGranularity;
  /** Only buckets at least one included year actually has data for — a bucket past the end of
   *  the current (incomplete) year, say, is simply absent rather than showing as a false zero. */
  buckets: SeasonalityBucket[];
  /** Years that contributed at least one occurrence, ascending — not necessarily every year
   *  present in `data`, since `excludedYears` can drop some and a year with no candles at all
   *  (shouldn't happen, but isn't assumed) contributes none either. */
  years: number[];
}

const DAY_BUCKET_COUNT = 365;
const WEEK_BUCKET_COUNT = 52;
const MONTH_LABELS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

// Shared by "week" bucketing below (see bucketIndexFor) — a date's own 0-based offset from Jan 1
// of its *own* year (so Dec 31 of a leap year is 365, folded down to the last bucket by each
// caller rather than getting a sparse 366th bucket only leap years could ever contribute to).
// NOT used for "day" bucketing (see the main loop below) — that one buckets by each year's own
// trading-day ordinal instead of a calendar offset, precisely to avoid the same cross-year
// misalignment this calendar-based helper would otherwise reintroduce there.
function dayOfYear(date: Date): number {
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((today - yearStart) / 86_400_000);
}

function bucketCountFor(granularity: SeasonalityGranularity): number {
  switch (granularity) {
    case "day":
      return DAY_BUCKET_COUNT;
    case "week":
      return WEEK_BUCKET_COUNT;
    case "month":
      return 12;
    case "quarter":
      return 4;
    case "year":
      return 1;
  }
}

// Not called for "day" (see the main loop's own trading-day-ordinal handling below).
function bucketIndexFor(date: Date, granularity: Exclude<SeasonalityGranularity, "day">): number {
  switch (granularity) {
    case "week":
      // A leap-ish 53rd week's worth of overflow days folds into the last bucket instead of
      // getting a sparse bucket of its own that only a handful of years could ever contribute to.
      return Math.min(Math.floor(dayOfYear(date) / 7), WEEK_BUCKET_COUNT - 1);
    case "month":
      return date.getUTCMonth();
    case "quarter":
      return Math.floor(date.getUTCMonth() / 3);
    case "year":
      return 0;
  }
}

function bucketLabel(index: number, granularity: SeasonalityGranularity): string {
  switch (granularity) {
    case "day":
      return `Jour ${index + 1}`;
    case "week":
      return `Semaine ${index + 1}`;
    case "month":
      return MONTH_LABELS[index];
    case "quarter":
      return `T${index + 1}`;
    case "year":
      return "Année";
  }
}

/**
 * Aggregates `data` into an average seasonal path across its own historical years — pure,
 * independent of any rendering: takes candles and a config, returns numbers. Each included year
 * is one "occurrence": rebased to a % change from its own first available close (so years at very
 * different price levels still compare on equal footing, same rebasing idea `CandlestickChart`'s
 * own symbol-overlay comparison uses), then read off at each bucket's own last available close
 * within it — except "day", read off at each bucket's own trading-day *ordinal* within that year
 * instead (see the main loop below for why: a calendar day-of-year offset lands on a different
 * weekday every year, so on any given calendar-day bucket only *some* years have an actual
 * trading session there, and which ones rotates from one calendar day to the next. Averaging
 * whichever years happen to have data at each individual calendar offset — instead of comparing
 * the same years' Nth trading day to each other — silently swapped in and out very differently-
 * positioned years bucket to bucket, producing sharp, meaningless day-to-day swings with no real
 * seasonal signal behind them). `average` is the plain mean of every year's own value at that
 * bucket — see
 * `SeasonalityOccurrence`'s doc comment for how future features (dispersion bands, individual
 * occurrences, weighted averages, automatic filters) are meant to build on the same `occurrences`
 * array instead of changing this traversal.
 *
 * `buckets[0]` (the earliest real bucket some year actually has data for) is *not* necessarily
 * every included year's own 0% starting point — it's already that year's cumulative change by the
 * end of that bucket, which is rarely exactly 0. Without an explicit anchor, every line would
 * appear to "start" wherever its own first real bucket already happens to be (visibly already up
 * or down), with no shared reference the way every year trivially shares one at its own true
 * start. A synthetic bucket at index -1 is prepended for that: every year that contributed at
 * least one real occurrence gets an entry there too, always exactly 0 by construction (it *is*
 * each year's own reference point, divided by itself) — so every line visibly starts from the same
 * shared (-1, 0%) anchor before diverging into its own real buckets. Skipped for "year"
 * granularity, whose single real bucket is meant to read as one summary number, not a line.
 */
export function computeSeasonality(
  data: Candle[],
  granularity: SeasonalityGranularity,
  excludedYears?: ReadonlySet<number> | number[]
): SeasonalityResult {
  const excluded = excludedYears instanceof Set ? excludedYears : new Set(excludedYears ?? []);

  // Grouped by year first (not bucketed directly) since each year needs its own reference (its
  // own first close) before any of its candles can be turned into a bucket value.
  const byYear = new Map<number, Candle[]>();
  for (const candle of data) {
    const year = candle.date.getUTCFullYear();
    if (excluded.has(year)) continue;
    const forYear = byYear.get(year);
    if (forYear) forYear.push(candle);
    else byYear.set(year, [candle]);
  }

  const bucketCount = bucketCountFor(granularity);
  const occurrencesByBucket: SeasonalityOccurrence[][] = Array.from({ length: bucketCount }, () => []);
  const contributingYears = new Set<number>();
  // "day" only: where each finished year's sessions stop, and the value it stopped at — see the
  // carry-forward in the averaging loop below.
  const latestYear = Math.max(...byYear.keys());
  const finishedYearEnds: { lastIndex: number; value: number }[] = [];

  for (const [year, candles] of byYear) {
    if (candles.length === 0) continue;
    const reference = candles[0].close;
    if (reference === 0) continue;

    if (granularity === "day") {
      // Each year's own trading-day ordinal (0 = its own reference candle, 1 = the next session,
      // …) rather than a calendar day-of-year offset — see this function's own doc comment for
      // why. Every candle already lands in its own bucket this way (one session per index), so
      // unlike the coarser granularities below there's no "several candles, same bucket" case to
      // collapse via a last-one-wins map.
      candles.forEach((candle, i) => {
        const idx = Math.min(i, DAY_BUCKET_COUNT - 1);
        occurrencesByBucket[idx].push({ year, value: ((candle.close / reference) - 1) * 100 });
      });
      contributingYears.add(year);
      const last = candles[candles.length - 1];
      const finished = year < latestYear || (last.date.getUTCMonth() === 11 && last.date.getUTCDate() >= 24);
      if (finished) {
        finishedYearEnds.push({ lastIndex: Math.min(candles.length - 1, DAY_BUCKET_COUNT - 1), value: ((last.close / reference) - 1) * 100 });
      }
      continue;
    }

    // Last candle seen (candles are date-ordered, same assumption every date-indexed feature in
    // this library already makes) within each bucket is that bucket's own representative close.
    const lastCloseByBucket = new Map<number, number>();
    for (const candle of candles) {
      lastCloseByBucket.set(bucketIndexFor(candle.date, granularity), candle.close);
    }
    for (const [idx, close] of lastCloseByBucket) {
      occurrencesByBucket[idx].push({ year, value: ((close / reference) - 1) * 100 });
      contributingYears.add(year);
    }
  }

  const buckets: SeasonalityBucket[] = [];
  // Every contributing year is 0% at its own true start, by construction — see this function's
  // own doc comment for why that needs an explicit bucket rather than relying on `buckets[0]`.
  if (granularity !== "year" && contributingYears.size > 0) {
    const referenceOccurrences = Array.from(contributingYears)
      .sort((a, b) => a - b)
      .map((year) => ({ year, value: 0 }));
    buckets.push({ index: -1, label: "Réf.", average: 0, occurrences: referenceOccurrences });
  }
  for (let idx = 0; idx < bucketCount; idx++) {
    const occurrences = occurrencesByBucket[idx];
    if (occurrences.length === 0) continue;
    // Years do not all have the same number of sessions (252, 253, sometimes 251). On a plain mean
    // the last bucket or two were averaged over the few years that happened to have an extra
    // session — a different set of years from the bucket before — and the line plunged or jumped
    // on the last session of December. A year that has *finished* stays at its year-end value for
    // the remaining ordinals, so every bucket averages over the same finished years. `occurrences`
    // keeps only real sessions: each year's own line still stops where its data does.
    let sum = occurrences.reduce((total, o) => total + o.value, 0);
    let count = occurrences.length;
    for (const end of finishedYearEnds) {
      if (end.lastIndex < idx) {
        sum += end.value;
        count += 1;
      }
    }
    const average = sum / count;
    buckets.push({ index: idx, label: bucketLabel(idx, granularity), average, occurrences });
  }

  return { granularity, buckets, years: Array.from(contributingYears).sort((a, b) => a - b) };
}
