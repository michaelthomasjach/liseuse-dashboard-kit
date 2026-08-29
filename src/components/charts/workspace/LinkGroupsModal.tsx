import { useEffect, useState } from "react";
import { Modal } from "../../primitives/Modal";
import { Checkbox } from "../../forms/Checkbox";
import { CloseIcon } from "../../icons";

export interface LinkGroupsModalProps {
  open: boolean;
  onClose: () => void;
  panelCount: number;
  groups: number[][];
  onLink: (panelIndices: number[]) => void;
  onUnlink: (groupIndex: number) => void;
  /** Each panel's current symbol, by panel index — shown next to "Fenêtre N" so a workspace with
   *  several different tickers open doesn't leave the user guessing which physical panel a given
   *  row refers to. A missing/undefined entry (panel not yet showing anything) just falls back to
   *  the bare "Fenêtre N" label. */
  panelSymbols?: (string | undefined)[];
  /** Mirrors the staged checkbox selection outward as it changes, so the workspace behind this
   *  modal can highlight whichever panel(s) are currently checked — the modal itself has no way to
   *  reach into the grid it's floating over. Fires with every currently-checked panel index on
   *  every toggle, and implicitly clears (via the caller's own `onClose`) once a link is made or
   *  the modal closes. */
  onSelectedPanelsChange?: (panelIndices: number[]) => void;
}

/** The tree of "Fenêtre N" / "Groupe N" the chain-link button opens (see `ChartWorkspace`) — a
 *  staged checkbox selection (cleared every time the modal opens, not synced to `groups` itself)
 *  plus one "Lier la sélection" action that turns whatever's checked into a single group,
 *  regardless of any group those panels were already part of (see `useLinkGroups.linkPanels`'s
 *  own doc for exactly what that means for pre-existing groups). Each existing group's own header
 *  row carries a small dissolve button instead of a checkbox of its own — a group isn't itself a
 *  selectable panel, so there's nothing to link *it* to. */
export function LinkGroupsModal({ open, onClose, panelCount, groups, onLink, onUnlink, panelSymbols, onSelectedPanelsChange }: LinkGroupsModalProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Fresh selection every time the modal opens — carrying a stale one over from a previous visit
  // would let checkboxes appear checked for panels the user never actually clicked this time.
  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);

  // Not a functional setSelected(prev => ...) update: onSelectedPanelsChange ultimately calls
  // setState on ChartWorkspace (a different component), and calling that from inside *this*
  // state's own updater function runs it during React's render phase, which throws "Cannot update
  // a component while rendering a different component". Computing `next` from the already-current
  // `selected` up front and firing both calls as plain event-handler side effects avoids that —
  // toggle only ever runs from a direct click, never concurrently, so there's no staleness risk.
  function toggle(panelIndex: number) {
    const next = new Set(selected);
    if (next.has(panelIndex)) next.delete(panelIndex);
    else next.add(panelIndex);
    setSelected(next);
    onSelectedPanelsChange?.([...next]);
  }

  function handleLink() {
    if (selected.size < 2) return;
    onLink([...selected]);
    setSelected(new Set());
    onSelectedPanelsChange?.([]);
  }

  function panelLabel(panelIndex: number) {
    const symbol = panelSymbols?.[panelIndex];
    return symbol ? `Fenêtre ${panelIndex + 1} — ${symbol}` : `Fenêtre ${panelIndex + 1}`;
  }

  if (!open) return null;

  // Only a group with at least 2 real members still counts as "grouped" — the caller (see its own
  // `effectiveGroups` doc) may pass a group already filtered down to 0-1 members (its other
  // member(s) no longer exist at the current panel count); such a panel belongs back in the plain
  // `ungrouped` list below, not stranded in neither list.
  const groupedIndices = new Set(groups.filter((g) => g.length >= 2).flat());
  const ungrouped = Array.from({ length: panelCount }, (_, i) => i).filter((i) => !groupedIndices.has(i));

  return (
    <Modal
      open
      onClose={onClose}
      title="Graphiques liés"
      footer={
        <div className="lq-chart__edit-drawing-footer">
          <button type="button" className="lq-chart__reset-button" onClick={onClose}>
            Fermer
          </button>
          <button type="button" className="lq-chart__confirm-button" onClick={handleLink} disabled={selected.size < 2}>
            Lier la sélection
          </button>
        </div>
      }
    >
      <div className="lq-link-groups__tree">
        {groups.map((group, groupIndex) =>
          // A group already filtered down to fewer than 2 real members (see the caller's own
          // `effectiveGroups` doc) isn't a group worth showing a card for — its own true index
          // into the real array is preserved either way, so `onUnlink`/`Groupe N` numbering for
          // every *other* card stays correct regardless of which ones get skipped here.
          group.length < 2 ? null : (
          <div key={groupIndex} className="lq-link-groups__group">
            <div className="lq-link-groups__group-header">
              <span>Groupe {groupIndex + 1}</span>
              <button
                type="button"
                className="lq-link-groups__unlink"
                onClick={() => onUnlink(groupIndex)}
                aria-label={`Dissocier le groupe ${groupIndex + 1}`}
                title="Dissocier ce groupe"
              >
                <CloseIcon size={12} />
              </button>
            </div>
            {group.map((panelIndex) => (
              <Checkbox
                key={panelIndex}
                checked={selected.has(panelIndex)}
                onChange={() => toggle(panelIndex)}
                label={panelLabel(panelIndex)}
                className="lq-link-groups__nested"
              />
            ))}
          </div>
          )
        )}
        {ungrouped.map((panelIndex) => (
          <Checkbox key={panelIndex} checked={selected.has(panelIndex)} onChange={() => toggle(panelIndex)} label={panelLabel(panelIndex)} />
        ))}
      </div>
    </Modal>
  );
}
