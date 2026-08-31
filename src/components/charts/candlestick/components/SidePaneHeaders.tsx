import type * as React from "react";
import { ChevronDownIcon, ChevronUpIcon, SettingsIcon, TrashIcon, InfoIcon, CodeIcon } from "../../../icons";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorKind } from "../interfaces/IndicatorKind.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import { isFundamentalKind, formatFundamentalValue } from "../indicatorCatalog";

export interface SidePaneHeadersProps {
  paneIndicators: Indicator[];
  paneTops: number[];
  startPaneResize: (paneKey: string, e: React.PointerEvent) => void;
  SUB_PANE_COLLAPSED_HEIGHT: number;
  data: Candle[];
  hoverIndex: number | null;
  commitIndicators: (indicators: Indicator[]) => void;
  indicators: Indicator[];
  indicatorLabel: (indicator: Indicator) => string;
  openIndicatorSettings: (id: string) => void;
  removeIndicator: (id: string) => void;
  indicatorValues: { indicator: Indicator; values: (IndicatorValue | null)[] }[];
  onOpenIndicatorInfo: (kind: IndicatorKind | "volume") => void;
  onEditScript?: (scriptId: string) => void;
}

// Same parsing as PaneHeaders.tsx's own scriptIdFromIndicator — a script-produced indicator's own
// id/customData.id is always the deterministic `script:<scriptId>:<slug>`.
function scriptIdFromIndicator(indicator: Indicator): string | null {
  const id = indicator.customData?.id;
  if (!id?.startsWith("script:")) return null;
  return id.split(":")[1] ?? null;
}

/** Header strip per pane docked to one `plot.pane(name, { dock: "left"|"right" })` column — the
 *  column's own counterpart of `PaneHeaders`' own-indicator block, positioned relative to the
 *  column's own box (`left: 0`, no `dims.margin` offset needed — this is a genuinely separate DOM
 *  element, not overlaid on the main plot, see `ChartSidePaneColumn`'s own doc) instead of the
 *  shared chart canvas. Deliberately narrower than `PaneHeaders`: no drag-to-reorder grip and no
 *  fullscreen button (a docked column doesn't support either in this first version) — collapse/
 *  expand, a live value readout, settings/remove, and the column's own per-pane Y-resize handle
 *  (same `startPaneResize` the bottom stack already uses — it's keyed by pane id, so it works
 *  unmodified for a pane in this stack too). */
export function SidePaneHeaders({
  paneIndicators,
  paneTops,
  startPaneResize,
  SUB_PANE_COLLAPSED_HEIGHT,
  data,
  hoverIndex,
  commitIndicators,
  indicators,
  indicatorLabel,
  openIndicatorSettings,
  removeIndicator,
  indicatorValues,
  onOpenIndicatorInfo,
  onEditScript,
}: SidePaneHeadersProps) {
  return (
    <>
      {paneIndicators.map((ind, idx) => (
        <div
          key={ind.id}
          className={["lq-chart__pane-header", "lq-chart__pane-header--always-visible", ind.paneCollapsed && "lq-chart__pane-header--collapsed"]
            .filter(Boolean)
            .join(" ")}
          style={{ top: paneTops[idx], left: 0, width: "100%", height: SUB_PANE_COLLAPSED_HEIGHT }}
        >
          {!ind.paneCollapsed && (
            <div className="lq-chart__pane-resize-handle" onPointerDown={(e) => startPaneResize(ind.id, e)} aria-hidden="true">
              <span className="lq-chart__pane-resize-grip" aria-hidden="true" />
            </div>
          )}
          <div className="lq-chart__pane-header-primary">
            {ind.paneCollapsed ? (
              <button
                type="button"
                className="lq-chart__pane-header-action"
                onClick={() => commitIndicators(indicators.map((i) => (i.id === ind.id ? { ...i, paneCollapsed: false } : i)))}
                aria-label={`Agrandir le panneau ${indicatorLabel(ind)}`}
              >
                <ChevronUpIcon size={12} />
              </button>
            ) : (
              <button
                type="button"
                className="lq-chart__pane-header-action"
                onClick={() => commitIndicators(indicators.map((i) => (i.id === ind.id ? { ...i, paneCollapsed: true } : i)))}
                aria-label={`Réduire le panneau ${indicatorLabel(ind)}`}
              >
                <ChevronDownIcon size={12} />
              </button>
            )}
            <span
              className="lq-chart__pane-header-label"
              onDoubleClick={() =>
                ind.paneCollapsed
                  ? commitIndicators(indicators.map((i) => (i.id === ind.id ? { ...i, paneCollapsed: false } : i)))
                  : openIndicatorSettings(ind.id)
              }
            >
              {indicatorLabel(ind)}
            </span>
            {!ind.paneCollapsed &&
              data.length > 0 &&
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
            {!ind.paneCollapsed && (
              <div className="lq-chart__pane-header-actions lq-chart__pane-header-actions--visible">
                <button type="button" className="lq-chart__pane-header-action" onClick={() => onOpenIndicatorInfo(ind.kind)} aria-label={`À propos de ${indicatorLabel(ind)}`}>
                  <InfoIcon size={11} />
                </button>
                {onEditScript &&
                  (() => {
                    const scriptId = scriptIdFromIndicator(ind);
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
            )}
          </div>
        </div>
      ))}
    </>
  );
}
