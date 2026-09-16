import type { RenderCandlestickChartParams } from "../interfaces/RenderCandlestickChartParams.interface";
import type { ScriptHeatmapOutput } from "../scripting/interfaces/ScriptRunResult.interface";

/** The default ramp, coldest first: the convention every liquidity map has settled on, and it is a
 *  convention worth keeping rather than improving on — a reader who has seen one of these knows
 *  that red is a wall without being told. Near-black at the bottom so an empty book disappears into
 *  the chart instead of tinting it. */
const DEPTH_RAMP = ["#0b1b2b", "#123f6b", "#1e78b4", "#35b7c9", "#ffe066", "#ff8c2b", "#e03131"];

/** Colour lookup resolution. The ramp is sampled into this many steps once per field and then
 *  indexed, rather than interpolated per cell: a hundred thousand cells is a hundred thousand
 *  interpolations otherwise, and no reader can tell 256 steps from a continuum. */
const RAMP_STEPS = 256;

/** How the intensity axis is compressed.
 *
 *  Resting size is heavy-tailed — a handful of walls dwarf everything else — so a linear scale
 *  paints the whole book near-black and the walls red, which is a picture of the maximum rather
 *  than of the book. The square root spreads the bottom of the range where almost every cell
 *  actually lives, which is the same reason volume profiles and audio meters are not linear
 *  either. */
function intensity(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.sqrt(value / max));
}

/** The value the hottest colour is given to, when the script does not name one.
 *
 *  A *percentile*, not the maximum, and this is the difference between a liquidity map and a
 *  picture of its own biggest wall. Resting size is heavy-tailed: a handful of walls are twenty
 *  times anything else, so scaling by the maximum pushes the entire ordinary book — which is most
 *  of the cells and most of what there is to read — into the bottom of the ramp, where it is
 *  near-black and invisible. Measured on the demo feed: the median level is 3% of the deepest wall.
 *
 *  Anchored on the **median** level, times a constant, rather than on a high percentile — and the
 *  difference is not academic. A percentile moves with how many walls a book happens to have: on a
 *  feed with four of them the 97th sits among ordinary levels and the picture is right; add twenty
 *  more and the same percentile lands on the walls themselves, pushing everything else back into
 *  the dark. Measured going from one to the other: 67 585 blue pixels down to 7 780, from the same
 *  code, because the fixture grew more walls.
 *
 *  The median does not care. Ordinary levels land in the blues and cyans where they can be read,
 *  and anything several times the typical level clamps at the top of the ramp — which is exactly
 *  what a wall should do, however many of them there are.
 *
 *  Sampled rather than sorted whole: a hundred thousand cells is a sort nobody needs when every
 *  fifth one answers the same question to within a rounding error. */
const CEILING_OVER_MEDIAN = 8;

function scaleCeiling(cells: { value: number }[]): number {
  const step = Math.max(1, Math.floor(cells.length / 20_000));
  const sample: number[] = [];
  for (let i = 0; i < cells.length; i += step) sample.push(cells[i].value);
  if (sample.length === 0) return 0;
  sample.sort((a, b) => a - b);
  return sample[Math.floor(sample.length / 2)] * CEILING_OVER_MEDIAN;
}

function sampleRamp(colors: string[]): Uint8ClampedArray {
  const stops = colors.map(parseColor);
  const table = new Uint8ClampedArray(RAMP_STEPS * 3);
  for (let i = 0; i < RAMP_STEPS; i++) {
    const t = i / (RAMP_STEPS - 1);
    const scaled = t * (stops.length - 1);
    const low = Math.min(stops.length - 1, Math.floor(scaled));
    const high = Math.min(stops.length - 1, low + 1);
    const f = scaled - low;
    for (let c = 0; c < 3; c++) table[i * 3 + c] = stops[low][c] + (stops[high][c] - stops[low][c]) * f;
  }
  return table;
}

/** `#rgb`/`#rrggbb` only. A ramp is authored, not computed, so the two hex forms cover it — and a
 *  colour this cannot read falls back to mid-grey rather than throwing inside a render pass. */
function parseColor(value: string): [number, number, number] {
  const hex = value.trim().replace("#", "");
  if (hex.length === 3) return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)];
  if (hex.length === 6) return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  return [128, 128, 128];
}

/** One field, rasterised into its own grid, plus what that grid means in chart coordinates.
 *
 *  The whole performance story of this feature is here. A heat field is tens of thousands of cells;
 *  filling a rectangle per cell per frame would be tens of thousands of canvas calls sixty times a
 *  second while panning. Instead each field is drawn *once* into an offscreen bitmap whose pixels
 *  are its cells — one pixel per (bar, price bucket) — and every frame after that is a single
 *  `drawImage` that the GPU scales. Panning and zooming never touch the raster; only new data
 *  does. */
