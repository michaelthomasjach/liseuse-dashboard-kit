import { type KeyboardEvent, useCallback, useRef, useState } from "react";
import { Popover } from "../../forms/Popover";
import { GridLayoutIcon } from "./GridLayoutIcon";
import { GRID_LAYOUTS_BY_PANELS, gridLayoutLabel, type ChartWorkspaceGridLayout } from "./gridLayouts";

export interface WorkspaceLayoutMenuProps {
  layout: ChartWorkspaceGridLayout;
  onLayoutChange: (layout: ChartWorkspaceGridLayout) => void;
}

const OPTION_CLASS = "lq-chart-workspace__layout-option";

/** Le bouton « Disposition des fenêtres » du rail et la liste qu'il ouvre — le menu « mise en
 *  page » de TradingView : une ligne par nombre de fenêtres, le chiffre à gauche, puis une icône
 *  par disposition. Remplace l'ancien choix du seul nombre de fenêtres (1, 2, 4, 6 ou 8).
 *
 *  Le bouton montre l'icône de la disposition courante. Dans la liste, chaque icône est un bouton
 *  (aria-label en toutes lettres, `aria-pressed` sur la disposition courante) ; le focus arrive sur
 *  la disposition courante à l'ouverture, les flèches se déplacent d'icône en icône (gauche/droite
 *  dans l'ordre, haut/bas d'une ligne à l'autre), Échap ferme et rend le focus au bouton (voir
 *  `Popover`). */
export function WorkspaceLayoutMenu({ layout, onLayoutChange }: WorkspaceLayoutMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const currentLabel = gridLayoutLabel(layout);

  function moveFocus(e: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(".lq-chart-workspace__layout-menu-options")).map((row) =>
      Array.from(row.querySelectorAll<HTMLButtonElement>(`.${OPTION_CLASS}`))
    );
    const target = e.target as HTMLElement;
    const r = rows.findIndex((row) => row.includes(target as HTMLButtonElement));
    if (r === -1) return;
    const c = rows[r].indexOf(target as HTMLButtonElement);
    const flat = rows.flat();
    const at = flat.indexOf(target as HTMLButtonElement);
    let next: HTMLButtonElement | undefined;
    if (e.key === "ArrowRight") next = flat[(at + 1) % flat.length];
    else if (e.key === "ArrowLeft") next = flat[(at - 1 + flat.length) % flat.length];
    else if (e.key === "Home") next = rows[r][0];
    else if (e.key === "End") next = rows[r][rows[r].length - 1];
    else {
      const row = rows[(r + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length];
      next = row[Math.min(c, row.length - 1)];
    }
    e.preventDefault();
    next?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={["lq-chart__icon-button", "lq-chart-workspace__layout-trigger", open && "lq-chart__icon-button--active"].filter(Boolean).join(" ")}
        onClick={() => setOpen((o) => !o)}
        aria-label={`Disposition des fenêtres (${currentLabel})`}
        aria-haspopup="true"
        aria-expanded={open}
        title={`Disposition des fenêtres — ${currentLabel}`}
      >
        <GridLayoutIcon layout={layout} width={16} height={12} />
      </button>
      <Popover
        open={open}
        onClose={close}
        anchorRef={triggerRef}
        placement="bottom"
        initialFocus={(panel) => panel.querySelector<HTMLElement>(`.${OPTION_CLASS}--selected`)}
      >
        <div className="lq-chart-workspace__layout-menu" role="group" aria-label="Disposition des fenêtres" onKeyDown={moveFocus}>
          {GRID_LAYOUTS_BY_PANELS.map(({ panels, layouts }) => (
            <div key={panels} className="lq-chart-workspace__layout-menu-row" role="group" aria-label={panels === 1 ? "1 fenêtre" : `${panels} fenêtres`}>
              <span className="lq-chart-workspace__layout-menu-count" aria-hidden="true">
                {panels}
              </span>
              <div className="lq-chart-workspace__layout-menu-options">
                {layouts.map((option) => {
                  const selected = option.id === layout.id;
                  const label = gridLayoutLabel(option);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={[OPTION_CLASS, selected && `${OPTION_CLASS}--selected`].filter(Boolean).join(" ")}
                      aria-label={label}
                      aria-pressed={selected}
                      title={label}
                      onClick={() => {
                        onLayoutChange(option);
                        setOpen(false);
                      }}
                    >
                      <GridLayoutIcon layout={option} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Popover>
    </>
  );
}
