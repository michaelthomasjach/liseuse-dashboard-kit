import { InfoDiagram, DiagramPoint, DiagramLabel } from "./DiagramPrimitives";

const FIB_LEVELS: [number, string][] = [
  [10, "1.0"],
  [30, "0.618"],
  [50, "0.5"],
  [70, "0.382"],
  [100, "0"],
];

export function FibonacciDiagram() {
  return (
    <InfoDiagram>
      {FIB_LEVELS.map(([y, label]) => (
        <g key={y}>
          <line x1={20} y1={y} x2={200} y2={y} stroke="var(--lq-color-text-muted)" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
          <DiagramLabel x={204} y={y + 3} text={label} color="var(--lq-color-text-muted)" />
        </g>
      ))}
      <line x1={20} y1={10} x2={20} y2={100} stroke="var(--lq-color-accent)" strokeWidth={2} />
      <DiagramPoint x={20} y={10} />
      <DiagramPoint x={20} y={100} />
    </InfoDiagram>
  );
}

export function FibonacciExtensionDiagram() {
  return (
    <InfoDiagram>
      <polyline points="20,90 90,20 140,60" fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <line x1={140} y1={12} x2={220} y2={12} stroke="var(--lq-color-text-muted)" strokeWidth={1} strokeDasharray="3 3" />
      <line x1={140} y1={44} x2={220} y2={44} stroke="var(--lq-color-text-muted)" strokeWidth={1} strokeDasharray="3 3" />
      <DiagramPoint x={20} y={90} label="A" />
      <DiagramPoint x={90} y={20} label="B" />
      <DiagramPoint x={140} y={60} label="C" />
      <DiagramLabel x={216} y={10} text="1.618" color="var(--lq-color-text-muted)" anchor="end" />
    </InfoDiagram>
  );
}

export function ElliottImpulseDiagram() {
  return (
    <InfoDiagram>
      <polyline points="10,90 40,50 60,64 90,20 110,36 150,8 170,26 200,10" fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {[
        [10, 90, "0"],
        [40, 50, "1"],
        [60, 64, "2"],
        [90, 20, "3"],
        [110, 36, "4"],
        [150, 8, "5"],
      ].map(([x, y, l]) => (
        <DiagramPoint key={l} x={x as number} y={y as number} label={l as string} />
      ))}
    </InfoDiagram>
  );
}

export function ElliottCorrectionDiagram() {
  return (
    <InfoDiagram>
      <polyline points="20,20 70,64 110,40 150,80 200,50" fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {[
        [20, 20, "0"],
        [70, 64, "A"],
        [110, 40, "B"],
        [150, 80, "C"],
      ].map(([x, y, l]) => (
        <DiagramPoint key={l} x={x as number} y={y as number} label={l as string} />
      ))}
    </InfoDiagram>
  );
}

export function HeadShouldersDiagram() {
  return (
    <InfoDiagram>
      <polyline
        points="16,80 50,34 66,54 92,10 118,54 134,34 168,80"
        fill="none"
        stroke="var(--lq-color-accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1={16} y1={80} x2={216} y2={80} stroke="var(--lq-color-text-muted)" strokeWidth={1} strokeDasharray="3 3" />
      <DiagramLabel x={44} y={28} text="Épaule" color="var(--lq-color-text-muted)" anchor="middle" />
      <DiagramLabel x={92} y={6} text="Tête" color="var(--lq-color-text-muted)" anchor="middle" />
      <DiagramLabel x={140} y={28} text="Épaule" color="var(--lq-color-text-muted)" anchor="middle" />
      <DiagramLabel x={175} y={92} text="Ligne de cou" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function CupHandleDiagram() {
  return (
    <InfoDiagram>
      <line x1={16} y1={24} x2={166} y2={24} stroke="var(--lq-color-text-muted)" strokeWidth={1} strokeDasharray="3 3" />
      <polyline points="16,24 60,84 104,24 134,50 164,30" fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {[
        [16, 24, "A"],
        [60, 84, "B"],
        [104, 24, "C"],
        [134, 50, "D"],
        [164, 30, "E"],
      ].map(([x, y, l]) => (
        <DiagramPoint key={l} x={x as number} y={y as number} label={l as string} />
      ))}
      <DiagramLabel x={172} y={30} text="Tasse ↑ anse" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}
