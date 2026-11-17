import { Fragment, useId, type ReactNode } from "react";
import { ColorPicker } from "../../../forms/ColorPicker";
import { Checkbox } from "../../../forms/Checkbox";
import { IndicatorStyleRulesEditor } from "./IndicatorStyleRulesEditor";
import { IndicatorAreaFillsEditor } from "./IndicatorAreaFillsEditor";
import { IndicatorWatermarkField } from "./IndicatorWatermarkField";
import { InputNumber } from "../../../forms/InputNumber";
import { Input } from "../../../forms/Input";
import { EXPECTED_VOLATILITY_DEFAULTS as EV, EXPECTED_VOLATILITY_TIMEFRAMES } from "../expectedVolatility";
import { RANGE_DETECTION_DEFAULTS as RD } from "../rangeDetection";
import { SR_BOUNCE_DEFAULTS as SRB } from "../srBounce";
import { DONCHIAN_LINE_KEYS, DONCHIAN_LINE_LABELS, DONCHIAN_LINE_DEFAULTS, DONCHIAN_BACKGROUND_DEFAULT, resolveDonchianBackground, resolveDonchianLine } from "../donchian";
import type { DonchianLineKey, IndicatorLineStyle } from "../interfaces/IndicatorLineStyle.interface";
import { isRsiKind, resolveRsiZoneLine, rsiZonesActive, RSI_ZONE_LINE_DEFAULTS, RSI_ZONE_LINE_KEYS, RSI_ZONE_LINE_LABELS, RSI_ZONES_DEFAULT_PEAKS } from "../rsiZones";
import type { RsiZoneLineKey, RsiZoneLineStyle } from "../interfaces/RsiZoneLine.interface";
import { Select, type SelectOption } from "../../../forms/Select";
import type { Indicator } from "../interfaces/Indicator.interface";
import { indicatorCatalogEntry, indicatorLabel, isFundamentalKind, defaultIndicatorColor, RSI_LEVEL_COLOR, RSI_MIDDLE_COLOR } from "../indicatorCatalog";
import { toDateInputValue, fromDateInputValue, normalizeValueFormat, formatWithValueFormat } from "../formatting";
import type { ValueFormat } from "../interfaces/ValueFormat.interface";
import { supportsProjection, DEFAULT_PROJECTION, type IndicatorProjectionMethod } from "../indicatorProjection";
import { DefaultValue, SettingCheckRow, SettingRow, SettingsSection, indicatorDefaults } from "./IndicatorSettingsLayout";

export interface IndicatorSettingsFieldsProps {
  indicatorDraft: Indicator;
  setIndicatorDraft: (d: Indicator) => void;
  indicators: Indicator[];
  /** Rubrique « Zones remplies » (onglet Style). Faux : elle n'apparaît pas (fonctionnalité hors de l'offre, voir
   *  `CandlestickChartProps.showAreaFills`). Défaut vrai. */
  showAreaFills?: boolean;
  /** « Règles liées » du style conditionnel : réécrit les règles d'un autre indicateur (voir IndicatorStyleRulesEditor). */
  onChangeOwnerRules?: (ownerId: string, rules: NonNullable<Indicator["styleRules"]>) => void;
  /** Ouvre les paramètres d'un autre indicateur (lien « Ouvrir SMA(50) »). */
  onOpenIndicator?: (id: string) => void;
}

/** Couleurs « hausse / baisse » par défaut des indicateurs qui se colorent selon la tendance. */
const UP = "#26a69a";
const DOWN = "#ef5350";

/** Un réglage numérique : libellé à gauche, champ compact à droite (unité dans le champ), et la valeur par défaut
 *  visible dès qu'on s'en écarte, qui la rétablit d'un clic. L'unité suit le champ. Un champ vidé ne change rien : c'est un état de saisie. */
function NumberSetting({
  label,
  value,
  def,
  min,
  max,
  step = 1,
  suffix,
  hint,
  onSet,
}: {
  label: string;
  value: number | undefined;
  def: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: ReactNode;
  onSet: (v: number) => void;
}) {
  const id = useId();
  const current = value ?? def;
  return (
    <SettingRow label={label} htmlFor={id} hint={hint} trailing={<DefaultValue value={current} defaultValue={def} onReset={() => onSet(def)} />}>
      <span className="lq-ind-settings__number">
        <InputNumber id={id} min={min} max={max} step={step} value={current} onChange={(v) => v !== "" && onSet(v)} />
      </span>
      {/* L'unité après le champ plutôt que dedans : tous les champs gardent leurs boutons + / − et la même largeur. */}
      {suffix && <span className="lq-ind-settings__unit">{suffix}</span>}
    </SettingRow>
  );
}

/** Un menu dans la grille : libellé à gauche, menu à droite. */
function SelectSetting<T extends string>({ label, value, options, onChange, hint, wide }: { label: string; value: T; options: SelectOption<T>[]; onChange: (v: T) => void; hint?: ReactNode; wide?: boolean }) {
  return (
    <SettingRow label={label} hint={hint} wide={wide}>
      <span className="lq-ind-settings__select">
        <Select<T> ariaLabel={label} value={value} options={options} onChange={onChange} />
      </span>
    </SettingRow>
  );
}

/** Fuseaux proposés sous le champ « Fuseau horaire » (« Vol. jour ATR ») ; tout autre nom IANA s'y tape aussi. */
const COMMON_TIME_ZONES = ["Europe/Paris", "Europe/London", "UTC", "America/New_York", "America/Chicago", "Asia/Tokyo", "Asia/Hong_Kong", "Australia/Sydney"];

/** Le fuseau de la journée de « Vol. jour ATR » : un nom IANA libre, comme l'entrée texte du script Pine. */
function TimeZoneSetting({ value, onSet }: { value: string | undefined; onSet: (v: string) => void }) {
  const id = useId();
  return (
    <SettingRow label="Fuseau horaire de la journée (00:00 → 23:59)" htmlFor={id} hint="Nom IANA, par exemple Europe/Paris. Un nom inconnu compte en UTC." wide>
      <Input id={id} size="small" list={`${id}-tz`} value={value ?? EV.timeZone} onChange={(e) => onSet(e.target.value)} />
      <datalist id={`${id}-tz`}>
        {COMMON_TIME_ZONES.map((tz) => (
          <option key={tz} value={tz} />
        ))}
      </datalist>
    </SettingRow>
  );
}

/** The settings modal's "Entrées" tab (see IndicatorModals.tsx) — period/stdDev plus every indicator's own bespoke
 *  inputs (MACD's three periods, ZigZag's deviation, Ichimoku's four periods, TPO's five settings, RSI/CHOP's own
 *  reference thresholds, ADX's trend threshold, correlation's own "strongly correlated" cutoff, a fundamental's
 *  value/YoY display mode…), each gated on `indicatorDraft.kind`. Rangés en sections courtes : « Calcul », « Seuils »,
 *  « Projection ». `leading` : ce qui passe avant (les paramètres d'un script). */
