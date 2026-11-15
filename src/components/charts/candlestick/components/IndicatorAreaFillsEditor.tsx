import { ColorPicker } from "../../../forms/ColorPicker";
import { Checkbox } from "../../../forms/Checkbox";
import { Select, type SelectOption } from "../../../forms/Select";
import { withAlpha } from "../../../forms/colorUtils";
import { PlusIcon, TrashIcon } from "../../../icons";
import { SettingsSection } from "./IndicatorSettingsLayout";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorAreaFill } from "../interfaces/IndicatorAreaFill.interface";
import type { StyleRuleOperand } from "../interfaces/IndicatorStyleRule.interface";
import { defaultIndicatorColor } from "../indicatorCatalog";
import {
  RULE_DOWN,
  RULE_UP,
  indicatorAreaFills,
  indicatorSeriesFields,
  newAreaFillId,
  seriesRefKey,
  stylePaneKind,
  styleSeriesOptions,
  supportsStyleRules,
  type StyleSeriesOption,
} from "../styleRules";

/** Valeur du menu « la base du panneau (0) ». */
const ZERO_KEY = "zero";
/** Opacité par défaut d'une zone : assez pâle pour lire les courbes au travers. */
const FILL_ALPHA = 0.25;

/** Clé d'un bord dans le menu : la base / un niveau, ou une courbe du panneau. */
function operandKey(operand: StyleRuleOperand, ownerId: string): string {
  if (operand.source === "value") return operand.value === 0 ? ZERO_KEY : `value:${operand.value}`;
  return seriesRefKey(operand, ownerId);
}

/** La clé de la ligne de l'indicateur qui borde la zone, comme dans `styleSeriesOptions`. */
function ownLineKey(field: string | undefined): string {
  return seriesRefKey({ source: "indicator", ...(field ? { field } : {}) }, "");
}

/**
 * Rubrique Style d'un indicateur, « Zones remplies » : remplir entre une ligne de l'indicateur et la base 0 du panneau,
 * ou entre elle et une autre courbe du même panneau (une autre moyenne, le volume, le RSI qui la porte…), d'une
 * couleur quand elle est au-dessus et d'une autre quand elle est en dessous — un « fill between ». Plusieurs zones, que
 * l'on ajoute, modifie et supprime ; chaque modification s'applique et s'enregistre aussitôt. Les couleurs portent
 * leur opacité (curseur du sélecteur de couleur). Voir `IndicatorAreaFill`.
 */
