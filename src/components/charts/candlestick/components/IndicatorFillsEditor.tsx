import { Checkbox } from "../../../forms/Checkbox";
import { InputNumber } from "../../../forms/InputNumber";
import { Select } from "../../../forms/Select";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { IndicatorFill } from "../interfaces/IndicatorFill.interface";
import { indicatorCatalogEntry } from "../indicatorCatalog";
import { VOLUME_PANE_ID } from "../attachedIndicators";
import { DEFAULT_FILL_OPACITY } from "../render/drawIndicatorFills";

const UP = "#26a69a";
const DOWN = "#ef5350";

/** Indicateurs qui ne sont pas une courbe : rien à remplir sous eux. */
const NOT_A_LINE = new Set<string>([
  "zigzag",
  "tpo",
  "supportResistance",
  "patternRecognition",
  "candleRecognition",
  "gaps",
  "pivotPoints",
  "parabolicSar",
  "headShoulders",
  "cupHandle",
]);

/** Un indicateur dont la courbe peut recevoir des zones colorées. */
export function supportsFills(indicator: Indicator): boolean {
  return !NOT_A_LINE.has(indicator.kind) && indicator.customData?.draw !== "multi";
}

/** La référence la plus parlante pour une nouvelle zone : le milieu d'un oscillateur, 0 pour un volume ou une MACD, le
 *  cours pour une moyenne tracée sur les prix. */
function defaultFill(indicator: Indicator): IndicatorFill {
  const id = `fill-${Date.now().toString(36)}`;
  if (indicator.sourceId === VOLUME_PANE_ID)
    return { id, reference: "level", level: 0, aboveColor: indicator.color ?? "#2962ff", belowColor: null, opacity: 20 };
  const pane = indicatorCatalogEntry(indicator).pane;
  if (pane === "price") return { id, reference: "close", aboveColor: DOWN, belowColor: UP, opacity: DEFAULT_FILL_OPACITY };
  const middle = (["rsi", "chop", "stochastic", "mfi", "williamsR"] as string[]).includes(indicator.kind) ? 50 : 0;
  return { id, reference: "level", level: middle, aboveColor: UP, belowColor: DOWN, opacity: DEFAULT_FILL_OPACITY };
}

/**
 * Onglet Style : les zones colorées d'un indicateur. Chaque zone colore l'espace entre la courbe et une référence (un
 * niveau, ou le cours) : une couleur quand la courbe est au-dessus, une autre en dessous, chacune activable à part. On
 * peut en empiler plusieurs (un RSI vert au-dessus de 50 et rouge en dessous, plus une bande plus vive au-delà de 70…).
 */
export function IndicatorFillsEditor({ indicator, onChange }: { indicator: Indicator; onChange: (fills: IndicatorFill[]) => void }) {
  if (!supportsFills(indicator)) return null;
  const fills = indicator.fills ?? [];
  const onPrice = indicatorCatalogEntry(indicator).pane === "price";
  const update = (id: string, patch: Partial<IndicatorFill>) => onChange(fills.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const referenceOptions = [
    { value: "level", label: "Un niveau fixe" },
    ...(onPrice ? [{ value: "close", label: "Le cours de clôture" }] : []),
  ];

  return (
    <section className="lq-chart__fills">
      <div className="lq-chart__fills-head">
        <span className="lq-field__label">Zones colorées</span>
        <span className="lq-chart__fills-hint">Colore l'espace entre la courbe et une référence : une couleur au-dessus, une autre en dessous.</span>
      </div>
      {fills.map((fill, k) => (
        <div key={fill.id} className="lq-chart__fill">
          <div className="lq-chart__fill-title">
            <span>Zone {k + 1}</span>
            <button type="button" className="lq-chart__fill-remove" onClick={() => onChange(fills.filter((f) => f.id !== fill.id))} aria-label={`Supprimer la zone ${k + 1}`}>
              Supprimer
            </button>
          </div>
          <div className="lq-chart__edit-drawing-row">
            <Select
              label="Entre la courbe et"
              value={fill.reference}
              onChange={(v) => update(fill.id, { reference: v as IndicatorFill["reference"] })}
              options={referenceOptions}
            />
            {fill.reference === "level" && (
              <InputNumber
                label="Niveau"
                step={1}
                value={fill.level ?? 0}
                onChange={(v) => update(fill.id, { level: v === "" ? 0 : v })}
              />
            )}
          </div>
          <div className="lq-chart__edit-drawing-row">
            <div className="lq-chart__fill-side">
              <Checkbox
                label="Au-dessus"
                checked={!!fill.aboveColor}
                onChange={(checked) => update(fill.id, { aboveColor: checked ? UP : null })}
              />
              {fill.aboveColor && (
                <input
                  type="color"
                  className="lq-chart__fill-swatch"
                  value={fill.aboveColor}
                  onChange={(e) => update(fill.id, { aboveColor: e.target.value })}
                  aria-label="Couleur au-dessus"
                />
              )}
            </div>
            <div className="lq-chart__fill-side">
              <Checkbox
                label="En dessous"
                checked={!!fill.belowColor}
                onChange={(checked) => update(fill.id, { belowColor: checked ? DOWN : null })}
              />
              {fill.belowColor && (
                <input
                  type="color"
                  className="lq-chart__fill-swatch"
                  value={fill.belowColor}
                  onChange={(e) => update(fill.id, { belowColor: e.target.value })}
                  aria-label="Couleur en dessous"
                />
              )}
            </div>
          </div>
          <label className="lq-chart__settings-opacity">
            <span>Opacité : {fill.opacity ?? DEFAULT_FILL_OPACITY} %</span>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={fill.opacity ?? DEFAULT_FILL_OPACITY}
              onChange={(e) => update(fill.id, { opacity: Number(e.target.value) })}
              aria-label={`Opacité de la zone ${k + 1}`}
            />
          </label>
        </div>
      ))}
      <button type="button" className="lq-chart__fill-add" onClick={() => onChange([...fills, defaultFill(indicator)])}>
        + Ajouter une zone colorée
      </button>
    </section>
  );
}
