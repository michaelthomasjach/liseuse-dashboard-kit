import type { IndicatorInfoTarget } from "../interfaces/IndicatorInfoTarget.interface";
import { scriptIdFromIndicatorId, infoTargetFor } from "../scripting/scriptOutputToCustomIndicatorDef";
import type { Dispatch, SetStateAction } from "react";
import type * as React from "react";
import { ChevronDownIcon, ChevronUpIcon, SettingsIcon, TrashIcon, GripIcon, InfoIcon, MaximizeIcon, MinimizeIcon, CodeIcon } from "../../../icons";
import type { Candle } from "../interfaces/Candle.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorValue } from "../interfaces/IndicatorValue.interface";
import { isFundamentalKind, formatFundamentalValue } from "../indicatorCatalog";

export interface PaneHeadersProps {
  volumeVisible: boolean;
  dims: { margin: { top: number; left: number }; boundedWidth: number };
  priceHeight: number;
  volumeTop: number;
  volumeCollapsed: boolean;
  draggingPaneId: string | null;
  setDraggingPaneId: Dispatch<SetStateAction<string | null>>;
  startPaneResize: (paneKey: string, e: React.PointerEvent) => void;
  SUB_PANE_COLLAPSED_HEIGHT: number;
  hoverVolumeY: number | null;
  setVolumePaneState: Dispatch<SetStateAction<"expanded" | "collapsed" | "hidden">>;
  setVolumeSettingsOpen: (open: boolean) => void;
  data: Candle[];
  hoverIndex: number | null;
  vFmt: (value: number) => string;
  ownPaneIndicators: Indicator[];
  indicatorPaneTops: number[];
  commitIndicators: (indicators: Indicator[]) => void;
  indicators: Indicator[];
  indicatorLabel: (indicator: Indicator) => string;
  openIndicatorSettings: (id: string) => void;
  removeIndicator: (id: string) => void;
  indicatorValues: { indicator: Indicator; values: (IndicatorValue | null)[] }[];
  /** Same "how it works" info modal the indicator picker's own info icon opens (see
   *  IndicatorModals) — "volume" for the volume pane's own header, an indicator's own `kind`
   *  for every other pane here. */
  onOpenIndicatorInfo: (target: IndicatorInfoTarget) => void;
  /** Which pane (an indicator's own id, or "volume") currently owns the entire plot — see
   *  usePaneLayout's own togglePaneFullscreen doc. null the rest of the time, in which case
   *  every pane here still renders normally, just with an extra button to claim it. */
  fullscreenPaneId: string | null;
  onTogglePaneFullscreen: (paneId: string) => void;
  /** Opens the script editor to whichever script produced a given indicator (see the "</>" button
   *  below) — `undefined` on a standalone chart (no editor to open), see
   *  `CandlestickChartProps.onEditScript`'s own doc. */
  onEditScript?: (scriptId: string) => void;
}

/** Header strip for the volume pane, then one more per "own"-pane indicator (RSI/CHOP/MACD) —
 *  each a fixed-height row pinned to the top of its pane (whether expanded or collapsed, hence
 *  sharing SUB_PANE_COLLAPSED_HEIGHT: when collapsed the pane *is* this row, when expanded it's
 *  just the top slice of it), with drag-to-reorder, collapse/expand, a live value readout, and
 *  settings/remove actions. Purely presentational; every interaction is a callback prop. */
