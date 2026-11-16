import { ColorPicker } from "../../../forms/ColorPicker";
import { Checkbox } from "../../../forms/Checkbox";
import { InputNumber } from "../../../forms/InputNumber";
import { Select, type SelectOption } from "../../../forms/Select";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, SettingsIcon, TrashIcon } from "../../../icons";
import { ActionMenu, CollapsibleSection } from "./IndicatorSettingsLayout";
import { RuleIconPicker, RuleIconSettings } from "./RuleIconPicker";
import type { Indicator } from "../interfaces/Indicator.interface";
import { indicatorLabel } from "../indicatorCatalog";
import type {
  IndicatorStyleRule,
  StyleRuleCondition,
  StyleRuleEffect,
  StyleRuleOperand,
} from "../interfaces/IndicatorStyleRule.interface";
import {
  RULE_DOWN,
  RULE_UP,
  defaultRuleIcon,
  defaultRuleOpacity,
  defaultStyleRule,
  indicatorStyleRules,
  isCrossCondition,
  linkedStyleRuleGroups,
  styleRulesCountLabel,
  type LinkedStyleRuleGroup,
  type StyleRuleTarget,
  isRangeCondition,
  seriesRefKey,
  styleRuleTemplates,
  styleSeriesOptions,
  styleLevelOptions,
  type StyleLevelOption,
  supportsStyleRules,
  type StyleSeriesOption,
} from "../styleRules";

const CONDITION_OPTIONS: SelectOption<StyleRuleCondition>[] = [
  { value: "above", label: "Au-dessus de" },
  { value: "below", label: "En dessous de" },
  { value: "gte", label: "≥" },
  { value: "lte", label: "≤" },
  { value: "crossUp", label: "Croise à la hausse" },
  { value: "crossDown", label: "Croise à la baisse" },
  { value: "between", label: "Entre" },
  { value: "outside", label: "Hors de" },
];

/** Valeur du menu « une valeur fixe » dans le choix d'une référence. */
const VALUE_KEY = "value";

/** La première lettre en majuscule : chaque option des menus des règles commence par une majuscule. */
const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Ce qu'une règle peut peindre selon sa condition : un croisement est ponctuel (une icône, une bande sur la bougie),
 *  une comparaison dure (remplir, colorer la courbe, colorer le fond, une icône sur chaque bougie où elle est vraie).
 *  L'ancien « marquer d'un point » n'est plus proposé : ses règles arrivent ici converties en icône. */
function effectOptions(condition: StyleRuleCondition, aLabel: string): SelectOption<StyleRuleEffect>[] {
  if (isCrossCondition(condition)) {
    return [
      { value: "icon", label: "Ajouter une icône" },
      { value: "background", label: "Bande sur la bougie" },
    ];
  }
  return [
    { value: "fill", label: isRangeCondition(condition) ? "Remplir la zone" : "Remplir entre les deux" },
    { value: "line", label: `Colorer ${aLabel}` },
    { value: "background", label: "Colorer le fond" },
    { value: "icon", label: "Ajouter une icône" },
  ];
}

/**
 * Onglet Style : le style conditionnel d'un indicateur (voir `IndicatorStyleRule`). Chaque règle se lit comme
 * une phrase, de gauche à droite : « Quand [courbe A] est [condition] [courbe B | valeur] → [effet] en [couleur]
 * (sinon en [couleur]) », avec son opacité ; l'effet « Ajouter une icône » ajoute le choix de l'icône, sa taille et sa
 * position. Les courbes proposées sont toutes celles du panneau : les lignes de
 * l'indicateur, celles des indicateurs posés dessus (la SMA d'un RSI), les autres courbes du panneau principal et le
 * cours pour un indicateur tracé sur les prix. Chaque modification s'applique et s'enregistre aussitôt.
 */
