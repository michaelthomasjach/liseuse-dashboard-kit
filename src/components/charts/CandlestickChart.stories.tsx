import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  CandlestickChart,
  type TimeframeEntry,
  type ChartEvent,
  type FundamentalDataPoint,
  type SymbolSearchResult,
  type Candle,
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
} from "./ChartWorkspace";
import { generateCandles, generateCandlesByTimeframe, type MockTimeframeKey } from "../../test-data/financeSampleData";

const meta: Meta<typeof CandlestickChart> = {
  title: "Charts/CandlestickChart",
  component: CandlestickChart,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof CandlestickChart>;

// Generated once at module load (not inside `render`, which re-runs on every interaction) —
// a real app would memoize its own data the same way rather than regenerate it per render.
const MEDIUM_DATASET = generateCandles(2_500, 180, 44);
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

// Taller than the `height` prop's own default (380) — a more realistic size for these demos,
// which otherwise felt cramped compared to how the chart gets used in a real dashboard.
const STORY_HEIGHT = 640;

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
  { id: "change", label: "Variation", sortValue: (row) => (row as DemoWatchlistRow).raw.change },
];

type DemoWatchlistRow = ChartWorkspaceWatchlistRow & { raw: { price: number; change: number } };

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
  return {
    id,
    ticker,
    values: { price: priceLabel, change: <span style={{ color: up ? "var(--lq-color-up)" : "var(--lq-color-down)" }}>{changeLabel}</span> },
    assetType,
    sector,
    region,
    raw: { price, change },
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
          // the sole panel, with just one open) internally — see its own `symbolByPanel` fork.
          // This fires purely as an FYI afterward; setting `currentSymbol` (the *shared* template
          // default every not-yet-individually-targeted panel still falls back to) here would
          // re-apply the click to every one of *those* panels too, on top of whichever one(s) were
          // actually picked.
          onWatchlistRowClick={() => {}}
          onCreateWatchlist={handleCreateWatchlist}
          onCreateWatchlistSection={handleCreateWatchlistSection}
          onRemoveWatchlistSymbol={handleRemoveWatchlistSymbol}
          onRemoveWatchlistSection={handleRemoveWatchlistSection}
          onMoveWatchlistRow={handleMoveWatchlistRow}
          onReorderWatchlistSections={handleReorderWatchlistSections}
          watchlistEarnings={DEMO_EARNINGS}
          watchlistDividends={DEMO_DIVIDENDS}
          watchlistNews={DEMO_NEWS}
          alerts={<AlertsPanel alerts={alerts} onDeleteAlert={handleDeleteAlert} />}
        >
          <CandlestickChart
            data={ALL_FEATURES_TIMEFRAME_DATA[timeframe as MockTimeframeKey] ?? ALL_FEATURES_DATASET}
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
            showTemplates
          />
        </ChartWorkspace>
      </div>
    );
  },
};

export const LargeDataset: Story = {
  name: "Grand volume de données (2 500 bougies)",
  render: () => (
    <div style={{ padding: 24 }}>
      <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
        2 500 bougies (~10 ans de séance). Les bougies, le volume, le crosshair et les lignes de dessin sont rendus
        sur un seul <code>canvas</code> plutôt qu'un nœud SVG par bougie — zoom/pan/dessin restent fluides à cette
        échelle. Molette ou glisser pour naviguer dans l'historique. S'ouvre sur les 500 dernières bougies par défaut
        (`initialVisibleCandles`, appliqué une seule fois au montage) — "Réinitialiser le zoom" revient à cette même
        vue initiale (pas tout l'historique dézoomé) ; pour voir les 2 500, dézoomer manuellement.
      </p>
      <CandlestickChart data={MEDIUM_DATASET} symbol="GOOGL" drawingTools timeframes={TIMEFRAMES} timeframe="1d" height={STORY_HEIGHT} />
    </div>
  ),
};

// 15 real seconds per candle (not a genuine "1m"/"5m" interval) purely so the countdown-to-
// next-candle and a real new candle forming are both watchable within a normal Storybook
// session instead of requiring several real minutes of patience.
const LIVE_INTERVAL_MS = 15_000;

function generateLiveSeed(count: number, start: number): Candle[] {
  const candles: Candle[] = [];
  let close = start;
  const now = Date.now();
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(now - i * LIVE_INTERVAL_MS);
    const open = close;
    const change = (Math.random() - 0.5) * (start * 0.006);
    close = Math.max(1, open + change);
    const high = Math.max(open, close) + Math.random() * (start * 0.002);
    const low = Math.min(open, close) - Math.random() * (start * 0.002);
    candles.push({ date, open, high, low, close, volume: Math.round(Math.random() * 50_000) });
  }
  return candles;
}

