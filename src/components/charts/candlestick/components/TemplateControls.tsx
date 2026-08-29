import { useEffect, useRef, useState } from "react";
import { Modal } from "../../../primitives/Modal";
import { DropdownPanel } from "../../../primitives/DropdownPanel";
import { TextField } from "../../../forms/TextField";
import { SaveIcon, PlusIcon, FolderIcon, CheckIcon, TrashIcon } from "../../../icons";
import type { ChartTemplate } from "../interfaces/ChartTemplate.interface";

export interface TemplateControlsProps {
  templates: ChartTemplate[];
  activeTemplateId: string | null;
  isDirty: boolean;
  onSave: (name?: string) => void;
  onSaveAs: (name: string) => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Save button + "saved templates" dropdown, right edge of the chart's own header — see
 *  `CandlestickChartProps.showTemplates`'s own doc for the exact save/load/dirty-guard rules
 *  this implements. Purely orchestration: every actual mutation (save/load/delete) is a call
 *  into `useChartTemplates` (passed in as the on* props above); this component only owns the
 *  transient UI state — which modal/dropdown is open, the name field, and a pending load id
 *  waiting on a save-or-discard decision. */
export function TemplateControls({ templates, activeTemplateId, isDirty, onSave, onSaveAs, onLoad, onDelete }: TemplateControlsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownAnchorRef = useRef<HTMLButtonElement>(null);
  // "name": the header Save button's own first-time-save prompt (submitting overwrites nothing —
  // there's nothing active yet). "nameSaveAs": the "+" button's own prompt (submitting always
  // creates a new template, active or not). Both render the exact same modal shell, just with a
  // different title and a different onSave/onSaveAs call on submit.
  const [modal, setModal] = useState<"name" | "nameSaveAs" | "confirmDiscard" | null>(null);
  // Set only while `modal === "confirmDiscard"` (or the "name" modal it can hand off to, when
  // there's no active template to just overwrite) — which template the user actually clicked,
  // applied once they've decided whether to save the current one first.
  const [pendingLoadId, setPendingLoadId] = useState<string | null>(null);
  const [nameValue, setNameValue] = useState("");
  // Briefly swaps the Save button's own icon to a checkmark — the only feedback an otherwise
  // silent "click Save, it just overwrites" action gets, same reasoning the symbol-search "+"
  // button (see onAddSymbolOverlay) turns into a checkmark once its own overlay is active.
  const [justSaved, setJustSaved] = useState(false);

  function flashSaved() {
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1200);
  }

  function closeModal() {
    setModal(null);
    setPendingLoadId(null);
  }

  function handleSaveClick() {
    if (activeTemplateId) {
      onSave();
      flashSaved();
      return;
    }
    setNameValue("");
    setModal("name");
  }

  // The small "+" next to Save — always prompts for a name and always creates a new template,
  // regardless of whether one's already active (unlike the Save button itself, which overwrites
  // the active one when there is one). Never has a pending load behind it (only the discard-guard
  // modal sets that), so submitting it never needs to chain into a load afterward.
  function handleSaveAsClick() {
    setNameValue("");
    setModal("nameSaveAs");
  }

  function handleNameSubmit() {
    const trimmed = nameValue.trim();
    if (!trimmed) return;
    if (modal === "nameSaveAs") {
      onSaveAs(trimmed);
      setModal(null);
      flashSaved();
      return;
    }
    onSave(trimmed);
    setModal(null);
    if (pendingLoadId) {
      onLoad(pendingLoadId);
      setPendingLoadId(null);
    } else {
      flashSaved();
    }
  }

  // Ctrl/Cmd+S: same intent as clicking the Save button, just without needing to reach for the
  // mouse. Unlike the drawing/indicator clipboard shortcuts elsewhere in this file, this one
  // isn't gated on focus — Ctrl+S has no competing meaning for a plain text input the way
  // Ctrl+C/Ctrl+V do, so intercepting the browser's own save-page dialog here is always what's
  // wanted. The one exception is the name modal's own input: submitting *that* (whichever of
  // "name"/"nameSaveAs" is open) is what a user mid-rename would actually expect from Ctrl+S,
  // not a second, redundant attempt to open the same modal over itself.
  //
  // Kept behind a ref (same reasoning as usePaneLayout's own reorderPanesRef) rather than listed
  // as effect dependencies — handleNameSubmit/handleSaveClick are plain closures, a fresh
  // reference every render, so depending on them directly would mean tearing down and
  // re-attaching this listener just as often; reading the latest version through a ref that's
  // kept in sync during render lets the listener itself mount exactly once.
  const saveShortcutRef = useRef(() => {});
  saveShortcutRef.current = () => {
    if (modal === "name" || modal === "nameSaveAs") handleNameSubmit();
    else handleSaveClick();
  };
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s") return;
      // Defers to the script editor's own Ctrl+S (see ScriptEditorPanel.tsx's own identical
      // check) when that's the window focus is actually in — both this header and a workspace's
      // shared script editor can be open/mounted at the same time, each with its own unscoped
      // global Ctrl+S listener; without this, one keypress would pop this modal *and* the
      // script editor's own "Enregistrer le script" at once.
      if (document.activeElement instanceof Element && document.activeElement.closest(".lq-script-window")) return;
      e.preventDefault();
      saveShortcutRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleRowClick(id: string) {
    setDropdownOpen(false);
    if (!isDirty) {
      onLoad(id);
      return;
    }
    setPendingLoadId(id);
    setModal("confirmDiscard");
  }

