import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { ChevronDownIcon, MaximizeIcon, MinimizeIcon } from "../icons";
import { Spinner } from "../feedback/Spinner";
import { toneAttribute, type SurfaceTone } from "./tone";
import "./Card.css";

export interface CardProps {
  title?: ReactNode;
  meta?: ReactNode;
  /** Always-visible teaser content shown above the body — most useful paired with `expandable`
   *  (a hint of what's collapsed underneath), but renders the same way without it too. */
  summary?: ReactNode;
  /** Optional footer, rendered below a divider at the card's own bottom edge. */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Removes the outer border/background/shadow so the card blends into a parent grid cell —
   *  same convention as `Panel`'s own `bare` prop. */
  bare?: boolean;
  /** Quiet KPI-tile look instead of the normal boxed card: no border/background/shadow, a thick
   *  rule along the top edge instead, `title` shrunk down to a small muted uppercase label (a
   *  "52-WEEK HIGH" rather than a section heading), and no side padding — `children` sits flush
   *  against the card's own edges, meant for a big value + short subtext + trailing sparkline.
   *  `Highlight` is just this option pre-set to `true`, kept as its own named export for
   *  convenience — see its own doc, same relationship `ExpandableCard` has to `expandable`. */
  highlight?: boolean;
  /** Makes the body collapsible behind a click-to-toggle header with a chevron indicator, instead
   *  of always visible — the header itself becomes the toggle target, so give it a `title` when
   *  this is on (an expandable card with no header has no way to expand). Uncontrolled by default
   *  (`defaultOpen`); pass `open`/`onOpenChange` to drive it from outside instead, same
   *  controlled/uncontrolled split every other toggle in this library follows. Default `false` — a
   *  plain always-visible card, the same shape `Panel` already covers, just with `Card`'s own
   *  slightly bolder header/spacing instead of `Panel`'s small-caps one. */
  expandable?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Remplit la carte d'une couleur du thème et passe tout son contenu en contraste — les tuiles
   * pleines d'un tableau de bord (ventes de la semaine en vert, météo en gris). Le contenu suit sans
   * rien savoir du ton : la carte redéfinit pour ses enfants les variables de texte, de bordure et
   * d'accent (voir `tone.css`), si bien qu'une sparkline ou une ligne de panneau posées dedans
   * passent elles aussi en contraste. Absent ou `"default"` : rien ne change.
   */
  tone?: SurfaceTone;
  /** Contrôles posés à droite de l'en-tête (un menu « … », un bouton). L'en-tête s'affiche dès
   *  qu'il y en a, même sans `title`. */
  controls?: ReactNode;
  /**
   * Ajoute à droite de l'en-tête le petit cercle « rafraîchir ». Si la fonction rend une promesse,
   * la carte se voile et le cercle tourne jusqu'à ce qu'elle soit tenue ou rompue ; sinon, c'est
   * `refreshing` qui pilote cet état.
   */
  onRefresh?: () => void | Promise<unknown>;
  /** État « en cours de rafraîchissement », contrôlé : voile sur la carte et cercle qui tourne. */
  refreshing?: boolean;
  /** Libellé du bouton de rafraîchissement. Défaut : « Rafraîchir ». */
  refreshLabel?: string;
  /**
   * Ajoute à droite de l'en-tête un bouton « plein écran » : la carte se détache de la page et la
   * couvre entière (position fixe, au-dessus de la barre latérale et de la barre haute), son corps
   * défilant à l'intérieur. Échap ou le même bouton la rendent à sa place. Pendant ce temps, la page
   * ne défile plus, le focus est gardé dans la carte (exposée en `role="dialog"`), et une réserve
   * invisible de sa hauteur tient sa place dans la grille pour que rien ne saute autour. Le focus
   * revient au bouton à la sortie.
   *
   * Non contrôlé par défaut ; `maximized` + `onMaximizedChange` pour le piloter du dehors.
   *
   * Limite : `position: fixed` se rapporte au premier ancêtre qui porte un `transform`, un `filter`
   * ou un `contain` — dans un tel conteneur, la carte ne couvre que lui.
   */
  maximizable?: boolean;
  /** Plein écran contrôlé. Le fournir suffit à afficher le bouton, même sans `maximizable`. */
  maximized?: boolean;
  onMaximizedChange?: (maximized: boolean) => void;
  /** Libellé du bouton pour entrer en plein écran. Défaut : « Plein écran ». */
  maximizeLabel?: string;
  /** Libellé du bouton pour en sortir. Défaut : « Quitter le plein écran ». */
  restoreLabel?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** The bordered card primitive — a plain always-visible card by default, a collapsible "show
 *  more" card when `expandable` is on (`ExpandableCard`'s own doc), or a quiet KPI-tile card when
 *  `highlight` is on (`Highlight`'s own doc). Distinct from `Panel`: same outer shell (border/
 *  radius/shadow), but a bolder, larger title and roomier header padding better suited to a single
 *  prominent card than `Panel`'s small-caps section-grouping style. */
export function Card({
  title,
  meta,
  summary,
  footer,
  children,
  className,
  bare,
  highlight = false,
  expandable = false,
  defaultOpen = false,
  open,
  onOpenChange,
  tone,
  controls,
  onRefresh,
  refreshing,
  refreshLabel = "Rafraîchir",
  maximizable = false,
  maximized,
  onMaximizedChange,
  maximizeLabel = "Plein écran",
  restoreLabel = "Quitter le plein écran",
}: CardProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const isOpen = expandable ? (open ?? internalOpen) : true;
  const hasHeading = Boolean(title || meta);
  const refreshable = onRefresh !== undefined || refreshing !== undefined;
  const canMaximize = maximizable || maximized !== undefined;
  const hasControls = Boolean(controls) || onRefresh !== undefined || canMaximize;
  const hasHeader = hasHeading || hasControls;
  const isRefreshing = refreshing ?? pendingRefresh;

  const [internalMaximized, setInternalMaximized] = useState(false);
  const isMaximized = canMaximize && (maximized ?? internalMaximized);
  const isControlledMaximized = maximized !== undefined;
  const sectionRef = useRef<HTMLElement>(null);
  const maximizeButtonRef = useRef<HTMLButtonElement>(null);
  // La hauteur de la carte à sa place, relevée tant qu'elle y est : c'est celle de la réserve qui la
  // remplace dans la grille pendant le plein écran. Relevée aussi au clic, juste avant de partir.
  const restingHeight = useRef<number | null>(null);
  // `onMaximizedChange` est souvent une flèche neuve à chaque rendu : lue par une référence, pour que
  // l'effet ci-dessous ne se défasse et ne se refasse pas à chaque rendu.
  const onMaximizedChangeRef = useRef(onMaximizedChange);
  onMaximizedChangeRef.current = onMaximizedChange;

  const [placeholderHeight, setPlaceholderHeight] = useState<number | null>(null);

  function setMaximized(next: boolean) {
    if (next && sectionRef.current) restingHeight.current = sectionRef.current.getBoundingClientRect().height;
    if (!isControlledMaximized) setInternalMaximized(next);
    onMaximizedChangeRef.current?.(next);
  }

  // Avant l'affichage : relevé de la hauteur tant que la carte est à sa place, report sur la réserve
  // dès qu'elle la quitte (un `maximized` contrôlé passe à `true` sans passer par le bouton).
  useLayoutEffect(() => {
    if (canMaximize && !isMaximized && sectionRef.current) restingHeight.current = sectionRef.current.getBoundingClientRect().height;
  });
  useLayoutEffect(() => {
    if (isMaximized) setPlaceholderHeight(restingHeight.current);
  }, [isMaximized]);

  useEffect(() => {
    if (!isMaximized) return;
    const section = sectionRef.current;
    // Le bouton est le même nœud dans les deux états : le garder d'ici vaut pour la sortie.
    const button = maximizeButtonRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Le focus entre dans la carte (sur elle-même, pour que le lecteur d'écran annonce le dialogue
    // par son titre), sauf s'il y est déjà — le bouton qu'on vient de presser, typiquement.
    if (section && !section.contains(document.activeElement)) section.focus({ preventScroll: true });

    // Échap au niveau de la fenêtre, mais seulement si l'événement vient de la carte ou de nulle part :
    // une modale ou un menu ouverts depuis la carte vivent dans un portail, hors de son DOM, et leur
    // propre Échap ne doit fermer qu'eux.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const target = e.target instanceof Node ? e.target : null;
      if (target && target !== document.body && !section?.contains(target)) return;
      e.preventDefault();
      if (!isControlledMaximized) setInternalMaximized(false);
      onMaximizedChangeRef.current?.(false);
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      // Retour à ce qui avait le focus avant (le bouton de la carte, ou celui qui l'a agrandie du
      // dehors), à défaut au bouton de la carte.
      const back = previouslyFocused && previouslyFocused !== document.body && previouslyFocused.isConnected ? previouslyFocused : button;
      if (back && back.isConnected) back.focus({ preventScroll: true });
    };
  }, [isMaximized, isControlledMaximized]);

  // Le focus reste dans la carte : Tab au dernier élément repart au premier, Maj+Tab l'inverse.
  function trapFocus(e: ReactKeyboardEvent<HTMLElement>) {
    const section = sectionRef.current;
    if (!isMaximized || e.key !== "Tab" || !section) return;
    const items = Array.from(section.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === section)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function toggle() {
    if (!expandable) return;
    const next = !isOpen;
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }

  // Une promesse rendue par `onRefresh` pilote le voile tant que `refreshing` n'est pas fourni. Son
  // échec n'est pas avalé : il remonte, comme si la carte n'avait rien attaché.
  function refresh() {
    if (isRefreshing) return;
    const result = onRefresh?.();
    if (refreshing !== undefined || !(result instanceof Promise)) return;
    setPendingRefresh(true);
    void result.finally(() => setPendingRefresh(false));
  }

  const heading = (
    <span className="lq-card__heading">
      {title && <span className="lq-card__title">{title}</span>}
      {meta && <span className="lq-card__meta">{meta}</span>}
    </span>
  );

  const chevron = <ChevronDownIcon size={18} className={["lq-card__chevron", isOpen && "lq-card__chevron--open"].filter(Boolean).join(" ")} />;

  const controlsEl = hasControls && (
    <span className="lq-card__controls">
      {controls}
      {onRefresh && (
        <button
          type="button"
          className="lq-card__refresh"
          onClick={refresh}
          // `aria-disabled` et non `disabled` : un bouton désactivé perd le focus, et l'utilisateur au
          // clavier qui vient de le presser se retrouverait renvoyé en haut de la page.
          aria-disabled={isRefreshing || undefined}
          aria-label={refreshLabel}
          title={refreshLabel}
        >
          <span className="lq-card__refresh-ring" aria-hidden="true" />
        </button>
      )}
      {canMaximize && (
        <button
          ref={maximizeButtonRef}
          type="button"
          className="lq-card__maximize"
          onClick={() => setMaximized(!isMaximized)}
          aria-pressed={isMaximized}
          aria-label={isMaximized ? restoreLabel : maximizeLabel}
          title={isMaximized ? restoreLabel : maximizeLabel}
        >
          {isMaximized ? <MinimizeIcon size={16} aria-hidden="true" /> : <MaximizeIcon size={16} aria-hidden="true" />}
        </button>
      )}
    </span>
  );

  let header: ReactNode = null;
  if (hasHeader) {
    if (!expandable) {
      header = (
        <div className={["lq-card__header", !hasHeading && "lq-card__header--controls-only"].filter(Boolean).join(" ")}>
          {heading}
          {controlsEl}
        </div>
      );
    } else if (!hasControls) {
      header = (
        <button type="button" className="lq-card__header lq-card__header--interactive" onClick={toggle} aria-expanded={isOpen}>
          {heading}
          {chevron}
        </button>
      );
    } else {
      // Un bouton ne peut pas en contenir d'autres : avec des contrôles, la bascule n'occupe que la
      // partie gauche de l'en-tête.
      header = (
        <div className="lq-card__header lq-card__header--split">
          <button type="button" className="lq-card__toggle" onClick={toggle} aria-expanded={isOpen}>
            {heading}
            {chevron}
          </button>
          {controlsEl}
        </div>
      );
    }
  }

  const card = (
    <section
      ref={sectionRef}
      className={[
        "lq-card",
        bare && "lq-card--bare",
        highlight && "lq-card--highlight",
        (refreshable || (hasControls && !hasHeading)) && "lq-card--anchored",
        isRefreshing && "lq-card--refreshing",
        isMaximized && "lq-card--maximized",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-lq-tone={toneAttribute(tone)}
      aria-busy={refreshable ? isRefreshing : undefined}
      role={isMaximized ? "dialog" : undefined}
      aria-modal={isMaximized || undefined}
      aria-label={isMaximized ? (typeof title === "string" ? title : maximizeLabel) : undefined}
      tabIndex={isMaximized ? -1 : undefined}
      onKeyDown={canMaximize ? trapFocus : undefined}
    >
      {header}

      {summary && <div className="lq-card__summary">{summary}</div>}

      {expandable ? (
        <div className={["lq-card__collapse", isOpen && "lq-card__collapse--open"].filter(Boolean).join(" ")}>
          <div className="lq-card__collapse-inner">
            <div className={["lq-card__body", (hasHeading || summary) && "lq-card__body--divided"].filter(Boolean).join(" ")}>{children}</div>
          </div>
        </div>
      ) : (
        children !== undefined && (
          <div className={["lq-card__body", (hasHeading || summary) && "lq-card__body--divided"].filter(Boolean).join(" ")}>{children}</div>
        )
      )}

      {footer && <footer className="lq-card__footer">{footer}</footer>}

      {isRefreshing && (
        <div className="lq-card__loading">
          <Spinner size={24} label={refreshLabel} />
        </div>
      )}
    </section>
  );

  if (!canMaximize) return card;
  // La réserve : invisible, de la hauteur de la carte et avec les classes de l'appelant (un
  // `grid-column` posé par lui y reste), elle garde la case pendant que la carte couvre l'écran.
  // Toujours au même rang dans le fragment, présente ou non : la carte garde sa place dans l'arbre
  // React, et son contenu son état, en entrant et en sortant du plein écran.
  return (
    <>
      {isMaximized && (
        <div
          className={["lq-card-placeholder", className].filter(Boolean).join(" ")}
          style={placeholderHeight !== null ? { height: placeholderHeight } : undefined}
          aria-hidden="true"
        />
      )}
      {card}
    </>
  );
}
