import { analyzeScriptVariables } from "../scriptVariables";
import type { ScriptParamValue } from "../../interfaces/ScriptParam.interface";
import { ScriptParamsFields } from "./ScriptParamsFields";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ScriptEditorWindow } from "./ScriptEditorWindow";
import { Popover } from "../../../../forms/Popover";
import { Modal } from "../../../../primitives/Modal";
import { TextField } from "../../../../forms/TextField";
import {
  PlayIcon,
  PauseIcon,
  SaveIcon,
  SearchIcon,
  RefreshIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  EyeOffIcon,
  HelpIcon,
  ChevronDownIcon,
  CheckIcon,
} from "../../../../icons";
import type { Candle } from "../../interfaces/Candle.interface";
import type { ScriptDef } from "../../interfaces/ScriptDef.interface";
import type { ScriptRunOutput } from "../interfaces/ScriptRunOutput.interface";
import { isCellInstrumentationLog } from "../scriptCellSentinels";
import { ScriptErrorPanel } from "./ScriptErrorPanel";
import { ScriptDocumentationModal } from "./ScriptDocumentationModal";
import type { ScriptEditorCodeMirrorHandle } from "./ScriptEditorCodeMirror";
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
  /** Commits one `new Variable(...)` parameter's own value — which also re-runs the script, see
   *  useScriptingState's own doc. */
  setScriptParamValue: (id: string, name: string, value: ScriptParamValue) => void;
  resetScriptParamValues: (id: string) => void;
  runOutputs: Record<string, ScriptRunOutput>;
  /** Present only when this editor is shared across more than one chart (`ChartWorkspace`) — one
   *  entry per candidate target panel for "Exécuter". `undefined`/a single entry for a standalone
   *  chart, where there's only ever one implicit target and no picker is ever shown — exigence
   *  "si plusieurs charts sont ouvertes, on me demande sur laquelle exécuter" only applies once
   *  there's an actual choice to make. */
  panelChoices?: { index: number; label: string }[];
  /** The candles a `plot.pane`/`plot.overlay` cell's own inline preview chart draws against (see
   *  `ScriptEditorCodeMirrorProps.previewData`'s own doc) — the *active* script's own target
   *  panel's data specifically, so the preview always matches whichever chart "Exécuter" would
   *  actually run against. `undefined` before a target is chosen (no panel to draw from yet); the
   *  rest of a cell's own output still renders normally either way. */
  previewData?: Candle[];
}

