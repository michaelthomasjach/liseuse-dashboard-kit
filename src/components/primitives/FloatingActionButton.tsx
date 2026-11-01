import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { toneAttribute, type SurfaceTone } from "./tone";
import "./FloatingActionButton.css";

/** Une action secondaire du « speed dial » : un petit bouton rond et son libellé. */
export interface FloatingAction {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
}

export interface FloatingActionButtonProps {
  /** Nom accessible du bouton principal — il n'a pas de texte visible. Défaut « Actions » avec
   *  `actions`, « Ajouter » sans. */
  ariaLabel?: string;
  /** L'icône du bouton principal. Défaut : un « + », qui pivote en « × » quand le menu est ouvert. */
  icon?: ReactNode;
  /** Remplace l'icône pendant que le menu est ouvert (au lieu de faire pivoter `icon`). */
  openIcon?: ReactNode;
  /** Le remplissage du bouton, pris aux tons pleins du kit. Défaut `"accent"` ; `"default"` donne un
   *  bouton du fond des panneaux, cerclé d'un filet. */
  tone?: SurfaceTone;
  /** `"md"` (défaut) : 56 px ; `"sm"` : 40 px. */
  size?: "sm" | "md";
  /** `"fixed"` (défaut) : collé à un coin de la fenêtre, au-dessus du défilement. `"absolute"` : collé
   *  à un coin du premier ancêtre positionné — un panneau, une carte, un cadre de démonstration.
   *  `"static"` : dans le flux, là où il est écrit. */
  position?: "fixed" | "absolute" | "static";
  /** Le coin visé. Défaut `"bottom-right"`. Les actions se déplient vers l'intérieur de l'écran. */
  placement?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /** Distance au coin, en px ou toute longueur CSS. Défaut 24 px. */
  offset?: number | string;
  /** Les actions secondaires. Présentes, un clic sur le bouton principal les déplie au lieu d'appeler `onClick`. */
  actions?: FloatingAction[];
  /** Ouverture contrôlée du menu. */
  open?: boolean;
  /** Ouverture au départ (non contrôlé). */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** L'action du bouton principal quand il n'a pas d'`actions`. */
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

const PlusGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * Bouton rond flottant, l'action principale d'un écran (« Nouvelle commande »). Avec `actions`, il
 * devient un « speed dial » : un clic déplie une colonne d'actions secondaires, chacune avec son
 * libellé ; Échap, un clic ailleurs ou le choix d'une action la referment.
 *
 * Clavier : le bouton principal porte `aria-expanded` ; une fois ouvert au clavier, le focus passe à
 * la première action, ↑/↓ circulent entre elles, Échap referme et rend le focus au bouton.
 */
export function FloatingActionButton({
  ariaLabel,
  icon,
  openIcon,
  tone = "accent",
  size = "md",
  position = "fixed",
  placement = "bottom-right",
  offset = 24,
  actions,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  onClick,
  disabled,
  className,
}: FloatingActionButtonProps) {
  const hasActions = !!actions && actions.length > 0;
  const [inner, setInner] = useState(defaultOpen);
  const open = hasActions && (openProp ?? inner);
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLButtonElement>(null);
  const focusFirst = useRef(false);
  const listId = useId();

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setInner(next);
    onOpenChange?.(next);
  };

  const actionButtons = () => Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>(".lq-fab__action-button:not(:disabled)") ?? []);

  // Ouvert au clavier : le focus descend sur la première action.
  useEffect(() => {
    if (open && focusFirst.current) actionButtons()[0]?.focus();
    focusFirst.current = false;
  }, [open]);

  // Un clic hors du composant referme le menu.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) mainRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    const list = actionButtons();
    if (list.length === 0) return;
    e.preventDefault();
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    // Les actions sont rangées dans le DOM du bouton vers l'extérieur ; à l'écran, « vers le haut »
    // s'éloigne du bouton quand il est en bas, s'en rapproche quand il est en haut.
    const outward = placement.startsWith("bottom") ? e.key === "ArrowUp" : e.key === "ArrowDown";
    const to = index === -1 ? 0 : (index + (outward ? 1 : -1) + list.length) % list.length;
    list[to].focus();
  };

  const [vertical, horizontal] = placement.split("-") as ["top" | "bottom", "left" | "right"];
  const gap = typeof offset === "number" ? `${offset}px` : offset;
  const style = position === "static" ? undefined : { [vertical]: gap, [horizontal]: gap };

  const mainIcon = open && openIcon ? openIcon : (icon ?? <PlusGlyph />);

  return (
    <div
      ref={rootRef}
      className={[
        "lq-fab",
        `lq-fab--${position}`,
        `lq-fab--${vertical}`,
        `lq-fab--${horizontal}`,
        `lq-fab--${size}`,
        open && "lq-fab--open",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        // Le focus quitte le composant (Tab au-delà de la dernière action) : le menu se referme.
        if (open && e.relatedTarget && !rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      {hasActions && (
        <ul id={listId} className="lq-fab__actions" role="menu" aria-label={ariaLabel ?? "Actions"} hidden={!open}>
          {actions!.map((action) => (
            <li key={action.id} className="lq-fab__action" role="none">
              <span className="lq-fab__action-label" aria-hidden="true">
                {action.label}
              </span>
              <button
                type="button"
                role="menuitem"
                className="lq-fab__action-button"
                aria-label={action.label}
                disabled={action.disabled}
                tabIndex={-1}
                onClick={() => {
                  action.onSelect?.();
                  close(true);
                }}
              >
                {action.icon}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        ref={mainRef}
        type="button"
        className={["lq-fab__button", openIcon ? null : "lq-fab__button--rotates"].filter(Boolean).join(" ")}
        data-lq-tone={toneAttribute(tone)}
        aria-label={ariaLabel ?? (hasActions ? "Actions" : "Ajouter")}
        aria-haspopup={hasActions ? "menu" : undefined}
        aria-expanded={hasActions ? open : undefined}
        aria-controls={hasActions ? listId : undefined}
        disabled={disabled}
        onClick={() => {
          if (hasActions) setOpen(!open);
          else onClick?.();
        }}
        onKeyDown={(e) => {
          if (hasActions && !open && (e.key === "Enter" || e.key === " " || e.key === "ArrowUp" || e.key === "ArrowDown")) {
            focusFirst.current = true;
            if (e.key.startsWith("Arrow")) {
              e.preventDefault();
              setOpen(true);
            }
          }
        }}
      >
        <span className="lq-fab__icon">{mainIcon}</span>
      </button>
    </div>
  );
}
