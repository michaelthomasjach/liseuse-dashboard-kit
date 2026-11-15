import { ColorPicker } from "../../../forms/ColorPicker";
import { Checkbox } from "../../../forms/Checkbox";
import { InputNumber } from "../../../forms/InputNumber";
import { Select, type SelectOption } from "../../../forms/Select";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { CandleColorCondition, CandleColorMetric, CandleColorOperator, CandleColorRule } from "../interfaces/CandleColorRule.interface";
import {
  CANDLE_COLOR_METRICS,
  CANDLE_COLOR_RULE_TEMPLATES,
  candleSeriesKey,
  candleSeriesOptions,
  defaultCandleColorCondition,
  defaultCandleColorRule,
  isNumericMetric,
  metricUsesPeriod,
  metricUsesSeries,
  type CandleSeriesOption,
} from "../candleColorRules";

const METRIC_OPTIONS: SelectOption<CandleColorMetric>[] = CANDLE_COLOR_METRICS.map((m) => ({ value: m.value, label: m.label }));

const OPERATOR_OPTIONS: SelectOption<CandleColorOperator>[] = [
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "between", label: "entre" },
];

const COMBINE_OPTIONS: SelectOption<"and" | "or">[] = [
  { value: "and", label: "et" },
  { value: "or", label: "ou" },
];

/** Le seuil le plus parlant quand on change de mesure (un seuil de variation ne veut rien dire pour le volume). */
function defaultsFor(metric: CandleColorMetric): Partial<CandleColorCondition> {
  switch (metric) {
    case "changeOpen":
    case "changePrev":
      return { operator: "gt", value: 0.3 };
    case "range":
      return { operator: "gt", value: 2 };
    case "body":
      return { operator: "lt", value: 10 };
    case "gap":
      return { operator: "gt", value: 0.5 };
    case "volume":
      return { operator: "gt", value: 2, period: 20 };
    case "highest":
    case "lowest":
      return { period: 20 };
    default:
      return {};
  }
}

/**
 * Paramètres du graphique → Bougies : les couleurs conditionnelles des bougies (voir `CandleColorRule`). Même facture
 * que l'éditeur des règles d'un indicateur (`IndicatorStyleRulesEditor`) : chaque règle se lit comme une phrase,
 * « Quand [mesure] [>, <, entre] [seuil] (et / ou …) → corps en [couleur], mèche en [couleur], bordure en [couleur] ».
 * Les règles sont lues dans l'ordre : la première qui s'applique à une bougie la colore. Chaque modification
 * s'applique et s'enregistre aussitôt.
 */
