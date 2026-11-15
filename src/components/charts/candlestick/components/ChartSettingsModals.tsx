import { ColorPicker } from "../../../forms/ColorPicker";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Modal } from "../../../primitives/Modal";
import { ChartPropsModal } from "./ChartPropsModal";
import { CodeIcon } from "../../../icons";
import { Checkbox } from "../../../forms/Checkbox";
import { Toggle } from "../../../primitives/Toggle";
import { Tabs } from "../../../primitives/Tabs";
import { capitalize } from "../formatting";
import { CHART_DISPLAY_MODES } from "../chartModes";
import type { ChartDisplayMode } from "../interfaces/ChartDisplayMode.interface";
import type { PriceScaleMode } from "../interfaces/PriceScaleMode.interface";
import type { CandleColorRule } from "../interfaces/CandleColorRule.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import { CandleColorRulesEditor } from "./CandleColorRulesEditor";
import "./IndicatorSettings.css";

export interface ChartSettingsModalsProps {
  settingsOpen: boolean;
  /** Whether the chart is currently laid out for touch, and how to pin that. `null` in
   *  `layoutOverride` means the width decides (MOBILE_LAYOUT_BREAKPOINT); once the toggle is used
   *  the choice stays where the user put it — a touch layout is worth being able to see on a
   *  desktop screen, and a tablet-width window is worth being able to keep on desktop. */
  mobileLayout: boolean;
  layoutOverride: "mobile" | "desktop" | null;
  setLayoutOverride: (mode: "mobile" | "desktop" | null) => void;
  setSettingsOpen: (open: boolean) => void;
  chartDisplayMode: ChartDisplayMode;
  /** The ripple on the close line's last point — see `useClosePulse`. Only ever offered in the
   *  "line" mode, which is the only one that draws a close line to put it on. */
  closePulseVisible: boolean;
  setClosePulseVisible: (visible: boolean) => void;
  setChartDisplayMode: (mode: ChartDisplayMode) => void;
  onChartDisplayModeChange: ((mode: ChartDisplayMode) => void) | undefined;
  upColorOverride: string | undefined;
  setUpColorOverride: (color: string | undefined) => void;
  downColorOverride: string | undefined;
  setDownColorOverride: (color: string | undefined) => void;
  yAutoScalingState: boolean;
  setYAutoScalingState: (checked: boolean) => void;
  onYAutoScalingChange: ((value: boolean) => void) | undefined;
  /** Échelle de l'axe des prix (section « Échelles ») : linéaire, logarithmique ou en %. */
  priceScaleMode: PriceScaleMode;
  setPriceScaleMode: (mode: PriceScaleMode) => void;
  futureZoneVisible: boolean;
  setFutureZoneVisible: (checked: boolean) => void;
  pastZoneVisible: boolean;
  setPastZoneVisible: (checked: boolean) => void;
  eventKinds: string[];
  hiddenEventKinds: Set<string>;
  setHiddenEventKinds: Dispatch<SetStateAction<Set<string>>>;
  volumeSettingsOpen: boolean;
  setVolumeSettingsOpen: (open: boolean) => void;
  volumeUpColorOverride: string | undefined;
  setVolumeUpColorOverride: (color: string | undefined) => void;
  volumeDownColorOverride: string | undefined;
  setVolumeDownColorOverride: (color: string | undefined) => void;
  /** Nom du symbole en filigrane et son opacité ; `watermarkAvailable` : le graphique a un symbole à afficher. */
  watermark: { visible: boolean; opacity: number; size?: number };
  setWatermark: (next: { visible: boolean; opacity: number; size?: number }) => void;
  watermarkAvailable: boolean;
  /** Ligne symbole · type · OHLC en haut à gauche, masquée. */
  symbolInfoHidden: boolean;
  setSymbolInfoHidden: (hidden: boolean) => void;
  /** Couleurs conditionnelles des bougies (onglet Bougies) ; la section n'apparaît pas quand `showCandleColorRules`
   *  est faux (fonctionnalité hors de l'offre, par exemple). */
  candleColorRules: CandleColorRule[];
  setCandleColorRules: (rules: CandleColorRule[]) => void;
  showCandleColorRules: boolean;
  /** Les indicateurs du graphique, pour « clôture au-dessus / en dessous de » une courbe. */
  candleRuleIndicators: Indicator[];
}