export function IndicatorStyleRulesEditor({
  indicator,
  indicators,
  onChange,
  onChangeOwnerRules,
  onOpenIndicator,
}: {
  indicator: Indicator;
  indicators: Indicator[];
  onChange: (rules: IndicatorStyleRule[]) => void;
  /** Modifie les règles d'un AUTRE indicateur (son propriétaire) : sans elle, les « Règles liées » ne sont pas montrées. */
  onChangeOwnerRules?: (ownerId: string, rules: IndicatorStyleRule[]) => void;
  /** Ouvre les paramètres d'un indicateur (lien « Ouvrir SMA(50) » d'un groupe de règles liées). */
  onOpenIndicator?: (id: string) => void;
}) {
  const linked = onChangeOwnerRules ? linkedStyleRuleGroups({ kind: "indicator", id: indicator.id }, indicators) : [];
  const linkedCount = linked.reduce((n, g) => n + g.rules.length, 0);
  if (!supportsStyleRules(indicator) && linkedCount === 0) return null;
  const rules = indicatorStyleRules(indicator);
  const series = styleSeriesOptions(indicator, indicators);
  const levels = styleLevelOptions(indicator);
  const templates = styleRuleTemplates(indicator, indicators);
  const update = (id: string, patch: Partial<IndicatorStyleRule>) => onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const move = (index: number, delta: number) => {
    const next = [...rules];
    const [rule] = next.splice(index, 1);
    next.splice(index + delta, 0, rule!);
    onChange(next);
  };

  const add = () => onChange([...rules, defaultStyleRule(indicator, indicators)]);
  const fromTemplate = (
    <ActionMenu label="Partir d'un modèle" items={templates.map((t) => ({ id: t.id, label: t.label, onSelect: () => onChange([...rules, ...t.rules()]) }))} />
  );

  // Repliée tant qu'il n'y a pas de règle : la section se résume alors à son titre.
  return (
    <CollapsibleSection
      title="Style conditionnel"
      count={styleRulesCountLabel(rules.length, linkedCount)}
      defaultOpen={rules.length + linkedCount > 0}
      help="Colorez l'espace entre deux courbes, une courbe ou le fond selon une condition, ou posez une icône sur la courbe là où elle est vraie (un croisement, un franchissement de seuil). Chaque règle se lit comme une phrase ; les règles se peignent dans l'ordre, la dernière passe par-dessus."
    >
      {rules.length === 0 && (
        <div className="lq-ind-settings__empty-state">
          <p className="lq-ind-settings__empty">Aucune règle. Colorez une zone, une courbe ou le fond, ou posez une icône, selon une condition.</p>
          <div className="lq-ind-settings__actions">
            <button type="button" className="lq-ind-settings__button lq-ind-settings__button--primary" onClick={add}>
              <PlusIcon size={14} />
              Ajouter une règle
            </button>
            {fromTemplate}
          </div>
        </div>
      )}
      {rules.map((rule, k) => (
        <RuleRow
          key={rule.id}
          rule={rule}
          index={k}
          count={rules.length}
          ownerId={indicator.id}
          series={series}
          levels={levels}
          onPatch={(patch) => update(rule.id, patch)}
          onMove={(delta) => move(k, delta)}
          onRemove={() => onChange(rules.filter((r) => r.id !== rule.id))}
        />
      ))}
      {rules.length > 0 && (
        <div className="lq-ind-settings__actions">
          <button type="button" className="lq-ind-settings__button" onClick={add}>
            <PlusIcon size={14} />
            Ajouter une règle
          </button>
          {fromTemplate}
        </div>
      )}
      {onChangeOwnerRules && <LinkedStyleRules groups={linked} indicators={indicators} onChangeOwnerRules={onChangeOwnerRules} onOpenIndicator={onOpenIndicator} />}
    </CollapsibleSection>
  );
}

/**
 * La rubrique « Style conditionnel » d'une série qui n'a pas de règles à elle — le cours (onglet du symbole) ou le volume
 * (onglet Volume) — quand des indicateurs ont des règles qui la citent (« SMA(20) au-dessus du cours »). Rien sinon.
 */
