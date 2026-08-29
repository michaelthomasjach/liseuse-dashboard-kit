import { lazy, Suspense, useEffect, useState } from "react";
import { ScriptEditorWindow } from "./ScriptEditorWindow";
import { PlayIcon, PauseIcon, SaveIcon, RefreshIcon, PlusIcon, TrashIcon, EyeIcon, EyeOffIcon, HelpIcon } from "../../../../icons";
import type { Indicator } from "../../interfaces/Indicator.interface";
import type { ScriptDef } from "../../interfaces/ScriptDef.interface";
import type { ScriptRunOutput } from "../interfaces/ScriptRunOutput.interface";
import { AvailableIndicatorsList } from "./AvailableIndicatorsList";
import { ScriptErrorPanel } from "./ScriptErrorPanel";
import { ScriptDocumentationModal } from "./ScriptDocumentationModal";
import "./ScriptEditorPanel.css";

const LazyScriptEditorCodeMirror = lazy(() =>
  import("./ScriptEditorCodeMirror").then((m) => ({ default: m.ScriptEditorCodeMirror }))
);

export interface ScriptEditorPanelProps {
  open: boolean;
  onClose: () => void;
  scripts: ScriptDef[];
  activeScriptId: string | null;
  setActiveScriptId: (id: string | null) => void;
  addScript: (name?: string, code?: string) => string;
  updateScript: (id: string, patch: Partial<Omit<ScriptDef, "id">>) => void;
  removeScript: (id: string) => void;
  toggleScriptEnabled: (id: string) => void;
  runScript: (id: string, code: string) => void;
  stopScript: (id: string) => void;
  runOutputs: Record<string, ScriptRunOutput>;
  indicators: Indicator[];
}

const DEFAULT_SCRIPT_CODE = `// Nouveau script — voir la liste "Indicateurs disponibles" pour les
// identifiants chart.indicator(...) utilisables sur cette chart.
plot.line("Ma série", market.close(0));
`;

/** The script editor's own host — a `ScriptEditorWindow` (a real floating/draggable/resizable/
 *  maximizable window, not a blocking modal — see that component's own doc for why) with a
 *  script-tab strip, a Run/Stop/Save/Reset/Format toolbar, the CodeMirror instance (lazy-loaded —
 *  see ScriptEditorCodeMirror.tsx's own doc), the "AVAILABLE INDICATORS" inspection list, and the
 *  last run's own error/console output. Being a non-blocking floating window (not fullscreen) is
 *  what lets the chart underneath stay visible while editing — clicking "Exécuter" shows the
 *  result on the live chart immediately, right beside the editor, not only after closing it.
 *
 *  Owns one piece of state CodeMirror itself can't: the *draft* buffer for whichever script tab is
 *  active, separate from that script's own committed `code` — "Run" executes the draft as-is
 *  (even unsaved), "Save" commits it into the `ScriptDef` (via `updateScript`, which reports back
 *  through `onScriptsChange`), "Reset" discards the draft back to whatever's currently saved. */