/** Les échelles proposées pour l'axe des prix, dans l'ordre de la section « Échelles ». */
const PRICE_SCALE_OPTIONS: { mode: PriceScaleMode; label: string; hint: string }[] = [
  { mode: "linear", label: "Linéaire", hint: "L'écart de prix est proportionnel à la hauteur" },
  { mode: "log", label: "Logarithmique", hint: "Une même variation en % a la même hauteur partout — utile sur un long historique" },
  { mode: "percent", label: "Pourcentage", hint: "L'axe se lit en % de variation depuis la première bougie visible" },
];

type SettingsTab = "bougies" | "affichage" | "evenements" | "integration";

/** The two small "chart settings" modals — up/down candle colors + YAutoScaling toggle + per-kind
 *  event visibility (double-click the symbol/chart-type label to open), and its volume-pane
 *  sibling (independent up/down bar colors, falling back to the candle colors above until
 *  overridden). */
export function ChartSettingsModals({
  settingsOpen,
  mobileLayout,
  layoutOverride,
  setLayoutOverride,
  setSettingsOpen,
  chartDisplayMode,
  closePulseVisible,
  setClosePulseVisible,
  setChartDisplayMode,
  onChartDisplayModeChange,
  upColorOverride,
  setUpColorOverride,
  downColorOverride,
  setDownColorOverride,
  yAutoScalingState,
  setYAutoScalingState,
  onYAutoScalingChange,
  priceScaleMode,
  setPriceScaleMode,
  futureZoneVisible,
  setFutureZoneVisible,
  pastZoneVisible,
  setPastZoneVisible,
  eventKinds,
  hiddenEventKinds,
  setHiddenEventKinds,
  volumeSettingsOpen,
  setVolumeSettingsOpen,
  volumeUpColorOverride,
  setVolumeUpColorOverride,
  volumeDownColorOverride,
  setVolumeDownColorOverride,
  watermark,
  setWatermark,
  watermarkAvailable,
  symbolInfoHidden,
  setSymbolInfoHidden,
  candleColorRules,
  setCandleColorRules,
  showCandleColorRules,
  candleRuleIndicators,
}: ChartSettingsModalsProps) {
  // Onglets de la fenêtre des paramètres : les réglages rangés par thème plutôt qu'en une longue colonne.
  const [tab, setTab] = useState<SettingsTab>("bougies");
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

  // The props reference, opened from the settings modal — the settings are what a reader can
  // change from inside the chart, and this is what the *host application* can change from outside
  // it, so one is the natural place to ask about the other.
  const [propsOpen, setPropsOpen] = useState(false);

  return (
    <div ref={wrapperRef} style={{ display: "contents" }}>
      {settingsOpen && (
        <Modal open onClose={() => setSettingsOpen(false)} title="Paramètres du graphique">
          <Tabs
            className="lq-chart__settings-tabs"
            items={[
              { id: "bougies", label: "Bougies" },
              { id: "affichage", label: "Affichage" },
              ...(eventKinds.length > 0 ? [{ id: "evenements", label: "Événements" }] : []),
              { id: "integration", label: "Intégration" },
            ]}
            value={tab === "evenements" && eventKinds.length === 0 ? "bougies" : tab}
            onChange={(id) => setTab(id as SettingsTab)}
          />
          {tab === "bougies" && (
          <>
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
          {/* Offered only where it applies. Every other mode draws bars, and a ripple pinned to
              "the last point of the close line" has no point to sit on without one — a toggle for
              something that cannot happen is worse than no toggle at all. */}
          {chartDisplayMode === "line" && (
            <div className="lq-field">
              <label className="lq-field__label">Dernier cours</label>
              <div className="lq-chart__settings-layout-row">
                <Toggle
                  checked={closePulseVisible}
                  onChange={() => setClosePulseVisible(!closePulseVisible)}
                  ariaLabel="Onde sur le dernier point de la ligne"
                />
                <span className="lq-chart__settings-layout-label">Onde à chaque nouveau cours</span>
              </div>
              <p className="lq-chart__settings-hint">
                Une onde verte quand la clôture monte, rouge quand elle baisse. Visible seulement
                quand le cours change : en direct ou pendant un replay.
              </p>
            </div>
          )}

          {theme.isEink && (
            <p className="lq-chart__settings-eink-note">
              La palette E-ink affiche les bougies en creux ou plein plutôt qu'en couleur — les couleurs ci-dessous ne changent rien à leur apparence tant que cette palette est active.
            </p>
          )}
          <div className="lq-chart__edit-drawing-row">
            <div className="lq-field">
              <label className="lq-field__label">Bougies haussières</label>
              <ColorPicker
                className="lq-chart__color-input"
                value={upColorOverride ?? theme.up}
                onChange={(color) => setUpColorOverride(color)}
                disabled={theme.isEink}
              />
            </div>
            <div className="lq-field">
              <label className="lq-field__label">Bougies baissières</label>
              <ColorPicker
                className="lq-chart__color-input"
                value={downColorOverride ?? theme.down}
                onChange={(color) => setDownColorOverride(color)}
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
          {showCandleColorRules && (
            <CandleColorRulesEditor rules={candleColorRules} indicators={candleRuleIndicators} onChange={setCandleColorRules} />
          )}
          </>
          )}
          {tab === "affichage" && (
          <>
          {/* A manual override on the automatic width rule. Here rather than in the header because
              it is a "how this chart is laid out" setting — the same family as the candle style
              above it — and not something anyone flips often enough to earn a permanent button.
              The reset appears only once the toggle has been used: before that, automatic IS the
              state, and an always-visible "back to automatic" would be noise. */}
          <div className="lq-field">
            <label className="lq-field__label">Mise en page</label>
            <div className="lq-chart__settings-layout-row">
              <Toggle
                checked={mobileLayout}
                onChange={() => setLayoutOverride(mobileLayout ? "desktop" : "mobile")}
                ariaLabel="Mise en page tactile (mobile)"
              />
              <span className="lq-chart__settings-layout-label">{mobileLayout ? "Tactile (mobile)" : "Bureau"}</span>
            </div>
            {layoutOverride !== null && (
              <button type="button" className="lq-chart__settings-layout-reset" onClick={() => setLayoutOverride(null)}>
                Revenir au choix automatique (selon la largeur)
              </button>
            )}
          </div>
          {/* ── Section « Échelles » : échelle de l'axe des prix + ajustement automatique. Bloc
              autonome (rien d'autre n'en dépend dans cette fenêtre) : à déplacer tel quel si les
              onglets sont réorganisés. Même réglage que le sous-menu « Échelle des prix » du clic
              droit ; enregistré via `onAppearanceChange` (`priceScale`, `autoFit`). ── */}
          <div className="lq-field lq-chart__settings-scales">
            <label className="lq-field__label">Échelle de l'axe des prix</label>
            <div className="lq-chart__display-mode-menu" role="radiogroup" aria-label="Échelle de l'axe des prix">
              {PRICE_SCALE_OPTIONS.map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  role="radio"
                  aria-checked={option.mode === priceScaleMode}
                  title={option.hint}
                  className={["lq-chart__display-mode-option", option.mode === priceScaleMode && "lq-chart__display-mode-option--selected"]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setPriceScaleMode(option.mode)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Checkbox
              checked={yAutoScalingState}
              onChange={(checked) => {
                setYAutoScalingState(checked);
                onYAutoScalingChange?.(checked);
              }}
              label="Ajuster automatiquement aux données visibles (auto fit)"
            />
            <p className="lq-chart__settings-hint">
              En automatique, chaque axe Y suit les données visibles quand on se déplace dans le temps. Glisser
              un axe le règle à la main (pastille « M ») ; un double-clic sur l'axe le rend à l'automatique.
            </p>
          </div>
          <Checkbox
            checked={pastZoneVisible}
            onChange={setPastZoneVisible}
            label="Zone rayée avant la première bougie"
          />
          <Checkbox
            checked={futureZoneVisible}
            onChange={setFutureZoneVisible}
            label="Zone rayée après la dernière bougie"
          />
          <Checkbox
            checked={!symbolInfoHidden}
            onChange={(checked) => setSymbolInfoHidden(!checked)}
            label="Légende du symbole en haut à gauche (nom, type de bougies, OHLC)"
          />
          {watermarkAvailable && (
            <div className="lq-field">
              <label className="lq-field__label">Filigrane</label>
              <div className="lq-chart__settings-layout-row">
                <Toggle
                  checked={watermark.visible}
                  onChange={() => setWatermark({ ...watermark, visible: !watermark.visible })}
                  ariaLabel="Nom du symbole en filigrane"
                />
                <span className="lq-chart__settings-layout-label">Nom du symbole en fond de graphique</span>
              </div>
              {watermark.visible && (
                <label className="lq-chart__settings-opacity">
                  <span>Opacité : {Math.round(watermark.opacity * 100)} %</span>
                  <input
                    type="range"
                    min={2}
                    max={40}
                    step={1}
                    value={Math.round(watermark.opacity * 100)}
                    onChange={(e) => setWatermark({ ...watermark, opacity: Number(e.target.value) / 100 })}
                    aria-label="Opacité du filigrane"
                  />
                </label>
              )}
              {watermark.visible && (
                <label className="lq-chart__settings-opacity">
                  <span>Taille : {Math.round(watermark.size ?? 100)} %</span>
                  <input
                    type="range"
                    min={30}
                    max={150}
                    step={5}
                    value={Math.round(watermark.size ?? 100)}
                    onChange={(e) => setWatermark({ ...watermark, size: Number(e.target.value) })}
                    aria-label="Taille du filigrane"
                  />
                </label>
              )}
            </div>
          )}
          </>
          )}
          {tab === "evenements" && eventKinds.length > 0 && (
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
          {tab === "integration" && (
          <div className="lq-field">
            <label className="lq-field__label">Intégration</label>
            <button type="button" className="lq-chart__reset-button lq-chart__props-button" onClick={() => setPropsOpen(true)}>
              <CodeIcon size={13} /> Voir les props du graphique
            </button>
            <p className="lq-field__hint">
              La liste complète de ce que l&apos;application peut passer à ce graphique, avec les types et les valeurs par défaut.
            </p>
          </div>
          )}

        </Modal>
      )}

      {volumeSettingsOpen && (
        // Même grille que les paramètres d'indicateur (voir IndicatorSettings.css) : sous-titre, section « Tracé » en
        // tableau, pied « Réinitialiser » / « Fermer ».
        <Modal
          open
          onClose={() => setVolumeSettingsOpen(false)}
          className="lq-ind-settings-modal"
          title={
            <span className="lq-ind-settings__heading">
              <span className="lq-ind-settings__heading-name">Volume</span>
              <span className="lq-ind-settings__heading-kind">Paramètres du panneau</span>
            </span>
          }
          footer={
            <div className="lq-ind-settings__footer">
              <button
                type="button"
                className="lq-ind-settings__link"
                disabled={!volumeUpColorOverride && !volumeDownColorOverride}
                onClick={() => {
                  setVolumeUpColorOverride(undefined);
                  setVolumeDownColorOverride(undefined);
                }}
              >
                Réinitialiser aux couleurs des bougies
              </button>
              <button type="button" className="lq-ind-settings__button" onClick={() => setVolumeSettingsOpen(false)}>
                Fermer
              </button>
            </div>
          }
        >
          <div className="lq-ind-settings">
            <section className="lq-ind-settings__section" aria-label="Tracé">
              <header className="lq-ind-settings__section-head">
                <h3 className="lq-ind-settings__section-title">Tracé</h3>
              </header>
              <div className="lq-ind-settings__trace" role="table" aria-label="Éléments tracés">
                <div className="lq-ind-settings__trace-row" role="row">
                  <span className="lq-ind-settings__trace-check" role="cell" />
                  <span className="lq-ind-settings__trace-name" role="cell">
                    Barres
                  </span>
                  <span className="lq-ind-settings__trace-colors" role="cell">
                    <span className="lq-ind-settings__swatch">
                      <span className="lq-ind-settings__swatch-label">Hausse</span>
                      <ColorPicker
                        className="lq-chart__color-input"
                        value={volumeUpColorOverride ?? upColorOverride ?? theme.up}
                        onChange={(color) => setVolumeUpColorOverride(color)}
                        disabled={theme.isEink}
                        aria-label="Couleur des barres haussières"
                      />
                    </span>
                    <span className="lq-ind-settings__swatch">
                      <span className="lq-ind-settings__swatch-label">Baisse</span>
                      <ColorPicker
                        className="lq-chart__color-input"
                        value={volumeDownColorOverride ?? downColorOverride ?? theme.down}
                        onChange={(color) => setVolumeDownColorOverride(color)}
                        disabled={theme.isEink}
                        aria-label="Couleur des barres baissières"
                      />
                    </span>
                  </span>
                </div>
              </div>
              {theme.isEink && (
                <p className="lq-ind-settings__empty">
                  En palette E-ink, les barres sont en creux ou pleines plutôt qu&apos;en couleur : ces couleurs ne changent rien tant
                  qu&apos;elle est active.
                </p>
              )}
            </section>
          </div>
        </Modal>
      )}

      <ChartPropsModal open={propsOpen} onClose={() => setPropsOpen(false)} />
    </div>
  );
}
