import { useEffect, useState } from "react";
import { TextField } from "../../../../forms/TextField";
import { NumberField } from "../../../../forms/NumberField";
import { TagInput } from "../../../../forms/TagInput";
import { Checkbox } from "../../../../forms/Checkbox";
import type { ScriptParam, ScriptParamValue } from "../../interfaces/ScriptParam.interface";
import "./ScriptParamsFields.css";

/** How long a keystroke sits before it re-runs the script. Every edit here triggers a full re-run
 *  (the whole script, every bar), which on something like the KDE example is real work — without
 *  this, typing "12" into a field would run it twice, once for "1" and once for "12". Long enough
 *  to swallow a burst of typing, short enough that a deliberate single edit still feels immediate. */
const RERUN_DEBOUNCE_MS = 350;

export interface ScriptParamsFieldsProps {
  params: ScriptParam[];
  values: Record<string, ScriptParamValue> | undefined;
  /** Called once the edit has settled — see RERUN_DEBOUNCE_MS. Committing the value is what
   *  re-runs the script, so this is deliberately not called per keystroke. */
  onChange: (name: string, value: ScriptParamValue) => void;
}

/** One field per `const NAME = new Variable(type, default)` a script declares — the settings form
 *  described by `analyzeScriptVariables`. Rendered in two places (the editor's own panel and each
 *  script-produced pane's own settings modal), which is why it's a component of its own rather than
 *  JSX inline in either: both read the same `ScriptDef.paramValues`, so a change made in one shows
 *  up in the other with no syncing of its own.
 *
 *  Holds the in-progress edit locally and reports it upward on a timer: the committed value is what
 *  re-runs the script, and running it on every keystroke would be unusable on any script that does
 *  real work per bar. */
export function ScriptParamsFields({ params, values, onChange }: ScriptParamsFieldsProps) {
  const [drafts, setDrafts] = useState<Record<string, ScriptParamValue>>({});

  // A value that changed *elsewhere* (the other panel, a template load, a script edit that moved
  // the default) has to win over a stale local draft — keyed by the committed values themselves, so
  // this only fires when they actually change rather than on every render.
  useEffect(() => {
    setDrafts({});
  }, [values]);

  useEffect(() => {
    const names = Object.keys(drafts);
    if (names.length === 0) return;
    const timer = window.setTimeout(() => {
      for (const name of names) onChange(name, drafts[name]);
      setDrafts({});
    }, RERUN_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drafts]);

  function effectiveValue(param: ScriptParam): ScriptParamValue {
    if (param.name in drafts) return drafts[param.name];
    const stored = values?.[param.name];
    return stored === undefined ? param.defaultValue : stored;
  }

  function setDraft(name: string, value: ScriptParamValue) {
    setDrafts((prev) => ({ ...prev, [name]: value }));
  }

  if (params.length === 0) {
    return (
      <p className="lq-script-params__empty">
        Ce script ne déclare aucun paramètre. Ajoutez{" "}
        <code>const NOM = new Variable("number", 1, {'{'} description: "…" {'}'})</code> pour en créer un.
      </p>
    );
  }

  return (
    <div className="lq-script-params">
      {params.map((param) => {
        const value = effectiveValue(param);

        if (param.type === "number") {
          return (
            <NumberField
              key={param.name}
              label={param.name}
              helperText={param.description}
              value={typeof value === "number" ? value : ""}
              // An empty field is a transient editing state, not a value — keeping the last real
              // number means clearing the box never commits a NaN into a running script.
              onChange={(v) => setDraft(param.name, v === "" ? (typeof value === "number" ? value : param.defaultValue) : v)}
            />
          );
        }

        if (param.type === "color") {
          return (
            <div className="lq-field" key={param.name}>
              <label className="lq-field__label">{param.name}</label>
              <input
                type="color"
                className="lq-chart__color-input"
                value={typeof value === "string" ? value : "#000000"}
                onChange={(e) => setDraft(param.name, e.target.value)}
              />
              {/* The color input is hand-rolled rather than a `lq-field` component, so its helper
                  text has to be written out here to match what the other field types render. */}
              {param.description && <span className="lq-field__helper">{param.description}</span>}
            </div>
          );
        }

        if (param.type === "boolean") {
          return (
            <div className="lq-field" key={param.name}>
              <Checkbox checked={typeof value === "boolean" ? value : false} onChange={(checked) => setDraft(param.name, checked)} label={param.name} />
              {param.description && <span className="lq-field__helper">{param.description}</span>}
            </div>
          );
        }

        if (param.type === "string") {
          return (
            <TextField
              key={param.name}
              label={param.name}
              helperText={param.description}
              value={typeof value === "string" ? value : ""}
              onChange={(e) => setDraft(param.name, e.target.value)}
            />
          );
        }

        // Array[string] / Array[number] — both edited as chips. The numeric one parses on the way
        // out and simply drops anything that isn't a number, so the committed value always matches
        // the declared type even though the input itself is textual.
        const asStrings = Array.isArray(value) ? value.map((entry) => String(entry)) : [];
        return (
          <TagInput
            key={param.name}
            label={param.name}
            value={asStrings}
            placeholder={param.type === "Array[number]" ? "Nombre puis Entrée" : "Valeur puis Entrée"}
            helperText={[param.description, param.type === "Array[number]" ? "Les entrées non numériques sont ignorées." : null].filter(Boolean).join(" ") || undefined}
            onChange={(tags) =>
              setDraft(
                param.name,
                param.type === "Array[number]" ? tags.map((t) => Number(t)).filter((n) => Number.isFinite(n)) : tags
              )
            }
          />
        );
      })}
    </div>
  );
}
