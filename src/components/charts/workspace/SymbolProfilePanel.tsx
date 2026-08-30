import { PriceChangeTag } from "../../finance/PriceChangeTag";
import { Sparkline } from "../Sparkline";
import { EarningsDotChart } from "../EarningsDotChart";
import type { SymbolProfile } from "./SymbolProfile.interface";

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
}

/** The workspace side panel's own "company info" section (see `useSymbolProfileSplit`'s own doc
 *  for the resizable divider above it) — inspired by TradingView's own symbol-details panel: name/
 *  exchange, current price and change, a trailing-return grid, and a small seasonality path.
 *  Degrades gracefully with no `profile` at all (a bare price/change readout, exactly what the
 *  chart's own header already shows, still has real value on its own) rather than rendering
 *  nothing or a wall of placeholders. */
export function SymbolProfilePanel({ symbol, price, change, changePercent, profile, onMoreNews }: SymbolProfilePanelProps) {
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