export function PaneHeaders({
  volumeVisible,
  dims,
  priceHeight,
  volumeTop,
  volumeCollapsed,
  draggingPaneId,
  setDraggingPaneId,
  startPaneResize,
  SUB_PANE_COLLAPSED_HEIGHT,
  hoverVolumeY,
  setVolumePaneState,
  setVolumeSettingsOpen,
  data,
  hoverIndex,
  vFmt,
  ownPaneIndicators,
  indicatorPaneTops,
  commitIndicators,
  indicators,
  indicatorLabel,
  openIndicatorSettings,
  removeIndicator,
  indicatorValues,
  onOpenIndicatorInfo,
  fullscreenPaneId,
  onTogglePaneFullscreen,
  onEditScript,
}: PaneHeadersProps) {
  return (
    <>
      {/* Name always visible; the remove/collapse actions only reveal on hover of the pane itself
          (hoverVolumeY, already tracked by handlePointerMove — reused here instead of a CSS
          :hover, since the hoverable zone is the whole pane, much bigger than this row).
          pointer-events: none on the row itself so it never blocks the zoom/pan overlay or
          drawing-tool clicks underneath — same pattern as .lq-chart__indicator-legend. Also
          hidden outright whenever some *other* pane is fullscreened — unlike an indicator's own
          header (filtered out upstream by ownPaneIndicators itself, see usePaneLayout), volume's
          header renders straight off `volumeVisible` alone, which fullscreening something else
          doesn't change, so it needs this same check spelled out here explicitly. */}
      {volumeVisible && (fullscreenPaneId === null || fullscreenPaneId === "volume") && (
        <div
          className={[
            "lq-chart__pane-header",
            volumeCollapsed && "lq-chart__pane-header--collapsed",
            draggingPaneId === "volume" && "lq-chart__pane-header--dragging",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ top: dims.margin.top + priceHeight + volumeTop, left: dims.margin.left, width: dims.boundedWidth, height: SUB_PANE_COLLAPSED_HEIGHT }}
        >
          {/* Drag-to-resize: a thin strip straddling the divider above this pane, only while
              expanded (collapsed panes are a fixed height, nothing to resize) and not
              fullscreened (a fullscreened pane's height is forced to the entire plot regardless
              of paneHeightFractions, so dragging this would silently do nothing). */}
          {!volumeCollapsed && fullscreenPaneId !== "volume" && (
            <div
              className="lq-chart__pane-resize-handle"
              onPointerDown={(e) => startPaneResize("volume", e)}
              aria-hidden="true"
            >
              <span className="lq-chart__pane-resize-grip" aria-hidden="true" />
            </div>
          )}
          <div className="lq-chart__pane-header-primary">
            {/* Same drag-to-reorder grip as every indicator pane's own header — volume is just
                another entry in the same unified order now (see `allPanesOrder`/
                `volumePaneOrder`), not a pane fixed permanently under price. */}
            <button
              type="button"
              className="lq-chart__pane-drag-handle"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setDraggingPaneId("volume");
              }}
              aria-label="Réordonner Volume"
              title="Glisser pour réordonner les panneaux"
            >
              <GripIcon size={12} />
            </button>
            {/* The collapse/expand chevron sits right after the grip, before the name — a
                "twisty" convention, and no longer pushed to the pane's far right edge via
                space-between: that placement read as detached from the row it actually
                controlled. Always visible collapsed (it's the only way back to expanded);
                hover-revealed alongside the other actions otherwise, same as before. */}
            <div
              className={["lq-chart__pane-header-actions", (volumeCollapsed || hoverVolumeY !== null) && "lq-chart__pane-header-actions--visible"]
                .filter(Boolean)
                .join(" ")}
            >
              {volumeCollapsed ? (
                <button
                  type="button"
                  className="lq-chart__pane-header-action"
                  onClick={() => setVolumePaneState("expanded")}
                  aria-label="Agrandir le panneau Volume"
                >
                  <ChevronUpIcon size={12} />
                </button>
              ) : (
                <button
                  type="button"
                  className="lq-chart__pane-header-action"
                  onClick={() => setVolumePaneState("collapsed")}
                  aria-label="Réduire le panneau Volume"
                >
                  <ChevronDownIcon size={12} />
                </button>
              )}
            </div>
            {/* The header itself is pointer-events: none (see .lq-chart__pane-header-label's
                own CSS) so double-clicking has to target the label specifically, not the
                header div as a whole. Collapsed: expands. Expanded: opens the volume settings
                modal, matching every other pane's double-click-on-name convention. */}
            <span
              className="lq-chart__pane-header-label"
              onDoubleClick={() => (volumeCollapsed ? setVolumePaneState("expanded") : setVolumeSettingsOpen(true))}
            >
              Volume
            </span>
            {/* The volume equivalent of the price pane's own OHLC readout — the hovered
                candle's volume, falling back to the most recent one, same convention. Colored
                by that candle's own up/down direction, matching the bars themselves. */}
            {!volumeCollapsed &&
              data.length > 0 &&
              (() => {
                const candle = data[hoverIndex !== null ? hoverIndex : data.length - 1];
                const up = candle.close >= candle.open;
                return (
                  <span className={["lq-chart__symbol-info-ohlc", up ? "lq-chart__symbol-info-ohlc--up" : "lq-chart__symbol-info-ohlc--down"].join(" ")}>
                    {vFmt(candle.volume ?? 0)}
                  </span>
                );
              })()}
            {!volumeCollapsed && (
              <div
                className={[
                  "lq-chart__pane-header-actions",
                  (hoverVolumeY !== null || fullscreenPaneId === "volume") && "lq-chart__pane-header-actions--visible",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <button
                  type="button"
                  className="lq-chart__pane-header-action"
                  onClick={() => onOpenIndicatorInfo("volume")}
                  aria-label="À propos de Volume"
                >
                  <InfoIcon size={11} />
                </button>
                <button
                  type="button"
                  className="lq-chart__pane-header-action"
                  onClick={() => setVolumeSettingsOpen(true)}
                  aria-label="Paramètres du panneau Volume"
                >
                  <SettingsIcon size={11} />
                </button>
                <button
                  type="button"
                  className="lq-chart__pane-header-action"
                  onClick={() => setVolumePaneState("hidden")}
                  aria-label="Supprimer le panneau Volume"
                >
                  <TrashIcon size={12} />
                </button>
                <button
                  type="button"
                  className="lq-chart__pane-header-action"
                  onClick={() => onTogglePaneFullscreen("volume")}
                  aria-label={fullscreenPaneId === "volume" ? "Quitter le plein écran du panneau Volume" : "Plein écran du panneau Volume"}
                >
                  {fullscreenPaneId === "volume" ? <MinimizeIcon size={11} /> : <MaximizeIcon size={11} />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* One header per "own"-pane indicator (RSI/CHOP/MACD), same strip as volume's above —
          actions stay at a constant reduced opacity instead of hover-revealed (there's no
          existing hover-tracking state covering these panes' own screen area the way
          hoverVolumeY already did for volume, and building one just for this would be a lot of
          plumbing for a cosmetic difference). Gear opens the same settings modal price-overlay
          indicators use (period, or MACD's fast/slow/signal) — double-clicking the label does
          the same, matching that same legend's convention. */}
      {ownPaneIndicators.map((ind, idx) => (
        <div
          key={ind.id}
          className={[
            "lq-chart__pane-header",
            "lq-chart__pane-header--always-visible",
            ind.paneCollapsed && "lq-chart__pane-header--collapsed",
            draggingPaneId === ind.id && "lq-chart__pane-header--dragging",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            top: dims.margin.top + priceHeight + indicatorPaneTops[idx],
            left: dims.margin.left,
            width: dims.boundedWidth,
            height: SUB_PANE_COLLAPSED_HEIGHT,
          }}
        >
          {!ind.paneCollapsed && (
            <div
              className="lq-chart__pane-resize-handle"
              onPointerDown={(e) => startPaneResize(ind.id, e)}
              aria-hidden="true"
            >
              <span className="lq-chart__pane-resize-grip" aria-hidden="true" />
            </div>
          )}
          <div className="lq-chart__pane-header-primary">
            <button
              type="button"
              className="lq-chart__pane-drag-handle"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setDraggingPaneId(ind.id);
              }}
              aria-label={`Réordonner ${indicatorLabel(ind)}`}
              title="Glisser pour réordonner les panneaux"
            >
              <GripIcon size={12} />
            </button>
            {/* Collapse/expand chevron, right after the grip handle — a "twisty" convention,
                no longer pushed to the pane's far right edge via space-between. */}
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
            {/* The header itself is pointer-events: none (see .lq-chart__pane-header-label's
                own CSS) so double-clicking has to target the label specifically. Collapsed:
                expands the pane instead of opening its settings — there's no gear button
                visible to double-click toward while collapsed anyway (see below), so this is
                the only way to reach it short of the chevron. Expanded: same settings shortcut
                as before, matching the indicator legend's own double-click convention. */}
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
            {/* The RSI/CHOP/MACD equivalent of the price pane's own OHLC readout — this
                indicator's own value(s) at the hovered candle, falling back to the most
                recent one, same convention. MACD shows all three of its own series since none
                of them alone represents "the" value the way a single RSI/CHOP number does. */}
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
                      : "macd" in value
                        ? `MACD ${value.macd.toFixed(2)} · Signal ${value.signal !== null ? value.signal.toFixed(2) : "–"} · Hist ${
                            value.histogram !== null ? value.histogram.toFixed(2) : "–"
                          }`
                        : "adx" in value
                          ? `ADX ${value.adx.toFixed(2)} · +DI ${value.plusDI.toFixed(2)} · -DI ${value.minusDI.toFixed(2)}`
                          : "multi" in value
                            ? // A `plot.pane` with 2+ of its own series — one compact "label value"
                              // per series, in the same declared order as `multiSeries`, same spirit
                              // as MACD's own fixed "MACD x.xx · Signal x.xx" readout just above but
                              // generalized to the script's own series names instead of fixed ones.
                              (ind.customData?.multiSeries ?? [])
                                .map((entry) => {
                                  const sub = value.multi[entry.key];
                                  if (sub === null) return null;
                                  const text = typeof sub === "number" ? sub.toFixed(2) : `${sub.upper.toFixed(2)}/${sub.lower.toFixed(2)}`;
                                  return `${entry.label} ${text}`;
                                })
                                .filter((s): s is string => s !== null)
                                .join(" · ")
                            : null}
                  </span>
                );
              })()}
            {!ind.paneCollapsed && (
              <div className="lq-chart__pane-header-actions lq-chart__pane-header-actions--visible">
                <button
                  type="button"
                  className="lq-chart__pane-header-action"
                  onClick={() => onOpenIndicatorInfo(infoTargetFor(ind))}
                  aria-label={`À propos de ${indicatorLabel(ind)}`}
                >
                  <InfoIcon size={11} />
                </button>
                {/* Script-produced indicator only (see scriptIdFromIndicator's own doc) — a
                    shortcut straight to the script that produced it, just left of its own
                    settings gear so the two "go somewhere else to configure this" actions sit
                    next to each other. */}
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
                <button
                  type="button"
                  className="lq-chart__pane-header-action"
                  onClick={() => openIndicatorSettings(ind.id)}
                  aria-label={`Paramètres ${indicatorLabel(ind)}`}
                >
                  <SettingsIcon size={11} />
                </button>
                <button
                  type="button"
                  className="lq-chart__pane-header-action"
                  onClick={() => removeIndicator(ind.id)}
                  aria-label={`Supprimer ${indicatorLabel(ind)}`}
                >
                  <TrashIcon size={12} />
                </button>
                <button
                  type="button"
                  className="lq-chart__pane-header-action"
                  onClick={() => onTogglePaneFullscreen(ind.id)}
                  aria-label={
                    fullscreenPaneId === ind.id ? `Quitter le plein écran de ${indicatorLabel(ind)}` : `Plein écran de ${indicatorLabel(ind)}`
                  }
                >
                  {fullscreenPaneId === ind.id ? <MinimizeIcon size={11} /> : <MaximizeIcon size={11} />}
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
