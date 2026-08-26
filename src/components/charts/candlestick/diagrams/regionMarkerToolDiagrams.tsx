import { InfoDiagram, SamplePriceLine, DiagramPoint, DiagramLabel } from "./DiagramPrimitives";

export function RectangleDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <rect x={40} y={24} width={140} height={60} fill="var(--lq-color-accent)" opacity={0.12} stroke="var(--lq-color-accent)" strokeWidth={2} />
      <DiagramPoint x={40} y={24} />
      <DiagramPoint x={180} y={84} />
    </InfoDiagram>
  );
}

export function ZonesDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <rect x={20} y={12} width={180} height={26} fill="var(--lq-color-up)" opacity={0.15} />
      <rect x={20} y={38} width={180} height={26} fill="var(--lq-color-text-muted)" opacity={0.12} />
      <rect x={20} y={64} width={180} height={26} fill="var(--lq-color-down)" opacity={0.15} />
      <DiagramLabel x={24} y={26} text="Positif" color="var(--lq-color-up)" />
      <DiagramLabel x={24} y={78} text="Négatif" color="var(--lq-color-down)" />
    </InfoDiagram>
  );
}

export function ElbowArrowDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <polyline points="30,86 30,40 190,40" fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#arrowhead-elbow)" />
      <defs>
        <marker id="arrowhead-elbow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--lq-color-accent)" />
        </marker>
      </defs>
      <DiagramPoint x={30} y={86} />
    </InfoDiagram>
  );
}

export function BrushDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <path
        d="M10,90 C40,60 30,30 60,40 S110,80 140,50 S190,10 214,30"
        fill="none"
        stroke="var(--lq-color-accent)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <DiagramLabel x={6} y={12} text="Tracé libre au doigt/souris" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function ArrowUpDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <line x1={110} y1={80} x2={110} y2={30} stroke="var(--lq-color-up)" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M100,42 L110,26 L120,42 Z" fill="var(--lq-color-up)" />
    </InfoDiagram>
  );
}

export function ArrowDownDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <line x1={110} y1={30} x2={110} y2={80} stroke="var(--lq-color-down)" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M100,68 L110,84 L120,68 Z" fill="var(--lq-color-down)" />
    </InfoDiagram>
  );
}

export function ArrowLineDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <line x1={20} y1={86} x2={190} y2={26} stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" />
      <path d="M190,26 L176,20 L182,36 Z" fill="var(--lq-color-accent)" />
      <DiagramPoint x={20} y={86} />
    </InfoDiagram>
  );
}
