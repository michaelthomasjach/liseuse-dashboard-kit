import { useState } from "react";
import { Modal } from "../../../primitives/Modal";
import { TrashIcon } from "../../../icons";
import { INDICATOR_CATALOG, indicatorLabel } from "../indicatorCatalog";
import {
  DEFAULT_MARKET_STATE_SETTINGS,
  DEFAULT_SOURCE_SETTING,
  isDefaultMarketStateSettings,
  sourceSetting,
  type MarketStateSettings,
  type MarketStateSourceSetting,
} from "../marketStateSettings";
import type { MarketStateAxis, MarketStateContribution } from "../marketState";
import type { Indicator } from "../interfaces/Indicator.interface";
import "./MarketStateSettingsModal.css";

export interface MarketStateSettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: MarketStateSettings;
  onChange: (settings: MarketStateSettings) => void;
  /** Every source currently feeding the readout, grouped by axis — the list of rows to offer, and
   *  what each one currently reads. Taken from the live state rather than from a static catalogue
   *  so the settings can only ever offer what is actually being counted. */
  sources: { axis: MarketStateAxis; axisLabel: string; contributions: MarketStateContribution[] }[];
}

/** The five value columns, and one sentence each. */
const COLUMNS: { label: string; what: string }[] = [
  { label: "Lit", what: "Ce que cette source vaut actuellement, sur 100. Coloré du côté où ses seuils la placent." },
  { label: "Compte", what: "Décochée, la source quitte son axe : elle ne vote pas et ne pèse rien. Ce n'est pas la même chose qu'un vote neutre." },
  { label: "Poids", what: "Multiplie l'influence de la source dans son axe. 0,5 la divise par deux, 2 la double." },
  { label: "Long ≥", what: "À partir de ce score, la source vote long." },
  { label: "Short ≤", what: "À ce score ou en dessous, elle vote short. Entre les deux seuils, elle est neutre." },
];

const AXIS_LABELS: { axis: MarketStateAxis; label: string; note: string }[] = [
  { axis: "trend", label: "Tendance", note: "Dans quel sens, et avec quelle conviction." },
  { axis: "momentum", label: "Momentum", note: "La vitesse du mouvement en cours." },
  { axis: "flow", label: "Flux", note: "Si les échanges accompagnent le mouvement." },
  { axis: "risk", label: "Risque", note: "Compte à l'envers : un risque élevé pousse vers le short." },
  { axis: "volatility", label: "Volatilité", note: "À 0 par défaut : elle amplifie autant un bon signal qu'un mauvais." },
];

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  hint?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="lq-ms-settings__field">
      <span className="lq-ms-settings__field-label">{label}</span>
      <input
        type="number"
        className="lq-ms-settings__number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
      />
      {hint && <span className="lq-ms-settings__field-hint">{hint}</span>}
    </label>
  );
}

/** Everything the Market State readout can be tuned by, in one place: how far it looks back, how
 *  much each axis counts, and — the part that makes it an analysis tool rather than a gauge — what
 *  each individual source is worth and where its own long / neutral / short thresholds sit.
 *
 *  The source list is built from the live reading, not from a catalogue of everything that could
 *  ever contribute. That is the same rule the panel itself follows: you tune what is being counted,
 *  and adding an indicator to the chart is what makes a row appear. The one exception is the last
 *  section, which adds indicators the readout reads without the chart drawing them — stated as an
 *  exception, in its own block, rather than blurring the rule. */
