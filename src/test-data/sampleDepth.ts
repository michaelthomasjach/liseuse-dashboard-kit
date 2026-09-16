import type { Candle } from "../components/charts/candlestick/interfaces/Candle.interface";
import type { DepthSnapshot, TapePrint } from "../components/charts/candlestick/interfaces/MarketDepth.interface";

/** A synthetic order book and tape, for stories and for trying the liquidity map out.
 *
 *  **Invented, and it has to be said plainly: this is not derived from anything real, and no real
 *  chart can produce it.** A depth feed is a subscription; a library that manufactured one from
 *  candles would hand back a picture that looks exactly like a liquidity map while being a drawing
 *  of the volume bar it came from — which is worse than showing nothing, because it is unfalsifiable
 *  by eye. What this is for is exercising the rendering and the detection against data whose answers
 *  are known, because they were placed here on purpose:
 *
 *  - a book that thins with distance from the touch, the shape every book has;
 *  - **resting walls** at round prices that survive hundreds of bars — the horizontal bands a
 *    liquidity map exists to show, and the thing a candle chart cannot say at all;
 *  - **one iceberg**: a level displaying a little and absorbing a great deal, refilled every time
 *    it is hit, which is precisely the signature `book.sizeAt` and `tape.volumeAt` are there to
 *    let a script find.
 *
 *  Deterministic from `seed`, like every other fixture here: a heat map that reshuffled on each
 *  reload could not be reviewed against a previous screenshot. */
export interface SampleDepthOptions {
  /** Price distance between two levels. Defaults to a thousandth of the first close, which puts
   *  roughly forty levels across a normal bar's range — the density the picture reads best at. */
  tick?: number;
  /** How many levels a side. More is slower to generate and denser to look at; twenty a side is
   *  what most venues publish. */
  levels?: number;
  seed?: number;
}

export interface SampleDepthFeed {
  depth: DepthSnapshot[];
  tape: TapePrint[];
  /** Where the iceberg was planted, so a story can say whether the detector found the right one
   *  rather than merely finding something. */
  icebergPrice: number;
  tick: number;
}

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

export function makeSampleDepth(candles: Candle[], options: SampleDepthOptions = {}): SampleDepthFeed {
  const random = seeded(options.seed ?? 7);
  const levels = Math.max(4, options.levels ?? 20);
  const tick = options.tick ?? Math.max(0.01, Number((candles[0].close / 1000).toPrecision(2)));
  const round = (price: number) => Math.round(price / tick) * tick;

  // The walls: a handful of prices spread over the whole range that hold size for the entire run.
  // Round numbers, because that is where they actually sit, and a demo that put them at arbitrary
  // prices would teach the wrong reflex.
  const low = Math.min(...candles.map((c) => c.low));
  const high = Math.max(...candles.map((c) => c.high));
  const wallStep = (high - low) / 5;
  const walls = Array.from({ length: 4 }, (_, i) => ({
    price: round(low + wallStep * (i + 0.5)),
    size: 4000 + random() * 9000,
  }));

  // The iceberg sits just under the middle of the range, where price passes through it repeatedly.
  const icebergPrice = round(low + (high - low) * 0.42);
  const icebergDisplayed = 120;

  const depth: DepthSnapshot[] = [];
  const tape: TapePrint[] = [];

  candles.forEach((candle, index) => {
    const time = candle.date.getTime();
    const mid = round(candle.close);
    const bids: { price: number; size: number }[] = [];
    const asks: { price: number; size: number }[] = [];

    for (let i = 1; i <= levels; i++) {
      // Thinning with distance, plus noise — the ordinary shape, so the walls stand out against
      // something rather than against emptiness.
      const decay = 1 / (1 + i * 0.35);
      const bidPrice = round(mid - i * tick);
      const askPrice = round(mid + i * tick);
      bids.push({ price: bidPrice, size: Math.round((250 + random() * 700) * decay) });
      asks.push({ price: askPrice, size: Math.round((250 + random() * 700) * decay) });
    }

    // Walls and the iceberg are written on top of whatever level landed there, so they are the same
    // levels rather than extra ones — which is what a wall actually is.
    const stamp = (list: { price: number; size: number }[], price: number, size: number) => {
      const level = list.find((entry) => Math.abs(entry.price - price) < tick / 2);
      if (level !== undefined) level.size = size;
      else if (Math.abs(price - mid) <= levels * tick) list.push({ price, size });
    };
    for (const wall of walls) {
      stamp(wall.price < mid ? bids : asks, wall.price, Math.round(wall.size * (0.85 + random() * 0.3)));
    }
    // The iceberg displays almost nothing, always — that is the whole trick, and the reason it can
    // only be found by comparing what it showed against what traded through it.
    stamp(icebergPrice < mid ? bids : asks, icebergPrice, icebergDisplayed);

    depth.push({ time, bids, asks });

    // The tape: volume spread over the bar's own range, aggressor from the candle's direction, plus
    // a deliberate soak at the iceberg whenever the bar covers it.
    // Sized against the *book*, not against the candle's own volume, and this matters more than it
    // looks: an iceberg is found by the ratio of what traded at a price to what that price ever
    // displayed, so a tape scaled to a six-figure daily volume against a book of a few hundred lots
    // makes every level look like an iceberg. Measured, when it was: ninety thousand pixels of
    // marker, which is a detector that has stopped detecting anything.
    const prints = 12;
    for (let i = 0; i < prints; i++) {
      const at = round(candle.low + (candle.high - candle.low) * random());
      tape.push({
        time: time + Math.round(((i + 0.5) / prints) * 60_000),
        price: at,
        size: Math.round(120 + random() * 260),
        aggressor: random() > 0.5 ? "buy" : "sell",
      });
    }
    if (candle.low - tick <= icebergPrice && icebergPrice <= candle.high + tick) {
      // Many times the displayed size, in one bar, at a level that is still there on the next
      // snapshot. Nothing else in this feed does that.
      tape.push({
        time: time + 30_000,
        price: icebergPrice,
        size: Math.round(icebergDisplayed * (14 + random() * 10)),
        aggressor: candle.close >= candle.open ? "buy" : "sell",
      });
    }
    void index;
  });

  return { depth, tape, icebergPrice, tick };
}
