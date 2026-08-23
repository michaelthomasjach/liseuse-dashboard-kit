import { Modal } from "../../../primitives/Modal";
import { PencilIcon, TrashIcon, PlusIcon } from "../../../icons";
import type { ChartAlert } from "../interfaces/ChartAlertDraft.interface";

export interface AlertListModalProps {
  alertListOpen: boolean;
  onCloseAlertList: () => void;
  alertListItems: ChartAlert[];
  alertListTargetLabel: string;
  onAddNewAlert: () => void;
  onEditAlert: (alert: ChartAlert) => void;
  onDeleteAlert?: (id: string) => void;
}

/** Shown instead of `AlertCreateModal` the moment a bell (the drawing toolbar's own, or an
 *  indicator's own legend row) is clicked while its target already has at least one alert — see
 *  `useAlertFlow`'s own doc. Each row is just `alert.message` (already a readable summary — see
 *  `AlertCreateModal`'s own auto-templating) plus edit/delete; "+ Nouvelle alerte" reopens
 *  `AlertCreateModal` in create mode for the same target, adding another rather than replacing
 *  the one(s) already there. */
export function AlertListModal({
  alertListOpen,
  onCloseAlertList,
  alertListItems,
  alertListTargetLabel,
  onAddNewAlert,
  onEditAlert,
  onDeleteAlert,
}: AlertListModalProps) {
  if (!alertListOpen) return null;

  return (
    <Modal open onClose={onCloseAlertList} title={`Alertes — ${alertListTargetLabel}`}>
      <div className="lq-alert-list">
        {alertListItems.map((alert) => (
          <div key={alert.id} className="lq-alert-list__row">
            <span className="lq-alert-list__message">{alert.message}</span>
            <div className="lq-alert-list__actions">
              <button type="button" className="lq-chart__icon-button" onClick={() => onEditAlert(alert)} aria-label="Modifier l'alerte" title="Modifier l'alerte">
                <PencilIcon size={14} />
              </button>
              {onDeleteAlert && (
                <button type="button" className="lq-chart__icon-button" onClick={() => onDeleteAlert(alert.id)} aria-label="Supprimer l'alerte" title="Supprimer l'alerte">
                  <TrashIcon size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        <button type="button" className="lq-alert-list__add" onClick={onAddNewAlert}>
          <PlusIcon size={14} />
          Nouvelle alerte
        </button>
      </div>
    </Modal>
  );
}
