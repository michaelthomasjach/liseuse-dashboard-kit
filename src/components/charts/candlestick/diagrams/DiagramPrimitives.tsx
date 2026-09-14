import type { ReactNode } from "react";
import { type DiagramBand, bandY, seriesX, CANDLE_WIDTH } from "./diagramMath";

/** Every diagram in this directory shares this one viewBox — small, fixed, theme-aware (every
 *  color below is a CSS custom property, not a hardcoded hex, so a diagram drawn once looks
 *  correct in every palette/surface combination without any JS of its own — unlike the chart's
 *  own canvas renderers, which need `getComputedStyle` for exactly this because canvas can't read
 *  CSS custom properties directly the way SVG attributes can). Meant to sit inside the existing
 *  indicator/drawing-tool info modal, above its own description text — illustrating the shape in
 *  one glance rather than trying to be a literal, to-scale mini-chart. */
export function InfoDiagram({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 220 110" className="lq-chart__info-diagram" role="img" aria-hidden="true">
      {children}
    </svg>
  );
}

/** A generic, gently zigzagging price line — the shared "here's some price action" backdrop most
 *  overlay-style diagrams (moving averages, bands, envelopes, most drawing tools) draw their own
 *  subject on top of, rather than every one of them inventing its own price shape from scratch.
 *  Muted on purpose: it's context, not the thing actually being explained. */
export function SamplePriceLine(props: { opacity?: number }) {
  return (
    <polyline
      points="4,74 22,58 40,66 58,42 76,50 94,26 112,36 130,18 148,30 166,14 184,24 202,8 216,16"
      fill="none"
      stroke="var(--lq-color-text-muted)"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={props.opacity ?? 0.55}
    />
  );
}

/** A short row of candles (up/down colored) — the shared backdrop for anything that needs to
 *  read as "individual candles", not a continuous line (candlestick patterns, gap/pivot-style
 *  structure indicators). Fixed 7-candle sample, alternating enough to read as real price action
 *  without any diagram needing to hand-place its own. */
const SAMPLE_CANDLES: { x: number; open: number; close: number; high: number; low: number }[] = [
  { x: 12, open: 60, close: 50, high: 66, low: 44 },
  { x: 42, open: 50, close: 58, high: 62, low: 46 },
  { x: 72, open: 58, close: 40, high: 62, low: 34 },
  { x: 102, open: 40, close: 46, high: 50, low: 30 },
  { x: 132, open: 46, close: 30, high: 50, low: 24 },
  { x: 162, open: 30, close: 38, high: 42, low: 22 },
  { x: 192, open: 38, close: 24, high: 42, low: 18 },
];
export function SampleCandles(props: { dim?: boolean }) {
  return (
    <g opacity={props.dim ? 0.5 : 1}>
      {SAMPLE_CANDLES.map((c, i) => {
        const up = c.close < c.open;
        const color = up ? "var(--lq-color-up)" : "var(--lq-color-down)";
        const top = Math.min(c.open, c.close);
        const bottom = Math.max(c.open, c.close);
        return (
          <g key={i}>
            <line x1={c.x} x2={c.x} y1={c.high} y2={c.low} stroke={color} strokeWidth={1.5} />
            <rect x={c.x - 7} y={top} width={14} height={Math.max(2, bottom - top)} fill={color} />
          </g>
        );
      })}
    </g>
  );
}

/** A small filled dot, optionally lettered/numbered right above it — the shared "here's a key
 *  point" marker every point-based diagram (chart patterns, drawing-tool anchors) uses instead of
 *  each one hand-rolling its own circle+text pair. */
export function DiagramPoint({ x, y, label, color = "var(--lq-color-accent)" }: { x: number; y: number; label?: string; color?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={3} fill={color} />
      {label && (
        <text x={x} y={y - 7} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--lq-color-text)">
          {label}
        </text>
      )}
    </g>
  );
}

/** A short caption anchored at a fixed spot — every diagram's own one-or-two-word label for
 *  whatever it just drew (a band, a line, a level), distinct from DiagramPoint's per-vertex
 *  lettering above. */
export function DiagramLabel({ x, y, text, color = "var(--lq-color-text)", anchor = "start" }: { x: number; y: number; text: string; color?: string; anchor?: "start" | "middle" | "end" }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={9} fontWeight={600} fill={color}>
      {text}
    </text>
  );
}

