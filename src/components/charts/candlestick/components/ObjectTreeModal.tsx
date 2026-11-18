import { useLayoutEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { Modal } from "../../../primitives/Modal";
import { EyeIcon, EyeOffIcon, GripIcon, SettingsIcon, TrashIcon } from "../../../icons";
import { useLegendIndicatorDrag } from "../hooks/useLegendIndicatorDrag";
import "./ObjectTreeModal.css";

/** Un objet de l'arborescence : le symbole, un indicateur, un dessin, le volume… Chaque action absente n'a pas de
 *  bouton (le symbole ne se supprime pas, un dessin n'a pas d'œil s'il ne se masque pas…). */
export interface ObjectTreeItem {
  id: string;
  label: string;
  /** Précision discrète après le nom : « script », « comparaison », le type de dessin… */
  detail?: string;
  icon: ReactNode;
  /** Couleur de l'objet (celle de sa courbe), portée par son icône. */
  color?: string;
  hidden?: boolean;
  selected?: boolean;
  /** Se déplace par glisser-déposer (ou Alt+↑/↓) à l'intérieur de sa zone. */
  reorderable?: boolean;
  /** Clic sur la ligne : sélectionne l'objet sur le graphique. */
  onSelect?: () => void;
  /** Survol de la ligne : l'objet est mis en avant sur le graphique, comme au survol de sa légende. */
  onHover?: (hovered: boolean) => void;
  onToggleHidden?: () => void;
  onSettings?: () => void;
  onRemove?: () => void;
}

/** Une zone du graphique : le graphique des prix, un panneau du bas (son indicateur, ceux posés dessus, ses dessins),
 *  le volume, un panneau latéral. */
export interface ObjectTreeZone {
  id: string;
  title: string;
  /** Panneau du bas : se déplace parmi les autres panneaux du bas (même ordre que le glisser des en-têtes). */
  movable?: boolean;
  items: ObjectTreeItem[];
}

export interface ObjectTreeModalProps {
  open: boolean;
  onClose: () => void;
  zones: ObjectTreeZone[];
  /** Nouvel ordre des objets déplaçables d'une zone (ids, de haut en bas). */
  onReorderItems: (zoneId: string, orderedIds: string[]) => void;
  /** Nouvel ordre des panneaux du bas (ids des zones `movable`, de haut en bas). */
  onReorderPanes: (orderedIds: string[]) => void;
}

/** Déplace `id` de `delta` rangs dans `order` ; null s'il est déjà au bord. */
function moved(order: string[], id: string, delta: number): string[] | null {
  const from = order.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= order.length) return null;
  const next = order.filter((x) => x !== id);
  next.splice(to, 0, id);
  return next;
}

/**
 * « Object tree » (arborescence des objets), à la manière des plateformes de marché : tout ce que montre le graphique,
 * groupé par zone — le graphique des prix (le symbole, les symboles comparés, le volume s'il y est posé, les indicateurs
 * sur les prix, les dessins), puis chaque panneau du bas dans son ordre (son indicateur, ceux posés dessus), puis les
 * panneaux latéraux. Les indicateurs se réordonnent à l'intérieur de leur zone par glisser-déposer, avec le même geste
 * que la légende (useLegendIndicatorDrag : seuil de 4 px, ligne soulevée, trait d'accent), et les panneaux du bas entre
 * eux en glissant leur en-tête. Au clavier : ↑/↓ passent d'une ligne à l'autre, Alt+↑/↓ déplacent la ligne (ou le
 * panneau) qui a le focus, Entrée sélectionne l'objet. Les sorties de scripts apparaissent mais ne se déplacent pas.
 */
