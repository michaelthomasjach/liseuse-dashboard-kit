import { useState } from "react";
import { AAPL_FINANCIALS } from "../../test-data/symbolFinancialsSample";
import type { ScriptDef } from "./candlestick/interfaces/ScriptDef.interface";
import { SCRIPT_EXAMPLES } from "./candlestick/scripting/scriptExamples";
import type { Meta, StoryObj } from "@storybook/react";
import {
  CandlestickChart,
  type TimeframeEntry,
  type ChartEvent,
  type FundamentalDataPoint,
  type SymbolSearchResult,
  type ChartDisplayMode,
  type OverlayDataPoint,
  type CustomIndicatorDef,
  type ChartAlert,
  type ChartAlertDraft,
} from "./CandlestickChart";
import { AlertsPanel } from "./AlertsPanel";
import {
  ChartWorkspace,
  type ChartWorkspaceWatchlist,
  type ChartWorkspaceWatchlistColumn,
  type ChartWorkspaceWatchlistRow,
  type WatchlistEarningsRow,
  type WatchlistDividendRow,
  type WatchlistNewsItem,
  type SymbolProfile,
} from "./ChartWorkspace";
import { generateCandles, generateCandlesByTimeframe, type MockTimeframeKey } from "../../test-data/financeSampleData";
import { BTC_REAL_SAMPLE } from "../../test-data/btcRealSample";
import type { AiSend } from "./candlestick/ai/interfaces/AiMessage.interface";
import type { ChartWorkspaceProps } from "./ChartWorkspace";

