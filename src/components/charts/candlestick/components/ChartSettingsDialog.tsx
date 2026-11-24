import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Modal } from "../../../primitives/Modal";
import { Toggle } from "../../../primitives/Toggle";
import { Checkbox } from "../../../forms/Checkbox";
import { Button } from "../../../primitives/Button";
import { Select } from "../../../forms/Select";
import { ColorPicker } from "../../../forms/ColorPicker";
import { Slider } from "../../../forms/Slider";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CodeIcon } from "../../../icons";
import { capitalize } from "../formatting";
import { CHART_DISPLAY_MODES } from "../chartModes";
import type { ChartDisplayMode } from "../interfaces/ChartDisplayMode.interface";
import type { CandleColorRule } from "../interfaces/CandleColorRule.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { ChartButtonsVisibility, ChartColorMode, ChartDateFormat, ChartLineStyle, ChartStyleSettings, ChartStyleTemplate, ChartTimeFormat } from "../chartStyle";
import { CANVAS_STYLE_KEYS, DEFAULT_RESET_ZOOM_BARS, MODE_COLOR_KEYS, chartStyleMeta, templateStyle } from "../chartStyle";
import { CandleColorRulesEditor } from "./CandleColorRulesEditor";
import { hasCandleColorOverrides, resetCandleColors } from "../candleColorOverrides";
import "./ChartSettingsDialog.css";

/** Les pages de la fenêtre, dans l'ordre de la navigation. */
export type ChartSettingsPage = "symbole" | "bougies" | "ligne-etat" | "echelles" | "toile" | "evenements" | "integration";

/** Échelle de l'axe des prix (même union que `PriceScaleMode`). */
type PriceScale = "linear" | "log" | "percent";

const PRICE_SCALE_OPTIONS: { mode: PriceScale; label: string; hint: string }[] = [
  { mode: "linear", label: "Linéaire", hint: "L'écart de prix est proportionnel à la hauteur" },
  { mode: "log", label: "Logarithmique", hint: "Une même variation en % a la même hauteur partout — utile sur un long historique" },
  { mode: "percent", label: "Pourcentage", hint: "L'axe se lit en % de variation depuis la première bougie visible" },
];

const LINE_STYLE_OPTIONS: { value: ChartLineStyle; label: string }[] = [
  { value: "solid", label: "Plein" },
  { value: "dashed", label: "Tirets" },
  { value: "dotted", label: "Pointillés" },
];

const DATE_FORMAT_OPTIONS: { value: ChartDateFormat; label: string }[] = [
  { value: "auto", label: "Automatique" },
  { value: "dd MMM yyyy", label: "29 sept. 2026" },
  { value: "dd MMM 'yy", label: "29 sept. '26" },
  { value: "dd/MM/yyyy", label: "29/09/2026" },
  { value: "dd/MM/yy", label: "29/09/26" },
  { value: "yyyy-MM-dd", label: "2026-09-29" },
  { value: "MMM yyyy", label: "sept. 2026" },
];

const TIME_FORMAT_OPTIONS: { value: ChartTimeFormat; label: string }[] = [
  { value: "auto", label: "Sans heure" },
  { value: "24h", label: "24 heures (14:30)" },
  { value: "12h", label: "12 heures (2:30 PM)" },
];

const TEXT_SIZE_OPTIONS = ["10", "11", "12", "13", "14", "15", "16"].map((v) => ({ value: v, label: `${v} px` }));

const AXIS_LABEL_KEYS = ["seriesLabelBg", "seriesLabelText", "seriesLabelBgDown", "seriesLabelTextDown", "crosshairPriceLabelBg", "crosshairPriceLabelText", "crosshairTimeLabelBg", "crosshairTimeLabelText"] as const;

const COLOR_MODE_OPTIONS: { value: ChartColorMode | "auto"; label: string }[] = [
  { value: "light", label: "Jour" },
  { value: "dark", label: "Nuit" },
  { value: "auto", label: "Suivre le thème du site" },
];

const BUTTONS_VISIBILITY_OPTIONS: { value: ChartButtonsVisibility; label: string }[] = [
  { value: "always", label: "Toujours visibles" },
  { value: "hover", label: "Visibles au survol" },
  { value: "hidden", label: "Masqués" },
];

const WATERMARK_OPTIONS: { value: "hidden" | "symbol" | "replay"; label: string }[] = [
  { value: "hidden", label: "Masqué" },
  { value: "symbol", label: "Symbole" },
  { value: "replay", label: "Symbole en mode replay" },
];

/** `#rrggbb` et une opacité (0–1) en `#rrggbbaa` ; une autre écriture de couleur reste telle quelle. */
function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})/i.exec(color.trim());
  if (!m) return color;
  return `#${m[1]}${Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, "0")}`;
}

/** `#rrggbb(aa)` en couleur opaque et opacité (1 sans canal alpha). */
function splitAlpha(color: string): { hex: string; alpha: number } {
  const m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(color.trim());
  if (!m) return { hex: color, alpha: 1 };
  return { hex: `#${m[1]}`, alpha: m[2] ? Math.round((parseInt(m[2], 16) / 255) * 100) / 100 : 1 };
}

export interface ChartSettingsDialogProps {
  onClose: () => void;
  /** Page à l'ouverture et rubrique (`id` de section) à amener à l'écran : clic droit sur un axe, par exemple. */
  initialTarget?: { page: ChartSettingsPage; section?: string };
  /** L'élément du graphique, pour lire les couleurs du thème affichées par une pastille sans réglage. */
  themeElement: HTMLElement | null;
  theme: { up: string; down: string; isEink: boolean };
  onOpenProps: () => void;
  mobileLayout: boolean;
  layoutOverride: "mobile" | "desktop" | null;
  setLayoutOverride: (mode: "mobile" | "desktop" | null) => void;
  chartDisplayMode: ChartDisplayMode;
  setChartDisplayMode: (mode: ChartDisplayMode) => void;
  onChartDisplayModeChange: ((mode: ChartDisplayMode) => void) | undefined;
  closePulseVisible: boolean;
  setClosePulseVisible: (visible: boolean) => void;
  upColorOverride: string | undefined;
  setUpColorOverride: (color: string | undefined) => void;
  downColorOverride: string | undefined;
  setDownColorOverride: (color: string | undefined) => void;
  yAutoScalingState: boolean;
  setYAutoScalingState: (checked: boolean) => void;
  onYAutoScalingChange: ((value: boolean) => void) | undefined;
  /** Échelle de l'axe des prix (linéaire, log, %) — absente : la ligne n'apparaît pas. */
  priceScaleMode?: PriceScale;
  setPriceScaleMode?: (mode: PriceScale) => void;
  futureZoneVisible: boolean;
  setFutureZoneVisible: (checked: boolean) => void;
  pastZoneVisible: boolean;
  setPastZoneVisible: (checked: boolean) => void;
  eventKinds: string[];
  hiddenEventKinds: Set<string>;
  setHiddenEventKinds: Dispatch<SetStateAction<Set<string>>>;
  watermark: { visible: boolean; opacity: number; size?: number };
  setWatermark: (next: { visible: boolean; opacity: number; size?: number }) => void;
  watermarkAvailable: boolean;
  symbolInfoHidden: boolean;
  setSymbolInfoHidden: (hidden: boolean) => void;
  candleColorRules: CandleColorRule[];
  setCandleColorRules: (rules: CandleColorRule[]) => void;
  showCandleColorRules: boolean;
  candleRuleIndicators: Indicator[];
  chartStyle: ChartStyleSettings;
  setChartStyle: (style: ChartStyleSettings) => void;
  styleTemplates: ChartStyleTemplate[];
  setStyleTemplates: (templates: ChartStyleTemplate[]) => void;
  /** Section Toile avancée et menu « Modèle » (voir `CandlestickChartProps.advancedAppearance`). */
  advancedAppearance: boolean;
  /** Prix en direct : le compte à rebours et la ligne du dernier prix par défaut en dépendent. */
  livePrice: boolean;
}

const NARROW_QUERY = "(max-width: 640px)";

/** Vrai sur un écran étroit (celui où la fenêtre occupe tout l'écran, voir Modal.css). */
function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