export function IndicatorSettingsInputs({ indicatorDraft: d, setIndicatorDraft, leading, emptyText }: IndicatorSettingsFieldsProps & { leading?: ReactNode; emptyText?: ReactNode }) {
  const set = (patch: Partial<Indicator>) => setIndicatorDraft({ ...d, ...patch });
  const entry = indicatorCatalogEntry(d);
  const defaults = indicatorDefaults(d);

  const calc: ReactNode[] = [];
  // Indicateur de zones : fenêtre de temps élargie (ou rétrécie) autour de celle que fournit l'application.
  if (d.customData?.draw === "zones") {
    calc.push(
      <NumberSetting key="zb" label="Marge avant" suffix="h" min={-168} max={168} value={d.zonePadBeforeHours} def={0} onSet={(v) => set({ zonePadBeforeHours: v === 0 ? undefined : v })} />,
      <NumberSetting key="za" label="Marge après" suffix="h" min={-168} max={168} value={d.zonePadAfterHours} def={0} onSet={(v) => set({ zonePadAfterHours: v === 0 ? undefined : v })} />
    );
  }
  if (entry.hasPeriod) {
    calc.push(<NumberSetting key="period" label="Période" suffix="bougies" min={1} max={500} value={d.period} def={defaults.period} onSet={(v) => set({ period: v })} />);
  }
  if (d.kind === "donchian") {
    calc.push(
      <NumberSetting
        key="dco"
        label="Décalage"
        suffix="bougies"
        min={-500}
        max={500}
        value={d.donchianOffset}
        def={0}
        hint="Déplace les canaux vers la droite (positif) ou vers la gauche (négatif) par rapport aux bougies."
        onSet={(v) => set({ donchianOffset: v === 0 ? undefined : v })}
      />
    );
  }
  // Lignes de zones (moyenne et extrême des derniers pics) : toujours sur « rsiZones », sur option pour le RSI.
  if (d.kind === "rsi") {
    calc.push(
      <SettingCheckRow key="rzon">
        <Checkbox
          label="Lignes de surachat et de survente calculées (moyenne et extrême des derniers pics)"
          checked={d.rsiZonesEnabled === true}
          onChange={(checked) => set({ rsiZonesEnabled: checked ? true : undefined })}
        />
      </SettingCheckRow>
    );
  }
  if (rsiZonesActive(d)) {
    calc.push(
      <NumberSetting
        key="rzl"
        label="Nombre de pics pris en compte"
        suffix="pics"
        min={1}
        max={500}
        value={d.rsiZonesPeaks}
        def={RSI_ZONES_DEFAULT_PEAKS}
        hint="Les derniers passages au-dessus du seuil de surachat (leur pic) et sous le seuil de survente (leur creux) dont on prend la moyenne et l'extrême."
        onSet={(v) => set({ rsiZonesPeaks: v })}
      />
    );
  }
  if (entry.hasStdDev) {
    calc.push(<NumberSetting key="std" label="Écart-type" suffix="σ" min={0.5} max={5} step={0.1} value={d.stdDev} def={2} onSet={(v) => set({ stdDev: v })} />);
  }
  if (d.kind === "macd") {
    calc.push(
      <NumberSetting key="fast" label="Moyenne rapide" suffix="bougies" min={1} max={200} value={d.fastPeriod} def={12} onSet={(v) => set({ fastPeriod: v })} />,
      <NumberSetting key="slow" label="Moyenne lente" suffix="bougies" min={1} max={400} value={d.slowPeriod} def={26} onSet={(v) => set({ slowPeriod: v })} />,
      <NumberSetting key="signal" label="Signal" suffix="bougies" min={1} max={200} value={d.signalPeriod} def={9} onSet={(v) => set({ signalPeriod: v })} />
    );
  }
  if (d.kind === "zigzag") {
    calc.push(<NumberSetting key="zz" label="Déviation" suffix="%" min={0.5} max={50} step={0.5} value={d.zigzagDeviation} def={5} onSet={(v) => set({ zigzagDeviation: v })} />);
  }
  if (d.kind === "supertrend") {
    calc.push(<NumberSetting key="st" label="Multiplicateur" suffix="× ATR" min={0.5} max={10} step={0.5} value={d.supertrendMultiplier} def={3} onSet={(v) => set({ supertrendMultiplier: v })} />);
  }
  if (d.kind === "chandelierExit") {
    calc.push(
      <NumberSetting key="ce" label="Multiplicateur" suffix="× ATR" min={0.5} max={10} step={0.1} value={d.chandelierMultiplier} def={3} onSet={(v) => set({ chandelierMultiplier: v })} />,
      <SettingCheckRow key="ceclose">
        <Checkbox label="Extrêmes sur les clôtures" checked={d.chandelierUseClose ?? true} onChange={(checked) => set({ chandelierUseClose: checked })} />
      </SettingCheckRow>
    );
  }
  if (d.kind === "parabolicSar") {
    calc.push(
      <NumberSetting key="sarstep" label="Pas" min={0.01} max={1} step={0.01} value={d.sarStep} def={0.02} onSet={(v) => set({ sarStep: v })} />,
      <NumberSetting key="sarmax" label="Maximum" min={0.05} max={1} step={0.05} value={d.sarMax} def={0.2} onSet={(v) => set({ sarMax: v })} />
    );
  }
  if (d.kind === "gaps") {
    calc.push(<NumberSetting key="gaps" label="Écart minimum" suffix="%" min={0} max={20} step={0.1} value={d.gapsMinPercent} def={0.1} onSet={(v) => set({ gapsMinPercent: v })} />);
  }
  if (d.kind === "pivotPoints") {
    calc.push(
      <SelectSetting
        key="pivottype"
        label="Type"
        value={d.pivotType ?? "classic"}
        onChange={(v) => set({ pivotType: v })}
        options={[
          { value: "classic", label: "Classic" },
          { value: "fibonacci", label: "Fibonacci" },
          { value: "woodie", label: "Woodie" },
          { value: "camarilla", label: "Camarilla" },
        ]}
      />,
      <SelectSetting
        key="pivotperiod"
        label="Période de référence"
        value={d.pivotPeriod ?? "weekly"}
        onChange={(v) => set({ pivotPeriod: v })}
        options={[
          { value: "daily", label: "Journalière" },
          { value: "weekly", label: "Hebdomadaire" },
          { value: "monthly", label: "Mensuelle" },
        ]}
      />
    );
  }
  if (d.kind === "expectedVolatility") {
    calc.push(
      <NumberSetting key="evatr" label="Période de l'ATR" suffix="bougies" min={1} max={500} value={d.period} def={EV.atrPeriod} onSet={(v) => set({ period: v })} />,
      <NumberSetting key="evsma" label="Période de la SMA de l'ATR" suffix="bougies" min={1} max={500} value={d.expVolSmaPeriod} def={EV.smaPeriod} onSet={(v) => set({ expVolSmaPeriod: v })} />,
      <SelectSetting
        key="evtf"
        label="Échelle de temps de l'ATR (et durée des lignes)"
        value={d.expVolTimeframe ?? EV.timeframe}
        onChange={(v) => set({ expVolTimeframe: v })}
        options={EXPECTED_VOLATILITY_TIMEFRAMES}
        wide
      />,
      <TimeZoneSetting key="evtz" value={d.expVolTimeZone} onSet={(v) => set({ expVolTimeZone: v })} />,
      <NumberSetting key="evn" label="Nombre de séances affichées" min={1} max={60} value={d.expVolSessions} def={EV.sessions} onSet={(v) => set({ expVolSessions: v })} />
    );
  }
  if (d.kind === "rangeDetection") {
    calc.push(
      <NumberSetting key="rdchop" label="Période du CHOP" suffix="bougies" min={2} max={200} value={d.period} def={RD.chopPeriod} onSet={(v) => set({ period: v })} />,
      <NumberSetting key="rdatr" label="Période de l'ATR" suffix="bougies" min={1} max={200} value={d.rangeAtrPeriod} def={RD.atrPeriod} onSet={(v) => set({ rangeAtrPeriod: v })} />,
      <NumberSetting key="rdlb" label="Fenêtre de comparaison de la volatilité" suffix="bougies" min={20} max={1000} value={d.rangeVolLookback} def={RD.volLookback} onSet={(v) => set({ rangeVolLookback: v })} />,
      <NumberSetting key="rdvf" label="Moyenne courte du volume" suffix="bougies" min={1} max={200} value={d.rangeVolumeFast} def={RD.volumeFast} onSet={(v) => set({ rangeVolumeFast: v })} />,
      <NumberSetting key="rdvs" label="Moyenne longue du volume" suffix="bougies" min={2} max={500} value={d.rangeVolumeSlow} def={RD.volumeSlow} onSet={(v) => set({ rangeVolumeSlow: v })} />,
      <NumberSetting key="rdsl" label="Écart des pentes (précocité)" suffix="bougies" min={1} max={20} value={d.rangeSlopeBars} def={RD.slopeBars} hint="Plus court : détection plus précoce, mais plus de fausses alertes." onSet={(v) => set({ rangeSlopeBars: v })} />
    );
  }
  if (d.kind === "srBounce") {
    calc.push(
      <NumberSetting key="srbp" label="Bougies analysées" suffix="bougies" min={30} max={2000} value={d.period} def={SRB.lookback} hint="La fenêtre dans laquelle les zones sont cherchées et leurs contacts passés comptés." onSet={(v) => set({ period: v })} />,
      <NumberSetting key="srbz" label="Nombre de zones" min={1} max={20} value={d.srbMaxZones} def={SRB.maxZones} hint="Les zones les plus proches du prix sont gardées." onSet={(v) => set({ srbMaxZones: v })} />,
      <NumberSetting key="srbs" label="Largeur des pivots" suffix="bougies" min={1} max={10} value={d.srbSwingSpan} def={SRB.swingSpan} hint="Un sommet (ou un creux) doit dépasser ce nombre de bougies de chaque côté." onSet={(v) => set({ srbSwingSpan: v })} />,
      <NumberSetting key="srbh" label="Horizon d'un contact" suffix="bougies" min={2} max={60} value={d.srbHorizon} def={SRB.horizon} hint="Délai laissé au prix, après un contact passé, pour rebondir d'1 ATR ou casser la zone." onSet={(v) => set({ srbHorizon: v })} />,
      <NumberSetting key="srba" label="Période de l'ATR" suffix="bougies" min={2} max={200} value={d.srbAtrPeriod} def={SRB.atrPeriod} onSet={(v) => set({ srbAtrPeriod: v })} />,
      <NumberSetting key="srbx" label="Période de l'ADX" suffix="bougies" min={2} max={200} value={d.srbAdxPeriod} def={SRB.adxPeriod} onSet={(v) => set({ srbAdxPeriod: v })} />,
      <NumberSetting key="srbe" label="Période de l'EMA" suffix="bougies" min={2} max={500} value={d.srbEmaPeriod} def={SRB.emaPeriod} onSet={(v) => set({ srbEmaPeriod: v })} />,
      <NumberSetting key="srbm" label="Période de la SMA" suffix="bougies" min={2} max={500} value={d.srbSmaPeriod} def={SRB.smaPeriod} onSet={(v) => set({ srbSmaPeriod: v })} />,
      <NumberSetting key="srbl" label="Période de la SMA longue" suffix="bougies" min={2} max={1000} value={d.srbSmaLongPeriod} def={SRB.smaLongPeriod} onSet={(v) => set({ srbSmaLongPeriod: v })} />,
      <NumberSetting key="srbb" label="Période de Bollinger" suffix="bougies" min={2} max={500} value={d.srbBbPeriod} def={SRB.bbPeriod} onSet={(v) => set({ srbBbPeriod: v })} />,
      <NumberSetting key="srbd" label="Écart-type de Bollinger" suffix="σ" min={0.5} max={5} step={0.1} value={d.srbBbStdDev} def={SRB.bbStdDev} onSet={(v) => set({ srbBbStdDev: v })} />
    );
  }
  if (d.kind === "supportResistance") {
    calc.push(<NumberSetting key="sr" label="Nombre de niveaux" min={1} max={20} value={d.srMaxLevels} def={6} onSet={(v) => set({ srMaxLevels: v })} />);
  }
  if (d.kind === "patternRecognition" || d.kind === "candleRecognition") {
    calc.push(<RecognitionDateRow key="date" indicatorDraft={d} set={set} />);
  }
  if (d.kind === "ichimoku") {
    calc.push(
      <NumberSetting key="ic" label="Conversion" suffix="bougies" min={1} max={100} value={d.ichimokuConversionPeriod} def={9} onSet={(v) => set({ ichimokuConversionPeriod: v })} />,
      <NumberSetting key="ib" label="Base" suffix="bougies" min={1} max={200} value={d.ichimokuBasePeriod} def={26} onSet={(v) => set({ ichimokuBasePeriod: v })} />,
      <NumberSetting key="is" label="Span B" suffix="bougies" min={1} max={300} value={d.ichimokuSpanPeriod} def={52} onSet={(v) => set({ ichimokuSpanPeriod: v })} />,
      <NumberSetting key="id" label="Déplacement" suffix="bougies" min={1} max={200} value={d.ichimokuDisplacement} def={26} onSet={(v) => set({ ichimokuDisplacement: v })} />
    );
  }
  if (d.kind === "tpo") {
    calc.push(
      <NumberSetting key="tb" label="Taille du bloc" suffix="min" min={1} max={1440} step={5} value={d.tpoBlockMinutes} def={30} onSet={(v) => set({ tpoBlockMinutes: v })} />,
      <NumberSetting key="tr" label="Lignes de prix" min={5} max={100} value={d.tpoRowCount} def={24} onSet={(v) => set({ tpoRowCount: v })} />,
      <NumberSetting key="tv" label="Zone de valeur" suffix="%" min={1} max={100} value={d.tpoValueAreaPercent} def={70} onSet={(v) => set({ tpoValueAreaPercent: v })} />,
      <SelectSetting
        key="tl"
        label="Étiquettes"
        value={d.tpoLabelStyle ?? "letters"}
        onChange={(v) => set({ tpoLabelStyle: v })}
        options={[
          { value: "letters", label: "Lettres" },
          { value: "numbers", label: "Chiffres" },
        ]}
      />
    );
  }
  if (isFundamentalKind(d.kind)) {
    calc.push(
      <SelectSetting
        key="fund"
        label="Valeur affichée"
        value={d.fundamentalDisplayMode ?? "value"}
        onChange={(v) => set({ fundamentalDisplayMode: v })}
        options={[
          { value: "value", label: "Valeur" },
          { value: "yoyChange", label: "Variation sur 1 an (%)" },
        ]}
      />
    );
  }

  const thresholds: ReactNode[] = [];
  if (isRsiKind(d.kind)) {
    thresholds.push(
      <NumberSetting key="ob" label="Surachat" min={50} max={99} value={d.rsiOverbought} def={70} onSet={(v) => set({ rsiOverbought: v })} />,
      <NumberSetting key="os" label="Survente" min={1} max={50} value={d.rsiOversold} def={30} onSet={(v) => set({ rsiOversold: v })} />
    );
  }
  if (d.kind === "chop") {
    thresholds.push(
      <NumberSetting key="cu" label="Haut (marché indécis)" min={50} max={99} step={0.1} value={d.chopUpperThreshold} def={61.8} onSet={(v) => set({ chopUpperThreshold: v })} />,
      <NumberSetting key="cl" label="Bas (directionnel)" min={1} max={50} step={0.1} value={d.chopLowerThreshold} def={38.2} onSet={(v) => set({ chopLowerThreshold: v })} />
    );
  }
  if (d.kind === "rangeDetection") {
    thresholds.push(
      <NumberSetting key="rdce" label="CHOP : début de range (s'il monte)" min={30} max={90} step={0.1} value={d.rangeChopEarly} def={RD.chopEarly} onSet={(v) => set({ rangeChopEarly: v })} />,
      <NumberSetting key="rdcc" label="CHOP : range établi" min={40} max={99} step={0.1} value={d.rangeChopConfirm} def={RD.chopConfirm} onSet={(v) => set({ rangeChopConfirm: v })} />,
      <NumberSetting key="rdct" label="CHOP : tendance franche (aucun range) sous" min={1} max={50} step={0.1} value={d.rangeChopTrend} def={RD.chopTrend} onSet={(v) => set({ rangeChopTrend: v })} />,
      <NumberSetting key="rdvp" label="Volatilité contractée sous le centile" suffix="%" min={5} max={60} value={d.rangeVolPercentile} def={RD.volPercentile} onSet={(v) => set({ rangeVolPercentile: v })} />,
      <NumberSetting key="rdbo" label="Cassure au-delà de" suffix="× ATR" min={0} max={5} step={0.1} value={d.rangeBreakoutAtr} def={RD.breakoutAtr} onSet={(v) => set({ rangeBreakoutAtr: v })} />,
      <NumberSetting key="rdgr" label="Bougies sans signal tolérées" min={0} max={30} value={d.rangeGraceBars} def={RD.graceBars} onSet={(v) => set({ rangeGraceBars: v })} />,
      <NumberSetting key="rdmin" label="Durée minimale d'une zone terminée" suffix="bougies" min={1} max={100} value={d.rangeMinBars} def={RD.minBars} onSet={(v) => set({ rangeMinBars: v })} />
    );
  }
  if (d.kind === "adx") {
    thresholds.push(<NumberSetting key="adx" label="Tendance forte" min={5} max={60} value={d.adxThreshold} def={25} onSet={(v) => set({ adxThreshold: v })} />);
  }
  if (d.kind === "correlation") {
    thresholds.push(
      <NumberSetting key="corr" label="Corrélation forte" min={0.1} max={1} step={0.05} value={d.correlationStrongThreshold} def={0.7} onSet={(v) => set({ correlationStrongThreshold: v })} />
    );
  }

  const projection = supportsProjection(d);
  if (calc.length === 0 && thresholds.length === 0 && !projection && !leading) {
    return <p className="lq-ind-settings__empty">Cet indicateur n&apos;a pas de paramètres de calcul.</p>;
  }

  return (
    <div className="lq-ind-settings">
      {leading}
      {emptyText && !leading && calc.length === 0 && thresholds.length === 0 && !projection && <p className="lq-ind-settings__empty">{emptyText}</p>}
      {calc.length > 0 && <SettingsSection title="Calcul">{calc}</SettingsSection>}
      {thresholds.length > 0 && <SettingsSection title="Seuils">{thresholds}</SettingsSection>}
      {/* Projection. Last on purpose: it does not describe the indicator, it describes a guess about where the
          indicator is going. Only for the kinds whose values are a level that continues — see `supportsProjection`. */}
      {projection && <ProjectionSection indicatorDraft={d} set={set} />}
    </div>
  );
}