const meta: Meta<typeof CandlestickChart> = {
  title: "Charts/CandlestickChart",
  component: CandlestickChart,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof CandlestickChart>;

const ALL_FEATURES_DATASET = generateCandles(600, 180, 66);
// One candle series per timeframe (see TIMEFRAMES below) — the daily entry alone covers a full
// ~10 years, the finer intraday ones their own shorter, realistic lookback windows (see
// generateCandlesByTimeframe's own doc). Kept separate from ALL_FEATURES_DATASET above rather
// than replacing it: the events/fundamentals/custom-indicator demos below all anchor to specific
// dates *within* that smaller 600-candle series (still valid dates in every longer series here,
// since every generator here walks the exact same weekdays backward from "today"), and swapping
// what they anchor to isn't needed just to make the chart itself show different data per
// timeframe.
const ALL_FEATURES_TIMEFRAME_DATA = generateCandlesByTimeframe(180, 66);
const ALL_FEATURES_EVENTS: ChartEvent[] = [
  { date: ALL_FEATURES_DATASET[80].date, kind: "earnings", label: "Résultats T1 : BPA 1.42$ (attendu 1.35$)" },
  { date: ALL_FEATURES_DATASET[180].date, kind: "earnings", label: "Résultats T2 : BPA 1.51$ (attendu 1.48$)" },
  // Same date as the T2 earnings above, on purpose — two events sharing a candle index render as
  // a single "stack" marker instead of overlapping.
  { date: ALL_FEATURES_DATASET[180].date, kind: "news", label: "Annonce d'un partenariat stratégique" },
  { date: ALL_FEATURES_DATASET[280].date, kind: "dividend", label: "Dividende détaché : 0.62$/action" },
  // Four on the same candle — the case the count badge under the cluster exists for. Past two, the
  // fanned cards overlap enough that counting them by eye stops being reliable, which is exactly
  // when printing the number earns its place.
  { date: ALL_FEATURES_DATASET[340].date, kind: "earnings", label: "Résultats annuels : BPA 5.94$" },
  { date: ALL_FEATURES_DATASET[340].date, kind: "dividend", label: "Dividende exceptionnel : 1.10$/action" },
  { date: ALL_FEATURES_DATASET[340].date, kind: "news", label: "Rachat d'actions de 10 Md$ annoncé" },
  { date: ALL_FEATURES_DATASET[340].date, kind: "update", label: "Changement de directeur financier" },
  { date: ALL_FEATURES_DATASET[420].date, kind: "earnings", label: "Résultats T3 : BPA 1.58$ (attendu 1.50$)" },
  { date: ALL_FEATURES_DATASET[520].date, kind: "update", label: "Lancement de la nouvelle gamme de produits" },
];

// Four quarterly reports spread across ALL_FEATURES_DATASET's own date range — sparse on purpose
// (real fundamentals are reported quarterly/annually, never daily like `data` itself).
const ALL_FEATURES_FUNDAMENTALS: FundamentalDataPoint[] = [
  {
    date: ALL_FEATURES_DATASET[0].date,
    totalRevenue: 4_200_000_000,
    netIncome: 620_000_000,
    freeCashFlow: 540_000_000,
    netMargin: 14.8,
    grossMargin: 41.2,
    peRatio: 22.4,
    eps: 1.18,
    debtToEquity: 0.62,
  },
  {
    date: ALL_FEATURES_DATASET[150].date,
    totalRevenue: 4_450_000_000,
    netIncome: 690_000_000,
    freeCashFlow: 610_000_000,
    netMargin: 15.5,
    grossMargin: 42.0,
    peRatio: 21.1,
    eps: 1.29,
    debtToEquity: 0.58,
  },
  {
    date: ALL_FEATURES_DATASET[300].date,
    totalRevenue: 4_680_000_000,
    netIncome: 705_000_000,
    freeCashFlow: 590_000_000,
    netMargin: 15.1,
    grossMargin: 41.6,
    peRatio: 23.8,
    eps: 1.32,
    debtToEquity: 0.55,
  },
  {
    date: ALL_FEATURES_DATASET[450].date,
    totalRevenue: 4_920_000_000,
    netIncome: 760_000_000,
    freeCashFlow: 655_000_000,
    netMargin: 15.4,
    grossMargin: 42.5,
    peRatio: 24.6,
    eps: 1.41,
    debtToEquity: 0.51,
  },
];

// Demonstrates `customIndicators` (see CustomIndicatorDef's own doc) — three metrics the built-in
// catalog doesn't have, each showing a different `type`/`draw` combination: gross margin as a
// price-overlay line (the same "on the chart itself" slot SMA/EMA use), dividend per share as its
// own histogram sub-pane, income tax as its own area sub-pane. Same sparse, quarterly-report shape
// as ALL_FEATURES_FUNDAMENTALS on purpose — this is exactly the kind of data an app would reach
// for `customIndicators` to plot instead of waiting on a new built-in kind for every metric.
const CUSTOM_INDICATORS: CustomIndicatorDef[] = [
  {
    id: "grossMarginPct",
    label: "Marge brute (%)",
    section: "Fondamentaux",
    type: "overlay",
    draw: "line",
    color: "#7fb37f",
    formatValue: (v) => `${v.toFixed(1)}%`,
    data: ALL_FEATURES_FUNDAMENTALS.map((f) => ({ date: f.date, value: 130 + f.grossMargin })),
  },
  {
    id: "dividendPerShare",
    label: "Dividende par action",
    section: "Fondamentaux",
    type: "own",
    draw: "histogram",
    color: "#6c87c9",
    formatValue: (v) => `$${v.toFixed(2)}`,
    data: ALL_FEATURES_FUNDAMENTALS.map((f, i) => ({ date: f.date, value: 0.4 + i * 0.05 })),
  },
  {
    id: "incomeTax",
    label: "Impôt sur le revenu",
    section: "Fondamentaux",
    type: "own",
    draw: "area",
    color: "#c96c8f",
    formatValue: (v) => `$${(v / 1_000_000).toFixed(0)}M`,
    data: ALL_FEATURES_FUNDAMENTALS.map((f) => ({ date: f.date, value: f.netIncome * 0.22 })),
  },
];


const TIMEFRAMES: TimeframeEntry[] = [
  { group: "Minutes", options: [{ label: "1 minute", value: "1m" }, { label: "5 minutes", value: "5m" }, { label: "15 minutes", value: "15m" }] },
  { group: "Heures", options: [{ label: "1 heure", value: "1h" }, { label: "4 heures", value: "4h" }] },
  { group: "Jours", options: [{ label: "1 jour", value: "1d" }, { label: "1 semaine", value: "1w" }, { label: "1 mois", value: "1M" }] },
];

// A tiny mock "database" standing in for whatever real symbol search API an app would call —
// the component itself never ships one (it has no opinion on where symbols come from), it only
// renders whatever `symbolSearchResults` the app currently hands it.
const MOCK_SYMBOL_DB: SymbolSearchResult[] = [
  { id: "nvda", ticker: "NVDA", name: "NVIDIA Corporation", category: "stocks", source: "NASDAQ", logoColor: "#76b900" },
  { id: "aapl", ticker: "AAPL", name: "Apple Inc.", category: "stocks", source: "NASDAQ", logoColor: "#555" },
  { id: "msft", ticker: "MSFT", name: "Microsoft Corporation", category: "stocks", source: "NASDAQ", logoColor: "#00a4ef" },
  { id: "spx", ticker: "SPX", name: "S&P 500 Index", category: "indices", source: "SP" },
  { id: "eu50", ticker: "EU50", name: "Eurostoxx 50, Daily", category: "indices", source: "SPREADEX" },
  { id: "btcusd", ticker: "BTCUSD", name: "Bitcoin / Dollar américain", category: "crypto", source: "COINBASE" },
  { id: "ethusd", ticker: "ETHUSD", name: "Ethereum / Dollar américain", category: "crypto", source: "COINBASE" },
  { id: "eurusd", ticker: "EURUSD", name: "Euro / Dollar américain", category: "forex", source: "OANDA" },
  { id: "xauusd", ticker: "XAUUSD", name: "Gold", category: "forex", source: "OANDA" },
  { id: "wti", ticker: "WTI", name: "West Texas Intermediate Crude Oil cash", category: "futures", source: "BLACKBULL" },
  { id: "fib1", ticker: "FIB1!", name: "FTSE MIB Index Futures", category: "futures", source: "EURONEXT" },
  { id: "de10y", ticker: "DE10Y", name: "Germany 10 Year Government Bonds Yield", category: "bonds", source: "TVC" },
  { id: "fr10y", ticker: "FR10Y", name: "France 10 Year Government Bonds Yield", category: "bonds", source: "TVC" },
  { id: "gdp", ticker: "USGDP", name: "United States GDP Growth Rate", category: "economy", source: "ECONOMICS" },
  { id: "orbx", ticker: "ORBX", name: "Global X Space Tech ETF", category: "options", source: "NASDAQ" },
];

// Stands in for a real search API call — filters `MOCK_SYMBOL_DB` by query/category, exactly the
// kind of work `onSymbolSearchChange` hands off to the app.
function filterMockSymbols(query: string, category: string, favorites: string[]): SymbolSearchResult[] {
  const q = query.trim().toLowerCase();
  return MOCK_SYMBOL_DB.filter((r) => {
    if (category === "favorites") return favorites.includes(r.id);
    if (category !== "all" && r.category !== category) return false;
    if (!q) return true;
    return r.ticker.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
  });
}

// A small in-memory "quote database" of daily closes per ticker, keyed the same as
// MOCK_SYMBOL_DB — stands in for a real quote API the same way MOCK_SYMBOL_DB stands in for a
// real symbol-search one. A different seed/base per ticker so trajectories actually diverge
// instead of moving in lockstep, aligned to ALL_FEATURES_DATASET's own dates (a real overlay
// wouldn't need to be — this just keeps the mock data simple).
const OVERLAY_SEED_BY_TICKER: Record<string, number> = {
  NVDA: 15,
  AAPL: 27,
  MSFT: 44,
  SPX: 3,
  BTCUSD: 61,
  ETHUSD: 52,
};
// Full OHLC (not just the close) so the "Mode d'affichage" selector in the edit modal has
// something to offer "Bougies" from — see OverlayDataPoint's own doc.
function generateOverlaySeries(ticker: string): OverlayDataPoint[] {
  const seed = OVERLAY_SEED_BY_TICKER[ticker] ?? 7;
  return generateCandles(ALL_FEATURES_DATASET.length, 100 + seed * 3, seed).map((c, i) => ({
    date: ALL_FEATURES_DATASET[i].date,
    value: c.close,
    open: c.open,
    high: c.high,
    low: c.low,
  }));
}

// Placeholder data for `ChartWorkspace`'s own `watchlists` — the library only owns the table's
// own chrome (header, +/… actions, hover/click), row *values* are always caller-supplied content
// (see ChartWorkspaceWatchlist's own doc), just the easiest thing to visually verify the panel's
// own resize/collapse/tab-switching/row-click mechanics against without the story needing a real
// positions/watchlist data source of its own. `sortValue` reads `row.raw` (see DemoWatchlistRow)
// rather than re-parsing `values.price`/`values.change` back out of their own rendered form —
// `change` in particular is a colored `<span>`, not a plain comparable value, exactly the case
// ChartWorkspaceWatchlistColumn.sortValue's own doc describes needing an explicit accessor for.
const WATCHLIST_COLUMNS: ChartWorkspaceWatchlistColumn[] = [
  { id: "price", label: "Prix", sortValue: (row) => (row as DemoWatchlistRow).raw.price },
  { id: "priceChange", label: "Change", sortValue: (row) => (row as DemoWatchlistRow).raw.priceChange },
  { id: "change", label: "Variation", sortValue: (row) => (row as DemoWatchlistRow).raw.change },
];

type DemoWatchlistRow = ChartWorkspaceWatchlistRow & { raw: { price: number; change: number; priceChange: number } };

function watchlistRow(
  id: string,
  ticker: string,
  price: number,
  change: number,
  assetType?: string,
  sector?: string,
  region?: string
): DemoWatchlistRow {
  const up = change >= 0;
  // Space-separated thousands, period decimal — matches the plain price formatting the rest of
  // this story's own demo data already uses elsewhere (e.g. CandlestickChart's own O/H/L/C
  // readout), not a locale-driven format (which would switch to a comma decimal and read as
  // inconsistent against it).
  const priceLabel = price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d)(?=\.))/g, " ");
  const changeLabel = `${up ? "+" : ""}${change.toFixed(2)}%`;
  // `change` is the move in percent, so the previous close is the price divided by it, and the
  // absolute move is the difference — the same figure the symbol panel shows next to the price
  // ("105.25 -0.08"), in the instrument's own currency rather than in percent.
  const priceChange = price - price / (1 + change / 100);
  // Two decimals like the price above it, except where that would round the whole move away to
  // "0.00" — an FX major moves in ten-thousandths, and a Change column that reads zero on a real
  // move is worse than one extra pair of decimals on two rows.
  const changeDecimals = Math.abs(priceChange) >= 0.01 ? 2 : 4;
  const priceChangeLabel = `${priceChange >= 0 ? "+" : "−"}${Math.abs(priceChange)
    .toFixed(changeDecimals)
    .replace(/\B(?=(\d{3})+(?!\d)(?=\.))/g, " ")}`;
  const moveColor = up ? "var(--lq-color-up)" : "var(--lq-color-down)";
  return {
    id,
    ticker,
    values: {
      price: priceLabel,
      priceChange: <span style={{ color: moveColor }}>{priceChangeLabel}</span>,
      change: <span style={{ color: moveColor }}>{changeLabel}</span>,
    },
    assetType,
    sector,
    region,
    raw: { price, change, priceChange },
  };
}

