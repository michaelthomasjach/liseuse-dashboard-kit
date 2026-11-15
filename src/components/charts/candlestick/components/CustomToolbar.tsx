import { useEffect, useRef, useState } from "react";
import { Popover } from "../../../forms/Popover";
import { GripIcon, PlusIcon, CloseIcon } from "../../../icons";
import type { ChartCustomToolbar } from "../interfaces/ChartCustomToolbar.interface";
import type { CustomToolbarToolDef } from "../customToolbarCatalog";
import { useFloatingToolbarPosition, type FloatingToolbarPlacement } from "../hooks/useFloatingToolbarPosition";
import { CustomToolbarPicker, CustomToolbarToolGlyph } from "./CustomToolbarPicker";
import "./CustomToolbar.css";

export interface CustomToolbarProps {
  toolbar: ChartCustomToolbar;
  catalog: CustomToolbarToolDef[];
  catalogById: Map<string, CustomToolbarToolDef>;
  isActive: (id: string) => boolean | undefined;
  activate: (id: string) => void;
  onToolsChange: (tools: string[]) => void;
  onPlacementChange: (placement: FloatingToolbarPlacement) => void;
  onClose: () => void;
  onRename: () => void;
  /** Ouvre le sélecteur d'outils dès l'affichage (barre qu'on vient de créer). */
  openPickerOnMount: boolean;
  onPickerOpened: () => void;
  plotWidth: number;
  plotLeft: number;
  plotBottom: number;
}

/** Une barre d'outils personnalisée : poignée, nom, ses outils, « + » pour en ajouter, croix pour la fermer (elle reste
 *  enregistrée). Placement, glisser et aimantation aux bords du tracé : ceux de la barre flottante d'un dessin
 *  (`useFloatingToolbarPosition`, classes `lq-chart__floating-toolbar`) — horizontale en haut et en bas, verticale à
 *  gauche et à droite, boutons carrés de 26 px. Elle se prend par la poignée ou par son fond. */