  // "Enregistrer et charger" from the discard-guard modal: an active template just gets
  // overwritten in place, same as the header Save button; with no active template yet there's
  // nothing to overwrite, so this hands off to the same name modal the header button would've
  // opened — `pendingLoadId` stays set, handleNameSubmit picks the load back up once it resolves.
  function handleConfirmSave() {
    if (activeTemplateId) {
      onSave();
      setModal(null);
      // `onSave`'s own state update hasn't landed yet in this synchronous handler (React batches
      // it) — calling `onLoad` right after would read `templates` as it was *before* the save,
      // stale-reloading whatever was last saved and undoing the very change `onSave` just made.
      // Harmless for a genuinely different pending template (its own entry wasn't touched by the
      // save either way) but actively wrong when re-confirming the *same* one that's already
      // active: there's nothing left to load anyway, since saving already brought the live layout
      // and the template back in sync.
      if (pendingLoadId && pendingLoadId !== activeTemplateId) {
        onLoad(pendingLoadId);
      }
      setPendingLoadId(null);
      return;
    }
    setNameValue("");
    setModal("name");
  }

  function handleConfirmDiscard() {
    setModal(null);
    if (pendingLoadId) {
      onLoad(pendingLoadId);
      setPendingLoadId(null);
    }
  }

  return (
    <>
      {/* Just a plain flex group here — pushing this to the header's own far right edge is
          .lq-chart__header-right's job (see ChartHeader), shared with the link button so both
          land flush together instead of each claiming their own leftover space. */}
      <div className="lq-chart__header-templates">
        <button
          type="button"
          className="lq-chart__icon-button"
          onClick={handleSaveClick}
          aria-label={activeTemplateId ? "Enregistrer le modèle (Ctrl+S)" : "Enregistrer comme nouveau modèle (Ctrl+S)"}
          title={activeTemplateId ? "Enregistrer le modèle (Ctrl+S)" : "Enregistrer comme nouveau modèle (Ctrl+S)"}
        >
          {justSaved ? <CheckIcon size={14} /> : <SaveIcon size={14} />}
        </button>
        {/* "Enregistrer sous" — always a new template, distinct from Save itself overwriting the
            active one. Same icon size as every other header button, not a smaller one — a
            visibly undersized glyph next to its peers just read as a rendering glitch. */}
        <button
          type="button"
          className="lq-chart__icon-button"
          onClick={handleSaveAsClick}
          aria-label="Enregistrer sous (nouveau modèle)"
          title="Enregistrer sous (nouveau modèle)"
        >
          <PlusIcon size={14} />
        </button>
        <button
          ref={dropdownAnchorRef}
          type="button"
          className={["lq-chart__icon-button", dropdownOpen && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
          onClick={() => setDropdownOpen((o) => !o)}
          aria-label="Modèles enregistrés"
          title="Modèles enregistrés"
        >
          <FolderIcon size={14} />
        </button>
      </div>
      <DropdownPanel
        open={dropdownOpen}
        onClose={() => setDropdownOpen(false)}
        anchorRef={dropdownAnchorRef}
        placement="bottom"
        header={
          <div className="lq-dropdown-panel__header-row">
            <span>Modèles enregistrés</span>
            <span className="lq-dropdown-panel__header-count">{templates.length}</span>
          </div>
        }
      >
        {templates.length === 0 ? (
          <p className="lq-chart__template-empty">Aucun modèle enregistré.</p>
        ) : (
          templates.map((t) => (
            <div
              key={t.id}
              className={["lq-chart__template-row", t.id === activeTemplateId && "lq-chart__template-row--active"].filter(Boolean).join(" ")}
            >
              <button type="button" className="lq-chart__template-row-name" onClick={() => handleRowClick(t.id)}>
                {t.id === activeTemplateId && <CheckIcon size={12} />}
                {t.name}
              </button>
              <button type="button" className="lq-chart__template-row-delete" onClick={() => onDelete(t.id)} aria-label={`Supprimer ${t.name}`}>
                <TrashIcon size={12} />
              </button>
            </div>
          ))
        )}
      </DropdownPanel>

      {(modal === "name" || modal === "nameSaveAs") && (
        <Modal
          open
          onClose={closeModal}
          title={modal === "nameSaveAs" ? "Enregistrer sous" : "Enregistrer le modèle"}
          footer={
            <div className="lq-chart__edit-drawing-footer">
              <button type="button" className="lq-chart__reset-button" onClick={closeModal}>
                Annuler
              </button>
              <button type="button" className="lq-chart__confirm-button" onClick={handleNameSubmit} disabled={!nameValue.trim()}>
                Enregistrer
              </button>
            </div>
          }
        >
          <TextField
            label="Nom du modèle"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            placeholder="Ex. Analyse technique complète"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameSubmit();
            }}
          />
        </Modal>
      )}

      {modal === "confirmDiscard" && (
        <Modal
          open
          onClose={closeModal}
          title="Modifications non enregistrées"
          footer={
            <div className="lq-chart__edit-drawing-footer">
              <button type="button" className="lq-chart__reset-button" onClick={handleConfirmDiscard}>
                Charger sans enregistrer
              </button>
              <button type="button" className="lq-chart__confirm-button" onClick={handleConfirmSave}>
                Enregistrer et charger
              </button>
            </div>
          }
        >
          <p className="lq-chart__template-confirm-text">
            La disposition actuelle des indicateurs/panneaux n'est pas enregistrée. L'enregistrer avant de charger l'autre modèle ?
          </p>
        </Modal>
      )}
    </>
  );
}
