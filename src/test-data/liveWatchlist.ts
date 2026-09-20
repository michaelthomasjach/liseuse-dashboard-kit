import { useEffect, useRef, useState } from "react";

/** One symbol's two moving numbers: what it trades at, and how far that is from the previous
 *  close, in percent. Everything a watchlist row shows is derived from these two — the absolute
 *  move included, which is the price minus the close the percentage implies. */
export interface LiveQuote {
  price: number;
  /** Change since the previous close, in percent. */
  change: number;
}

/** How long a symbol sits still between two updates. Both ends are the brief given: a figure that
 *  refreshed every second would read as noise and one that refreshed every thirty would look
 *  frozen. */
export const LIVE_QUOTE_MIN_DELAY_MS = 3000;
export const LIVE_QUOTE_MAX_DELAY_MS = 5000;

/** How far one update may move a price, as a fraction of the price itself. A tenth of a percent
 *  either way: enough that the figure visibly changes and its tint is worth reading, small enough
 *  that a symbol does not wander to an implausible level over a few minutes of a demo. */
const STEP = 0.001;

/** A deterministic pseudo-random source, so a story can be reviewed against a previous screenshot.
 *
 *  `Math.random` is the honest default for a live-looking demo, and is what the hook uses when it
 *  is given nothing; this exists for the cases where a reproducible sequence matters more than an
 *  unpredictable one. The generator is the LCG the strategy fixtures already use, for the same
 *  reason: it is four lines, it is seeded, and nothing here needs more. */
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

/** One tick of a symbol's own price.
 *
 *  Pure, and separated from the scheduling on purpose: what a figure does when it moves and how
 *  often it moves are two different questions, and a caller that wants its own cadence — a real
 *  feed, a replay, a test stepping frame by frame — needs the first without the second.
 *
 *  The percentage is recomputed from the price against the close the *previous* percentage
 *  implied, rather than nudged on its own. Drifting the two independently lets them contradict
 *  each other: a price up on the tick and a variation down, which is not a thing a quote can do,
 *  and exactly the kind of incoherence a watchlist's own colours would then report as fact. */
export function driftQuote(quote: LiveQuote, random: () => number): LiveQuote {
  const previousClose = quote.price / (1 + quote.change / 100);
  // Centred on zero, so a symbol is as likely to fall as to rise and the demo does not drift
  // upwards the longer it is left open.
  const price = quote.price * (1 + (random() * 2 - 1) * STEP);
  return { price, change: previousClose === 0 ? quote.change : (price / previousClose - 1) * 100 };
}

export interface UseLiveQuotesOptions {
  /** Where the randomness comes from. Default `Math.random`; pass `seededRandom(n)` for a
   *  reproducible sequence. */
  random?: () => number;
  minDelayMs?: number;
  maxDelayMs?: number;
  /** Off, and nothing ever moves — the starting quotes are returned unchanged. For a story that
   *  wants the table still, and for anything measuring it. */
  enabled?: boolean;
}

/** Quotes that move on their own, one independent timer per symbol.
 *
 *  Per symbol rather than one timer for the table: a whole column changing in lockstep every four
 *  seconds reads as a screen refreshing, not as a market. Each symbol draws its own delay in
 *  [`minDelayMs`, `maxDelayMs`] after each update, so they drift apart on their own.
 *
 *  This is demo data. It belongs beside the other generated fixtures rather than inside the
 *  watchlist, which knows how to *display* a quote and has no business inventing one — the panel
 *  takes rows from its caller, and where those rows come from is the caller's affair. */
export function useLiveQuotes(initial: Record<string, LiveQuote>, options: UseLiveQuotesOptions = {}): Record<string, LiveQuote> {
  const { random = Math.random, minDelayMs = LIVE_QUOTE_MIN_DELAY_MS, maxDelayMs = LIVE_QUOTE_MAX_DELAY_MS, enabled = true } = options;
  const [quotes, setQuotes] = useState(initial);
  // Read by the timers, which outlive the render that created them. Kept in a ref so rescheduling
  // does not have to depend on the options and restart every timer whenever the caller passes a
  // fresh object literal.
  const optionsRef = useRef({ random, minDelayMs, maxDelayMs });
  optionsRef.current = { random, minDelayMs, maxDelayMs };

  const ids = Object.keys(initial).join(",");
  useEffect(() => {
    if (!enabled) return;
    const symbols = ids.split(",").filter((id) => id !== "");
    const timers: number[] = [];
    const schedule = (id: string) => {
      const { random: rng, minDelayMs: lo, maxDelayMs: hi } = optionsRef.current;
      const delay = lo + rng() * (hi - lo);
      timers.push(
        window.setTimeout(() => {
          setQuotes((current) => {
            const quote = current[id];
            // The symbol left the list while its own timer was in flight. Nothing to move, and
            // nothing to reschedule — the effect will have been torn down anyway.
            if (quote === undefined) return current;
            return { ...current, [id]: driftQuote(quote, optionsRef.current.random) };
          });
          schedule(id);
        }, delay),
      );
    };
    symbols.forEach(schedule);
    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // `ids` rather than `initial`: the starting quotes seed the state once, and depending on the
    // object itself would restart every timer on each render of a caller that builds it inline.
  }, [ids, enabled]);

  return quotes;
}
