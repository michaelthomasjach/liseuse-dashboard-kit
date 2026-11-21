import type { ReactNode } from "react";
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
  const classes = ["lq-floating-nav", `lq-floating-nav--${side}`, `lq-floating-nav--${placement}`, className].filter(Boolean).join(" ");
  return (
    <nav className={classes} aria-label={ariaLabel}>
      {title && <div className="lq-floating-nav__title">{title}</div>}
      <ul className="lq-floating-nav__list">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={item.href ?? "#"}
              className={["lq-floating-nav__item", item.active && "lq-floating-nav__item--active"].filter(Boolean).join(" ")}
              aria-current={item.active ? "page" : undefined}
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
      </ul>
    </nav>
  );
}
