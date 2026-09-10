import type { Meta, StoryObj } from "@storybook/react";
import { Heatmap } from "./Heatmap";
import type { HeatmapGroup } from "./Heatmap";
import { COMPANY_BRAND, COMPANY_LOGOS } from "../../test-data/companyLogos";

const meta: Meta<typeof Heatmap> = {
  title: "Charts/Heatmap",
  component: Heatmap,
};
export default meta;
type Story = StoryObj<typeof Heatmap>;

function tile(id: string, label: string, marketCapB: number, changePct: number) {
  return {
    id,
    label,
    value: marketCapB,
    colorValue: changePct,
    // What a real application passes here is its data provider's own logo URL; these fixtures
    // carry a generated one so the story renders the same offline (see `companyLogos.ts`).
    logoUrl: COMPANY_LOGOS[label],
    logoColor: COMPANY_BRAND[label],
    formattedValue: `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)} %`,
    tooltip: (
      <>
        <strong>{label}</strong>
        <span>{marketCapB.toFixed(1)} Md$ de capitalisation</span>
        <span>
          {changePct >= 0 ? "+" : ""}
          {changePct.toFixed(2)} % (1 jour)
        </span>
      </>
    ),
  };
}

const SAMPLE_GROUPS: HeatmapGroup[] = [
  {
    id: "tech",
    label: "Technologie",
    tiles: [
      tile("aapl", "AAPL", 3400, 0.8),
      tile("msft", "MSFT", 3100, -0.4),
      tile("nvda", "NVDA", 5200, 5.2),
      tile("googl", "GOOGL", 2100, 1.1),
      tile("meta", "META", 1400, -1.8),
      tile("orcl", "ORCL", 520, 2.6),
      tile("adbe", "ADBE", 230, -0.9),
      tile("crm", "CRM", 260, 0.5),
    ],
  },
  {
    id: "finance",
    label: "Finance",
    tiles: [
      tile("jpm", "JPM", 640, 0.3),
      tile("v", "V", 560, 1.4),
      tile("ma", "MA", 470, 1.2),
      tile("bac", "BAC", 320, -0.7),
      tile("wfc", "WFC", 240, -1.1),
      tile("gs", "GS", 180, 2.1),
    ],
  },
  {
    id: "health",
    label: "Santé",
    tiles: [
      tile("lly", "LLY", 780, 3.4),
      tile("unh", "UNH", 480, -2.3),
      tile("jnj", "JNJ", 360, 0.2),
      tile("abbv", "ABBV", 330, 0.6),
      tile("mrk", "MRK", 260, -1.6),
    ],
  },
  {
    id: "energy",
    label: "Énergie",
    tiles: [
      tile("xom", "XOM", 480, -0.5),
      tile("cvx", "CVX", 280, -1.2),
      tile("wti", "WTI", 90, 2.8),
    ],
  },
  {
    id: "consumer",
    label: "Consommation",
    tiles: [
      tile("amzn", "AMZN", 1900, 1.9),
      tile("tsla", "TSLA", 800, -3.4),
      tile("wmt", "WMT", 640, 0.4),
      tile("hd", "HD", 360, -0.3),
      tile("nke", "NKE", 110, -2.1),
      tile("mcd", "MCD", 210, 0.7),
    ],
  },
];

export const StockHeatmap: Story = {
  render: () => <Heatmap groups={SAMPLE_GROUPS} width={900} height={560} />,
};

export const Compact: Story = {
  render: () => <Heatmap groups={SAMPLE_GROUPS} width={640} height={400} />,
};