function RecognitionDateRow({ indicatorDraft: d, set }: { indicatorDraft: Indicator; set: (patch: Partial<Indicator>) => void }) {
  const id = useId();
  return (
    <SettingRow
      label="Date limite"
      htmlFor={id}
      hint={d.recognitionDateLimit ? undefined : "Par défaut : la dernière bougie, actualisée chaque jour."}
      trailing={
        d.recognitionDateLimit && (
          <button type="button" className="lq-ind-settings__default" onClick={() => set({ recognitionDateLimit: undefined })}>
            dernière bougie
          </button>
        )
      }
    >
      <input
        id={id}
        type="date"
        className="lq-chart__date-input lq-ind-settings__date"
        value={d.recognitionDateLimit ? toDateInputValue(d.recognitionDateLimit) : ""}
        onChange={(e) => set({ recognitionDateLimit: e.target.value ? fromDateInputValue(e.target.value, new Date()) : undefined })}
      />
    </SettingRow>
  );
}

function ProjectionSection({ indicatorDraft: d, set }: { indicatorDraft: Indicator; set: (patch: Partial<Indicator>) => void }) {
  const method = d.projectionMethod ?? DEFAULT_PROJECTION.method;
  return (
    <SettingsSection
      title="Projection"
      help="Prolonge les lignes de l'indicateur au-delà de la dernière bougie, en pointillés. C'est une extrapolation de ses propres valeurs passées, pas une prévision de marché."
    >
      <SettingCheckRow>
        <Checkbox checked={d.projection === true} onChange={(checked) => set({ projection: checked })} label="Prolonger l'indicateur en pointillés" />
      </SettingCheckRow>
      {d.projection === true && (
        <>
          <SelectSetting<IndicatorProjectionMethod>
            label="Méthode"
            value={method}
            onChange={(v) => set({ projectionMethod: v })}
            hint={METHOD_NOTES[method]}
            wide
            options={[
              { value: "linear", label: "Régression linéaire" },
              { value: "drift", label: "Dérive (pas moyen)" },
              { value: "holt", label: "Lissage de Holt (tendance)" },
              { value: "flat", label: "Dernière valeur tenue" },
            ]}
          />
          <NumberSetting label="Bougies projetées" min={1} max={200} value={d.projectionBars} def={DEFAULT_PROJECTION.bars} onSet={(v) => set({ projectionBars: v })} />
          <NumberSetting label="Historique utilisé" suffix="bougies" min={2} max={500} value={d.projectionLookback} def={DEFAULT_PROJECTION.lookback} onSet={(v) => set({ projectionLookback: v })} />
          {method !== "flat" && (
            <NumberSetting
              label="Amortissement"
              min={0}
              max={1}
              step={0.05}
              value={d.projectionDamping}
              def={DEFAULT_PROJECTION.damping}
              onSet={(v) => set({ projectionDamping: v })}
              hint="1 garde toute la pente, 0 l'abandonne tout de suite ; entre les deux, la projection s'aplatit peu à peu."
            />
          )}
        </>
      )}
    </SettingsSection>
  );
}

