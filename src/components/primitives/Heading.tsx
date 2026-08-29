import type { ReactNode } from "react";
import "./Heading.css";

export interface HeadingProps {
  /** Which semantic heading tag to render (h1-h6). Default 2. */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
  className?: string;
  /** Secondary text at the row's trailing edge (e.g. "SETTLED · 29.08.2026") — rendered uppercase
   *  and muted. Setting this (or `divider` below) turns the heading into a full section-header row
   *  instead of a bare tag; leave both unset for the plain heading this component has always been. */
  meta?: ReactNode;
  /** Thick bottom divider under the row, for a section-header look. Works with or without `meta`. */
  divider?: boolean;
}

const TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

/** Semantic heading using the library's type scale (`--lq-text-h1`…`h6`) — optionally a full
 *  section-header row (title + trailing uppercase meta + thick divider) via `meta`/`divider`. */
export function Heading({ level = 2, children, className, meta, divider }: HeadingProps) {
  const Tag = TAGS[level - 1];
  const headingEl = <Tag className={["lq-heading", `lq-heading--h${level}`, className].filter(Boolean).join(" ")}>{children}</Tag>;
  if (!meta && !divider) return headingEl;
  return (
    <div className={["lq-heading-row", divider && "lq-heading-row--divider"].filter(Boolean).join(" ")}>
      {headingEl}
      {meta && <span className="lq-heading-row__meta">{meta}</span>}
    </div>
  );
}
