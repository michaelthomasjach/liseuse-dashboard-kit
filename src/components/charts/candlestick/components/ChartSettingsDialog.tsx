import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Modal } from "../../../primitives/Modal";
import { Toggle } from "../../../primitives/Toggle";
import { Button } from "../../../primitives/Button";
import { Select } from "../../../forms/Select";
import { ColorPicker } from "../../../forms/ColorPicker";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CodeIcon } from "../../../icons";
import { capitalize } from "../formatting";
import { CHART_DISPLAY_MODES } from "../chartModes";
import type { ChartDisplayMode } from "../interfaces/ChartDisplayMode.interface";
import type { CandleColorRule } from "../interfaces/CandleColorRule.interface";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { ChartDateFormat, ChartLineStyle, ChartStyleSettings, ChartStyleTemplate, ChartTimeFormat } from "../chartStyle";
import { CANVAS_STYLE_KEYS } from "../chartStyle";
import { CandleColorRulesEditor } from "./CandleColorRulesEditor";
import "./ChartSettingsDialog.css";

/** Les pages de la fenêtre, dans l'ordre de la navigation. */
export type ChartSettingsPage = "symbole" | "ligne-etat" | "echelles" | "toile" | "evenements" | "integration";

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

const TEXT_SIZE_OPTIONS = ["9", "10", "11", "12", "13", "14", "16"].map((v) => ({ value: v, label: `${v} px` }));

export interface ChartSettingsDialogProps {
  onClose: () => void;
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="lq-chart-settings__section">
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
 * « Paramètres du graphique » : navigation verticale à gauche (sur téléphone, la liste puis la page), une ligne par
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
  const [page, setPage] = useState<ChartSettingsPage | null>(mobileLayout ? null : "symbole");
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
  const [themeColors, setThemeColors] = useState({ text: "#888888", muted: "#888888", grid: "#cccccc", bg: "#ffffff" });
  useEffect(() => {
    if (!themeElement) return;
    const cs = getComputedStyle(themeElement);
    const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    setThemeColors({
      text: v("--lq-color-text", "#333333"),
      muted: v("--lq-color-text-muted", "#888888"),
      grid: v("--lq-chart-grid-color", v("--lq-color-border-subtle", "#cccccc")),
      bg: v("--lq-color-bg", "#ffffff"),
    });
  }, [themeElement]);

  const set = (patch: Partial<ChartStyleSettings>) => {
    const next: ChartStyleSettings = { ...chartStyle, ...patch };
    // Un réglage remis à sa valeur vide disparaît : l'objet enregistré ne garde que ce qui a été changé.
    for (const key of Object.keys(next) as (keyof ChartStyleSettings)[]) if (next[key] === undefined) delete next[key];
    setChartStyle(next);
  };

  const cancel = () => {
    props.setUpColorOverride(snapshot.up);
    props.setDownColorOverride(snapshot.down);
    props.setClosePulseVisible(snapshot.closePulse);
    props.setFutureZoneVisible(snapshot.future);
    props.setPastZoneVisible(snapshot.past);
    if (props.candleColorRules !== snapshot.rules) props.setCandleColorRules(snapshot.rules);
    setChartStyle(snapshot.style);
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
    onClose();
  };

