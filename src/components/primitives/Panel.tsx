import { createContext, useContext, useId, useState, type MouseEvent, type ReactNode } from "react";
import "./Panel.css";

interface PanelCollapseState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Repli piloté par un parent (voir `PanelCollapse`) ; chaque Panel le remet à null pour ses descendants. */
const PanelCollapseContext = createContext<PanelCollapseState | null>(null);

export interface PanelCollapseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: ReactNode;
}

/**
 * Rend repliable le premier Panel qu'il contient, sans modifier le composant qui le rend : utile quand une
 * page range des cartes toutes faites dans un accordéon (une seule ouverte à la fois, par exemple).
 */
export function PanelCollapse({ open, onOpenChange, children }: PanelCollapseProps) {
  return <PanelCollapseContext.Provider value={{ open, onOpenChange }}>{children}</PanelCollapseContext.Provider>;
}

export interface PanelProps {
  /** Section title, e.g. "VOLETS". Rendered upper-cased via CSS, keep the string itself normal case. */
  title?: ReactNode;
  /** Right-aligned meta, e.g. "2 ouverts", "6 pièces". */
  meta?: ReactNode;
  /** Optional footer, rendered below the divider (e.g. a "Fermer" button). */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Removes the outer border/background so the panel blends into a parent grid cell. */
  bare?: boolean;
  /**
   * Repliable : un bouton +/− centré dans l'en-tête, l'en-tête entier est cliquable, le contenu s'ouvre et se
   * ferme avec une animation (aucune si le système demande de réduire les animations).
   */
  collapsible?: boolean;
  /** État ouvert (contrôlé). Sans cette prop, le Panel gère lui-même son état à partir de `defaultOpen`. */
  open?: boolean;
  /** État initial quand `open` n'est pas fourni. Par défaut : ouvert. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Libellé accessible du bouton ; par défaut « Déplier / Replier : » suivi du titre s'il est textuel. */
  toggleLabel?: string;
}

/** The bordered card used to group a widget's rows (Intérieur, Volets, Lumières, Énergie…). */
export function Panel({ title, meta, footer, children, className, bare, ...fold }: PanelProps) {
  const parent = useContext(PanelCollapseContext);
  const [ownOpen, setOwnOpen] = useState(fold.defaultOpen ?? true);
  const bodyId = useId();
  const collapsible = Boolean(fold.collapsible || parent);
  const open = parent ? parent.open : (fold.open ?? ownOpen);
  const setOpen = (next: boolean): void => {
    if (parent) parent.onOpenChange(next);
    else {
      if (fold.open === undefined) setOwnOpen(next);
      fold.onOpenChange?.(next);
    }
  };

  if (!collapsible) {
    return (
      <section className={["lq-panel", bare && "lq-panel--bare", className].filter(Boolean).join(" ")}>
        {(title || meta) && (
          <header className="lq-panel__header">
            {title && <h3 className="lq-panel__title">{title}</h3>}
            {meta && <span className="lq-panel__meta">{meta}</span>}
          </header>
        )}
        <PanelCollapseContext.Provider value={null}>
          <div className="lq-panel__body">{children}</div>
          {footer && <footer className="lq-panel__footer">{footer}</footer>}
        </PanelCollapseContext.Provider>
      </section>
    );
  }

  const label = fold.toggleLabel ?? `${open ? "Replier" : "Déplier"}${typeof title === "string" ? ` : ${title}` : ""}`;
  // Un clic n'importe où dans l'en-tête bascule, sauf sur un lien ou un contrôle qui a sa propre action.
  const onHeaderClick = (e: MouseEvent<HTMLElement>): void => {
    if ((e.target as Element).closest("a, button, input, select, textarea, label")) return;
    setOpen(!open);
  };
  return (
    <section
      className={["lq-panel", "lq-panel--collapsible", open ? "is-open" : "is-closed", bare && "lq-panel--bare", className].filter(Boolean).join(" ")}
    >
      <header className="lq-panel__header" onClick={onHeaderClick}>
        <div className="lq-panel__heading">
          {title && <h3 className="lq-panel__title">{title}</h3>}
          {meta && <span className="lq-panel__meta">{meta}</span>}
        </div>
        <button
          type="button"
          className="lq-panel__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={label}
          onClick={() => setOpen(!open)}
        >
          <span className="lq-panel__toggle-icon" aria-hidden="true" />
        </button>
      </header>
      {/* Grille 0fr → 1fr : la hauteur s'anime sans la mesurer. Fermé, le contenu est inerte (ni focus, ni lecteur d'écran). */}
      <div className="lq-panel__collapse" id={bodyId} {...(open ? {} : { inert: "", "aria-hidden": true })}>
        <div className="lq-panel__collapse-inner">
          <PanelCollapseContext.Provider value={null}>
            <div className="lq-panel__body">{children}</div>
            {footer && <footer className="lq-panel__footer">{footer}</footer>}
          </PanelCollapseContext.Provider>
        </div>
      </div>
    </section>
  );
}

export interface PanelRowProps {
  label: ReactNode;
  children?: ReactNode;
  /** Value/detail shown at the trailing edge of the row (e.g. a temperature). */
  value?: ReactNode;
  className?: string;
  onClick?: () => void;
}

/** A single labelled row inside a Panel; lays out label / controls / trailing value. */
export function PanelRow({ label, children, value, className, onClick }: PanelRowProps) {
  const interactive = Boolean(onClick);
  return (
    <div
      className={["lq-panel-row", interactive && "lq-panel-row--interactive", className]
        .filter(Boolean)
        .join(" ")}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <span className="lq-panel-row__label">{label}</span>
      {children && <span className="lq-panel-row__controls">{children}</span>}
      {value !== undefined && <span className="lq-panel-row__value">{value}</span>}
    </div>
  );
}