/** What each method actually reads, and where each one is wrong. Shown under the picker rather than behind a
 *  tooltip: choosing between four extrapolations is not a choice anyone can make from four names. */
const METHOD_NOTES: Record<IndicatorProjectionMethod, string> = {
  linear: "Droite des moindres carrés sur l'historique retenu, prolongée. Suit bien une pente régulière, dépasse une courbe qui s'aplatit déjà.",
  drift: "Dernière valeur, plus le pas moyen de l'historique. Plus calme que la régression : ancrée sur le dernier point plutôt que sur une droite ajustée.",
  holt: "Un niveau et une tendance remis à jour bougie après bougie : le passé récent pèse plus. À prendre quand la série a changé de régime.",
  flat: "Tient la dernière valeur. Sur une série bornée qui revient vers sa moyenne (RSI, CHOP, ADX), c'est souvent la meilleure référence.",
};

/** Une ligne du tableau « Tracé » : case de visibilité (si l'élément peut se masquer), nom, pastille(s) de couleur. */
interface TraceRowProps {
  name: ReactNode;
  visible?: { checked: boolean; onChange: (checked: boolean) => void };
  colors: { label?: string; value: string; onChange: (color: string) => void; thickness?: number; onThicknessChange?: (width: number) => void }[];
  /** Une ligne secondaire, en retrait (un réglage propre à cet élément : croisement…). */
  sub?: boolean;
  children?: ReactNode;
}

