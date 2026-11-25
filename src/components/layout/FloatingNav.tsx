import { useCallback, useEffect, useRef, type FocusEvent, type ReactNode } from "react";
import "./FloatingNav.css";

export interface FloatingNavItem {
  id: string;
  label: ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  /** Petite icône avant le libellé. */
  icon?: ReactNode;
  /** Pastille après le libellé (un compte, « Nouveau »…). */
  badge?: ReactNode;
}

export interface FloatingNavProps {
  items: FloatingNavItem[];
  /** Petit titre au-dessus de la liste. */
  title?: ReactNode;
  /** Bord de l'écran où se pose le menu. Défaut `"left"`. */
  side?: "left" | "right";
  /**
   * `"fixed"` (défaut) : collé au bord de la fenêtre, centré en hauteur, et en barre de pastilles en
   * bas de l'écran sur téléphone. `"absolute"` : la même chose dans le premier parent positionné
   * (un aperçu). `"static"` : une simple liste à sa place dans la page.
   */
  placement?: "fixed" | "absolute" | "static";
  /** Nom accessible de la navigation. Défaut « Sections ». */
  ariaLabel?: string;
  className?: string;
}

/**
 * Menu flottant posé sur le bord de l'écran : une liste courte de libellés, sans fond, l'entrée
 * active marquée d'un point et d'un trait plus gras. Pour sauter d'une section à l'autre d'une page
 * ou passer d'une vue à sa voisine, à côté de la barre de navigation principale.
 *
 * L'entrée `active` porte `aria-current="page"`. Sur téléphone (≤ 720 px), en placement fixe, la
 * liste devient une rangée de pastilles qui défile en bas de l'écran.
 */
export function FloatingNav({ items, title, side = "left", placement = "fixed", ariaLabel = "Sections", className }: FloatingNavProps) {
  // Rangée de pastilles (téléphone) plus large que l'écran : l'entrée active est ramenée au centre, sans faire
  // défiler la page (scrollLeft de la liste seule, pas scrollIntoView).
  const listRef = useRef<HTMLUListElement>(null);
  const activeId = items.find((i) => i.active)?.id;
  useEffect(() => {
    const list = listRef.current;
    if (!list || list.scrollWidth <= list.clientWidth) return;
    const active = list.querySelector<HTMLElement>(".lq-floating-nav__item--active");
    if (!active) return;
    list.scrollLeft = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
  }, [activeId]);
  // Bulle de survol (`.lq-floating-nav__bubble`), cachée par défaut : un thème l'allume en CSS (le thème Liquid le
  // fait). Elle se pose d'un coup sous l'entrée survolée (ou atteinte au clavier), sans glisser depuis l'entrée
  // d'avant, et s'y déploie en cercle depuis le point où se trouve la souris (le centre de l'entrée au clavier) :
  // `--lq-floating-nav-bubble-ox/oy/r`, et `data-grow`, qui alterne pour relancer l'animation à chaque entrée.
  // Elle s'efface quand le pointeur quitte la liste.
  const bubbleRef = useRef<HTMLLIElement>(null);
  const lastBubble = useRef<{ top: number; bottom: number } | null>(null);
  const moveBubble = useCallback((item: HTMLElement | null, point?: { x: number; y: number }) => {
    const list = listRef.current;
    const bubble = bubbleRef.current;
    if (!list || !bubble) return;
    if (!item) {
      bubble.dataset.state = "hidden";
      return;
    }
    const next = { top: item.offsetTop, bottom: list.clientHeight - (item.offsetTop + item.offsetHeight) };
    const before = lastBubble.current;
    const same = bubble.dataset.state === "shown" && before !== null && before.top === next.top;
    bubble.style.top = `${next.top}px`;
    bubble.style.bottom = `${next.bottom}px`;
    bubble.dataset.state = "shown";
    lastBubble.current = next;
    if (same) return;
    // Point de départ du déploiement, dans la bulle déjà posée ; le rayon atteint le coin le plus éloigné.
    const r = bubble.getBoundingClientRect();
    const ox = Math.min(Math.max((point?.x ?? r.left + r.width / 2) - r.left, 0), r.width);
    const oy = Math.min(Math.max((point?.y ?? r.top + r.height / 2) - r.top, 0), r.height);
    bubble.style.setProperty("--lq-floating-nav-bubble-ox", `${ox}px`);
    bubble.style.setProperty("--lq-floating-nav-bubble-oy", `${oy}px`);
    bubble.style.setProperty("--lq-floating-nav-bubble-r", `${Math.ceil(Math.hypot(Math.max(ox, r.width - ox), Math.max(oy, r.height - oy))) + 1}px`);
    bubble.dataset.grow = bubble.dataset.grow === "a" ? "b" : "a";
  }, []);
  const focusVisible = (el: HTMLElement) => {
    try {
      return el.matches(":focus-visible");
    } catch {
      return false;
    }
  };
  const classes = ["lq-floating-nav", `lq-floating-nav--${side}`, `lq-floating-nav--${placement}`, className].filter(Boolean).join(" ");
  return (
    <nav className={classes} aria-label={ariaLabel}>
      {title && <div className="lq-floating-nav__title">{title}</div>}
      <ul
        ref={listRef}
        className="lq-floating-nav__list"
        onPointerLeave={() => {
          const focused = listRef.current?.querySelector<HTMLElement>(".lq-floating-nav__item:focus");
          moveBubble(focused && focusVisible(focused) ? focused : null);
        }}
        onBlur={(e: FocusEvent<HTMLUListElement>) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) moveBubble(null);
        }}
      >
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={item.href ?? "#"}
              className={["lq-floating-nav__item", item.active && "lq-floating-nav__item--active"].filter(Boolean).join(" ")}
              aria-current={item.active ? "page" : undefined}
              onPointerEnter={(e) => {
                if (e.pointerType !== "touch") moveBubble(e.currentTarget, { x: e.clientX, y: e.clientY });
              }}
              onFocus={(e) => {
                if (focusVisible(e.currentTarget)) moveBubble(e.currentTarget);
              }}
              onClick={(e) => {
                if (item.onClick) {
                  e.preventDefault();
                  item.onClick();
                }
              }}
            >
              <span className="lq-floating-nav__dot" aria-hidden />
              {item.icon && <span className="lq-floating-nav__icon">{item.icon}</span>}
              <span className="lq-floating-nav__label">{item.label}</span>
              {item.badge != null && <span className="lq-floating-nav__badge">{item.badge}</span>}
            </a>
          </li>
        ))}
        <li ref={bubbleRef} className="lq-floating-nav__bubble" role="presentation" aria-hidden="true" data-state="hidden" />
      </ul>
    </nav>
  );
}