// Two named lists — demonstrates the workspace's own name+caret dropdown switcher (see
// ChartWorkspace's own `watchlists` doc); "Liste de surveillance" is the default name a brand new
// list gets, "Forex" stands in for a second, user-created one.
const DEMO_WATCHLISTS: ChartWorkspaceWatchlist[] = [
  {
    id: "surveillance",
    name: "Liste de surveillance",
    columns: WATCHLIST_COLUMNS,
    // assetType/sector/region are entirely optional and caller-defined (see that field's own
    // doc) — populated here purely to demo WatchlistExposureModal's three donuts with a mix
    // worth actually looking at, not a real classification source of any kind.
    rows: [
      watchlistRow("msft", "MSFT", 412.88, 1.24, "Stock", "Technology Services", "US"),
      watchlistRow("nvda", "NVDA", 128.47, 2.61, "Stock", "Electronic Technology", "US"),
      watchlistRow("aapl", "AAPL", 231.05, -0.38, "Stock", "Technology Services", "US"),
      watchlistRow("btcusd", "BTCUSD", 64210, -1.02, "Crypto", undefined, "Global"),
      watchlistRow("spx", "SPX", 5815.2, 0.42, "Index", undefined, "US"),
      watchlistRow("wti", "WTI", 78.14, 0.65, "Futures", undefined, "Global"),
      watchlistRow("xauusd", "XAUUSD", 2415.3, -0.44, "Commodity", undefined, "EU"),
      // Padded out to 30 rows so the list is long enough to actually scroll, and mixed across
      // asset types, sectors and regions so the exposure modal's three donuts have something with
      // real shape in them rather than a handful of US technology names.
      watchlistRow("goog", "GOOG", 178.42, 0.91, "Stock", "Technology Services", "US"),
      watchlistRow("amzn", "AMZN", 186.33, -0.72, "Stock", "Retail Trade", "US"),
      watchlistRow("meta", "META", 508.19, 1.86, "Stock", "Technology Services", "US"),
      watchlistRow("tsla", "TSLA", 243.77, -2.14, "Stock", "Consumer Durables", "US"),
      watchlistRow("jpm", "JPM", 214.06, 0.33, "Stock", "Finance", "US"),
      watchlistRow("brkb", "BRK.B", 452.9, 0.12, "Stock", "Finance", "US"),
      watchlistRow("unh", "UNH", 521.44, -1.27, "Stock", "Health Services", "US"),
      watchlistRow("xom", "XOM", 118.62, 0.58, "Stock", "Energy Minerals", "US"),
      watchlistRow("asml", "ASML", 812.35, 2.04, "Stock", "Electronic Technology", "EU"),
      watchlistRow("mc", "MC", 642.8, -0.86, "Stock", "Consumer Non-Durables", "EU"),
      watchlistRow("sap", "SAP", 197.24, 0.47, "Stock", "Technology Services", "EU"),
      watchlistRow("tsm", "TSM", 174.55, 1.62, "Stock", "Electronic Technology", "Asia"),
      watchlistRow("7203", "7203", 2841, 0.74, "Stock", "Consumer Durables", "Asia"),
      watchlistRow("ethusd", "ETHUSD", 3128.4, -1.44, "Crypto", undefined, "Global"),
      watchlistRow("solusd", "SOLUSD", 148.92, 3.27, "Crypto", undefined, "Global"),
      watchlistRow("ndx", "NDX", 20214.6, 0.66, "Index", undefined, "US"),
      watchlistRow("dax", "DAX", 18422.1, -0.29, "Index", undefined, "EU"),
      watchlistRow("n225", "N225", 38914.2, 1.03, "Index", undefined, "Asia"),
      watchlistRow("xagusd", "XAGUSD", 28.44, -0.93, "Commodity", undefined, "Global"),
      watchlistRow("eurusd", "EURUSD", 1.0842, 0.09, "Forex", undefined, "EU"),
      watchlistRow("usdjpy", "USDJPY", 156.31, -0.24, "Forex", undefined, "Asia"),
      watchlistRow("us10y", "US10Y", 4.284, -0.62, "Bond", undefined, "US"),
      watchlistRow("hyg", "HYG", 79.18, 0.07, "ETF", "Finance", "US"),
    ],
  },
  {
    id: "forex",
    name: "Forex",
    columns: WATCHLIST_COLUMNS,
    rows: [watchlistRow("eurusd", "EURUSD", 1.0842, 0.12), watchlistRow("xauusd", "XAUUSD", 2415.3, -0.44)],
  },
  // Demonstrates `sections` — same "Mes favoris" split into "US"/"Indices" sub-groups the user's
  // own request described, all draggable between each other (and back out to the ungrouped list,
  // empty here) via each row's own grip handle.
  {
    id: "favoris",
    name: "Mes favoris",
    columns: WATCHLIST_COLUMNS,
    rows: [],
    sections: [
      {
        id: "favoris-us",
        name: "US",
        rows: [watchlistRow("fav-aapl", "AAPL", 231.05, -0.38), watchlistRow("fav-msft", "MSFT", 412.88, 1.24)],
      },
      { id: "favoris-indices", name: "Indices", rows: [watchlistRow("fav-spx", "SPX", 5815.2, 0.42)] },
    ],
  },
];

