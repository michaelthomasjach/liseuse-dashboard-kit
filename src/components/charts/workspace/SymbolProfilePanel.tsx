import { useMemo, useState } from "react";
import { PriceChangeTag } from "../../finance/PriceChangeTag";
import { Sparkline } from "../Sparkline";
import { EarningsDotChart } from "../EarningsDotChart";
import { LineAreaChart } from "../LineAreaChart";
import type { ChartPoint } from "../LineAreaChart";
import { MaximizeIcon, DetachWindowIcon } from "../../icons";
import { SymbolFinancialsView } from "./SymbolFinancialsView";
import { DetachedWindow } from "../candlestick/components/DetachedWindow";
import { Modal } from "../../primitives/Modal";
import { PRICE_AXIS_WIDTH_MOBILE } from "../candlestick/constants";
import type { Candle } from "../candlestick/interfaces/Candle.interface";
import type { SymbolProfile } from "./SymbolProfile.interface";

/** The price chart's own range buttons, in the order they render. `days` is a lookback in calendar
 *  days; `"ytd"` and `"all"` are the two that can't be expressed that way. */
const PRICE_RANGES: { key: string; days: number | "ytd" | "all" }[] = [
  { key: "1D", days: 1 },
  { key: "5D", days: 5 },
  { key: "1M", days: 30 },
  { key: "3M", days: 90 },
  { key: "YTD", days: "ytd" },
  { key: "1Y", days: 365 },
  { key: "Toute", days: "all" },
];

const DEFAULT_PRICE_RANGE = "3M";

/** Measured back from the *last candle's* own date, never from `Date.now()`: a caller's history can
 *  legitimately end days ago — a market closed since Friday, a fixed dataset in a story — and
 *  counting back from today would then return an empty "1D" on data that is perfectly fine.
 *  `null` means "no cutoff", i.e. keep everything. */