export function MarketStateSettingsModal({ open, onClose, settings, onChange, sources }: MarketStateSettingsModalProps) {
  const [kindToAdd, setKindToAdd] = useState<string>("");

  function setSource(label: string, patch: Partial<MarketStateSourceSetting>) {
    const current = sourceSetting(settings, label);
    const next = { ...current, ...patch };
    // Stored only while it differs from the defaults, so "réinitialiser" has something honest to
    // compare against and a settings object does not fill up with rows that say nothing.
    const differs =
      next.enabled !== DEFAULT_SOURCE_SETTING.enabled ||
      next.weight !== DEFAULT_SOURCE_SETTING.weight ||
      next.longAbove !== DEFAULT_SOURCE_SETTING.longAbove ||
      next.shortBelow !== DEFAULT_SOURCE_SETTING.shortBelow;
    const entries = { ...settings.sources };
    if (differs) entries[label] = next;
    else delete entries[label];
    onChange({ ...settings, sources: entries });
  }

  function addIndicator() {
    const entry = INDICATOR_CATALOG.find((candidate) => candidate.kind === kindToAdd);
    if (!entry) return;
    const indicator: Indicator = {
      id: `market-state-${entry.kind}-${settings.extraIndicators.length + 1}`,
      kind: entry.kind,
      period: entry.defaultPeriod,
    };
    onChange({ ...settings, extraIndicators: [...settings.extraIndicators, indicator] });
    setKindToAdd("");
  }

  if (!open) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Réglages de l'état du marché"
      size="wide"
      footer={
        <div className="lq-chart__edit-drawing-footer">
          <button
            type="button"
            className="lq-chart__reset-button"
            disabled={isDefaultMarketStateSettings(settings)}
            onClick={() => onChange(DEFAULT_MARKET_STATE_SETTINGS)}
          >
            Tout réinitialiser
          </button>
          <button type="button" className="lq-chart__confirm-button" onClick={onClose}>
            Fermer
          </button>
        </div>
      }
    >
      <div className="lq-ms-settings">
        <section className="lq-ms-settings__section">
          <h4 className="lq-ms-settings__title">Lecture</h4>
          <div className="lq-ms-settings__fields">
            <NumberField
              label="Fenêtre"
              value={settings.lookback}
              min={20}
              max={1000}
              step={10}
              hint="Barres sur lesquelles « haut pour cet instrument » est jugé."
              onChange={(lookback) => onChange({ ...settings, lookback })}
            />
            <NumberField
              label="Bande neutre"
              value={settings.neutralBand}
              min={0}
              max={40}
              hint="Écart au milieu en deçà duquel le signal n'a pas de camp."
              onChange={(neutralBand) => onChange({ ...settings, neutralBand })}
            />
            <NumberField
              label="Lissage des zones"
              value={settings.bandSmoothing}
              min={1}
              max={50}
              hint="1 = les zones colorées disent exactement ce que dit le panneau, barre par barre."
              onChange={(bandSmoothing) => onChange({ ...settings, bandSmoothing })}
            />
          </div>
        </section>

        <section className="lq-ms-settings__section">
          <h4 className="lq-ms-settings__title">Poids des axes dans le signal</h4>
          <p className="lq-ms-settings__note">
            Ce que chaque axe pèse dans le mélange. Un axe à 0 ne compte pas, et ses sources ne votent pas non plus dans la
            répartition long / neutre / short.
          </p>
          <div className="lq-ms-settings__fields">
            {AXIS_LABELS.map(({ axis, label, note }) => (
              <NumberField
                key={axis}
                label={label}
                value={settings.axisWeights[axis] ?? 0}
                min={0}
                max={2}
                step={0.05}
                hint={note}
                onChange={(weight) => onChange({ ...settings, axisWeights: { ...settings.axisWeights, [axis]: weight } })}
              />
            ))}
          </div>
        </section>

        <section className="lq-ms-settings__section">
          <h4 className="lq-ms-settings__title">Sources</h4>
          <p className="lq-ms-settings__note">
            Pour chaque source : si elle compte, combien elle pèse, et à partir de quel score sur 100 elle lit long ou
            short. Entre les deux seuils, elle est neutre — c'est ce vote-là qui alimente la répartition en haut du
            panneau.
          </p>
          {sources.map(({ axis, axisLabel, contributions }) =>
            contributions.length === 0 ? null : (
              <div key={axis} className="lq-ms-settings__group">
                <div className="lq-ms-settings__group-label">{axisLabel}</div>
                <table className="lq-ms-settings__table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      {COLUMNS.map((column) => (
                        <th key={column.label}>
                          {column.label}
                          {/* The column names are four words carrying four different ideas, and a
                              table of coefficients is exactly where a reader stops to wonder which
                              is which. `title` rather than a modal: the answer is one sentence. */}
                          <abbr className="lq-ms-settings__what" title={column.what}>
                            ?
                          </abbr>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contributions.map((contribution) => {
                      const setting = sourceSetting(settings, contribution.label);
                      return (
                        <tr key={contribution.label}>
                          <td>
                            {contribution.label}
                            {contribution.offChart && <span className="lq-ms-settings__off-chart">hors graphique</span>}
                          </td>
                          <td className={`lq-ms-settings__reads lq-ms-settings__reads--${contribution.direction}`}>
                            {/* Rounded: this is a 0-100 score, and the raw float printed
                                `89.4444444444444` across half the row. */}
                            {Math.round(contribution.score)}
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              checked={setting.enabled}
                              onChange={(e) => setSource(contribution.label, { enabled: e.target.checked })}
                              aria-label={`Compter ${contribution.label}`}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="lq-ms-settings__number lq-ms-settings__number--tight"
                              value={setting.weight}
                              min={0}
                              max={5}
                              step={0.25}
                              onChange={(e) => setSource(contribution.label, { weight: Math.max(0, Number(e.target.value) || 0) })}
                              aria-label={`Poids de ${contribution.label}`}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="lq-ms-settings__number lq-ms-settings__number--tight"
                              value={setting.longAbove}
                              min={0}
                              max={100}
                              onChange={(e) => setSource(contribution.label, { longAbove: Number(e.target.value) || 0 })}
                              aria-label={`Seuil long de ${contribution.label}`}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="lq-ms-settings__number lq-ms-settings__number--tight"
                              value={setting.shortBelow}
                              min={0}
                              max={100}
                              onChange={(e) => setSource(contribution.label, { shortBelow: Number(e.target.value) || 0 })}
                              aria-label={`Seuil short de ${contribution.label}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </section>

        <section className="lq-ms-settings__section">
          <h4 className="lq-ms-settings__title">Indicateurs hors graphique</h4>
          <p className="lq-ms-settings__note">
            Lus par l'état du marché sans être dessinés sur le graphique. Le panneau ne montre normalement que ce qui est à
            l'écran ; ceux-ci sont l'exception, et ils sont marqués comme tels partout où ils apparaissent.
          </p>
          <div className="lq-ms-settings__add">
            <select
              className="lq-ms-settings__select"
              value={kindToAdd}
              onChange={(e) => setKindToAdd(e.target.value)}
              aria-label="Indicateur à ajouter"
            >
              <option value="">Choisir un indicateur…</option>
              {INDICATOR_CATALOG.map((entry) => (
                <option key={entry.kind} value={entry.kind}>
                  {entry.label}
                </option>
              ))}
            </select>
            <button type="button" className="lq-chart__confirm-button" disabled={kindToAdd === ""} onClick={addIndicator}>
              Ajouter
            </button>
          </div>
          {settings.extraIndicators.length > 0 && (
            <>
            <ul className="lq-ms-settings__extras">
              {settings.extraIndicators.map((indicator) => {
                const entry = INDICATOR_CATALOG.find((candidate) => candidate.kind === indicator.kind);
                return (
                  <li key={indicator.id} className="lq-ms-settings__extra">
                    <span className="lq-ms-settings__extra-name">{indicatorLabel(indicator)}</span>
                    {/* Its own settings, here rather than nowhere: an indicator added with its
                        default period is an indicator someone will want at another period, and it
                        is not on the chart to be opened from there. Its long / neutral / short
                        thresholds are not repeated — they live in the table above, in the axis it
                        feeds, beside every other source's. */}
                    {entry?.hasPeriod && (
                      <label className="lq-ms-settings__extra-field">
                        Période
                        <input
                          type="number"
                          className="lq-ms-settings__number lq-ms-settings__number--tight"
                          value={indicator.period}
                          min={1}
                          max={500}
                          onChange={(e) => {
                            const period = Math.max(1, Math.min(500, Math.round(Number(e.target.value) || 1)));
                            onChange({
                              ...settings,
                              extraIndicators: settings.extraIndicators.map((other) =>
                                other.id === indicator.id ? { ...other, period } : other
                              ),
                            });
                          }}
                          aria-label={`Période de ${indicatorLabel(indicator)}`}
                        />
                      </label>
                    )}
                    {entry?.hasStdDev && (
                      <label className="lq-ms-settings__extra-field">
                        Écarts-types
                        <input
                          type="number"
                          className="lq-ms-settings__number lq-ms-settings__number--tight"
                          value={indicator.stdDev ?? 2}
                          min={0.5}
                          max={5}
                          step={0.5}
                          onChange={(e) => {
                            const stdDev = Math.max(0.5, Math.min(5, Number(e.target.value) || 2));
                            onChange({
                              ...settings,
                              extraIndicators: settings.extraIndicators.map((other) =>
                                other.id === indicator.id ? { ...other, stdDev } : other
                              ),
                            });
                          }}
                          aria-label={`Écarts-types de ${indicatorLabel(indicator)}`}
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      className="lq-chart__pane-header-action"
                      aria-label={`Retirer ${indicatorLabel(indicator)}`}
                      onClick={() =>
                        onChange({ ...settings, extraIndicators: settings.extraIndicators.filter((e) => e.id !== indicator.id) })
                      }
                    >
                      <TrashIcon size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="lq-ms-settings__note">
              Les seuils long / neutre / short d&apos;un indicateur ajouté se règlent dans le tableau ci-dessus, dans
              l&apos;axe qu&apos;il alimente — au même endroit que ceux de toutes les autres sources.
            </p>
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}
