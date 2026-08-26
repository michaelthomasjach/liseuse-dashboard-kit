import { InfoDiagram, SamplePriceLine, DiagramPoint, DiagramLabel } from "./DiagramPrimitives";

export function ZigzagDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.35} />
      <polyline points="6,74 40,58 76,84 130,18 176,40 212,8" fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <DiagramPoint x={6} y={74} label="LL" />
      <DiagramPoint x={40} y={58} label="HH" />
      <DiagramPoint x={76} y={84} label="LL" />
      <DiagramPoint x={130} y={18} label="HH" />
      <DiagramPoint x={176} y={40} label="LH" />
      <DiagramPoint x={212} y={8} label="HH" />
    </InfoDiagram>
  );
}

export function SupertrendDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.9} />
      <polyline points="6,90 60,80 110,70 150,64" fill="none" stroke="var(--lq-color-up)" strokeWidth={2} strokeLinecap="round" />
      <polyline points="150,30 190,26 216,22" fill="none" stroke="var(--lq-color-down)" strokeWidth={2} strokeLinecap="round" />
      <DiagramLabel x={40} y={100} text="Support (haussier)" color="var(--lq-color-up)" />
      <DiagramLabel x={214} y={16} text="Résistance" color="var(--lq-color-down)" anchor="end" />
    </InfoDiagram>
  );
}

export function ParabolicSarDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.9} />
      {[6, 26, 46, 66, 86, 106].map((x, i) => (
        <circle key={x} cx={x} cy={78 - i * 3} r={2.2} fill="var(--lq-color-up)" />
      ))}
      {[126, 146, 166, 186, 206].map((x, i) => (
        <circle key={x} cx={x} cy={12 + i * 3} r={2.2} fill="var(--lq-color-down)" />
      ))}
      <DiagramLabel x={6} y={94} text="Points sous le prix : haussier" color="var(--lq-color-up)" />
    </InfoDiagram>
  );
}

export function IchimokuDiagram() {
  return (
    <InfoDiagram>
      <polygon
        points="6,60 26,50 46,54 66,40 86,44 106,32 126,36 146,26 166,30 186,20 206,24 206,44 186,40 166,50 146,46 126,56 106,52 86,64 66,60 46,74 26,70 6,80"
        fill="var(--lq-color-accent)"
        opacity={0.15}
      />
      <SamplePriceLine opacity={0.9} />
      <DiagramLabel x={214} y={24} text="Kumo" color="var(--lq-color-accent)" anchor="end" />
    </InfoDiagram>
  );
}

export function ChandelierExitDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.9} />
      <line x1={6} y1={92} x2={130} y2={92} stroke="var(--lq-color-up)" strokeWidth={2} />
      <line x1={140} y1={16} x2={216} y2={16} stroke="var(--lq-color-down)" strokeWidth={2} />
      <DiagramLabel x={6} y={104} text="Stop long — sous le plus haut" color="var(--lq-color-up)" />
    </InfoDiagram>
  );
}