// Placeholder data for WatchlistExposureModal's own "Résultats"/"Dividendes"/"Actualités" tabs —
// same "just enough to visually verify the tab isn't empty" stance DEMO_WATCHLISTS' own doc
// describes, not a real market-data source of any kind.
const DEMO_EARNINGS: WatchlistEarningsRow[] = [
  { id: "e-adbe", ticker: "ADBE", companyName: "Adobe Inc.", date: "10 sept. 2026", time: "22:05", estimateEps: "6.07 USD", actualEps: "—", surprise: "—", marketCap: "109.43 Md USD" },
  { id: "e-msft", ticker: "MSFT", companyName: "Microsoft Corp.", date: "22 oct. 2026", time: "après clôture", estimateEps: "3.12 USD", actualEps: "—", surprise: "—", marketCap: "3 100 Md USD" },
  { id: "e-nvda", ticker: "NVDA", companyName: "NVIDIA Corp.", date: "18 nov. 2026", time: "après clôture", estimateEps: "0.85 USD", actualEps: "—", surprise: "—", marketCap: "5 200 Md USD" },
];

const DEMO_DIVIDENDS: WatchlistDividendRow[] = [
  { id: "d-msft", ticker: "MSFT", companyName: "Microsoft Corp.", exDividendDate: "20 août 2026", paymentDate: "10 sept. 2026", amount: "0.83 USD", yield: "0.72 %" },
  { id: "d-aapl", ticker: "AAPL", companyName: "Apple Inc.", exDividendDate: "12 août 2026", paymentDate: "15 sept. 2026", amount: "0.26 USD", yield: "0.44 %" },
];

const DEMO_NEWS: WatchlistNewsItem[] = [
  { id: "n-1", time: "il y a 44 min", headline: "Bitcoin and ether ETFs draw $2.6 billion in strongest inflow week since October, tripling volume", provider: "The Block" },
  { id: "n-2", time: "il y a 2 h", headline: "Bitcoin and Ethereum ETFs Score Biggest Week Since October with $2.3 Billion", provider: "Beincrypto" },
  { id: "n-3", time: "il y a 3 h", ticker: "NFLX", headline: "Netflix Co-Founder Reed Hastings Got Thrown Out of Homes as a Door-to-Door Vacuum Salesperson", provider: "Benzinga" },
  {
    id: "n-4",
    time: "il y a 3 h",
    headline: "Michael Howell Says 2026 Won't Be A Big Year For Bitcoin, Sees 30-Year Yield Going Higher",
    provider: "Stocktwits",
  },
  { id: "n-5", time: "il y a 5 h", ticker: "MSFT", headline: "Microsoft Q1 earnings beat estimates on strong Azure growth", provider: "Reuters", isFinancialReport: true },
];

// The side panel's own "company info" section below the watchlist (see SymbolProfilePanel) —
// entirely caller-supplied, keyed by ticker; a watchlist row with no matching entry here (BTCUSD,
// SPX, WTI, XAUUSD below — none of them a company with sectors/earnings of its own) just shows its
// plain price/change readout on its own, no error. Only covers the three real companies in
// DEMO_WATCHLISTS above, reusing DEMO_EARNINGS'/DEMO_NEWS' own MSFT entries where they already fit
// rather than inventing unrelated numbers.
/** Every profile here carries the same financial detail. Not because three companies really have
 *  identical statements, but because the alternative — one symbol with financials and the rest
 *  without — is what made the details modal look broken: open MSFT and its tabs are simply absent,
 *  with nothing on screen to say the data was never supplied. A demo that only works on one row is
 *  worse than one that repeats itself. */
