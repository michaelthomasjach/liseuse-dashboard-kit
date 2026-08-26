import { InfoDiagram, SamplePriceLine, DiagramLabel } from "./DiagramPrimitives";

/** A smoothed, lagged trace of `SamplePriceLine`'s own points — the classic "hugs price but
 *  rounds off the sharp turns, a beat behind" moving-average look every diagram below draws with
 *  a different stroke style/color to tell SMA/EMA/WMA/VWAP apart. Short labels only (the name of
 *  whatever's just been drawn) — the fuller explanation is the existing description text right
 *  below the diagram, not a second copy of it squeezed into the drawing itself. */
const SMOOTHED_OVERLAY = "6,68 26,60 46,58 66,48 86,42 106,36 126,32 146,26 166,22 186,16 206,14";

export function SmaDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine />
      <DiagramLabel x={6} y={82} text="Prix" color="var(--lq-color-text-muted)" />
      <polyline points={SMOOTHED_OVERLAY} fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <DiagramLabel x={214} y={20} text="SMA" color="var(--lq-color-accent)" anchor="end" />
    </InfoDiagram>
  );
}

export function EmaDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine />
      <DiagramLabel x={6} y={82} text="Prix" color="var(--lq-color-text-muted)" />
      {/* Same shape as SMOOTHED_OVERLAY but pulled a little closer to price on the right — EMA's
          own "reacts faster to recent closes" trait, shown as visibly less lag near the end. */}
      <polyline
        points="6,68 26,58 46,60 66,44 86,44 106,30 126,34 146,20 166,26 186,12 206,14"
        fill="none"
        stroke="var(--lq-color-accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <DiagramLabel x={214} y={20} text="EMA" color="var(--lq-color-accent)" anchor="end" />
    </InfoDiagram>
  );
}

export function WmaDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine />
      <DiagramLabel x={6} y={82} text="Prix" color="var(--lq-color-text-muted)" />
      <polyline points={SMOOTHED_OVERLAY} fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} strokeDasharray="5 3" strokeLinecap="round" strokeLinejoin="round" />
      <DiagramLabel x={214} y={20} text="WMA" color="var(--lq-color-accent)" anchor="end" />
    </InfoDiagram>
  );
}

export function VwapDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine />
      <polyline points={SMOOTHED_OVERLAY} fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <DiagramLabel x={214} y={20} text="VWAP" color="var(--lq-color-accent)" anchor="end" />
      {/* A thin volume-bar row underneath — VWAP's own "weighted by volume" trait, the one thing
          distinguishing it from a plain price-weighted average like the three above. */}
      {[12, 42, 72, 102, 132, 162, 192].map((x, i) => (
        <rect key={x} x={x - 6} y={100 - [10, 16, 8, 14, 6, 12, 9][i]} width={12} height={[10, 16, 8, 14, 6, 12, 9][i]} fill="var(--lq-color-text-muted)" opacity={0.4} />
      ))}
      <DiagramLabel x={6} y={96} text="Volume" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}
