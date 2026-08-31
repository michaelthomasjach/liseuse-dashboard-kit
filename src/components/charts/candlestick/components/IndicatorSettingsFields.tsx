import { Checkbox } from "../../../forms/Checkbox";
import { NumberField } from "../../../forms/NumberField";
import { Select } from "../../../forms/Select";
import type { Indicator } from "../interfaces/Indicator.interface";
import { indicatorCatalogEntry, isFundamentalKind, defaultIndicatorColor } from "../indicatorCatalog";
import { toDateInputValue, fromDateInputValue } from "../formatting";

export interface IndicatorSettingsFieldsProps {
  indicatorDraft: Indicator;
  setIndicatorDraft: (d: Indicator) => void;
  indicators: Indicator[];
}

/** The settings modal's "Entrées" tab (see IndicatorModals.tsx) — period/stdDev plus every
 *  indicator's own bespoke inputs (MACD's three periods, ZigZag's deviation, Ichimoku's four
 *  periods, TPO's five settings, RSI/CHOP's own reference thresholds, ADX's trend threshold,
 *  correlation's own "strongly correlated" cutoff, a fundamental's value/YoY display mode…), each
 *  gated on `indicatorDraft.kind` exactly like the ones already here — extracted to its own file
 *  purely to keep IndicatorModals.tsx under this repo's 1000-line cap as more of these accumulate,
 *  not for any reason of its own. */