const SYMBOL_PROFILES: SymbolProfile[] = [
  {
    ticker: "MSFT",
    name: "Microsoft Corporation",
    exchange: "NASDAQ",
    instrumentType: "Action",
    marketStatus: "Marché fermé",
    financials: AAPL_FINANCIALS,
    description:
      "Microsoft développe, fabrique et commercialise des logiciels, services et appareils grand public et professionnels — Windows, Office 365, Azure, Xbox, Surface — et exploite l'un des plus grands clouds publics au monde.",
    sectors: ["Technologie", "Services applicatifs", "Cloud"],
    performance: [
      { label: "1S", changePercent: 1.24 },
      { label: "1M", changePercent: 3.8 },
      { label: "3M", changePercent: -1.5 },
      { label: "6M", changePercent: 9.2 },
      { label: "YTD", changePercent: 14.1 },
      { label: "1A", changePercent: 21.6 },
    ],
    news: [{ id: "n-msft", time: "il y a 5 h", headline: "Microsoft Q1 earnings beat estimates on strong Azure growth", provider: "Reuters" }],
    keyStats: { nextEarningsInDays: 53, volume: "18,4 M", averageVolume: "21,7 M", marketCap: "3 100 Md" },
    earnings: [
      { date: "T1 25", estimateEps: 2.78, actualEps: 2.93 },
      { date: "T2 25", estimateEps: 2.9, actualEps: 2.95 },
      { date: "T3 25", estimateEps: 3.01, actualEps: 3.3 },
      { date: "T4 25", estimateEps: 3.05, actualEps: 3.23 },
      { date: "T1 26", estimateEps: 3.12 },
    ],
  },
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    instrumentType: "Action",
    marketStatus: "Marché fermé",
    financials: AAPL_FINANCIALS,
    description:
      "Apple conçoit, fabrique et commercialise des smartphones, ordinateurs personnels, tablettes et montres connectées, et propose une large gamme de services associés (App Store, iCloud, Apple Music, Apple Pay).",
    sectors: ["Technologie", "Matériel informatique", "Électronique grand public"],
    performance: [
      { label: "1S", changePercent: -0.38 },
      { label: "1M", changePercent: 2.1 },
      { label: "3M", changePercent: 6.4 },
      { label: "6M", changePercent: 11.8 },
      { label: "YTD", changePercent: 17.2 },
      { label: "1A", changePercent: 23.9 },
    ],
    keyStats: { nextEarningsInDays: 61, volume: "42,3 M", averageVolume: "48,1 M", marketCap: "3 550 Md" },
  },
  {
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    exchange: "NASDAQ",
    instrumentType: "Action",
    marketStatus: "Marché fermé",
    financials: AAPL_FINANCIALS,
    description: "NVIDIA conçoit des processeurs graphiques (GPU) et des plateformes pour le calcul accéléré, le jeu vidéo, les centres de données et l'intelligence artificielle.",
    sectors: ["Technologie", "Semi-conducteurs"],
    performance: [
      { label: "1S", changePercent: 2.61 },
      { label: "1M", changePercent: 8.4 },
      { label: "3M", changePercent: 15.9 },
      { label: "6M", changePercent: 22.3 },
      { label: "YTD", changePercent: 38.7 },
      { label: "1A", changePercent: 61.2 },
    ],
    keyStats: { nextEarningsInDays: 80, volume: "215,6 M", averageVolume: "198,2 M", marketCap: "5 200 Md" },
  },
];

// A short tone at `freq` for `duration` seconds, `delay` seconds from now — the one shared
// building block every sound below is made of, so each option's own distinct sound is really just
// a different arrangement of these (single tone vs. a short ascending/alternating sequence).
function playTone(ctx: AudioContext, freq: number, duration: number, delay = 0) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

// This library ships no audio assets of its own (see CandlestickChartProps.onPlaySound's own
// doc) — a real app would likely play actual sound files instead, this is just enough to
// demonstrate every option in AlertCreateModal's own "Son" picker actually sounding distinct from
// the others, rather than all four collapsing to the exact same tone.
function playAlertSound(value: string) {
  if (value === "none") return;
  const ctx = new AudioContext();
  switch (value) {
    case "bell":
      playTone(ctx, 660, 0.6);
      break;
    case "chime":
      playTone(ctx, 523, 0.18);
      playTone(ctx, 659, 0.18, 0.15);
      playTone(ctx, 784, 0.3, 0.3);
      break;
    case "ding":
      playTone(ctx, 1200, 0.12);
      break;
    case "alert":
      playTone(ctx, 880, 0.12);
      playTone(ctx, 660, 0.12, 0.15);
      playTone(ctx, 880, 0.12, 0.3);
      playTone(ctx, 660, 0.12, 0.45);
      break;
    default:
      playTone(ctx, 880, 0.25);
  }
}

// ---------------------------------------------------------------------------------------------
// Les scripts pré-chargés des démos : un indicateur, un portage Pine Script, une stratégie. Tous
// éteints ou presque au départ (voir chacun) — ils remplissent « Mes scripts » et « Mes
// stratégies » de lignes réelles, pour que le sélecteur et l'éditeur aient quelque chose à montrer
// sans avoir à écrire un script d'abord. Ce n'était au départ qu'un raccourci de débogage marqué
// « à retirer » ; c'est devenu le montage de démonstration, et l'étiquette ne décrivait plus rien.
// ---------------------------------------------------------------------------------------------

/** Le script de l'exemple « Niveaux de support/résistance (KDE gaussienne) », pris tel quel dans
 *  SCRIPT_EXAMPLES — la même source que la documentation et l'éditeur, jamais une copie : corriger
 *  l'exemple corrige aussi ce montage, et l'indicateur reste écrit dans le langage de scripting.
 *
 *  Pas de `runRequestId` : un script enregistré sans requête d'exécution en attente est lancé au
 *  montage par ScriptRunner (voir son premier effet), donc la colonne ancrée à droite s'ouvre
 *  d'elle-même sans avoir à cliquer sur « Exécuter ». `named: true` lui évite la demande de nom au
 *  premier enregistrement.
 *
 *  `targetPanelIndex: 0` est ce qui le fait réellement arriver jusqu'au panneau : `ChartWorkspace`
 *  ne route vers chaque panneau que les scripts qui le désignent (`s.targetPanelIndex === i`, voir
 *  son propre doc), donc un script sans cible n'est routé nulle part — il n'apparaît sous « Mes
 *  scripts » dans le sélecteur d'indicateurs d'aucun panneau, et ne s'exécute pas non plus. */