export function CustomToolbar({
  toolbar,
  catalog,
  catalogById,
  isActive,
  activate,
  onToolsChange,
  onPlacementChange,
  onClose,
  onRename,
  openPickerOnMount,
  onPickerOpened,
  plotWidth,
  plotLeft,
  plotBottom,
}: CustomToolbarProps) {
  const { style, orientation, toolbarRef, startDrag } = useFloatingToolbarPosition({
    resetKey: null,
    plotWidth,
    plotLeft,
    plotBottom,
    initialPlacement: { dock: toolbar.dock ?? null, x: toolbar.x ?? plotLeft + plotWidth / 2, y: toolbar.y ?? 40 },
    onPlacementChange,
  });
  const vertical = orientation === "vertical";
  const plusRef = useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const toolMenuAnchor = useRef<HTMLButtonElement | null>(null);
  const [toolMenu, setToolMenu] = useState<string | null>(null);

  useEffect(() => {
    if (!openPickerOnMount) return;
    setPickerOpen(true);
    onPickerOpened();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPickerOnMount]);

  // Graphique rétréci depuis : une barre libre ne reste pas hors du tracé (sa poignée doit rester à portée).
  const placed = { ...style };
  if (toolbar.dock == null && typeof placed.left === "number") placed.left = Math.max(0, Math.min(placed.left, plotLeft + plotWidth - 60));

  const shown = toolbar.tools.filter((id) => catalogById.has(id));
  const toolMenuIndex = toolMenu ? shown.indexOf(toolMenu) : -1;
  const moveTool = (delta: number) => {
    if (!toolMenu) return;
    const other = shown[toolMenuIndex + delta];
    if (!other) return;
    const next = [...toolbar.tools];
    const a = next.indexOf(toolMenu);
    const b = next.indexOf(other);
    [next[a], next[b]] = [next[b], next[a]];
    onToolsChange(next);
    setToolMenu(null);
  };

  return (
    <>
      <div
        ref={toolbarRef}
        className={["lq-chart__floating-toolbar", "lq-chart__custom-toolbar", vertical && "lq-chart__floating-toolbar--vertical"].filter(Boolean).join(" ")}
        style={placed}
        role="toolbar"
        aria-label={toolbar.name}
        aria-orientation={orientation}
        data-custom-toolbar-id={toolbar.id}
        onPointerDown={startDrag}
        // Le clic droit sur la barre n'ouvre pas le menu du graphique (celui d'un bouton est géré par le bouton).
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <button type="button" className="lq-chart__floating-toolbar-grip" onPointerDown={startDrag} aria-label={`Déplacer la barre ${toolbar.name}`} title="Glisser pour déplacer (s'aimante aux bords du graphique)">
          <GripIcon size={14} />
        </button>
        {!vertical && (
          <span className="lq-chart__custom-toolbar-name" onDoubleClick={onRename} title={`${toolbar.name} — double-cliquer pour renommer`}>
            {toolbar.name}
          </span>
        )}
        <span className="lq-chart__floating-toolbar-divider" aria-hidden="true" />
        {shown.map((id) => {
          const def = catalogById.get(id)!;
          const active = isActive(id);
          return (
            <button
              key={id}
              type="button"
              className={["lq-chart__icon-button", def.text !== undefined && "lq-chart__floating-toolbar-text", active && "lq-chart__icon-button--active", toolMenu === id && "lq-chart__custom-toolbar-tool--menu"].filter(Boolean).join(" ")}
              onClick={() => activate(id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toolMenuAnchor.current = e.currentTarget;
                setToolMenu(id);
              }}
              aria-label={def.label}
              {...(active !== undefined ? { "aria-pressed": active } : {})}
              title={`${def.label} (clic droit : déplacer, retirer)`}
            >
              <CustomToolbarToolGlyph def={def} />
            </button>
          );
        })}
        <button
          ref={plusRef}
          type="button"
          className={["lq-chart__icon-button", pickerOpen && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
          onClick={() => setPickerOpen((o) => !o)}
          aria-label={`Ajouter des outils à la barre ${toolbar.name}`}
          aria-expanded={pickerOpen}
          aria-haspopup="dialog"
          title="Ajouter, réordonner ou retirer des outils"
        >
          <PlusIcon size={14} />
        </button>
        <span className="lq-chart__floating-toolbar-divider" aria-hidden="true" />
        <button
          type="button"
          className="lq-chart__icon-button"
          onClick={onClose}
          aria-label={`Fermer la barre ${toolbar.name}`}
          title="Fermer (elle reste enregistrée : clic droit → Toolbars personnalisées pour la rouvrir)"
        >
          <CloseIcon size={12} />
        </button>
      </div>
      {/* Hors de la barre : un clic dans ces fenêtres (rendues ailleurs dans la page) remonterait sinon jusqu'à son
          onPointerDown et la déplacerait. */}
      <Popover open={pickerOpen} onClose={() => setPickerOpen(false)} anchorRef={plusRef} placement="bottom">
        <CustomToolbarPicker name={toolbar.name} catalog={catalog} tools={toolbar.tools} onChange={onToolsChange} />
      </Popover>
      <Popover open={toolMenu !== null} onClose={() => setToolMenu(null)} anchorRef={toolMenuAnchor} placement="bottom">
        <div className="lq-chart__tool-menu" role="menu" aria-label="Outil de la barre">
          <button type="button" role="menuitem" className="lq-chart__tool-menu-option" disabled={toolMenuIndex <= 0} onClick={() => moveTool(-1)}>
            {vertical ? "Déplacer vers le haut" : "Déplacer vers la gauche"}
          </button>
          <button type="button" role="menuitem" className="lq-chart__tool-menu-option" disabled={toolMenuIndex < 0 || toolMenuIndex >= shown.length - 1} onClick={() => moveTool(1)}>
            {vertical ? "Déplacer vers le bas" : "Déplacer vers la droite"}
          </button>
          <button
            type="button"
            role="menuitem"
            className="lq-chart__tool-menu-option"
            onClick={() => {
              onToolsChange(toolbar.tools.filter((t) => t !== toolMenu));
              setToolMenu(null);
            }}
          >
            Retirer de la barre
          </button>
        </div>
      </Popover>
    </>
  );
}
