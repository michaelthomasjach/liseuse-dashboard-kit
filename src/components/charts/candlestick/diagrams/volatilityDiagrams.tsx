import { InfoDiagram, SamplePriceLine, DiagramLabel } from "./DiagramPrimitives";

export function BollingerDiagram() {
  return (
    <InfoDiagram>
      <polyline points="6,50 26,38 46,44 66,26 86,32 106,16 126,22 146,10 166,16 186,6 206,10" fill="none" stroke="var(--lq-color-text-muted)" strokeWidth={1} opacity={0.6} />
      <polyline points="6,88 26,78 46,82 66,66 86,70 106,56 126,60 146,48 166,52 186,44 206,46" fill="none" stroke="var(--lq-color-text-muted)" strokeWidth={1} opacity={0.6} />
      <polygon
        points="6,50 26,38 46,44 66,26 86,32 106,16 126,22 146,10 166,16 186,6 206,10 206,46 186,44 166,52 146,48 126,60 106,56 86,70 66,66 46,82 26,78 6,88"
        fill="var(--lq-color-accent)"
        opacity={0.08}
      />
      <SamplePriceLine opacity={0.9} />
      <DiagramLabel x={214} y={10} text="Bande sup." color="var(--lq-color-text-muted)" anchor="end" />
      <DiagramLabel x={214} y={50} text="Bande inf." color="var(--lq-color-text-muted)" anchor="end" />
    </InfoDiagram>
  );
}

export function ChopDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine />
      <line x1={0} y1={92} x2={220} y2={92} stroke="var(--lq-color-text-muted)" strokeWidth={1} strokeDasharray="2 3" />
      <polyline
        points="6,96 26,96 46,98 66,100 86,102 106,102 126,98 146,94 166,102 186,104 206,100"
        fill="none"
        stroke="var(--lq-color-accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <DiagramLabel x={6} y={92} text="0-100 : range ↔ tendance" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function AtrDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine />
      {[12, 42, 72, 102, 132, 162, 192].map((x, i) => (
        <rect key={x} x={x - 6} y={100 - [8, 20, 12, 24, 10, 18, 14][i]} width={12} height={[8, 20, 12, 24, 10, 18, 14][i]} fill="var(--lq-color-accent)" opacity={0.35} />
      ))}
      <DiagramLabel x={6} y={96} text="Amplitude moyenne" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}
