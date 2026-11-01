import { Fragment, useCallback, useLayoutEffect, useRef, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import "./Toolbar.css";

export interface ToolbarProps {
  /** Nom de la barre pour un lecteur d'écran (« Mise en forme », « Actions du tableau »…). Obligatoire :
   *  une page porte souvent plusieurs barres, c'est ce qui les distingue. */
  ariaLabel: string;
  /** Contenu aligné à gauche (au début). Un **tableau** = des groupes, séparés par un filet vertical. */
  start?: ReactNode | ReactNode[];
  /** Contenu aligné à droite (à la fin), poussé contre le bord. Tableau = groupes, comme `start`. */
  end?: ReactNode | ReactNode[];
  /** Équivaut à `start` quand `start` n'est pas fourni — pour écrire `<Toolbar>…</Toolbar>`. */
  children?: ReactNode | ReactNode[];
  /** `"horizontal"` (défaut) ou `"vertical"` (une palette d'outils sur le flanc d'un éditeur). Change
   *  aussi les flèches qui naviguent : ←/→ ou ↑/↓. */
  orientation?: "horizontal" | "vertical";
  /** `"normal"` (défaut) ou `"compact"` : marges, écarts et boutons resserrés. */
  density?: "normal" | "compact";
  /** Sans cadre ni fond : la barre se fond dans l'en-tête d'une carte ou d'une page. */
  plain?: boolean;
  className?: string;
}

/** Ce qu'on peut atteindre au clavier dans la barre. `[tabindex]` couvre aussi les contrôles dont la
 *  barre a elle-même posé le tabindex : un bouton désactivé depuis est écarté par le filtre `:disabled`. */
const FOCUSABLE = [
  "button:not(:disabled)",
  "a[href]",
  "input:not(:disabled):not([type=hidden])",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[tabindex]",
].join(",");

/** Les champs de saisie gardent leurs flèches pour le curseur : la barre ne les leur prend pas. */
function keepsArrows(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !["button", "checkbox", "radio", "submit", "reset", "color", "range"].includes(el.type);
  return (el as HTMLElement).isContentEditable;
}

function renderGroups(content: ReactNode | ReactNode[] | undefined, vertical: boolean) {
  if (!Array.isArray(content)) return content;
  return content.map((group, i) => (
    <Fragment key={i}>
      {i > 0 && <span className="lq-toolbar__separator" role="separator" aria-orientation={vertical ? "horizontal" : "vertical"} />}
      <div className="lq-toolbar__group">{group}</div>
    </Fragment>
  ));
}

/**
 * Barre d'outils `role="toolbar"` : un seul arrêt de tabulation pour toute la barre, puis les
 * flèches d'un contrôle au suivant (tabindex itinérant), Origine / Fin pour les extrémités. Le
 * contrôle quitté en dernier est celui sur lequel on revient en retabulant.
 *
 * Le contenu est libre — `Button`, `IconButton`, `ButtonGroup`, un champ de recherche, un menu — et
 * se range en deux zones, `start` à gauche et `end` à droite ; un tableau de nœuds dans l'une ou
 * l'autre en fait des groupes séparés par un filet.
 */
export function Toolbar({ ariaLabel, start, end, children, orientation = "horizontal", density = "normal", plain, className }: ToolbarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useRef<HTMLElement | null>(null);
  const vertical = orientation === "vertical";

  const items = useCallback(
    () => Array.from(ref.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((el) => !el.matches(":disabled") && !el.closest("[aria-hidden='true']")),
    [],
  );

  /** Un seul contrôle à tabindex 0 — l'actif, ou le premier — tous les autres à -1. */
  const sync = useCallback(() => {
    const list = items();
    if (!active.current || !list.includes(active.current)) active.current = list[0] ?? null;
    for (const el of list) el.tabIndex = el === active.current ? 0 : -1;
  }, [items]);

  // À chaque rendu : un contrôle ajouté, retiré ou désactivé redistribue les tabindex.
  useLayoutEffect(sync);

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (items().includes(target) && active.current !== target) {
      active.current = target;
      sync();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const prev = vertical ? "ArrowUp" : "ArrowLeft";
    const next = vertical ? "ArrowDown" : "ArrowRight";
    if (![prev, next, "Home", "End"].includes(e.key)) return;
    const target = e.target as HTMLElement;
    if (keepsArrows(target)) return;
    const list = items();
    const index = list.indexOf(target);
    if (index === -1 || list.length === 0) return;
    let to = index;
    if (e.key === prev) to = (index - 1 + list.length) % list.length;
    else if (e.key === next) to = (index + 1) % list.length;
    else if (e.key === "Home") to = 0;
    else to = list.length - 1;
    e.preventDefault();
    active.current = list[to];
    sync();
    list[to].focus();
  };

  const startContent = start ?? children;

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={ariaLabel}
      aria-orientation={orientation}
      className={[
        "lq-toolbar",
        `lq-toolbar--${orientation}`,
        density === "compact" && "lq-toolbar--compact",
        plain && "lq-toolbar--plain",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      <div className="lq-toolbar__zone lq-toolbar__zone--start">{renderGroups(startContent, vertical)}</div>
      {end != null && <div className="lq-toolbar__zone lq-toolbar__zone--end">{renderGroups(end, vertical)}</div>}
    </div>
  );
}
