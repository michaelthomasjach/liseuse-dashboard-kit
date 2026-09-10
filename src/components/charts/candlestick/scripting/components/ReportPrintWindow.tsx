import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ScriptReport } from "../interfaces/ScriptReport.interface";
import { ReportView } from "./ReportView";

export interface ReportPrintWindowProps {
  report: ScriptReport;
  /** The window `window.open` returned. Opened inside the click that asked for it — a `window.open`
   *  running later is treated as an unsolicited popup and blocked. */
  target: Window;
  onDone: () => void;
  /** Element whose computed theme the printed page copies, so it prints in the palette it was read
   *  in rather than reverting to a default nobody chose. */
  themeSource: HTMLElement | null;
}

/** The report, laid out for paper, in a window whose only job is to be printed.
 *
 *  A real window rather than an off-screen iframe or a hidden div with `@media print`: printing the
 *  page the chart is on would have to hide the chart, the panel and everything else first, and
 *  every one of those rules is a thing to keep true forever. A window that contains nothing but the
 *  report needs no such rules, and what the browser saves as a PDF is exactly what it shows.
 *
 *  No PDF library. Every browser can already turn a page into a PDF, does it better than a
 *  canvas-to-image dump (selectable text, real pagination, the reader's own paper size), and adding
 *  a megabyte of dependency to a charting library to do it worse would be a poor trade. */
export function ReportPrintWindow({ report, target, onDone, themeSource }: ReportPrintWindowProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const child = target;
    child.document.title = `${report.title}${report.symbol ? ` — ${report.symbol}` : ""}`;

    // The parent's stylesheets, copied across: a popup shares no CSS with its opener.
    for (const node of Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))) {
      child.document.head.appendChild(node.cloneNode(true));
    }
    // Paper, not a screen: the report is a column with margins, and headers/footers are the
    // browser's own to add.
    const page = child.document.createElement("style");
    page.textContent = "@page { margin: 16mm; } body { margin: 0; background: #fff; }";
    child.document.head.appendChild(page);

    const root = child.document.createElement("div");
    // The theme classes the report was read in, so it prints in that palette.
    root.className = themeSource?.className ?? "";
    child.document.body.appendChild(root);
    setContainer(root);

    // After paint, and after the fonts the copied stylesheets pull in have actually arrived —
    // printing earlier renders the report in a fallback face, at different metrics, and the page
    // breaks land somewhere else than where they were measured.
    let cancelled = false;
    const print = () => {
      if (cancelled || child.closed) return;
      child.focus();
      child.print();
      onDone();
    };
    const fonts = (child.document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) void fonts.ready.then(() => child.setTimeout(print, 60));
    else child.setTimeout(print, 300);

    // A window closed by hand — the print dialog dismissed, or the tab shut — has to stop being
    // rendered into, or React keeps a portal pointed at a document that no longer exists.
    const onUnload = () => onDone();
    child.addEventListener("pagehide", onUnload);
    return () => {
      cancelled = true;
      child.removeEventListener("pagehide", onUnload);
    };
    // Deliberately once per window: `report` is a finished document by the time this mounts, and
    // re-running would print it twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  if (container === null) return null;
  return createPortal(<ReportView report={report} print />, container);
}
