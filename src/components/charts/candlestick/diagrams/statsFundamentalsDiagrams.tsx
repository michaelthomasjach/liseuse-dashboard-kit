import { InfoDiagram, DiagramLabel } from "./DiagramPrimitives";

export function CorrelationDiagram() {
  return (
    <InfoDiagram>
      <polyline points="6,70 40,50 76,60 110,30 146,44 180,20 216,32" fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="6,80 40,62 76,70 110,42 146,54 180,32 216,42" fill="none" stroke="var(--lq-color-text-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <DiagramLabel x={6} y={16} text="Coefficient -1 à +1 vs. un 2e symbole" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

// A plain ascending bar-per-period chart — the shared shape freeCashFlow/netIncome/totalRevenue
// all use, since each is fundamentally "this one number, over time" the same way.
function GrowthBars({ heights, color = "var(--lq-color-accent)" }: { heights: number[]; color?: string }) {
  const xs = [20, 56, 92, 128, 164, 200];
  return (
    <>
      {heights.map((h, i) => (
        <rect key={xs[i]} x={xs[i] - 14} y={96 - h} width={28} height={h} fill={color} opacity={0.55} />
      ))}
    </>
  );
}

export function FreeCashFlowDiagram() {
  return (
    <InfoDiagram>
      <GrowthBars heights={[30, 26, 42, 38, 58, 66]} />
      <DiagramLabel x={6} y={16} text="Trésorerie générée, par trimestre" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function NetIncomeDiagram() {
  return (
    <InfoDiagram>
      <GrowthBars heights={[24, 34, 20, 44, 40, 56]} />
      <DiagramLabel x={6} y={16} text="Bénéfice net, par trimestre" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function TotalRevenueDiagram() {
  return (
    <InfoDiagram>
      <GrowthBars heights={[40, 46, 50, 58, 62, 74]} />
      <DiagramLabel x={6} y={16} text="Chiffre d'affaires, par trimestre" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

// A horizontal percentage-fill bar — the shared shape netMargin/grossMargin both use, since a
// margin is fundamentally "what share of revenue" rather than a raw growing amount.
function MarginBar({ percent, label }: { percent: number; label: string }) {
  return (
    <>
      <rect x={20} y={44} width={180} height={22} fill="var(--lq-color-text-muted)" opacity={0.2} />
      <rect x={20} y={44} width={180 * percent} height={22} fill="var(--lq-color-accent)" opacity={0.6} />
      <DiagramLabel x={20} y={38} text={label} color="var(--lq-color-text-muted)" />
    </>
  );
}

export function NetMarginDiagram() {
  return (
    <InfoDiagram>
      <MarginBar percent={0.22} label="Marge nette = bénéfice net ÷ CA" />
    </InfoDiagram>
  );
}

export function GrossMarginDiagram() {
  return (
    <InfoDiagram>
      <MarginBar percent={0.55} label="Marge brute = (CA − coût des ventes) ÷ CA" />
    </InfoDiagram>
  );
}

export function PeRatioDiagram() {
  return (
    <InfoDiagram>
      <rect x={70} y={12} width={26} height={80} fill="var(--lq-color-accent)" opacity={0.55} />
      <rect x={120} y={64} width={26} height={28} fill="var(--lq-color-text-muted)" opacity={0.55} />
      <DiagramLabel x={83} y={8} text="Cours" color="var(--lq-color-accent)" anchor="middle" />
      <DiagramLabel x={133} y={60} text="BPA" color="var(--lq-color-text-muted)" anchor="middle" />
      <DiagramLabel x={6} y={16} text="P/E = cours ÷ bénéfice par action" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function EpsDiagram() {
  return (
    <InfoDiagram>
      <GrowthBars heights={[20, 26, 22, 34, 30, 42]} />
      <DiagramLabel x={6} y={16} text="Bénéfice net ÷ nombre d'actions" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function DebtToEquityDiagram() {
  return (
    <InfoDiagram>
      <rect x={70} y={30} width={30} height={62} fill="var(--lq-color-down)" opacity={0.5} />
      <rect x={120} y={16} width={30} height={76} fill="var(--lq-color-accent)" opacity={0.5} />
      <DiagramLabel x={85} y={26} text="Dette" color="var(--lq-color-down)" anchor="middle" />
      <DiagramLabel x={135} y={12} text="Capitaux propres" color="var(--lq-color-accent)" anchor="middle" />
    </InfoDiagram>
  );
}