export function ObjectTreeModal({ open, onClose, zones, onReorderItems, onReorderPanes }: ObjectTreeModalProps) {
  const treeRef = useRef<HTMLDivElement>(null);
  // Après un déplacement au clavier, React déplace le nœud de la ligne dans le DOM et le focus se perd : on le lui
  // rend (tant qu'aucune autre touche ni aucun clic n'est venu entre-temps).
  const pendingFocusRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    const key = pendingFocusRef.current;
    if (!key || !treeRef.current) return;
    const el = treeRef.current.querySelector<HTMLElement>(`[data-object-tree-key="${CSS.escape(key)}"]`);
    if (el && document.activeElement !== el) el.focus();
  });
  const movableIds = zones.filter((z) => z.movable).map((z) => z.id);
  const paneDrag = useLegendIndicatorDrag(movableIds, onReorderPanes);
  let paneNumber = 0;

  function onTreeKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    pendingFocusRef.current = null;
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    const target = e.target as HTMLElement;
    const key = target.dataset.objectTreeKey;
    if (!key) return;
    const delta = e.key === "ArrowUp" ? -1 : 1;
    e.preventDefault();
    if (e.altKey) {
      // Alt+↑/↓ : déplacer la ligne dans sa zone, ou le panneau parmi les panneaux du bas.
      const [type, zoneId, id] = key.split("\u0000") as [string, string, string | undefined];
      if (type === "zone") {
        const next = moved(movableIds, zoneId, delta);
        if (next) {
          pendingFocusRef.current = key;
          onReorderPanes(next);
        }
        return;
      }
      const zone = zones.find((z) => z.id === zoneId);
      if (!zone || !id) return;
      const next = moved(zone.items.filter((i) => i.reorderable).map((i) => i.id), id, delta);
      if (next) {
        pendingFocusRef.current = key;
        onReorderItems(zoneId, next);
      }
      return;
    }
    // ↑/↓ : la ligne (ou l'en-tête de panneau) précédente ou suivante.
    const focusables = Array.from(treeRef.current?.querySelectorAll<HTMLElement>("[data-object-tree-key]") ?? []);
    const index = focusables.indexOf(target);
    focusables[index + delta]?.focus();
  }

  return (
    <Modal open={open} onClose={onClose} title="Object tree" className="lq-object-tree-modal">
      <p className="lq-object-tree__subtitle">Arborescence des objets du graphique</p>
      <div
        ref={treeRef}
        className="lq-object-tree"
        role="tree"
        aria-label="Object tree — arborescence des objets du graphique"
        onKeyDown={onTreeKeyDown}
        onPointerDownCapture={() => {
          pendingFocusRef.current = null;
        }}
      >
        {zones.map((zone) => {
          const number = zone.movable ? ++paneNumber : 0;
          const dragged = paneDrag.draggingId === zone.id;
          return (
            <section
              key={zone.id}
              className={[
                "lq-object-tree__zone",
                zone.movable && "lq-object-tree__zone--movable",
                dragged && "lq-object-tree__zone--dragging",
                paneDrag.dropBeforeId === zone.id && "lq-object-tree__zone--drop-before",
                paneDrag.dropAfterId === zone.id && "lq-object-tree__zone--drop-after",
              ]
                .filter(Boolean)
                .join(" ")}
              style={dragged ? { transform: `translateY(${paneDrag.offsetY}px)` } : undefined}
              {...(zone.movable && paneDrag.enabled
                ? {
                    "data-legend-indicator-id": zone.id,
                    // Seul l'en-tête du panneau le saisit : une ligne glissée à l'intérieur reste dans sa zone.
                    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
                      if ((e.target as HTMLElement).closest(".lq-object-tree__zone-head")) paneDrag.start(zone.id, e);
                    },
                  }
                : {})}
            >
              <div
                className="lq-object-tree__zone-head"
                role="treeitem"
                aria-level={1}
                aria-expanded
                {...(zone.movable
                  ? {
                      tabIndex: 0,
                      "data-object-tree-key": `zone\u0000${zone.id}`,
                      title: "Glisser pour déplacer le panneau · Alt+↑/↓ au clavier",
                      "aria-label": `${zone.title}${number ? ` (panneau ${number})` : ""} — Alt+flèches pour le déplacer`,
                    }
                  : {})}
              >
                {zone.movable && paneDrag.enabled ? <GripIcon size={12} className="lq-object-tree__grip" aria-hidden="true" /> : null}
                <span className="lq-object-tree__zone-title">{zone.title}</span>
                {number > 0 && <span className="lq-object-tree__zone-index">Panneau {number}</span>}
              </div>
              <TreeZoneRows zone={zone} onReorderItems={onReorderItems} />
            </section>
          );
        })}
      </div>
      <p className="lq-object-tree__hint">
        Glisser une ligne pour la déplacer dans sa zone, l'en-tête d'un panneau pour déplacer le panneau · au clavier, Alt+↑/↓.
        Les sorties de scripts restent à leur place.
      </p>
    </Modal>
  );
}

