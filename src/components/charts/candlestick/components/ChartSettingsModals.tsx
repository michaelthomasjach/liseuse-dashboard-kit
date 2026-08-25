import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Modal } from "../../../primitives/Modal";
import { Checkbox } from "../../../forms/Checkbox";
import { capitalize } from "../formatting";
import { CHART_DISPLAY_MODES } from "../chartModes";
import type { ChartDisplayMode } from "../interfaces/ChartDisplayMode.interface";

export interface ChartSettingsModalsProps {
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  chartDisplayMode: ChartDisplayMode;
  setChartDisplayMode: (mode: ChartDisplayMode) => void;
  onChartDisplayModeChange: ((mode: ChartDisplayMode) => void) | undefined;
  upColorOverride: string | undefined;
  setUpColorOverride: (color: string | undefined) => void;
  downColorOverride: string | undefined;
  setDownColorOverride: (color: string | undefined) => void;
  yAutoScalingState: boolean;
  setYAutoScalingState: (checked: boolean) => void;
  onYAutoScalingChange: ((value: boolean) => void) | undefined;
  futureZoneVisible: boolean;
  setFutureZoneVisible: (checked: boolean) => void;
  eventKinds: string[];
  hiddenEventKinds: Set<string>;
  setHiddenEventKinds: Dispatch<SetStateAction<Set<string>>>;
  volumeSettingsOpen: boolean;
  setVolumeSettingsOpen: (open: boolean) => void;
  volumeUpColorOverride: string | undefined;
  setVolumeUpColorOverride: (color: string | undefined) => void;
  volumeDownColorOverride: string | undefined;
  setVolumeDownColorOverride: (color: string | undefined) => void;
}

/** The two small "chart settings" modals — up/down candle colors + YAutoScaling toggle + per-kind
 *  event visibility (double-click the symbol/chart-type label to open), and its volume-pane
 *  sibling (independent up/down bar colors, falling back to the candle colors above until
 *  overridden). */
