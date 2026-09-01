import type { IndicatorInfoTarget } from "../interfaces/IndicatorInfoTarget.interface";
import { scriptIdFromIndicatorId, infoTargetFor } from "../scripting/scriptOutputToCustomIndicatorDef";
import type * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, SettingsIcon, TrashIcon, InfoIcon, CodeIcon } from "../../../icons";
import type { DockSide } from "../hooks/useDockedPaneColumns";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import { isFundamentalKind, formatFundamentalValue } from "../indicatorCatalog";

export interface SidePaneHeadersProps {
  /** Which side this column is docked to — decides which way the collapse chevron points (a pane
   *  folds toward its column's own outer edge, so a right-docked one folds right). */
  side: DockSide;
  /** Folds this pane sideways — its own UI state rather than `Indicator.paneCollapsed` written
   *  through `commitIndicators`, see usePaneLayout's own `sidePaneCollapsed` doc for why a docked
   *  pane (very often script-produced, so absent from the CRUD list) needs the separate channel. */
  toggleSidePaneCollapsed: (paneId: string, collapsed: boolean) => void;
  paneIndicators: Indicator[];
  paneTops: number[];
  startPaneResize: (paneKey: string, e: React.PointerEvent) => void;
  SUB_PANE_COLLAPSED_HEIGHT: number;
  data: Candle[];
  hoverIndex: number | null;
  indicatorLabel: (indicator: Indicator) => string;
  openIndicatorSettings: (id: string) => void;
  removeIndicator: (id: string) => void;
  indicatorValues: { indicator: Indicator; values: (IndicatorValue | null)[] }[];
  onOpenIndicatorInfo: (target: IndicatorInfoTarget) => void;
  onEditScript?: (scriptId: string) => void;
}

/** Header strip per pane docked to one `plot.pane(name, { dock: "left"|"right" })` column — the
 *  column's own counterpart of `PaneHeaders`' own-indicator block, positioned relative to the
 *  column's own box (`left: 0`, no `dims.margin` offset needed — this is a genuinely separate DOM
 *  element, not overlaid on the main plot, see `ChartSidePaneColumn`'s own doc) instead of the
 *  shared chart canvas. Deliberately narrower than `PaneHeaders`: no drag-to-reorder grip and no
 *  fullscreen button (a docked column doesn't support either in this first version) — collapse/
 *  expand, a live value readout, settings/remove, and the column's own per-pane Y-resize handle
 *  (same `startPaneResize` the bottom stack already uses — it's keyed by pane id, so it works
 *  unmodified for a pane in this stack too). Renders the *expanded* panes only: a collapsed docked
 *  pane leaves the vertical stack altogether and folds into its own vertical band beside it (see
 *  `SideDockCollapsedStrip`), so unlike `PaneHeaders` this never has a collapsed state to draw. */
export function SidePaneHeaders({
  side,
  toggleSidePaneCollapsed,
  paneIndicators,
  paneTops,
  startPaneResize,
  SUB_PANE_COLLAPSED_HEIGHT,
  data,
  hoverIndex,
  indicatorLabel,
  openIndicatorSettings,
  removeIndicator,
  indicatorValues,
  onOpenIndicatorInfo,
  onEditScript,
}: SidePaneHeadersProps) {
  // Folds toward the column's own outer edge — right for a right-docked column, left for a
  // left-docked one — rather than the bottom stack's own "up, into the price chart above it".
  const CollapseIcon = side === "right" ? ChevronRightIcon : ChevronLeftIcon;

  return (
    <>
      {paneIndicators.map((ind, idx) => {
        // Folded panes render as their own vertical band beside this stack, not as a row in it.
        if (ind.paneCollapsed) return null;
        return (
        <div
          key={ind.id}
          className="lq-chart__pane-header lq-chart__pane-header--always-visible"
          style={{ top: paneTops[idx], left: 0, width: "100%", height: SUB_PANE_COLLAPSED_HEIGHT }}
        >
          <div className="lq-chart__pane-resize-handle" onPointerDown={(e) => startPaneResize(ind.id, e)} aria-hidden="true">
            <span className="lq-chart__pane-resize-grip" aria-hidden="true" />
          </div>
          <div className="lq-chart__pane-header-primary">
            <button
              type="button"
              className="lq-chart__pane-header-action"
              onClick={() => toggleSidePaneCollapsed(ind.id, true)}
              aria-label={`Réduire le panneau ${indicatorLabel(ind)}`}
            >
              <CollapseIcon size={12} />
            </button>
            <span className="lq-chart__pane-header-label" onDoubleClick={() => openIndicatorSettings(ind.id)}>
              {indicatorLabel(ind)}
            </span>
            {data.length > 0 &&
              (() => {
                const entry = indicatorValues.find((v) => v.indicator.id === ind.id);
                const value = entry?.values[hoverIndex !== null ? hoverIndex : data.length - 1];
                if (value === null || value === undefined) return null;
                return (
                  <span className="lq-chart__symbol-info-ohlc">
                    {typeof value === "number"
                      ? isFundamentalKind(ind.kind)
                        ? formatFundamentalValue(ind.kind, value, ind.fundamentalDisplayMode)
                        : value.toFixed(2)
                      : "multi" in value
                        ? (ind.customData?.multiSeries ?? [])
                            .map((multiEntry) => {
                              const sub = value.multi[multiEntry.key];
                              if (sub === null) return null;
                              const text = typeof sub === "number" ? sub.toFixed(2) : `${sub.upper.toFixed(2)}/${sub.lower.toFixed(2)}`;
                              return `${multiEntry.label} ${text}`;
                            })
                            .filter((s): s is string => s !== null)
                            .join(" · ")
                        : null}
                  </span>
                );
              })()}
            <div className="lq-chart__pane-header-actions lq-chart__pane-header-actions--visible">
                <button type="button" className="lq-chart__pane-header-action" onClick={() => onOpenIndicatorInfo(infoTargetFor(ind))} aria-label={`À propos de ${indicatorLabel(ind)}`}>
                  <InfoIcon size={11} />
                </button>
                {onEditScript &&
                  (() => {
                    const scriptId = scriptIdFromIndicatorId(ind.customData?.id);
                    if (!scriptId) return null;
                    return (
                      <button
                        type="button"
                        className="lq-chart__pane-header-action"
                        onClick={() => onEditScript(scriptId)}
                        aria-label={`Modifier le script de ${indicatorLabel(ind)}`}
                        title="Modifier le script"
                      >
                        <CodeIcon size={11} />
                      </button>
                    );
                  })()}
                <button type="button" className="lq-chart__pane-header-action" onClick={() => openIndicatorSettings(ind.id)} aria-label={`Paramètres ${indicatorLabel(ind)}`}>
                  <SettingsIcon size={11} />
                </button>
              <button type="button" className="lq-chart__pane-header-action" onClick={() => removeIndicator(ind.id)} aria-label={`Supprimer ${indicatorLabel(ind)}`}>
                <TrashIcon size={12} />
              </button>
            </div>
          </div>
        </div>
        );
      })}
    </>
  );
}
