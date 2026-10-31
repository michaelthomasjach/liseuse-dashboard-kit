import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "../icons";
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
}

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
}: CardProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  const isOpen = expandable ? (open ?? internalOpen) : true;
  const hasHeading = Boolean(title || meta);
  const refreshable = onRefresh !== undefined || refreshing !== undefined;
  const hasControls = Boolean(controls) || onRefresh !== undefined;
  const hasHeader = hasHeading || hasControls;
  const isRefreshing = refreshing ?? pendingRefresh;

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

  return (
    <section
      className={[
        "lq-card",
        bare && "lq-card--bare",
        highlight && "lq-card--highlight",
        (refreshable || (hasControls && !hasHeading)) && "lq-card--anchored",
        isRefreshing && "lq-card--refreshing",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-lq-tone={toneAttribute(tone)}
      aria-busy={refreshable ? isRefreshing : undefined}
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
}