export function CandleColorRulesEditor({
  rules,
  indicators,
  onChange,
}: {
  rules: CandleColorRule[];
  /** Les indicateurs du graphique : leurs courbes tracées sur les prix sont proposées à « clôture au-dessus de ». */
  indicators: Indicator[];
  onChange: (rules: CandleColorRule[]) => void;
}) {
  const series = candleSeriesOptions(indicators);
  const update = (id: string, patch: Partial<CandleColorRule>) => onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const move = (index: number, delta: number) => {
    const next = [...rules];
    const [rule] = next.splice(index, 1);
    next.splice(index + delta, 0, rule!);
    onChange(next);
  };

  return (
    <section className="lq-chart__rules lq-chart__candle-rules" aria-label="Couleurs conditionnelles des bougies">
      <div className="lq-chart__rules-head">
        <span className="lq-field__label">Couleurs conditionnelles</span>
        <span className="lq-chart__rules-hint">
          Colorez certaines bougies selon une condition (variation, amplitude, volume, position face à une moyenne…). Les
          règles sont lues dans l'ordre : la première qui s'applique colore la bougie. Elles passent devant les couleurs
          posées par un script (plot.candleColor).
        </span>
      </div>
      {rules.map((rule, k) => (
        <CandleRuleRow
          key={rule.id}
          rule={rule}
          index={k}
          count={rules.length}
          series={series}
          onPatch={(patch) => update(rule.id, patch)}
          onMove={(delta) => move(k, delta)}
          onRemove={() => onChange(rules.filter((r) => r.id !== rule.id))}
        />
      ))}
      <div className="lq-chart__rules-actions">
        <button type="button" className="lq-chart__rule-button lq-chart__rule-button--add" onClick={() => onChange([...rules, defaultCandleColorRule()])}>
          + Ajouter une règle
        </button>
      </div>
      <div className="lq-chart__rules-templates">
        <span className="lq-chart__rules-hint">Modèles :</span>
        {CANDLE_COLOR_RULE_TEMPLATES.map((t) => (
          <button key={t.id} type="button" className="lq-chart__rule-button" onClick={() => onChange([...rules, t.rule()])}>
            {t.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function CandleRuleRow({
  rule,
  index,
  count,
  series,
  onPatch,
  onMove,
  onRemove,
}: {
  rule: CandleColorRule;
  index: number;
  count: number;
  series: CandleSeriesOption[];
  onPatch: (patch: Partial<CandleColorRule>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  const enabled = rule.enabled !== false;
  const conditions = rule.conditions;
  const setCondition = (k: number, patch: Partial<CandleColorCondition>) =>
    onPatch({ conditions: conditions.map((c, j) => (j === k ? { ...c, ...patch } : c)) });

  return (
    <div className={["lq-chart__rule", !enabled && "lq-chart__rule--disabled"].filter(Boolean).join(" ")}>
      <div className="lq-chart__rule-head">
        <Checkbox
          label={rule.name ? `Règle ${n} · ${rule.name}` : `Règle ${n}`}
          checked={enabled}
          onChange={(checked) => onPatch({ enabled: checked })}
          ariaLabel={`Activer la règle de bougies ${n}`}
        />
        <span className="lq-chart__rule-tools">
          <button type="button" className="lq-chart__rule-icon" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Monter la règle de bougies ${n}`} title="Monter (priorité plus haute)">
            ↑
          </button>
          <button type="button" className="lq-chart__rule-icon" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Descendre la règle de bougies ${n}`} title="Descendre (priorité plus basse)">
            ↓
          </button>
          <button type="button" className="lq-chart__rule-button" onClick={onRemove} aria-label={`Supprimer la règle de bougies ${n}`}>
            Supprimer
          </button>
        </span>
      </div>
      {conditions.map((cond, k) => (
        <ConditionSentence
          key={k}
          cond={cond}
          ruleNumber={n}
          index={k}
          combine={rule.combine ?? "and"}
          removable={conditions.length > 1}
          series={series}
          onCombine={(combine) => onPatch({ combine })}
          onPatch={(patch) => setCondition(k, patch)}
          onRemove={() => onPatch({ conditions: conditions.filter((_, j) => j !== k) })}
        />
      ))}
      <div className="lq-chart__rule-sentence">
        <button
          type="button"
          className="lq-chart__rule-button"
          onClick={() => onPatch({ conditions: [...conditions, defaultCandleColorCondition()] })}
          aria-label={`Ajouter une condition à la règle de bougies ${n}`}
        >
          + Condition
        </button>
      </div>
      <div className="lq-chart__rule-sentence">
        <span className="lq-chart__rule-word" aria-hidden="true">
          →
        </span>
        <span className="lq-chart__rule-group">
          <span className="lq-chart__rule-word">corps</span>
          <ColorPicker
            className="lq-chart__color-input"
            value={rule.color}
            onChange={(color) => onPatch({ color })}
            aria-label={`Couleur du corps, règle de bougies ${n}`}
          />
        </span>
        <span className="lq-chart__rule-group">
          <span className="lq-chart__rule-word">mèche</span>
          <ColorPicker
            className="lq-chart__color-input"
            value={rule.wickColor || rule.color}
            onChange={(color) => onPatch({ wickColor: color })}
            aria-label={`Couleur de la mèche, règle de bougies ${n}`}
          />
        </span>
        <span className="lq-chart__rule-group">
          <span className="lq-chart__rule-word">bordure</span>
          <ColorPicker
            className="lq-chart__color-input"
            value={rule.borderColor || rule.color}
            onChange={(color) => onPatch({ borderColor: color })}
            aria-label={`Couleur de la bordure, règle de bougies ${n}`}
          />
        </span>
        {(rule.wickColor || rule.borderColor) && (
          <button type="button" className="lq-chart__rule-button" onClick={() => onPatch({ wickColor: null, borderColor: null })}>
            Comme le corps
          </button>
        )}
      </div>
    </div>
  );
}

function ConditionSentence({
  cond,
  ruleNumber,
  index,
  combine,
  removable,
  series,
  onCombine,
  onPatch,
  onRemove,
}: {
  cond: CandleColorCondition;
  ruleNumber: number;
  index: number;
  combine: "and" | "or";
  removable: boolean;
  series: CandleSeriesOption[];
  onCombine: (combine: "and" | "or") => void;
  onPatch: (patch: Partial<CandleColorCondition>) => void;
  onRemove: () => void;
}) {
  const label = `condition ${index + 1} de la règle de bougies ${ruleNumber}`;
  const numeric = isNumericMetric(cond.metric);
  const unit = CANDLE_COLOR_METRICS.find((m) => m.value === cond.metric)?.unit;
  const seriesKey = candleSeriesKey(cond.series);
  const seriesOptions: SelectOption[] = [
    ...(seriesKey && !series.some((s) => s.key === seriesKey) ? [{ value: seriesKey, label: "(courbe retirée)" }] : []),
    ...(series.length === 0 && !seriesKey ? [{ value: "", label: "(aucune courbe sur les prix)" }] : []),
    ...series.map((s) => ({ value: s.key, label: s.label })),
  ];

  const setMetric = (metric: CandleColorMetric) => {
    const patch: Partial<CandleColorCondition> = { metric, ...defaultsFor(metric) };
    if (metricUsesSeries(metric) && !cond.series && series[0]) patch.series = series[0].ref;
    onPatch(patch);
  };

  return (
    <div className="lq-chart__rule-sentence">
      {index === 0 ? (
        <span className="lq-chart__rule-word">Quand</span>
      ) : (
        <span className="lq-chart__rule-pick lq-chart__rule-pick--combine">
          <Select size="small" ariaLabel={`Liaison de la ${label}`} value={combine} options={COMBINE_OPTIONS} onChange={onCombine} />
        </span>
      )}
      <span className="lq-chart__rule-pick lq-chart__rule-pick--series">
        <Select size="small" ariaLabel={`Mesure de la ${label}`} value={cond.metric} options={METRIC_OPTIONS} onChange={setMetric} />
      </span>
      {numeric && (
        <span className="lq-chart__rule-group">
          <span className="lq-chart__rule-pick lq-chart__rule-pick--operator">
            <Select size="small" ariaLabel={`Opérateur de la ${label}`} value={cond.operator ?? "gt"} options={OPERATOR_OPTIONS} onChange={(operator) => onPatch({ operator, ...(operator === "between" && cond.value2 === undefined ? { value2: (cond.value ?? 0) + 1 } : {}) })} />
          </span>
          <span className="lq-chart__rule-pick lq-chart__rule-pick--number">
            <InputNumber size="small" step={cond.metric === "volume" ? 0.5 : 0.1} value={cond.value ?? 0} aria-label={`Seuil de la ${label}`} onChange={(v) => onPatch({ value: v === "" ? 0 : v })} />
          </span>
          {cond.operator === "between" && (
            <>
              <span className="lq-chart__rule-word">et</span>
              <span className="lq-chart__rule-pick lq-chart__rule-pick--number">
                <InputNumber size="small" step={cond.metric === "volume" ? 0.5 : 0.1} value={cond.value2 ?? 0} aria-label={`Seconde borne de la ${label}`} onChange={(v) => onPatch({ value2: v === "" ? 0 : v })} />
              </span>
            </>
          )}
          {unit && <span className="lq-chart__rule-word">{unit}</span>}
        </span>
      )}
      {metricUsesPeriod(cond.metric) && (
        <span className="lq-chart__rule-group">
          <span className="lq-chart__rule-word">{cond.metric === "volume" ? "moyenne sur" : "sur"}</span>
          <span className="lq-chart__rule-pick lq-chart__rule-pick--number">
            <InputNumber size="small" step={1} min={1} value={cond.period ?? 20} aria-label={`Nombre de bougies de la ${label}`} onChange={(v) => onPatch({ period: v === "" ? 20 : Math.max(1, Math.round(v)) })} />
          </span>
          <span className="lq-chart__rule-word">bougies</span>
        </span>
      )}
      {metricUsesSeries(cond.metric) && (
        <span className="lq-chart__rule-pick lq-chart__rule-pick--series">
          <Select
            size="small"
            ariaLabel={`Courbe de la ${label}`}
            value={seriesKey}
            options={seriesOptions}
            onChange={(key) => {
              const ref = series.find((s) => s.key === key)?.ref;
              if (ref) onPatch({ series: ref });
            }}
          />
        </span>
      )}
      {removable && (
        <button type="button" className="lq-chart__rule-icon" onClick={onRemove} aria-label={`Retirer la ${label}`} title="Retirer la condition">
          ×
        </button>
      )}
    </div>
  );
}
