import { analyzeScriptVariables } from "../scriptVariables";
import { shortcutLabel } from "../../../internal/platformShortcut";
import type { ScriptParam, ScriptParamValue } from "../../interfaces/ScriptParam.interface";
import { ScriptParamsFields } from "./ScriptParamsFields";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ScriptEditorWindow } from "./ScriptEditorWindow";
import { DetachedWindow } from "../../components/DetachedWindow";
import { ScriptFileTabs } from "./ScriptFileTabs";
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
  CloseIcon,
  EyeIcon,
  EyeOffIcon,
  HelpIcon,
  ChevronDownIcon,
  CheckIcon,
} from "../../../../icons";
import type { Candle } from "../../interfaces/Candle.interface";
import type { ScriptDef, ScriptFile } from "../../interfaces/ScriptDef.interface";
import type { ScriptDraft } from "../../hooks/useScriptingState";
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
  /** Offers a button to tear the editor out into a real browser window; absent means the host
   *  does not support it. */
  onRequestDetach?: () => void;
  /** Renders inside that detached window: no floating-window chrome (see ScriptEditorWindow). */
  detached?: boolean;
  /** Which scripts have a tab. Everything else lives behind the search field — see the tab strip. */
  openScriptIds: string[];
  openScript: (id: string) => void;
  /** Closes a tab. Never deletes: that is `removeScript`, reached from the picker instead. */
  closeScript: (id: string) => void;
  /** Unsaved buffers by script id, absent once saved (see `ScriptDraft`). */
  drafts: Record<string, ScriptDraft>;
  setScriptDraft: (id: string, draft: ScriptDraft | null) => void;
  activeScriptId: string | null;
  setActiveScriptId: (id: string | null) => void;
  addScript: (name?: string, code?: string) => string;
  updateScript: (id: string, patch: Partial<Omit<ScriptDef, "id">>) => void;
  toggleScriptEnabled: (id: string) => void;
  runScript: (id: string, code: string, files?: ScriptFile[]) => void;
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

const DEFAULT_SCRIPT_CODE = `@indicator

@block Cellule 1 — Affiche une série dans une panneau séparé
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
  onRequestDetach,
  detached,
  openScriptIds,
  openScript,
  closeScript,
  drafts,
  setScriptDraft,
  activeScriptId,
  setActiveScriptId,
  addScript,
  updateScript,
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
  // The edit buffer for whichever tab is active, read from the per-script drafts the scripting
  // state holds and falling back to what is committed. Per-script rather than one buffer for the
  // active tab, which is what this used to be: switching tabs reseeded that single buffer from the
  // newly-active script, so edits on the tab being left were silently discarded — and no tab could
  // report itself unsaved, because nothing remembered that it was.
  const activeDraft = activeScriptId === null ? undefined : drafts[activeScriptId];
  const draft = activeDraft?.code ?? activeScript?.code ?? "";
  // A script's extra files, drafted the same way the entry is: edited here, committed to the
  // ScriptDef only on save. `activeFile` is the *name* of the file being edited, or `null` for the
  // entry — a name rather than an index so adding or removing a file can't silently move the
  // selection onto a different one.
  // Memoized because the `?? []` fallback would otherwise be a fresh array every render, which is
  // enough on its own to invalidate every useMemo downstream that reads it.
  const draftFiles = useMemo(() => activeDraft?.files ?? activeScript?.files ?? [], [activeDraft?.files, activeScript?.files]);

  function setDraft(next: string) {
    if (activeScript) setScriptDraft(activeScript.id, { code: next, files: draftFiles });
  }
  // Same call shape the useState setter had, so every existing call site reads unchanged.
  function setDraftFiles(update: ScriptFile[] | ((files: ScriptFile[]) => ScriptFile[])) {
    if (activeScript) setScriptDraft(activeScript.id, { code: draft, files: typeof update === "function" ? update(draftFiles) : update });
  }

  /** Whether a script has edits that have not been committed. A draft entry exists only while
   *  something has been typed, so this is normally just a lookup; the comparison covers the case
   *  where an edit was typed and then undone back to the saved text, which should stop counting
   *  as unsaved. */
  function isScriptDirty(s: ScriptDef): boolean {
    const d = drafts[s.id];
    return d !== undefined && (d.code !== s.code || JSON.stringify(d.files) !== JSON.stringify(s.files ?? []));
  }
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileModal, setFileModal] = useState<{ mode: "add" | "rename"; target: string | null } | null>(null);
  const [fileNameValue, setFileNameValue] = useState("");
  const editedFile = activeFile === null ? null : draftFiles.find((f) => f.name === activeFile) ?? null;
  // What CodeMirror actually shows. Falls back to the entry whenever the selected file has gone
  // (deleted, or the script was switched) rather than rendering an empty editor with no explanation.
  const editorValue = editedFile ? editedFile.code : draft;

  function setEditorValue(next: string) {
    if (editedFile === null) setDraft(next);
    else setDraftFiles((files) => files.map((f) => (f.name === editedFile.name ? { ...f, code: next } : f)));
  }

  /** A file name that can be typed after `import … from "./"` — no extension, no path, no spaces,
   *  which is also exactly what keeps the worker's own resolution (`./x`, `x`, `x.js` all meaning
   *  the same file) unambiguous. */
  function normalizeFileName(raw: string): string {
    return raw.trim().replace(/^\.\//, "").replace(/\.js$/i, "").replace(/[^A-Za-z0-9_-]/g, "-").replace(/^-+|-+$/g, "");
  }

  const normalizedFileName = normalizeFileName(fileNameValue);
  const fileNameCollision =
    normalizedFileName !== "" && draftFiles.some((f) => f.name === normalizedFileName && f.name !== fileModal?.target);

  function submitFileName() {
    if (!fileModal || normalizedFileName === "" || fileNameCollision) return;
    if (fileModal.mode === "add") {
      // Seeded with an export rather than an empty buffer — the one thing a new file always needs
      // is something for the entry to import, and an empty file gives no hint that it should.
      setDraftFiles((files) => [
        ...files,
        { name: normalizedFileName, code: `// ${normalizedFileName}.js

