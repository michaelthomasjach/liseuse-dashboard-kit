import { ColorPicker } from "../../../forms/ColorPicker";
import { Checkbox } from "../../../forms/Checkbox";
import { InputNumber } from "../../../forms/InputNumber";
import { Select, type SelectOption } from "../../../forms/Select";
import type { Indicator } from "../interfaces/Indicator.interface";
import type {
  IndicatorStyleRule,
  StyleRuleCondition,
  StyleRuleEffect,
  StyleRuleOperand,
} from "../interfaces/IndicatorStyleRule.interface";
import {
  RULE_DOWN,
  RULE_UP,
  defaultRuleOpacity,
  defaultStyleRule,
  indicatorStyleRules,
  isCrossCondition,
  isRangeCondition,
  seriesRefKey,
  styleRuleTemplates,
  styleSeriesOptions,
  supportsStyleRules,
  type StyleSeriesOption,
} from "../styleRules";

const CONDITION_OPTIONS: SelectOption<StyleRuleCondition>[] = [
  { value: "above", label: "au-dessus de" },
  { value: "below", label: "en dessous de" },
  { value: "gte", label: "≥" },
  { value: "lte", label: "≤" },
  { value: "crossUp", label: "croise à la hausse" },
  { value: "crossDown", label: "croise à la baisse" },
  { value: "between", label: "entre" },
  { value: "outside", label: "hors de" },
];

/** Valeur du menu « une valeur fixe » dans le choix d'une référence. */
const VALUE_KEY = "value";

/** Ce qu'une règle peut peindre selon sa condition : un croisement est ponctuel (un point, une bande sur la bougie),
 *  une comparaison dure (remplir, colorer la courbe, colorer le fond). */
function effectOptions(condition: StyleRuleCondition, aLabel: string): SelectOption<StyleRuleEffect>[] {
  if (isCrossCondition(condition)) {
    return [
      { value: "marker", label: "marquer d'un point" },
      { value: "background", label: "bande sur la bougie" },
    ];
  }
  return [
    { value: "fill", label: isRangeCondition(condition) ? "remplir la zone" : "remplir entre les deux" },
    { value: "line", label: `colorer ${aLabel}` },
    { value: "background", label: "colorer le fond" },
  ];
}

/**
 * Onglet Style : les couleurs conditionnelles d'un indicateur (voir `IndicatorStyleRule`). Chaque règle se lit comme
 * une phrase, de gauche à droite : « Quand [courbe A] est [condition] [courbe B | valeur] → [effet] en [couleur]
 * (sinon en [couleur]) », avec son opacité. Les courbes proposées sont toutes celles du panneau : les lignes de
 * l'indicateur, celles des indicateurs posés dessus (la SMA d'un RSI), les autres courbes du panneau principal et le
 * cours pour un indicateur tracé sur les prix. Chaque modification s'applique et s'enregistre aussitôt.
 */
