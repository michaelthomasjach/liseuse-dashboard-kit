import type { ReactNode } from "react";

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

/** The real-screenshot counterpart to `InfoDiagram` above — every built-in `IndicatorKind`'s own
 *  diagram is a real Playwright capture of that indicator actually plotted on the "all features"
 *  demo chart (a cropped JPEG under `./images/`), not a hand-drawn SVG: an indicator like Ichimoku
 *  or TPO has a genuinely intricate shape a stylized SVG could only gesture at, so showing the
 *  real render is both more accurate and less work to keep in sync as the indicator itself evolves.
 *  The 38 drawing-tool diagrams keep using `InfoDiagram` and friends — a drawing tool has no
 *  "default" shape to screenshot until a user has already drawn one, unlike an indicator, which
 *  renders unprompted the moment it's added. */
export function DiagramImage({ src, alt }: { src: string; alt: string }) {
  return <img src={src} alt={alt} className="lq-chart__info-diagram-image" loading="lazy" />;
}
