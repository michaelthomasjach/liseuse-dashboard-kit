import type { ReactNode } from "react";
import { LineAreaChart } from "../components/charts/LineAreaChart";
import { BarChart } from "../components/charts/BarChart";
import { DonutChart } from "../components/charts/DonutChart";
import { GaugeChart } from "../components/charts/GaugeChart";
import { Heatmap, type HeatmapGroup } from "../components/charts/Heatmap";
import { DeltaChart } from "../components/charts/DeltaChart";
import { EarningsDotChart } from "../components/charts/EarningsDotChart";
import { WorldExposureMap } from "../components/charts/WorldExposureMap";
import type { SymbolProfileEarningsPoint } from "../components/charts/workspace/SymbolProfile.interface";
import { generateSeries, SAMPLE_ALLOCATION } from "../test-data/financeSampleData";
import { COMPANY_BRAND, COMPANY_LOGOS } from "../test-data/companyLogos";
import { useMeasuredWidth } from "./useMeasuredWidth";

/** Stage height, in CSS pixels, shared by JavaScript and the stylesheet.
 *
 *  Charts here take a numeric `height`; the cell they sit in is sized in CSS. Both read these two
 *  constants (the stylesheet through the custom properties set on the grid below) so a chart can
 *  fill its card exactly instead of leaving a band of card showing under it. */
const STAGE_H = 268;
const STAGE_H_WIDE = 320;

const PORTFOLIO = generateSeries(120, 40_000, 11);
const BENCHMARK = generateSeries(120, 40_000, 27);

const MONTHLY_RETURNS = [
  { id: "jan", label: "Jan", value: 2.1 },
  { id: "fev", label: "Fév", value: -1.4 },
  { id: "mar", label: "Mar", value: 3.4 },
  { id: "avr", label: "Avr", value: 0.8 },
  { id: "mai", label: "Mai", value: -2.6 },
  { id: "jun", label: "Juin", value: 4.2 },
  { id: "jui", label: "Juil", value: 1.5 },
  { id: "aou", label: "Août", value: -0.7 },
];

const EARNINGS: SymbolProfileEarningsPoint[] = [
  { date: "T1 25", estimateEps: 2.55, actualEps: 2.94 },
  { date: "T2 25", estimateEps: 2.93, actualEps: 2.95 },
  { date: "T3 25", estimateEps: 3.1, actualEps: 3.3 },
  { date: "T4 25", estimateEps: 3.11, actualEps: 3.02 },
  { date: "T1 26", estimateEps: 3.22, actualEps: 3.46 },
  { date: "T2 26", estimateEps: 3.35, actualEps: 3.31 },
  { date: "T3 26", estimateEps: 3.6, actualEps: 3.72 },
  { date: "T4 26", estimateEps: 3.78 },
];