/* ------------------------------------------------------------------------------------------- *
 *  The indicator diagrams
 *
 *  These used to be cropped screenshots of the demo chart. They were replaced because a crop of
 *  real price action with an orange line through it cannot teach anything: it shows *that* an
 *  indicator draws something, never *what to look at*. The RSI capture was a squiggle with no 70,
 *  no 30 and no axis; the SMA capture was candles clipped top and bottom.
 *
 *  What follows is the vocabulary those replacements are drawn in. Two rules hold it together:
 *
 *  - **the picture is computed, not sketched.** A diagram states a series of closes and asks for
 *    the real `sma`/`ema` of it. A hand-drawn curve can lie — draw the average turning before the
 *    price, and nobody notices. A computed one cannot.
 *  - **every diagram annotates its own point.** The threshold is labelled, the crossing is
 *    circled, the lag is called out. An unannotated diagram is decoration.
 * ------------------------------------------------------------------------------------------- */

/** The canvas the indicator diagrams share — wider and taller than `InfoDiagram`'s, because these
 *  carry labels, thresholds and callouts that 220×110 has no room for. */
export function IndicatorDiagram({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 440 190" className="lq-chart__info-diagram lq-chart__info-diagram--wide" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

/** Closes → OHLC. Each candle opens where the last one closed and gets a deterministic wick, so a
 *  diagram only ever has to state the shape it wants; there is no hand-placed candle anywhere. */
function candlesFromCloses(closes: number[]): { o: number; h: number; l: number; c: number }[] {
  return closes.map((c, i) => {
    const o = i === 0 ? c - 3 : closes[i - 1];
    const wick = 2.5 + ((i * 7) % 4);
    return { o, c, h: Math.max(o, c) + wick, l: Math.min(o, c) - wick };
  });
}

/** Candles from a series of closes on the 0–100 scale. */
export function DiagramCandles({ closes, band, opacity = 1 }: { closes: number[]; band: DiagramBand; opacity?: number }) {
  return (
    <g opacity={opacity}>
      {candlesFromCloses(closes).map((k, i) => {
        const up = k.c >= k.o;
        const color = up ? "var(--lq-color-up)" : "var(--lq-color-down)";
        const x = seriesX(i);
        const top = bandY(Math.max(k.o, k.c), band);
        const bottom = bandY(Math.min(k.o, k.c), band);
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={bandY(k.h, band)} y2={bandY(k.l, band)} stroke={color} strokeWidth={1.2} />
            <rect x={x - CANDLE_WIDTH / 2} y={top} width={CANDLE_WIDTH} height={Math.max(1.5, bottom - top)} fill={color} />
          </g>
        );
      })}
    </g>
  );
}

/** Candles stated outright, for the two diagrams whose subject is a shape `DiagramCandles` cannot
 *  produce: a gap needs two candles whose ranges do not touch at any price, and that generator
 *  opens every candle exactly on the previous close. */
export interface DiagramOhlc {
  o: number;
  h: number;
  l: number;
  c: number;
}

export function DiagramOhlcCandles({
  candles,
  band,
  opacity = 1,
  x,
  width = CANDLE_WIDTH,
}: {
  candles: DiagramOhlc[];
  band: DiagramBand;
  opacity?: number;
  x?: (i: number) => number;
  width?: number;
}) {
  const at = x ?? seriesX;
  return (
    <g opacity={opacity}>
      {candles.map((k, i) => {
        const up = k.c >= k.o;
        const color = up ? "var(--lq-color-up)" : "var(--lq-color-down)";
        const top = bandY(Math.max(k.o, k.c), band);
        const bottom = bandY(Math.min(k.o, k.c), band);
        return (
          <g key={i}>
            <line x1={at(i)} x2={at(i)} y1={bandY(k.h, band)} y2={bandY(k.l, band)} stroke={color} strokeWidth={1.4} />
            <rect x={at(i) - width / 2} y={top} width={width} height={Math.max(1.5, bottom - top)} fill={color} />
          </g>
        );
      })}
    </g>
  );
}

/** A plotted series. `values` are on the 0–100 scale; a `null` is a hole (an average has no value
 *  before its window fills, and drawing one anyway is the small lie these diagrams avoid). */
export function DiagramSeries({
  values,
  band,
  color = "var(--lq-color-accent)",
  width = 2,
  dashed = false,
  opacity = 1,
}: {
  values: (number | null)[];
  band: DiagramBand;
  color?: string;
  width?: number;
  dashed?: boolean;
  opacity?: number;
}) {
  const segments: string[] = [];
  let current: string[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${seriesX(i)},${bandY(v, band).toFixed(1)}`);
  });
  if (current.length > 1) segments.push(current.join(" "));
  return (
    <g opacity={opacity}>
      {segments.map((points, i) => (
        <polyline
          key={i}
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashed ? "5 4" : undefined}
        />
      ))}
    </g>
  );
}

/** The frame around an oscillator's own panel, with its name in the corner — the visual statement
 *  that this plot has its own scale and does not share the price axis above it. */
export function DiagramPanel({ band, title }: { band: DiagramBand; title: string }) {
  return (
    <g>
      <rect
        x={8}
        y={band.top - 10}
        width={424}
        height={band.bottom - band.top + 20}
        rx={3}
        fill="var(--lq-color-surface, transparent)"
        stroke="var(--lq-color-border-subtle)"
        strokeWidth={1}
        opacity={0.9}
      />
      <text x={14} y={band.top - 1} fontSize={9} fontWeight={700} fill="var(--lq-color-text-muted)">
        {title}
      </text>
    </g>
  );
}

/** A labelled horizontal reference — 70 and 30 on an RSI, zero on a MACD, 25 on an ADX. The label
 *  sits in the right margin the candle series deliberately stops short of. */
export function DiagramThreshold({
  value,
  band,
  label,
  color = "var(--lq-color-text-muted)",
  dashed = true,
}: {
  value: number;
  band: DiagramBand;
  label?: string;
  color?: string;
  dashed?: boolean;
}) {
  const y = bandY(value, band);
  return (
    <g>
      <line x1={12} x2={404} y1={y} y2={y} stroke={color} strokeWidth={1} strokeDasharray={dashed ? "3 3" : undefined} opacity={0.75} />
      {label && (
        <text x={408} y={y + 3} fontSize={9} fontWeight={600} fill={color}>
          {label}
        </text>
      )}
    </g>
  );
}

/** A shaded region of a panel — an RSI's overbought zone, a CHOP's range zone. */
export function DiagramZone({ from, to, band, color, opacity = 0.12 }: { from: number; to: number; band: DiagramBand; color: string; opacity?: number }) {
  const y1 = bandY(to, band);
  const y2 = bandY(from, band);
  return <rect x={12} y={y1} width={392} height={Math.abs(y2 - y1)} fill={color} opacity={opacity} />;
}

/** The thing the diagram is actually about, said out loud: a short note with a leader line to the
 *  spot it describes. Every indicator diagram carries at least one. */
export function DiagramCallout({
  x,
  y,
  toX,
  toY: toYCoord,
  text,
  anchor = "start",
  color = "var(--lq-color-text)",
}: {
  x: number;
  y: number;
  toX: number;
  toY: number;
  text: string;
  anchor?: "start" | "middle" | "end";
  color?: string;
}) {
  // The leader has to leave the text on the side facing its target, or a right-anchored note ends
  // up with a line trailing off its far end. There is no way to measure SVG text before it is laid
  // out, so the width is estimated from the character count — close enough for a dashed hairline.
  const approxWidth = text.length * 4.7;
  const left = anchor === "end" ? x - approxWidth : anchor === "middle" ? x - approxWidth / 2 : x;
  const right = left + approxWidth;
  const attachX = Math.abs(toX - left) <= Math.abs(toX - right) ? left : right;
  return (
    <g>
      <line x1={attachX} y1={y + 2} x2={toX} y2={toYCoord} stroke={color} strokeWidth={1} strokeDasharray="2 2" opacity={0.6} />
      <circle cx={toX} cy={toYCoord} r={3.5} fill="none" stroke={color} strokeWidth={1.4} />
      <text x={x} y={y} textAnchor={anchor} fontSize={9.5} fontWeight={600} fill={color}>
        {text}
      </text>
    </g>
  );
}