  const pages: { id: ChartSettingsPage; label: string }[] = [
    { id: "symbole", label: "Symbole" },
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
    <Modal open onClose={onClose} title={mobileLayout && current ? currentLabel : "Paramètres du graphique"} size="wide" footer={footer}>
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
    const up = p.upColorOverride ?? theme.up;
    const down = p.downColorOverride ?? theme.down;
    const anyColor = p.upColorOverride || p.downColorOverride || chartStyle.wickUpColor || chartStyle.wickDownColor || chartStyle.borderUpColor || chartStyle.borderDownColor;
    return (
      <>
        <Section title="Bougies">
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
          {theme.isEink && (
            <p className="lq-chart-settings__note">
              La palette E-ink affiche les bougies en creux ou plein plutôt qu'en couleur : les couleurs ci-dessous ne changent rien tant qu'elle est active.
            </p>
          )}
          <Row label="Corps" hint="Hausse · baisse">
            <UpDownPickers label="Corps des bougies" up={up} down={down} onUp={p.setUpColorOverride} onDown={p.setDownColorOverride} disabled={theme.isEink} />
          </Row>
          <Row label="Bordures" hint="Hausse · baisse">
            <UpDownPickers
              label="Bordures des bougies"
              up={chartStyle.borderUpColor ?? up}
              down={chartStyle.borderDownColor ?? down}
              onUp={(c) => set({ borderUpColor: c })}
              onDown={(c) => set({ borderDownColor: c })}
              disabled={theme.isEink}
            />
          </Row>
          <Row label="Mèches" hint="Hausse · baisse">
            <UpDownPickers
              label="Mèches des bougies"
              up={chartStyle.wickUpColor ?? up}
              down={chartStyle.wickDownColor ?? down}
              onUp={(c) => set({ wickUpColor: c })}
              onDown={(c) => set({ wickDownColor: c })}
              disabled={theme.isEink}
            />
          </Row>
          {anyColor && (
            <div className="lq-chart-settings__row lq-chart-settings__row--action">
              <button
                type="button"
                className="lq-chart-settings__link"
                onClick={() => {
                  p.setUpColorOverride(undefined);
                  p.setDownColorOverride(undefined);
                  set({ wickUpColor: undefined, wickDownColor: undefined, borderUpColor: undefined, borderDownColor: undefined });
                }}
              >
                Revenir aux couleurs du thème
              </button>
            </div>
          )}
          <Row
            label="Onde du dernier cours"
            hint={p.chartDisplayMode === "line" ? "Une onde à chaque nouveau cours, en direct ou en replay" : "Seulement en mode Ligne"}
            disabled={p.chartDisplayMode !== "line"}
          >
            <Toggle checked={p.closePulseVisible} onChange={() => p.setClosePulseVisible(!p.closePulseVisible)} ariaLabel="Onde sur le dernier point de la ligne" disabled={p.chartDisplayMode !== "line"} />
          </Row>
        </Section>
        {p.showCandleColorRules && (
          <section className="lq-chart-settings__section">
            <CandleColorRulesEditor rules={p.candleColorRules} indicators={p.candleRuleIndicators} onChange={p.setCandleColorRules} />
          </section>
        )}
      </>
    );
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
            <ColorPicker
              value={chartStyle.lastPriceLineColor ?? theme.up}
              onChange={(c) => set({ lastPriceLineColor: c })}
              disabled={!lastLine}
              aria-label="Couleur de la ligne du dernier prix"
              title={chartStyle.lastPriceLineColor ? undefined : "Couleur de hausse ou de baisse"}
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
    const numberField = (key: "marginTop" | "marginBottom" | "marginRightBars", label: string, unit: string, def: number | undefined, max: number) => (
      <Row label={label}>
        <span className="lq-chart-settings__number">
          <input
            type="number"
            min={0}
            max={max}
            step={1}
            value={chartStyle[key] ?? def ?? ""}
            placeholder={def === undefined ? "Auto" : undefined}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") return set({ [key]: undefined });
              const n = Math.max(0, Math.min(max, Math.round(Number(raw))));
              set({ [key]: Number.isFinite(n) && n !== def ? n : undefined });
            }}
            aria-label={label}
          />
          <span>{unit}</span>
        </span>
      </Row>
    );
    const touched = CANVAS_STYLE_KEYS.some((k) => chartStyle[k] !== undefined);
    return (
      <>
        {advancedAppearance && (
          <>
            <Section title="Fond">
              <Row label="Fond du graphique">
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
                <ColorPicker value={chartStyle.backgroundColor ?? tc.bg} onChange={(c) => set({ backgroundColor: c })} aria-label="Couleur du fond" />
                {gradient && (
                  <ColorPicker value={chartStyle.backgroundColor2 ?? tc.bg} onChange={(c) => set({ backgroundColor2: c, backgroundColor: chartStyle.backgroundColor ?? tc.bg })} aria-label="Couleur du bas du dégradé" />
                )}
              </Row>
            </Section>
            <Section title="Grille">
              <Row label="Lignes verticales">
                {lineStyleSelect(chartStyle.vertGridStyle ?? "dashed", (v) => set({ vertGridStyle: v }), "Style de la grille verticale", !vert)}
                <ColorPicker value={chartStyle.vertGridColor ?? tc.grid} onChange={(c) => set({ vertGridColor: c })} disabled={!vert} aria-label="Couleur de la grille verticale" />
                <Toggle checked={vert} onChange={() => set({ vertGridVisible: vert ? undefined : true })} ariaLabel="Grille verticale" />
              </Row>
              <Row label="Lignes horizontales">
                {lineStyleSelect(chartStyle.horzGridStyle ?? "dashed", (v) => set({ horzGridStyle: v }), "Style de la grille horizontale", !horz)}
                <ColorPicker value={chartStyle.horzGridColor ?? tc.grid} onChange={(c) => set({ horzGridColor: c })} disabled={!horz} aria-label="Couleur de la grille horizontale" />
                <Toggle checked={horz} onChange={() => set({ horzGridVisible: horz ? false : undefined })} ariaLabel="Grille horizontale" />
              </Row>
              <Row label="Séparateurs des panneaux">
                <ColorPicker value={chartStyle.paneSeparatorColor ?? tc.grid} onChange={(c) => set({ paneSeparatorColor: c })} aria-label="Couleur des séparateurs des panneaux" />
              </Row>
            </Section>
            <Section title="Réticule">
              <Row label="Lignes du réticule" hint="Style, couleur et épaisseur">
                {lineStyleSelect(chartStyle.crosshairStyle ?? "dashed", (v) => set({ crosshairStyle: v }), "Style du réticule")}
                <ColorPicker
                  value={chartStyle.crosshairColor ?? tc.muted}
                  onChange={(c) => set({ crosshairColor: c })}
                  thickness={chartStyle.crosshairWidth ?? 1}
                  onThicknessChange={(w) => set({ crosshairWidth: w === 1 ? undefined : w })}
                  aria-label="Couleur du réticule"
                />
              </Row>
            </Section>
            <Section title="Échelles">
              <Row label="Texte">
                <Select<string>
                  size="small"
                  className="lq-chart-settings__select"
                  options={[{ value: "", label: "Auto" }, ...TEXT_SIZE_OPTIONS]}
                  value={chartStyle.scaleTextSize ? String(chartStyle.scaleTextSize) : ""}
                  onChange={(v) => set({ scaleTextSize: v ? Number(v) : undefined })}
                  ariaLabel="Taille du texte des échelles"
                />
                <ColorPicker value={chartStyle.scaleTextColor ?? tc.muted} onChange={(c) => set({ scaleTextColor: c })} aria-label="Couleur du texte des échelles" />
              </Row>
              <Row label="Lignes">
                <ColorPicker value={chartStyle.scaleLineColor ?? tc.grid} onChange={(c) => set({ scaleLineColor: c })} aria-label="Couleur des lignes des échelles" />
              </Row>
            </Section>
            <Section title="Marges">
              {numberField("marginTop", "Haut", "%", 8, 60)}
              {numberField("marginBottom", "Bas", "%", 8, 60)}
              {numberField("marginRightBars", "Droite", "bougies", undefined, 200)}
            </Section>
          </>
        )}
        {p.watermarkAvailable && (
          <Section title="Filigrane">
            <Row label="Nom du symbole en fond">
              <Toggle checked={p.watermark.visible} onChange={() => p.setWatermark({ ...p.watermark, visible: !p.watermark.visible })} ariaLabel="Nom du symbole en filigrane" />
            </Row>
            {p.watermark.visible && (
              <>
                <Row label="Opacité">
                  <span className="lq-chart-settings__range">
                    <input type="range" min={2} max={40} step={1} value={Math.round(p.watermark.opacity * 100)} onChange={(e) => p.setWatermark({ ...p.watermark, opacity: Number(e.target.value) / 100 })} aria-label="Opacité du filigrane" />
                    <span>{Math.round(p.watermark.opacity * 100)} %</span>
                  </span>
                </Row>
                <Row label="Taille">
                  <span className="lq-chart-settings__range">
                    <input type="range" min={30} max={150} step={5} value={Math.round(p.watermark.size ?? 100)} onChange={(e) => p.setWatermark({ ...p.watermark, size: Number(e.target.value) })} aria-label="Taille du filigrane" />
                    <span>{Math.round(p.watermark.size ?? 100)} %</span>
                  </span>
                </Row>
              </>
            )}
          </Section>
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
              onClick={() => set(Object.fromEntries(CANVAS_STYLE_KEYS.map((k) => [k, undefined])) as Partial<ChartStyleSettings>)}
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
      style: p.chartStyle,
    };
    p.setStyleTemplates(existing ? p.styleTemplates.map((t) => (t.id === existing.id ? template : t)) : [...p.styleTemplates, template]);
    setName("");
    setNaming(false);
    setOpen(false);
  };
  const apply = (t: ChartStyleTemplate | null) => {
    p.setChartStyle(t?.style ?? {});
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
