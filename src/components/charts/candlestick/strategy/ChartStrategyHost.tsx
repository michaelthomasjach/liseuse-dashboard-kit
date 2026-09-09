import { Modal } from "../../../primitives/Modal";
import { DetachedWindow } from "../components/DetachedWindow";
import { ChartStrategyPanel, type ChartStrategyPanelProps } from "./ChartStrategyPanel";

export interface ChartStrategyHostProps {
  /** Null when no strategy's tester is open — the host then renders nothing at all. */
  panelProps: ChartStrategyPanelProps | null;
  /** Titles the modal and the torn-off window. */
  scriptName: string | undefined;
  view: "docked" | "fullscreen" | "detached";
  setView: (view: "docked" | "fullscreen" | "detached") => void;
  /** The window `detach` opened, or null. Rendering into it is what fills it. */
  detachedWindow: Window | null;
  setDetachedWindow: (win: Window | null) => void;
  onRequestDetach: () => void;
  /** Element whose computed theme the detached window copies — see DetachedWindow's own doc. */
  themeSource: HTMLElement | null;
}

/** The strategy tester in whichever of its three homes is current: docked under the chart, filling
 *  a modal, or torn off into a window of its own.
 *
 *  One component because they are one panel — same props, same live data, only the chrome and the
 *  host differ — and because exactly one may be on screen at a time. Written as three branches
 *  side by side, that invariant was three separate conditions that each had to keep agreeing with
 *  the other two; here it is a single `view`.
 *
 *  Only the docked branch is laid out in place. The other two are portals, so where this sits in
 *  the tree is decided entirely by where the docked panel belongs: under the whole chart row —
 *  under the docked pane columns too, not only under the plot. A backtest is a table, a form and a
 *  chart of its own; it reads better across the full width than squeezed into whatever the candles
 *  were left, and a profile column beside the plot has no reason to reserve width below itself. */
export function ChartStrategyHost({
  panelProps,
  scriptName,
  view,
  setView,
  detachedWindow,
  setDetachedWindow,
  onRequestDetach,
  themeSource,
}: ChartStrategyHostProps) {
  if (panelProps === null) return null;

  if (view === "fullscreen") {
    // The same panel, the same live props, just given the whole screen. The docked one is not
    // rendered alongside it — that is what makes this a different *view* of the tester rather
    // than a second copy of it.
    return (
      <Modal open onClose={() => setView("docked")} title={scriptName} size="fullscreen" footer={null}>
        <div className="lq-chart__strategy-modal-body">
          <ChartStrategyPanel {...panelProps} chrome="bare" />
        </div>
      </Modal>
    );
  }

  if (view === "detached") {
    // A portal rather than a fresh mount, so it keeps updating from this chart as the strategy
    // re-runs — see DetachedWindow's own doc. Nothing to render until the window exists.
    if (detachedWindow === null) return null;
    return (
      <DetachedWindow
        target={detachedWindow}
        themeSource={themeSource}
        title={`Testeur de stratégie — ${scriptName ?? ""}`}
        onClose={() => {
          setView("docked");
          setDetachedWindow(null);
        }}
      >
        <ChartStrategyPanel {...panelProps} chrome="bare" />
      </DetachedWindow>
    );
  }

  return <ChartStrategyPanel {...panelProps} onRequestFullscreen={() => setView("fullscreen")} onRequestDetach={onRequestDetach} />;
}