function TraceRow({ name, visible, colors, sub = false, children }: TraceRowProps) {
  const text = typeof name === "string" ? name : "l'élément";
  return (
    <div className={["lq-ind-settings__trace-row", sub && "lq-ind-settings__trace-row--sub"].filter(Boolean).join(" ")} role="row">
      <span className="lq-ind-settings__trace-check" role="cell">
        {visible && <Checkbox checked={visible.checked} onChange={visible.onChange} ariaLabel={`Afficher ${text}`} />}
      </span>
      <span className="lq-ind-settings__trace-name" role="cell">
        {name}
      </span>
      <span className="lq-ind-settings__trace-colors" role="cell">
        {children}
        {colors.map((c, i) => (
          <span className="lq-ind-settings__swatch" key={i}>
            {c.label && <span className="lq-ind-settings__swatch-label">{c.label}</span>}
            <ColorPicker
              className="lq-chart__color-input"
              value={c.value}
              onChange={c.onChange}
              thickness={c.thickness}
              onThicknessChange={c.onThicknessChange}
              aria-label={`Couleur ${c.label ? `${c.label.toLowerCase()} ` : ""}de ${text}`} />
          </span>
        ))}
      </span>
    </div>
  );
}

/** The settings modal's "Style" tab (see IndicatorModals.tsx) : « Tracé » (une ligne par élément tracé), « Valeurs »
 *  (format des nombres), « Affichage » (légende, libellés, filigrane), puis les couleurs conditionnelles, repliables. */
