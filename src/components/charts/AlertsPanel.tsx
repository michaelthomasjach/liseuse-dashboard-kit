import { TrashIcon } from "../icons";
import type { ChartAlert } from "./CandlestickChart";
import "./charts-shared.css";

export interface AlertsPanelProps {
  alerts: ChartAlert[];
  onDeleteAlert?: (id: string) => void;
  emptyMessage?: string;
  className?: string;
}

/** Read-only(-ish) list of every alert set on the chart's own drawings/indicators — meant for
 *  `ChartWorkspace`'s own "Alertes" side-panel tab (`alerts` prop), showing the same caller-owned
 *  list `CandlestickChart` itself was handed (see its own `alerts` prop doc). Deleting is
 *  self-contained (no modal needed); *editing* an alert stays scoped to the drawing/indicator's
 *  own toolbar it was created from (see `AlertListModal`) — this panel is purely for visibility
 *  across the whole chart, not a second place to edit from. */
export function AlertsPanel({ alerts, onDeleteAlert, emptyMessage = "Aucune alerte configurée pour le moment.", className }: AlertsPanelProps) {
  if (alerts.length === 0) {
    return <p className={["lq-alerts-panel__empty", className].filter(Boolean).join(" ")}>{emptyMessage}</p>;
  }

  return (
    <div className={["lq-alert-list", className].filter(Boolean).join(" ")}>
      {alerts.map((alert) => (
        <div key={alert.id} className="lq-alert-list__row">
          <span className="lq-alert-list__message">{alert.message}</span>
          {onDeleteAlert && (
            <div className="lq-alert-list__actions">
              <button type="button" className="lq-chart__icon-button" onClick={() => onDeleteAlert(alert.id)} aria-label="Supprimer l'alerte" title="Supprimer l'alerte">
                <TrashIcon size={14} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
