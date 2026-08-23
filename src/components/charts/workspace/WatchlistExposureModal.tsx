import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Modal } from "../../primitives/Modal";
import { SegmentedControl } from "../../primitives/SegmentedControl";
import { DataTable } from "../../finance/DataTable";
import type { DataTableColumn } from "../../finance/DataTable";
import { DonutChart } from "../DonutChart";
import type { DonutDatum } from "../DonutChart";
import { WorldExposureMap } from "../WorldExposureMap";
import { defaultSymbolLogoColor } from "../candlestick/symbolSearchCatalog";
import type { ChartWorkspaceWatchlist, ChartWorkspaceWatchlistRow } from "./ChartWorkspaceWatchlist.interface";

const UNASSIGNED = "Autre";

type ExposureTab = "overview" | "earnings" | "dividends" | "news";

export interface WatchlistEarningsRow {
  id: string;
  ticker: string;
  companyName?: string;
  logoUrl?: string;
  logoColor?: string;
  date: string;
  /** e.g. "Avant l'ouverture" / "22:05" — full caller control over both content and icon, so a
   *  plain string works but a caller can just as well hand over an icon+text `ReactNode`. */
  time?: ReactNode;
  estimateEps?: string;
  actualEps?: string;
  surprise?: string;
  marketCap?: string;
}

export interface WatchlistDividendRow {
  id: string;
  ticker: string;
  companyName?: string;
  logoUrl?: string;
  logoColor?: string;
  exDividendDate: string;
  paymentDate: string;
  amount?: string;
  yield?: string;
}

export interface WatchlistNewsItem {
  id: string;
  time: string;
  ticker?: string;
  logoUrl?: string;
  logoColor?: string;
  headline: string;
  provider?: string;
  /** Drives the "Rapports financiers" filter toggle — never inferred from `headline`, entirely
   *  caller-supplied like everything else this modal renders. */
  isFinancialReport?: boolean;
}

// Same logo-badge + ticker layout `tableColumns`' own "symbol" column below already renders for
// the Overview tab, generalized with an optional subtitle (company name) for the three tabs below
// it — kept as a separate helper rather than reworking that column so the Overview tab's own
// existing markup/styling stays untouched.
function SymbolCell({ ticker, logoUrl, logoColor, index, subtitle }: { ticker: string; logoUrl?: string; logoColor?: string; index: number; subtitle?: string }) {
  return (
    <span className="lq-watchlist-exposure__symbol">
      <span className="lq-chart-workspace__watchlist-logo" style={logoUrl ? undefined : { backgroundColor: logoColor ?? defaultSymbolLogoColor(index) }}>
        {logoUrl ? <img src={logoUrl} alt="" /> : ticker.slice(0, 2).toUpperCase()}
      </span>
      <span className="lq-watchlist-exposure__symbol-text">
        <strong>{ticker}</strong>
        {subtitle && <span className="lq-watchlist-exposure__symbol-subtitle">{subtitle}</span>}
      </span>
    </span>
  );
}

// One count per distinct value of `pick(row)`, a row with none falling into a shared "Autre"
// bucket rather than being silently dropped — used identically for all three donuts below, just
// fed a different picker (assetType/sector/region).
function countBy(rows: ChartWorkspaceWatchlistRow[], pick: (row: ChartWorkspaceWatchlistRow) => string | undefined): DonutDatum[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = pick(row) ?? UNASSIGNED;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts, ([label, value]) => ({ id: label, label, value }));
}

export interface WatchlistExposureModalProps {
  open: boolean;
  onClose: () => void;
  /** The list to break down — `undefined` while none is active yet (mirrors `activeWatchlist`'s
   *  own possible-undefined state in WatchlistPanel), in which case this renders nothing. */
  watchlist: ChartWorkspaceWatchlist | undefined;
  /** Rows for the "Résultats" tab — entirely caller-supplied (this modal never fetches or infers
   *  an earnings calendar), empty/omitted renders that tab's own empty state. */
  earnings?: WatchlistEarningsRow[];
  /** Rows for the "Dividendes" tab — same caller-owns-the-data stance as `earnings`. */
  dividends?: WatchlistDividendRow[];
  /** Items for the "Actualités" tab — same caller-owns-the-data stance as `earnings`. */
  news?: WatchlistNewsItem[];
}