export function hello() {
  return "${normalizedFileName}";
}
` },
      ]);
      setActiveFile(normalizedFileName);
    } else if (fileModal.target !== null) {
      const previous = fileModal.target;
      setDraftFiles((files) => files.map((f) => (f.name === previous ? { ...f, name: normalizedFileName } : f)));
      setActiveFile((current) => (current === previous ? normalizedFileName : current));
    }
    setFileModal(null);
  }

  function removeFile(name: string) {
    setDraftFiles((files) => files.filter((f) => f.name !== name));
    setActiveFile((current) => (current === name ? null : current));
  }

  // Only the declarations are needed here; the editor draws the diagnostics itself off the same
  // analysis (see ScriptEditorCodeMirror), so a parameter with a bad default still gets a field —
  // the error sits on the offending line rather than the panel silently going empty.
  // Across every file, not just the entry: a parameter declared in a module still needs its own
  // field, and `withParams` substitutes it there too (see ScriptRunner's own `filesWithParams`).
  // First declaration wins on a duplicate name, matching how the substitution itself behaves.
  const scriptParams = useMemo(() => {
    const seen = new Set<string>();
    const all: ScriptParam[] = [];
    for (const source of [draft, ...draftFiles.map((f) => f.code)]) {
      for (const param of analyzeScriptVariables(source).params) {
        if (seen.has(param.name)) continue;
        seen.add(param.name);
        all.push(param);
      }
    }
    return all;
  }, [draft, draftFiles]);
  const [formatRequestId, setFormatRequestId] = useState(0);
  const [docsOpen, setDocsOpen] = useState(false);
  // The documentation torn off into a browser window of its own — a reference is for reading
  // *beside* the thing it documents, which a fullscreen modal over the editor cannot do.
  const [docsWindow, setDocsWindow] = useState<Window | null>(null);

  /** Opened inside the click, never from an effect: a popup that opens later is not attributed to
   *  the gesture and every browser blocks it. */
  function detachDocs() {
    const child = window.open("", "", "width=1000,height=820");
    if (child === null) return;
    setDocsOpen(false);
    setDocsWindow(child);
  }
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
  // The tab whose close is waiting on an answer, when closing it would drop unsaved edits.
  const [closingScriptId, setClosingScriptId] = useState<string | null>(null);
  const closingScript = scripts.find((s) => s.id === closingScriptId) ?? null;
  // Finds a script that is not currently open, so one written earlier can be brought back without
  // scrolling a tab strip that only ever shows what is being worked on.
  const [search, setSearch] = useState("");
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q === "") return [];
    return scripts.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 12);
  }, [search, scripts]);

  // Opening the editor onto no tabs at all would be a blank window with a search field, which is
  // the wrong first impression when scripts exist. Seeded once per opening — guarded by the ref so
  // closing the last tab on purpose is not immediately undone, the same trap the strategy panel's
  // own auto-open fell into.
  const seededTabsRef = useRef(false);
  useEffect(() => {
    if (!open) {
      seededTabsRef.current = false;
      return;
    }
    if (seededTabsRef.current) return;
    seededTabsRef.current = true;
    if (openScriptIds.length > 0 || scripts.length === 0) return;
    const preferred = activeScriptId !== null && scripts.some((s) => s.id === activeScriptId) ? activeScriptId : scripts[scripts.length - 1].id;
    openScript(preferred);
    // Runs on the open/close transition only; everything else it reads is deliberately a snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Closing a tab discards its buffer, so a dirty one asks first. A clean one just closes —
   *  there is nothing to lose and nothing to warn about. */
  function requestCloseTab(s: ScriptDef) {
    if (isScriptDirty(s)) setClosingScriptId(s.id);
    else closeScript(s.id);
  }
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
    updateScript(activeScript.id, { name: trimmed, code: draft, files: draftFiles, named: true });
    setScriptDraft(activeScript.id, null);
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
    updateScript(activeScript.id, { code: draft, files: draftFiles });
    setScriptDraft(activeScript.id, null);
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
  // `codeOverride` lets "Exécuter la cellule" (see ScriptEditorCodeMirror.tsx's own doc on `@block`
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
        // Same reason as `runScript`'s own: a disabled script has no Worker to hear this.
        enabled: true,
        runRequestId: (activeScript.runRequestId ?? 0) + 1,
        runDraftCode: code,
        runDraftFiles: draftFiles,
      });
      return;
    }
    runScript(activeScript.id, code, draftFiles);
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
      enabled: true,
      runRequestId: (activeScript.runRequestId ?? 0) + 1,
      runDraftCode: pendingRunCodeRef.current ?? draft,
      runDraftFiles: draftFiles,
    });
    pendingRunCodeRef.current = null;
    setTargetPickerOpen(false);
  }

  // Only the file selection resets when the tab changes; the buffer itself is per-script now and
  // survives being switched away from. `activeFile` is a name within one script, so carrying it to
  // the next tab would point at a file that script may not have.
  useEffect(() => {
    setActiveFile(null);
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
  const isDirty = activeScript !== null && isScriptDirty(activeScript);

  return (
    <ScriptEditorWindow
      onRequestDetach={onRequestDetach}
      detached={detached}
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
            {/* Open tabs only — a chart with twenty saved scripts is not twenty tabs. The rest are
                reached through the search field at the end of this strip. */}
            {openScriptIds.map((id) => scripts.find((s) => s.id === id)).map((s) =>
              s === undefined ? null : (
              <div
                key={s.id}
                className={[
                  "lq-script-editor-panel__tab",
                  s.id === activeScriptId && "lq-script-editor-panel__tab--active",
                  isScriptDirty(s) && "lq-script-editor-panel__tab--dirty",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setActiveScriptId(s.id)}
              >
                <span className="lq-script-editor-panel__tab-name">{s.name}</span>
                {/* Unsaved edits, said twice over: a dot for the glance, and the accessible name
                    for anyone the dot never reaches. */}
                {isScriptDirty(s) && (
                  <span className="lq-script-editor-panel__tab-dirty" title="Modifications non enregistrées">
                    <span className="lq-visually-hidden">Modifications non enregistrées</span>
                  </span>
                )}
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
                {/* Closes the tab, not the script. Deleting is a different, heavier action and
                    lives in the indicator picker, where what is being deleted is visible. */}
                <button
                  type="button"
                  className="lq-script-editor-panel__tab-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    requestCloseTab(s);
                  }}
                  aria-label={`Fermer l'onglet ${s.name}`}
                  title="Fermer l'onglet"
                >
                  <CloseIcon size={11} />
                </button>
              </div>
              ),
            )}
            <button
              type="button"
              className="lq-script-editor-panel__add-tab"
              onClick={() => addScript(`Script ${scripts.length + 1}`, DEFAULT_SCRIPT_CODE)}
              aria-label="Nouveau script"
              title="Nouveau script"
            >
              <PlusIcon size={14} />
            </button>
            <div className="lq-script-editor-panel__tab-search">
              <SearchIcon size={12} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un script…"
                aria-label="Rechercher un indicateur ou une stratégie déjà écrit"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearch("");
                  // Enter opens the first match, so a search can be finished without the mouse.
                  if (e.key === "Enter" && searchResults[0]) {
                    openScript(searchResults[0].id);
                    setSearch("");
                  }
                }}
              />
              {searchResults.length > 0 && (
                <ul className="lq-script-editor-panel__tab-search-results">
                  {searchResults.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          openScript(s.id);
                          setSearch("");
                        }}
                      >
                        <span className="lq-script-editor-panel__tab-search-name">{s.name}</span>
                        {/* Says what will happen: an already-open script is focused, not duplicated. */}
                        {openScriptIds.includes(s.id) && <span className="lq-script-editor-panel__tab-search-hint">ouvert</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {search.trim() !== "" && searchResults.length === 0 && (
                <p className="lq-script-editor-panel__tab-search-empty">Aucun script à ce nom.</p>
              )}
            </div>
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
                title="Exécute le code depuis le début jusqu'à la fin de la cellule (@block) où se trouve le curseur (Maj+Entrée)"
              >
                <PlayIcon size={13} /> Exécuter la cellule
              </button>
              {/* Ctrl+F opens the same panel, but a shortcut is not discoverable — and on the touch
                  layout there is no keyboard to press it on at all. */}
              <button
                type="button"
                className="lq-script-editor-panel__toolbar-button"
                onClick={() => codeMirrorRef.current?.openSearch()}
                title={`Rechercher et remplacer dans le script (${shortcutLabel("F")})`}
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
                title={`Enregistrer (${shortcutLabel("S")})`}
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
                onClick={() => setScriptDraft(activeScript.id, null)}
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
            <ScriptFileTabs
              files={draftFiles}
              activeFile={activeFile}
              onSelect={setActiveFile}
              onRename={(name) => {
                setFileNameValue(name);
                setFileModal({ mode: "rename", target: name });
              }}
              onRemove={removeFile}
              onAdd={() => {
                setFileNameValue("");
                setFileModal({ mode: "add", target: null });
              }}
            />
            <Suspense fallback={<div className="lq-script-editor-panel__loading">Chargement de l'éditeur…</div>}>
              <LazyScriptEditorCodeMirror
                ref={codeMirrorRef}
                key={activeFile ?? "__entry__"}
                value={editorValue}
                onChange={setEditorValue}
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
      <ScriptDocumentationModal open={docsOpen && docsWindow === null} onClose={() => setDocsOpen(false)} onRequestDetach={detachDocs} />

      {docsWindow !== null && (
        <DetachedWindow
          target={docsWindow}
          title="Documentation de l'éditeur de script"
          // The editor is portaled to document.body, so it has no `.lq-root` ancestor to inherit a
          // theme from — the app's own scope is looked up directly instead.
          themeSource={document.querySelector(".lq-root") as HTMLElement | null}
          onClose={() => setDocsWindow(null)}
        >
          <ScriptDocumentationModal open onClose={() => setDocsWindow(null)} detached />
        </DetachedWindow>
      )}

      {fileModal && (
        <Modal
          open
          onClose={() => setFileModal(null)}
          title={fileModal.mode === "add" ? "Nouveau fichier" : "Renommer le fichier"}
          footer={
            <div className="lq-chart__edit-drawing-footer">
              <button type="button" className="lq-chart__reset-button" onClick={() => setFileModal(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="lq-chart__confirm-button"
                onClick={submitFileName}
                disabled={normalizedFileName === "" || fileNameCollision}
              >
                {fileModal.mode === "add" ? "Créer" : "Renommer"}
              </button>
            </div>
          }
        >
          <TextField
            label="Nom du fichier"
            value={fileNameValue}
            onChange={(e) => setFileNameValue(e.target.value)}
            placeholder="Ex. niveaux"
            autoFocus
            error={fileNameCollision ? "Un fichier porte déjà ce nom." : undefined}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitFileName();
            }}
          />
          {/* The exact line to paste into the entry file — the name typed here is only useful
              once it is the string in an import, so it is shown as one. */}
          {normalizedFileName !== "" && !fileNameCollision && (
            <p className="lq-script-editor-panel__file-hint">
              <code>{`import { … } from "./${normalizedFileName}";`}</code>
            </p>
          )}
        </Modal>
      )}

      {closingScript !== null && (
        <Modal
          open
          onClose={() => setClosingScriptId(null)}
          title="Script non enregistré"
          footer={
            <div className="lq-chart__edit-drawing-footer">
              <button type="button" className="lq-chart__reset-button" onClick={() => setClosingScriptId(null)}>
                Annuler
              </button>
              {/* Only for a script that already has a name: a first save has to ask for one, which
                  is a prompt of its own and not something to run from inside this one. */}
              {closingScript.named && (
                <button
                  type="button"
                  className="lq-chart__reset-button"
                  onClick={() => {
                    const d = drafts[closingScript.id];
                    if (d) updateScript(closingScript.id, { code: d.code, files: d.files });
                    closeScript(closingScript.id);
                    setClosingScriptId(null);
                  }}
                >
                  Enregistrer et fermer
                </button>
              )}
              <button
                type="button"
                className="lq-chart__confirm-button"
                onClick={() => {
                  closeScript(closingScript.id);
                  setClosingScriptId(null);
                }}
              >
                Fermer sans enregistrer
              </button>
            </div>
          }
        >
          <p className="lq-script-editor-panel__confirm-text">
            « {closingScript.name} » a des modifications qui n&apos;ont pas été enregistrées. Fermer l&apos;onglet les abandonne.
          </p>
        </Modal>
      )}

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
