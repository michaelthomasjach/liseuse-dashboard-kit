import { useRef, useState, type ReactNode } from "react";
import { WatchlistIcon, AlarmClockIcon, MaximizeIcon, MinimizeIcon, HelpIcon, CodeIcon, SparkleIcon, PlugIcon, CameraIcon } from "../../icons";
import { Popover } from "../../forms/Popover";
import { CHART_CAPTURE_ACTIONS, type ChartCaptureActionKind } from "../candlestick/captureChart";
import type { ChartWorkspaceSidePanelTab } from "./useWorkspaceSidePanelState";
import type { ChartWorkspaceGridLayout } from "./gridLayouts";
import { WorkspaceLayoutMenu } from "./WorkspaceLayoutMenu";

/** Un bouton de l'application dans le rail de droite (au-dessus de l'aide). */
export interface WorkspaceRailAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** Allumé (ex. connexion active). */
  active?: boolean;
}

export interface WorkspaceSideRailProps {
  hasWatchlists: boolean;
  hasAlerts: boolean;
  panelOpen: boolean;
  activeTab: ChartWorkspaceSidePanelTab;
  onToggleTab: (tab: ChartWorkspaceSidePanelTab) => void;
  scripting?: { editorOpen: boolean; setEditorOpen: (open: boolean) => void };
  /** Undefined when the workspace has no `ai` — the button then doesn't exist. */
  assistant?: { open: boolean; setOpen: (open: boolean) => void };
  /** Undefined when the workspace was given no `brokers` — the button then doesn't exist either.
   *  `connected` is only the count, which is all the rail needs to read as active. */
  broker?: { connected: number; onOpen: () => void };
  /** The grid's current layout, and what picking another one in the layout menu calls. */
  gridLayout: ChartWorkspaceGridLayout;
  onGridLayoutChange: (layout: ChartWorkspaceGridLayout) => void;
  workspaceFullscreen: boolean;
  onToggleWorkspaceFullscreen: () => void;
  /** Bouton plein écran de l'espace de travail ; absent quand la page l'affiche déjà en grand. Défaut true. */
  showFullscreenButton?: boolean;
  /** Appareil photo : capture du graphique au premier plan (télécharger, copier, ouvrir). */
  onCapture?: (action: ChartCaptureActionKind) => void;
  /** Boutons de l'application, juste au-dessus de l'aide. */
  actions?: WorkspaceRailAction[];
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
  assistant,
  broker,
  gridLayout,
  onGridLayoutChange,
  workspaceFullscreen,
  onToggleWorkspaceFullscreen,
  showFullscreenButton = true,
  onCapture,
  actions,
  onOpenHelp,
}: WorkspaceSideRailProps) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const captureRef = useRef<HTMLButtonElement>(null);
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
          <AlarmClockIcon size={16} />
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
      {/* Beside the script editor, above the layout controls: like them it is a whole-view tool,
          not a per-panel one — one assistant for the workspace, wherever it is pointed. */}
      {assistant && (
        <button
          type="button"
          className={["lq-chart__icon-button lq-chart__ai-button", assistant.open && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
          onClick={() => assistant.setOpen(!assistant.open)}
          aria-label="Assistant"
          aria-pressed={assistant.open}
          title="Poser une question sur le graphique, ou lui demander d'agir dessus"
        >
          <SparkleIcon size={16} animated />
        </button>
      )}
      {/* Beside the assistant, above the layout controls, for the same reason: connecting an
          account is a workspace-wide errand, not one panel's. It was first put in the chart's own
          header, which is where "the toolbar on the right" was read as pointing — it meant one
          button per panel for a connection there is only one of. */}
      {broker && (
        <button
          type="button"
          className={["lq-chart__icon-button", broker.connected > 0 && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
          onClick={broker.onOpen}
          aria-label={broker.connected > 0 ? `Brokers (${broker.connected} connecté${broker.connected > 1 ? "s" : ""})` : "Se connecter à un broker"}
          title={broker.connected > 0 ? `Brokers (${broker.connected} connecté${broker.connected > 1 ? "s" : ""})` : "Se connecter à un broker"}
        >
          <PlugIcon size={16} />
        </button>
      )}
      {/* Moved here from CandlestickChart's own ChartHeader (see this file's own git history) —
          laying out multiple panels is a workspace-wide concern, not a per-chart one, so the
          control for it belongs on the workspace's own rail rather than duplicated/hidden inside
          each panel's header. It used to pick a panel count only (1/2/4/6/8); it now picks a whole
          layout — how many panels, and where each one goes — see WorkspaceLayoutMenu. */}
      <WorkspaceLayoutMenu layout={gridLayout} onLayoutChange={onGridLayoutChange} />
      {/* The whole workspace, not just one panel — always visible, same as the layout menu right
          above it, with no panel-count precondition. */}
      {showFullscreenButton && (
        <button
          type="button"
          className="lq-chart__icon-button"
          onClick={onToggleWorkspaceFullscreen}
          aria-label={workspaceFullscreen ? "Quitter le plein écran de l'espace de travail" : "Plein écran de l'espace de travail"}
          title={workspaceFullscreen ? "Quitter le plein écran de l'espace de travail" : "Plein écran de l'espace de travail"}
        >
          {workspaceFullscreen ? <MinimizeIcon size={16} /> : <MaximizeIcon size={16} />}
        </button>
      )}
      {/* Capture du graphique au premier plan — un seul bouton pour l'espace de travail, comme le plein écran,
          plutôt qu'un dans l'en-tête de chaque graphique. */}
      {onCapture && (
        <>
          <button
            ref={captureRef}
            type="button"
            className={["lq-chart__icon-button", captureOpen && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
            onClick={() => setCaptureOpen((o) => !o)}
            aria-label="Capturer le graphique"
            aria-haspopup="menu"
            aria-expanded={captureOpen}
            title="Capturer le graphique"
          >
            <CameraIcon size={16} />
          </button>
          <Popover open={captureOpen} onClose={() => setCaptureOpen(false)} anchorRef={captureRef} placement="bottom">
            <div className="lq-chart__timeframe-menu" role="menu">
              {CHART_CAPTURE_ACTIONS.map(({ action, label }) => (
                <button
                  key={action}
                  type="button"
                  role="menuitem"
                  className="lq-chart__timeframe-option"
                  onClick={() => {
                    setCaptureOpen(false);
                    onCapture(action);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </Popover>
        </>
      )}
      {/* Pinned to the rail's own bottom edge (`margin-top: auto` inside a column flex that
          already stretches to the workspace's full height, see .lq-chart-workspace__side-rail)
          rather than just sitting last after whichever of the buttons above happened to render,
          so it stays in the same spot regardless of how many of them are showing. */}
      {/* Boutons de l'application : collés au-dessus de l'aide, en bas du rail (le premier porte la marge qui les y pousse). */}
      {actions?.map((a, i) => (
        <button
          key={a.id}
          type="button"
          className={["lq-chart__icon-button", i === 0 && "lq-chart-workspace__rail-actions-start", a.active && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
          onClick={a.onClick}
          aria-label={a.label}
          title={a.label}
        >
          {a.icon}
        </button>
      ))}
      <button
        type="button"
        className={["lq-chart__icon-button", !actions?.length && "lq-chart-workspace__help-button"].filter(Boolean).join(" ")}
        onClick={onOpenHelp}
        aria-label="Aide"
        title="Aide"
      >
        <HelpIcon size={16} />
      </button>
    </div>
  );
}