export function IndicatorSettingsStyle({ indicatorDraft: d, setIndicatorDraft, indicators, showAreaFills = true, onChangeOwnerRules, onOpenIndicator }: IndicatorSettingsFieldsProps) {
  const set = (patch: Partial<Indicator>) => setIndicatorDraft({ ...d, ...patch });
  const entry = indicatorCatalogEntry(d);
  const ownPane = entry.pane !== "price";
  const label = indicatorLabel(d);
  const shown = { checked: d.hidden !== true, onChange: (checked: boolean) => set({ hidden: checked ? undefined : true }) };
  const mainColor = d.color ?? defaultIndicatorColor(indicators.findIndex((i) => i.id === d.id));
  const pair = (upKey: keyof Indicator, downKey: keyof Indicator) => [
    { label: "Hausse", value: (d[upKey] as string | undefined) ?? UP, onChange: (c: string) => set({ [upKey]: c } as Partial<Indicator>) },
    { label: "Baisse", value: (d[downKey] as string | undefined) ?? DOWN, onChange: (c: string) => set({ [downKey]: c } as Partial<Indicator>) },
  ];
  const multi = d.customData?.draw === "multi" ? (d.customData.multiSeries ?? []) : [];

  // --- Tracé ---------------------------------------------------------------------------------------------------
  const trace: ReactNode[] = [];
  if (multi.length > 0) {
    // Plusieurs éléments tracés dans le même panneau (lignes, barres, bandes, points d'un script) : une couleur par
    // élément, sous le nom que le code lui donne ; une ligne peut changer de couleur quand elle croise une autre série.
    multi.forEach((series, i) => {
      const others = multi.filter((o) => o.key !== series.key && o.draw !== "band");
      const cross = d.seriesCross?.[series.key];
      const setCross = (next: { versus: string; above: string; below: string } | null) => {
        const all = { ...d.seriesCross };
        if (next) all[series.key] = next;
        else delete all[series.key];
        set({ seriesCross: all });
      };
      const name = series.label || `Série ${i + 1}`;
      trace.push(
        <TraceRow
          key={series.key}
          name={name}
          visible={i === 0 ? shown : undefined}
          colors={[{ value: d.seriesColors?.[series.key] ?? series.color ?? defaultIndicatorColor(i), onChange: (c) => set({ seriesColors: { ...d.seriesColors, [series.key]: c } }) }]}
        />
      );
      if (series.draw === "line" && others.length > 0) {
        trace.push(
          <TraceRow
            key={`${series.key}-cross`}
            sub
            name={
              <Checkbox
                label="Couleur au croisement"
                checked={cross !== undefined}
                onChange={(checked) => setCross(checked ? { versus: others[0]!.key, above: UP, below: DOWN } : null)}
              />
            }
            colors={
              cross
                ? [
                    { label: "Au-dessus", value: cross.above, onChange: (c) => setCross({ ...cross, above: c }) },
                    { label: "En dessous", value: cross.below, onChange: (c) => setCross({ ...cross, below: c }) },
                  ]
                : []
            }
          >
            {cross && (
              <span className="lq-ind-settings__trace-select">
                <Select
                  size="small"
                  ariaLabel={`Série croisée par ${name}`}
                  value={cross.versus}
                  onChange={(v) => setCross({ ...cross, versus: v })}
                  options={others.map((o) => ({ value: o.key, label: o.label || o.key }))}
                />
              </span>
            )}
          </TraceRow>
        );
      }
    });
  } else if (d.kind === "supertrend") {
    trace.push(<TraceRow key="st" name="Tendance" visible={shown} colors={pair("supertrendUpColor", "supertrendDownColor")} />);
  } else if (d.kind === "parabolicSar") {
    trace.push(<TraceRow key="sar" name="Points" visible={shown} colors={pair("sarUpColor", "sarDownColor")} />);
  } else if (d.kind === "chandelierExit") {
    trace.push(<TraceRow key="ce" name="Stop" visible={shown} colors={pair("chandelierUpColor", "chandelierDownColor")} />);
  } else if (d.kind === "srBounce") {
    trace.push(
      <TraceRow key="srbs" name="Supports (zones sous le prix)" visible={shown} colors={[{ value: d.srbSupportColor ?? SRB.supportColor, onChange: (c) => set({ srbSupportColor: c }) }]} />,
      <TraceRow key="srbr" name="Résistances (zones au-dessus du prix)" colors={[{ value: d.srbResistanceColor ?? SRB.resistanceColor, onChange: (c) => set({ srbResistanceColor: c }) }]} />
    );
  } else if (d.kind === "rangeDetection") {
    trace.push(
      <TraceRow key="rdc" name="Zones de range confirmé" visible={shown} colors={[{ value: mainColor, onChange: (c) => set({ color: c }) }]} />,
      <TraceRow
        key="rdp"
        name="Zones de range probable (détection précoce)"
        visible={{ checked: d.rangeShowProbable ?? RD.showProbable, onChange: (checked) => set({ rangeShowProbable: checked }) }}
        colors={[{ value: d.rangeProbableColor ?? RD.probableColor, onChange: (c) => set({ rangeProbableColor: c }) }]}
      />
    );
  } else if (d.kind === "expectedVolatility") {
    trace.push(
      <TraceRow key="evatr" name="ATR (ouverture ± ATR)" visible={shown} colors={[{ value: mainColor, onChange: (c) => set({ color: c }) }]} />,
      <TraceRow
        key="evsma"
        name="SMA de l'ATR"
        visible={{ checked: d.expVolShowSma ?? EV.showSma, onChange: (checked) => set({ expVolShowSma: checked }) }}
        colors={[{ value: d.expVolSmaColor ?? EV.smaColor, onChange: (c) => set({ expVolSmaColor: c }) }]}
      />,
      <TraceRow
        key="evmed"
        name="Ligne médiane (ouverture de la période)"
        visible={{ checked: d.expVolShowMedian ?? EV.showMedian, onChange: (checked) => set({ expVolShowMedian: checked }) }}
        colors={[{ value: d.expVolMedianColor ?? EV.medianColor, onChange: (c) => set({ expVolMedianColor: c }) }]}
      />
    );
  } else if (d.kind === "donchian") {
    const patchLine = (key: DonchianLineKey, p: IndicatorLineStyle) => set({ donchianLines: { ...d.donchianLines, [key]: { ...d.donchianLines?.[key], ...p } } });
    for (const key of DONCHIAN_LINE_KEYS) {
      const line = resolveDonchianLine(d, key);
      trace.push(
        <TraceRow
          key={`dc-${key}`}
          name={DONCHIAN_LINE_LABELS[key]}
          visible={{ checked: line.show, onChange: (checked) => patchLine(key, { show: checked }) }}
          colors={[{ value: line.color, onChange: (c) => patchLine(key, { color: c }), thickness: line.width, onThicknessChange: (w) => patchLine(key, { width: w }) }]}
        />
      );
    }
    const bg = resolveDonchianBackground(d);
    trace.push(
      <TraceRow
        key="dc-bg"
        name="Fond entre les bandes"
        visible={{ checked: bg.show, onChange: (checked) => set({ donchianBackground: { ...d.donchianBackground, show: checked } }) }}
        colors={[{ value: bg.color, onChange: (c) => set({ donchianBackground: { ...d.donchianBackground, color: c } }) }]}
      />
    );
  } else if (d.kind === "supportResistance" || d.kind === "tpo") {
    trace.push(
      <TraceRow key="own" name={label} visible={shown} colors={[]}>
        <span className="lq-ind-settings__muted">Couleurs propres à l&apos;indicateur</span>
      </TraceRow>
    );
  } else {
    // Une couleur pour tout l'indicateur. ADX la lit pour sa propre ligne (+DI/-DI ont leur paire ci-dessous).
    trace.push(<TraceRow key="main" name={d.kind === "macd" ? "MACD" : d.kind === "adx" ? "ADX" : label} visible={shown} colors={[{ value: mainColor, onChange: (c) => set({ color: c }), thickness: d.lineWidth, onThicknessChange: (w) => set({ lineWidth: w }) }]} />);
  }
  if (d.kind === "macd") {
    trace.push(
      <TraceRow
        key="hist"
        name="Histogramme"
        visible={{ checked: d.macdShowHistogram ?? true, onChange: (checked) => set({ macdShowHistogram: checked }) }}
        colors={pair("macdHistogramUpColor", "macdHistogramDownColor")}
      />,
      // MACD : couleur de la ligne selon sa position face au signal (change à chaque croisement).
      <TraceRow
        key="cross"
        sub
        name={<Checkbox label="MACD selon le signal" checked={d.macdCrossColors ?? false} onChange={(checked) => set({ macdCrossColors: checked })} />}
        colors={
          d.macdCrossColors
            ? [
                { label: "Au-dessus", value: d.macdLineAboveColor ?? UP, onChange: (c) => set({ macdLineAboveColor: c }) },
                { label: "En dessous", value: d.macdLineBelowColor ?? DOWN, onChange: (c) => set({ macdLineBelowColor: c }) },
              ]
            : []
        }
      />
    );
  }
  if (isRsiKind(d.kind)) {
    // Lignes de seuil et ligne médiane : couleur et opacité (curseur « Opacité » du sélecteur), médiane à afficher.
    trace.push(
      <TraceRow
        key="rsi-upper"
        name={`Seuil de surachat (${d.rsiOverbought ?? 70})`}
        colors={[{ value: d.rsiUpperColor ?? RSI_LEVEL_COLOR, onChange: (c) => set({ rsiUpperColor: c }) }]}
      />,
      <TraceRow
        key="rsi-lower"
        name={`Seuil de survente (${d.rsiOversold ?? 30})`}
        colors={[{ value: d.rsiLowerColor ?? RSI_LEVEL_COLOR, onChange: (c) => set({ rsiLowerColor: c }) }]}
      />,
      <TraceRow
        key="rsi-middle"
        name="Ligne médiane (50)"
        visible={{ checked: d.rsiShowMiddle ?? false, onChange: (checked) => set({ rsiShowMiddle: checked ? true : undefined }) }}
        colors={[{ value: d.rsiMiddleColor ?? RSI_MIDDLE_COLOR, onChange: (c) => set({ rsiMiddleColor: c }) }]}
      />
    );
  }
  if (d.kind === "adx") {
    trace.push(
      <TraceRow
        key="di"
        name="+DI / −DI"
        colors={[
          { label: "+DI", value: d.adxPlusColor ?? UP, onChange: (c) => set({ adxPlusColor: c }) },
          { label: "−DI", value: d.adxMinusColor ?? DOWN, onChange: (c) => set({ adxMinusColor: c }) },
        ]}
      />
    );
  }

  const traceSettings: ReactNode[] = [];
  if (isFundamentalKind(d.kind)) {
    traceSettings.push(
      <SelectSetting
        key="fstyle"
        label="Type de tracé"
        value={d.fundamentalChartStyle ?? "line"}
        onChange={(v) => set({ fundamentalChartStyle: v })}
        options={[
          { value: "line", label: "Ligne" },
          { value: "step", label: "Palier" },
          { value: "area", label: "Aire" },
        ]}
      />
    );
  }
  if (d.kind === "srBounce") {
    traceSettings.push(<NumberSetting key="srbop" label="Opacité du fond" suffix="%" min={0} max={100} value={d.srbOpacity} def={SRB.opacity} hint="Modulée par la probabilité : une zone solide est plus marquée." onSet={(v) => set({ srbOpacity: v })} />);
  }
  if (d.kind === "rangeDetection") {
    traceSettings.push(<NumberSetting key="rdop" label="Opacité du fond" suffix="%" min={0} max={100} value={d.rangeOpacity} def={RD.opacity} onSet={(v) => set({ rangeOpacity: v })} />);
  }
  if (d.kind === "expectedVolatility") {
    traceSettings.push(<NumberSetting key="evw" label="Épaisseur des lignes" suffix="px" min={1} max={5} value={d.lineWidth} def={EV.lineWidth} onSet={(v) => set({ lineWidth: v })} />);
  }
  if (d.kind === "tpo") {
    traceSettings.push(<NumberSetting key="tpoop" label="Opacité" suffix="%" min={10} max={100} step={5} value={d.tpoOpacity} def={100} onSet={(v) => set({ tpoOpacity: v })} />);
  }
  // Indicateur de zones ou de rectangles : opacité du fond (la couleur est dans le tableau).
  if (d.customData?.draw === "zones" || d.customData?.draw === "boxes") {
    traceSettings.push(<NumberSetting key="zop" label="Opacité du fond" suffix="%" min={0} max={100} value={d.zoneOpacity} def={12} onSet={(v) => set({ zoneOpacity: v })} />);
  }

  // --- Affichage -----------------------------------------------------------------------------------------------
  const display: ReactNode[] = [
    <SettingCheckRow key="legend">
      <Checkbox label="Afficher dans la légende" checked={d.legendHidden !== true} onChange={(checked) => set({ legendHidden: checked ? undefined : true })} />
    </SettingCheckRow>,
  ];
  const check = (key: string, text: string, checked: boolean, onChange: (checked: boolean) => void) =>
    display.push(
      <SettingCheckRow key={key}>
        <Checkbox label={text} checked={checked} onChange={onChange} />
      </SettingCheckRow>
    );
  if (d.kind === "zigzag") check("zz", "Libellés HH / HL / LH / LL", d.zigzagShowLabels ?? true, (c) => set({ zigzagShowLabels: c }));
  if (d.kind === "chandelierExit") {
    check("cel", "Libellés Achat / Vente", d.chandelierShowLabels ?? true, (c) => set({ chandelierShowLabels: c }));
    check("ceh", "Surligner l'état (remplissage)", d.chandelierHighlightState ?? true, (c) => set({ chandelierHighlightState: c }));
  }
  if (d.kind === "expectedVolatility") {
    check("evlow", "Afficher aussi le bas attendu (ouverture − ATR)", d.expVolShowLow ?? EV.showLow, (c) => set({ expVolShowLow: c }));
    check("evlbl", "Afficher les étiquettes de valeur", d.expVolShowLabels ?? EV.showLabels, (c) => set({ expVolShowLabels: c }));
  }
  if (d.kind === "srBounce") {
    check("srblbl", "Libellés des zones (rôle, prix, probabilité)", d.srbShowLabels ?? SRB.showLabels, (c) => set({ srbShowLabels: c }));
    check("srbfac", "Détail du calcul (les trois facteurs qui pèsent le plus)", d.srbShowFactors ?? false, (c) => set({ srbShowFactors: c }));
  }
  if (d.kind === "rangeDetection") {
    check("rdlbl", "Libellés des zones (état, score, cassure)", d.rangeShowLabels ?? RD.showLabels, (c) => set({ rangeShowLabels: c }));
    check("rdmid", "Ligne médiane des zones", d.rangeShowMidline ?? RD.showMidline, (c) => set({ rangeShowMidline: c }));
  }
  if (d.kind === "pivotPoints") check("piv", "Dernier pivot seulement", d.pivotShowLastOnly ?? false, (c) => set({ pivotShowLastOnly: c }));
  if (d.kind === "tpo") check("tpos", "Séparer les blocs", d.tpoSplitByBlocks ?? true, (c) => set({ tpoSplitByBlocks: c }));
  if (d.customData?.draw === "boxes") check("zl", "Libellé des rectangles", d.zoneShowLabels ?? true, (c) => set({ zoneShowLabels: c }));
  if (d.customData?.draw === "zones") {
    check("zl", "Libellé des zones", d.zoneShowLabels ?? true, (c) => set({ zoneShowLabels: c }));
    check("zm", "Repères (ligne et date)", d.zoneShowMarkers ?? true, (c) => set({ zoneShowMarkers: c }));
  }
  // Only ever set on a script-produced pane docked beside the chart (see CustomIndicatorDef.dock).
  if (d.customData?.dock === "left" || d.customData?.dock === "right") {
    check("axes", "Axes (prix et dates)", d.sideAxesVisible ?? true, (c) => set({ sideAxesVisible: c }));
  }
  // Filigrane du panneau (pas sur les prix, dont le filigrane est le symbole) ni sur une moyenne posée sur un panneau.
  if (ownPane && !d.sourceId) display.push(<IndicatorWatermarkField key="wm" indicatorDraft={d} setIndicatorDraft={setIndicatorDraft} />);

  return (
    <div className="lq-ind-settings">
      <SettingsSection title="Tracé">
        <div className="lq-ind-settings__trace" role="table" aria-label="Éléments tracés">
          {trace}
        </div>
        {traceSettings}
      </SettingsSection>
      {rsiZonesActive(d) && <RsiZoneLinesSection indicatorDraft={d} set={set} />}
      {d.kind === "donchian" && <DonchianStyleSection indicatorDraft={d} set={set} />}
      {(ownPane || d.kind === "atr") && (
        <SettingsSection title="Valeurs">
          {ownPane && <ValueFormatField indicatorDraft={d} setIndicatorDraft={setIndicatorDraft} />}
          {d.kind === "atr" && (
            <SettingCheckRow>
              <Checkbox label="En % du prix" checked={d.atrAsPercent ?? false} onChange={(checked) => set({ atrAsPercent: checked })} />
            </SettingCheckRow>
          )}
        </SettingsSection>
      )}
      <SettingsSection title="Affichage">{display}</SettingsSection>
      {/* Zones remplies : entre la courbe et la base 0, ou une autre courbe du panneau (un « fill between »). */}
      {/* Les couleurs conditionnelles font déjà tout (« remplir entre les deux », « remplir sous la courbe »…) : la rubrique
          « Zones remplies » n’apparaît plus que pour retirer des zones enregistrées avant, qui restent dessinées. */}
      {showAreaFills && (d.areaFills?.length ?? 0) > 0 && d.customData?.draw !== "zones" && d.customData?.draw !== "boxes" && (
        <IndicatorAreaFillsEditor indicator={d} indicators={indicators} onChange={(areaFills) => setIndicatorDraft({ ...d, areaFills })} />
      )}
      {/* Style conditionnel : écrites au nouveau format, l'ancien (`fills`, converti à la lecture) est retiré. */}
      {d.customData?.draw !== "zones" && d.customData?.draw !== "boxes" && (
        <IndicatorStyleRulesEditor
          indicator={d}
          indicators={indicators}
          onChange={(styleRules) => setIndicatorDraft({ ...d, styleRules, fills: undefined })}
          onChangeOwnerRules={onChangeOwnerRules}
          onOpenIndicator={onOpenIndicator}
        />
      )}
    </div>
  );
}