/** Une ligne « libellé à gauche / contrôle(s) à droite ». */
function Row({ label, hint, children, disabled }: { label: ReactNode; hint?: ReactNode; children: ReactNode; disabled?: boolean }) {
  return (
    <div className={["lq-chart-settings__row", disabled && "lq-chart-settings__row--disabled"].filter(Boolean).join(" ")}>
      <div className="lq-chart-settings__label">
        <span>{label}</span>
        {hint && <span className="lq-chart-settings__hint">{hint}</span>}
      </div>
      <div className="lq-chart-settings__control">{children}</div>
    </div>
  );
}

function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section className="lq-chart-settings__section" id={id ? `lq-chart-settings-${id}` : undefined}>
      <h3 className="lq-chart-settings__section-title">{title}</h3>
      {children}
    </section>
  );
}

/** Deux pastilles « hausse / baisse » côte à côte. */
function UpDownPickers({
  up,
  down,
  onUp,
  onDown,
  disabled,
  label,
}: {
  up: string;
  down: string;
  onUp: (c: string) => void;
  onDown: (c: string) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <span className="lq-chart-settings__pair">
      <ColorPicker value={up} onChange={onUp} disabled={disabled} aria-label={`${label} haussières`} title="Hausse" />
      <ColorPicker value={down} onChange={onDown} disabled={disabled} aria-label={`${label} baissières`} title="Baisse" />
    </span>
  );
}

const lineStyleSelect = (value: ChartLineStyle, onChange: (v: ChartLineStyle) => void, ariaLabel: string, disabled?: boolean) => (
  <Select<ChartLineStyle> size="small" className="lq-chart-settings__select" options={LINE_STYLE_OPTIONS} value={value} onChange={onChange} ariaLabel={ariaLabel} disabled={disabled} />
);

/** Ce que la fenêtre remet en place sur « Annuler » : l'état de tous ses réglages à l'ouverture. */
interface SettingsSnapshot {
  up: string | undefined;
  down: string | undefined;
  closePulse: boolean;
  future: boolean;
  past: boolean;
  rules: CandleColorRule[];
  style: ChartStyleSettings;
  watermark: { visible: boolean; opacity: number; size?: number };
  symbolInfoHidden: boolean;
  displayMode: ChartDisplayMode;
  yAuto: boolean;
  priceScale: PriceScale | undefined;
  hiddenEvents: Set<string>;
  layout: "mobile" | "desktop" | null;
}

/**
 * « Paramètres système » (anciennement « Paramètres du graphique ») : navigation verticale à gauche (sur téléphone, la liste puis la page), une ligne par
 * réglage (libellé à gauche, contrôle à droite), sections en petites capitales. Tout s'applique en direct ;
 * « Annuler » revient à l'état d'ouverture, « Valider » garde. Le menu « Modèle » enregistre et rappelle l'apparence
 * (couleurs des bougies et réglages avancés).
 */
