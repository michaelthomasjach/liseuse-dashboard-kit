import { InfoDiagram, SampleCandles, SamplePriceLine, DiagramPoint, DiagramLabel } from "../diagrams/DiagramPrimitives";

/** Small illustrative SVG diagrams for the script documentation modal — same shared primitives/
 *  viewBox as the built-in indicator/drawing-tool info diagrams (`../diagrams/DiagramPrimitives`),
 *  just depicting scripting concepts (the replay loop, offsets, plot.* placement…) instead of a
 *  specific indicator's own shape. Registered by key in `scriptDiagramRegistry.ts`, the same
 *  "plain data references a component by key" split `indicatorDiagramRegistry.ts` already uses
 *  for the built-in indicators, kept in its own file purely so this one only ever exports
 *  components (react-refresh's own fast-refresh rule). */

export function ScriptReplayDiagram() {
  return (
    <InfoDiagram>
      <SampleCandles />
      {/* Candles beyond the current bar dimmed to near-invisible — there's nothing to show yet,
          the replay simply hasn't reached them. */}
      <rect x={148} y={0} width={72} height={110} fill="var(--lq-color-panel)" opacity={0.75} />
      <line x1={147} y1={4} x2={147} y2={106} stroke="var(--lq-color-accent)" strokeWidth={1.5} strokeDasharray="3 2" />
      <DiagramLabel x={147} y={100} text="bougie courante" color="var(--lq-color-accent)" anchor="middle" />
      <DiagramLabel x={6} y={12} text="déjà rejouées →" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function MarketOffsetDiagram() {
  return (
    <InfoDiagram>
      <SampleCandles />
      <DiagramLabel x={192} y={100} text="0" color="var(--lq-color-accent)" anchor="middle" />
      <DiagramLabel x={162} y={100} text="1" color="var(--lq-color-text-muted)" anchor="middle" />
      <DiagramLabel x={132} y={100} text="2" color="var(--lq-color-text-muted)" anchor="middle" />
      <text x={216} y={20} textAnchor="end" fontSize={16} fontWeight={700} fill="var(--lq-color-down)">
        ✕
      </text>
      <DiagramLabel x={216} y={34} text="futur : inaccessible" color="var(--lq-color-down)" anchor="end" />
    </InfoDiagram>
  );
}

export function ChartIndicatorDiagram() {
  return (
    <InfoDiagram>
      <g transform="translate(0, -18) scale(1, 0.55)">
        <SampleCandles dim />
      </g>
      <line x1={4} y1={64} x2={216} y2={64} stroke="var(--lq-color-border)" strokeWidth={1} />
      <polyline
        points="12,90 42,80 72,96 102,84 132,98 162,78 192,88"
        fill="none"
        stroke="var(--lq-color-accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1={192} y1={30} x2={192} y2={88} stroke="var(--lq-color-text-muted)" strokeWidth={1} strokeDasharray="2 2" />
      <DiagramPoint x={192} y={88} color="var(--lq-color-accent)" />
      <DiagramLabel x={216} y={78} text='chart.indicator("rsi_14")' color="var(--lq-color-accent)" anchor="end" />
      <DiagramLabel x={6} y={40} text="même bougie" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function PlotOwnPaneDiagram() {
  return (
    <InfoDiagram>
      <g transform="translate(0, -20) scale(1, 0.45)">
        <SampleCandles dim />
      </g>
      <DiagramLabel x={6} y={16} text="prix" color="var(--lq-color-text-muted)" />
      <line x1={4} y1={54} x2={216} y2={54} stroke="var(--lq-color-border)" strokeWidth={1.5} />
      <polyline
        points="12,88 42,72 72,94 102,70 132,90 162,66 192,80"
        fill="none"
        stroke="var(--lq-color-accent)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <DiagramLabel x={6} y={68} text='plot.line("Score", …)' color="var(--lq-color-accent)" />
      <DiagramLabel x={6} y={104} text="nouveau panneau, dédié" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function PlotOverlayDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.35} />
      <polyline
        points="4,64 22,60 40,62 58,50 76,52 94,40 112,42 130,32 148,34 166,26 184,28 202,20 216,22"
        fill="none"
        stroke="var(--lq-color-accent)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <DiagramLabel x={6} y={16} text="plot.overlay(…)" color="var(--lq-color-accent)" />
      <DiagramLabel x={6} y={100} text="superposé directement au prix" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function PlotSignalDiagram() {
  return (
    <InfoDiagram>
      <SampleCandles />
      <path d="M 42,20 L 34,32 L 39,32 L 39,42 L 45,42 L 45,32 L 50,32 Z" fill="var(--lq-color-up)" />
      <DiagramLabel x={42} y={14} text="BUY" color="var(--lq-color-up)" anchor="middle" />
      <path d="M 132,72 L 124,60 L 129,60 L 129,50 L 135,50 L 135,60 L 140,60 Z" fill="var(--lq-color-down)" />
      <DiagramLabel x={132} y={86} text="SELL" color="var(--lq-color-down)" anchor="middle" />
      <line x1={4} y1={100} x2={216} y2={100} stroke="var(--lq-color-text-muted)" strokeWidth={1.5} strokeDasharray="4 3" />
      <DiagramLabel x={6} y={95} text="plot.horizontal(…)" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function StateMemoryDiagram() {
  const bars = [0, 1, 2, 3, 4, 5];
  const gap = 216 / bars.length;
  return (
    <InfoDiagram>
      {bars.map((n, i) => {
        const x = 8 + i * gap;
        return (
          <g key={n}>
            <rect x={x} y={30} width={gap - 10} height={40} rx={4} fill="none" stroke="var(--lq-color-accent)" strokeWidth={1.5} opacity={0.7} />
            <text x={x + (gap - 10) / 2} y={54} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--lq-color-accent)">
              {n}
            </text>
            {i < bars.length - 1 && (
              <line
                x1={x + gap - 10}
                y1={50}
                x2={x + gap}
                y2={50}
                stroke="var(--lq-color-text-muted)"
                strokeWidth={1.5}
                markerEnd="url(#lq-script-arrow)"
              />
            )}
          </g>
        );
      })}
      <defs>
        <marker id="lq-script-arrow" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--lq-color-text-muted)" />
        </marker>
      </defs>
      <DiagramLabel x={6} y={16} text="state.get/set — une même valeur portée de bougie en bougie" color="var(--lq-color-text-muted)" />
      <DiagramLabel x={6} y={90} text="state.set(“count”, n + 1)" color="var(--lq-color-accent)" />
    </InfoDiagram>
  );
}

export function BarIsNewDiagram() {
  return (
    <InfoDiagram>
      <g opacity={0.4}>
        <SampleCandles dim />
      </g>
      <g transform="translate(0,0)">
        <line x1={192} y1={14} x2={192} y2={90} stroke="var(--lq-color-up)" strokeWidth={1.5} />
        <rect x={185} y={38} width={14} height={20} fill="var(--lq-color-up)" />
      </g>
      <DiagramLabel x={192} y={10} text="bar.isNew() === true" color="var(--lq-color-up)" anchor="end" />
      <DiagramLabel x={6} y={100} text="vrai uniquement pour la toute dernière bougie du rejeu" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}