const LINE_STYLE_OPTIONS: SelectOption<"solid" | "dashed" | "dotted">[] = [
  { value: "solid", label: "Continue" },
  { value: "dashed", label: "Tirets" },
  { value: "dotted", label: "Pointillés" },
];

/** « Lignes des zones » d'un « rsiZones » : pour chacune des quatre lignes (moyenne et maximum de la survente et du
 *  surachat), affichée ou non, couleur et épaisseur, style et opacité. Enregistré avec l'indicateur. */
function RsiZoneLinesSection({ indicatorDraft: d, set }: { indicatorDraft: Indicator; set: (patch: Partial<Indicator>) => void }) {
  const patch = (key: RsiZoneLineKey, p: RsiZoneLineStyle) => set({ rsiZoneLines: { ...d.rsiZoneLines, [key]: { ...d.rsiZoneLines?.[key], ...p } } });
  return (
    <SettingsSection title="Lignes des zones">
      {RSI_ZONE_LINE_KEYS.map((key) => {
        const line = resolveRsiZoneLine(d, key);
        const name = RSI_ZONE_LINE_LABELS[key].name;
        return (
          <Fragment key={key}>
            <div className="lq-ind-settings__trace" role="table" aria-label={name}>
              <TraceRow
                name={name}
                visible={{ checked: line.show, onChange: (checked) => patch(key, { show: checked }) }}
                colors={[{ value: line.color, onChange: (c) => patch(key, { color: c }), thickness: line.width, onThicknessChange: (w) => patch(key, { width: w }) }]}
              />
            </div>
            <SelectSetting label="Style de la ligne" value={line.lineStyle} options={LINE_STYLE_OPTIONS} onChange={(v) => patch(key, { lineStyle: v })} />
            <NumberSetting label="Opacité de la ligne" suffix="%" min={0} max={100} value={line.opacity} def={RSI_ZONE_LINE_DEFAULTS[key].opacity} onSet={(v) => patch(key, { opacity: v })} />
          </Fragment>
        );
      })}
    </SettingsSection>
  );
}

