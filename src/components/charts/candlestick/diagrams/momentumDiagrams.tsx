import { InfoDiagram, SamplePriceLine, DiagramLabel } from "./DiagramPrimitives";

export function RsiDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.35} />
      <line x1={0} y1={26} x2={220} y2={26} stroke="var(--lq-color-down)" strokeWidth={1} strokeDasharray="2 3" />
      <line x1={0} y1={86} x2={220} y2={86} stroke="var(--lq-color-up)" strokeWidth={1} strokeDasharray="2 3" />
      <polyline
        points="6,70 26,60 46,66 66,32 86,44 106,20 126,50 146,70 166,90 186,80 206,60"
        fill="none"
        stroke="var(--lq-color-accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <DiagramLabel x={214} y={22} text="70 · surachat" color="var(--lq-color-down)" anchor="end" />
      <DiagramLabel x={214} y={98} text="30 · survente" color="var(--lq-color-up)" anchor="end" />
    </InfoDiagram>
  );
}

export function MacdDiagram() {
  return (
    <InfoDiagram>
      <line x1={0} y1={60} x2={220} y2={60} stroke="var(--lq-color-text-muted)" strokeWidth={1} opacity={0.5} />
      {[12, 42, 72, 102, 132, 162, 192].map((x, i) => {
        const h = [8, 14, 4, -6, -12, -4, 10][i];
        const color = h >= 0 ? "var(--lq-color-up)" : "var(--lq-color-down)";
        return <rect key={x} x={x - 6} y={h >= 0 ? 60 - h : 60} width={12} height={Math.abs(h)} fill={color} opacity={0.5} />;
      })}
      <polyline points="6,50 26,42 46,48 66,58 86,66 106,72 126,68 146,58 166,50 186,46 206,40" fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="6,54 26,48 46,50 66,54 86,60 106,66 126,70 146,66 166,58 186,52 206,46" fill="none" stroke="var(--lq-color-text-muted)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <DiagramLabel x={6} y={16} text="MACD / Signal + histogramme" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function AdxDiagram() {
  return (
    <InfoDiagram>
      <line x1={0} y1={70} x2={220} y2={70} stroke="var(--lq-color-text-muted)" strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
      <polyline points="6,90 26,84 46,78 66,68 86,58 106,50 126,44 146,40 166,38 186,40 206,44" fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="6,50 26,55 46,45 66,60 86,52 106,66 126,58 146,70 166,62 186,74 206,66" fill="none" stroke="var(--lq-color-up)" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="6,60 26,65 46,55 66,70 86,62 106,76 126,68 146,80 166,72 186,84 206,76" fill="none" stroke="var(--lq-color-down)" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" />
      <DiagramLabel x={214} y={40} text="ADX" color="var(--lq-color-accent)" anchor="end" />
      <DiagramLabel x={6} y={20} text="Force de la tendance (+DI/-DI)" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}
