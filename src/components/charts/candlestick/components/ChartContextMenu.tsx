import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./ChartContextMenu.css";

/** Ce que vise une entrée du menu, entouré sur le graphique pendant qu'elle est survolée : un panneau (« price », «
 *  volume », l'id d'un panneau d'indicateur, ou « chart » pour le graphique entier), et si besoin la courbe d'un
 *  indicateur ou le dessin dans ce panneau. */
export interface ChartMenuTarget {
  pane: string;
  lineId?: string;
  drawingId?: string;
}

/** One row. A separator is `{ separator: true }`; everything else is a command. */
export type ChartContextMenuItem =
  | { separator: true }
  | {
      separator?: false;
      /** Stable key, and the accessible name. */
      label: string;
      onSelect: () => void;
      /** Greyed and unclickable — used for a command whose target is not there (no cursor price
       *  to add a line at, say) rather than hiding it, so the menu keeps the same shape and the
       *  same muscle memory from one right-click to the next. */
      disabled?: boolean;
      /** Right-aligned hint: a keyboard shortcut, or what the command will act on. */
      hint?: string;
      /** Sous-menu : la ligne l'ouvre (survol, clic ou flèche droite) au lieu d'appeler `onSelect`. */
      submenu?: ChartContextMenuItem[];
      /** Sa cible, mise en évidence au survol ou au focus (voir `ChartContextMenuProps.onTargetChange`). */
      target?: ChartMenuTarget;
      /** Famille de la ligne : au survol d'une ligne, celles des autres familles s'estompent. Par défaut, le groupe
       *  entre deux séparateurs (« Ligne horizontale ici » et « Ligne verticale ici », « Ajouter un symbole » et
       *  « Ajouter un indicateur »…) ; une même famille peut réunir des lignes de groupes différents. */
      family?: string;
    };

export interface ChartContextMenuProps {
  /** Where the click happened, relative to the chart's own positioned root. */
  x: number;
  y: number;
  /** The box the menu must stay inside — the chart's own, so a menu opened near an edge folds back
   *  over the chart instead of being clipped by its `overflow: hidden`. */
  bounds: { width: number; height: number };
  items: ChartContextMenuItem[];
  onClose: () => void;
  /** L'entrée survolée ou sélectionnée au clavier change : sa cible (`null` : aucune, ou le menu se ferme). */
  onTargetChange?: (target: ChartMenuTarget | null) => void;
}

/** The chart's own right-click menu, replacing the browser's.
 *
 *  Flipped rather than clamped when it would overrun an edge: a menu pinned to the bottom of the
 *  chart with its first item off-screen is worse than one that opens upward, which is what every
 *  native menu does and what the hand already expects. */
export function ChartContextMenu({ x, y, bounds, items, onClose, onTargetChange }: ChartContextMenuProps) {
  // Rien ne reste entouré une fois le menu fermé.
  const onTargetChangeRef = useRef(onTargetChange);
  onTargetChangeRef.current = onTargetChange;
  useEffect(() => () => onTargetChangeRef.current?.(null), []);
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Measured after mount, before paint: the menu's own size depends on its longest label, which
  // nothing here can know ahead of time.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: x + width > bounds.width ? Math.max(0, x - width) : x,
      top: y + height > bounds.height ? Math.max(0, y - height) : y,
    });
  }, [x, y, bounds.width, bounds.height]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // `pointerdown` rather than `click`: a menu that is still up while the next gesture has already
    // started reads as unresponsive, and this also catches a drag beginning outside it.
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    // A second right-click elsewhere should move the menu, not leave two behaviours fighting.
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="lq-chart__context-menu"
      style={{ left: pos.left, top: pos.top }}
      role="menu"
      // Right-clicking the menu itself must not summon the browser's own on top of it.
      onContextMenu={(e) => e.preventDefault()}
      onPointerLeave={() => onTargetChange?.(null)}
    >
      <ChartContextMenuList items={items} onClose={onClose} openLeft={pos.left + 2 * MENU_WIDTH_GUESS > bounds.width} onTargetChange={onTargetChange} />
    </div>
  );
}

/** Largeur supposée d'un menu, pour décider de quel côté s'ouvre un sous-menu sans attendre de le mesurer. */
const MENU_WIDTH_GUESS = 220;

/** Les lignes d'un menu ; une ligne à sous-menu ouvre le sien à côté d'elle (à gauche près du bord droit). */
function ChartContextMenuList({
  items,
  onClose,
  openLeft,
  onTargetChange,
}: {
  items: ChartContextMenuItem[];
  onClose: () => void;
  openLeft: boolean;
  onTargetChange?: (target: ChartMenuTarget | null) => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Familles : le groupe entre deux séparateurs, sauf famille donnée par la ligne. Celle survolée reste nette, les
  // autres s'estompent (la souris seulement ; le clavier garde tout lisible).
  const families: (string | null)[] = [];
  let section = 0;
  for (const item of items) {
    if (item.separator) {
      section++;
      families.push(null);
    } else families.push(item.family ?? `groupe-${section}`);
  }
  const [hoveredFamily, setHoveredFamily] = useState<string | null>(null);
  const dimmed = (i: number) => hoveredFamily !== null && families[i] !== hoveredFamily;
  const hover = (i: number) => (e: { pointerType: string }) => {
    if (e.pointerType === "mouse") setHoveredFamily(families[i]);
  };
  const leave = () => setHoveredFamily(null);
  return (
    <>
      {items.map((item, i) =>
        item.separator ? (
          <div key={`sep-${i}`} className="lq-chart__context-menu-separator" role="separator" />
        ) : item.submenu ? (
          <div
            key={`${i}-${item.label}`}
            className={["lq-chart__context-menu-subwrap", dimmed(i) && "lq-chart__context-menu-item--dimmed"].filter(Boolean).join(" ")}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") setOpenIndex(i);
              hover(i)(e);
            }}
            onPointerLeave={leave}
          >
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={openIndex === i}
              className={["lq-chart__context-menu-item", openIndex === i && "lq-chart__context-menu-item--open"].filter(Boolean).join(" ")}
              disabled={item.disabled}
              onClick={() => setOpenIndex((o) => (o === i ? null : i))}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") setOpenIndex(i);
                if (e.key === "ArrowLeft") setOpenIndex(null);
              }}
            >
              <span>{item.label}</span>
              <span className="lq-chart__context-menu-hint">
                {item.hint !== undefined && `${item.hint} `}›
              </span>
            </button>
            {openIndex === i && (
              <div
                className={["lq-chart__context-menu", "lq-chart__context-menu--sub", openLeft && "lq-chart__context-menu--sub-left"].filter(Boolean).join(" ")}
                role="menu"
                aria-label={item.label}
              >
                <ChartContextMenuList items={item.submenu} onClose={onClose} openLeft={openLeft} onTargetChange={onTargetChange} />
              </div>
            )}
          </div>
        ) : (
          <button
            key={`${i}-${item.label}`}
            type="button"
            role="menuitem"
            className={["lq-chart__context-menu-item", dimmed(i) && "lq-chart__context-menu-item--dimmed"].filter(Boolean).join(" ")}
            disabled={item.disabled}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") setOpenIndex(null);
              hover(i)(e);
              onTargetChange?.(item.target ?? null);
            }}
            onPointerLeave={leave}
            onFocus={() => onTargetChange?.(item.target ?? null)}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            <span>{item.label}</span>
            {item.hint !== undefined && <span className="lq-chart__context-menu-hint">{item.hint}</span>}
          </button>
        ),
      )}
    </>
  );
}
