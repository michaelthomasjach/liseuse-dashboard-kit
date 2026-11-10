import type { ReactNode } from "react";
import { ChartWorkspace } from "../../ChartWorkspace";
import { CandlestickChart } from "../../CandlestickChart";
import { generateCandles } from "../../../../test-data/financeSampleData";
import type { Candle } from "../interfaces/Candle.interface";
import type { CustomIndicatorDef } from "../interfaces/CustomIndicatorDef.interface";
import type { Indicator } from "../interfaces/Indicator.interface";

/* Scène du banc de performance du survol (scripts/benchChartHover.cjs) : la configuration la plus
 * chargée qu'une application réelle affiche — un espace de travail, des bougies quotidiennes, le
 * volume et cinq panneaux de comptes trimestriels en escalier avec un cercle par publication (le
 * setup « Analyse financière » de Macro Rates). Données déterministes : deux mesures se comparent.
 * Servie seule (perf/app, sans Storybook, dont le module de surlignage parcourt tout le DOM à chaque
 * mutation et fausserait la mesure), et aussi en story pour l'essayer à la main. */

const PANES = [
  { id: "revenue", label: "Chiffre d'affaires", color: "#4f8fe8", base: 60e9 },
  { id: "net", label: "Bénéfice net", color: "#3fb27f", base: 30e9 },
  { id: "fcf", label: "Free cash flow", color: "#9b72cb", base: 20e9 },
  { id: "capex", label: "CAPEX", color: "#e8a33d", base: 2e9 },
  { id: "debt", label: "Dette totale", color: "#d9573f", base: 9e9 },
  { id: "cash", label: "Trésorerie", color: "#2aa6b8", base: 40e9 },
  { id: "equity", label: "Capitaux propres", color: "#8a8f98", base: 80e9 },
  { id: "rnd", label: "R&D", color: "#c56fb5", base: 4e9 },
];

const money = (v: number) => {
  const a = Math.abs(v);
  return a >= 1e9 ? `${(v / 1e9).toFixed(1)} B$` : a >= 1e6 ? `${(v / 1e6).toFixed(0)} M$` : `${(v / 1e3).toFixed(0)} k$`;
};

/** Une valeur par trimestre, posée sur une bougie (comme Macro Rates). */
function stepPane(data: Candle[], p: (typeof PANES)[number], k: number): CustomIndicatorDef {
  const points: { date: Date; values: Record<string, number> }[] = [];
  let value = p.base;
  for (let i = 0; i < data.length; i += 63) {
    value *= 1 + (((i * 7 + k * 13) % 17) - 6) / 100;
    points.push({ date: data[i].date, values: { v: value, p: value } });
  }
  return {
    id: `bench-${p.id}`,
    label: `${p.label} (trimestre)`,
    shortLabel: p.label,
    section: "Banc",
    type: "own",
    draw: "multi",
    multiSeries: [
      { key: "v", label: p.label, draw: "line", color: p.color, lineWidth: 2 },
      { key: "p", label: `${p.label} (publication)`, draw: "dots", color: p.color, lineWidth: 5 },
    ],
    data: points,
    formatValue: money,
  };
}

/** Le reste d'une page d'application autour du graphique (liste de suivi, fil d'actualités) : une
 *  mise en page ou une peinture forcée coûte d'autant plus cher que le document est grand. */
function HeavyPage({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 260px", gap: 12 }}>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 12, maxHeight: 1400, overflow: "auto" }}>
        {Array.from({ length: 1500 }, (_, i) => (
          <li key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 4px" }}>
            <span>SYM{i}</span>
            <span>{(100 + ((i * 37) % 900) / 10).toFixed(2)}</span>
            <span style={{ color: i % 3 ? "#3fb27f" : "#d9573f" }}>{(((i * 13) % 70) / 10 - 3).toFixed(2)} %</span>
          </li>
        ))}
      </ul>
      <div style={{ minWidth: 0 }}>{children}</div>
      <div style={{ fontSize: 12, maxHeight: 1400, overflow: "auto" }}>
        {Array.from({ length: 600 }, (_, i) => (
          <article key={i} style={{ padding: "6px 0", borderBottom: "1px solid #ddd" }}>
            <strong>Titre d'actualité n° {i}</strong>
            <p style={{ margin: "2px 0" }}>Un paragraphe de résumé, comme dans le fil d'actualités d'une application.</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export interface HoverBenchSceneProps {
  panes: number;
  workspace: boolean;
  candles: number;
  page: boolean;
}

export function HoverBenchScene({ panes, workspace, candles, page }: HoverBenchSceneProps) {
  const data = generateCandles(candles, 180, 42);
  const defs = PANES.slice(0, panes).map((p, k) => stepPane(data, p, k));
  const indicators: Indicator[] = defs.map((def) => ({ id: def.id, kind: "custom", period: 0, customData: def }));
  const chart = (
    <CandlestickChart
      data={data}
      symbol="BENCH"
      height={780}
      defaultPaneHeightFraction={0.11}
      initialVisibleCandles={160}
      showVolume
      drawingTools
      showIndicators
      replay
      defaultIndicators={indicators}
    />
  );
  const body = workspace ? (
    <ChartWorkspace defaultPanels={1} panelHeight={780 + panes * 110}>
      {chart}
    </ChartWorkspace>
  ) : (
    chart
  );
  return (
    <div data-bench-root style={{ padding: 16 }}>
      {page ? <HeavyPage>{body}</HeavyPage> : body}
    </div>
  );
}
