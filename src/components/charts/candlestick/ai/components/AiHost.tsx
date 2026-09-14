import { DetachedWindow } from "../../components/DetachedWindow";
import { ScriptEditorWindow } from "../../scripting/components/ScriptEditorWindow";
import { AiPanel, type AiPanelProps } from "./AiPanel";

export type AiView = "docked" | "window" | "detached";

export interface AiHostProps {
  /** Everything the panel itself needs, identical in all three homes — the conversation included,
   *  which is what makes moving between them keep the history. */
  panelProps: Omit<AiPanelProps, "onRequestWindow" | "onRequestDetach" | "chrome">;
  view: AiView;
  setView: (view: AiView) => void;
  /** The window `detach` opened, or null. Rendering into it is what fills it. */
  detachedWindow: Window | null;
  setDetachedWindow: (win: Window | null) => void;
  onRequestDetach: () => void;
  /** Element whose computed theme the detached window copies — see DetachedWindow's own doc. */
  themeSource: HTMLElement | null;
}

/** The assistant in whichever of its three homes is current: docked beside the chart, in a floating
 *  window that can be dragged anywhere on screen, or torn off into a browser window of its own.
 *
 *  One component because they are one assistant — same props, same live conversation, only the
 *  chrome and the host differ — and because exactly one may be on screen at a time. The strategy
 *  tester is built the same way and for the same reason (see `ChartStrategyHost`): written as three
 *  branches side by side, "only one at a time" is three conditions that each have to keep agreeing
 *  with the other two; here it is a single `view`.
 *
 *  The floating window is `ScriptEditorWindow` — this library's floating-window primitive, despite
 *  its name: draggable by its header, resizable from any edge, maximisable, portaled to
 *  `document.body`, and already able to render itself flat inside a detached browser window. Reused
 *  rather than duplicated; `Modal` is deliberately not it, being centred, fixed and blocking, and a
 *  blocking dialog over the chart is the one thing an assistant about that chart must not be.
 *
 *  What closing means is deliberate: opening a window closes the docked pane, and closing that
 *  window leaves it closed (exigence). The conversation survives regardless — it is owned above
 *  this component, so none of these three mounts holds it. */
export function AiHost({ panelProps, view, setView, detachedWindow, setDetachedWindow, onRequestDetach, themeSource }: AiHostProps) {
  if (view === "detached") {
    // A portal rather than a fresh mount, so it keeps updating from this chart as the conversation
    // runs — see DetachedWindow's own doc. Nothing to render until the window exists.
    if (detachedWindow === null) return null;
    return (
      <DetachedWindow
        target={detachedWindow}
        themeSource={themeSource}
        title="Assistant"
        onClose={() => {
          // Back to docked as a *mode*, not as a reopening: `panelProps.open` is what decides
          // whether the pane shows, and tearing off set it to false.
          setView("docked");
          setDetachedWindow(null);
        }}
      >
        {/* `open` forced: the prop means "is the docked pane showing", and tearing off set it to
            false. In a window, the window itself is the open state. */}
        <AiPanel {...panelProps} open chrome="bare" />
      </DetachedWindow>
    );
  }

  if (view === "window") {
    return (
      <ScriptEditorWindow open onClose={() => setView("docked")} title="Assistant" onRequestDetach={onRequestDetach}>
        <AiPanel {...panelProps} open chrome="bare" />
      </ScriptEditorWindow>
    );
  }

  return (
    <AiPanel
      {...panelProps}
      onRequestWindow={() => setView("window")}
      onRequestDetach={onRequestDetach}
    />
  );
}
