import { useState } from "react";
import type { ScriptReport } from "../interfaces/ScriptReport.interface";
import { ReportView } from "./ReportView";
import { ReportPrintWindow } from "./ReportPrintWindow";
import "./ReportPanel.css";

export interface ReportPanelProps {
  /** Null when this `@report` script has not been run in this session. */
  report: ScriptReport | null;
}

/** A `@report` script's document, beside the code that wrote it, with a way to get it onto paper.
 *
 *  Rendered on the decorator alone, not on there being a report: a script that has never been run
 *  says so here rather than leaving the author wondering where its output is supposed to go. */
export function ReportPanel({ report }: ReportPanelProps) {
  const [printTarget, setPrintTarget] = useState<Window | null>(null);

  /** Opened inside the click, never from an effect: a `window.open` that runs after the gesture has
   *  ended is treated as an unsolicited popup and blocked. Blocked anyway, nothing changes here and
   *  the browser's own indicator is the explanation. */
  function openPrintWindow() {
    const child = window.open("", "", "width=900,height=1000");
    if (child === null) return;
    setPrintTarget(child);
  }

  return (
    <section className="lq-report-panel">
      <div className="lq-report-panel__header">
        <h3 className="lq-report-panel__title">Rapport</h3>
        {report !== null && (
          <button type="button" className="lq-report-panel__print" onClick={openPrintWindow}>
            Exporter en PDF
          </button>
        )}
      </div>
      {report === null ? (
        <p className="lq-report-panel__empty">Exécutez le script pour produire le rapport.</p>
      ) : (
        <div className="lq-report-panel__body">
          <ReportView report={report} />
        </div>
      )}
      {report !== null && printTarget !== null && (
        <ReportPrintWindow
          report={report}
          target={printTarget}
          onDone={() => setPrintTarget(null)}
          themeSource={typeof document === "undefined" ? null : (document.querySelector(".lq-root") as HTMLElement | null)}
        />
      )}
    </section>
  );
}
