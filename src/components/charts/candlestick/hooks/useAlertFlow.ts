import { useState } from "react";
import type { ChartAlert } from "../interfaces/ChartAlertDraft.interface";

/** Describes whatever a bell icon (the drawing toolbar's own, or an indicator's own legend row)
 *  was just clicked *for* — a drawing (`drawingId` set) or an indicator directly (`drawingId`
 *  null, `conditionIndicatorId` set to that indicator's own id) — same shape
 *  `useFloatingToolbarState`'s own `alertTarget` already produces for the drawing case, extended
 *  with the indicator-only case a legend row's own bell needs. */
export interface AlertTarget {
  drawingId: string | null;
  isFibonacciTarget: boolean;
  fibonacciExtension: boolean;
  targetLabel: string;
  conditionIndicatorId?: string;
}

/** Everything needed to drive the create/view/edit/delete flow for alerts on drawings and
 *  indicators alike — one shared hook rather than duplicating this state once per bell (the
 *  drawing toolbar's, each indicator legend row's) since they're all really the same flow aimed
 *  at a different target. Opening a bell with existing alerts shows the list first (not straight
 *  to another "create" form — see openFor), matching "add another alert" rather than replacing
 *  the one already there. Also folds in the two small derived values every bell needs just to
 *  render its own active state (`selectedDrawingHasAlert`/`alertedIndicatorIds`) and a
 *  ready-to-spread `modalProps` bundle for `ChartModals`' own alert-related props — purely to
 *  keep `CandlestickChart.tsx` itself from re-deriving/re-listing all of this inline, not because
 *  any of it has real logic of its own beyond what's already here. */
export function useAlertFlow(alerts: ChartAlert[], selectedDrawingId: string | null) {
  const [target, setTarget] = useState<AlertTarget | null>(null);
  const [mode, setMode] = useState<"list" | "create" | null>(null);
  const [editingAlert, setEditingAlert] = useState<ChartAlert | null>(null);

  function alertsFor(t: AlertTarget): ChartAlert[] {
    if (t.drawingId) return alerts.filter((a) => a.drawingId === t.drawingId);
    if (t.conditionIndicatorId) return alerts.filter((a) => a.drawingId === null && a.conditionIndicatorId === t.conditionIndicatorId);
    return [];
  }

  function openFor(t: AlertTarget) {
    setTarget(t);
    setEditingAlert(null);
    setMode(alertsFor(t).length > 0 ? "list" : "create");
  }
  // Convenience wrapper for an indicator's own legend-row bell — the one caller that has no
  // drawing at all, just an id and a label, rather than the full AlertTarget shape.
  function openForIndicator(indicatorId: string, label: string) {
    openFor({ drawingId: null, isFibonacciTarget: false, fibonacciExtension: false, targetLabel: label, conditionIndicatorId: indicatorId });
  }
  function openCreateForCurrentTarget() {
    setEditingAlert(null);
    setMode("create");
  }
  function openEdit(alert: ChartAlert) {
    setEditingAlert(alert);
    setMode("create");
  }
  function close() {
    setMode(null);
    setTarget(null);
    setEditingAlert(null);
  }

  const currentTargetAlerts = target ? alertsFor(target) : [];

  return {
    target,
    openFor,
    openForIndicator,
    selectedDrawingHasAlert: selectedDrawingId ? alerts.some((a) => a.drawingId === selectedDrawingId) : false,
    alertedIndicatorIds: new Set(alerts.filter((a) => a.drawingId === null).map((a) => a.conditionIndicatorId)),
    modalProps: {
      open: mode === "create",
      onClose: close,
      drawingId: target?.drawingId ?? null,
      isFibonacciTarget: target?.isFibonacciTarget ?? false,
      fibonacciExtension: target?.fibonacciExtension ?? false,
      targetLabel: target?.targetLabel ?? "",
      initialConditionIndicatorId: target?.conditionIndicatorId,
      editingAlert,
      alertListOpen: mode === "list",
      onCloseAlertList: close,
      alertListItems: currentTargetAlerts,
      alertListTargetLabel: target?.targetLabel ?? "",
      onAddNewAlert: openCreateForCurrentTarget,
      onEditAlert: openEdit,
    },
  };
}
