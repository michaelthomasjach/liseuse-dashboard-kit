import { PriceChangeTag } from "../../finance/PriceChangeTag";
import { Sparkline } from "../Sparkline";
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
}

/** The workspace side panel's own "company info" section (see `useSymbolProfileSplit`'s own doc
 *  for the resizable divider above it) — inspired by TradingView's own symbol-details panel: name/
 *  exchange, current price and change, a trailing-return grid, and a small seasonality path.
 *  Degrades gracefully with no `profile` at all (a bare price/change readout, exactly what the
 *  chart's own header already shows, still has real value on its own) rather than rendering
 *  nothing or a wall of placeholders. */
export function SymbolProfilePanel({ symbol, price, change, changePercent, profile }: SymbolProfilePanelProps) {
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
    </div>
  );
}
