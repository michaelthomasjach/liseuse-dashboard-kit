import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ChartWorkspace } from "./ChartWorkspace";
import { CandlestickChart } from "./CandlestickChart";
import { generateCandles } from "../../test-data/financeSampleData";
import type { ChartWorkspaceWatchlist } from "./workspace/ChartWorkspaceWatchlist.interface";
import type { SymbolProfile } from "./workspace/SymbolProfile.interface";
import type { SymbolFinancials } from "./workspace/SymbolFinancials.interface";

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

/** A worked example of everything the details modal's own tabs can render, in the shape an
 *  application would supply it (see `SymbolFinancials`). Figures are illustrative, not real. */
const AAPL_FINANCIALS: SymbolFinancials = {
  overview: {
    keyFacts: [
      { label: "Capitalisation boursière", value: "3 100", unit: "Md USD" },
      { label: "Rendement du dividende", value: "0,44", unit: "%" },
      { label: "PER (TTM)", value: "34,2" },
      { label: "BPA de base (TTM)", value: "6,75", unit: "USD" },
      { label: "Fondée en", value: "1976" },
      { label: "Effectif", value: "161 000" },
      { label: "Direction", value: "Tim Cook" },
      { label: "Site", value: "apple.com", href: "https://www.apple.com" },
    ],
    about:
      "Apple Inc. conçoit, fabrique et commercialise des smartphones, ordinateurs personnels, tablettes, montres connectées et accessoires, et propose une large gamme de services associés. L'entreprise vend ses produits dans le monde entier via ses propres magasins, son site en ligne et un réseau de revendeurs, opérateurs et distributeurs tiers.",
    ownership: {
      title: "Actionnariat",
      shares: [
        { label: "Flottant", value: 14_820, display: "14,82 Md (98,1 %)", color: "#e0a95c" },
        { label: "Détenu en interne", value: 287, display: "287 M (1,9 %)", color: "#6c87c9" },
      ],
    },
    capitalStructure: {
      title: "Structure du capital",
      shares: [
        { label: "Capitalisation", value: 3100, display: "3 100 Md", color: "#4fae8f" },
        { label: "Dette", value: 105, display: "105 Md", color: "#e0a95c" },
        { label: "Trésorerie", value: 62, display: "62 Md", color: "#c96f8f" },
      ],
    },
  },
  statements: [
    {
      id: "income",
      title: "Compte de résultat",
      showGrowth: true,
      periods: [2021, 2022, 2023, 2024, 2025].map((y) => ({ key: String(y), label: String(y), sublabel: `Sep ${y}` })),
      rows: [
        {
          key: "revenue",
          label: "Chiffre d'affaires",
          emphasis: true,
          values: { 2021: 365_817, 2022: 394_328, 2023: 383_285, 2024: 391_035, 2025: 416_200 },
          display: { 2021: "365,82 Md", 2022: "394,33 Md", 2023: "383,29 Md", 2024: "391,04 Md", 2025: "416,20 Md" },
          children: [
            {
              key: "products",
              label: "Produits",
              values: { 2021: 297_392, 2022: 316_199, 2023: 298_085, 2024: 294_866, 2025: 305_400 },
              display: { 2021: "297,39 Md", 2022: "316,20 Md", 2023: "298,09 Md", 2024: "294,87 Md", 2025: "305,40 Md" },
            },
            {
              key: "services",
              label: "Services",
              values: { 2021: 68_425, 2022: 78_129, 2023: 85_200, 2024: 96_169, 2025: 110_800 },
              display: { 2021: "68,43 Md", 2022: "78,13 Md", 2023: "85,20 Md", 2024: "96,17 Md", 2025: "110,80 Md" },
            },
          ],
        },
        {
          key: "gross",
          label: "Marge brute",
          emphasis: true,
          values: { 2021: 152_836, 2022: 170_782, 2023: 169_148, 2024: 180_683, 2025: 197_900 },
          display: { 2021: "152,84 Md", 2022: "170,78 Md", 2023: "169,15 Md", 2024: "180,68 Md", 2025: "197,90 Md" },
        },
        {
          key: "net",
          label: "Résultat net",
          emphasis: true,
          values: { 2021: 94_680, 2022: 99_803, 2023: 96_995, 2024: 93_736, 2025: 102_400 },
          display: { 2021: "94,68 Md", 2022: "99,80 Md", 2023: "96,99 Md", 2024: "93,74 Md", 2025: "102,40 Md" },
        },
      ],
    },
    {
      id: "cash",
      title: "Flux de trésorerie",
      showGrowth: true,
      periods: [2021, 2022, 2023, 2024, 2025].map((y) => ({ key: String(y), label: String(y), sublabel: `Sep ${y}` })),
      rows: [
        {
          key: "op",
          label: "Flux d'exploitation",
          emphasis: true,
          values: { 2021: 104_038, 2022: 122_151, 2023: 110_543, 2024: 118_254, 2025: 126_900 },
          display: { 2021: "104,04 Md", 2022: "122,15 Md", 2023: "110,54 Md", 2024: "118,25 Md", 2025: "126,90 Md" },
          children: [
            {
              key: "capex",
              label: "Investissements",
              values: { 2021: -11_085, 2022: -10_708, 2023: -10_959, 2024: -9_447, 2025: -11_200 },
              display: { 2021: "−11,09 Md", 2022: "−10,71 Md", 2023: "−10,96 Md", 2024: "−9,45 Md", 2025: "−11,20 Md" },
            },
          ],
        },
        {
          key: "fcf",
          label: "Free cash flow",
          emphasis: true,
          values: { 2021: 92_953, 2022: 111_443, 2023: 99_584, 2024: 108_807, 2025: 115_700 },
          display: { 2021: "92,95 Md", 2022: "111,44 Md", 2023: "99,58 Md", 2024: "108,81 Md", 2025: "115,70 Md" },
        },
      ],
    },
  ],
  statistics: [
    {
      id: "valuation",
      title: "Valorisation",
      periods: [...[2022, 2023, 2024, 2025].map((y) => ({ key: String(y), label: String(y) })), { key: "current", label: "Actuel" }],
      rows: [
        { key: "pe", label: "PER", display: { 2022: "24,4", 2023: "29,8", 2024: "33,1", 2025: "34,2", current: "34,2" } },
        { key: "ps", label: "Prix / ventes", display: { 2022: "6,2", 2023: "7,4", 2024: "8,1", 2025: "7,4", current: "7,5" } },
        { key: "pb", label: "Prix / actif net", display: { 2022: "43,1", 2023: "48,9", 2024: "51,2", 2025: "49,7", current: "50,1" } },
      ],
    },
    {
      id: "margins",
      title: "Marges",
      periods: [...[2022, 2023, 2024, 2025].map((y) => ({ key: String(y), label: String(y) })), { key: "current", label: "Actuel" }],
      rows: [
        { key: "gm", label: "Marge brute %", display: { 2022: "43,3", 2023: "44,1", 2024: "46,2", 2025: "47,5", current: "47,5" } },
        { key: "nm", label: "Marge nette %", display: { 2022: "25,3", 2023: "25,3", 2024: "24,0", 2025: "24,6", current: "24,6" } },
      ],
    },
  ],
  dividends: {
    facts: [
      { label: "Rendement (indiqué)", value: "0,44", unit: "%" },
      { label: "Dernier versement", value: "0,25", unit: "USD" },
    ],
    tables: [
      {
        id: "dividends",
        title: "Historique",
        periods: [2022, 2023, 2024, 2025].map((y) => ({ key: String(y), label: String(y) })),
        rows: [{ key: "dps", label: "Dividende par action", display: { 2022: "0,90", 2023: "0,94", 2024: "0,98", 2025: "1,02" } }],
      },
    ],
  },
  earnings: {
    facts: [
      { label: "Prochaine publication", value: "≈ 30 janv. 2026" },
      { label: "Période", value: "T1 2026" },
      { label: "BPA estimé", value: "2,35", unit: "USD" },
      { label: "CA estimé", value: "124,3", unit: "Md USD" },
    ],
    tables: [
      {
        id: "eps",
        title: "BPA",
        periods: [2022, 2023, 2024, 2025, 2026].map((y) => ({ key: String(y), label: String(y) })),
        rows: [
          { key: "reported", label: "Publié", emphasis: true, display: { 2022: "6,11", 2023: "6,13", 2024: "6,08", 2025: "6,75" } },
          { key: "estimate", label: "Estimé", display: { 2022: "5,98", 2023: "6,05", 2024: "6,12", 2025: "6,60", 2026: "7,40" } },
          {
            key: "surprise",
            label: "Surprise",
            display: { 2022: "+2,17 %", 2023: "+1,32 %", 2024: "−0,65 %", 2025: "+2,27 %" },
          },
        ],
      },
    ],
  },
  segments: [
    {
      id: "by-source",
      title: "Par activité",
      periods: [2022, 2023, 2024, 2025].map((y) => ({ key: String(y), label: String(y) })),
      rows: [
        { key: "iphone", label: "iPhone", accent: "#2f7fe0", display: { 2022: "205,49 Md", 2023: "200,58 Md", 2024: "201,18 Md", 2025: "209,40 Md" } },
        { key: "services", label: "Services", accent: "#38bdd0", display: { 2022: "78,13 Md", 2023: "85,20 Md", 2024: "96,17 Md", 2025: "110,80 Md" } },
        { key: "mac", label: "Mac", accent: "#e8853a", display: { 2022: "40,18 Md", 2023: "29,36 Md", 2024: "29,98 Md", 2025: "32,10 Md" } },
        { key: "wearables", label: "Accessoires", accent: "#9b6cd0", display: { 2022: "41,24 Md", 2023: "39,84 Md", 2024: "37,01 Md", 2025: "38,60 Md" } },
      ],
    },
    {
      id: "by-country",
      title: "Par région",
      periods: [2022, 2023, 2024, 2025].map((y) => ({ key: String(y), label: String(y) })),
      rows: [
        { key: "americas", label: "Amériques", accent: "#2f7fe0", display: { 2022: "169,66 Md", 2023: "162,56 Md", 2024: "167,05 Md", 2025: "178,90 Md" } },
        { key: "europe", label: "Europe", accent: "#38bdd0", display: { 2022: "95,12 Md", 2023: "94,29 Md", 2024: "101,33 Md", 2025: "109,20 Md" } },
        { key: "china", label: "Chine", accent: "#e8853a", display: { 2022: "74,20 Md", 2023: "72,56 Md", 2024: "66,95 Md", 2025: "68,40 Md" } },
      ],
    },
  ],
};

const SYMBOL_PROFILES: SymbolProfile[] = [
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    instrumentType: "Action",
    marketStatus: "Marché fermé",
    financials: AAPL_FINANCIALS,
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