interface RasterisedField {
  bitmap: HTMLCanvasElement;
  /** Bar index and price of the bitmap's own origin, and the price height of one of its rows. */
  firstIndex: number;
  topPrice: number;
  bucket: number;
  rows: number;
  columns: number;
  opacity: number;
}

const cache = new WeakMap<ScriptHeatmapOutput, RasterisedField | null>();

/** Turns one field's cells into a bitmap. Cached against the output object itself: the scripting
 *  engine hands back a new array on every run and the same one between runs, so the WeakMap key is
 *  exactly "has this field changed", with no version counter to keep honest and no entry left
 *  behind when a script is closed. */
function rasterise(field: ScriptHeatmapOutput, indexForDate: (date: Date) => number): RasterisedField | null {
  const cached = cache.get(field);
  if (cached !== undefined) return cached;

  if (field.cells.length === 0 || field.bucket <= 0) {
    cache.set(field, null);
    return null;
  }

  // One pass to find the extent, so the bitmap is exactly as big as the data and no bigger.
  let minIndex = Infinity;
  let maxIndex = -Infinity;
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let peak = 0;
  const indices = new Int32Array(field.cells.length);
  for (let i = 0; i < field.cells.length; i++) {
    const cell = field.cells[i];
    const index = indexForDate(new Date(cell.date));
    indices[i] = index;
    if (index < minIndex) minIndex = index;
    if (index > maxIndex) maxIndex = index;
    if (cell.price < minPrice) minPrice = cell.price;
    if (cell.price > maxPrice) maxPrice = cell.price;
    if (cell.value > peak) peak = cell.value;
  }
  const max = field.max !== undefined && field.max > 0 ? field.max : scaleCeiling(field.cells) || peak;
  const columns = maxIndex - minIndex + 1;
  const rows = Math.max(1, Math.round((maxPrice - minPrice) / field.bucket) + 1);
  // A field asking for more than this is a field whose bucket is wrong by orders of magnitude —
  // drawing nothing beats allocating a bitmap the tab cannot hold.
  if (columns <= 0 || columns > 20_000 || rows > 20_000 || columns * rows > 12_000_000) {
    cache.set(field, null);
    return null;
  }

  const bitmap = document.createElement("canvas");
  bitmap.width = columns;
  bitmap.height = rows;
  const ctx = bitmap.getContext("2d");
  if (ctx === null) {
    cache.set(field, null);
    return null;
  }
  const image = ctx.createImageData(columns, rows);
  const pixels = image.data;
  const ramp = sampleRamp(field.colors ?? DEPTH_RAMP);

  for (let i = 0; i < field.cells.length; i++) {
    const cell = field.cells[i];
    const column = indices[i] - minIndex;
    // Row 0 is the *highest* price, because that is the direction a price axis runs on screen and
    // flipping it here costs nothing while flipping it per frame would not.
    const row = Math.round((maxPrice - cell.price) / field.bucket);
    if (column < 0 || column >= columns || row < 0 || row >= rows) continue;
    const step = Math.min(RAMP_STEPS - 1, Math.round(intensity(cell.value, max) * (RAMP_STEPS - 1)));
    const at = (row * columns + column) * 4;
    // Brightest wins where two snapshots of the same bar land in the same bucket: the picture is
    // of what was resting there, and the deepest observation is the honest one to keep.
    if (pixels[at + 3] !== 0 && pixels[at] + pixels[at + 1] + pixels[at + 2] >= ramp[step * 3] + ramp[step * 3 + 1] + ramp[step * 3 + 2]) continue;
    pixels[at] = ramp[step * 3];
    pixels[at + 1] = ramp[step * 3 + 1];
    pixels[at + 2] = ramp[step * 3 + 2];
    // Alpha carries the bottom of the scale and colour the top — which is what keeps a thin book
    // from tinting the whole pane while a wall still reads as a solid band. The floor is not zero
    // on purpose: an ordinary level is a few percent of the deepest wall, and at a floor of nothing
    // the entire book below the walls disappeared into the background — measured on the demo feed,
    // a map that was a correct picture of four walls and nothing else.
    pixels[at + 3] = 70 + intensity(cell.value, max) * 185;
  }
  ctx.putImageData(image, 0, 0);

  const raster: RasterisedField = {
    bitmap,
    firstIndex: minIndex,
    topPrice: maxPrice + field.bucket / 2,
    bucket: field.bucket,
    rows,
    columns,
    opacity: field.opacity ?? 0.9,
  };
  cache.set(field, raster);
  return raster;
}

/** Radius bounds for a trade disc, in pixels. The floor keeps the smallest print visible at all;
 *  the ceiling stops one outlier from covering a tenth of the pane. */
const BUBBLE_MIN_R = 1.5;
const BUBBLE_MAX_R = 9;