export function LinkedStyleRulesSection({
  target,
  indicators,
  onChangeOwnerRules,
  onOpenIndicator,
}: {
  target: StyleRuleTarget;
  indicators: Indicator[];
  onChangeOwnerRules: (ownerId: string, rules: IndicatorStyleRule[]) => void;
  onOpenIndicator?: (id: string) => void;
}) {
  const groups = linkedStyleRuleGroups(target, indicators);
  const count = groups.reduce((n, g) => n + g.rules.length, 0);
  if (count === 0) return null;
  return (
    <CollapsibleSection
      title="Style conditionnel"
      count={styleRulesCountLabel(0, count)}
      defaultOpen
      help="Les règles de style conditionnel des indicateurs qui citent cette série. Elles se modifient ici, et sont enregistrées avec l'indicateur qui les porte."
    >
      <LinkedStyleRules groups={groups} indicators={indicators} onChangeOwnerRules={onChangeOwnerRules} onOpenIndicator={onOpenIndicator} />
    </CollapsibleSection>
  );
}

/**
 * « Règles liées » : les règles d'autres indicateurs qui citent la série réglée, regroupées par indicateur propriétaire
 * (« Règles liées (définies sur SMA(50)) »). Elles se modifient sur place comme les siennes — chaque modification
 * réécrit la liste du propriétaire, enregistrée avec lui —, s'activent, se désactivent ou se suppriment ; « Ouvrir
 * SMA(50) » ouvre les paramètres du propriétaire. Leur ordre se règle chez lui (pas de flèches ici).
 */
function LinkedStyleRules({
  groups,
  indicators,
  onChangeOwnerRules,
  onOpenIndicator,
}: {
  groups: LinkedStyleRuleGroup[];
  indicators: Indicator[];
  onChangeOwnerRules: (ownerId: string, rules: IndicatorStyleRule[]) => void;
  onOpenIndicator?: (id: string) => void;
}) {
  if (groups.length === 0) return null;
  return (
    <>
      {groups.map(({ owner, allRules, rules }) => {
        const name = indicatorLabel(owner);
        const series = styleSeriesOptions(owner, indicators);
        const levels = styleLevelOptions(owner);
        const write = (next: IndicatorStyleRule[]) => onChangeOwnerRules(owner.id, next);
        return (
          <div key={owner.id} className="lq-chart__linked-rules" role="group" aria-label={`Règles liées, définies sur ${name}`}>
            <div className="lq-chart__linked-rules-head">
              <span className="lq-chart__linked-rules-title">Règles liées (définies sur {name})</span>
              {onOpenIndicator && (
                <button type="button" className="lq-ind-settings__link lq-chart__linked-rules-open" onClick={() => onOpenIndicator(owner.id)}>
                  <SettingsIcon size={13} />
                  Ouvrir {name}
                </button>
              )}
            </div>
            {rules.map((rule) => {
              const index = allRules.findIndex((r) => r.id === rule.id);
              return (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  index={index}
                  count={allRules.length}
                  ownerId={owner.id}
                  series={series}
                  levels={levels}
                  linkedTo={name}
                  onPatch={(patch) => write(allRules.map((r) => (r.id === rule.id ? { ...r, ...patch } : r)))}
                  onMove={() => {}}
                  onRemove={() => write(allRules.filter((r) => r.id !== rule.id))}
                />
              );
            })}
          </div>
        );
      })}
    </>
  );
}