const DEFAULT_SCRIPT_CODE = `// %% Cellule 1 — Affiche une série dans une panneau séparé
plot.pane("Ma série").line("Ma série", market.close(0));
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
  setScriptParamValue,
  resetScriptParamValues,
  runOutputs,
  panelChoices,
  previewData,
}: ScriptEditorPanelProps) {
  const activeScript = scripts.find((s) => s.id === activeScriptId) ?? null;
  const [draft, setDraft] = useState(activeScript?.code ?? "");
  // Only the declarations are needed here; the editor draws the diagnostics itself off the same
  // analysis (see ScriptEditorCodeMirror), so a parameter with a bad default still gets a field —
  // the error sits on the offending line rather than the panel silently going empty.
  const { params: scriptParams } = useMemo(() => analyzeScriptVariables(draft), [draft]);
  const [formatRequestId, setFormatRequestId] = useState(0);
  const [docsOpen, setDocsOpen] = useState(false);
  const [targetPickerOpen, setTargetPickerOpen] = useState(false);
  const runButtonRef = useRef<HTMLButtonElement>(null);
  const codeMirrorRef = useRef<ScriptEditorCodeMirrorHandle>(null);
  // Set only while the target picker is open because of a "Exécuter la cellule" click (Shift+Enter
  // or the toolbar button) rather than a plain "Exécuter" — `chooseTarget` below needs to know
  // which code to actually run once a target is picked, since by then `draft` alone would run the
  // *whole* script instead of just the cell that was asked for.
  const pendingRunCodeRef = useRef<string | null>(null);
  const needsTargetChoice = (panelChoices?.length ?? 0) > 1;
  // "name": the toolbar Save button's own first-ever-save prompt. "nameSaveAs": the dedicated
  // "Enregistrer sous" button's own prompt. Both render the exact same modal shell (just a
  // different title) and both funnel into the same handleNameSubmit below — unlike templates'
  // own save/save-as (a fresh template vs. overwriting the active one are genuinely different
  // outcomes), a script only ever has one identity to rename/save, so there's nothing for the two
  // triggers to actually do differently once the modal is open.
  const [modal, setModal] = useState<"name" | "nameSaveAs" | null>(null);
  const [nameValue, setNameValue] = useState("");
  // Briefly swaps the Save button's own icon to a checkmark — same silent-action feedback
  // TemplateControls' own Save button gives (see its own `justSaved` doc).
  const [justSaved, setJustSaved] = useState(false);

  function flashSaved() {
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1200);
  }

  // Case-sensitive on purpose — a script is really just a key in this list, matching every other
  // exact-string-equality id/name check already used throughout this session's own work rather
  // than inventing a normalization rule nothing else here follows.
  const nameCollision = activeScript !== null && scripts.some((s) => s.id !== activeScript.id && s.name === nameValue.trim());

  function handleSaveAsClick() {
    if (!activeScript) return;
    setNameValue(activeScript.name);
    setModal("nameSaveAs");
  }

  function handleNameSubmit() {
    if (!activeScript) return;
    const trimmed = nameValue.trim();
    if (!trimmed || nameCollision) return;
    updateScript(activeScript.id, { name: trimmed, code: draft, named: true });
    setModal(null);
    flashSaved();
  }

  // Ctrl/Cmd+S goes through this same function — see the effect below. A script that's never been
  // through the naming flow prompts for a name first (same "Untitled document" convention a text
  // editor's first save follows, see ScriptDef.named's own doc) instead of silently committing
  // under its auto-generated "Script N" name; every save after that just commits `code` in place.
  function handleSaveClick() {
    if (!activeScript) return;
    if (!activeScript.named) {
      setNameValue(activeScript.name);
      setModal("name");
      return;
    }
    updateScript(activeScript.id, { code: draft });
    flashSaved();
  }

  // Same ref-indirection reasoning as TemplateControls' own identical shortcut (see its own doc) —
  // handleSaveClick/handleNameSubmit are fresh closures every render, so reading the latest one
  // through a ref lets this listener itself mount exactly once instead of re-attaching constantly.
  const saveShortcutRef = useRef(() => {});
  saveShortcutRef.current = () => {
    if (modal === "name" || modal === "nameSaveAs") handleNameSubmit();
    else handleSaveClick();
  };
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return;
      // Scoped to focus actually being inside this floating window — unlike TemplateControls' own
      // identical shortcut (always global, no gating needed there since only one thing in this
      // library ever claims Ctrl+S at a time), this window can be open *alongside* a chart header
      // that also owns Ctrl+S for its own templates (`showTemplates`); without this check, one
      // keypress would pop both "Enregistrer le script" and "Enregistrer le modèle" at once.
      if (!(document.activeElement instanceof Element) || !document.activeElement.closest(".lq-script-window")) return;
      e.preventDefault();
      saveShortcutRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // "Exécuter" runs immediately once a target is known (a workspace script that's already been
  // assigned one) — a workspace script that's *never* been run before either pauses for the picker
  // first, when there's an actual choice to make (exigence: "si plusieurs charts sont ouvertes, on
  // me demande sur laquelle exécuter"), or — a single-panel workspace, where `panelChoices` never
  // grows past one entry and the picker's own popover would never even open — is assigned that
  // one implicit target automatically instead, via the same single `updateScript` call `chooseTarget`
  // above uses (not a separate updateScript-then-runScript pair — same stale-closure hazard noted
  // on that function's own doc). Without this, a single-panel workspace's own script would stay
  // permanently unrouted: `targetPanelIndex` never gets set by anything else, so it can never reach
  // any panel's own `scripts` prop — "Exécuter" would look like it does nothing, and the script
  // would never appear in that panel's own "Mes scripts" either.
  // `codeOverride` lets "Exécuter la cellule" (see ScriptEditorCodeMirror.tsx's own doc on `// %%`
  // cells) reuse this exact function — same target-picker flow, just a different code string —
  // instead of duplicating the targetPanelIndex/needsTargetChoice logic for a second trigger.
  function handleRunClick(codeOverride?: string) {
    if (!activeScript) return;
    const code = codeOverride ?? draft;
    if (activeScript.targetPanelIndex === undefined) {
      if (needsTargetChoice) {
        pendingRunCodeRef.current = codeOverride ?? null;
        setTargetPickerOpen(true);
        return;
      }
      updateScript(activeScript.id, {
        targetPanelIndex: panelChoices?.[0]?.index ?? 0,
        runRequestId: (activeScript.runRequestId ?? 0) + 1,
        runDraftCode: code,
      });
      return;
    }
    runScript(activeScript.id, code);
  }

  // One single updateScript call, not updateScript-then-runScript — each of those independently
  // reads the *same* stale `scripts` closure captured at this render, so calling them back to back
  // would have the second one's own `scripts.map(...)` silently discard the first one's own
  // targetPanelIndex change (confirmed as a real bug via Playwright — the target picker kept
  // reopening on every run because the choice never actually stuck). Setting the run trigger
  // fields directly here, inline, sidesteps needing a second commit entirely.
  function chooseTarget(index: number) {
    if (!activeScript) return;
    updateScript(activeScript.id, {
      targetPanelIndex: index,
      runRequestId: (activeScript.runRequestId ?? 0) + 1,
      runDraftCode: pendingRunCodeRef.current ?? draft,
    });
    pendingRunCodeRef.current = null;
    setTargetPickerOpen(false);
  }

  // Switching tabs (or the active script's own saved code changing from outside, e.g. Reset)
  // reseeds the draft — `activeScriptId` is the trigger, not `activeScript?.code` itself, so
  // typing in the editor (which only ever changes `draft`, never `activeScript.code` directly)
  // never fights this effect.
  useEffect(() => {
    setDraft(activeScript?.code ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScriptId]);

  // Forwards this script's own "latest run result" into the editor's own notebook cell-output
  // feature — see ScriptEditorCodeMirrorHandle.applyRunResult's own doc for why this is a push from
  // the host rather than something onRunCell's own return value could carry: runScript here only
  // ever writes a trigger onto the ScriptDef itself (see this file's own handleRunClick), a
  // completely separate ScriptRunner picks it up and reports back through runOutputs — there's no
  // return value anywhere in that chain to await instead. A no-op whenever this component isn't
  // actually waiting on a cell run (a plain "Exécuter" run, or another script's own output changing).
  const activeOutputResult = activeScriptId ? runOutputs[activeScriptId]?.result : undefined;
  useEffect(() => {
    if (activeOutputResult) codeMirrorRef.current?.applyRunResult(activeOutputResult);
  }, [activeOutputResult]);

  if (!open) return null;

  const output = activeScriptId ? runOutputs[activeScriptId] : undefined;
  const isDirty = activeScript !== null && draft !== activeScript.code;

  return (
    <ScriptEditorWindow
      open={open}
      onClose={onClose}
      title="Éditeur de script"
      headerActions={
        <button
          type="button"
          className="lq-script-window__header-button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setDocsOpen(true)}
          aria-label="Documentation"
          title="Documentation"
        >
          <HelpIcon size={14} />
        </button>
      }
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
              <button ref={runButtonRef} type="button" className="lq-script-editor-panel__toolbar-button" onClick={() => handleRunClick()}>
                <PlayIcon size={13} /> Exécuter
              </button>
              <button
                type="button"
                className="lq-script-editor-panel__toolbar-button"
                onClick={() => codeMirrorRef.current?.runCurrentCell()}
                title="Exécute le code depuis le début jusqu'à la fin de la cellule (// %%) où se trouve le curseur (Maj+Entrée)"
              >
                <PlayIcon size={13} /> Exécuter la cellule
              </button>
              {/* Ctrl+F opens the same panel, but a shortcut is not discoverable — and on the touch
                  layout there is no keyboard to press it on at all. */}
              <button
                type="button"
                className="lq-script-editor-panel__toolbar-button"
                onClick={() => codeMirrorRef.current?.openSearch()}
                title="Rechercher et remplacer dans le script (Ctrl+F)"
              >
                <SearchIcon size={13} /> Rechercher
              </button>
              {needsTargetChoice && (
                <button
                  type="button"
                  className="lq-script-editor-panel__target-indicator"
                  onClick={() => setTargetPickerOpen(true)}
                  title="Changer la chart cible de ce script"
                >
                  Cible : {panelChoices?.find((c) => c.index === activeScript.targetPanelIndex)?.label ?? "à choisir"}
                  <ChevronDownIcon size={11} />
                </button>
              )}
              <Popover open={targetPickerOpen} onClose={() => setTargetPickerOpen(false)} anchorRef={runButtonRef} placement="bottom">
                <div className="lq-script-editor-panel__target-menu">
                  <div className="lq-script-editor-panel__target-menu-title">Exécuter sur…</div>
                  {panelChoices?.map((choice) => (
                    <button
                      key={choice.index}
                      type="button"
                      className={[
                        "lq-script-editor-panel__target-option",
                        choice.index === activeScript.targetPanelIndex && "lq-script-editor-panel__target-option--selected",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => chooseTarget(choice.index)}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </Popover>
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
                onClick={handleSaveClick}
                disabled={activeScript.named && !isDirty}
                title="Enregistrer (Ctrl+S)"
              >
                {justSaved ? <CheckIcon size={13} /> : <SaveIcon size={13} />} Enregistrer
              </button>
              {/* Always available, regardless of `named` — renames the script and saves the
                  current draft under that new name, distinct from the toolbar Save button above
                  (which only ever prompts once, on a script's very first save). */}
              <button
                type="button"
                className="lq-script-editor-panel__toolbar-button"
                onClick={handleSaveAsClick}
                title="Enregistrer sous"
              >
                Enregistrer sous
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
              <LazyScriptEditorCodeMirror
                ref={codeMirrorRef}
                value={draft}
                onChange={setDraft}
                error={output?.result?.error ?? null}
                formatRequestId={formatRequestId}
                onRunCell={(code) => handleRunClick(code)}
                previewData={previewData}
              />
            </Suspense>
            {output?.result?.error && <ScriptErrorPanel error={output.result.error} />}
            {output?.result?.logs && output.result.logs.some((line) => !isCellInstrumentationLog(line)) && (
              <div className="lq-script-editor-panel__console">
                {output.result.logs
                  .filter((line) => !isCellInstrumentationLog(line))
                  .map((line, i) => (
                    <div key={i} className="lq-script-editor-panel__console-line">
                      {line}
                    </div>
                  ))}
              </div>
            )}
          </div>
          <div className="lq-script-editor-panel__side">
            {/* Read off the *draft*, not the saved `code` — a parameter appears in this list as
                soon as its declaration is typed, without needing a save or a run first. */}
            <section className="lq-script-editor-panel__params">
              <div className="lq-script-editor-panel__params-header">
                <h3 className="lq-script-editor-panel__params-title">Paramètres</h3>
                {scriptParams.length > 0 && (
                  <button
                    type="button"
                    className="lq-script-editor-panel__params-reset"
                    onClick={() => resetScriptParamValues(activeScript.id)}
                    title="Revenir aux valeurs par défaut écrites dans le code"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>
              <ScriptParamsFields
                params={scriptParams}
                values={activeScript.paramValues}
                onChange={(name, value) => setScriptParamValue(activeScript.id, name, value)}
              />
            </section>
          </div>
        </div>
      ) : (
        <div className="lq-script-editor-panel__empty">Aucun script — cliquez sur « + » pour en créer un.</div>
      )}
      <ScriptDocumentationModal open={docsOpen} onClose={() => setDocsOpen(false)} />

      {(modal === "name" || modal === "nameSaveAs") && (
        <Modal
          open
          onClose={() => setModal(null)}
          title={modal === "nameSaveAs" ? "Enregistrer sous" : "Enregistrer le script"}
          footer={
            <div className="lq-chart__edit-drawing-footer">
              <button type="button" className="lq-chart__reset-button" onClick={() => setModal(null)}>
                Annuler
              </button>
              <button type="button" className="lq-chart__confirm-button" onClick={handleNameSubmit} disabled={!nameValue.trim() || nameCollision}>
                Enregistrer
              </button>
            </div>
          }
        >
          <TextField
            label="Nom du script"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            placeholder="Ex. Momentum Score"
            autoFocus
            error={nameCollision ? "Un script porte déjà ce nom." : undefined}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !nameCollision) handleNameSubmit();
            }}
          />
        </Modal>
      )}
    </ScriptEditorWindow>
  );
}
