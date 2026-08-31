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
      <DiagramLabel x={216} y={78} text='chart.indicator("rsi")' color="var(--lq-color-accent)" anchor="end" />
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
      <DiagramLabel x={6} y={68} text='plot.pane("Score").line(…)' color="var(--lq-color-accent)" />
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
      <DiagramLabel x={6} y={16} text="plot.overlay(…).line(…)" color="var(--lq-color-accent)" />
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

export function ResampleDiagram() {
  const fineBars = [
    { x: 14, top: 30, bottom: 55 },
    { x: 34, top: 20, bottom: 50 },
    { x: 54, top: 35, bottom: 65 },
    { x: 74, top: 25, bottom: 60 },
  ];
  const groupTop = Math.min(...fineBars.map((b) => b.top));
  const groupBottom = Math.max(...fineBars.map((b) => b.bottom));
  return (
    <InfoDiagram>
      {fineBars.map((b, i) => (
        <rect key={i} x={b.x - 5} y={b.top} width={10} height={b.bottom - b.top} rx={1} fill="var(--lq-color-text-muted)" opacity={0.7} />
      ))}
      <line x1={10} y1={78} x2={84} y2={78} stroke="var(--lq-color-text-muted)" strokeWidth={1} />
      <DiagramLabel x={47} y={94} text="4 bougies de 15 min" color="var(--lq-color-text-muted)" anchor="middle" />
      <line x1={92} y1={55} x2={128} y2={55} stroke="var(--lq-color-accent)" strokeWidth={1.5} markerEnd="url(#lq-resample-arrow)" />
      <rect x={157} y={groupTop} width={16} height={groupBottom - groupTop} rx={2} fill="var(--lq-color-accent)" />
      <DiagramLabel x={165} y={groupTop - 6} text="1 bougie de 1H" color="var(--lq-color-accent)" anchor="middle" />
      <DiagramLabel x={165} y={94} text='market.resample("1h")' color="var(--lq-color-accent)" anchor="middle" />
      <defs>
        <marker id="lq-resample-arrow" markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--lq-color-accent)" />
        </marker>
      </defs>
    </InfoDiagram>
  );
}

export function PlotTableDiagram() {
  return (
    <InfoDiagram>
      <g opacity={0.5}>
        <SampleCandles dim />
      </g>
      <rect x={128} y={4} width={84} height={54} rx={3} fill="var(--lq-color-panel)" stroke="var(--lq-color-accent)" strokeWidth={1.2} />
      <DiagramLabel x={134} y={16} text="RSI multi-TF" color="var(--lq-color-accent)" />
      <line x1={128} y1={22} x2={212} y2={22} stroke="var(--lq-color-border)" strokeWidth={1} />
      <DiagramLabel x={134} y={32} text="4H   61   BUY" color="var(--lq-color-up)" />
      <DiagramLabel x={134} y={42} text="1H   48  WAIT" color="var(--lq-color-text-muted)" />
      <DiagramLabel x={134} y={52} text="15m  33  SELL" color="var(--lq-color-down)" />
      <DiagramLabel x={6} y={104} text="plot.table(rows, { title, columns })" color="var(--lq-color-accent)" />
    </InfoDiagram>
  );
}

export function PlotLabelDiagram() {
  return (
    <InfoDiagram>
      <g opacity={0.5}>
        <SampleCandles dim />
      </g>
      {/* A dashed guide to an arbitrary x%/y% point — deliberately not a corner, to read as
          "anywhere in the pane," unlike PlotTableDiagram's own fixed-corner box above. */}
      <line x1={0} y1={70} x2={150} y2={70} stroke="var(--lq-color-border)" strokeWidth={1} strokeDasharray="3,3" />
      <line x1={150} y1={0} x2={150} y2={70} stroke="var(--lq-color-border)" strokeWidth={1} strokeDasharray="3,3" />
      <circle cx={150} cy={70} r={2.5} fill="var(--lq-color-accent)" />
      <g transform="translate(150,70) rotate(-24)">
        <text x={6} y={-6} fontSize={11} fontWeight={600} fill="var(--lq-color-accent)">
          Zone haute
        </text>
      </g>
      <DiagramLabel x={6} y={104} text='pane.label(name, "…", { x, y, rotation })' color="var(--lq-color-accent)" />
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