export function ChartSettingsModals({
  settingsOpen,
  setSettingsOpen,
  chartDisplayMode,
  setChartDisplayMode,
  onChartDisplayModeChange,
  upColorOverride,
  setUpColorOverride,
  downColorOverride,
  setDownColorOverride,
  yAutoScalingState,
  setYAutoScalingState,
  onYAutoScalingChange,
  futureZoneVisible,
  setFutureZoneVisible,
  eventKinds,
  hiddenEventKinds,
  setHiddenEventKinds,
  volumeSettingsOpen,
  setVolumeSettingsOpen,
  volumeUpColorOverride,
  setVolumeUpColorOverride,
  volumeDownColorOverride,
  setVolumeDownColorOverride,
}: ChartSettingsModalsProps) {
  // What "no override" actually renders as, read fresh off the live theme rather than hardcoded
  // — the swatch shown when a field is unset used to be a fixed "#26a69a"/"#ef5350" regardless of
  // the active theme/palette, which could (and, in E-ink, always did) disagree with the color the
  // chart itself was really drawing. `wrapperRef` sits on a `display: contents` node (renders no
  // box of its own, just lets its children lay out as if it weren't there) so it's always mounted
  // — unlike the two modals below, which only exist in the DOM while their own `open` is true —
  // and inherits the same CSS custom properties the canvas renderer itself reads via
  // getComputedStyle (see renderChart.ts's own identical technique).
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<{ up: string; down: string; isEink: boolean }>({ up: "#26a69a", down: "#ef5350", isEink: false });
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const computed = getComputedStyle(el);
    setTheme({
      up: computed.getPropertyValue("--lq-color-up").trim() || "#26a69a",
      down: computed.getPropertyValue("--lq-color-down").trim() || "#ef5350",
      isEink: el.closest('[data-lq-palette="eink"]') !== null,
    });
  }, [settingsOpen, volumeSettingsOpen]);

  return (
    <div ref={wrapperRef} style={{ display: "contents" }}>
      {settingsOpen && (
        <Modal open onClose={() => setSettingsOpen(false)} title="Paramètres du graphique">
          {/* Same options/labels/icons as the header's own "Mode d'affichage" popover (see
              ChartHeader.tsx) — this is a second, always-reachable entry point to the exact same
              state rather than a separate concept, so it stays in lockstep with whatever the
              header shows without needing its own local state. */}
          <div className="lq-field">
            <label className="lq-field__label">Style de bougie</label>
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
                  }}
                >
                  <entry.icon size={15} />
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
          {theme.isEink && (
            <p className="lq-chart__settings-eink-note">
              La palette E-ink affiche les bougies en creux ou plein plutôt qu'en couleur — les couleurs ci-dessous ne changent rien à leur apparence tant que cette palette est active.
            </p>
          )}
          <div className="lq-chart__edit-drawing-row">
            <div className="lq-field">
              <label className="lq-field__label">Bougies haussières</label>
              <input
                type="color"
                className="lq-chart__color-input"
                value={upColorOverride ?? theme.up}
                onChange={(e) => setUpColorOverride(e.target.value)}
                disabled={theme.isEink}
              />
            </div>
            <div className="lq-field">
              <label className="lq-field__label">Bougies baissières</label>
              <input
                type="color"
                className="lq-chart__color-input"
                value={downColorOverride ?? theme.down}
                onChange={(e) => setDownColorOverride(e.target.value)}
                disabled={theme.isEink}
              />
            </div>
          </div>
          {(upColorOverride || downColorOverride) && (
            <button
              type="button"
              className="lq-chart__inline-reset"
              onClick={() => {
                setUpColorOverride(undefined);
                setDownColorOverride(undefined);
              }}
            >
              Réinitialiser aux couleurs du thème
            </button>
          )}
          <Checkbox
            checked={yAutoScalingState}
            onChange={(checked) => {
              setYAutoScalingState(checked);
              onYAutoScalingChange?.(checked);
            }}
            label="Rescale automatique de l'axe des prix au zoom"
          />
          <Checkbox
            checked={futureZoneVisible}
            onChange={setFutureZoneVisible}
            label="Zone rayée après la dernière bougie"
          />
          {eventKinds.length > 0 && (
            <div className="lq-chart__settings-events">
              <span className="lq-field__label">Événements</span>
              {eventKinds.map((kind) => (
                <Checkbox
                  key={kind}
                  checked={!hiddenEventKinds.has(kind)}
                  onChange={() =>
                    setHiddenEventKinds((prev) => {
                      const next = new Set(prev);
                      if (next.has(kind)) next.delete(kind);
                      else next.add(kind);
                      return next;
                    })
                  }
                  label={capitalize(kind)}
                />
              ))}
            </div>
          )}
        </Modal>
      )}

      {volumeSettingsOpen && (
        <Modal open onClose={() => setVolumeSettingsOpen(false)} title="Paramètres du panneau Volume" footer={null}>
          {theme.isEink && (
            <p className="lq-chart__settings-eink-note">
              La palette E-ink affiche les barres en creux ou plein plutôt qu'en couleur — les couleurs ci-dessous ne changent rien à leur apparence tant que cette palette est active.
            </p>
          )}
          <div className="lq-chart__edit-drawing-row">
            <div className="lq-field">
              <label className="lq-field__label">Barres haussières</label>
              <input
                type="color"
                className="lq-chart__color-input"
                value={volumeUpColorOverride ?? upColorOverride ?? theme.up}
                onChange={(e) => setVolumeUpColorOverride(e.target.value)}
                disabled={theme.isEink}
              />
            </div>
            <div className="lq-field">
              <label className="lq-field__label">Barres baissières</label>
              <input
                type="color"
                className="lq-chart__color-input"
                value={volumeDownColorOverride ?? downColorOverride ?? theme.down}
                onChange={(e) => setVolumeDownColorOverride(e.target.value)}
                disabled={theme.isEink}
              />
            </div>
          </div>
          {(volumeUpColorOverride || volumeDownColorOverride) && (
            <button
              type="button"
              className="lq-chart__inline-reset"
              onClick={() => {
                setVolumeUpColorOverride(undefined);
                setVolumeDownColorOverride(undefined);
              }}
            >
              Réinitialiser aux couleurs des bougies
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}
