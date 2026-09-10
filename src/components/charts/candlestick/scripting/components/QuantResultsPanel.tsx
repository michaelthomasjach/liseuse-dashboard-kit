import { useState } from "react";
import type { QuantResult, QuantSymbolResult } from "../interfaces/ScriptRunResult.interface";
import type { QuantSavedRun } from "../../interfaces/ScriptDef.interface";
import "./QuantResultsPanel.css";

export interface QuantResultsPanelProps {
  /** The run that just finished, or null when this analysis has not been run in this session. */
  result: QuantResult | null;
  /** Runs the user chose to keep, newest first — see `ScriptDef.quantRuns`. */
  savedRuns: QuantSavedRun[];
  onSave: (rows: QuantSymbolResult[], ranAt: number) => void;
  onRemoveSaved: (runId: string) => void;
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

/** One returned value, printed.
 *
 *  A quant script returns whatever it likes — this library never interprets it, the same stance it
 *  takes on `data` and `events` — so the honest rendering is the shape itself: a flat object as a
 *  list of its own fields, an array of flat objects as a table, anything else as JSON. Guessing
 *  further (a "score" column, a chart) would be inventing meaning the script never declared. */
function ReturnedValue({ value }: { value: unknown }) {
  if (value === undefined || value === null) {
    return <p className="lq-quant__empty">Cette analyse n'a rien renvoyé pour ce symbole.</p>;
  }
  if (typeof value !== "object") {
    return <p className="lq-quant__scalar">{String(value)}</p>;
  }

  const rows = Array.isArray(value) ? value : null;
  const isFlatRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v) && Object.values(v).every((f) => typeof f !== "object" || f === null);

  if (rows !== null && rows.length > 0 && rows.every(isFlatRecord)) {
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    return (
      <div className="lq-quant__table-wrap">
        <table className="lq-quant__table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c}>{row[c] === undefined || row[c] === null ? "—" : String(row[c])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (isFlatRecord(value)) {
    return (
      <dl className="lq-quant__fields">
        {Object.entries(value).map(([key, field]) => (
          <div key={key} className="lq-quant__field">
            <dt>{key}</dt>
            <dd>{field === null ? "—" : String(field)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return <pre className="lq-quant__json">{JSON.stringify(value, null, 2)}</pre>;
}

function SymbolRows({ rows }: { rows: QuantSymbolResult[] }) {
  return (
    <div className="lq-quant__symbols">
      {rows.map((row) => (
        <section key={row.symbol} className="lq-quant__symbol">
          <h4 className="lq-quant__symbol-name">{row.symbol}</h4>
          {row.error ? <p className="lq-quant__error">{row.error.message}</p> : <ReturnedValue value={row.value} />}
        </section>
      ))}
    </div>
  );
}

/** What a `@quant` analysis returned, and the runs kept from before.
 *
 *  Kept runs are the point of the panel as much as the last one is: a quant analysis covers a list
 *  of symbols, each a full pass over its own history, and its answer is a fact about a moment
 *  rather than a live reading — so consulting yesterday's should not mean paying for it again. */
export function QuantResultsPanel({ result, savedRuns, onSave, onRemoveSaved }: QuantResultsPanelProps) {
  // Which kept run is being read, or null for the one that just ran. Local: nothing outside this
  // panel has any use for where the reader currently is in its own history.
  const [openSavedId, setOpenSavedId] = useState<string | null>(null);
  const openSaved = savedRuns.find((r) => r.id === openSavedId) ?? null;
  const shown = openSaved ?? result;

  return (
    <section className="lq-quant">
      <div className="lq-quant__header">
        <h3 className="lq-quant__title">Analyse</h3>
        {result !== null && openSaved === null && (
          <button type="button" className="lq-quant__save" onClick={() => onSave(result.rows, result.ranAt)}>
            Enregistrer ce résultat
          </button>
        )}
      </div>

      {savedRuns.length > 0 && (
        <div className="lq-quant__runs" role="tablist" aria-label="Résultats enregistrés">
          <button
            type="button"
            role="tab"
            aria-selected={openSaved === null}
            className={["lq-quant__run", openSaved === null && "lq-quant__run--active"].filter(Boolean).join(" ")}
            onClick={() => setOpenSavedId(null)}
            disabled={result === null}
          >
            Dernier calcul
          </button>
          {savedRuns.map((run) => (
            <span key={run.id} className="lq-quant__run-wrap">
              <button
                type="button"
                role="tab"
                aria-selected={openSavedId === run.id}
                className={["lq-quant__run", openSavedId === run.id && "lq-quant__run--active"].filter(Boolean).join(" ")}
                onClick={() => setOpenSavedId(run.id)}
              >
                {run.label ?? dateFormat.format(new Date(run.ranAt))}
              </button>
              <button
                type="button"
                className="lq-quant__run-remove"
                onClick={() => {
                  if (openSavedId === run.id) setOpenSavedId(null);
                  onRemoveSaved(run.id);
                }}
                aria-label={`Supprimer le résultat du ${dateFormat.format(new Date(run.ranAt))}`}
                title="Supprimer ce résultat"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {shown === null ? (
        <p className="lq-quant__empty">Exécutez l'analyse pour voir ses résultats.</p>
      ) : (
        <>
          <p className="lq-quant__ran-at">Calculé le {dateFormat.format(new Date(shown.ranAt))}</p>
          <SymbolRows rows={shown.rows} />
        </>
      )}
    </section>
  );
}
