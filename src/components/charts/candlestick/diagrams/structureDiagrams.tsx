import { InfoDiagram, SamplePriceLine, SampleCandles, DiagramLabel } from "./DiagramPrimitives";

export function GapsDiagram() {
  return (
    <InfoDiagram>
      <polyline points="6,70 40,50 76,58" fill="none" stroke="var(--lq-color-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <rect x={80} y={16} width={30} height={42} fill="var(--lq-color-accent)" opacity={0.12} />
      <polyline points="112,20 150,10 190,26 216,14" fill="none" stroke="var(--lq-color-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <DiagramLabel x={82} y={12} text="Gap" color="var(--lq-color-accent)" />
    </InfoDiagram>
  );
}

export function PatternRecognitionDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.25} />
      <polyline
        points="10,80 50,40 90,70 130,20 170,68 210,80"
        fill="none"
        stroke="var(--lq-color-accent)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1={10} y1={80} x2={210} y2={80} stroke="var(--lq-color-text-muted)" strokeWidth={1} strokeDasharray="2 3" />
      <DiagramLabel x={110} y={98} text="Épaule-tête-épaule, triangles, drapeaux…" color="var(--lq-color-text-muted)" anchor="middle" />
    </InfoDiagram>
  );
}

export function CandleRecognitionDiagram() {
  return (
    <InfoDiagram>
      <SampleCandles dim />
      <rect x={182 - 9} y={16} width={18} height={56} fill="none" stroke="var(--lq-color-accent)" strokeWidth={1.5} rx={3} />
      <DiagramLabel x={192} y={14} text="Marteau, avalante…" color="var(--lq-color-accent)" anchor="end" />
    </InfoDiagram>
  );
}

export function PivotPointsDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.9} />
      {[16, 34, 60, 86].map((y, i) => (
        <line key={y} x1={0} y1={y} x2={220} y2={y} stroke={i === 1 ? "var(--lq-color-accent)" : "var(--lq-color-text-muted)"} strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
      ))}
      <DiagramLabel x={6} y={12} text="R1" color="var(--lq-color-text-muted)" />
      <DiagramLabel x={6} y={30} text="PP" color="var(--lq-color-accent)" />
      <DiagramLabel x={6} y={82} text="S1" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function SupportResistanceDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.9} />
      <line x1={0} y1={26} x2={220} y2={26} stroke="var(--lq-color-down)" strokeWidth={1.5} strokeDasharray="4 3" />
      <line x1={0} y1={72} x2={220} y2={72} stroke="var(--lq-color-up)" strokeWidth={1.5} strokeDasharray="4 3" />
      <DiagramLabel x={6} y={22} text="Résistance" color="var(--lq-color-down)" />
      <DiagramLabel x={6} y={84} text="Support" color="var(--lq-color-up)" />
    </InfoDiagram>
  );
}

export function TpoDiagram() {
  return (
    <InfoDiagram>
      {Array.from({ length: 9 }, (_, row) => {
        const y = 12 + row * 9;
        const width = 20 + Math.round(60 * Math.sin((row / 8) * Math.PI));
        return <rect key={row} x={60} y={y} width={width} height={7} fill="var(--lq-color-accent)" opacity={row >= 3 && row <= 5 ? 0.5 : 0.2} />;
      })}
      <DiagramLabel x={6} y={16} text="Profil de volume par prix" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}