export const LiveMarket: Story = {
  name: "Marché ouvert (simulation)",
  render: () => {
    const [data, setData] = useState<Candle[]>(() => generateLiveSeed(120, 180));

    // Every real second: either nudges the still-forming last candle's close (extending its
    // high/low if this tick pushed past either), or — once LIVE_INTERVAL_MS has actually
    // elapsed since it opened — closes it and starts a brand new one. This is the *story*
    // simulating a live feed; the component itself has no polling/simulation of its own, it
    // only ever renders whatever `data` it's given.
    useEffect(() => {
      const id = setInterval(() => {
        setData((prev) => {
          const last = prev[prev.length - 1];
          const change = (Math.random() - 0.5) * (last.close * 0.004);
          if (Date.now() - last.date.getTime() >= LIVE_INTERVAL_MS) {
            const open = last.close;
            const close = Math.max(1, open + change);
            const next: Candle = {
              date: new Date(last.date.getTime() + LIVE_INTERVAL_MS),
              open,
              close,
              high: Math.max(open, close),
              low: Math.min(open, close),
              volume: Math.round(Math.random() * 50_000),
            };
            return [...prev, next];
          }
          const close = Math.max(1, last.close + change);
          const updated: Candle = {
            ...last,
            close,
            high: Math.max(last.high, close),
            low: Math.min(last.low, close),
            volume: (last.volume ?? 0) + Math.round(Math.random() * 500),
          };
          return [...prev.slice(0, -1), updated];
        });
      }, 1000);
      return () => clearInterval(id);
    }, []);

    return (
      <div style={{ padding: 24 }}>
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
          `data` change toutes les secondes ici, uniquement pour la démo — la bibliothèque elle-même ne simule
          rien, elle se contente d'afficher ce qu'on lui passe. `livePrice` affiche une ligne pointillée sur le
          close de la dernière bougie, sa valeur sur l'axe Y (verte/rouge selon le sens depuis la clôture
          précédente) et, juste en dessous, un <strong>compte à rebours</strong> vers la prochaine bougie —
          l'intervalle est déduit de l'écart entre les deux dernières bougies (pas une prop séparée) : à 5 minutes
          il compterait de 05:00 à 00:00, ici (15 secondes par bougie, pour rester regardable) de 00:15 à 00:00,
          avant qu'une vraie nouvelle bougie apparaisse.
        </p>
        <CandlestickChart data={data} symbol="LIVE" livePrice showVolume height={STORY_HEIGHT} />
      </div>
    );
  },
};

const SCRIPTING_DATASET = generateCandles(200, 150, 77);

export const Scripting: Story = {
  name: "Éditeur de script",
  render: () => {
    const [alerts, setAlerts] = useState<{ scriptId: string; message: string; date: Date }[]>([]);
    return (
      <div style={{ padding: 24 }}>
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
          Bouton {"</>"} dans l'en-tête : éditeur de script JavaScript intégré (CodeMirror, chargé
          uniquement à l'ouverture — voir ScriptEditorCodeMirror.tsx) pour créer des indicateurs/
          signaux/alertes personnalisés, exécutés bougie par bougie dans un Worker sandboxé.
        </p>
        {alerts.length > 0 && (
          <ul data-testid="script-alerts" style={{ fontSize: 12, fontFamily: "monospace", marginBottom: 8 }}>
            {alerts.map((a, i) => (
              <li key={i}>
                [{a.scriptId}] {a.message}
              </li>
            ))}
          </ul>
        )}
        <CandlestickChart
          data={SCRIPTING_DATASET}
          symbol="QNTM"
          timeframes={TIMEFRAMES}
          timeframe="1d"
          showIndicators
          defaultIndicators={[
            { id: "indicator-0", kind: "rsi", period: 14 },
            { id: "indicator-1", kind: "macd", period: 0, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
          ]}
          scripting
          onScriptAlert={(event) => setAlerts((prev) => [...prev, { scriptId: event.scriptId, message: event.message, date: event.date }])}
          height={STORY_HEIGHT}
        />
      </div>
    );
  },
};
