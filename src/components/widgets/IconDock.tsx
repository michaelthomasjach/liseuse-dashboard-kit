import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Tooltip } from "../primitives/Tooltip";
import "./IconDock.css";

/**
 * Le **dock d'icônes** — une petite barre d'outils flottante, à la manière des jeux de gestion et de
 * city-builders : une rangée de boutons carrés aux coins arrondis, posée sur un panneau translucide
 * par-dessus la scène, qui remplace un menu de texte là où la place manque.
 *
 * ## Une icône, un nom
 *
 * Chaque bouton n'affiche que son icône ; son nom (`label`) vit dans une infobulle — le `Tooltip` du
 * kit — au survol comme au focus clavier, placée sous le dock quand il est horizontal et à sa droite
 * quand il est vertical, pour ne jamais masquer les boutons voisins. Le même `label` est le nom
 * accessible du bouton : une icône seule ne dit rien à un lecteur d'écran.
 *
 * L'élément **actif** (la section ouverte, l'outil en main) est rempli à l'accent ; un élément
 * **désactivé** est estompé mais reste atteignable au clavier (`aria-disabled` plutôt que
 * `disabled`), comme le recommande le motif « toolbar » : on doit pouvoir découvrir qu'un outil
 * existe, et lire dans son infobulle pourquoi il n'est pas disponible.
 *
 * ## La pastille
 *
 * `badge` pose une petite pastille dans le coin supérieur droit du bouton :
 *
 * - `true` ou `""` : un simple **point** — « il y a du nouveau », sans compte ;
 * - un nombre ou un texte : une **pastille chiffrée** (`3`, `12`, `99+`) ;
 * - `undefined`, `null`, `false` ou `0` : rien. Zéro est traité comme « rien à signaler », parce
 *   qu'un compteur à 0 affiché en permanence n'apprend rien au joueur.
 *
 * Une pastille chiffrée est ajoutée au nom accessible (« Commandes (3) ») ; un point, non — il n'a
 * pas de contenu à annoncer, c'est à l'application de le dire autrement si c'est important.
 *
 * ## Clavier
 *
 * Le dock est un `role="toolbar"` à **tabindex itinérant** : il n'occupe qu'un seul arrêt de
 * tabulation (le bouton actif, à défaut le premier), et les flèches passent d'un bouton à l'autre —
 * gauche/droite quand il est horizontal, haut/bas quand il est vertical —, en bouclant d'un bout à
 * l'autre ; Début et Fin vont aux extrémités. Chaque bouton porte `aria-pressed` selon qu'il est
 * actif.
 *
 * ## Sur un téléphone
 *
 * Taille `md` : 44 px, au-dessus des 40 px qu'il faut à un doigt ; `sm` (36 px) remonte à 40 px sur
 * un pointeur grossier. Avec `compact` — et d'office sous 640 px de large pour un dock horizontal —,
 * le dock devient un **ruban qui défile** : pas de retour à la ligne, un défilement horizontal qui se
 * cale sur chaque bouton, sans barre visible. Huit boutons et plus tiennent alors sur la largeur d'un
 * téléphone. Les pastilles sont dessinées *dans* le bouton, pas à cheval sur son bord, pour ne pas
 * être rognées par ce défilement.
 */

export interface IconDockItem {
  id: string;
  icon: ReactNode;
  /** Nom du bouton : son infobulle et son nom accessible. */
  label: string;
  /** Pastille : `true`/`""` = un point, un nombre ou un texte = une pastille chiffrée, `0`/rien = aucune. */
  badge?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export interface IconDockProps {
  items: IconDockItem[];
  /** Défaut : `"horizontal"`. */
  orientation?: "horizontal" | "vertical";
  /** `sm` 36 px, `md` 44 px, `lg` 52 px. Défaut : `"md"`. */
  size?: "sm" | "md" | "lg";
  /** Ruban horizontal qui défile au lieu de s'étaler (automatique sous 640 px pour un dock horizontal). */
  compact?: boolean;
  className?: string;
  /** Nom de la barre d'outils. Défaut : « Barre d'outils ». */
  "aria-label"?: string;
}

type BadgeKind = "none" | "dot" | "count";

function badgeKind(badge: ReactNode): BadgeKind {
  if (badge === true || badge === "") return "dot";
  if (badge === undefined || badge === null || badge === false || badge === 0) return "none";
  return "count";
}

export function IconDock({ items, orientation = "horizontal", size = "md", compact, className, "aria-label": ariaLabel = "Barre d'outils" }: IconDockProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  refs.current.length = items.length;
  // L'arrêt de tabulation : le dernier bouton qui a eu le focus, à défaut le bouton actif, puis le premier.
  const [focusId, setFocusId] = useState<string | null>(null);
  const stopId = items.some((it) => it.id === focusId) ? focusId : (items.find((it) => it.active) ?? items[0])?.id;

  const vertical = orientation === "vertical";
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = items.length;
    if (n === 0) return;
    const current = refs.current.findIndex((el) => el === document.activeElement);
    if (current < 0) return;
    const prevKey = vertical ? "ArrowUp" : "ArrowLeft";
    const nextKey = vertical ? "ArrowDown" : "ArrowRight";
    let next: number | null = null;
    if (e.key === prevKey) next = (current - 1 + n) % n;
    else if (e.key === nextKey) next = (current + 1) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    if (next === null) return;
    e.preventDefault();
    setFocusId(items[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="toolbar"
      aria-orientation={orientation}
      aria-label={ariaLabel}
      className={["lq-icon-dock", `lq-icon-dock--${orientation}`, `lq-icon-dock--${size}`, compact && "lq-icon-dock--compact", className].filter(Boolean).join(" ")}
      onKeyDown={onKeyDown}
    >
      {items.map((item, i) => {
        const kind = badgeKind(item.badge);
        const name = kind === "count" && (typeof item.badge === "string" || typeof item.badge === "number") ? `${item.label} (${item.badge})` : item.label;
        return (
          <Tooltip key={item.id} content={item.label} placement={vertical ? "right" : "bottom"} anchorClassName="lq-icon-dock__slot">
            <button
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              className={["lq-icon-dock__button", item.active && "lq-icon-dock__button--active"].filter(Boolean).join(" ")}
              aria-label={name}
              aria-pressed={!!item.active}
              aria-disabled={item.disabled || undefined}
              tabIndex={item.id === stopId ? 0 : -1}
              onFocus={() => setFocusId(item.id)}
              onClick={() => {
                if (!item.disabled) item.onClick();
              }}
            >
              <span className="lq-icon-dock__icon" aria-hidden="true">
                {item.icon}
              </span>
              {kind !== "none" && (
                <span className={["lq-icon-dock__badge", kind === "dot" && "lq-icon-dock__badge--dot"].filter(Boolean).join(" ")} aria-hidden="true">
                  {kind === "count" ? item.badge : null}
                </span>
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
