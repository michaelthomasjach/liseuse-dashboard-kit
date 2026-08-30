import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ChartWorkspace } from "./ChartWorkspace";
import { CandlestickChart } from "./CandlestickChart";
import { generateCandles } from "../../test-data/financeSampleData";
import type { ChartWorkspaceWatchlist } from "./workspace/ChartWorkspaceWatchlist.interface";
import type { SymbolProfile } from "./workspace/SymbolProfile.interface";

const meta: Meta<typeof ChartWorkspace> = {
  title: "Charts/ChartWorkspace",
  component: ChartWorkspace,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ChartWorkspace>;

// Different lengths/base prices/seeds per symbol on purpose — proves the crosshair sync lines up
// by *date*, not by raw candle index, across panels whose own data doesn't otherwise match up.
const DATASETS: Record<string, ReturnType<typeof generateCandles>> = {
  AAPL: generateCandles(400, 190, 11),
  MSFT: generateCandles(320, 410, 27),
  NVDA: generateCandles(400, 120, 42),
  GOOGL: generateCandles(260, 165, 58),
  TSLA: generateCandles(340, 240, 73),
  AMZN: generateCandles(300, 175, 19),
  META: generateCandles(280, 480, 35),
  AMD: generateCandles(360, 140, 88),
};

export const EightPanels: Story = {
  name: "8 panneaux (2 liés, changer la disposition)",
  render: () => {
    const [groups, setGroups] = useState<number[][]>([[0, 1]]);
    return (
      <div style={{ padding: 24 }}>
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
          `defaultPanels={8}` — huit graphiques pré-configurés en enfants ; AAPL et MSFT (panneaux 1 et 2) sont
          liés par défaut (`defaultLinkGroups`) : survoler l'une des deux affiche le crosshair sur l'autre, à la
          date la plus proche dans <em>ses propres</em> données (longueurs et plages différentes entre les huit
          séries, exprès). Chaque panneau a sa propre icône grille (écran divisé, 2/4/6/8) et icône chaîne
          (gestion des groupes) dans son en-tête — cliquer la grille change la disposition pour l'espace de
          travail entier, quel que soit le panneau depuis lequel on clique.
        </p>
        <ChartWorkspace defaultPanels={8} defaultLinkGroups={groups} onLinkGroupsChange={setGroups}>
          <CandlestickChart data={DATASETS.AAPL} symbol="AAPL" zoomable />
          <CandlestickChart data={DATASETS.MSFT} symbol="MSFT" zoomable />
          <CandlestickChart data={DATASETS.NVDA} symbol="NVDA" zoomable />
          <CandlestickChart data={DATASETS.GOOGL} symbol="GOOGL" zoomable />
          <CandlestickChart data={DATASETS.TSLA} symbol="TSLA" zoomable />
          <CandlestickChart data={DATASETS.AMZN} symbol="AMZN" zoomable />
          <CandlestickChart data={DATASETS.META} symbol="META" zoomable />
          <CandlestickChart data={DATASETS.AMD} symbol="AMD" zoomable />
        </ChartWorkspace>
      </div>
    );
  },
};

export const TwoPanels: Story = {
  name: "2 panneaux",
  render: () => (
    // No wrapper padding — ChartWorkspace fills 100% of the viewport height by default (see its
    // own `panelHeight` doc), and the negative margin cancels the global Storybook decorator's
    // own 32px padding (see .storybook/preview.tsx) so that fit is exact, same fix as
    // CandlestickChart.stories.tsx's own "Toutes les options" story.
    <div style={{ margin: -32 }}>
      <ChartWorkspace defaultPanels={2}>
        <CandlestickChart data={DATASETS.AAPL} symbol="AAPL" zoomable />
        <CandlestickChart data={DATASETS.MSFT} symbol="MSFT" zoomable />
      </ChartWorkspace>
    </div>
  ),
};

const SYMBOL_PROFILE_WATCHLISTS: ChartWorkspaceWatchlist[] = [
  {
    id: "wl-1",
    name: "Liste de surveillance",
    columns: [{ id: "price", label: "Prix" }],
    rows: [
      { id: "r-msft", ticker: "MSFT", values: { price: "412,88" } },
      { id: "r-nvda", ticker: "NVDA", values: { price: "128,47" } },
      { id: "r-aapl", ticker: "AAPL", values: { price: "231,05" } },
    ],
  },
];

// A gently rising/falling seasonal path (cumulative % through a reference year) — just enough
// points for Sparkline to read as a real trend, not meant to represent any real seasonality math.
const SEASONALITY_PATH = generateCandles(52, 100, 5).map((c) => ({ date: c.date, value: c.close - 100 }));

const SYMBOL_PROFILES: SymbolProfile[] = [
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    instrumentType: "Action",
    marketStatus: "Marché fermé",
    description:
      "Apple Inc. conçoit, fabrique et commercialise des smartphones, ordinateurs personnels, tablettes, montres connectées et accessoires, et propose une large gamme de services associés (App Store, iCloud, Apple Music, Apple Pay). L'entreprise vend ses produits dans le monde entier via ses propres magasins, son site en ligne et des revendeurs tiers.",
    sectors: ["Technologie", "Matériel informatique", "Électronique grand public"],
    performance: [
      { label: "1S", changePercent: 0.8 },
      { label: "1M", changePercent: -2.3 },
      { label: "3M", changePercent: 5.1 },
      { label: "6M", changePercent: 12.4 },
      { label: "YTD", changePercent: 18.6 },
      { label: "1A", changePercent: 24.7 },
    ],
    seasonality: SEASONALITY_PATH,
    news: [
      {
        id: "n-1",
        time: "Il y a 2 jours",
        headline: "Wall Street mise sur le succès de GTA 6 — le titre Take-Two en profite.",
        provider: "Barrons.com",
      },
      { id: "n-2", time: "Il y a 4 jours", headline: "Apple prépare un nouveau cycle de produits pour la rentrée." },
    ],
    keyStats: {
      nextEarningsInDays: 67,
      volume: "3,71 M",
      averageVolume: "2,22 M",
      marketCap: "44,01 Md",
    },
    earnings: [
      { date: "T4 24", estimateEps: 1.4, actualEps: 1.55 },
      { date: "T1 25", estimateEps: 1.1, actualEps: 1.2 },
      { date: "T2 25", estimateEps: 0.75, actualEps: 0.68 },
      { date: "T3 25", estimateEps: 0.95, actualEps: 1.35 },
      { date: "T4 25", estimateEps: 1.2 },
    ],
  },
];

export const SymbolProfileWorkspace: Story = {
  name: "Panneau latéral — infos sur l'entreprise (sous la liste de surveillance)",
  render: () => (
    <div style={{ margin: -32 }}>
      <ChartWorkspace defaultPanels={1} watchlists={SYMBOL_PROFILE_WATCHLISTS} symbolProfiles={SYMBOL_PROFILES}>
        <CandlestickChart data={DATASETS.AAPL} symbol="AAPL" zoomable />
      </ChartWorkspace>
    </div>
  ),
};

export const ScriptingWorkspace: Story = {
  name: "Scripts partagés (2 panneaux)",
  render: () => (
    <div style={{ margin: -32 }}>
      <ChartWorkspace defaultPanels={2} scripting>
        <CandlestickChart data={DATASETS.AAPL} symbol="AAPL" zoomable showIndicators defaultIndicators={[{ id: "i-0", kind: "rsi", period: 14 }]} />
        <CandlestickChart data={DATASETS.MSFT} symbol="MSFT" zoomable showIndicators defaultIndicators={[{ id: "i-0", kind: "rsi", period: 14 }]} />
      </ChartWorkspace>
    </div>
  ),
};
