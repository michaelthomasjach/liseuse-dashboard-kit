import type { CSSProperties, MouseEvent, ReactNode } from "react";
import "./BottomNav.css";

export interface BottomNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  /** L'icône de l'entrée active, si elle diffère (pleine plutôt qu'au trait, par exemple). */
  activeIcon?: ReactNode;
  /** Un lien : l'entrée est un `<a>`. Sans `href`, c'est un `<button>`. */
  href?: string;
  onClick?: () => void;
  /** Pastille de compteur. Un nombre (0 la masque, au-delà de `badgeMax` on lit « 99+ »), ou `true`
   *  pour un simple point sans chiffre. */
  badge?: number | boolean;
  /** Ce qu'un lecteur d'écran entend pour la pastille. Défaut : « 3 notifications » / « nouveau ». */
  badgeLabel?: string;
  disabled?: boolean;
}

export interface BottomNavProps {
  /** De 3 à 5 destinations. Au-delà, les libellés n'ont plus la place sur un téléphone : regroupez
   *  le reste derrière une entrée « Plus ». */
  items: BottomNavItem[];
  /** L'entrée active — contrôlé. */
  activeId?: string;
  /** Appelé au choix d'une entrée (après son propre `onClick`). */
  onChange?: (id: string) => void;
  /** `"fixed"` (défaut) : collée au bas de la fenêtre, au-dessus du contenu, avec la marge de la zone
   *  sûre (`safe-area-inset-bottom`) des téléphones à encoche. `"static"` : dans le flux, là où on la pose. */
  position?: "fixed" | "static";
  /** `"always"` (défaut) : tous les libellés. `"active"` : seul celui de l'entrée active, les autres
   *  restent pour les lecteurs d'écran. */
  labels?: "always" | "active";
  /** Au-delà, la pastille affiche « max+ ». Défaut : 99. */
  badgeMax?: number;
  /** Nom de la région de navigation. Défaut : « Navigation principale ». */
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Barre de navigation basse d'application mobile : trois à cinq destinations, icône et libellé,
 * l'active marquée, une pastille de compteur au besoin.
 */
export function BottomNav({
  items,
  activeId,
  onChange,
  position = "fixed",
  labels = "always",
  badgeMax = 99,
  ariaLabel = "Navigation principale",
  className,
  style,
}: BottomNavProps) {
  return (
    <nav
      className={["lq-bottom-nav", `lq-bottom-nav--${position}`, labels === "active" && "lq-bottom-nav--active-labels", className]
        .filter(Boolean)
        .join(" ")}
      aria-label={ariaLabel}
      style={style}
    >
      <ul className="lq-bottom-nav__list">
        {items.map((item) => {
          const active = item.id === activeId;
          const count = typeof item.badge === "number" ? item.badge : 0;
          const dot = item.badge === true;
          const showBadge = dot || count > 0;
          const badgeText = count > badgeMax ? `${badgeMax}+` : String(count);
          const srBadge = item.badgeLabel ?? (dot ? "nouveau" : `${count} notification${count > 1 ? "s" : ""}`);
          const className = ["lq-bottom-nav__item", active && "lq-bottom-nav__item--active"].filter(Boolean).join(" ");
          const handle = (e: MouseEvent) => {
            if (item.disabled) {
              e.preventDefault();
              return;
            }
            if (item.onClick && item.href) e.preventDefault();
            item.onClick?.();
            onChange?.(item.id);
          };
          const content = (
            <>
              <span className="lq-bottom-nav__icon" aria-hidden="true">
                {active && item.activeIcon ? item.activeIcon : item.icon}
                {showBadge && (
                  <span className={["lq-bottom-nav__badge", dot && "lq-bottom-nav__badge--dot"].filter(Boolean).join(" ")}>
                    {dot ? null : badgeText}
                  </span>
                )}
              </span>
              <span className="lq-bottom-nav__label">{item.label}</span>
              {showBadge && <span className="lq-bottom-nav__sr">, {srBadge}</span>}
            </>
          );
          return (
            <li key={item.id} className="lq-bottom-nav__cell">
              {item.href !== undefined ? (
                <a
                  className={className}
                  href={item.disabled ? undefined : item.href}
                  aria-current={active ? "page" : undefined}
                  aria-disabled={item.disabled || undefined}
                  onClick={handle}
                >
                  {content}
                </a>
              ) : (
                <button type="button" className={className} aria-current={active ? "page" : undefined} disabled={item.disabled} onClick={handle}>
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
