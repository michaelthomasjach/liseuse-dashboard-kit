import { useState, type ReactNode } from "react";
import { ChevronDownIcon } from "../icons";
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
}: CardProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = expandable ? (open ?? internalOpen) : true;
  const hasHeader = Boolean(title || meta);

  function toggle() {
    if (!expandable) return;
    const next = !isOpen;
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }

  const heading = (
    <span className="lq-card__heading">
      {title && <span className="lq-card__title">{title}</span>}
      {meta && <span className="lq-card__meta">{meta}</span>}
    </span>
  );

  return (
    <section className={["lq-card", bare && "lq-card--bare", highlight && "lq-card--highlight", className].filter(Boolean).join(" ")}>
      {hasHeader &&
        (expandable ? (
          <button type="button" className="lq-card__header lq-card__header--interactive" onClick={toggle} aria-expanded={isOpen}>
            {heading}
            <ChevronDownIcon size={18} className={["lq-card__chevron", isOpen && "lq-card__chevron--open"].filter(Boolean).join(" ")} />
          </button>
        ) : (
          <div className="lq-card__header">{heading}</div>
        ))}

      {summary && <div className="lq-card__summary">{summary}</div>}

      {expandable ? (
        <div className={["lq-card__collapse", isOpen && "lq-card__collapse--open"].filter(Boolean).join(" ")}>
          <div className="lq-card__collapse-inner">
            <div className={["lq-card__body", (hasHeader || summary) && "lq-card__body--divided"].filter(Boolean).join(" ")}>{children}</div>
          </div>
        </div>
      ) : (
        children !== undefined && (
          <div className={["lq-card__body", (hasHeader || summary) && "lq-card__body--divided"].filter(Boolean).join(" ")}>{children}</div>
        )
      )}

      {footer && <footer className="lq-card__footer">{footer}</footer>}
    </section>
  );
}
