import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ChartPropsModal } from "./ChartPropsModal";
import type { ChartDisplayMode } from "../interfaces/ChartDisplayMode.interface";
import type { PriceScaleMode } from "../interfaces/PriceScaleMode.interface";
import type { CandleColorRule } from "../interfaces/CandleColorRule.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import { ChartSettingsDialog } from "./ChartSettingsDialog";
import type { ChartStyleSettings, ChartStyleTemplate } from "../chartStyle";
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
  /** Réglages avancés (Symbole, Ligne d'état, Échelles et lignes, Toile) et modèles d'apparence — voir `ChartStyleSettings`. */
  chartStyle: ChartStyleSettings;
  setChartStyle: (style: ChartStyleSettings) => void;
  styleTemplates: ChartStyleTemplate[];
  setStyleTemplates: (templates: ChartStyleTemplate[]) => void;
  /** Voir `CandlestickChartProps.advancedAppearance`. */
  advancedAppearance: boolean;
  /** Prix en direct (compte à rebours, ligne du dernier prix par défaut). */
  livePrice: boolean;
}

/** The "chart settings" modal — up/down candle colors + YAutoScaling toggle + per-kind event visibility
 *  (double-click the symbol/chart-type label to open). Les paramètres du panneau Volume (onglets Volume / indicateurs
 *  posés dessus) sont dans IndicatorModals, avec ceux des autres panneaux. */
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
  watermark,
  setWatermark,
  watermarkAvailable,
  symbolInfoHidden,
  setSymbolInfoHidden,
  candleColorRules,
  setCandleColorRules,
  showCandleColorRules,
  candleRuleIndicators,
  chartStyle,
  setChartStyle,
  styleTemplates,
  setStyleTemplates,
  advancedAppearance,
  livePrice,
}: ChartSettingsModalsProps) {
  // What "no override" actually renders as, read fresh off the live theme rather than hardcoded
  // — the swatch shown when a field is unset used to be a fixed "#26a69a"/"#ef5350" regardless of
  // the active theme/palette, which could (and, in E-ink, always did) disagree with the color the
  // chart itself was really drawing. `wrapperRef` sits on a `display: contents` node (renders no
  // box of its own, just lets its children lay out as if it weren't there) so it's always mounted
  // — unlike the modal below, which only exists in the DOM while their own `open` is true —
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
  }, [settingsOpen]);

  // The props reference, opened from the settings modal — the settings are what a reader can
  // change from inside the chart, and this is what the *host application* can change from outside
  // it, so one is the natural place to ask about the other.
  const [propsOpen, setPropsOpen] = useState(false);

  return (
    <div ref={wrapperRef} style={{ display: "contents" }}>
      {settingsOpen && (
        <ChartSettingsDialog
          onClose={() => setSettingsOpen(false)}
          themeElement={wrapperRef.current}
          theme={theme}
          onOpenProps={() => setPropsOpen(true)}
          mobileLayout={mobileLayout}
          layoutOverride={layoutOverride}
          setLayoutOverride={setLayoutOverride}
          chartDisplayMode={chartDisplayMode}
          setChartDisplayMode={setChartDisplayMode}
          onChartDisplayModeChange={onChartDisplayModeChange}
          closePulseVisible={closePulseVisible}
          setClosePulseVisible={setClosePulseVisible}
          upColorOverride={upColorOverride}
          setUpColorOverride={setUpColorOverride}
          downColorOverride={downColorOverride}
          setDownColorOverride={setDownColorOverride}
          yAutoScalingState={yAutoScalingState}
          setYAutoScalingState={setYAutoScalingState}
          onYAutoScalingChange={onYAutoScalingChange}
          priceScaleMode={priceScaleMode}
          setPriceScaleMode={setPriceScaleMode}
          futureZoneVisible={futureZoneVisible}
          setFutureZoneVisible={setFutureZoneVisible}
          pastZoneVisible={pastZoneVisible}
          setPastZoneVisible={setPastZoneVisible}
          eventKinds={eventKinds}
          hiddenEventKinds={hiddenEventKinds}
          setHiddenEventKinds={setHiddenEventKinds}
          watermark={watermark}
          setWatermark={setWatermark}
          watermarkAvailable={watermarkAvailable}
          symbolInfoHidden={symbolInfoHidden}
          setSymbolInfoHidden={setSymbolInfoHidden}
          candleColorRules={candleColorRules}
          setCandleColorRules={setCandleColorRules}
          showCandleColorRules={showCandleColorRules}
          candleRuleIndicators={candleRuleIndicators}
          chartStyle={chartStyle}
          setChartStyle={setChartStyle}
          styleTemplates={styleTemplates}
          setStyleTemplates={setStyleTemplates}
          advancedAppearance={advancedAppearance}
          livePrice={livePrice}
        />
      )}

      <ChartPropsModal open={propsOpen} onClose={() => setPropsOpen(false)} />
    </div>
  );
}
