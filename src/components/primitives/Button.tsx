import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "../feedback/Spinner";
import "./Button.css";

/** Couleur d'un bouton d'action. `"default"` garde le bouton neutre du kit ; les autres le teintent de la
 *  couleur du thème du même nom (`primary` : l'accent), lue dans les mêmes variables `--lq-tone-*` que
 *  les surfaces pleines de `Card` — un thème qui les règle règle aussi les boutons. */
export type ButtonTone = "default" | "primary" | "success" | "info" | "danger" | "warning";

/** Forme du bouton : `solid` (défaut, plein), `outline` (bordé, fond transparent), `ghost` (sans
 *  bordure, fond au survol), `link` (un lien : ni fond ni bordure, souligné au survol). */
export type ButtonVariant = "solid" | "outline" | "ghost" | "link";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Couleur d'action. Défaut `"default"`. Un ton n'est pas un état : il ne pose pas `aria-pressed`
   *  (seul `selected` en pose un). */
  tone?: ButtonTone;
  /** Forme. Défaut `"solid"`, le rendu historique. */
  variant?: ButtonVariant;
  /** Occupé : un `Spinner` prend la place de l'icône (ou se pose au centre, le libellé masqué mais
   *  gardant sa place — la largeur ne bouge pas), `aria-busy` et `aria-disabled` sont posés et les
   *  clics ignorés. Le bouton reste focalisable, pour que le focus ne saute pas pendant l'attente. */
  loading?: boolean;
  /** Nom du spinner pour les lecteurs d'écran. Défaut « Chargement… ». */
  loadingLabel?: string;
  /** Visually pressed/active — a discrete choice (e.g. the selected white-balance preset) or a toggle's "on" state. */
  selected?: boolean;
  /** Full-width block button, e.g. the "Fermer" action at the bottom of a modal. */
  block?: boolean;
  /** Icon shown alongside the label; nudges slightly on hover. */
  icon?: ReactNode;
  /** Position of `icon` (and `selectedIcon`) relative to the label. Default "leading". */
  iconPosition?: "leading" | "trailing";
  /** Swaps to this icon instead of `icon` while `selected` is true, popping in — e.g. a filled vs
   *  outline star for a "favorite" toggle, or a check replacing a plus. */
  selectedIcon?: ReactNode;
}

/** Bordered rectangular button used for discrete choices (Allumer/Éteindre, Blanc chaud…) and, with
 *  `selected`/`selectedIcon`, as a toggle button (different tone + an animated state icon once pressed). */
export function Button({ children, selected, block, icon, iconPosition = "leading", selectedIcon, tone = "default", variant = "solid", loading = false, loadingLabel, className, onClick, ...rest }: ButtonProps) {
  // Occupé avec une icône : le spinner prend sa case. Sans icône : il se pose par-dessus le libellé.
  const spinner = loading && <Spinner size={16} label={loadingLabel} className="lq-button__spinner" />;
  const resolvedIcon = loading && icon ? spinner : selected && selectedIcon ? selectedIcon : icon;
  const iconEl = resolvedIcon && (
    <span key={selected ? "on" : "off"} className={["lq-button__icon", selected && selectedIcon && "lq-button__icon--pop"].filter(Boolean).join(" ")}>
      {resolvedIcon}
    </span>
  );

  return (
    <button
      type="button"
      className={[
        "lq-button",
        variant !== "solid" && `lq-button--${variant}`,
        tone !== "default" && `lq-button--toned lq-button--tone-${tone}`,
        selected && "lq-button--selected",
        block && "lq-button--block",
        loading && "lq-button--loading",
        loading && !icon && "lq-button--loading-overlay",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={selected}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      onClick={(e) => {
        if (loading) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {iconPosition === "leading" && iconEl}
      {loading && !icon ? <span className="lq-button__label">{children}</span> : children}
      {iconPosition === "trailing" && iconEl}
      {loading && !icon && spinner}
    </button>
  );
}