export function IndicatorAreaFillsEditor({
  indicator,
  indicators,
  onChange,
}: {
  indicator: Indicator;
  indicators: Indicator[];
  onChange: (fills: IndicatorAreaFill[]) => void;
}) {
  if (!supportsStyleRules(indicator)) return null;
  const fills = indicatorAreaFills(indicator);
  const series = styleSeriesOptions(indicator, indicators);
  const ownFields = indicatorSeriesFields(indicator);
  // La base 0 n'a de sens que dans un panneau séparé (volume, RSI, MACD…) : sur les prix, 0 est hors de l'échelle.
  const zeroAllowed = stylePaneKind(indicator) !== "price";
  const lineColor = indicator.color ?? defaultIndicatorColor(Math.max(0, indicators.findIndex((i) => i.id === indicator.id)));
  const firstField = ownFields[0]?.field;
  const firstKey = ownLineKey(firstField);
  // L'autre courbe la plus naturelle : celle d'un autre indicateur du panneau, à défaut une autre ligne du même.
  const otherCurve =
    series.find((s) => s.key !== firstKey && s.ref.source === "indicator" && s.ref.indicatorId) ?? series.find((s) => s.key !== firstKey);

  const update = (id: string, patch: Partial<IndicatorAreaFill>) => onChange(fills.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const addZero = () =>
    onChange([
      ...fills,
      { id: newAreaFillId(), ...(firstField ? { field: firstField } : {}), to: { source: "value", value: 0 }, aboveColor: withAlpha(lineColor, FILL_ALPHA), belowColor: withAlpha(lineColor, FILL_ALPHA) },
    ]);
  const addBetween = () => {
    if (!otherCurve) return;
    onChange([
      ...fills,
      { id: newAreaFillId(), ...(firstField ? { field: firstField } : {}), to: otherCurve.ref, aboveColor: withAlpha(RULE_UP, FILL_ALPHA), belowColor: withAlpha(RULE_DOWN, FILL_ALPHA) },
    ]);
  };

  const addButtons = (primary: boolean) => (
    <div className="lq-ind-settings__actions">
      {zeroAllowed && (
        <button type="button" className={["lq-ind-settings__button", primary && "lq-ind-settings__button--primary"].filter(Boolean).join(" ")} onClick={addZero}>
          <PlusIcon size={14} />
          Zone jusqu&apos;à 0
        </button>
      )}
      {otherCurve && (
        <button type="button" className={["lq-ind-settings__button", primary && !zeroAllowed && "lq-ind-settings__button--primary"].filter(Boolean).join(" ")} onClick={addBetween}>
          <PlusIcon size={14} />
          Zone entre deux courbes
        </button>
      )}
    </div>
  );

  // Rien à remplir : ni base 0 (sur les prix) ni autre courbe dans le panneau.
  if (!zeroAllowed && !otherCurve && fills.length === 0) return null;

  return (
    <SettingsSection
      title="Zones remplies"
      help="Colorez l'espace entre cette courbe et la base 0 du panneau, ou entre elle et une autre courbe du panneau : une couleur quand elle est au-dessus, une autre quand elle est en dessous. Les zones se dessinent derrière les lignes ; l'opacité se règle dans le sélecteur de couleur."
    >
      {fills.length === 0 && (
        <div className="lq-ind-settings__empty-state">
          <p className="lq-ind-settings__empty">Aucune zone. Remplissez sous la courbe, ou entre elle et une autre courbe du panneau.</p>
          {addButtons(true)}
        </div>
      )}
      {fills.map((fill, k) => (
        <AreaFillRow
          key={fill.id}
          fill={fill}
          index={k}
          ownerId={indicator.id}
          ownFields={ownFields}
          series={series}
          zeroAllowed={zeroAllowed}
          onPatch={(patch) => update(fill.id, patch)}
          onRemove={() => onChange(fills.filter((f) => f.id !== fill.id))}
        />
      ))}
      {fills.length > 0 && addButtons(false)}
    </SettingsSection>
  );
}

function AreaFillRow({
  fill,
  index,
  ownerId,
  ownFields,
  series,
  zeroAllowed,
  onPatch,
  onRemove,
}: {
  fill: IndicatorAreaFill;
  index: number;
  ownerId: string;
  ownFields: { field?: string; label: string }[];
  series: StyleSeriesOption[];
  zeroAllowed: boolean;
  onPatch: (patch: Partial<IndicatorAreaFill>) => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  const enabled = fill.enabled !== false;
  const aKey = ownLineKey(fill.field);
  const aLabel = series.find((s) => s.key === aKey)?.label ?? ownFields.find((f) => f.field === fill.field)?.label ?? "la courbe";
  const bKey = operandKey(fill.to, ownerId);
  const bOption = series.find((s) => s.key === bKey);
  const isLevel = fill.to.source === "value";
  const levelText = fill.to.source === "value" ? (fill.to.value === 0 ? "0" : String(fill.to.value)) : "";
  const bLabel = isLevel ? levelText : (bOption?.label ?? "l'autre courbe");

  const aOptions: SelectOption[] = ownFields.map((f) => ({ value: f.field ?? "", label: f.label }));
  const bOptions: SelectOption[] = [
    ...(zeroAllowed || bKey === ZERO_KEY ? [{ value: ZERO_KEY, label: "0 (base du panneau)" }] : []),
    ...(isLevel && bKey !== ZERO_KEY ? [{ value: bKey, label: `Niveau ${levelText}` }] : []),
    ...series.filter((s) => s.key !== aKey).map((s) => ({ value: s.key, label: s.label })),
    ...(!isLevel && !bOption ? [{ value: bKey, label: "(courbe retirée)" }] : []),
  ];
  const aboveText = isLevel ? `Au-dessus de ${levelText}` : `${aLabel} > ${bLabel}`;
  const belowText = isLevel ? `En dessous de ${levelText}` : `${aLabel} < ${bLabel}`;

  const side = (key: "aboveColor" | "belowColor", text: string, fallback: string) => {
    const color = fill[key];
    return (
      <span className="lq-chart__rule-else">
        <Checkbox label={text} checked={!!color} onChange={(checked) => onPatch({ [key]: checked ? fallback : null })} ariaLabel={`${text} (zone ${n})`} />
        {color && <ColorPicker className="lq-chart__color-input" value={color} onChange={(c) => onPatch({ [key]: c })} aria-label={`Couleur « ${text} » de la zone ${n}`} />}
      </span>
    );
  };

  return (
    <div className={["lq-chart__rule", !enabled && "lq-chart__rule--disabled"].filter(Boolean).join(" ")} data-area-fill={fill.id}>
      <div className="lq-chart__rule-head">
        <Checkbox label={`Zone ${n}`} checked={enabled} onChange={(checked) => onPatch({ enabled: checked ? undefined : false })} ariaLabel={`Activer la zone ${n}`} />
        <span className="lq-chart__rule-tools">
          <button type="button" className="lq-ind-settings__icon-button" onClick={onRemove} aria-label={`Supprimer la zone ${n}`} title="Supprimer">
            <TrashIcon size={14} />
          </button>
        </span>
      </div>
      <div className="lq-chart__rule-sentence">
        <span className="lq-chart__rule-word">Entre</span>
        {aOptions.length > 1 ? (
          <span className="lq-chart__rule-pick lq-chart__rule-pick--series">
            <Select size="small" ariaLabel={`Courbe de la zone ${n}`} value={fill.field ?? ""} options={aOptions} onChange={(field) => onPatch({ field: field || undefined })} />
          </span>
        ) : (
          <span className="lq-chart__rule-word lq-chart__rule-word--strong">{aLabel}</span>
        )}
        <span className="lq-chart__rule-group">
          <span className="lq-chart__rule-word">et</span>
          <span className="lq-chart__rule-pick lq-chart__rule-pick--series">
            <Select
              size="small"
              ariaLabel={`Autre bord de la zone ${n}`}
              value={bKey}
              options={bOptions}
              onChange={(key) => {
                if (key === ZERO_KEY) return onPatch({ to: { source: "value", value: 0 } });
                const ref = series.find((s) => s.key === key)?.ref;
                if (ref) onPatch({ to: ref });
              }}
            />
          </span>
        </span>
      </div>
      <div className="lq-chart__rule-sentence">
        {side("aboveColor", aboveText, withAlpha(RULE_UP, FILL_ALPHA))}
        {side("belowColor", belowText, withAlpha(RULE_DOWN, FILL_ALPHA))}
      </div>
    </div>
  );
}