function RuleRow({
  rule,
  index,
  count,
  ownerId,
  series,
  levels = [],
  linkedTo,
  onPatch,
  onMove,
  onRemove,
}: {
  rule: IndicatorStyleRule;
  index: number;
  count: number;
  ownerId: string;
  series: StyleSeriesOption[];
  /** Les lignes de niveau de l'indicateur (seuils, médiane), proposées comme référence et bornes. */
  levels?: StyleLevelOption[];
  /** Règle liée : le nom de l'indicateur qui la porte (libellés, pas de flèches d'ordre). */
  linkedTo?: string;
  onPatch: (patch: Partial<IndicatorStyleRule>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  const ref = linkedTo ? `la règle ${n} de ${linkedTo}` : `la règle ${n}`;
  const aKey = seriesRefKey(rule.a, ownerId);
  const aOption = series.find((s) => s.key === aKey);
  const aLabel = capitalize(aOption?.label ?? "la courbe");
  // Une courbe citée qui n'est plus dans le panneau (indicateur retiré) reste choisie, sous un nom qui le dit, plutôt
  // que d'être remplacée en silence.
  const missing = (key: string): SelectOption[] => (series.some((s) => s.key === key) ? [] : [{ value: key, label: "(Courbe retirée)" }]);
  const aOptions: SelectOption[] = [...series.map((s) => ({ value: s.key, label: capitalize(s.label) })), ...missing(aKey)];
  const cross = isCrossCondition(rule.condition);
  const range = isRangeCondition(rule.condition);
  const effects = effectOptions(rule.condition, aLabel);
  const isIcon = rule.effect === "icon";
  const enabled = rule.enabled !== false;
  const opacity = rule.opacity ?? defaultRuleOpacity(rule.effect);

  const setCondition = (condition: StyleRuleCondition) => {
    const patch: Partial<IndicatorStyleRule> = { condition };
    // L'effet suit : un croisement se marque d'une icône, une comparaison se remplit.
    const allowed = effectOptions(condition, aLabel).map((o) => o.value);
    if (!allowed.includes(rule.effect)) {
      const effect = allowed[0]!;
      patch.effect = effect;
      patch.opacity = defaultRuleOpacity(effect);
      if (effect === "icon" && !rule.icon) patch.icon = defaultRuleIcon(condition);
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
    onPatch({ effect, opacity: keepOpacity ? rule.opacity : defaultRuleOpacity(effect), ...(effect === "icon" && !rule.icon ? { icon: defaultRuleIcon(rule.condition) } : {}) });
  };

  return (
    <div className={["lq-chart__rule", !enabled && "lq-chart__rule--disabled"].filter(Boolean).join(" ")}>
      <div className="lq-chart__rule-head">
        <Checkbox label={`Règle ${n}`} checked={enabled} onChange={(checked) => onPatch({ enabled: checked })} ariaLabel={`Activer ${ref}`} />
        <span className="lq-chart__rule-tools">
          {!linkedTo && (
            <>
              <button type="button" className="lq-ind-settings__icon-button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Monter ${ref}`} title="Monter">
                <ArrowUpIcon size={14} />
              </button>
              <button type="button" className="lq-ind-settings__icon-button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Descendre ${ref}`} title="Descendre">
                <ArrowDownIcon size={14} />
              </button>
            </>
          )}
          <button type="button" className="lq-ind-settings__icon-button" onClick={onRemove} aria-label={`Supprimer ${ref}`} title="Supprimer">
            <TrashIcon size={14} />
          </button>
        </span>
      </div>
      <div className="lq-chart__rule-sentence lq-chart__rule-sentence--condition">
        <span className="lq-chart__rule-word">Quand</span>
        <span className="lq-chart__rule-pick lq-chart__rule-pick--series">
          <Select
            size="small"
            ariaLabel={`Courbe A de ${ref}`}
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
            <Select size="small" ariaLabel={`Condition de ${ref}`} value={rule.condition} options={CONDITION_OPTIONS} onChange={setCondition} />
          </span>
        </span>
        <OperandPicker
          operand={rule.b}
          ownerId={ownerId}
          series={series}
          levels={levels}
          excludeKey={range ? undefined : aKey}
          ariaLabel={range ? `Première borne de ${ref}` : `Référence de ${ref}`}
          onChange={(b) => onPatch({ b })}
        />
        {range && (
          <span className="lq-chart__rule-group">
            <span className="lq-chart__rule-word">et</span>
            <OperandPicker
              operand={rule.c ?? { source: "value", value: 0 }}
              ownerId={ownerId}
              series={series}
              levels={levels}
              ariaLabel={`Deuxième borne de ${ref}`}
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
          <Select size="small" ariaLabel={`Effet de ${ref}`} value={rule.effect} options={effects} onChange={setEffect} />
        </span>
        {isIcon && (
          <RuleIconPicker
            value={rule.icon?.name ?? "circle-filled"}
            color={rule.color}
            ariaLabel={`Icône de ${ref}`}
            onChange={(name) => onPatch({ icon: { ...(rule.icon ?? defaultRuleIcon(rule.condition)), name } })}
          />
        )}
        <span className="lq-chart__rule-word">en</span>
        <ColorPicker
          className="lq-chart__color-input"
          value={rule.color}
          onChange={(color) => onPatch({ color })}
          aria-label={`Couleur de ${ref}`}
        />
        {!cross && !isIcon && (
          <span className="lq-chart__rule-else">
            <Checkbox
              label="sinon"
              checked={!!rule.elseColor}
              onChange={(checked) => onPatch({ elseColor: checked ? (rule.color === RULE_DOWN ? RULE_UP : RULE_DOWN) : null })}
              ariaLabel={`Couleur quand la condition de ${ref} est fausse`}
            />
            {rule.elseColor && (
              <ColorPicker
                className="lq-chart__color-input"
                value={rule.elseColor}
                onChange={(color) => onPatch({ elseColor: color })}
                aria-label={`Couleur « sinon » de ${ref}`}
              />
            )}
          </span>
        )}
      </div>
      {isIcon && (
        <RuleIconSettings
          icon={rule.icon}
          onCurve
          ariaPrefix={ref.replace(/^la /, "")}
          onChange={(patch) => onPatch({ icon: { ...(rule.icon ?? defaultRuleIcon(rule.condition)), ...patch } })}
        />
      )}
      <label className="lq-chart__rule-opacity">
        <span className="lq-chart__rule-word">Opacité</span>
        <input
          type="range"
          className="lq-ind-settings__range"
          min={5}
          max={100}
          step={5}
          value={opacity}
          onChange={(e) => onPatch({ opacity: Number(e.target.value) })}
          aria-label={`Opacité de ${ref}`}
        />
        <output className="lq-ind-settings__range-value">{opacity} %</output>
      </label>
    </div>
  );
}

/** Une référence : une courbe du panneau, ou « une valeur » suivie de son champ. */
function OperandPicker({
  operand,
  ownerId,
  series,
  levels = [],
  excludeKey,
  ariaLabel,
  onChange,
}: {
  operand: StyleRuleOperand;
  ownerId: string;
  series: StyleSeriesOption[];
  levels?: StyleLevelOption[];
  /** La courbe A : se comparer à elle-même n'a pas de sens. */
  excludeKey?: string;
  ariaLabel: string;
  onChange: (operand: StyleRuleOperand) => void;
}) {
  const key = operand.source === "value" ? VALUE_KEY : seriesRefKey(operand, ownerId);
  const choices = series.filter((s) => s.key !== excludeKey);
  const options: SelectOption[] = [
    { value: VALUE_KEY, label: "Une valeur" },
    ...levels.map((l) => ({ value: l.key, label: capitalize(l.label) })),
    ...choices.map((s) => ({ value: s.key, label: capitalize(s.label) })),
    ...(key === VALUE_KEY || choices.some((s) => s.key === key) || levels.some((l) => l.key === key) ? [] : [{ value: key, label: "(Courbe retirée)" }]),
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
            const ref = levels.find((l) => l.key === next)?.ref ?? series.find((s) => s.key === next)?.ref;
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