export function IndicatorSettingsInputs({ indicatorDraft, setIndicatorDraft }: IndicatorSettingsFieldsProps) {
  return (
    <>
      {indicatorCatalogEntry(indicatorDraft).hasPeriod && (
        <NumberField
          label="Période"
          min={1}
          max={500}
          step={1}
          value={indicatorDraft.period}
          onChange={(v) => setIndicatorDraft({ ...indicatorDraft, period: v === "" ? indicatorDraft.period : v })}
        />
      )}
      {indicatorCatalogEntry(indicatorDraft).hasStdDev && (
        <NumberField
          label="Écart-type (bandes)"
          min={0.5}
          max={5}
          step={0.1}
          value={indicatorDraft.stdDev ?? 2}
          onChange={(v) => setIndicatorDraft({ ...indicatorDraft, stdDev: v === "" ? indicatorDraft.stdDev : v })}
        />
      )}
      {indicatorDraft.kind === "macd" && (
        <div className="lq-chart__edit-drawing-row">
          <NumberField
            label="Rapide"
            min={1}
            max={200}
            step={1}
            value={indicatorDraft.fastPeriod ?? 12}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, fastPeriod: v === "" ? indicatorDraft.fastPeriod : v })}
          />
          <NumberField
            label="Lent"
            min={1}
            max={400}
            step={1}
            value={indicatorDraft.slowPeriod ?? 26}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, slowPeriod: v === "" ? indicatorDraft.slowPeriod : v })}
          />
          <NumberField
            label="Signal"
            min={1}
            max={200}
            step={1}
            value={indicatorDraft.signalPeriod ?? 9}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, signalPeriod: v === "" ? indicatorDraft.signalPeriod : v })}
          />
        </div>
      )}
      {indicatorDraft.kind === "zigzag" && (
        <NumberField
          label="Déviation (%)"
          min={0.5}
          max={50}
          step={0.5}
          value={indicatorDraft.zigzagDeviation ?? 5}
          onChange={(v) => setIndicatorDraft({ ...indicatorDraft, zigzagDeviation: v === "" ? indicatorDraft.zigzagDeviation : v })}
        />
      )}
      {indicatorDraft.kind === "supertrend" && (
        <NumberField
          label="Multiplicateur (× ATR)"
          min={0.5}
          max={10}
          step={0.5}
          value={indicatorDraft.supertrendMultiplier ?? 3}
          onChange={(v) => setIndicatorDraft({ ...indicatorDraft, supertrendMultiplier: v === "" ? indicatorDraft.supertrendMultiplier : v })}
        />
      )}
      {indicatorDraft.kind === "chandelierExit" && (
        <>
          <NumberField
            label="Multiplicateur ATR"
            min={0.5}
            max={10}
            step={0.1}
            value={indicatorDraft.chandelierMultiplier ?? 3}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, chandelierMultiplier: v === "" ? indicatorDraft.chandelierMultiplier : v })}
          />
          <Checkbox
            label="Utiliser le prix de clôture pour les extrêmes"
            checked={indicatorDraft.chandelierUseClose ?? true}
            onChange={(checked) => setIndicatorDraft({ ...indicatorDraft, chandelierUseClose: checked })}
          />
        </>
      )}
      {indicatorDraft.kind === "parabolicSar" && (
        <div className="lq-chart__edit-drawing-row">
          <NumberField
            label="Pas"
            min={0.01}
            max={1}
            step={0.01}
            value={indicatorDraft.sarStep ?? 0.02}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, sarStep: v === "" ? indicatorDraft.sarStep : v })}
          />
          <NumberField
            label="Max"
            min={0.05}
            max={1}
            step={0.05}
            value={indicatorDraft.sarMax ?? 0.2}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, sarMax: v === "" ? indicatorDraft.sarMax : v })}
          />
        </div>
      )}
      {indicatorDraft.kind === "gaps" && (
        <NumberField
          label="Écart minimum (%)"
          min={0}
          max={20}
          step={0.1}
          value={indicatorDraft.gapsMinPercent ?? 0.1}
          onChange={(v) => setIndicatorDraft({ ...indicatorDraft, gapsMinPercent: v === "" ? indicatorDraft.gapsMinPercent : v })}
        />
      )}
      {indicatorDraft.kind === "pivotPoints" && (
        <div className="lq-chart__edit-drawing-row">
          <Select
            label="Type"
            value={indicatorDraft.pivotType ?? "classic"}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, pivotType: v })}
            options={[
              { value: "classic", label: "Classic" },
              { value: "fibonacci", label: "Fibonacci" },
              { value: "woodie", label: "Woodie" },
              { value: "camarilla", label: "Camarilla" },
            ]}
          />
          <Select
            label="Période de référence"
            value={indicatorDraft.pivotPeriod ?? "weekly"}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, pivotPeriod: v })}
            options={[
              { value: "daily", label: "Journalière" },
              { value: "weekly", label: "Hebdomadaire" },
              { value: "monthly", label: "Mensuelle" },
            ]}
          />
        </div>
      )}
      {indicatorDraft.kind === "supportResistance" && (
        <NumberField
          label="Nombre de niveaux"
          min={1}
          max={20}
          step={1}
          value={indicatorDraft.srMaxLevels ?? 6}
          onChange={(v) => setIndicatorDraft({ ...indicatorDraft, srMaxLevels: v === "" ? indicatorDraft.srMaxLevels : v })}
        />
      )}
      {(indicatorDraft.kind === "patternRecognition" || indicatorDraft.kind === "candleRecognition") && (
        <div className="lq-field">
          <label className="lq-field__label">Date limite (par défaut : dernière bougie, actualisée chaque jour)</label>
          <input
            type="date"
            className="lq-chart__date-input"
            value={indicatorDraft.recognitionDateLimit ? toDateInputValue(indicatorDraft.recognitionDateLimit) : ""}
            onChange={(e) =>
              setIndicatorDraft({
                ...indicatorDraft,
                recognitionDateLimit: e.target.value ? fromDateInputValue(e.target.value, new Date()) : undefined,
              })
            }
          />
          {indicatorDraft.recognitionDateLimit && (
            <button
              type="button"
              className="lq-chart__inline-reset"
              onClick={() => setIndicatorDraft({ ...indicatorDraft, recognitionDateLimit: undefined })}
            >
              Revenir à la dernière bougie
            </button>
          )}
        </div>
      )}
      {indicatorDraft.kind === "ichimoku" && (
        <div className="lq-chart__edit-drawing-row">
          <NumberField
            label="Conversion"
            min={1}
            max={100}
            step={1}
            value={indicatorDraft.ichimokuConversionPeriod ?? 9}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, ichimokuConversionPeriod: v === "" ? indicatorDraft.ichimokuConversionPeriod : v })}
          />
          <NumberField
            label="Base"
            min={1}
            max={200}
            step={1}
            value={indicatorDraft.ichimokuBasePeriod ?? 26}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, ichimokuBasePeriod: v === "" ? indicatorDraft.ichimokuBasePeriod : v })}
          />
          <NumberField
            label="Span B"
            min={1}
            max={300}
            step={1}
            value={indicatorDraft.ichimokuSpanPeriod ?? 52}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, ichimokuSpanPeriod: v === "" ? indicatorDraft.ichimokuSpanPeriod : v })}
          />
          <NumberField
            label="Déplacement"
            min={1}
            max={200}
            step={1}
            value={indicatorDraft.ichimokuDisplacement ?? 26}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, ichimokuDisplacement: v === "" ? indicatorDraft.ichimokuDisplacement : v })}
          />
        </div>
      )}
      {indicatorDraft.kind === "tpo" && (
        <>
          <div className="lq-chart__edit-drawing-row">
            <NumberField
              label="Taille du bloc (min)"
              min={1}
              max={1440}
              step={5}
              value={indicatorDraft.tpoBlockMinutes ?? 30}
              onChange={(v) => setIndicatorDraft({ ...indicatorDraft, tpoBlockMinutes: v === "" ? indicatorDraft.tpoBlockMinutes : v })}
            />
            <NumberField
              label="Lignes de prix"
              min={5}
              max={100}
              step={1}
              value={indicatorDraft.tpoRowCount ?? 24}
              onChange={(v) => setIndicatorDraft({ ...indicatorDraft, tpoRowCount: v === "" ? indicatorDraft.tpoRowCount : v })}
            />
          </div>
          <div className="lq-chart__edit-drawing-row">
            <NumberField
              label="Zone de valeur (%)"
              min={1}
              max={100}
              step={1}
              value={indicatorDraft.tpoValueAreaPercent ?? 70}
              onChange={(v) => setIndicatorDraft({ ...indicatorDraft, tpoValueAreaPercent: v === "" ? indicatorDraft.tpoValueAreaPercent : v })}
            />
            <Select
              label="Étiquettes"
              value={indicatorDraft.tpoLabelStyle ?? "letters"}
              onChange={(v) => setIndicatorDraft({ ...indicatorDraft, tpoLabelStyle: v })}
              options={[
                { value: "letters", label: "Lettres" },
                { value: "numbers", label: "Chiffres" },
              ]}
            />
          </div>
        </>
      )}
      {indicatorDraft.kind === "rsi" && (
        <div className="lq-chart__edit-drawing-row">
          <NumberField
            label="Seuil de surachat"
            min={50}
            max={99}
            step={1}
            value={indicatorDraft.rsiOverbought ?? 70}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, rsiOverbought: v === "" ? indicatorDraft.rsiOverbought : v })}
          />
          <NumberField
            label="Seuil de survente"
            min={1}
            max={50}
            step={1}
            value={indicatorDraft.rsiOversold ?? 30}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, rsiOversold: v === "" ? indicatorDraft.rsiOversold : v })}
          />
        </div>
      )}
      {indicatorDraft.kind === "chop" && (
        <div className="lq-chart__edit-drawing-row">
          <NumberField
            label="Seuil haut (marché indécis)"
            min={50}
            max={99}
            step={0.1}
            value={indicatorDraft.chopUpperThreshold ?? 61.8}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, chopUpperThreshold: v === "" ? indicatorDraft.chopUpperThreshold : v })}
          />
          <NumberField
            label="Seuil bas (marché directionnel)"
            min={1}
            max={50}
            step={0.1}
            value={indicatorDraft.chopLowerThreshold ?? 38.2}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, chopLowerThreshold: v === "" ? indicatorDraft.chopLowerThreshold : v })}
          />
        </div>
      )}
      {indicatorDraft.kind === "adx" && (
        <NumberField
          label="Seuil de tendance forte"
          min={5}
          max={60}
          step={1}
          value={indicatorDraft.adxThreshold ?? 25}
          onChange={(v) => setIndicatorDraft({ ...indicatorDraft, adxThreshold: v === "" ? indicatorDraft.adxThreshold : v })}
        />
      )}
      {indicatorDraft.kind === "correlation" && (
        <NumberField
          label="Seuil de corrélation forte"
          min={0.1}
          max={1}
          step={0.05}
          value={indicatorDraft.correlationStrongThreshold ?? 0.7}
          onChange={(v) => setIndicatorDraft({ ...indicatorDraft, correlationStrongThreshold: v === "" ? indicatorDraft.correlationStrongThreshold : v })}
        />
      )}
      {isFundamentalKind(indicatorDraft.kind) && (
        <Select
          label="Affichage"
          value={indicatorDraft.fundamentalDisplayMode ?? "value"}
          onChange={(v) => setIndicatorDraft({ ...indicatorDraft, fundamentalDisplayMode: v })}
          options={[
            { value: "value", label: "Valeur" },
            { value: "yoyChange", label: "Variation sur 1 an (%)" },
          ]}
        />
      )}
    </>
  );
}

