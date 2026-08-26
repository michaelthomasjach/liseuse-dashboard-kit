import { InfoDiagram, SamplePriceLine, DiagramPoint, DiagramLabel } from "./DiagramPrimitives";

export function MeasureDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <rect x={40} y={20} width={130} height={50} fill="var(--lq-color-down)" opacity={0.08} stroke="var(--lq-color-down)" strokeWidth={1.5} strokeDasharray="4 3" />
      <line x1={40} y1={70} x2={170} y2={20} stroke="var(--lq-color-down)" strokeWidth={2} strokeDasharray="4 3" />
      <DiagramPoint x={40} y={70} />
      <DiagramPoint x={170} y={20} />
      <DiagramLabel x={80} y={96} text="-4.2% · 12 barres · -8.7 points" color="var(--lq-color-down)" />
    </InfoDiagram>
  );
}
