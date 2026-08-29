import type { RefObject, Dispatch, SetStateAction } from "react";
import { Popover } from "../../../forms/Popover";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ActivityIcon,
  CalendarIcon,
  MaximizeIcon,
  MinimizeIcon,
  LinkIcon,
  CodeIcon,
} from "../../../icons";
import type { ChartDisplayMode } from "../interfaces/ChartDisplayMode.interface";
import type { TimeframeEntry } from "../interfaces/TimeframeEntry.interface";
import type { ChartTemplate } from "../interfaces/ChartTemplate.interface";
import { CHART_DISPLAY_MODES, type ChartDisplayModeDef } from "../chartModes";
import { isTimeframeGroup } from "../timeframes";
import type { BarRangeOption, BarRangeValue } from "../hooks/useBarRangeSelection";
import { TemplateControls } from "./TemplateControls";

export interface ChartHeaderProps {
  dims: { width: number | undefined };
  timeframes: TimeframeEntry[] | undefined;
  timeframe: string | undefined;
  onTimeframeChange: ((value: string) => void) | undefined;
  tfOpen: boolean;
  setTfOpen: Dispatch<SetStateAction<boolean>>;
  tfAnchorRef: RefObject<HTMLButtonElement>;
  currentTimeframeLabel: string | null;
  barRangeOptions: BarRangeOption[];
  selectedRange: BarRangeValue | null;
  rangeOpen: boolean;
  setRangeOpen: Dispatch<SetStateAction<boolean>>;
  rangeAnchorRef: RefObject<HTMLButtonElement>;
  applyRange: (range: BarRangeValue) => void;
  displayModeAnchorRef: RefObject<HTMLButtonElement>;
  displayModeOpen: boolean;
  setDisplayModeOpen: Dispatch<SetStateAction<boolean>>;
  currentModeEntry: ChartDisplayModeDef;
  chartDisplayMode: ChartDisplayMode;
  setChartDisplayMode: (mode: ChartDisplayMode) => void;
  onChartDisplayModeChange: ((mode: ChartDisplayMode) => void) | undefined;
  showIndicators: boolean;
  setIndicatorSearchQuery: (query: string) => void;
  setIndicatorPickerOpen: (open: boolean) => void;
  seasonality: boolean;
  setSeasonalityOpen: (open: boolean) => void;
  fullscreenToggle: boolean;
  toggleFullscreen: () => void;
  isFullscreen: boolean;
  sidePanel: boolean;
  sidePanelOpen: boolean;
  onToggleSidePanel: () => void;
  showTemplates: boolean;
  templates: ChartTemplate[];
  activeTemplateId: string | null;
  templatesDirty: boolean;
  onSaveTemplate: (name?: string) => void;
  onSaveTemplateAs: (name: string) => void;
  onLoadTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
  linkable: boolean;
  isLinked: boolean;
  onLinkClick: (() => void) | undefined;
  /** Shows the script editor's own header button ("</>") — same "gate controls the affordance"
   *  convention as `showIndicators`/`seasonality` above. See `ScriptingLayer.tsx`'s own doc for
   *  why a running script still works with this off; it only ever hides the way to *open* the
   *  editor. */
  scripting: boolean;
  onOpenScriptEditor: () => void;
}

/** The chart's main (non-seasonality) header: timeframe picker, display-mode picker, "add
 *  indicator" button, the seasonality-mode entry point, and the fullscreen toggle — everything
 *  gated by `showHeader && !seasonalityOpen` in CandlestickChart itself. Purely presentational;
 *  every interaction is a callback prop. ("Réinitialiser le zoom" and "Écran divisé" both used to
 *  live here too — moved to ToolsRail's own rail and ChartWorkspace's own side-rail respectively,
 *  see each of those for why.) */
