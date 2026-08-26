import { InfoDiagram, SamplePriceLine, DiagramPoint, DiagramLabel } from "./DiagramPrimitives";

export function TrendlineDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.35} />
      <line x1={30} y1={80} x2={190} y2={20} stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" />
      <DiagramPoint x={30} y={80} />
      <DiagramPoint x={190} y={20} />
    </InfoDiagram>
  );
}

export function ExtendedDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.35} />
      <line x1={4} y1={92} x2={216} y2={8} stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" strokeDasharray="1 0" />
      <DiagramPoint x={60} y={68} />
      <DiagramPoint x={140} y={38} />
      <DiagramLabel x={6} y={100} text="Prolongée des deux côtés" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function ChannelDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <polygon points="20,86 190,26 190,50 20,110" fill="var(--lq-color-accent)" opacity={0.1} />
      <line x1={20} y1={86} x2={190} y2={26} stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" />
      <line x1={20} y1={110} x2={190} y2={50} stroke="var(--lq-color-accent)" strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
      <DiagramPoint x={20} y={86} />
      <DiagramPoint x={190} y={26} />
    </InfoDiagram>
  );
}

export function DisjointChannelDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <line x1={20} y1={86} x2={190} y2={30} stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" />
      <line x1={30} y1={92} x2={210} y2={54} stroke="var(--lq-color-accent)" strokeWidth={1.5} strokeLinecap="round" strokeDasharray="4 3" opacity={0.8} />
      <DiagramPoint x={20} y={86} />
      <DiagramPoint x={190} y={30} />
      <DiagramPoint x={30} y={92} />
      <DiagramPoint x={210} y={54} />
      <DiagramLabel x={6} y={16} text="4 points, pentes indépendantes" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function HorizontalDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.4} />
      <line x1={0} y1={44} x2={220} y2={44} stroke="var(--lq-color-accent)" strokeWidth={2} />
      <DiagramLabel x={6} y={38} text="Un seul prix, toute la largeur" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function RayDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.4} />
      <line x1={90} y1={44} x2={220} y2={44} stroke="var(--lq-color-accent)" strokeWidth={2} />
      <DiagramPoint x={90} y={44} label="Date" />
      <DiagramLabel x={220} y={38} text="→" color="var(--lq-color-accent)" anchor="end" />
    </InfoDiagram>
  );
}

export function VerticalDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.4} />
      <line x1={110} y1={0} x2={110} y2={110} stroke="var(--lq-color-accent)" strokeWidth={2} />
      <DiagramLabel x={116} y={12} text="Une date" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}