/** A trail, reduced to the three numbers a frame actually needs, sorted by bar.
 *
 *  Everything expensive about a disc is decided *once* here: which bar it belongs to (a date lookup
 *  and an allocation), and how big it is (a square root against the run's largest print). What was
 *  left for the frame was those two things times thirty thousand discs, sixty times a second, and
 *  it is what took panning from 64 ms a frame to 199.
 *
 *  Typed arrays rather than objects, and sorted by bar rather than left in arrival order: the sort
 *  is what lets a frame binary-search to the visible window and walk a slice instead of testing
 *  every disc against the viewport. */
interface PreparedBubbles {
  index: Int32Array;
  price: Float64Array;
  radius: Float32Array;
  /** 0 unknown, 1 buy, 2 sell — an index into the three colours, resolved once. */
  side: Uint8Array;
}

const bubbleCache = new WeakMap<ScriptHeatmapOutput, PreparedBubbles | null>();

function prepareBubbles(field: ScriptHeatmapOutput, indexForDate: (date: Date) => number): PreparedBubbles | null {
  const cached = bubbleCache.get(field);
  if (cached !== undefined) return cached;
  const bubbles = field.bubbles;
  if (bubbles === undefined || bubbles.length === 0) {
    bubbleCache.set(field, null);
    return null;
  }
  let largest = 0;
  for (const bubble of bubbles) if (bubble.size > largest) largest = bubble.size;
  if (largest <= 0) {
    bubbleCache.set(field, null);
    return null;
  }
  // One pass to resolve, one sort. The date objects die here rather than being rebuilt per frame.
  const order = bubbles.map((bubble, i) => ({ i, at: indexForDate(new Date(bubble.date)) }));
  order.sort((a, b) => a.at - b.at);
  const prepared: PreparedBubbles = {
    index: new Int32Array(order.length),
    price: new Float64Array(order.length),
    radius: new Float32Array(order.length),
    side: new Uint8Array(order.length),
  };
  for (let k = 0; k < order.length; k++) {
    const bubble = bubbles[order[k].i];
    prepared.index[k] = order[k].at;
    prepared.price[k] = bubble.price;
    prepared.radius[k] = BUBBLE_MIN_R + Math.sqrt(bubble.size / largest) * (BUBBLE_MAX_R - BUBBLE_MIN_R);
    prepared.side[k] = bubble.aggressor === "buy" ? 1 : bubble.aggressor === "sell" ? 2 : 0;
  }
  bubbleCache.set(field, prepared);
  return prepared;
}