export function ChartHeader({
  dims,
  timeframes,
  timeframe,
  onTimeframeChange,
  tfOpen,
  setTfOpen,
  tfAnchorRef,
  currentTimeframeLabel,
  barRangeOptions,
  selectedRange,
  rangeOpen,
  setRangeOpen,
  rangeAnchorRef,
  applyRange,
  displayModeAnchorRef,
  displayModeOpen,
  setDisplayModeOpen,
  currentModeEntry,
  chartDisplayMode,
  setChartDisplayMode,
  onChartDisplayModeChange,
  showIndicators,
  setIndicatorSearchQuery,
  setIndicatorPickerOpen,
  seasonality,
  setSeasonalityOpen,
  fullscreenToggle,
  toggleFullscreen,
  isFullscreen,
  sidePanel,
  sidePanelOpen,
  onToggleSidePanel,
  showTemplates,
  templates,
  activeTemplateId,
  templatesDirty,
  onSaveTemplate,
  onSaveTemplateAs,
  onLoadTemplate,
  onDeleteTemplate,
  linkable,
  isLinked,
  onLinkClick,
  scripting,
  onOpenScriptEditor,
}: ChartHeaderProps) {
  return (
    <div className="lq-chart__header" style={{ width: dims.width }}>
      {timeframes && timeframes.length > 0 && (
        <>
          <button ref={tfAnchorRef} type="button" className="lq-chart__timeframe-trigger" onClick={() => setTfOpen((o) => !o)}>
            <span className="lq-chart__timeframe-trigger-label">{currentTimeframeLabel ?? "Intervalle"}</span>
            <ChevronDownIcon size={12} />
          </button>
          <Popover open={tfOpen} onClose={() => setTfOpen(() => false)} anchorRef={tfAnchorRef} placement="bottom">
            <div className="lq-chart__timeframe-menu">
              {timeframes.map((entry) =>
                isTimeframeGroup(entry) ? (
                  <div key={entry.group} className="lq-chart__timeframe-group">
                    <div className="lq-chart__timeframe-group-label">{entry.group}</div>
                    {entry.options.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={["lq-chart__timeframe-option", opt.value === timeframe && "lq-chart__timeframe-option--selected"]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => {
                          onTimeframeChange?.(opt.value);
                          setTfOpen(() => false);
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    key={entry.value}
                    type="button"
                    className={["lq-chart__timeframe-option", entry.value === timeframe && "lq-chart__timeframe-option--selected"]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      onTimeframeChange?.(entry.value);
                      setTfOpen(() => false);
                    }}
                  >
                    {entry.label}
                  </button>
                )
              )}
            </div>
          </Popover>
          <button ref={rangeAnchorRef} type="button" className="lq-chart__timeframe-trigger" onClick={() => setRangeOpen((o) => !o)}>
            <span className="lq-chart__timeframe-trigger-label">{selectedRange ?? "Plage"}</span>
            <ChevronDownIcon size={12} />
          </button>
          <Popover open={rangeOpen} onClose={() => setRangeOpen(() => false)} anchorRef={rangeAnchorRef} placement="bottom">
            <div className="lq-chart__timeframe-menu">
              {barRangeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={["lq-chart__timeframe-option", opt.value === selectedRange && "lq-chart__timeframe-option--selected"]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => applyRange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Popover>
        </>
      )}
      {/* No dedicated prop gates this (unlike `showIndicators`/`drawingTools`) — it rides on
          `showHeader` same as zoomable/fullscreenToggle, so it's on by default and only
          disappears in the edge case where a caller has already opted out of every other
          header feature too. */}
      <button
        ref={displayModeAnchorRef}
        type="button"
        className="lq-chart__icon-button"
        onClick={() => setDisplayModeOpen((o) => !o)}
        aria-label="Mode d'affichage"
        title="Mode d'affichage"
      >
        <currentModeEntry.icon size={14} />
      </button>
      <Popover open={displayModeOpen} onClose={() => setDisplayModeOpen(() => false)} anchorRef={displayModeAnchorRef} placement="bottom">
        <div className="lq-chart__display-mode-menu">
          {CHART_DISPLAY_MODES.map((entry) => (
            <button
              key={entry.mode}
              type="button"
              className={["lq-chart__display-mode-option", entry.mode === chartDisplayMode && "lq-chart__display-mode-option--selected"]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                setChartDisplayMode(entry.mode);
                onChartDisplayModeChange?.(entry.mode);
                setDisplayModeOpen(() => false);
              }}
            >
              <entry.icon size={15} />
              {entry.label}
            </button>
          ))}
        </div>
      </Popover>
      {showIndicators && (
        <button
          type="button"
          className="lq-chart__icon-button"
          onClick={() => {
            setIndicatorSearchQuery("");
            setIndicatorPickerOpen(true);
          }}
          aria-label="Ajouter un indicateur"
        >
          <ActivityIcon size={14} />
        </button>
      )}
      {scripting && (
        <button
          type="button"
          className="lq-chart__icon-button"
          onClick={onOpenScriptEditor}
          aria-label="Éditeur de script"
          title="Éditeur de script"
        >
          <CodeIcon size={14} />
        </button>
      )}
      {seasonality && (
        <button
          type="button"
          className="lq-chart__icon-button"
          onClick={() => setSeasonalityOpen(true)}
          aria-label="Saisonnalité"
          title="Saisonnalité : performance moyenne par période, agrégée sur l'historique"
        >
          <CalendarIcon size={14} />
        </button>
      )}
      {fullscreenToggle && (
        <button
          type="button"
          className="lq-chart__icon-button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Quitter le focus fenêtre active" : "Focus fenêtre active"}
        >
          {isFullscreen ? <MinimizeIcon size={14} /> : <MaximizeIcon size={14} />}
        </button>
      )}
      {/* Shown whenever the caller passed `sidePanel` content at all, regardless of its current
          open/collapsed state — same reasoning the volume pane's own collapse toggle stays
          reachable from its still-visible header strip once collapsed: a button that could hide
          itself along with the thing it opens would leave no way back. Chevron direction points
          toward how the panel would move if toggled (right = collapse toward/off the edge, left =
          it's already collapsed, clicking brings it back open). */}
      {sidePanel && (
        <button
          type="button"
          className="lq-chart__icon-button"
          onClick={onToggleSidePanel}
          aria-label={sidePanelOpen ? "Réduire le panneau latéral" : "Ouvrir le panneau latéral"}
        >
          {sidePanelOpen ? <ChevronRightIcon size={14} /> : <ChevronLeftIcon size={14} />}
        </button>
      )}
      {/* `margin-left: auto` lives on this one wrapper, not the individual pieces inside it — see
          .lq-chart__header-right's own CSS comment — so the link button and TemplateControls
          land flush together at the bar's far right edge instead of each fighting the other for
          the same leftover space. */}
      {(linkable || showTemplates) && (
        <div className="lq-chart__header-right">
          {linkable && (
            <button
              type="button"
              className={["lq-chart__icon-button", isLinked && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
              onClick={onLinkClick}
              aria-label={isLinked ? "Graphiques liés (gérer les groupes)" : "Lier ce graphique à d'autres"}
              aria-pressed={isLinked}
              title={isLinked ? "Graphiques liés (gérer les groupes)" : "Lier ce graphique à d'autres"}
            >
              <LinkIcon size={14} />
            </button>
          )}
          {showTemplates && (
            <TemplateControls
              templates={templates}
              activeTemplateId={activeTemplateId}
              isDirty={templatesDirty}
              onSave={onSaveTemplate}
              onSaveAs={onSaveTemplateAs}
              onLoad={onLoadTemplate}
              onDelete={onDeleteTemplate}
            />
          )}
        </div>
      )}
    </div>
  );
}