/** The settings modal's "Style" tab (see IndicatorModals.tsx) — colors and display toggles, same
 *  extraction reasoning as `IndicatorSettingsInputs` above. */
export function IndicatorSettingsStyle({ indicatorDraft, setIndicatorDraft, indicators }: IndicatorSettingsFieldsProps) {
  return (
    <>
      {indicatorDraft.kind === "macd" && (
        <>
          <Checkbox
            label="Afficher l'histogramme"
            checked={indicatorDraft.macdShowHistogram ?? true}
            onChange={(checked) => setIndicatorDraft({ ...indicatorDraft, macdShowHistogram: checked })}
          />
          {(indicatorDraft.macdShowHistogram ?? true) && (
            <div className="lq-chart__edit-drawing-row">
              <div className="lq-field">
                <label className="lq-field__label">Histogramme (hausse)</label>
                <input
                  type="color"
                  className="lq-chart__color-input"
                  value={indicatorDraft.macdHistogramUpColor ?? "#26a69a"}
                  onChange={(e) => setIndicatorDraft({ ...indicatorDraft, macdHistogramUpColor: e.target.value })}
                />
              </div>
              <div className="lq-field">
                <label className="lq-field__label">Histogramme (baisse)</label>
                <input
                  type="color"
                  className="lq-chart__color-input"
                  value={indicatorDraft.macdHistogramDownColor ?? "#ef5350"}
                  onChange={(e) => setIndicatorDraft({ ...indicatorDraft, macdHistogramDownColor: e.target.value })}
                />
              </div>
            </div>
          )}
        </>
      )}
      {indicatorDraft.kind === "zigzag" && (
        <Checkbox
          label="Afficher les labels HH / HL / LH / LL"
          checked={indicatorDraft.zigzagShowLabels ?? true}
          onChange={(checked) => setIndicatorDraft({ ...indicatorDraft, zigzagShowLabels: checked })}
        />
      )}
      {/* Supertrend/Parabolic SAR/Chandelier Exit each color themselves by trend (up/down),
          not by a single indicator-wide color the way most others do — their own pair of
          swatches here, defaulting to the chart's own up/down colors so leaving both unset
          reproduces the exact behavior from before these fields existed. */}
      {indicatorDraft.kind === "supertrend" && (
        <div className="lq-chart__edit-drawing-row">
          <div className="lq-field">
            <label className="lq-field__label">Couleur (hausse)</label>
            <input
              type="color"
              className="lq-chart__color-input"
              value={indicatorDraft.supertrendUpColor ?? "#26a69a"}
              onChange={(e) => setIndicatorDraft({ ...indicatorDraft, supertrendUpColor: e.target.value })}
            />
          </div>
          <div className="lq-field">
            <label className="lq-field__label">Couleur (baisse)</label>
            <input
              type="color"
              className="lq-chart__color-input"
              value={indicatorDraft.supertrendDownColor ?? "#ef5350"}
              onChange={(e) => setIndicatorDraft({ ...indicatorDraft, supertrendDownColor: e.target.value })}
            />
          </div>
        </div>
      )}
      {indicatorDraft.kind === "parabolicSar" && (
        <div className="lq-chart__edit-drawing-row">
          <div className="lq-field">
            <label className="lq-field__label">Couleur (hausse)</label>
            <input
              type="color"
              className="lq-chart__color-input"
              value={indicatorDraft.sarUpColor ?? "#26a69a"}
              onChange={(e) => setIndicatorDraft({ ...indicatorDraft, sarUpColor: e.target.value })}
            />
          </div>
          <div className="lq-field">
            <label className="lq-field__label">Couleur (baisse)</label>
            <input
              type="color"
              className="lq-chart__color-input"
              value={indicatorDraft.sarDownColor ?? "#ef5350"}
              onChange={(e) => setIndicatorDraft({ ...indicatorDraft, sarDownColor: e.target.value })}
            />
          </div>
        </div>
      )}
      {indicatorDraft.kind === "chandelierExit" && (
        <>
          <Checkbox
            label="Afficher les labels Achat/Vente"
            checked={indicatorDraft.chandelierShowLabels ?? true}
            onChange={(checked) => setIndicatorDraft({ ...indicatorDraft, chandelierShowLabels: checked })}
          />
          <Checkbox
            label="Surligner l'état (remplissage)"
            checked={indicatorDraft.chandelierHighlightState ?? true}
            onChange={(checked) => setIndicatorDraft({ ...indicatorDraft, chandelierHighlightState: checked })}
          />
          <div className="lq-chart__edit-drawing-row">
            <div className="lq-field">
              <label className="lq-field__label">Couleur (hausse)</label>
              <input
                type="color"
                className="lq-chart__color-input"
                value={indicatorDraft.chandelierUpColor ?? "#26a69a"}
                onChange={(e) => setIndicatorDraft({ ...indicatorDraft, chandelierUpColor: e.target.value })}
              />
            </div>
            <div className="lq-field">
              <label className="lq-field__label">Couleur (baisse)</label>
              <input
                type="color"
                className="lq-chart__color-input"
                value={indicatorDraft.chandelierDownColor ?? "#ef5350"}
                onChange={(e) => setIndicatorDraft({ ...indicatorDraft, chandelierDownColor: e.target.value })}
              />
            </div>
          </div>
        </>
      )}
      {indicatorDraft.kind === "pivotPoints" && (
        <Checkbox
          label="Afficher uniquement le dernier pivot"
          checked={indicatorDraft.pivotShowLastOnly ?? false}
          onChange={(checked) => setIndicatorDraft({ ...indicatorDraft, pivotShowLastOnly: checked })}
        />
      )}
      {indicatorDraft.kind === "tpo" && (
        <>
          <NumberField
            label="Opacité (%)"
            min={10}
            max={100}
            step={5}
            value={indicatorDraft.tpoOpacity ?? 100}
            onChange={(v) => setIndicatorDraft({ ...indicatorDraft, tpoOpacity: v === "" ? indicatorDraft.tpoOpacity : v })}
          />
          <Checkbox
            label="Séparer les blocs"
            checked={indicatorDraft.tpoSplitByBlocks ?? true}
            onChange={(checked) => setIndicatorDraft({ ...indicatorDraft, tpoSplitByBlocks: checked })}
          />
        </>
      )}
      {indicatorDraft.kind === "atr" && (
        <Checkbox
          label="Afficher en % du prix"
          checked={indicatorDraft.atrAsPercent ?? false}
          onChange={(checked) => setIndicatorDraft({ ...indicatorDraft, atrAsPercent: checked })}
        />
      )}
      {/* +DI/-DI's own pair, independent of the ADX line's own generic swatch below (which stays
          in effect for ADX — see that swatch's own doc for why it isn't excluded there). */}
      {indicatorDraft.kind === "adx" && (
        <div className="lq-chart__edit-drawing-row">
          <div className="lq-field">
            <label className="lq-field__label">Couleur +DI</label>
            <input
              type="color"
              className="lq-chart__color-input"
              value={indicatorDraft.adxPlusColor ?? "#26a69a"}
              onChange={(e) => setIndicatorDraft({ ...indicatorDraft, adxPlusColor: e.target.value })}
            />
          </div>
          <div className="lq-field">
            <label className="lq-field__label">Couleur -DI</label>
            <input
              type="color"
              className="lq-chart__color-input"
              value={indicatorDraft.adxMinusColor ?? "#ef5350"}
              onChange={(e) => setIndicatorDraft({ ...indicatorDraft, adxMinusColor: e.target.value })}
            />
          </div>
        </div>
      )}
      {isFundamentalKind(indicatorDraft.kind) && (
        <Select
          label="Style"
          value={indicatorDraft.fundamentalChartStyle ?? "line"}
          onChange={(v) => setIndicatorDraft({ ...indicatorDraft, fundamentalChartStyle: v })}
          options={[
            { value: "line", label: "Ligne" },
            { value: "step", label: "Palier" },
            { value: "area", label: "Aire" },
          ]}
        />
      )}
      {/* Only ever set on a script-produced pane (see CustomIndicatorDef.dock's own doc) — a
          built-in indicator has no UI to dock it beside the chart, so this never shows for one. */}
      {(indicatorDraft.customData?.dock === "left" || indicatorDraft.customData?.dock === "right") && (
        <Checkbox
          label="Afficher les axes (prix et dates)"
          checked={indicatorDraft.sideAxesVisible ?? true}
          onChange={(checked) => setIndicatorDraft({ ...indicatorDraft, sideAxesVisible: checked })}
        />
      )}
      {/* Support/Résistance colors each level by whether the last close currently sits
          above or below it, and (besides its own "Séparer les blocs" toggle just above)
          TPO colors its own blocks with a fixed multi-stop gradient — neither reads
          `color` or has a bespoke swatch of its own, so the Style tab would otherwise be
          empty for them; says so instead of just leaving a blank panel. */}
      {(indicatorDraft.kind === "supportResistance" || indicatorDraft.kind === "tpo") && (
        <p className="lq-chart__indicator-picker-empty">Cet indicateur utilise ses propres couleurs, non personnalisables pour l'instant.</p>
      )}
      {/* Every other kind: one indicator-wide color. Supertrend/Parabolic SAR/Chandelier
          Exit/Support-Résistance/TPO are excluded — each already has its own bespoke
          color UI (or none at all) above instead of a single swatch that couldn't
          represent a trend flip or a multi-stop gradient anyway. ADX *does* read it (for
          its own ADX line only — +DI/-DI have their own pair above), so it's deliberately
          not excluded here. */}
      {indicatorDraft.kind !== "supertrend" &&
        indicatorDraft.kind !== "parabolicSar" &&
        indicatorDraft.kind !== "chandelierExit" &&
        indicatorDraft.kind !== "supportResistance" &&
        indicatorDraft.kind !== "tpo" && (
        <div className="lq-field">
          <label className="lq-field__label">Couleur</label>
          <input
            type="color"
            className="lq-chart__color-input"
            value={indicatorDraft.color ?? defaultIndicatorColor(indicators.findIndex((i) => i.id === indicatorDraft.id))}
            onChange={(e) => setIndicatorDraft({ ...indicatorDraft, color: e.target.value })}
          />
        </div>
      )}
    </>
  );
}