/** Les lignes d'une zone, avec leur propre glisser-déposer (un par zone : une ligne ne quitte pas la sienne). */
function TreeZoneRows({ zone, onReorderItems }: { zone: ObjectTreeZone; onReorderItems: ObjectTreeModalProps["onReorderItems"] }) {
  const order = zone.items.filter((i) => i.reorderable).map((i) => i.id);
  const drag = useLegendIndicatorDrag(order, (ids) => onReorderItems(zone.id, ids));
  if (zone.items.length === 0) return <p className="lq-object-tree__empty">Aucun objet</p>;
  return (
    <div className="lq-object-tree__rows" role="group">
      {zone.items.map((item) => {
        const reorderable = drag.enabled && item.reorderable === true;
        const dragged = drag.draggingId === item.id;
        const key = `row\u0000${zone.id}\u0000${item.id}`;
        return (
          <div
            key={item.id}
            className={[
              "lq-object-tree__row",
              item.selected && "lq-object-tree__row--selected",
              item.hidden && "lq-object-tree__row--hidden",
              reorderable && "lq-object-tree__row--reorderable",
              dragged && "lq-object-tree__row--dragging",
              drag.dropBeforeId === item.id && "lq-object-tree__row--drop-before",
              drag.dropAfterId === item.id && "lq-object-tree__row--drop-after",
            ]
              .filter(Boolean)
              .join(" ")}
            role="treeitem"
            aria-level={2}
            aria-selected={item.selected === true}
            tabIndex={0}
            data-object-tree-key={key}
            style={dragged ? { transform: `translateY(${drag.offsetY}px)` } : undefined}
            title={reorderable ? "Glisser pour réordonner · Alt+↑/↓ au clavier" : undefined}
            onClick={item.onSelect}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.target === e.currentTarget && item.onSelect) {
                e.preventDefault();
                item.onSelect();
              }
            }}
            onMouseEnter={() => item.onHover?.(true)}
            onMouseLeave={() => item.onHover?.(false)}
            {...(reorderable
              ? {
                  "data-legend-indicator-id": item.id,
                  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => drag.start(item.id, e),
                  onClickCapture: (e: ReactMouseEvent) => {
                    if (drag.suppressClickRef.current) e.stopPropagation();
                  },
                }
              : {})}
          >
            {reorderable ? <GripIcon size={12} className="lq-object-tree__grip" aria-hidden="true" /> : <span className="lq-object-tree__grip" aria-hidden="true" />}
            <span className="lq-object-tree__icon" style={item.color ? { color: item.color } : undefined} aria-hidden="true">
              {item.icon}
            </span>
            <span className="lq-object-tree__label">{item.label}</span>
            {item.detail && <span className="lq-object-tree__detail">{item.detail}</span>}
            <span className="lq-object-tree__actions">
              {item.onToggleHidden && (
                <button
                  type="button"
                  className="lq-object-tree__action"
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onToggleHidden!();
                  }}
                  aria-label={item.hidden ? `Afficher ${item.label}` : `Masquer ${item.label}`}
                  aria-pressed={item.hidden === true}
                  title={item.hidden ? "Afficher" : "Masquer"}
                >
                  {item.hidden ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                </button>
              )}
              {item.onSettings && (
                <button
                  type="button"
                  className="lq-object-tree__action"
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onSettings!();
                  }}
                  aria-label={`Paramètres de ${item.label}`}
                  title="Paramètres"
                >
                  <SettingsIcon size={14} />
                </button>
              )}
              {item.onRemove && (
                <button
                  type="button"
                  className="lq-object-tree__action"
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onRemove!();
                  }}
                  aria-label={`Supprimer ${item.label}`}
                  title="Supprimer"
                >
                  <TrashIcon size={14} />
                </button>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