/** "Concentration/exposure" detail view for one watchlist — opened via the small pie-chart icon
 *  next to the list's own name (see WatchlistPanel). A `SegmentedControl` switches among four
 *  tabs: "Aperçu" (the original content — a table of every symbol in the list, ungrouped rows
 *  plus every section's own flattened together, followed by a region breakdown and two donuts,
 *  all grouping by whichever of `region`/`sector`/`assetType` a row carries, entirely
 *  caller-supplied and never fetched or inferred here, a row missing a given field still counting
 *  under that breakdown's own "Autre" bucket so all three always sum back to the list's own
 *  total), plus "Résultats"/"Dividendes"/"Actualités", each its own table over `earnings`/
 *  `dividends`/`news` — three more caller-supplied arrays this modal only ever renders, same
 *  "never fetches its own data" stance as the Overview tab's own three breakdowns. */
export function WatchlistExposureModal({ open, onClose, watchlist, earnings, dividends, news }: WatchlistExposureModalProps) {
  const rows = useMemo(() => {
    if (!watchlist) return [];
    const sectionRows = watchlist.sections?.flatMap((s) => s.rows) ?? [];
    return [...watchlist.rows, ...sectionRows];
  }, [watchlist]);

  const regionData = useMemo(() => countBy(rows, (r) => r.region), [rows]);
  const sectorData = useMemo(() => countBy(rows, (r) => r.sector), [rows]);
  const typeData = useMemo(() => countBy(rows, (r) => r.assetType), [rows]);

  const [activeTab, setActiveTab] = useState<ExposureTab>("overview");
  const [dividendSort, setDividendSort] = useState<"ex" | "payment">("ex");
  const [newsFilter, setNewsFilter] = useState<"all" | "reports">("all");

  const sortedDividends = useMemo(() => {
    const list = dividends ?? [];
    return [...list].sort((a, b) =>
      dividendSort === "ex" ? a.exDividendDate.localeCompare(b.exDividendDate) : a.paymentDate.localeCompare(b.paymentDate)
    );
  }, [dividends, dividendSort]);

  const filteredNews = useMemo(() => (news ?? []).filter((n) => newsFilter === "all" || n.isFinancialReport), [news, newsFilter]);

  if (!open || !watchlist) return null;

  const tableColumns: DataTableColumn<ChartWorkspaceWatchlistRow>[] = [
    {
      id: "symbol",
      header: "Symbole",
      sortValue: (r) => r.ticker,
      accessor: (r) => (
        <span className="lq-watchlist-exposure__symbol">
          <span
            className="lq-chart-workspace__watchlist-logo"
            style={r.logoUrl ? undefined : { backgroundColor: r.logoColor ?? defaultSymbolLogoColor(rows.indexOf(r)) }}
          >
            {r.logoUrl ? <img src={r.logoUrl} alt="" /> : r.ticker.slice(0, 2).toUpperCase()}
          </span>
          {r.ticker}
        </span>
      ),
    },
    ...watchlist.columns.map((c) => ({ id: c.id, header: c.label, accessor: (r: ChartWorkspaceWatchlistRow) => r.values[c.id] })),
    { id: "region", header: "Région", sortValue: (r) => r.region ?? "", accessor: (r) => r.region ?? "—" },
    { id: "sector", header: "Secteur", sortValue: (r) => r.sector ?? "", accessor: (r) => r.sector ?? "—" },
    { id: "assetType", header: "Type", sortValue: (r) => r.assetType ?? "", accessor: (r) => r.assetType ?? "—" },
  ];

  const earningsList = earnings ?? [];
  const earningsColumns: DataTableColumn<WatchlistEarningsRow>[] = [
    {
      id: "symbol",
      header: "Symbole",
      sortValue: (r) => r.ticker,
      accessor: (r) => <SymbolCell ticker={r.ticker} logoUrl={r.logoUrl} logoColor={r.logoColor} index={earningsList.indexOf(r)} subtitle={r.companyName} />,
    },
    { id: "date", header: "Date", sortValue: (r) => r.date, accessor: (r) => r.date },
    { id: "time", header: "Heure", accessor: (r) => r.time ?? "—" },
    { id: "estimateEps", header: "BPA estimé", align: "right", accessor: (r) => r.estimateEps ?? "—" },
    { id: "actualEps", header: "BPA réel", align: "right", accessor: (r) => r.actualEps ?? "—" },
    { id: "surprise", header: "Surprise", align: "right", accessor: (r) => r.surprise ?? "—" },
    { id: "marketCap", header: "Capitalisation", align: "right", accessor: (r) => r.marketCap ?? "—" },
  ];

  const dividendColumns: DataTableColumn<WatchlistDividendRow>[] = [
    {
      id: "symbol",
      header: "Symbole",
      sortValue: (r) => r.ticker,
      accessor: (r) => <SymbolCell ticker={r.ticker} logoUrl={r.logoUrl} logoColor={r.logoColor} index={sortedDividends.indexOf(r)} subtitle={r.companyName} />,
    },
    { id: "exDividendDate", header: "Date ex-dividende", sortValue: (r) => r.exDividendDate, accessor: (r) => r.exDividendDate },
    { id: "paymentDate", header: "Date de paiement", sortValue: (r) => r.paymentDate, accessor: (r) => r.paymentDate },
    { id: "amount", header: "Montant", align: "right", accessor: (r) => r.amount ?? "—" },
    { id: "yield", header: "Rendement", align: "right", accessor: (r) => r.yield ?? "—" },
  ];

  const newsColumns: DataTableColumn<WatchlistNewsItem>[] = [
    { id: "time", header: "Heure", sortValue: (r) => r.time, accessor: (r) => r.time },
    {
      id: "instrument",
      header: "Instrument",
      accessor: (r) => (r.ticker ? <SymbolCell ticker={r.ticker} logoUrl={r.logoUrl} logoColor={r.logoColor} index={filteredNews.indexOf(r)} /> : "—"),
    },
    { id: "headline", header: "Titre", accessor: (r) => r.headline },
    { id: "provider", header: "Fournisseur", accessor: (r) => r.provider ?? "—" },
  ];

  return (
    <Modal open onClose={onClose} title={`Répartition — ${watchlist.name}`} size="fullscreen">
      <div className="lq-watchlist-exposure">
        <SegmentedControl
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "overview", label: "Aperçu" },
            { value: "earnings", label: "Résultats" },
            { value: "dividends", label: "Dividendes" },
            { value: "news", label: "Actualités" },
          ]}
        />

        {activeTab === "overview" && (
          <>
            <DataTable columns={tableColumns} rows={rows} rowKey={(r) => r.id} emptyMessage="Cette liste ne contient aucun symbole" />
            {rows.length > 0 && (
              <>
                <h3 className="lq-watchlist-exposure__section-title">Exposition par région</h3>
                <WorldExposureMap data={regionData} />

                <h3 className="lq-watchlist-exposure__section-title">Exposition par secteur et type</h3>
                <div className="lq-watchlist-exposure__charts">
                  <DonutChart data={sectorData} centerValue={sectorData.length} centerCaption="Secteurs" legendPosition="left" />
                  <DonutChart data={typeData} centerValue={typeData.length} centerCaption="Types de symboles" legendPosition="left" />
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "earnings" && (
          <DataTable columns={earningsColumns} rows={earningsList} rowKey={(r) => r.id} emptyMessage="Aucun résultat à venir" />
        )}

        {activeTab === "dividends" && (
          <>
            <SegmentedControl
              className="lq-watchlist-exposure__subfilter"
              value={dividendSort}
              onChange={setDividendSort}
              options={[
                { value: "ex", label: "Par date ex-dividende" },
                { value: "payment", label: "Par date de paiement" },
              ]}
            />
            <DataTable columns={dividendColumns} rows={sortedDividends} rowKey={(r) => r.id} emptyMessage="Aucun dividende à venir" />
          </>
        )}

        {activeTab === "news" && (
          <>
            <SegmentedControl
              className="lq-watchlist-exposure__subfilter"
              value={newsFilter}
              onChange={setNewsFilter}
              options={[
                { value: "all", label: "Tout" },
                { value: "reports", label: "Rapports financiers" },
              ]}
            />
            <DataTable columns={newsColumns} rows={filteredNews} rowKey={(r) => r.id} emptyMessage="Aucune actualité" />
          </>
        )}
      </div>
    </Modal>
  );
}