/** Canaux de Donchian : style et opacité de chaque ligne, opacité du fond (couleurs et épaisseurs : « Tracé »). */
function DonchianStyleSection({ indicatorDraft: d, set }: { indicatorDraft: Indicator; set: (patch: Partial<Indicator>) => void }) {
  const patchLine = (key: DonchianLineKey, p: IndicatorLineStyle) => set({ donchianLines: { ...d.donchianLines, [key]: { ...d.donchianLines?.[key], ...p } } });
  const bg = resolveDonchianBackground(d);
  return (
    <SettingsSection title="Lignes et fond">
      {DONCHIAN_LINE_KEYS.map((key) => {
        const line = resolveDonchianLine(d, key);
        return (
          <Fragment key={key}>
            <SelectSetting label={`${DONCHIAN_LINE_LABELS[key]} : style`} value={line.lineStyle} options={LINE_STYLE_OPTIONS} onChange={(v) => patchLine(key, { lineStyle: v })} />
            <NumberSetting label={`${DONCHIAN_LINE_LABELS[key]} : opacité`} suffix="%" min={0} max={100} value={line.opacity} def={DONCHIAN_LINE_DEFAULTS[key].opacity} onSet={(v) => patchLine(key, { opacity: v })} />
          </Fragment>
        );
      })}
      <NumberSetting label="Fond : opacité" suffix="%" min={0} max={100} value={bg.opacity} def={DONCHIAN_BACKGROUND_DEFAULT.opacity} onSet={(v) => set({ donchianBackground: { ...d.donchianBackground, opacity: v } })} />
    </SettingsSection>
  );
}

type ValueFormatChoice = "auto" | "integer" | "decimals" | "percent" | "raw";

/** « Format des valeurs » : comment l'axe du panneau, les badges de survol et la légende écrivent les valeurs de cet
 *  indicateur (voir `ValueFormat`), avec un aperçu à droite. Enregistré avec l'indicateur, donc sur le compte. */
function ValueFormatField({ indicatorDraft, setIndicatorDraft }: Pick<IndicatorSettingsFieldsProps, "indicatorDraft" | "setIndicatorDraft">) {
  const current = normalizeValueFormat(indicatorDraft.valueFormat);
  const choice: ValueFormatChoice = typeof current === "object" ? "decimals" : current;
  const decimals = typeof current === "object" ? (current.decimals ?? 2) : 2;
  const set = (valueFormat: ValueFormat) => setIndicatorDraft({ ...indicatorDraft, valueFormat: valueFormat === "auto" ? undefined : valueFormat });
  const sample = choice === "percent" ? 21.5 : choice === "integer" || choice === "decimals" ? 1234.5678 : 12_345_678.9;
  return (
    <>
      <SettingRow label="Format" trailing={<output className="lq-ind-settings__preview" aria-label="Aperçu">{formatWithValueFormat(sample, current)}</output>}>
        <span className="lq-ind-settings__select">
          <Select<ValueFormatChoice>
            ariaLabel="Format des valeurs"
            value={choice}
            onChange={(v) => set(v === "decimals" ? { decimals } : v)}
            options={[
              { value: "auto", label: "Automatique (k / M / B)" },
              { value: "integer", label: "Nombre entier" },
              { value: "decimals", label: "Décimales fixes" },
              { value: "percent", label: "Pourcentage" },
              { value: "raw", label: "Brut" },
            ]}
          />
        </span>
      </SettingRow>
      {choice === "decimals" && <NumberSetting label="Précision" suffix="déc." min={0} max={10} value={decimals} def={2} onSet={(v) => set({ decimals: v })} />}
    </>
  );
}