/** First entry whose bar index is at or after `target`. */
function lowerBound(index: Int32Array, target: number): number {
  let lo = 0;
  let hi = index.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (index[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const BUBBLE_COLORS = ["#b9c2cc", "#4caf72", "#e0564f"];

/** The trade trail: one disc per print, radius from its size, colour from its side.
 *
 *  Area rather than radius carries the size — a disc twice the radius is four times the ink, and
 *  scaling the radius linearly makes a print look four times bigger than it was. The square root is
 *  the whole correction and it is the difference between a trail you can read and one that shouts.
 *
 *  Drawn per disc rather than rastered like the field, because a disc is a shape and not a cell:
 *  it lands between bars and between levels, and snapping it to the field's grid would put every
 *  print of a bar at the same place. That is why they are capped instead. */
function drawBubbles(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams, field: ScriptHeatmapOutput) {
  const { zoomedXScale, zoomedPriceScale, dims, priceHeight, indexForDate, visibleRange } = params;
  const prepared = prepareBubbles(field, indexForDate);
  if (prepared === null) return;

  // Only the discs whose bar is on screen, found by bisection. Everything else is not tested, not
  // scaled, and not looked at — which on a long history is most of them.
  const from = lowerBound(prepared.index, visibleRange.start - 1);
  const to = lowerBound(prepared.index, visibleRange.end + 2);

  // Batched into *runs* rather than one path per side, and the difference is the picture rather
  // than the speed. `arc` is cheap and `fill` is not, so thirty thousand fills had to go — but
  // three paths filled in a fixed order means whichever side is filled last covers the other
  // wherever discs overlap, and the trail went from 18 328 green pixels to 9 202 without a single
  // trade changing. Filling each consecutive same-side run keeps the tape's own order, which is the
  // order a painter's algorithm is supposed to honour, and still collapses a dense trail from tens
  // of thousands of fills to a few hundred.
  const pending: { side: number; path: Path2D }[] = [];
  let path = new Path2D();
  let runSide = -1;
  // Sub-pixel duplicates are dropped: at a zoom where a bar is half a pixel wide, a hundred discs
  // land on the same dot and only the last is visible anyway. Rounded to the pixel, so this thins
  // exactly when the picture stops being able to show the difference.
  //
  // Per side, not globally, and that took a measurement to notice: dropping whatever landed on an
  // already-used pixel let iteration order decide which colour survived, and the trail went from
  // 18 328 green pixels to 9 215 without a single trade changing. Two sides on one pixel is one
  // overdraw; two hundred prints of the same side on one pixel is the thing worth dropping.
  const lastX = [Number.NaN, Number.NaN, Number.NaN];
  const lastY = [Number.NaN, Number.NaN, Number.NaN];
  const lastR = [Number.NaN, Number.NaN, Number.NaN];
  for (let k = from; k < to; k++) {
    const x = zoomedXScale(prepared.index[k] + 0.5);
    if (x < -BUBBLE_MAX_R || x > dims.boundedWidth + BUBBLE_MAX_R) continue;
    const y = zoomedPriceScale(prepared.price[k]);
    if (y < -BUBBLE_MAX_R || y > priceHeight + BUBBLE_MAX_R) continue;
    const r = prepared.radius[k];
    const rx = Math.round(x);
    const ry = Math.round(y);
    const side = prepared.side[k];
    if (rx === lastX[side] && ry === lastY[side] && r <= lastR[side]) continue;
    lastX[side] = rx;
    lastY[side] = ry;
    lastR[side] = r;
    if (side !== runSide) {
      if (runSide !== -1) pending.push({ side: runSide, path });
      path = new Path2D();
      runSide = side;
    }
    path.moveTo(x + r, y);
    path.arc(x, y, r, 0, Math.PI * 2);
  }
  if (runSide !== -1) pending.push({ side: runSide, path });

  ctx.globalAlpha = 0.85;
  for (const run of pending) {
    ctx.fillStyle = BUBBLE_COLORS[run.side];
    ctx.fill(run.path);
  }
  ctx.globalAlpha = 1;
}

/** True while any visible field has declared that it stands in for the price series.
 *
 *  Read by the candle pass, which then draws nothing: a field with an opaque ground has already
 *  covered the candles, and leaving them underneath means dark ink on a dark ground — a smear
 *  rather than a chart. What replaces them is the trade trail above. */
export function heatmapReplacesPrice(params: RenderCandlestickChartParams): boolean {
  return params.scriptHeatmaps.some((field) => field.replacesPrice === true && field.paneType === "overlay" && field.cells.length > 0);
}

/** Liquidity, as a field of colour under the candles.
 *
 *  Drawn first among the price-pane passes — before the candles, before every drawing — because it
 *  is a background: a map of where size is resting, which the price then moves over. Drawn on top,
 *  it would be a curtain.
 *
 *  Only overlay fields are handled here. A field on a pane of its own would need that pane's scale
 *  and clip, and no script has asked for one yet; the output carries `paneType` so that stays
 *  possible without changing the shape of anything. */
export function drawScriptHeatmaps(ctx: CanvasRenderingContext2D, params: RenderCandlestickChartParams) {
  const { scriptHeatmaps, zoomedXScale, zoomedPriceScale, dims, priceHeight, indexForDate } = params;
  if (scriptHeatmaps.length === 0 || priceHeight <= 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, dims.boundedWidth, priceHeight);
  ctx.clip();

  for (const field of scriptHeatmaps) {
    if (field.paneType !== "overlay") continue;
    const raster = rasterise(field, indexForDate);
    if (raster === null) continue;

    // Where the bitmap's own corners land on the chart right now. The bitmap spans whole bars, so
    // its left edge is the start of its first bar and its right edge the end of its last.
    const left = zoomedXScale(raster.firstIndex);
    const right = zoomedXScale(raster.firstIndex + raster.columns);
    const top = zoomedPriceScale(raster.topPrice);
    const bottom = zoomedPriceScale(raster.topPrice - raster.rows * raster.bucket);
    const width = right - left;
    const height = bottom - top;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) continue;
    // Entirely off-screen: nothing to draw, and `drawImage` on a far-away rect is not free.
    if (right < 0 || left > dims.boundedWidth || bottom < 0 || top > priceHeight) continue;

    // The ground first, across the *whole pane* rather than the raster's own box: a liquidity map
    // is the background of the chart it is on, and a dark rectangle ending where the data happens
    // to end would read as a panel floating in the middle of a light chart.
    if (field.ground !== undefined) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = field.ground;
      ctx.fillRect(0, 0, dims.boundedWidth, priceHeight);
    }

    ctx.globalAlpha = raster.opacity;
    // Nearest-neighbour: a cell is a fact about one bar at one price, and smoothing would blur it
    // into its neighbours — inventing liquidity between two levels that had none.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(raster.bitmap, left, top, width, height);

    drawBubbles(ctx, params, field);
  }

  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true;
  ctx.restore();
}