function tile(id: string, label: string, capB: number, changePct: number) {
  return {
    id,
    label,
    value: capB,
    colorValue: changePct,
    logoUrl: COMPANY_LOGOS[label],
    logoColor: COMPANY_BRAND[label],
    formattedValue: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)} %`,
  };
}

const SECTORS: HeatmapGroup[] = [
  {
    id: "tech",
    label: "Technologie",
    tiles: [tile("aapl", "AAPL", 3400, 0.8), tile("msft", "MSFT", 3100, -0.4), tile("nvda", "NVDA", 5200, 5.2), tile("avgo", "AVGO", 1100, 1.4)],
  },
  {
    id: "fin",
    label: "Finance",
    tiles: [tile("jpm", "JPM", 690, -1.1), tile("brk", "BRK.B", 980, 0.3), tile("v", "V", 560, 0.9)],
  },
  {
    id: "energy",
    label: "Énergie",
    tiles: [tile("xom", "XOM", 480, -2.3), tile("cvx", "CVX", 290, -1.7)],
  },
];

/* Labels the map itself can resolve. `matchContinent` (worldGeo.ts) matches regions, not
   countries: "France" or "Japon" fall through to "Non localisable", which is exactly what the
   first draft of this list did with 39 % of the portfolio. */
const EXPOSURE = [
  { id: "na", label: "Amérique du Nord", value: 54 },
  { id: "eu", label: "Europe", value: 24 },
  { id: "asia", label: "Asie", value: 12 },
  { id: "latam", label: "Amérique du Sud", value: 5 },
  { id: "me", label: "Moyen-Orient", value: 3 },
  { id: "africa", label: "Afrique", value: 2 },
];

/** One chart filling its card edge to edge, with the component's name and purpose on a strip
 *  underneath. The name opens the chart's own documentation.
 *
 *  `children` is a function of the stage's measured width, because half of these charts take a
 *  numeric `width` and measure nothing themselves. */
function Frame({
  name,
  purpose,
  wide,
  onOpen,
  children,
}: {
  name: string;
  purpose: string;
  wide?: boolean;
  onOpen: () => void;
  children: (width: number, height: number) => ReactNode;
}) {
  const [ref, width] = useMeasuredWidth();
  const height = wide ? STAGE_H_WIDE : STAGE_H;
  return (
    <figure className={["lqx-chart-frame", wide && "lqx-chart-frame--wide"].filter(Boolean).join(" ")}>
      <div className="lqx-chart-frame__stage" ref={ref}>
        {width > 0 && children(width, height)}
      </div>
      <figcaption className="lqx-chart-frame__foot">
        <button type="button" className="lqx-chart-frame__name" onClick={onOpen}>
          {name}
        </button>
        <span className="lqx-chart-frame__purpose">{purpose}</span>
      </figcaption>
    </figure>
  );
}

/** Eight of the eleven charts, live, laid out full-width / two-up / full-width so no row ever
 *  ends with a hole in it. The two left out are CandlestickChart, which already has the hero to
 *  itself, and SeasonalityView, which needs a full candle history behind it and reads as an empty
 *  grid at this size. */
export function ChartGallery({ open }: { open: (path: string) => void }) {
  return (
    <div
      className="lqx-charts"
      style={{ ["--lqx-stage-h" as string]: `${STAGE_H}px`, ["--lqx-stage-h-wide" as string]: `${STAGE_H_WIDE}px` }}
    >
      <Frame
        name="LineAreaChart"
        purpose="Deux séries superposées, portefeuille en haut et indice en dessous"
        wide
        onOpen={() => open("/docs/charts-lineareachart--docs")}
      >
        {(_w, h) => (
          <LineAreaChart
            height={h}
            area
            embedded
            // On by default and rendered beside the plot, where the chart's own `overflow: hidden`
            // cuts it off; the frame's caption names the two series instead.
            showLegend={false}
            series={[
              { id: "portfolio", label: "Portefeuille", data: PORTFOLIO },
              { id: "benchmark", label: "MSCI World", data: BENCHMARK },
            ]}
            formatY={(v) => `${(v / 1000).toFixed(0)} k€`}
            formatX={(x) => (x as Date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
          />
        )}
      </Frame>

      <Frame name="Heatmap" purpose="Capitalisation et variation par secteur" onOpen={() => open("/docs/charts-heatmap--docs")}>
        {(w, h) => <Heatmap groups={SECTORS} width={w} height={h} />}
      </Frame>

      <Frame name="DonutChart" purpose="Répartition, avec valeur au centre" onOpen={() => open("/docs/charts-donutchart--docs")}>
        {(w, h) => (
          // The ring is as big as the shorter side allows once the legend under it has its rows.
          <DonutChart data={SAMPLE_ALLOCATION} size={Math.max(120, Math.min(w - 32, h - 104))} centerValue="48 %" centerCaption="Actions" />
        )}
      </Frame>

      <Frame name="BarChart" purpose="Barres colorées par signe" onOpen={() => open("/docs/charts-barchart--docs")}>
        {(_w, h) => <BarChart data={MONTHLY_RETURNS} colorByValue embedded height={h} formatValue={(v) => `${v.toFixed(1)} %`} />}
      </Frame>

      <Frame name="GaugeChart" purpose="Score borné, avec seuils colorés" onOpen={() => open("/docs/charts-gaugechart--docs")}>
        {(w, h) => (
          // A gauge is a half-disc: its drawn height is about 0.63 of its width, plus the value
          // and its label underneath.
          <GaugeChart
            value={68}
            min={0}
            max={100}
            size={Math.max(140, Math.min(w - 32, Math.round((h - 72) / 0.63)))}
            label="Score de risque"
            formatValue={(v) => `${v}`}
            thresholds={[
              { upTo: 33, color: "var(--lq-color-up)" },
              { upTo: 66, color: "var(--lq-color-warning)" },
              { upTo: 100, color: "var(--lq-color-down)" },
            ]}
          />
        )}
      </Frame>

      <Frame name="DeltaChart" purpose="Pont de valeurs, sous-totaux inclus" onOpen={() => open("/docs/charts-deltachart--docs")}>
        {(_w, h) => (
          <DeltaChart
            embedded
            showLegend={false}
            height={h}
            formatValue={(v) => `${v.toFixed(1)} Md$`}
            items={[
              { id: "cap", label: "Capitalisation", value: 169.6 },
              { id: "debt", label: "Dette", value: 19.2 },
              { id: "minority", label: "Minoritaires", value: 0.3 },
              { id: "cash", label: "Trésorerie", value: -4.5 },
              { id: "ev", label: "Valeur d'ent.", value: 184.6, isTotal: true },
            ]}
          />
        )}
      </Frame>

      <Frame name="EarningsDotChart" purpose="Résultats attendus contre publiés" onOpen={() => open("/docs/charts-earningsdotchart--docs")}>
        {(w, h) => <EarningsDotChart points={EARNINGS} width={w} height={h} fill />}
      </Frame>

      <Frame
        name="WorldExposureMap"
        purpose="Exposition géographique du portefeuille"
        wide
        onOpen={() => open("/docs/charts-worldexposuremap--docs")}
      >
        {(w, h) => <WorldExposureMap data={EXPOSURE} width={w} height={h} formatValue={(v) => `${v} %`} />}
      </Frame>
    </div>
  );
}
