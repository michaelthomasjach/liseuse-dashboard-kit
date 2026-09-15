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
  PlayIcon,
  PauseIcon,
  PrevTrackIcon,
  CloseIcon,
} from "../../../icons";
import type { ChartDisplayMode } from "../interfaces/ChartDisplayMode.interface";
import type { TimeframeEntry } from "../interfaces/TimeframeEntry.interface";
import type { ChartTemplate } from "../interfaces/ChartTemplate.interface";
import { CHART_DISPLAY_MODES, type ChartDisplayModeDef } from "../chartModes";
import { isTimeframeGroup } from "../timeframes";
import type { BarRangeOption, BarRangeValue } from "../hooks/useBarRangeSelection";
import { TemplateControls } from "./TemplateControls";

export interface ChartHeaderProps {
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
  replay: boolean;
  replayArmed: boolean;
  replayActive: boolean;
  replayPlaying: boolean;
  replaySpeed: number;
  replaySpeedOpen: boolean;
  setReplaySpeedOpen: Dispatch<SetStateAction<boolean>>;
  replaySpeedAnchorRef: RefObject<HTMLButtonElement>;
  onReplayTriggerClick: () => void;
  onReplayTogglePlay: () => void;
  onReplaySpeedChange: (speed: number) => void;
  onReplayQuit: () => void;
  /** The replay cutoff as an `<input type="date">` value, and the bounds of the data behind it —
   *  see `toDayInputValue`. Empty while no cutoff is set. */
  replayDateValue: string;
  replayDateMin: string;
  replayDateMax: string;
  /** Fires with the raw `yyyy-mm-dd` the picker produced; resolving it to a candle is the caller's
   *  job (see `candleIndexForDay`), which is also the only place `data` itself is in scope. */
  onReplayDateChange: (value: string) => void;
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
}

/** The chart's main (non-seasonality) header: timeframe picker, display-mode picker, "add
 *  indicator" button, the seasonality-mode entry point, and the fullscreen toggle — everything
 *  gated by `showHeader && !seasonalityOpen` in CandlestickChart itself. Purely presentational;
 *  every interaction is a callback prop. ("Réinitialiser le zoom" and "Écran divisé" both used to
 *  live here too — moved to ToolsRail's own rail and ChartWorkspace's own side-rail respectively,
 *  see each of those for why.) */
export function ChartHeader({
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
  replay,
  replayArmed,
  replayActive,
  replayPlaying,
  replaySpeed,
  replaySpeedOpen,
  setReplaySpeedOpen,
  replaySpeedAnchorRef,
  onReplayTriggerClick,
  onReplayTogglePlay,
  onReplaySpeedChange,
  onReplayQuit,
  replayDateValue,
  replayDateMin,
  replayDateMax,
  onReplayDateChange,
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
}: ChartHeaderProps) {
  return (
    <div className="lq-chart__header">
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
      {/* "Replay" — arms bar-replay mode (see useReplayState.ts's own doc): moving the pointer
          over the chart dims everything to its right, a click freezes that as the cutoff and
          replaces this trigger with Lecture/Pause/Vitesse/Quitter le replay below. Clicking again
          while still choosing (replayArmed) cancels back to idle instead of committing — same
          "click the active one again to back out" convention as everywhere else in this header. */}
      {replay &&
        (replayActive ? (
          <>
            <button
              type="button"
              className="lq-chart__icon-button"
              onClick={onReplayTogglePlay}
              aria-label={replayPlaying ? "Pause" : "Lecture"}
              title={replayPlaying ? "Pause" : "Lecture"}
            >
              {replayPlaying ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
            </button>
            <button
              ref={replaySpeedAnchorRef}
              type="button"
              className="lq-chart__timeframe-trigger"
              onClick={() => setReplaySpeedOpen((o) => !o)}
              aria-label="Vitesse de lecture"
            >
              <span className="lq-chart__timeframe-trigger-label">{replaySpeed}×</span>
              <ChevronDownIcon size={12} />
            </button>
            <Popover open={replaySpeedOpen} onClose={() => setReplaySpeedOpen(false)} anchorRef={replaySpeedAnchorRef} placement="bottom">
              <div className="lq-chart__timeframe-menu">
                {[1, 2, 5, 10, 15, 20, 30, 40, 50, 75, 100].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={["lq-chart__timeframe-option", s === replaySpeed && "lq-chart__timeframe-option--selected"]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      onReplaySpeedChange(s);
                      setReplaySpeedOpen(false);
                    }}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </Popover>
            {/* Jump straight to a day instead of clicking for it on the chart or waiting for
                playback to reach it. Native `<input type="date">` rather than a hand-rolled
                calendar: it brings the platform's own picker — which on a phone is the OS wheel,
                by far the best date entry available there — plus keyboard entry and locale-correct
                formatting, none of which would be worth rebuilding here. `min`/`max` bound it to
                the data actually loaded, so the picker can't offer a day the chart has no candle
                for. A day inside those bounds but without its own candle (a weekend, a holiday)
                resolves backwards to the last session before it — see `candleIndexForDay`. */}
            <input
              type="date"
              className="lq-chart__replay-date"
              value={replayDateValue}
              min={replayDateMin}
              max={replayDateMax}
              onChange={(e) => onReplayDateChange(e.target.value)}
              aria-label="Date du replay"
              title="Aller à une date précise"
            />
            <button type="button" className="lq-chart__icon-button" onClick={onReplayQuit} aria-label="Quitter le replay" title="Quitter le replay">
              <CloseIcon size={14} />
            </button>
          </>
        ) : (
          <button
            type="button"
            className={["lq-chart__timeframe-trigger", replayArmed && "lq-chart__replay-trigger--armed"].filter(Boolean).join(" ")}
            onClick={onReplayTriggerClick}
            aria-label="Replay"
            title={replayArmed ? "Cliquez sur la chart pour choisir le point de départ" : "Rejouer l'historique bougie par bougie"}
          >
            <PrevTrackIcon size={14} />
            <span className="lq-chart__timeframe-trigger-label">Replay</span>
          </button>
        ))}
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
