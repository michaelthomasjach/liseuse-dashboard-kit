import { InfoDiagram, SamplePriceLine, DiagramPoint, DiagramLabel } from "./DiagramPrimitives";

export function ForecastDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <path d="M20,90 Q120,20 200,50" fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" strokeDasharray="6 4" />
      <DiagramPoint x={20} y={90} />
      <DiagramPoint x={200} y={50} />
      <DiagramLabel x={110} y={16} text="Projection courbe" color="var(--lq-color-text-muted)" anchor="middle" />
    </InfoDiagram>
  );
}

export function RangeForecastDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <line x1={30} y1={60} x2={190} y2={14} stroke="var(--lq-color-up)" strokeWidth={2} strokeLinecap="round" />
      <line x1={30} y1={60} x2={190} y2={106} stroke="var(--lq-color-down)" strokeWidth={2} strokeLinecap="round" />
      <line x1={30} y1={60} x2={190} y2={60} stroke="var(--lq-color-text-muted)" strokeWidth={1.5} strokeDasharray="3 3" />
      <DiagramPoint x={30} y={60} label="Départ" />
      <DiagramLabel x={196} y={14} text="Max" color="var(--lq-color-up)" />
      <DiagramLabel x={196} y={106} text="Min" color="var(--lq-color-down)" />
    </InfoDiagram>
  );
}

export function LongPositionDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <rect x={30} y={16} width={160} height={30} fill="var(--lq-color-up)" opacity={0.15} />
      <rect x={30} y={70} width={160} height={26} fill="var(--lq-color-down)" opacity={0.15} />
      <line x1={30} y1={60} x2={190} y2={60} stroke="var(--lq-color-accent)" strokeWidth={2} />
      <DiagramLabel x={34} y={30} text="Objectif" color="var(--lq-color-up)" />
      <DiagramLabel x={34} y={54} text="Entrée" color="var(--lq-color-accent)" />
      <DiagramLabel x={34} y={86} text="Stop" color="var(--lq-color-down)" />
    </InfoDiagram>
  );
}

export function ShortPositionDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <rect x={30} y={70} width={160} height={30} fill="var(--lq-color-up)" opacity={0.15} />
      <rect x={30} y={16} width={160} height={26} fill="var(--lq-color-down)" opacity={0.15} />
      <line x1={30} y1={60} x2={190} y2={60} stroke="var(--lq-color-accent)" strokeWidth={2} />
      <DiagramLabel x={34} y={30} text="Stop" color="var(--lq-color-down)" />
      <DiagramLabel x={34} y={54} text="Entrée" color="var(--lq-color-accent)" />
      <DiagramLabel x={34} y={86} text="Objectif" color="var(--lq-color-up)" />
    </InfoDiagram>
  );
}