export function ScriptEditorPanel({
  open,
  onClose,
  scripts,
  activeScriptId,
  setActiveScriptId,
  addScript,
  updateScript,
  removeScript,
  toggleScriptEnabled,
  runScript,
  stopScript,
  runOutputs,
  indicators,
}: ScriptEditorPanelProps) {
  const activeScript = scripts.find((s) => s.id === activeScriptId) ?? null;
  const [draft, setDraft] = useState(activeScript?.code ?? "");
  const [formatRequestId, setFormatRequestId] = useState(0);
  const [docsOpen, setDocsOpen] = useState(false);

  // Switching tabs (or the active script's own saved code changing from outside, e.g. Reset)
  // reseeds the draft — `activeScriptId` is the trigger, not `activeScript?.code` itself, so
  // typing in the editor (which only ever changes `draft`, never `activeScript.code` directly)
  // never fights this effect.
  useEffect(() => {
    setDraft(activeScript?.code ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScriptId]);

  if (!open) return null;

  const output = activeScriptId ? runOutputs[activeScriptId] : undefined;
  const isDirty = activeScript !== null && draft !== activeScript.code;

  return (
    <ScriptEditorWindow
      open={open}
      onClose={onClose}
      title="Éditeur de script"
      toolbar={
        <>
          <div className="lq-script-editor-panel__tabs">
            {scripts.map((s) => (
              <div
                key={s.id}
                className={["lq-script-editor-panel__tab", s.id === activeScriptId && "lq-script-editor-panel__tab--active"]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setActiveScriptId(s.id)}
              >
                <span className="lq-script-editor-panel__tab-name">{s.name}</span>
                <button
                  type="button"
                  className="lq-script-editor-panel__tab-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleScriptEnabled(s.id);
                  }}
                  aria-label={s.enabled === false ? "Activer ce script" : "Désactiver ce script"}
                  title={s.enabled === false ? "Activer ce script" : "Désactiver ce script"}
                >
                  {s.enabled === false ? <EyeOffIcon size={12} /> : <EyeIcon size={12} />}
                </button>
                <button
                  type="button"
                  className="lq-script-editor-panel__tab-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeScript(s.id);
                  }}
                  aria-label="Supprimer ce script"
                  title="Supprimer ce script"
                >
                  <TrashIcon size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="lq-script-editor-panel__add-tab"
              onClick={() => addScript(`Script ${scripts.length + 1}`, DEFAULT_SCRIPT_CODE)}
              aria-label="Nouveau script"
              title="Nouveau script"
            >
              <PlusIcon size={14} />
            </button>
          </div>

          {activeScript && (
            <div className="lq-script-editor-panel__toolbar">
              <button type="button" className="lq-script-editor-panel__toolbar-button" onClick={() => runScript(activeScript.id, draft)}>
                <PlayIcon size={13} /> Exécuter
              </button>
              <button
                type="button"
                className="lq-script-editor-panel__toolbar-button"
                onClick={() => stopScript(activeScript.id)}
                disabled={!output?.running}
              >
                <PauseIcon size={13} /> Arrêter
              </button>
              <button
                type="button"
                className="lq-script-editor-panel__toolbar-button"
                onClick={() => updateScript(activeScript.id, { code: draft })}
                disabled={!isDirty}
              >
                <SaveIcon size={13} /> Enregistrer
              </button>
              <button
                type="button"
                className="lq-script-editor-panel__toolbar-button"
                onClick={() => setDraft(activeScript.code)}
                disabled={!isDirty}
              >
                <RefreshIcon size={13} /> Réinitialiser
              </button>
              <button type="button" className="lq-script-editor-panel__toolbar-button" onClick={() => setFormatRequestId((n) => n + 1)}>
                Format
              </button>
              <button type="button" className="lq-script-editor-panel__toolbar-button" onClick={() => setDocsOpen(true)}>
                <HelpIcon size={13} /> Documentation
              </button>
              {output?.running && <span className="lq-script-editor-panel__status">Exécution…</span>}
            </div>
          )}
        </>
      }
    >
      {activeScript ? (
        <div className="lq-script-editor-panel__body">
          <div className="lq-script-editor-panel__main">
            <Suspense fallback={<div className="lq-script-editor-panel__loading">Chargement de l'éditeur…</div>}>
              <LazyScriptEditorCodeMirror value={draft} onChange={setDraft} error={output?.result?.error ?? null} formatRequestId={formatRequestId} />
            </Suspense>
            {output?.result?.error && <ScriptErrorPanel error={output.result.error} />}
            {output?.result?.logs && output.result.logs.length > 0 && (
              <div className="lq-script-editor-panel__console">
                {output.result.logs.map((line, i) => (
                  <div key={i} className="lq-script-editor-panel__console-line">
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="lq-script-editor-panel__side">
            <AvailableIndicatorsList indicators={indicators} />
          </div>
        </div>
      ) : (
        <div className="lq-script-editor-panel__empty">Aucun script — cliquez sur « + » pour en créer un.</div>
      )}
      <ScriptDocumentationModal open={docsOpen} onClose={() => setDocsOpen(false)} />
    </ScriptEditorWindow>
  );
}