/** A ready-to-run strategy, wired up the same way KDE_DEBUG_SCRIPT is, so "Mes stratégies" has a
 *  row and the strategy tester has something real to show without anyone having to write a script
 *  first. The crossover one rather than the MACD one: it is the simplest that stands up, takes few
 *  enough trades to read the list by eye, and is the baseline the others are meant to be compared
 *  against. Same `targetPanelIndex` requirement as any other workspace-routed script — without it
 *  the script reaches no panel and never runs. */
const STRATEGY_DEBUG_SCRIPT: ScriptDef[] = [
  {
    id: "debug-strategy",
    name: "Croisement de moyennes",
    code: SCRIPT_EXAMPLES.find((example) => example.id === "sma-cross-strategy")?.code ?? "",
    named: true,
    enabled: true,
    targetPanelIndex: 0,
  },
];


const KDE_DEBUG_SCRIPT: ScriptDef[] = [
  // Présent mais éteint : le script est dans « Mes scripts », prêt à être lancé d'un clic, et il
  // ne dessine rien tant qu'on ne l'a pas demandé. Un montage de démonstration a pour première
  // tâche de montrer le graphique ; un profil ancré à droite et un semis de niveaux sur les
  // bougies, arrivés sans que personne les demande, sont le contraire de ça. La story « Données
  // BTC réelles » l'active explicitement — c'est la seule où le voir tourner *est* le sujet.
  {
    id: "debug-kde",
    name: "Niveaux de support/résistance (KDE)",
    code: SCRIPT_EXAMPLES.find((example) => example.id === "kde-support-resistance")?.code ?? "",
    named: true,
    enabled: false,
    targetPanelIndex: 0,
  },
  // Le même calcul, découpé en trois fichiers importés. Désactivé au départ — on l'active depuis
  // « Ajouter un indicateur » ou l'éditeur — et tracé dans une autre couleur : sa pane porte le
  // même nom que celle ci-dessus, donc les deux se superposent dans une seule boîte (voir
  // stackSidePanes), et deux courbes identiques de la même couleur se cacheraient l'une l'autre.
  {
    id: "debug-kde-modules",
    name: "Niveaux S/R (plusieurs fichiers)",
    code: SCRIPT_EXAMPLES.find((example) => example.id === "kde-modules")?.code ?? "",
    files: SCRIPT_EXAMPLES.find((example) => example.id === "kde-modules")?.files ?? [],
    paramValues: { PROFIL_COULEUR: "#2f6fb2" },
    named: true,
    enabled: false,
    targetPanelIndex: 0,
  },
];

/** Both fixtures together — an indicator script *and* a strategy script, so the picker shows both
 *  "Mes scripts" and "Mes stratégies" with real rows in each, and the conversion button on the
 *  indicator has something to convert. */
/** The Pine Script port (see SCRIPT_EXAMPLES "trend-indicator-a"), so "Mes scripts" lists it in
 *  the indicator picker and it runs on one click. Disabled at rest, same as the KDE fixture and
 *  for the same reason: a demo's first job is to show the chart. */
const TREND_INDICATOR_SCRIPT: ScriptDef[] = [
  {
    id: "debug-trend-indicator-a",
    name: "Trend Indicator A (v2.3)",
    code: SCRIPT_EXAMPLES.find((example) => example.id === "trend-indicator-a")?.code ?? "",
    named: true,
    enabled: false,
    targetPanelIndex: 0,
  },
];

const DEBUG_SCRIPTS: ScriptDef[] = [...KDE_DEBUG_SCRIPT, ...TREND_INDICATOR_SCRIPT, ...STRATEGY_DEBUG_SCRIPT];

/** The assistant, wired to a scripted stand-in instead of a real model.
 *
 *  A story cannot hold an API key, and one that asked for yours would be a story nobody could run.
 *  What it *can* do is prove the half this library owns: the button, the panel, the `/` menu, the
 *  streaming transcript, and — the part worth seeing — the tool loop actually moving the chart.
 *  The `send` below is a real `AiSend`: it answers with tool calls, reads their results back, and
 *  finishes with a sentence, exactly as a model would. Swap it for `apiKey` (or your own `send`)
 *  and nothing else changes. */
const scriptedAssistant: AiSend = async function* (request) {
  const lastUser = [...request.messages].reverse().find((m) => m.role === "user" && m.content.some((b) => b.type === "text"));
  const question = lastUser?.content.map((b) => (b.type === "text" ? b.text : "")).join(" ") ?? "";
  const alreadyRan = request.messages.some((m) => m.content.some((b) => b.type === "tool_result"));

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const say = async function* (text: string) {
    for (const word of text.split(" ")) {
      await delay(18);
      yield { type: "text_delta" as const, text: `${word} ` };
    }
  };

  if (alreadyRan) {
    yield* say("Voilà, c'est fait. Les résultats des outils sont dépliables au-dessus.");
    yield { type: "done", stopReason: "end_turn" };
    return;
  }

  if (/volume|sma|ema|indicateur/i.test(question)) {
    yield* say("J'ajoute ça.");
    yield { type: "tool_use", id: "t1", name: "afficher_le_volume", input: { visible: true } };
    yield { type: "tool_use", id: "t2", name: "ajouter_un_indicateur", input: { kind: "sma", period: 20 } };
    yield { type: "tool_use", id: "t3", name: "ajouter_un_indicateur", input: { kind: "ema", period: 50 } };
    yield { type: "done", stopReason: "tool_use" };
    return;
  }
  if (/canal|canaux/i.test(question)) {
    yield* say("Je trace le canal sur la période demandée.");
    yield { type: "tool_use", id: "t1", name: "tracer_un_canal", input: { debut: "01/01/2025", fin: "01/06/2025" } };
    yield { type: "done", stopReason: "tool_use" };
    return;
  }
  yield* say("Je regarde ce que montre le graphique.");
  yield { type: "tool_use", id: "t1", name: "lire_le_graphique", input: {} };
  yield { type: "done", stopReason: "tool_use" };
};

/** A real key, when the developer running Storybook has put one in `.env.local` as
 *  `VITE_ANTHROPIC_API_KEY`. That file is gitignored and never read by the library itself — only by
 *  these stories, and only in a dev server. Absent (the normal case, and the only case in CI), they
 *  fall back to the scripted stand-in above, so the feature is still demonstrated. */
