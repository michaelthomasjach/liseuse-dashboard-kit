import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "../icons";
import { LqThemeProvider, useLqTheme } from "../../theme";
import "./SearchOverlay.css";

export interface SearchOverlayResult {
  id: string;
  label: ReactNode;
  /** Ligne secondaire, plus petite et atténuée, sous le libellé. */
  details?: ReactNode;
  /** Ce qui occupe la pastille ronde à gauche : une icône, une image… Par défaut, l'initiale du
   *  libellé quand c'est une chaîne. */
  avatar?: ReactNode;
  /** Couleur de fond de la pastille. Par défaut, l'accent du thème. */
  avatarColor?: string;
  onSelect?: () => void;
}

export interface SearchOverlaySection {
  id: string;
  title: ReactNode;
  results: SearchOverlayResult[];
}

export interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  /** La saisie, toujours contrôlée : c'est l'application qui filtre ses résultats. */
  query: string;
  onQueryChange: (query: string) => void;
  /** Entrée dans le champ. */
  onSubmit?: (query: string) => void;
  /** Les résultats, groupés ; chaque section s'affiche en colonnes de deux. */
  sections?: SearchOverlaySection[];
  /** Coin supérieur gauche — la marque de l'application. */
  brand?: ReactNode;
  placeholder?: string;
  /** Sous le champ : une consigne courte (« Entrée pour lancer la recherche »). */
  hint?: ReactNode;
  /** Affiché à la place des sections quand la saisie n'est pas vide et qu'aucune ne contient de
   *  résultat. */
  emptyText?: ReactNode;
  /**
   * « Tapez n'importe où » : tant que le calque est fermé, la frappe d'un caractère imprimable
   * hors d'un champ de saisie l'appelle avec ce caractère, à charge pour l'application d'ouvrir le
   * calque avec cette première lettre. Les raccourcis (Ctrl, Alt, Meta) ne déclenchent rien.
   */
  onTypeToOpen?: (initialQuery: string) => void;
  closeLabel?: string;
}

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/**
 * Recherche plein écran : un voile presque opaque sur toute la page, un champ en très grand corps,
 * et les résultats groupés en sections de deux colonnes, chacun avec sa pastille ronde.
 *
 * Échap ferme, Entrée soumet, et `onTypeToOpen` permet de l'ouvrir en tapant n'importe où. Rendu
 * dans un portail, comme `Modal`, et pour la même raison : un ancêtre qui isole son contexte
 * d'empilement ne doit pas pouvoir le recouvrir.
 */
export function SearchOverlay({
  open,
  onClose,
  query,
  onQueryChange,
  onSubmit,
  sections = [],
  brand,
  placeholder = "Rechercher…",
  hint,
  emptyText = "Aucun résultat.",
  onTypeToOpen,
  closeLabel = "Fermer la recherche",
}: SearchOverlayProps) {
  const theme = useLqTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  // Ouvert : le champ prend le focus, Échap ferme.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Fermé : la frappe d'un caractère hors champ de saisie demande l'ouverture.
  useEffect(() => {
    if (open || !onTypeToOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || e.key === " ") return;
      if (isEditable(e.target)) return;
      e.preventDefault();
      onTypeToOpen(e.key);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onTypeToOpen]);

  if (!open) return null;

  const filled = sections.filter((s) => s.results.length > 0);

  return createPortal(
    <LqThemeProvider palette={theme.palette} surface={theme.surface} font={theme.font} style={{ display: "contents" }}>
      <div className="lq-search-overlay" role="dialog" aria-modal="true" aria-label={placeholder}>
        <div className="lq-search-overlay__bar">
          <div className="lq-search-overlay__brand">{brand}</div>
          <button type="button" className="lq-search-overlay__close" onClick={onClose} aria-label={closeLabel} title={closeLabel}>
            <CloseIcon size={22} />
          </button>
        </div>
        <div className="lq-search-overlay__body">
          <input
            ref={inputRef}
            className="lq-search-overlay__input"
            value={query}
            placeholder={placeholder}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmit?.(query);
            }}
            aria-label={placeholder}
            spellCheck={false}
            autoComplete="off"
          />
          {hint && <div className="lq-search-overlay__hint">{hint}</div>}
          {query.trim() !== "" && filled.length === 0 && <p className="lq-search-overlay__empty">{emptyText}</p>}
          {filled.map((section) => (
            <section key={section.id} className="lq-search-overlay__section">
              <h2 className="lq-search-overlay__section-title">{section.title}</h2>
              <ul className="lq-search-overlay__results">
                {section.results.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="lq-search-overlay__result" onClick={r.onSelect}>
                      <span
                        className="lq-search-overlay__avatar"
                        style={r.avatarColor ? { backgroundColor: r.avatarColor } : undefined}
                        aria-hidden="true"
                      >
                        {r.avatar ?? (typeof r.label === "string" ? r.label.charAt(0).toUpperCase() : null)}
                      </span>
                      <span className="lq-search-overlay__text">
                        <span className="lq-search-overlay__label">{r.label}</span>
                        {r.details && <span className="lq-search-overlay__details">{r.details}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </LqThemeProvider>,
    document.body,
  );
}
