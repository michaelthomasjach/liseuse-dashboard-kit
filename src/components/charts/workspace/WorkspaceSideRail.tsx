import { useRef, useState } from "react";
import { Popover } from "../../forms/Popover";
import { WatchlistIcon, BellIcon, GridIcon, MaximizeIcon, MinimizeIcon, HelpIcon, CodeIcon } from "../../icons";
import type { ChartWorkspaceSidePanelTab } from "./useWorkspaceSidePanelState";

// Moved here from CandlestickChart's own ChartHeader (see this file's own git history) — laying
// out multiple panels is a workspace-wide concern, not a per-chart one, so the control for it
// belongs on the workspace's own rail rather than duplicated/hidden inside each panel's header.
const SPLIT_SCREEN_OPTIONS: { value: 1 | 2 | 4 | 6 | 8; label: string }[] = [
  { value: 1, label: "1 fenêtre" },
  { value: 2, label: "2 panneaux" },
  { value: 4, label: "4 panneaux" },
  { value: 6, label: "6 panneaux" },
  { value: 8, label: "8 panneaux" },
];

export interface WorkspaceSideRailProps {
  hasWatchlists: boolean;
  hasAlerts: boolean;
  panelOpen: boolean;
  activeTab: ChartWorkspaceSidePanelTab;
  onToggleTab: (tab: ChartWorkspaceSidePanelTab) => void;
  /** Undefined when the workspace has no `scripting` — the button then doesn't exist. */
  scripting?: { editorOpen: boolean; setEditorOpen: (open: boolean) => void };
  panels: 1 | 2 | 4 | 6 | 8;
  onPanelsChange: (panels: 1 | 2 | 4 | 6 | 8) => void;
  workspaceFullscreen: boolean;
  onToggleWorkspaceFullscreen: () => void;
  onOpenHelp: () => void;
}

/** The vertical strip of icons down the workspace's right edge.
 *
 *  Always rendered on the desktop layout, even with no watchlists and no alerts: split-screen has
 *  no such prerequisite — laying out the grid works with any panel count, one included — so the
 *  rail has to exist for that button alone. Not rendered at all on the mobile layout, where
 *  watchlist/alerts move into the topbar and scripting/split-screen/fullscreen have no equivalent. */
export function WorkspaceSideRail({
  hasWatchlists,
  hasAlerts,
  panelOpen,
  activeTab,
  onToggleTab,
  scripting,
  panels,
  onPanelsChange,
  workspaceFullscreen,
  onToggleWorkspaceFullscreen,
  onOpenHelp,
}: WorkspaceSideRailProps) {
  const [splitScreenMenuOpen, setSplitScreenMenuOpen] = useState(false);
  const splitScreenTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="lq-chart-workspace__side-rail">
      {hasWatchlists && (
        <button
          type="button"
          className={["lq-chart__icon-button", panelOpen && activeTab === "watchlist" && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
          onClick={() => onToggleTab("watchlist")}
          aria-label="Liste de surveillance"
          title="Liste de surveillance"
        >
          <WatchlistIcon size={16} />
        </button>
      )}
      {hasAlerts && (
        <button
          type="button"
          className={["lq-chart__icon-button", panelOpen && activeTab === "alerts" && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
          onClick={() => onToggleTab("alerts")}
          aria-label="Alertes"
          title="Alertes"
        >
          <BellIcon size={16} />
        </button>
      )}
      {/* Gated on ChartWorkspace's own `scripting` prop (same "the button only shows up if the
          feature is actually on" rule hasWatchlists/hasAlerts follow above) — opens the one
          shared editor (rendered outside the rail) rather than any one panel's own. */}
      {scripting && (
        <button
          type="button"
          className={["lq-chart__icon-button", scripting.editorOpen && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
          onClick={() => scripting.setEditorOpen(!scripting.editorOpen)}
          aria-label="Éditeur de script"
          title="Éditeur de script"
        >
          <CodeIcon size={16} />
        </button>
      )}
      <button
        ref={splitScreenTriggerRef}
        type="button"
        className={["lq-chart__icon-button", splitScreenMenuOpen && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
        onClick={() => setSplitScreenMenuOpen((o) => !o)}
        aria-label="Écran divisé"
        title="Écran divisé"
      >
        <GridIcon size={16} />
      </button>
      <Popover open={splitScreenMenuOpen} onClose={() => setSplitScreenMenuOpen(false)} anchorRef={splitScreenTriggerRef} placement="bottom">
        <div className="lq-chart__display-mode-menu">
          {SPLIT_SCREEN_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={["lq-chart__display-mode-option", opt.value === panels && "lq-chart__display-mode-option--selected"].filter(Boolean).join(" ")}
              onClick={() => {
                onPanelsChange(opt.value);
                setSplitScreenMenuOpen(false);
              }}
            >
              <GridIcon size={15} />
              {opt.label}
            </button>
          ))}
        </div>
      </Popover>
      {/* The whole workspace, not just one panel — always visible, same as split-screen right
          above it, with no panel-count precondition. */}
      <button
        type="button"
        className="lq-chart__icon-button"
        onClick={onToggleWorkspaceFullscreen}
        aria-label={workspaceFullscreen ? "Quitter le plein écran de l'espace de travail" : "Plein écran de l'espace de travail"}
        title={workspaceFullscreen ? "Quitter le plein écran de l'espace de travail" : "Plein écran de l'espace de travail"}
      >
        {workspaceFullscreen ? <MinimizeIcon size={16} /> : <MaximizeIcon size={16} />}
      </button>
      {/* Pinned to the rail's own bottom edge (`margin-top: auto` inside a column flex that
          already stretches to the workspace's full height, see .lq-chart-workspace__side-rail)
          rather than just sitting last after whichever of the buttons above happened to render,
          so it stays in the same spot regardless of how many of them are showing. */}
      <button type="button" className="lq-chart__icon-button lq-chart-workspace__help-button" onClick={onOpenHelp} aria-label="Aide" title="Aide">
        <HelpIcon size={16} />
      </button>
    </div>
  );
}
