import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { MenuIcon, CloseIcon } from "../icons";
import "./HeaderLayout.css";

export interface HeaderNavItem {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}

export interface HeaderLayoutProps {
  logo?: ReactNode;
  navItems?: HeaderNavItem[];
  /** Right-aligned slot — search, notifications, `UserMenu`. */
  actions?: ReactNode;
  children: ReactNode;
  /** Vrai (défaut) : au moins toute la hauteur de la fenêtre, menu replié selon la largeur de la
   *  fenêtre. Faux : remplit son conteneur (`min-height: 100%`) et replie le menu selon **sa
   *  propre** largeur — pour un aperçu dans un cadre. */
  fullHeight?: boolean;
  className?: string;
}

/**
 * La pastille qui suit l'entrée active du menu (`.lq-header-layout__indicator`). Cachée par défaut :
 * un thème l'allume en CSS (le thème Liquid le fait), et c'est alors elle qui porte le fond de
 * l'entrée active. Au changement d'entrée, le bord de tête part d'abord, le bord de queue suit avec
 * un léger retard (`data-dir`), et la pastille s'écrase un instant puis se remet en place
 * (`data-squish`, qui alterne pour relancer l'animation) : une goutte d'eau plutôt qu'un bloc qui
 * glisse. Positionnée dans le menu lui-même : s'il défile, elle défile avec ses entrées.
 */
function useNavIndicator(activeId: string | undefined) {
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const last = useRef<{ left: number; right: number; top: number; height: number } | null>(null);

  const place = useCallback((animate: boolean) => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;
    const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) {
      indicator.dataset.state = "hidden";
      last.current = null;
      return;
    }
    const next = {
      left: active.offsetLeft,
      right: nav.clientWidth - (active.offsetLeft + active.offsetWidth),
      top: active.offsetTop,
      height: active.offsetHeight,
    };
    const before = last.current;
    if (before && before.left === next.left && before.right === next.right && before.top === next.top && before.height === next.height) return;
    const moving = animate && before !== null && indicator.dataset.state === "shown" && before.left !== next.left;
    indicator.dataset.dir = moving ? (next.left > before.left ? "right" : "left") : "none";
    if (moving) indicator.dataset.squish = indicator.dataset.squish === "a" ? "b" : "a";
    indicator.style.left = `${next.left}px`;
    indicator.style.right = `${next.right}px`;
    indicator.style.top = `${next.top}px`;
    indicator.style.height = `${next.height}px`;
    indicator.dataset.state = "shown";
    last.current = next;
  }, []);

  // Avant l'affichage : la pastille est déjà sous la bonne entrée au premier rendu.
  useLayoutEffect(() => place(true), [activeId, place]);

  // Taille du menu changée (police chargée, fenêtre redimensionnée) : la pastille suit sans animation.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => place(false));
    ro.observe(nav);
    return () => ro.disconnect();
  }, [place]);

  return { navRef, indicatorRef };
}

/** App shell with a sticky horizontal top nav; collapses into a hamburger drawer on narrow screens.
 *  L'entrée `active` porte `aria-current="page"`. */
export function HeaderLayout({ logo, navItems = [], actions, children, fullHeight = true, className }: HeaderLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { navRef, indicatorRef } = useNavIndicator(navItems.find((item) => item.active)?.id);

  return (
    <div className={["lq-header-layout", !fullHeight && "lq-header-layout--contained", className].filter(Boolean).join(" ")}>
      <header className="lq-header-layout__bar">
        <div className="lq-header-layout__logo">{logo}</div>

        <nav ref={navRef} className="lq-header-layout__nav lq-header-layout__nav--desktop">
          <span ref={indicatorRef} className="lq-header-layout__indicator" aria-hidden="true" data-state="hidden" />
          {navItems.map((item) => (
            <a
              key={item.id}
              href={item.href ?? "#"}
              className={["lq-header-layout__nav-item", item.active && "lq-header-layout__nav-item--active"].filter(Boolean).join(" ")}
              aria-current={item.active ? "page" : undefined}
              onClick={(e) => {
                if (item.onClick) {
                  e.preventDefault();
                  item.onClick();
                }
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="lq-header-layout__actions">
          {actions}
          {navItems.length > 0 && (
            <button
              type="button"
              className="lq-header-layout__menu-button"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
            </button>
          )}
        </div>
      </header>

      {mobileOpen && (
        <nav className="lq-header-layout__nav--mobile">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={item.href ?? "#"}
              className={["lq-header-layout__nav-item", item.active && "lq-header-layout__nav-item--active"].filter(Boolean).join(" ")}
              aria-current={item.active ? "page" : undefined}
              onClick={(e) => {
                if (item.onClick) {
                  e.preventDefault();
                  item.onClick();
                }
                setMobileOpen(false);
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}

      <main className="lq-header-layout__content">{children}</main>
    </div>
  );
}