function rangeCutoff(days: number | "ytd" | "all", last: Date): Date | null {
  if (days === "all") return null;
  if (days === "ytd") return new Date(last.getFullYear(), 0, 1);
  const cutoff = new Date(last);
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

export interface SymbolProfilePanelProps {
  symbol: string;
  /** Last close and its change from the previous one — derived by the caller (`ChartWorkspace`)
   *  directly from the focused panel's own OHLCV data, the same single source of truth the chart
   *  itself reads, rather than living on `SymbolProfile` where it could drift out of sync with
   *  what the chart actually shows. `null` before any data is available yet. */
  price: number | null;
  change: number | null;
  changePercent: number | null;
  /** Everything else about this symbol — entirely caller-supplied, `undefined` when the caller has
   *  nothing for the currently-focused symbol (a plain price/change readout still renders on its
   *  own in that case, see the component's own doc). */
  profile: SymbolProfile | undefined;
  /** "Plus d'actualités" — only rendered when `profile.news` has more than one item (the single
   *  most recent headline always shows on its own with no link needed). No default behavior of any
   *  kind (open a modal, navigate…) is assumed; omit the prop to just not show the link. */
  onMoreNews?: () => void;
  /** OHLCV history for this symbol, oldest first — the same array the chart itself is drawn from,
   *  of which only `date`/`close` are read here. Passing it adds a plain close-price curve with its
   *  own range buttons right under the price. Omitted (the desktop split's own case, see
   *  ChartWorkspace) it simply isn't rendered: that layout already has the real chart on screen
   *  beside this panel, so a second, smaller one of the same prices would be redundant. */
  priceHistory?: Candle[];
  /** Trailing button in the range toolbar — the same "go bigger" affordance the fullscreen toggle
   *  uses elsewhere. On the mobile layout it switches to the chart page; omit it and the button
   *  isn't rendered at all. */
  onOpenInChart?: () => void;
  /** Which surface this copy is rendered on. It decides two things that used to be one: whether
   *  there is anywhere bigger for the reader to go (the full-screen and detach buttons, the
   *  "Afficher plus de détails" link, and the modal/window those open), and whether the panel has
   *  the width to show the financial tabs at all.
   *
   *  - `"docked"` (default) — the 260px column beside the chart. Expandable; no financial tables,
   *    which that width simply cannot show.
   *  - `"expanded"` — the full-screen modal and the detached window. Already as big as it gets, so
   *    nothing to expand; financial tables, and an earnings chart drawn at real size.
   *  - `"mobile"` — the sheet that slides up over the phone layout. It is a full page in its own
   *    right, so it carries the tables too, but a phone is not the place for a 1100px earnings
   *    chart, a second full-screen modal on top of a full-screen sheet, or a detached window. */
  layout?: "docked" | "expanded" | "mobile";
}

/** The workspace side panel's own "company info" section (see `useSymbolProfileSplit`'s own doc
 *  for the resizable divider above it) — inspired by TradingView's own symbol-details panel: name/
 *  exchange, current price and change, a trailing-return grid, and a small seasonality path.
 *  Degrades gracefully with no `profile` at all (a bare price/change readout, exactly what the
 *  chart's own header already shows, still has real value on its own) rather than rendering
 *  nothing or a wall of placeholders. */
export function SymbolProfilePanel({
  symbol,
  price,
  change,
  changePercent,
  profile,
  onMoreNews,
  priceHistory,
  onOpenInChart,
  layout = "docked",
}: SymbolProfilePanelProps) {
  // The docked column is the only copy with somewhere bigger to go — see `layout`'s own doc.
  const canExpand = layout === "docked";
  const showFinancials = layout !== "docked";
  const [priceRange, setPriceRange] = useState(DEFAULT_PRICE_RANGE);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [earningsModalOpen, setEarningsModalOpen] = useState(false);
  // The details torn off into a browser window of its own, so they can sit beside the chart rather
  // than over it.
  const [detachedWindow, setDetachedWindow] = useState<Window | null>(null);

  /** Opened inside the click, never from an effect: a `window.open` that runs after the gesture has
   *  ended is treated as an unsolicited popup and blocked. */
  function detachDetails() {
    const child = window.open("", "", "width=1200,height=900");
    if (child === null) return;
    setFullscreenOpen(false);
    setDetachedWindow(child);
  }
  // Every range resolved at once rather than just the selected one — the buttons need to know
  // which of them have anything to show (a daily-candle history has exactly one point in "1D",
  // which is a flat nothing, not a curve), and there are seven cheap filters over one array here,
  // not seven charts.
  const pointsByRange = useMemo(() => {
    const byRange: Record<string, ChartPoint[]> = {};
    const last = priceHistory && priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].date : null;
    if (!priceHistory || last === null) return byRange;
    for (const range of PRICE_RANGES) {
      const cutoff = rangeCutoff(range.days, last);
      byRange[range.key] = priceHistory
        .filter((candle) => cutoff === null || candle.date.getTime() >= cutoff.getTime())
        .map((candle) => ({ x: candle.date, y: candle.close }));
    }
    return byRange;
  }, [priceHistory]);
  const rangePoints = pointsByRange[priceRange] ?? [];

  return (
    <div className="lq-chart-workspace__symbol-profile">
      <div className="lq-chart-workspace__symbol-profile-header">
        <div className="lq-chart-workspace__symbol-profile-name">
          <span className="lq-chart-workspace__symbol-profile-ticker">{symbol}</span>
          {(profile?.name || profile?.exchange || profile?.instrumentType) && (
            <span className="lq-chart-workspace__symbol-profile-subtitle">
              {[profile?.name, [profile?.exchange, profile?.instrumentType].filter(Boolean).join(" · ")].filter(Boolean).join(" — ")}
            </span>
          )}
        </div>
        {/* One trailing group, so the header's own `space-between` keeps the badge and the button
            together on the right rather than spreading three items across the row. */}
        <span className="lq-chart-workspace__symbol-profile-header-actions">
          {profile?.marketStatus && <span className="lq-chart-workspace__symbol-profile-status">{profile.marketStatus}</span>}
          {canExpand && (
            <button
              type="button"
              className="lq-chart-workspace__symbol-profile-expand"
              onClick={detachDetails}
              aria-label="Ouvrir les détails dans une fenêtre"
              title="Ouvrir dans une fenêtre"
            >
              <DetachWindowIcon size={14} />
            </button>
          )}
          {canExpand && (
            <button
              type="button"
              className="lq-chart-workspace__symbol-profile-expand"
              onClick={() => setFullscreenOpen(true)}
              aria-label="Afficher les détails en plein écran"
              title="Afficher les détails en plein écran"
            >
              <MaximizeIcon size={14} />
            </button>
          )}
        </span>
      </div>

      {price !== null && (
        <div className="lq-chart-workspace__symbol-profile-price-row">
          <span className="lq-chart-workspace__symbol-profile-price">{price.toFixed(2)}</span>
          {change !== null && changePercent !== null && (
            <span className="lq-chart-workspace__symbol-profile-change">
              {change >= 0 ? "+" : ""}
              {change.toFixed(2)} <PriceChangeTag value={changePercent} />
            </span>
          )}
        </div>
      )}

      {/* A plain close-price curve — no volume, no grid, no legend, no tooltip chrome: this sits
          directly under the price it plots, on a phone, and everything the full chart offers is one
          tap away through the button at the end of the toolbar. Price axis on the right, matching
          CandlestickChart's own convention, so switching between the two doesn't move the numbers
          from one side to the other. `curveType="linear"` rather than the default spline: at daily
          resolution a smoothed curve invents peaks between real closes. */}
      {priceHistory && priceHistory.length > 1 && (
        <div className="lq-chart-workspace__symbol-profile-chart">
          {rangePoints.length > 1 ? (
            <LineAreaChart
              series={[{ id: symbol, label: symbol, data: rangePoints }]}
              height={140}
              // Explicit, because the defaults are wrong for this shape in both directions: they
              // reserve a left gutter for a Y axis that lives on the *right* here (which is what
              // held the curve and its date axis off the left edge), and the right gutter they do
              // reserve is sized for a legend-less inline chart, too narrow for a price label —
              // "105.00" was being cut off against the screen. The gutter that replaces it is
              // PRICE_AXIS_WIDTH_MOBILE, the very width the candle chart's own price axis uses on
              // this layout, so the two read as the same column.
              margin={{ top: 4, right: PRICE_AXIS_WIDTH_MOBILE, bottom: 18, left: 0 }}
              xType="time"
              curveType="linear"
              yAxisOrientation="right"
              showGrid={false}
              showLegend={false}
              fullscreenToggle={false}
              showZoomReset={false}
              zoomable={false}
              xTicks={4}
              yTicks={4}
              embedded
            />
          ) : (
            <p className="lq-chart-workspace__symbol-profile-chart-empty">Pas assez de données sur cette plage.</p>
          )}
          <div className="lq-chart-workspace__symbol-profile-chart-toolbar">
            {PRICE_RANGES.map((range) => (
              <button
                key={range.key}
                type="button"
                className={[
                  "lq-chart-workspace__symbol-profile-range",
                  range.key === priceRange && "lq-chart-workspace__symbol-profile-range--active",
                ]
                  .filter(Boolean)
                  .join(" ")}
                // A range holding one point or none draws no line — disabled rather than left
                // tappable so the toolbar says up front what this history actually covers,
                // instead of answering with an empty chart after the fact.
                disabled={(pointsByRange[range.key]?.length ?? 0) < 2}
                onClick={() => setPriceRange(range.key)}
                aria-pressed={range.key === priceRange}
              >
                {range.key}
              </button>
            ))}
            {onOpenInChart && (
              <button
                type="button"
                className="lq-chart-workspace__symbol-profile-chart-expand"
                onClick={onOpenInChart}
                aria-label="Ouvrir dans le graphique"
                title="Ouvrir dans le graphique"
              >
                <MaximizeIcon size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* The financial tabs. Never in the docked copy: they are a page's worth of tables, which a
          260px column cannot show and the modal exists to give room to. The mobile sheet is a full
          page, so it gets them where the column does not — the tab strip and every table scroll
          horizontally on their own, so a phone's width costs nothing here. */}
      {showFinancials && profile?.financials && (
        <div className="lq-chart-workspace__symbol-profile-section">
          <SymbolFinancialsView financials={profile.financials} />
        </div>
      )}

      {profile?.description && <p className="lq-chart-workspace__symbol-profile-description">{profile.description}</p>}

      {profile?.sectors && profile.sectors.length > 0 && (
        <div className="lq-chart-workspace__symbol-profile-sectors">
          {profile.sectors.map((sector) => (
            <span key={sector} className="lq-chart-workspace__symbol-profile-sector-tag">
              {sector}
            </span>
          ))}
        </div>
      )}

      {profile?.performance && profile.performance.length > 0 && (
        <div className="lq-chart-workspace__symbol-profile-section">
          <span className="lq-chart-workspace__symbol-profile-section-title">Performance</span>
          <div className="lq-chart-workspace__symbol-profile-performance-grid">
            {profile.performance.map((p) => (
              <div key={p.label} className="lq-chart-workspace__symbol-profile-performance-tile">
                <PriceChangeTag value={p.changePercent} showIcon={false} />
                <span className="lq-chart-workspace__symbol-profile-performance-label">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {profile?.seasonality && profile.seasonality.length > 1 && (
        <div className="lq-chart-workspace__symbol-profile-section">
          <span className="lq-chart-workspace__symbol-profile-section-title">Saisonnalité</span>
          <Sparkline
            data={profile.seasonality.map((p) => p.value)}
            width={260}
            height={48}
            area
            colorByTrend
            className="lq-chart-workspace__symbol-profile-seasonality"
          />
        </div>
      )}

      {profile?.news && profile.news.length > 0 && (
        <div className="lq-chart-workspace__symbol-profile-section">
          <span className="lq-chart-workspace__symbol-profile-section-title">Actualités</span>
          <div className="lq-chart-workspace__symbol-profile-news">
            <span className="lq-chart-workspace__symbol-profile-news-time">{profile.news[0].time}</span>
            {profile.news[0].url ? (
              <a
                href={profile.news[0].url}
                target="_blank"
                rel="noreferrer"
                className="lq-chart-workspace__symbol-profile-news-headline lq-chart-workspace__symbol-profile-news-headline--link"
              >
                {profile.news[0].headline}
                {profile.news[0].provider && ` — ${profile.news[0].provider}`}
              </a>
            ) : (
              <span className="lq-chart-workspace__symbol-profile-news-headline">
                {profile.news[0].headline}
                {profile.news[0].provider && ` — ${profile.news[0].provider}`}
              </span>
            )}
          </div>
          {profile.news.length > 1 && onMoreNews && (
            <button type="button" className="lq-chart-workspace__symbol-profile-news-more" onClick={onMoreNews}>
              Plus d'actualités ›
            </button>
          )}
        </div>
      )}

      {profile?.keyStats && (
        <div className="lq-chart-workspace__symbol-profile-section">
          <span className="lq-chart-workspace__symbol-profile-section-title">Statistiques clés</span>
          <div className="lq-chart-workspace__symbol-profile-stats">
            {profile.keyStats.nextEarningsInDays !== undefined && (
              <div className="lq-chart-workspace__symbol-profile-stat-row">
                <span className="lq-chart-workspace__symbol-profile-stat-label">Prochain rapport de résultats</span>
                <span className="lq-chart-workspace__symbol-profile-stat-value">Dans {profile.keyStats.nextEarningsInDays} jours</span>
              </div>
            )}
            {profile.keyStats.volume && (
              <div className="lq-chart-workspace__symbol-profile-stat-row">
                <span className="lq-chart-workspace__symbol-profile-stat-label">Volume</span>
                <span className="lq-chart-workspace__symbol-profile-stat-value">{profile.keyStats.volume}</span>
              </div>
            )}
            {profile.keyStats.averageVolume && (
              <div className="lq-chart-workspace__symbol-profile-stat-row">
                <span className="lq-chart-workspace__symbol-profile-stat-label">Volume moyen (30 j)</span>
                <span className="lq-chart-workspace__symbol-profile-stat-value">{profile.keyStats.averageVolume}</span>
              </div>
            )}
            {profile.keyStats.marketCap && (
              <div className="lq-chart-workspace__symbol-profile-stat-row">
                <span className="lq-chart-workspace__symbol-profile-stat-label">Capitalisation boursière</span>
                <span className="lq-chart-workspace__symbol-profile-stat-value">{profile.keyStats.marketCap}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {profile?.earnings && profile.earnings.length > 0 && (
        <div className="lq-chart-workspace__symbol-profile-section">
          <div className="lq-chart-workspace__symbol-profile-earnings-header">
            <span className="lq-chart-workspace__symbol-profile-section-title">Résultats</span>
            {profile.keyStats?.nextEarningsInDays !== undefined && (
              <span className="lq-chart-workspace__symbol-profile-earnings-badge">{profile.keyStats.nextEarningsInDays}</span>
            )}
            {/* Pushed to the header's trailing edge by its own auto margin. Eight quarters in a
                120px-tall drawing inside a narrow panel is readable but not comparable; the modal
                is the same component with room to breathe, which is why it takes a `scale` rather
                than just a bigger box — at three times the height, 4px dots would disappear. */}
            <button
              type="button"
              className="lq-chart-workspace__symbol-profile-earnings-expand"
              onClick={() => setEarningsModalOpen(true)}
              aria-label="Agrandir les résultats"
              title="Agrandir les résultats"
            >
              <MaximizeIcon size={13} />
            </button>
          </div>
          {/* Real dimensions in the fullscreen copy rather than letting CSS stretch the 260px one:
              the drawing carries a viewBox, so stretching it magnifies its own 9px labels by the
              same factor — 51px in a column that wide. Drawn larger, the labels stay 9px and the
              dots grow with `scale`, which is exactly what that prop is for. Only the `"expanded"`
              layout: the mobile sheet cannot show 1100px of chart either, and is not the copy this
              is sized for. */}
          <EarningsDotChart points={profile.earnings} {...(layout === "expanded" ? { width: 1100, height: 340, scale: 2 } : {})} />
          {/* Under the chart rather than in the header: the header's own icons are for people who
              already know what they do, and this is the one action a reader arrives at by reading
              downward. Only on the docked copy — inside the modal there is nothing further to
              open. */}
          {canExpand && (
            <button type="button" className="lq-chart-workspace__symbol-profile-more" onClick={() => setFullscreenOpen(true)}>
              Afficher plus de détails
            </button>
          )}
        </div>
      )}


      {/* The whole panel again, at the size of the screen. The same component rather than a
          bespoke big layout: everything it knows how to show is already here, and the modal's only
          job is to give it width. `layout="expanded"` on the inner one — see the prop's own doc. */}
      {canExpand && fullscreenOpen && (
        <Modal
          open
          onClose={() => setFullscreenOpen(false)}
          title={
            <span className="lq-chart-workspace__symbol-profile-modal-title">
              {`${symbol} — détails`}
              <button
                type="button"
                className="lq-chart-workspace__symbol-profile-expand"
                // The modal's own header is draggable; without this the press would start a drag
                // as well as open the window.
                onPointerDown={(e) => e.stopPropagation()}
                onClick={detachDetails}
                aria-label="Ouvrir les détails dans une fenêtre"
                title="Ouvrir dans une fenêtre"
              >
                <DetachWindowIcon size={14} />
              </button>
            </span>
          }
          size="fullscreen"
          footer={null}
        >
          <SymbolProfilePanel
            symbol={symbol}
            price={price}
            change={change}
            changePercent={changePercent}
            profile={profile}
            onMoreNews={onMoreNews}
            priceHistory={priceHistory}
            onOpenInChart={onOpenInChart}
            layout="expanded"
          />
        </Modal>
      )}

      {/* Rendered from this panel rather than from the section above so it survives the section's
          own conditional — and `size="wide"` because the point is horizontal room: eight quarters
          need width far more than height before they can be compared by eye. */}
      {canExpand && detachedWindow !== null && (
        <DetachedWindow
          target={detachedWindow}
          title={`${symbol} — détails`}
          themeSource={typeof document === "undefined" ? null : (document.querySelector(".lq-root") as HTMLElement | null)}
          onClose={() => setDetachedWindow(null)}
        >
          {/* The same expanded copy the modal shows — `layout="expanded"` marks it as the one
              that cannot be opened further (see the prop's own doc). */}
          <SymbolProfilePanel
            symbol={symbol}
            price={price}
            change={change}
            changePercent={changePercent}
            profile={profile}
            onMoreNews={onMoreNews}
            priceHistory={priceHistory}
            onOpenInChart={onOpenInChart}
            layout="expanded"
          />
        </DetachedWindow>
      )}

      {profile?.earnings && profile.earnings.length > 0 && (
        <Modal open={earningsModalOpen} onClose={() => setEarningsModalOpen(false)} title={`Résultats — ${symbol}`} size="wide">
          <EarningsDotChart points={profile.earnings} width={760} height={420} scale={2} />
        </Modal>
      )}
    </div>
  );
}
