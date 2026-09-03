import { useMemo, useState } from "react";
import { PriceChangeTag } from "../../finance/PriceChangeTag";
import { Sparkline } from "../Sparkline";
import { EarningsDotChart } from "../EarningsDotChart";
import { LineAreaChart } from "../LineAreaChart";
import type { ChartPoint } from "../LineAreaChart";
import { MaximizeIcon } from "../../icons";
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
}

/** The workspace side panel's own "company info" section (see `useSymbolProfileSplit`'s own doc
 *  for the resizable divider above it) — inspired by TradingView's own symbol-details panel: name/
 *  exchange, current price and change, a trailing-return grid, and a small seasonality path.
 *  Degrades gracefully with no `profile` at all (a bare price/change readout, exactly what the
 *  chart's own header already shows, still has real value on its own) rather than rendering
 *  nothing or a wall of placeholders. */
export function SymbolProfilePanel({ symbol, price, change, changePercent, profile, onMoreNews, priceHistory, onOpenInChart }: SymbolProfilePanelProps) {
  const [priceRange, setPriceRange] = useState(DEFAULT_PRICE_RANGE);
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
        {profile?.marketStatus && <span className="lq-chart-workspace__symbol-profile-status">{profile.marketStatus}</span>}
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
          </div>
          <EarningsDotChart points={profile.earnings} />
        </div>
      )}
    </div>
  );
}
