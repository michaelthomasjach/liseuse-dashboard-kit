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
  const bubbles = field.bubbles;
  if (bubbles === undefined || bubbles.length === 0) return;
  const { zoomedXScale, zoomedPriceScale, dims, priceHeight, indexForDate } = params;
  let largest = 0;
  for (const bubble of bubbles) if (bubble.size > largest) largest = bubble.size;
  if (largest <= 0) return;

  ctx.globalAlpha = 0.85;
  for (const bubble of bubbles) {
    const x = zoomedXScale(indexForDate(new Date(bubble.date)) + 0.5);
    if (x < -BUBBLE_MAX_R || x > dims.boundedWidth + BUBBLE_MAX_R) continue;
    const y = zoomedPriceScale(bubble.price);
    if (y < -BUBBLE_MAX_R || y > priceHeight + BUBBLE_MAX_R) continue;
    const r = BUBBLE_MIN_R + Math.sqrt(bubble.size / largest) * (BUBBLE_MAX_R - BUBBLE_MIN_R);
    // The two sides of the tape, and a third colour for a print whose side the feed never named —
    // rather than picking one of the two and being wrong half the time.
    ctx.fillStyle = bubble.aggressor === "buy" ? "#4caf72" : bubble.aggressor === "sell" ? "#e0564f" : "#b9c2cc";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
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