export function ChartSettingsDialog(props: ChartSettingsDialogProps) {
  const {
    onClose,
    themeElement,
    theme,
    chartStyle,
    setChartStyle,
    advancedAppearance,
    eventKinds,
  } = props;
  // Écran de téléphone : la liste des sections, puis la page choisie (avec un retour), au lieu des deux côte à côte.
  const mobileLayout = useNarrowScreen();
  const [page, setPage] = useState<ChartSettingsPage | null>(props.initialTarget?.page ?? (mobileLayout ? null : "symbole"));
  const initialSection = props.initialTarget?.section;
  useEffect(() => {
    if (!initialSection) return;
    const el = document.getElementById(`lq-chart-settings-${initialSection}`);
    el?.scrollIntoView({ block: "start" });
    el?.classList.add("lq-chart-settings__section--flash");
  }, [initialSection]);
  const [snapshot] = useState<SettingsSnapshot>(() => ({
    up: props.upColorOverride,
    down: props.downColorOverride,
    closePulse: props.closePulseVisible,
    future: props.futureZoneVisible,
    past: props.pastZoneVisible,
    rules: props.candleColorRules,
    style: props.chartStyle,
    watermark: props.watermark,
    symbolInfoHidden: props.symbolInfoHidden,
    displayMode: props.chartDisplayMode,
    yAuto: props.yAutoScalingState,
    priceScale: props.priceScaleMode,
    hiddenEvents: props.hiddenEventKinds,
    layout: props.layoutOverride,
  }));

  // Couleurs que dessine le thème quand un réglage est vide : ce que montre la pastille tant qu'on n'y a pas touché.
  const [themeColors, setThemeColors] = useState({ text: "#888888", muted: "#888888", grid: "#cccccc", bg: "#ffffff", accent: "#6c87c9", accentContrast: "#ffffff" });
  useEffect(() => {
    if (!themeElement) return;
    const cs = getComputedStyle(themeElement);
    const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    setThemeColors({
      text: v("--lq-color-text", "#333333"),
      muted: v("--lq-color-text-muted", "#888888"),
      grid: v("--lq-chart-grid-color", v("--lq-color-border-subtle", "#cccccc")),
      bg: v("--lq-color-bg", "#ffffff"),
      accent: v("--lq-color-accent", "#6c87c9"),
      accentContrast: v("--lq-color-accent-contrast", "#ffffff"),
    });
  }, [themeElement]);

  const set = (patch: Partial<ChartStyleSettings>) => {
    const next: ChartStyleSettings = { ...chartStyle, ...patch };
    // Un réglage remis à sa valeur vide disparaît : l'objet enregistré ne garde que ce qui a été changé.
    for (const key of Object.keys(next) as (keyof ChartStyleSettings)[]) if (next[key] === undefined) delete next[key];
    setChartStyle(next);
  };

  const cancel = () => {
    if (props.upColorOverride !== snapshot.up) props.setUpColorOverride(snapshot.up);
    if (props.downColorOverride !== snapshot.down) props.setDownColorOverride(snapshot.down);
    props.setClosePulseVisible(snapshot.closePulse);
    props.setFutureZoneVisible(snapshot.future);
    props.setPastZoneVisible(snapshot.past);
    if (props.candleColorRules !== snapshot.rules) props.setCandleColorRules(snapshot.rules);
    props.setWatermark(snapshot.watermark);
    props.setSymbolInfoHidden(snapshot.symbolInfoHidden);
    if (props.chartDisplayMode !== snapshot.displayMode) {
      props.setChartDisplayMode(snapshot.displayMode);
      props.onChartDisplayModeChange?.(snapshot.displayMode);
    }
    if (props.yAutoScalingState !== snapshot.yAuto) {
      props.setYAutoScalingState(snapshot.yAuto);
      props.onYAutoScalingChange?.(snapshot.yAuto);
    }
    if (snapshot.priceScale && props.priceScaleMode !== snapshot.priceScale) props.setPriceScaleMode?.(snapshot.priceScale);
    props.setHiddenEventKinds(snapshot.hiddenEvents);
    props.setLayoutOverride(snapshot.layout);
    // En dernier : l'objet enregistré à l'ouverture (couleurs par mode comprises) remplace tout ce qui précède.
    setChartStyle(snapshot.style);
    onClose();
  };

  const pages: { id: ChartSettingsPage; label: string }[] = [
    { id: "symbole", label: "Symbole" },
    { id: "bougies", label: "Bougies" },
    { id: "ligne-etat", label: "Ligne d'état" },
    { id: "echelles", label: "Échelles et lignes" },
    { id: "toile", label: "Toile" },
    ...(eventKinds.length > 0 ? [{ id: "evenements" as const, label: "Événements" }] : []),
    { id: "integration", label: "Intégration" },
  ];
  const current = page === "evenements" && eventKinds.length === 0 ? "symbole" : page;
  const currentLabel = pages.find((p) => p.id === current)?.label;

  const footer = (
    <div className="lq-chart-settings__footer">
      {advancedAppearance ? <TemplateMenu {...props} themeUp={theme.up} themeDown={theme.down} /> : <span />}
      <div className="lq-chart-settings__footer-actions">
        <Button variant="ghost" onClick={cancel}>
          Annuler
        </Button>
        <Button tone="primary" onClick={onClose}>
          Valider
        </Button>
      </div>
    </div>
  );

  return (
    <Modal open onClose={onClose} title={mobileLayout && current ? currentLabel : "Paramètres système"} size="wide" footer={footer}>
      <div className={["lq-chart-settings", mobileLayout && "lq-chart-settings--mobile"].filter(Boolean).join(" ")}>
        {(!mobileLayout || current === null) && (
          <nav className="lq-chart-settings__nav" aria-label="Sections des paramètres">
            {pages.map((p) => (
              <button
                key={p.id}
                type="button"
                className={["lq-chart-settings__nav-item", p.id === current && !mobileLayout && "lq-chart-settings__nav-item--active"].filter(Boolean).join(" ")}
                aria-current={p.id === current && !mobileLayout ? "page" : undefined}
                onClick={() => setPage(p.id)}
              >
                <span>{p.label}</span>
                {mobileLayout && <ChevronRightIcon size={14} />}
              </button>
            ))}
          </nav>
        )}
        {current !== null && (
          <div className="lq-chart-settings__page">
            {mobileLayout && (
              <button type="button" className="lq-chart-settings__back" onClick={() => setPage(null)}>
                <ChevronLeftIcon size={14} /> Toutes les sections
              </button>
            )}
            {current === "symbole" && SymbolPage(props)}
            {current === "bougies" && <ChartTypeSettings {...props} theme={theme} mode={props.chartDisplayMode} />}
            {current === "ligne-etat" && StatusLinePage(props)}
            {current === "echelles" && ScalesPage(props)}
            {current === "toile" && CanvasPage({ ...props, themeColors })}
            {current === "evenements" && EventsPage(props)}
            {current === "integration" && IntegrationPage(props)}
          </div>
        )}
      </div>
    </Modal>
  );

  // ── Pages ──

  function SymbolPage(p: ChartSettingsDialogProps) {
    return <ChartSymbolSettings {...p} theme={theme} onOpenCandleColors={() => setPage("bougies")} />;
  }

  function StatusLinePage(p: ChartSettingsDialogProps) {
    const off = p.symbolInfoHidden;
    const toggle = (key: keyof ChartStyleSettings, label: string, def: boolean, disabled?: boolean) => {
      const checked = (chartStyle[key] as boolean | undefined) ?? def;
      return (
        <Row label={label} disabled={disabled}>
          <Toggle checked={checked} onChange={() => set({ [key]: !checked === def ? undefined : !checked })} ariaLabel={label} disabled={disabled} />
        </Row>
      );
    };
    return (
      <>
        <Section title="Symbole">
          <Row label="Ligne d'état" hint="En haut à gauche du graphique">
            <Toggle checked={!off} onChange={() => p.setSymbolInfoHidden(!off)} ariaLabel="Afficher la ligne d'état" />
          </Row>
          {toggle("legendSymbol", "Symbole", true, off)}
          {toggle("legendDescription", "Description (type de graphique)", true, off)}
          {toggle("legendOhlc", "Valeurs OHLC", true, off)}
          {toggle("legendChange", "Variation", true, off)}
          {toggle("legendVolume", "Volume", false, off)}
        </Section>
        <Section title="Indicateurs">
          {toggle("legendIndicatorTitles", "Titres", true)}
          {toggle("legendIndicatorValues", "Valeurs", false)}
        </Section>
      </>
    );
  }

  function ScalesPage(p: ChartSettingsDialogProps) {
    const bool = (key: keyof ChartStyleSettings, def: boolean) => (chartStyle[key] as boolean | undefined) ?? def;
    const flip = (key: keyof ChartStyleSettings, def: boolean) => {
      const next = !bool(key, def);
      set({ [key]: next === def ? undefined : next });
    };
    const priceShown = bool("priceAxisVisible", true);
    const lastLine = chartStyle.lastPriceLine ?? p.livePrice;
    return (
      <>
        <Section title="Échelle des prix">
          {p.priceScaleMode && p.setPriceScaleMode && (
            <Row label="Mode">
              <div className="lq-chart-settings__segmented" role="radiogroup" aria-label="Échelle de l'axe des prix">
                {PRICE_SCALE_OPTIONS.map((o) => (
                  <button
                    key={o.mode}
                    type="button"
                    role="radio"
                    aria-checked={o.mode === p.priceScaleMode}
                    title={o.hint}
                    className={["lq-chart-settings__segment", o.mode === p.priceScaleMode && "lq-chart-settings__segment--active"].filter(Boolean).join(" ")}
                    onClick={() => p.setPriceScaleMode!(o.mode)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </Row>
          )}
          <Row label="Ajustement automatique" hint="L'axe suit les bougies visibles au zoom">
            <Toggle
              checked={p.yAutoScalingState}
              onChange={() => {
                p.setYAutoScalingState(!p.yAutoScalingState);
                p.onYAutoScalingChange?.(!p.yAutoScalingState);
              }}
              ariaLabel="Ajustement automatique de l'axe des prix"
            />
          </Row>
          <Row label="Axe des prix">
            <Toggle checked={priceShown} onChange={() => flip("priceAxisVisible", true)} ariaLabel="Afficher l'axe des prix" />
          </Row>
          <Row label="Axes des panneaux" hint="Volume et indicateurs">
            <Toggle checked={bool("paneAxesVisible", true)} onChange={() => flip("paneAxesVisible", true)} ariaLabel="Afficher les axes des panneaux" />
          </Row>
          <Row label="Placement de l'échelle">
            <Select<"right" | "left">
              size="small"
              className="lq-chart-settings__select"
              options={[
                { value: "right", label: "À droite" },
                { value: "left", label: "À gauche" },
              ]}
              value={chartStyle.priceAxisSide ?? "right"}
              onChange={(side) => set({ priceAxisSide: side === "right" ? undefined : side })}
              ariaLabel="Placement de l'échelle des prix"
            />
          </Row>
        </Section>
        <Section title="Étiquettes et lignes">
          <Row label="Dernier prix" hint="Pastille sur l'axe" disabled={!priceShown}>
            <Toggle checked={bool("lastPriceLabel", true)} onChange={() => flip("lastPriceLabel", true)} ariaLabel="Pastille du dernier prix" disabled={!priceShown} />
          </Row>
          <Row label="Ligne du dernier prix">
            {lineStyleSelect(chartStyle.lastPriceLineStyle ?? "dashed", (v) => set({ lastPriceLineStyle: v === "dashed" ? undefined : v }), "Style de la ligne du dernier prix", !lastLine)}
            {/* Hausse (dernier prix au-dessus de la clôture précédente) et baisse : par défaut la couleur de la bougie ;
                l'ancienne couleur unique vaut pour les deux sens. La pastille du dernier prix prend la même couleur. */}
            <UpDownPickers
              up={chartStyle.lastPriceLineUpColor ?? chartStyle.lastPriceLineColor ?? p.upColorOverride ?? theme.up}
              down={chartStyle.lastPriceLineDownColor ?? chartStyle.lastPriceLineColor ?? p.downColorOverride ?? theme.down}
              onUp={(c) => set({ lastPriceLineUpColor: c })}
              onDown={(c) => set({ lastPriceLineDownColor: c })}
              disabled={!lastLine}
              label="Couleur de la ligne du dernier prix, bougies"
            />
            <Toggle
              checked={lastLine}
              onChange={() => set({ lastPriceLine: !lastLine === p.livePrice ? undefined : !lastLine })}
              ariaLabel="Ligne du dernier prix"
            />
          </Row>
          <Row label="Plus haut et plus bas visibles" disabled={!priceShown}>
            <Toggle checked={bool("highLowLabels", false)} onChange={() => flip("highLowLabels", false)} ariaLabel="Plus haut et plus bas visibles" disabled={!priceShown} />
          </Row>
          <Row label="Valeurs des indicateurs" hint="Dernière valeur sur l'axe">
            <Toggle checked={bool("indicatorAxisLabels", false)} onChange={() => flip("indicatorAxisLabels", false)} ariaLabel="Valeurs des indicateurs sur l'axe" />
          </Row>
          <Row label="Compte à rebours jusqu'à la clôture" hint={p.livePrice ? undefined : "Avec les prix en direct"} disabled={!priceShown}>
            <Toggle checked={bool("countdown", true)} onChange={() => flip("countdown", true)} ariaLabel="Compte à rebours de la bougie" disabled={!priceShown} />
          </Row>
        </Section>
        {advancedAppearance && (
          <Section title="Étiquettes des axes" id="etiquettes">
            <Row label="Valeurs des séries" hint="Dernier cours et dernière valeur des indicateurs, sur l'axe">
              <Select<"series" | "custom">
                size="small"
                className="lq-chart-settings__select lq-chart-settings__select--wide"
                options={[
                  { value: "series", label: "Couleur de la série" },
                  { value: "custom", label: "Personnalisée" },
                ]}
                value={chartStyle.seriesLabelBg ? "custom" : "series"}
                onChange={(v) =>
                  set(
                    // Les champs « en baisse » du kit 0.276.0 sont effacés au passage : il n'y a plus qu'une couleur.
                    v === "custom"
                      ? { seriesLabelBg: chartStyle.seriesLabelBg ?? themeColors.accent, seriesLabelBgDown: undefined, seriesLabelTextDown: undefined }
                      : { seriesLabelBg: undefined, seriesLabelBgDown: undefined, seriesLabelTextDown: undefined },
                  )
                }
                ariaLabel="Fond des étiquettes des séries"
              />
              <ColorPicker
                value={chartStyle.seriesLabelBg ?? themeColors.accent}
                onChange={(c) => set({ seriesLabelBg: c })}
                disabled={!chartStyle.seriesLabelBg}
                aria-label="Couleur de fond des étiquettes des séries"
                title="Fond"
              />
              <ColorPicker
                value={chartStyle.seriesLabelText ?? themeColors.accentContrast}
                onChange={(c) => set({ seriesLabelText: c })}
                aria-label="Couleur du texte des étiquettes des séries"
                title="Texte"
              />
            </Row>
            <Row label="Réticule sur l'axe des prix" hint="Prix ou valeur survolé, fond et texte">
              <ColorPicker value={chartStyle.crosshairPriceLabelBg ?? themeColors.accent} onChange={(c) => set({ crosshairPriceLabelBg: c })} aria-label="Couleur de fond de l'étiquette du réticule (prix)" title="Fond" />
              <ColorPicker value={chartStyle.crosshairPriceLabelText ?? themeColors.accentContrast} onChange={(c) => set({ crosshairPriceLabelText: c })} aria-label="Couleur du texte de l'étiquette du réticule (prix)" title="Texte" />
            </Row>
            <Row label="Réticule sur l'axe du temps" hint="Date survolée, fond et texte">
              <ColorPicker value={chartStyle.crosshairTimeLabelBg ?? themeColors.accent} onChange={(c) => set({ crosshairTimeLabelBg: c })} aria-label="Couleur de fond de l'étiquette de date du réticule" title="Fond" />
              <ColorPicker value={chartStyle.crosshairTimeLabelText ?? themeColors.accentContrast} onChange={(c) => set({ crosshairTimeLabelText: c })} aria-label="Couleur du texte de l'étiquette de date du réticule" title="Texte" />
            </Row>
            {AXIS_LABEL_KEYS.some((k) => chartStyle[k] !== undefined) && (
              <div className="lq-chart-settings__row lq-chart-settings__row--action">
                <button type="button" className="lq-chart-settings__link" onClick={() => set(Object.fromEntries(AXIS_LABEL_KEYS.map((k) => [k, undefined])) as Partial<ChartStyleSettings>)}>
                  Revenir aux couleurs des étiquettes du thème
                </button>
              </div>
            )}
          </Section>
        )}
        <Section title="Échelle de temps">
          <Row label="Axe du temps">
            <Toggle checked={bool("timeAxisVisible", true)} onChange={() => flip("timeAxisVisible", true)} ariaLabel="Afficher l'axe du temps" />
          </Row>
          <Row label="Jour de la semaine sur les étiquettes">
            <Toggle checked={bool("weekdayOnLabels", false)} onChange={() => flip("weekdayOnLabels", false)} ariaLabel="Jour de la semaine sur les étiquettes" />
          </Row>
          <Row label="Format de la date">
            <Select<ChartDateFormat>
              size="small"
              className="lq-chart-settings__select lq-chart-settings__select--wide"
              options={DATE_FORMAT_OPTIONS}
              value={chartStyle.dateFormat ?? "auto"}
              onChange={(v) => set({ dateFormat: v === "auto" ? undefined : v })}
              ariaLabel="Format de la date"
            />
          </Row>
          <Row label="Format de l'heure" hint="Bougies de moins d'un jour">
            <Select<ChartTimeFormat>
              size="small"
              className="lq-chart-settings__select lq-chart-settings__select--wide"
              options={TIME_FORMAT_OPTIONS}
              value={chartStyle.timeFormat ?? "auto"}
              onChange={(v) => set({ timeFormat: v === "auto" ? undefined : v })}
              ariaLabel="Format de l'heure"
            />
          </Row>
        </Section>
        <Section title="Mise en page">
          <Row label="Mise en page tactile" hint={p.layoutOverride === null ? "Choisie selon la largeur" : undefined}>
            {p.layoutOverride !== null && (
              <button type="button" className="lq-chart-settings__link" onClick={() => p.setLayoutOverride(null)}>
                Automatique
              </button>
            )}
            <Toggle checked={p.mobileLayout} onChange={() => p.setLayoutOverride(p.mobileLayout ? "desktop" : "mobile")} ariaLabel="Mise en page tactile (mobile)" />
          </Row>
        </Section>
      </>
    );
  }

  function CanvasPage(p: ChartSettingsDialogProps & { themeColors: { text: string; muted: string; grid: string; bg: string } }) {
    const tc = p.themeColors;
    const vert = chartStyle.vertGridVisible ?? false;
    const horz = chartStyle.horzGridVisible ?? true;
    const gradient = chartStyle.backgroundType === "gradient";
    const meta = chartStyleMeta(chartStyle);
    const mode = meta?.mode ?? "light";
    const host = meta?.host ?? "light";
    const raw = meta?.raw ?? chartStyle;
    const numberField = (key: "marginTop" | "marginBottom" | "marginRightBars" | "resetZoomBars", label: string, unit: string, def: number | undefined, max: number, hint?: string) => (
      <Row label={label} hint={hint}>
        <span className="lq-chart-settings__number">
          <input
            type="number"
            min={0}
            max={max}
            step={1}
            value={chartStyle[key] ?? def ?? ""}
            placeholder={def === undefined ? "Auto" : undefined}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "") return set({ [key]: undefined });
              const n = Math.max(0, Math.min(max, Math.round(Number(value))));
              set({ [key]: Number.isFinite(n) && n !== def ? n : undefined });
            }}
            aria-label={label}
          />
          <span>{unit}</span>
        </span>
      </Row>
    );
    const buttonsSelect = (key: "navigationButtons" | "paneButtons", def: ChartButtonsVisibility, label: string) => (
      <Select<ChartButtonsVisibility>
        size="small"
        className="lq-chart-settings__select lq-chart-settings__select--wide"
        options={BUTTONS_VISIBILITY_OPTIONS}
        value={chartStyle[key] ?? def}
        onChange={(v) => set({ [key]: v === def ? undefined : v })}
        ariaLabel={label}
      />
    );
    // Réglages de la toile posés (hors mode jour / nuit) : de quoi proposer « Revenir à la toile du thème ».
    const touched = CANVAS_STYLE_KEYS.some((k) => k !== "colorMode" && k !== "surfaceTokens" && raw[k] !== undefined) || Boolean(raw.modeColors?.[mode] && Object.keys(raw.modeColors[mode]!).some((k) => k !== "upColor" && k !== "downColor"));
    const modeTouched = (meta?.hasModeColors ?? false) || p.upColorOverride !== undefined || p.downColorOverride !== undefined;
    const resetModeColors = () => {
      set(Object.fromEntries(MODE_COLOR_KEYS.map((k) => [k, undefined])) as Partial<ChartStyleSettings>);
      p.setUpColorOverride(undefined);
      p.setDownColorOverride(undefined);
    };
    // Filigrane : masqué, toujours (le symbole) ou seulement pendant un replay ; couleur et opacité dans le sélecteur.
    const watermarkMode: "hidden" | "symbol" | "replay" = !p.watermark.visible ? "hidden" : chartStyle.watermarkVisibility === "replay" ? "replay" : "symbol";
    const watermarkColor = withAlpha(chartStyle.watermarkColor ?? tc.text, p.watermark.opacity);
    const textSizes = TEXT_SIZE_OPTIONS.some((o) => o.value === String(chartStyle.scaleTextSize ?? ""))
      ? TEXT_SIZE_OPTIONS
      : chartStyle.scaleTextSize
        ? [{ value: String(chartStyle.scaleTextSize), label: `${chartStyle.scaleTextSize} px` }, ...TEXT_SIZE_OPTIONS]
        : TEXT_SIZE_OPTIONS;
    return (
      <>
        {advancedAppearance && (
          <Section title="Mode">
            <Row label="Mode du graphique" hint={chartStyle.colorMode === undefined ? `Le site est en mode ${host === "dark" ? "nuit" : "jour"}` : undefined}>
              <div className="lq-chart-settings__segmented" role="radiogroup" aria-label="Mode jour ou nuit du graphique">
                {COLOR_MODE_OPTIONS.map((o) => {
                  const active = (chartStyle.colorMode ?? "auto") === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={["lq-chart-settings__segment", active && "lq-chart-settings__segment--active"].filter(Boolean).join(" ")}
                      onClick={() => set({ colorMode: o.value === "auto" ? undefined : o.value })}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </Row>
            <Row label={`Couleurs du mode ${mode === "dark" ? "nuit" : "jour"}`} hint="Enregistrées à part pour le jour et pour la nuit">
              <button type="button" className="lq-chart-settings__link" onClick={resetModeColors} disabled={!modeTouched}>
                Revenir aux couleurs par défaut
              </button>
            </Row>
          </Section>
        )}
        <Section title="Styles de base du graphique">
          {/* Fond translucide : ce qui est derrière le graphique (halo animé de la page…) transparaît. */}
          <Row label="Opacité du fond">
            <span className="lq-chart-settings__slider">
              <Slider
                min={0}
                max={100}
                step={5}
                value={chartStyle.backgroundOpacity ?? 100}
                onChange={(v) => set({ backgroundOpacity: v })}
                aria-label="Opacité du fond du graphique"
              />
            </span>
            <span className="lq-chart-settings__slider-value">{chartStyle.backgroundOpacity ?? 100} %</span>
          </Row>
          {advancedAppearance && (
            <>
              <Row label="Fond">
                <Select<"solid" | "gradient">
                  size="small"
                  className="lq-chart-settings__select"
                  options={[
                    { value: "solid", label: "Uni" },
                    { value: "gradient", label: "Dégradé" },
                  ]}
                  value={gradient ? "gradient" : "solid"}
                  onChange={(v) =>
                    set({ backgroundType: v === "gradient" ? "gradient" : undefined, backgroundColor2: v === "gradient" ? (chartStyle.backgroundColor2 ?? tc.bg) : undefined })
                  }
                  ariaLabel="Type de fond"
                />
                <ColorPicker value={chartStyle.backgroundColor ?? tc.bg} onChange={(c) => set({ backgroundColor: c })} aria-label={gradient ? "Couleur du haut du dégradé" : "Couleur du fond"} />
                {gradient && (
                  <ColorPicker value={chartStyle.backgroundColor2 ?? tc.bg} onChange={(c) => set({ backgroundColor2: c, backgroundColor: chartStyle.backgroundColor ?? tc.bg })} aria-label="Couleur du bas du dégradé" />
                )}
              </Row>
              <Row label="Lignes de grille verticales">
                {lineStyleSelect(chartStyle.vertGridStyle ?? "dashed", (v) => set({ vertGridStyle: v }), "Style de la grille verticale", !vert)}
                <ColorPicker value={chartStyle.vertGridColor ?? tc.grid} onChange={(c) => set({ vertGridColor: c })} disabled={!vert} aria-label="Couleur de la grille verticale" />
                <Checkbox checked={vert} onChange={() => set({ vertGridVisible: vert ? undefined : true })} ariaLabel="Lignes de grille verticales" />
              </Row>
              <Row label="Lignes de grille horizontales">
                {lineStyleSelect(chartStyle.horzGridStyle ?? "dashed", (v) => set({ horzGridStyle: v }), "Style de la grille horizontale", !horz)}
                <ColorPicker value={chartStyle.horzGridColor ?? tc.grid} onChange={(c) => set({ horzGridColor: c })} disabled={!horz} aria-label="Couleur de la grille horizontale" />
                <Checkbox checked={horz} onChange={() => set({ horzGridVisible: horz ? false : undefined })} ariaLabel="Lignes de grille horizontales" />
              </Row>
              <Row label="Séparateurs de panneaux">
                <ColorPicker value={chartStyle.paneSeparatorColor ?? tc.grid} onChange={(c) => set({ paneSeparatorColor: c })} aria-label="Couleur des séparateurs de panneaux" />
              </Row>
              <Row label="Réticule" hint="Style, couleur et épaisseur">
                {lineStyleSelect(chartStyle.crosshairStyle ?? "dashed", (v) => set({ crosshairStyle: v }), "Style du réticule")}
                <ColorPicker
                  value={chartStyle.crosshairColor ?? tc.muted}
                  onChange={(c) => set({ crosshairColor: c })}
                  thickness={chartStyle.crosshairWidth ?? 1}
                  onThicknessChange={(w) => set({ crosshairWidth: w === 1 ? undefined : w })}
                  aria-label="Couleur du réticule"
                />
              </Row>
            </>
          )}
          {p.watermarkAvailable && (
            <>
              <Row label="Filigrane" hint="Le nom du symbole en fond du graphique">
                <Select<"hidden" | "symbol" | "replay">
                  size="small"
                  className="lq-chart-settings__select lq-chart-settings__select--wide"
                  options={WATERMARK_OPTIONS}
                  value={watermarkMode}
                  onChange={(v) => {
                    if (v === "hidden") return p.setWatermark({ ...p.watermark, visible: false });
                    if (!p.watermark.visible) p.setWatermark({ ...p.watermark, visible: true });
                    set({ watermarkVisibility: v === "replay" ? "replay" : undefined });
                  }}
                  ariaLabel="Visibilité du filigrane"
                />
                <ColorPicker
                  value={watermarkColor}
                  onChange={(c) => {
                    const { hex, alpha } = splitAlpha(c);
                    p.setWatermark({ ...p.watermark, opacity: alpha });
                    set({ watermarkColor: hex });
                  }}
                  disabled={watermarkMode === "hidden"}
                  aria-label="Couleur et opacité du filigrane"
                />
              </Row>
              {watermarkMode !== "hidden" && (
                <Row label="Taille du filigrane">
                  <span className="lq-chart-settings__range">
                    <input type="range" min={30} max={150} step={5} value={Math.round(p.watermark.size ?? 100)} onChange={(e) => p.setWatermark({ ...p.watermark, size: Number(e.target.value) })} aria-label="Taille du filigrane" />
                    <span>{Math.round(p.watermark.size ?? 100)} %</span>
                  </span>
                </Row>
              )}
            </>
          )}
        </Section>
        {advancedAppearance && (
          <>
            <Section title="Échelles">
              <Row label="Texte">
                <Select<string>
                  size="small"
                  className="lq-chart-settings__select"
                  options={[{ value: "", label: "Auto" }, ...textSizes]}
                  value={chartStyle.scaleTextSize ? String(chartStyle.scaleTextSize) : ""}
                  onChange={(v) => set({ scaleTextSize: v ? Number(v) : undefined })}
                  ariaLabel="Taille du texte des échelles"
                />
                <ColorPicker value={chartStyle.scaleTextColor ?? tc.muted} onChange={(c) => set({ scaleTextColor: c })} aria-label="Couleur du texte des échelles" />
              </Row>
              <Row label="Lignes" hint="Axes et graduations">
                <ColorPicker value={chartStyle.scaleLineColor ?? tc.grid} onChange={(c) => set({ scaleLineColor: c })} aria-label="Couleur des lignes des échelles" />
              </Row>
            </Section>
            <Section title="Boutons">
              <Row label="Navigation" hint="Zoom et défilement en bas du graphique">
                {buttonsSelect("navigationButtons", "hidden", "Boutons de navigation")}
              </Row>
              <Row label="Panneau" hint="Réglages, masquer, fermer des panneaux et indicateurs">
                {buttonsSelect("paneButtons", "hover", "Boutons des panneaux")}
              </Row>
            </Section>
            <Section title="Marges">
              {numberField("marginTop", "Haut", "%", 8, 60)}
              {numberField("marginBottom", "Bas", "%", 8, 60)}
              {numberField("marginRightBars", "Droite", "barres", undefined, 200, "Espace vide après la dernière bougie")}
            </Section>
            <Section title="Zoom">
              {numberField("resetZoomBars", "Réinitialisation du zoom", "barres", DEFAULT_RESET_ZOOM_BARS, 5000, "Espace ou double-clic : nombre de bougies de l'unité de temps affichées")}
            </Section>
          </>
        )}
        <Section title="Zones">
          <Row label="Zone rayée avant la première bougie">
            <Toggle checked={p.pastZoneVisible} onChange={() => p.setPastZoneVisible(!p.pastZoneVisible)} ariaLabel="Zone rayée avant la première bougie" />
          </Row>
          <Row label="Zone rayée après la dernière bougie">
            <Toggle checked={p.futureZoneVisible} onChange={() => p.setFutureZoneVisible(!p.futureZoneVisible)} ariaLabel="Zone rayée après la dernière bougie" />
          </Row>
        </Section>
        {advancedAppearance && touched && (
          <div className="lq-chart-settings__row lq-chart-settings__row--action">
            <button
              type="button"
              className="lq-chart-settings__link"
              onClick={() =>
                set(Object.fromEntries(CANVAS_STYLE_KEYS.filter((k) => k !== "colorMode").map((k) => [k, undefined])) as Partial<ChartStyleSettings>)
              }
            >
              Revenir à la toile du thème
            </button>
          </div>
        )}
      </>
    );
  }

  function EventsPage(p: ChartSettingsDialogProps) {
    return (
      <Section title="Événements affichés">
        {p.eventKinds.map((kind) => (
          <Row key={kind} label={capitalize(kind)}>
            <Toggle
              checked={!p.hiddenEventKinds.has(kind)}
              onChange={() =>
                p.setHiddenEventKinds((prev) => {
                  const next = new Set(prev);
                  if (next.has(kind)) next.delete(kind);
                  else next.add(kind);
                  return next;
                })
              }
              ariaLabel={capitalize(kind)}
            />
          </Row>
        ))}
      </Section>
    );
  }

  function IntegrationPage(p: ChartSettingsDialogProps) {
    return (
      <Section title="Intégration">
        <Row label="Props du graphique" hint="Ce que l'application peut passer à ce graphique, avec les types et les valeurs par défaut">
          <button type="button" className="lq-chart__reset-button lq-chart__props-button" onClick={p.onOpenProps}>
            <CodeIcon size={13} /> Voir
          </button>
        </Row>
      </Section>
    );
  }
}

/** Menu « Modèle ▾ » du pied de la fenêtre : enregistrer l'apparence sous un nom, appliquer un modèle, le supprimer,
 *  ou revenir à l'apparence par défaut. */
/** Ce que règlent les réglages de la série principale (type de tracé, couleurs des bougies, couleurs conditionnelles). */
export type ChartSymbolSettingsProps = Pick<
  ChartSettingsDialogProps,
  | "theme"
  | "chartDisplayMode"
  | "setChartDisplayMode"
  | "onChartDisplayModeChange"
  | "closePulseVisible"
  | "setClosePulseVisible"
  | "upColorOverride"
  | "setUpColorOverride"
  | "downColorOverride"
  | "setDownColorOverride"
  | "candleColorRules"
  | "setCandleColorRules"
  | "showCandleColorRules"
  | "candleRuleIndicators"
  | "chartStyle"
  | "setChartStyle"
> & {
  /** « params » : le tracé (type de bougies, onde) ; « style » : les couleurs (bougies, couleurs conditionnelles).
   *  Absent : tout, comme la page « Symbole » des paramètres système. */
  part?: "params" | "style";
  /** Page « Symbole » des paramètres système : ouvre l'onglet « Bougies », où sont les couleurs de chaque type. */
  onOpenCandleColors?: () => void;
};

/**
 * Les réglages de la série principale du graphique : type de bougies, onde du dernier cours, couleurs des corps,
 * bordures et mèches, couleurs conditionnelles des bougies. Page « Symbole » des paramètres système, et onglet du
 * symbole des paramètres du graphique (rubriques Paramètres / Style, voir `part`).
 */
export function ChartSymbolSettings(p: ChartSymbolSettingsProps) {
  const { theme } = p;
  const showParams = p.part !== "style";
  const showStyle = p.part !== "params";
  const type = (
    <Row label="Type de bougies">
      <Select<ChartDisplayMode>
        size="small"
        className="lq-chart-settings__select lq-chart-settings__select--wide"
        options={CHART_DISPLAY_MODES.map((m) => ({ value: m.mode, label: m.label }))}
        value={p.chartDisplayMode}
        onChange={(mode) => {
          p.setChartDisplayMode(mode);
          p.onChartDisplayModeChange?.(mode);
        }}
        ariaLabel="Type de bougies"
      />
    </Row>
  );
  const pulse = (
    <Row
      label="Onde du dernier cours"
      hint={p.chartDisplayMode === "line" ? "Une onde à chaque nouveau cours, en direct ou en replay" : "Seulement en mode Ligne"}
      disabled={p.chartDisplayMode !== "line"}
    >
      <Toggle checked={p.closePulseVisible} onChange={() => p.setClosePulseVisible(!p.closePulseVisible)} ariaLabel="Onde sur le dernier point de la ligne" disabled={p.chartDisplayMode !== "line"} />
    </Row>
  );
  // Les couleurs : le composant de l'onglet « Bougies », réduit au type affiché (un seul réglage par couleur).
  const colors = <ChartTypeSettings {...p} theme={theme} mode={p.chartDisplayMode} single />;
  // Page « Symbole » des paramètres système : une section « Bougies », comme avant ; l'onglet du symbole sépare le
  // tracé (Paramètres) des couleurs (Style).
  if (p.part === undefined) {
    return (
      <>
        <Section title="Type de graphique">
          {type}
          {pulse}
          {p.onOpenCandleColors && (
            <Row label="Couleurs" hint="Celles de chaque type de graphique">
              <button type="button" className="lq-chart-settings__link" onClick={p.onOpenCandleColors}>
                Ouvrir l'onglet Bougies
              </button>
            </Row>
          )}
        </Section>
        {p.showCandleColorRules && (
          <section className="lq-chart-settings__section">
            <CandleColorRulesEditor rules={p.candleColorRules} indicators={p.candleRuleIndicators} onChange={p.setCandleColorRules} />
          </section>
        )}
      </>
    );
  }
  return (
    <div className="lq-chart-settings-embedded">
      {showParams && (
        <Section title="Tracé">
          {type}
          {pulse}
        </Section>
      )}
      {showStyle && colors}
      {showStyle && p.showCandleColorRules && (
        <section className="lq-chart-settings__section">
          <CandleColorRulesEditor rules={p.candleColorRules} indicators={p.candleRuleIndicators} onChange={p.setCandleColorRules} />
        </section>
      )}
    </div>
  );
}

/** Les sous-onglets de l'onglet « Bougies » : un par type de graphique du kit, dans l'ordre du sélecteur de type. */
const CHART_TYPE_TABS = CHART_DISPLAY_MODES.map((m) => ({ mode: m.mode, label: m.label }));

/** Les réglages de couleur propres à chaque type (pour « Revenir aux couleurs du thème » d'un sous-onglet). */
const CHART_TYPE_KEYS: Record<Exclude<ChartDisplayMode, "candle">, (keyof ChartStyleSettings)[]> = {
  heikinAshi: ["haUpColor", "haDownColor", "haBorderUpColor", "haBorderDownColor", "haWickUpColor", "haWickDownColor"],
  bar: ["barUpColor", "barDownColor", "barWidth"],
  line: ["lineColor", "lineWidth", "lineStyle", "lineGradient", "lineTopColor", "lineBottomColor", "lineFill", "lineFillColor", "lineFillGradient", "lineFillTopColor", "lineFillBottomColor"],
  renko: ["renkoUpColor", "renkoDownColor", "renkoBorderUpColor", "renkoBorderDownColor", "renkoAtrPeriod"],
  lineBreak: ["lineBreakUpColor", "lineBreakDownColor", "lineBreakBorderUpColor", "lineBreakBorderDownColor", "lineBreakLines"],
};

const BAR_WIDTH_OPTIONS = ["1", "2", "3", "4"].map((v) => ({ value: v, label: `${v} px` }));

export type ChartTypeSettingsProps = Pick<
  ChartSettingsDialogProps,
  "theme" | "chartStyle" | "setChartStyle" | "upColorOverride" | "setUpColorOverride" | "downColorOverride" | "setDownColorOverride"
> & {
  /** Le type affiché à l'ouverture (celui du graphique). */
  mode: ChartDisplayMode;
  /** Vrai : seulement ce type, sans les sous-onglets (onglet du symbole des paramètres du graphique). */
  single?: boolean;
};

/**
 * Les couleurs de chaque type de graphique : bougies, barres, ligne de clôture, Heikin Ashi, Renko, Line Break. Onglet
 * « Bougies » des paramètres système (un sous-onglet par type, celui du graphique ouvert d'abord), et rubrique Style de
 * l'onglet du symbole (le type affiché seul) : un seul composant, donc jamais deux réglages pour une même couleur.
 */
export function ChartTypeSettings(p: ChartTypeSettingsProps) {
  const { theme, chartStyle } = p;
  const [tab, setTab] = useState<ChartDisplayMode>(p.mode);
  const current = p.single ? p.mode : tab;
  // L'accent du thème : la couleur de la ligne de clôture tant qu'elle n'est pas réglée.
  const rootRef = useRef<HTMLDivElement>(null);
  const [accent, setAccent] = useState("#6c87c9");
  useEffect(() => {
    if (!rootRef.current) return;
    const v = getComputedStyle(rootRef.current).getPropertyValue("--lq-color-accent").trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) setAccent(v);
  }, []);
  const set = (patch: Partial<ChartStyleSettings>) => {
    const next: ChartStyleSettings = { ...chartStyle, ...patch };
    for (const key of Object.keys(next) as (keyof ChartStyleSettings)[]) if (next[key] === undefined) delete next[key];
    p.setChartStyle(next);
  };
  const up = p.upColorOverride ?? theme.up;
  const down = p.downColorOverride ?? theme.down;
  const eink = theme.isEink && current !== "line";
  const numberRow = (key: "renkoAtrPeriod" | "lineBreakLines", label: string, hint: string, def: number, min: number, max: number) => (
    <Row label={label} hint={hint}>
      <span className="lq-chart-settings__number">
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          value={chartStyle[key] ?? def}
          onChange={(e) => {
            const n = Math.round(Number(e.target.value));
            if (!Number.isFinite(n)) return;
            const v = Math.max(min, Math.min(max, n));
            set({ [key]: v === def ? undefined : v });
          }}
          aria-label={label}
        />
      </span>
    </Row>
  );
  const bricks = (prefix: "renko" | "lineBreak", noun: string) => {
    const k = (s: string) => `${prefix}${s}` as keyof ChartStyleSettings;
    const body = (side: "Up" | "Down") => (chartStyle[k(`${side}Color`)] as string | undefined) ?? (side === "Up" ? up : down);
    return (
      <>
        <Row label="Corps" hint="Hausse · baisse">
          <UpDownPickers label={`Corps des ${noun}`} up={body("Up")} down={body("Down")} onUp={(c) => set({ [k("UpColor")]: c })} onDown={(c) => set({ [k("DownColor")]: c })} disabled={eink} />
        </Row>
        <Row label="Bordures" hint="Hausse · baisse">
          <UpDownPickers
            label={`Bordures des ${noun}`}
            up={(chartStyle[k("BorderUpColor")] as string | undefined) ?? body("Up")}
            down={(chartStyle[k("BorderDownColor")] as string | undefined) ?? body("Down")}
            onUp={(c) => set({ [k("BorderUpColor")]: c })}
            onDown={(c) => set({ [k("BorderDownColor")]: c })}
            disabled={eink}
          />
        </Row>
      </>
    );
  };
  const lineColor = chartStyle.lineColor ?? accent;
  const fill = chartStyle.lineFill ?? true;
  const gradient = chartStyle.lineFillGradient ?? false;
  const lineGradient = chartStyle.lineGradient ?? false;
  const panel = (() => {
    switch (current) {
      case "candle":
        return (
          <>
            <Row label="Corps" hint="Hausse · baisse">
              <UpDownPickers label="Corps des bougies" up={up} down={down} onUp={p.setUpColorOverride} onDown={p.setDownColorOverride} disabled={eink} />
            </Row>
            <Row label="Bordures" hint="Hausse · baisse">
              <UpDownPickers label="Bordures des bougies" up={chartStyle.borderUpColor ?? up} down={chartStyle.borderDownColor ?? down} onUp={(c) => set({ borderUpColor: c })} onDown={(c) => set({ borderDownColor: c })} disabled={eink} />
            </Row>
            <Row label="Mèches" hint="Hausse · baisse">
              <UpDownPickers label="Mèches des bougies" up={chartStyle.wickUpColor ?? up} down={chartStyle.wickDownColor ?? down} onUp={(c) => set({ wickUpColor: c })} onDown={(c) => set({ wickDownColor: c })} disabled={eink} />
            </Row>
          </>
        );
      case "heikinAshi": {
        const haUp = chartStyle.haUpColor ?? up;
        const haDown = chartStyle.haDownColor ?? down;
        return (
          <>
            <Row label="Corps" hint="Hausse · baisse">
              <UpDownPickers label="Corps Heikin Ashi" up={haUp} down={haDown} onUp={(c) => set({ haUpColor: c })} onDown={(c) => set({ haDownColor: c })} disabled={eink} />
            </Row>
            <Row label="Bordures" hint="Hausse · baisse">
              <UpDownPickers
                label="Bordures Heikin Ashi"
                up={chartStyle.haBorderUpColor ?? chartStyle.borderUpColor ?? haUp}
                down={chartStyle.haBorderDownColor ?? chartStyle.borderDownColor ?? haDown}
                onUp={(c) => set({ haBorderUpColor: c })}
                onDown={(c) => set({ haBorderDownColor: c })}
                disabled={eink}
              />
            </Row>
            <Row label="Mèches" hint="Hausse · baisse">
              <UpDownPickers
                label="Mèches Heikin Ashi"
                up={chartStyle.haWickUpColor ?? chartStyle.wickUpColor ?? haUp}
                down={chartStyle.haWickDownColor ?? chartStyle.wickDownColor ?? haDown}
                onUp={(c) => set({ haWickUpColor: c })}
                onDown={(c) => set({ haWickDownColor: c })}
                disabled={eink}
              />
            </Row>
          </>
        );
      }
      case "bar":
        return (
          <>
            <Row label="Barres" hint="Hausse · baisse">
              <UpDownPickers label="Barres" up={chartStyle.barUpColor ?? up} down={chartStyle.barDownColor ?? down} onUp={(c) => set({ barUpColor: c })} onDown={(c) => set({ barDownColor: c })} disabled={eink} />
            </Row>
            <Row label="Épaisseur">
              <Select<string>
                size="small"
                className="lq-chart-settings__select"
                options={BAR_WIDTH_OPTIONS}
                value={String(chartStyle.barWidth ?? 1)}
                onChange={(v) => set({ barWidth: v === "1" ? undefined : Number(v) })}
                ariaLabel="Épaisseur des barres"
              />
            </Row>
          </>
        );
      case "line":
        return (
          <>
            <Row label="Ligne" hint="Style, couleur et épaisseur">
              {lineStyleSelect(chartStyle.lineStyle ?? "solid", (v) => set({ lineStyle: v === "solid" ? undefined : v }), "Style de la ligne de clôture")}
              <ColorPicker
                value={lineColor}
                onChange={(c) => set({ lineColor: c })}
                thickness={chartStyle.lineWidth ?? 1.5}
                thicknessOptions={[1, 1.5, 2, 3, 4]}
                onThicknessChange={(w) => set({ lineWidth: w === 1.5 ? undefined : w })}
                aria-label="Couleur de la ligne de clôture"
              />
            </Row>
            <Row label="Couleur de la ligne" hint={lineGradient ? "Haut · bas" : undefined}>
              <Select<"solid" | "gradient">
                size="small"
                className="lq-chart-settings__select"
                options={[
                  { value: "solid", label: "Unie" },
                  { value: "gradient", label: "Dégradé" },
                ]}
                value={lineGradient ? "gradient" : "solid"}
                onChange={(v) => set({ lineGradient: v === "gradient" ? true : undefined })}
                ariaLabel="Couleur de la ligne : unie ou en dégradé"
              />
              {lineGradient ? (
                <>
                  <ColorPicker value={chartStyle.lineTopColor ?? lineColor} onChange={(c) => set({ lineTopColor: c })} aria-label="Couleur du haut de la ligne" title="Haut" />
                  <ColorPicker value={chartStyle.lineBottomColor ?? lineColor} onChange={(c) => set({ lineBottomColor: c })} aria-label="Couleur du bas de la ligne" title="Bas" />
                </>
              ) : null}
            </Row>
            <Row label="Remplissage sous la courbe" hint={fill ? undefined : "Une simple ligne, sans aire"}>
              <Toggle checked={fill} onChange={() => set({ lineFill: fill ? false : undefined })} ariaLabel="Remplissage sous la ligne de clôture" />
            </Row>
            <Row label="Type de remplissage" disabled={!fill}>
              <Select<"solid" | "gradient">
                size="small"
                className="lq-chart-settings__select"
                options={[
                  { value: "solid", label: "Uni" },
                  { value: "gradient", label: "Dégradé" },
                ]}
                value={gradient ? "gradient" : "solid"}
                onChange={(v) => set({ lineFillGradient: v === "gradient" ? true : undefined })}
                ariaLabel="Type de remplissage"
                disabled={!fill}
              />
              {gradient ? (
                <>
                  <ColorPicker value={chartStyle.lineFillTopColor ?? withAlpha(lineColor, 0.35)} onChange={(c) => set({ lineFillTopColor: c })} disabled={!fill} aria-label="Couleur du haut du dégradé de la ligne" title="Haut" />
                  <ColorPicker value={chartStyle.lineFillBottomColor ?? withAlpha(lineColor, 0)} onChange={(c) => set({ lineFillBottomColor: c })} disabled={!fill} aria-label="Couleur du bas du dégradé de la ligne" title="Bas" />
                </>
              ) : (
                <ColorPicker value={chartStyle.lineFillColor ?? withAlpha(lineColor, 0.08)} onChange={(c) => set({ lineFillColor: c })} disabled={!fill} aria-label="Couleur du remplissage de la ligne" />
              )}
            </Row>
          </>
        );
      case "renko":
        return (
          <>
            {bricks("renko", "briques Renko")}
            {numberRow("renkoAtrPeriod", "Période de l'ATR", "Taille des briques : l'ATR sur cette période", 14, 1, 200)}
          </>
        );
      case "lineBreak":
        return (
          <>
            {bricks("lineBreak", "lignes Line Break")}
            {numberRow("lineBreakLines", "Nombre de lignes", "Lignes à dépasser pour un renversement", 3, 2, 10)}
          </>
        );
    }
  })();
  const touched =
    current === "candle" ? hasCandleColorOverrides(p) : CHART_TYPE_KEYS[current].some((k) => chartStyle[k] !== undefined);
  const reset = () => {
    if (current === "candle") return resetCandleColors(p);
    set(Object.fromEntries(CHART_TYPE_KEYS[current].map((k) => [k, undefined])) as Partial<ChartStyleSettings>);
  };
  return (
    <div ref={rootRef} className="lq-chart-settings__chart-types">
      {!p.single && (
        <div className="lq-chart-settings__subtabs" role="tablist" aria-label="Types de graphique">
          {CHART_TYPE_TABS.map((t) => (
            <button
              key={t.mode}
              type="button"
              role="tab"
              aria-selected={t.mode === current}
              className={["lq-chart-settings__subtab", t.mode === current && "lq-chart-settings__subtab--active"].filter(Boolean).join(" ")}
              onClick={() => setTab(t.mode)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <Section title={CHART_TYPE_TABS.find((t) => t.mode === current)?.label ?? "Bougies"}>
        {eink && (
          <p className="lq-chart-settings__note">
            La palette E-ink affiche ce type en creux ou plein plutôt qu'en couleur : les couleurs ci-dessous ne changent rien tant qu'elle est active.
          </p>
        )}
        {panel}
        {touched && (
          <div className="lq-chart-settings__row lq-chart-settings__row--action">
            <button type="button" className="lq-chart-settings__link" onClick={reset}>
              Revenir aux couleurs du thème
            </button>
          </div>
        )}
      </Section>
    </div>
  );
}

function TemplateMenu(p: ChartSettingsDialogProps & { themeUp: string; themeDown: string }) {
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setNaming(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = p.styleTemplates.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
    const template: ChartStyleTemplate = {
      id: existing?.id ?? `tpl-${Date.now().toString(36)}`,
      name: trimmed,
      upColor: p.upColorOverride,
      downColor: p.downColorOverride,
      style: templateStyle(p.chartStyle),
    };
    p.setStyleTemplates(existing ? p.styleTemplates.map((t) => (t.id === existing.id ? template : t)) : [...p.styleTemplates, template]);
    setName("");
    setNaming(false);
    setOpen(false);
  };
  const apply = (t: ChartStyleTemplate | null) => {
    // Le mode jour / nuit choisi reste : un modèle porte l'apparence, appliquée au mode affiché.
    p.setChartStyle({ ...templateStyle(t?.style ?? {}), colorMode: p.chartStyle.colorMode });
    p.setUpColorOverride(t?.upColor);
    p.setDownColorOverride(t?.downColor);
    setOpen(false);
  };

  return (
    <div className="lq-chart-settings__templates" ref={ref}>
      <Button variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" icon={<ChevronDownIcon size={13} />} iconPosition="trailing">
        Modèle
      </Button>
      {open && (
        <div className="lq-chart-settings__menu" role="menu">
          {naming ? (
            <form
              className="lq-chart-settings__menu-form"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du modèle" aria-label="Nom du modèle" maxLength={40} />
              <Button type="submit" tone="primary" disabled={!name.trim()}>
                OK
              </Button>
            </form>
          ) : (
            <button type="button" role="menuitem" className="lq-chart-settings__menu-item" onClick={() => setNaming(true)}>
              Enregistrer sous…
            </button>
          )}
          {p.styleTemplates.length > 0 && <div className="lq-chart-settings__menu-sep" />}
          {p.styleTemplates.map((t) => (
            <div key={t.id} className="lq-chart-settings__menu-template">
              <button type="button" role="menuitem" className="lq-chart-settings__menu-item" onClick={() => apply(t)}>
                <span className="lq-chart-settings__menu-swatches" aria-hidden="true">
                  <span style={{ background: t.style.backgroundColor ?? "transparent" }} />
                  <span style={{ background: t.upColor ?? p.themeUp }} />
                  <span style={{ background: t.downColor ?? p.themeDown }} />
                </span>
                {t.name}
              </button>
              <button
                type="button"
                className="lq-chart-settings__menu-delete"
                onClick={() => p.setStyleTemplates(p.styleTemplates.filter((x) => x.id !== t.id))}
                aria-label={`Supprimer le modèle ${t.name}`}
                title="Supprimer"
              >
                ×
              </button>
            </div>
          ))}
          <div className="lq-chart-settings__menu-sep" />
          <button type="button" role="menuitem" className="lq-chart-settings__menu-item" onClick={() => apply(null)}>
            Apparence par défaut
          </button>
        </div>
      )}
    </div>
  );
}