export function IndicatorStyleRulesEditor({
  indicator,
  indicators,
  onChange,
}: {
  indicator: Indicator;
  indicators: Indicator[];
  onChange: (rules: IndicatorStyleRule[]) => void;
}) {
  if (!supportsStyleRules(indicator)) return null;
  const rules = indicatorStyleRules(indicator);
  const series = styleSeriesOptions(indicator, indicators);
  const templates = styleRuleTemplates(indicator, indicators);
  const update = (id: string, patch: Partial<IndicatorStyleRule>) => onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const move = (index: number, delta: number) => {
    const next = [...rules];
    const [rule] = next.splice(index, 1);
    next.splice(index + delta, 0, rule!);
    onChange(next);
  };

  return (
    <section className="lq-chart__rules" aria-label="Couleurs conditionnelles">
      <div className="lq-chart__rules-head">
        <span className="lq-field__label">Couleurs conditionnelles</span>
        <span className="lq-chart__rules-hint">
          Colorez l'espace entre deux courbes, une courbe ou le fond selon une condition, ou marquez les croisements. Les
          règles se peignent dans l'ordre : la dernière passe par-dessus.
        </span>
      </div>
      {rules.map((rule, k) => (
        <RuleRow
          key={rule.id}
          rule={rule}
          index={k}
          count={rules.length}
          ownerId={indicator.id}
          series={series}
          onPatch={(patch) => update(rule.id, patch)}
          onMove={(delta) => move(k, delta)}
          onRemove={() => onChange(rules.filter((r) => r.id !== rule.id))}
        />
      ))}
      <div className="lq-chart__rules-actions">
        <button type="button" className="lq-chart__rule-button lq-chart__rule-button--add" onClick={() => onChange([...rules, defaultStyleRule(indicator, indicators)])}>
          + Ajouter une règle
        </button>
      </div>
      {templates.length > 0 && (
        <div className="lq-chart__rules-templates">
          <span className="lq-chart__rules-hint">Modèles :</span>
          {templates.map((t) => (
            <button key={t.id} type="button" className="lq-chart__rule-button" onClick={() => onChange([...rules, ...t.rules()])}>
              {t.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function RuleRow({
  rule,
  index,
  count,
  ownerId,
  series,
  onPatch,
  onMove,
  onRemove,
}: {
  rule: IndicatorStyleRule;
  index: number;
  count: number;
  ownerId: string;
  series: StyleSeriesOption[];
  onPatch: (patch: Partial<IndicatorStyleRule>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  const aKey = seriesRefKey(rule.a, ownerId);
  const aOption = series.find((s) => s.key === aKey);
  const aLabel = aOption?.label ?? "la courbe";
  // Une courbe citée qui n'est plus dans le panneau (indicateur retiré) reste choisie, sous un nom qui le dit, plutôt
  // que d'être remplacée en silence.
  const missing = (key: string): SelectOption[] => (series.some((s) => s.key === key) ? [] : [{ value: key, label: "(courbe retirée)" }]);
  const aOptions: SelectOption[] = [...series.map((s) => ({ value: s.key, label: s.label })), ...missing(aKey)];
  const cross = isCrossCondition(rule.condition);
  const range = isRangeCondition(rule.condition);
  const effects = effectOptions(rule.condition, aLabel);
  const enabled = rule.enabled !== false;
  const opacity = rule.opacity ?? defaultRuleOpacity(rule.effect);

  const setCondition = (condition: StyleRuleCondition) => {
    const patch: Partial<IndicatorStyleRule> = { condition };
    // L'effet suit : un croisement se marque d'un point, une comparaison se remplit.
    const allowed = effectOptions(condition, aLabel).map((o) => o.value);
    if (!allowed.includes(rule.effect)) {
      const effect = allowed[0]!;
      patch.effect = effect;
      patch.opacity = defaultRuleOpacity(effect);
    }
    // « entre » / « hors de » : une deuxième borne, au-dessus de la première si c'est une valeur.
    if (isRangeCondition(condition) && !rule.c) {
      patch.c = rule.b.source === "value" ? { source: "value", value: rule.b.value + 20 } : { source: "value", value: 0 };
    }
    onPatch(patch);
  };
  const setEffect = (effect: StyleRuleEffect) => {
    // L'opacité suit l'effet tant qu'elle n'a pas été réglée à la main.
    const keepOpacity = rule.opacity !== undefined && rule.opacity !== defaultRuleOpacity(rule.effect);
    onPatch({ effect, opacity: keepOpacity ? rule.opacity : defaultRuleOpacity(effect) });
  };

  return (
    <div className={["lq-chart__rule", !enabled && "lq-chart__rule--disabled"].filter(Boolean).join(" ")}>
      <div className="lq-chart__rule-head">
        <Checkbox label={`Règle ${n}`} checked={enabled} onChange={(checked) => onPatch({ enabled: checked })} ariaLabel={`Activer la règle ${n}`} />
        <span className="lq-chart__rule-tools">
          <button type="button" className="lq-chart__rule-icon" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Monter la règle ${n}`} title="Monter">
            ↑
          </button>
          <button type="button" className="lq-chart__rule-icon" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Descendre la règle ${n}`} title="Descendre">
            ↓
          </button>
          <button type="button" className="lq-chart__rule-button" onClick={onRemove} aria-label={`Supprimer la règle ${n}`}>
            Supprimer
          </button>
        </span>
      </div>
      <div className="lq-chart__rule-sentence">
        <span className="lq-chart__rule-word">Quand</span>
        <span className="lq-chart__rule-pick lq-chart__rule-pick--series">
          <Select
            size="small"
            ariaLabel={`Courbe A de la règle ${n}`}
            value={aKey}
            options={aOptions}
            onChange={(key) => {
              const ref = series.find((s) => s.key === key)?.ref;
              if (ref) onPatch({ a: ref });
            }}
          />
        </span>
        {/* « est » reste collé à sa condition quand la phrase passe à la ligne. */}
        <span className="lq-chart__rule-group lq-chart__rule-pick--condition">
          <span className="lq-chart__rule-word">est</span>
          <span className="lq-chart__rule-pick">
            <Select size="small" ariaLabel={`Condition de la règle ${n}`} value={rule.condition} options={CONDITION_OPTIONS} onChange={setCondition} />
          </span>
        </span>
        <OperandPicker
          operand={rule.b}
          ownerId={ownerId}
          series={series}
          excludeKey={range ? undefined : aKey}
          ariaLabel={range ? `Première borne de la règle ${n}` : `Référence de la règle ${n}`}
          onChange={(b) => onPatch({ b })}
        />
        {range && (
          <span className="lq-chart__rule-group">
            <span className="lq-chart__rule-word">et</span>
            <OperandPicker
              operand={rule.c ?? { source: "value", value: 0 }}
              ownerId={ownerId}
              series={series}
              ariaLabel={`Deuxième borne de la règle ${n}`}
              onChange={(c) => onPatch({ c })}
            />
          </span>
        )}
      </div>
      <div className="lq-chart__rule-sentence">
        <span className="lq-chart__rule-word" aria-hidden="true">
          →
        </span>
        <span className="lq-chart__rule-pick lq-chart__rule-pick--effect">
          <Select size="small" ariaLabel={`Effet de la règle ${n}`} value={rule.effect} options={effects} onChange={setEffect} />
        </span>
        <span className="lq-chart__rule-word">en</span>
        <ColorPicker
          className="lq-chart__color-input"
          value={rule.color}
          onChange={(color) => onPatch({ color })}
          aria-label={`Couleur de la règle ${n}`}
        />
        {!cross && (
          <span className="lq-chart__rule-else">
            <Checkbox
              label="sinon"
              checked={!!rule.elseColor}
              onChange={(checked) => onPatch({ elseColor: checked ? (rule.color === RULE_DOWN ? RULE_UP : RULE_DOWN) : null })}
              ariaLabel={`Couleur quand la condition de la règle ${n} est fausse`}
            />
            {rule.elseColor && (
              <ColorPicker
                className="lq-chart__color-input"
                value={rule.elseColor}
                onChange={(color) => onPatch({ elseColor: color })}
                aria-label={`Couleur « sinon » de la règle ${n}`}
              />
            )}
          </span>
        )}
      </div>
      <label className="lq-chart__settings-opacity lq-chart__rule-opacity">
        <span>Opacité : {opacity} %</span>
        <input
          type="range"
          min={5}
          max={100}
          step={5}
          value={opacity}
          onChange={(e) => onPatch({ opacity: Number(e.target.value) })}
          aria-label={`Opacité de la règle ${n}`}
        />
      </label>
    </div>
  );
}

/** Une référence : une courbe du panneau, ou « une valeur » suivie de son champ. */
function OperandPicker({
  operand,
  ownerId,
  series,
  excludeKey,
  ariaLabel,
  onChange,
}: {
  operand: StyleRuleOperand;
  ownerId: string;
  series: StyleSeriesOption[];
  /** La courbe A : se comparer à elle-même n'a pas de sens. */
  excludeKey?: string;
  ariaLabel: string;
  onChange: (operand: StyleRuleOperand) => void;
}) {
  const key = operand.source === "value" ? VALUE_KEY : seriesRefKey(operand, ownerId);
  const choices = series.filter((s) => s.key !== excludeKey);
  const options: SelectOption[] = [
    { value: VALUE_KEY, label: "une valeur" },
    ...choices.map((s) => ({ value: s.key, label: s.label })),
    ...(key === VALUE_KEY || choices.some((s) => s.key === key) ? [] : [{ value: key, label: "(courbe retirée)" }]),
  ];
  // Le menu et son champ de valeur restent ensemble quand la phrase passe à la ligne.
  return (
    <span className={["lq-chart__rule-group", "lq-chart__rule-operand", operand.source === "value" && "lq-chart__rule-operand--value"].filter(Boolean).join(" ")}>
      <span className={["lq-chart__rule-pick", operand.source === "value" ? "lq-chart__rule-pick--value-kind" : "lq-chart__rule-pick--series"].join(" ")}>
        <Select
          size="small"
          ariaLabel={ariaLabel}
          value={key}
          options={options}
          onChange={(next) => {
            if (next === VALUE_KEY) {
              if (operand.source !== "value") onChange({ source: "value", value: 0 });
              return;
            }
            const ref = series.find((s) => s.key === next)?.ref;
            if (ref) onChange(ref);
          }}
        />
      </span>
      {operand.source === "value" && (
        <span className="lq-chart__rule-pick lq-chart__rule-pick--number">
          <InputNumber size="small" step={1} value={operand.value} aria-label={`${ariaLabel} (valeur)`} onChange={(v) => onChange({ source: "value", value: v === "" ? 0 : v })} />
        </span>
      )}
    </span>
  );
}
