import type { ScriptRunAlert } from "../interfaces/ScriptRunResult.interface";

export type AlertApi = (message: string) => void;

/** `alert(message)` — fires an entry into the run's own `ScriptRunResult.alerts`, timestamped with
 *  whichever bar was current when the script called it. Deliberately just a collector, not a push
 *  notification of its own: the Worker has no business deciding how an alert reaches the user
 *  (toast, sound, host-app notification, ...) — that's the host's call once M5 wires
 *  `ScriptRunResult.alerts` up to a real `onScriptAlert` prop, same "engine produces data, host
 *  decides presentation" split every other `plot.*` output already follows. */
export function buildAlertApi(getCurrentIndex: () => number, getCurrentDate: () => number): { api: AlertApi; getAlerts: () => ScriptRunAlert[] } {
  const alerts: ScriptRunAlert[] = [];
  const api: AlertApi = (message) => {
    alerts.push({ message: String(message), barIndex: getCurrentIndex(), date: getCurrentDate() });
  };
  return { api, getAlerts: () => alerts };
}