const REAL_KEY = (import.meta.env?.VITE_ANTHROPIC_API_KEY as string | undefined) ?? undefined;
/** Required only when that key belongs to an organisation rather than to a workspace — see the
 *  `ai.workspaceId` prop. Absent for a workspace-scoped key, and nothing sends an empty header. */
const REAL_WORKSPACE = (import.meta.env?.VITE_ANTHROPIC_WORKSPACE_ID as string | undefined) ?? undefined;

/** The assistant, on every workspace in this file.
 *
 *  On *every* one deliberately: gating the button on a prop and then wiring that prop into a single
 *  story is how a shipped feature stays invisible — the button is there, in the rail, in the story
 *  nobody opens. It belongs wherever there is a chart to point it at. */
// Pas exporté : dans un fichier de stories, chaque export est *lu comme une story*, et celui-ci
// s'affichait dans la barre latérale sous le nom « STORY ASSISTANT ».
const STORY_ASSISTANT: ChartWorkspaceProps["ai"] = REAL_KEY
  ? { apiKey: REAL_KEY, workspaceId: REAL_WORKSPACE, serverTools: ["web_search"], symbols: ["AAPL", "MSFT", "NVDA"] }
  : { send: scriptedAssistant, symbols: ["AAPL", "MSFT", "NVDA"] };

