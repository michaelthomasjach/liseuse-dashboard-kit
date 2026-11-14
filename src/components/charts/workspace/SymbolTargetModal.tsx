import { useEffect, useState } from "react";
import { Modal } from "../../primitives/Modal";
import { Checkbox } from "../../forms/Checkbox";

export interface SymbolTargetModalProps {
  open: boolean;
  onClose: () => void;
  panelCount: number;
  /** Each panel's current symbol, by panel index — same "Fenêtre N — TICKER" labeling
   *  `LinkGroupsModal.panelSymbols` already uses, and for the same reason. */
  panelSymbols?: (string | undefined)[];
  /** Fires once, with every currently-checked panel index, when "Appliquer" is clicked (always at
   *  least one — see the button's own `disabled`). The caller owns actually changing what each of
   *  those panels shows. */
  onConfirm: (panelIndices: number[]) => void;
  /** Same live-selection mirror as `LinkGroupsModal.onSelectedPanelsChange` — lets the workspace
   *  behind this modal highlight whichever panel(s) are currently checked. */
  onSelectedPanelsChange?: (panelIndices: number[]) => void;
  /** La fenêtre active (dernière cliquée) : proposée en tête, « Fenêtre active (Fenêtre 2 — NVDA) ». */
  activePanel?: number;
}

/** The "which window(s) should this open in" modal a watchlist row click opens once more than one
 *  panel exists (see `ChartWorkspace.handleWatchlistRowClick`) — a flat "Fenêtre N" checkbox list
 *  plus one "Toutes"/"Aucune" toggle row that flips label+behavior once every panel is already
 *  checked, same shape as `LinkGroupsModal`'s own tree but without its groups concept (this is
 *  about picking destinations, not linking panels together) and requiring only one panel checked
 *  to validate, not two. */
export function SymbolTargetModal({ open, onClose, panelCount, panelSymbols, onConfirm, onSelectedPanelsChange, activePanel }: SymbolTargetModalProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Fresh selection every time the modal opens — same reasoning as LinkGroupsModal's own identical
  // effect (carrying a stale one over would show checkboxes checked for panels never actually
  // clicked this time).
  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);

  // Plain event-handler side effects, not a functional setSelected(prev => ...) update — same
  // "updating a different component's state from inside this one's own updater throws" reasoning
  // LinkGroupsModal.toggle already documents.
  function toggle(panelIndex: number) {
    const next = new Set(selected);
    if (next.has(panelIndex)) next.delete(panelIndex);
    else next.add(panelIndex);
    setSelected(next);
    onSelectedPanelsChange?.([...next]);
  }

  const allSelected = panelCount > 0 && selected.size === panelCount;

  function toggleAll() {
    const next = allSelected ? new Set<number>() : new Set(Array.from({ length: panelCount }, (_, i) => i));
    setSelected(next);
    onSelectedPanelsChange?.([...next]);
  }

  const hasActive = activePanel !== undefined && activePanel >= 0 && activePanel < panelCount;
  const onlyActive = hasActive && selected.size === 1 && selected.has(activePanel);
  function toggleActive() {
    if (!hasActive) return;
    const next = onlyActive ? new Set<number>() : new Set([activePanel]);
    setSelected(next);
    onSelectedPanelsChange?.([...next]);
  }

  function handleConfirm() {
    if (selected.size === 0) return;
    onConfirm([...selected]);
    setSelected(new Set());
    onSelectedPanelsChange?.([]);
  }

  function panelLabel(panelIndex: number) {
    const symbol = panelSymbols?.[panelIndex];
    return symbol ? `Fenêtre ${panelIndex + 1} — ${symbol}` : `Fenêtre ${panelIndex + 1}`;
  }

  if (!open) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Ouvrir dans"
      footer={
        <div className="lq-chart__edit-drawing-footer">
          <button type="button" className="lq-chart__reset-button" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="lq-chart__confirm-button" onClick={handleConfirm} disabled={selected.size === 0}>
            Appliquer
          </button>
        </div>
      }
    >
      <div className="lq-link-groups__tree">
        {hasActive && <Checkbox checked={onlyActive} onChange={toggleActive} label={`Fenêtre active (${panelLabel(activePanel)})`} />}
        <Checkbox checked={allSelected} onChange={toggleAll} label={allSelected ? "Aucune" : "Toutes"} />
        {Array.from({ length: panelCount }, (_, i) => i).map((panelIndex) => (
          <Checkbox key={panelIndex} checked={selected.has(panelIndex)} onChange={() => toggle(panelIndex)} label={panelLabel(panelIndex)} />
        ))}
      </div>
    </Modal>
  );
}