export const AllFeatures: Story = {
  name: "Toutes les options",
  render: () => {
    const [timeframe, setTimeframe] = useState("1d");
    const [favorites, setFavorites] = useState<string[]>(["msft"]);
    const [results, setResults] = useState<SymbolSearchResult[]>(MOCK_SYMBOL_DB);
    const [currentSymbol, setCurrentSymbol] = useState("MSFT");
    const [displayMode, setDisplayMode] = useState<ChartDisplayMode>("candle");
    // Same "caller owns the data" stance as `watchlists`/`drawings`/`indicators` — the library
    // only ever hands back a `ChartAlertDraft` (via onCreateAlert/onUpdateAlert), assigning an id
    // and appending/patching/removing it in this array is entirely on this story's own side.
    const [alerts, setAlerts] = useState<ChartAlert[]>([]);
    function handleCreateAlert(draft: ChartAlertDraft) {
      setAlerts((prev) => [...prev, { ...draft, id: `alert-${Date.now()}` }]);
    }
    function handleUpdateAlert(id: string, draft: ChartAlertDraft) {
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...draft, id } : a)));
    }
    function handleDeleteAlert(id: string) {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    }
    // The caller owns watchlist *data* (see ChartWorkspaceWatchlist's own doc) — this story's own
    // stand-in for whatever real positions/watchlist store an app would have, updated here purely
    // by `onAddWatchlistSymbol` below (the library itself never mutates it).
    const [watchlists, setWatchlists] = useState<ChartWorkspaceWatchlist[]>(DEMO_WATCHLISTS);
    // Its own results list, independent of the main chart's own `results` above — a real app
    // could well feed both symbol-search modals from the same source, but they don't have to.
    const [watchlistSearchResults, setWatchlistSearchResults] = useState<SymbolSearchResult[]>(MOCK_SYMBOL_DB);

    function handleCreateWatchlist(name: string) {
      setWatchlists((prev) => [...prev, { id: `wl-${Date.now()}`, name, columns: WATCHLIST_COLUMNS, rows: [] }]);
    }

    function handleCreateWatchlistSection(watchlistId: string, name: string) {
      setWatchlists((prev) =>
        prev.map((w) => (w.id === watchlistId ? { ...w, sections: [...(w.sections ?? []), { id: `sec-${Date.now()}`, name, rows: [] }] } : w))
      );
    }

    function handleRemoveWatchlistSymbol(watchlistId: string, rowId: string, sectionId: string | null) {
      setWatchlists((prev) =>
        prev.map((w) => {
          if (w.id !== watchlistId) return w;
          if (sectionId === null) return { ...w, rows: w.rows.filter((r) => r.id !== rowId) };
          return { ...w, sections: w.sections?.map((s) => (s.id === sectionId ? { ...s, rows: s.rows.filter((r) => r.id !== rowId) } : s)) };
        })
      );
    }

    // Already past WatchlistPanel's own confirmation modal by the time this fires (see
    // ChartWorkspaceProps.onRemoveWatchlistSection's own doc) — nothing left to do here but
    // actually drop the section and whatever rows it still had.
    function handleRemoveWatchlistSection(watchlistId: string, sectionId: string) {
      setWatchlists((prev) => prev.map((w) => (w.id === watchlistId ? { ...w, sections: w.sections?.filter((s) => s.id !== sectionId) } : w)));
    }

    // The caller owns the actual reshuffling (see ChartWorkspaceProps.onMoveWatchlistRow's own
    // doc) — the library only ever reports "this row should end up at `toIndex` in this list".
    // One `nextRowsFor` computation covers both a same-list reorder and a cross-list move: it
    // always starts from that list's own *current* rows, removes the dragged row from it first
    // (a no-op wherever it wasn't already), then — only for whichever list is actually the
    // destination — inserts it at `toIndex` into what's left. Doing the removal before the
    // insertion in the very same pass is what makes a same-list reorder's own index land
    // correctly without any special-casing: `toIndex` is already documented as relative to the
    // list *without* the dragged row (see MoveWatchlistRowArgs), which this naturally produces.
    function handleMoveWatchlistRow(
      watchlistId: string,
      rowId: string,
      fromSectionId: string | null,
      toSectionId: string | null,
      toIndex: number
    ) {
      setWatchlists((prev) =>
        prev.map((w) => {
          if (w.id !== watchlistId) return w;
          const rowsFor = (sectionId: string | null) => (sectionId === null ? w.rows : (w.sections?.find((s) => s.id === sectionId)?.rows ?? []));
          const row = rowsFor(fromSectionId).find((r) => r.id === rowId);
          if (!row) return w;
          function nextRowsFor(sectionId: string | null) {
            let rows = rowsFor(sectionId);
            if (sectionId === fromSectionId) rows = rows.filter((r) => r.id !== rowId);
            if (sectionId === toSectionId) {
              const clamped = Math.min(Math.max(0, toIndex), rows.length);
              rows = [...rows.slice(0, clamped), row, ...rows.slice(clamped)];
            }
            return rows;
          }
          return { ...w, rows: nextRowsFor(null), sections: w.sections?.map((s) => ({ ...s, rows: nextRowsFor(s.id) })) };
        })
      );
    }

    // Same "caller owns `watchlists`, this only reports the new order" shape as
    // handleMoveWatchlistRow above — just reshuffling `sections` itself by the ids reported,
    // rather than moving a row between them.
    function handleReorderWatchlistSections(watchlistId: string, orderedSectionIds: string[]) {
      setWatchlists((prev) =>
        prev.map((w) => {
          if (w.id !== watchlistId || !w.sections) return w;
          const byId = new Map(w.sections.map((s) => [s.id, s]));
          return { ...w, sections: orderedSectionIds.map((id) => byId.get(id)!) };
        })
      );
    }

    // Storybook's own global decorator (see .storybook/preview.tsx) wraps every story in 32px of
    // padding, unrelated to ChartWorkspace itself — harmless normally, but it's exactly what
    // would keep the workspace (sized to fill 100% of the viewport on its own, see
    // ChartWorkspace's own `panelHeight` doc) from actually fitting the screen without a
    // scrollbar. A negative margin here cancels that padding back out.
    return (
      <div style={{ margin: -32 }}>
        {/* `watchlists`/`alerts` live on the workspace itself, not the chart template below — a
            template gets cloned into every panel (see ChartWorkspace's own doc on why), so a
            panel-level docked panel would render once per panel instead of once for the whole
            workspace. */}
        <ChartWorkspace
          defaultPanels={1}
          scripting
          ai={STORY_ASSISTANT}
          watchlists={watchlists}
          watchlistSymbolSearchResults={watchlistSearchResults}
          onWatchlistSymbolSearchChange={(query, category) => setWatchlistSearchResults(filterMockSymbols(query, category, []))}
          // A fresh id per insertion (not `result.id`, the *symbol's* own stable catalog id) —
          // reusing that would give two rows the same id the moment the same symbol gets added
          // twice (same watchlist or section), and removing either one via `r.id !== rowId`
          // (see handleRemoveWatchlistSymbol above) would then drop both at once.
          onAddWatchlistSymbol={(watchlistId, result) =>
            setWatchlists((prev) =>
              prev.map((w) => (w.id === watchlistId ? { ...w, rows: [...w.rows, { id: `row-${Date.now()}`, ticker: result.ticker, values: {} }] } : w))
            )
          }
          // `ChartWorkspace` already applies the click to whichever panel(s) the user picked (or
          // the sole panel, with just one open) internally — see its own `symbolByPanel` fork —
          // which is enough to update the *label*, but this story's own `data` is keyed off
          // `currentSymbol` (see the BTCUSD swap below), not off ChartWorkspace's internal
          // tracking, so a watchlist click alone left the label reading "BTCUSD" with the
          // previous symbol's own candles still showing (confirmed bug report: "les valeurs de
          // BTC_REAL_SAMPLE ne sont pas chargées même quand je sélectionne BTCUSD"). Setting it
          // here too keeps both in sync — this story only ever has 1 panel by default
          // (defaultPanels={1}), so the "would re-apply to every untargeted panel" concern a
          // multi-panel workspace has doesn't apply; a story exercising several panels at once
          // would need to track this per panel index instead.
          onWatchlistRowClick={(row) => setCurrentSymbol(row.ticker)}
          onCreateWatchlist={handleCreateWatchlist}
          onCreateWatchlistSection={handleCreateWatchlistSection}
          onRemoveWatchlistSymbol={handleRemoveWatchlistSymbol}
          onRemoveWatchlistSection={handleRemoveWatchlistSection}
          onMoveWatchlistRow={handleMoveWatchlistRow}
          onReorderWatchlistSections={handleReorderWatchlistSections}
          watchlistEarnings={DEMO_EARNINGS}
          watchlistDividends={DEMO_DIVIDENDS}
          watchlistNews={DEMO_NEWS}
          symbolProfiles={SYMBOL_PROFILES}
          alerts={<AlertsPanel alerts={alerts} onDeleteAlert={handleDeleteAlert} />}
          defaultScripts={DEBUG_SCRIPTS}
        >
          <CandlestickChart
            // BTCUSD swaps in the real 15-minute BTC/USDT klines (see btcRealSample.ts's own doc)
            // instead of a generated series — picking it from the symbol search is the quickest way
            // to check a script's own output (e.g. the KDE support/resistance example) against real
            // market structure without leaving this story for the dedicated BtcRealSample one.
            data={currentSymbol === "BTCUSD" ? BTC_REAL_SAMPLE : ALL_FEATURES_TIMEFRAME_DATA[timeframe as MockTimeframeKey] ?? ALL_FEATURES_DATASET}
            symbol={currentSymbol}
            events={ALL_FEATURES_EVENTS}
            drawingTools
            showVolume={false}
            showIndicators
            fundamentals={ALL_FEATURES_FUNDAMENTALS}
            customIndicators={CUSTOM_INDICATORS}
            fullscreenToggle
            zoomable
            timeframes={TIMEFRAMES}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            defaultChartDisplayMode={displayMode}
            onChartDisplayModeChange={setDisplayMode}
            symbolSearch
            symbolSearchResults={results}
            onSymbolSearchChange={(query, category) => setResults(filterMockSymbols(query, category, favorites))}
            onSymbolSelect={(r) => setCurrentSymbol(r.ticker)}
            defaultFavoriteSymbolIds={favorites}
            onFavoriteSymbolIdsChange={setFavorites}
            onAddSymbolOverlay={async (result) => {
              await new Promise((resolve) => setTimeout(resolve, 600));
              return generateOverlaySeries(result.ticker);
            }}
            alerts={alerts}
            onCreateAlert={handleCreateAlert}
            onUpdateAlert={handleUpdateAlert}
            onDeleteAlert={handleDeleteAlert}
            onPlaySound={playAlertSound}
            seasonality
            replay
            showTemplates
          />
        </ChartWorkspace>
      </div>
    );
  },
};
