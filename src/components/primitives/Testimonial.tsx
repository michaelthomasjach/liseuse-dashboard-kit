import type { ReactNode } from "react";
import { StarIcon } from "../icons";
import "./Testimonial.css";

/** How the quote itself is presented.
 *
 *  - `"card"` — the boxed testimonial: panel, border, oversized opening mark, attribution ruled off
 *    underneath. The original (and, until the other two arrived, only) shape of this component, so
 *    it stays the default.
 *  - `"italic"` — no box at all: the line set in italic between typographic quotes, for a pull
 *    quote dropped inside running text.
 *  - `"callout"` — no box either, but a tinted band with a vertical rule down its left edge, for a
 *    quote that has to hold its own against the copy around it. */
export type TestimonialVariant = "card" | "italic" | "callout";

export interface TestimonialProps {
  quote: ReactNode;
  /** Words to pick out inside the quote. Only applies when `quote` is a plain string — there is no
   *  safe way to rewrite the text inside arbitrary nodes, so a `ReactNode` quote highlights its own
   *  words with `<QuoteMark>` instead. Matching is case-insensitive and keeps the original casing;
   *  a multi-word entry is matched as a whole phrase. */
  highlight?: string | string[];
  /** Optional from the moment a quote stopped always being a testimonial: the italic and callout
   *  variants are routinely used for an unattributed pull quote. Omit it and no attribution row
   *  (avatar, name, rule) is rendered at all. */
  name?: string;
  role?: string;
  avatarSrc?: string;
  /** 0-5, renders a row of filled/empty stars above the attribution. */
  rating?: number;
  /** Default "card". */
  variant?: TestimonialVariant;
  className?: string;
}

/** Picks a word out of a quote — the inline half of `highlight`, for when the quote is built from
 *  nodes rather than a plain string and this component cannot do the matching itself. */
export function QuoteMark({ children }: { children: ReactNode }) {
  return <mark className="lq-testimonial__mark-word">{children}</mark>;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const ESCAPE = /[.*+?^${}()|[\]\\]/g;

/** Splits `text` on every occurrence of `terms` and wraps the hits. Longest term first, so that
 *  "taux de change" wins over "taux" when both are listed and would otherwise leave the longer
 *  phrase half-marked. */
function markTerms(text: string, terms: string[]): ReactNode {
  const wanted = terms.map((t) => t.trim()).filter(Boolean);
  if (wanted.length === 0) return text;
  const pattern = wanted
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(ESCAPE, "\\$&"))
    .join("|");
  const parts = text.split(new RegExp(`(${pattern})`, "gi"));
  // split() with one capturing group alternates literal, captured, literal… so the odd indices are
  // exactly the matches — no second pass needed to work out which is which.
  return parts.map((part, i) => (i % 2 === 1 ? <QuoteMark key={i}>{part}</QuoteMark> : part));
}

/** A quote, in one of three presentations (see `TestimonialVariant`): the boxed testimonial card
 *  with avatar and star rating, a bare italic pull quote, or a tinted callout with a rule down its
 *  left edge. Attribution is optional in all three, and `highlight` picks individual words out of
 *  the line. */
export function Testimonial({ quote, highlight, name, role, avatarSrc, rating, variant = "card", className }: TestimonialProps) {
  const terms = highlight === undefined ? [] : Array.isArray(highlight) ? highlight : [highlight];
  const body = terms.length > 0 && typeof quote === "string" ? markTerms(quote, terms) : quote;

  return (
    <figure className={["lq-testimonial", `lq-testimonial--${variant}`, className].filter(Boolean).join(" ")}>
      {variant === "card" && (
        <span className="lq-testimonial__mark" aria-hidden="true">
          “
        </span>
      )}
      <blockquote className="lq-testimonial__quote">{body}</blockquote>

      {rating !== undefined && (
        <div className="lq-testimonial__rating" aria-label={`${rating} sur 5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <StarIcon key={i} size={15} fill={i < rating ? "currentColor" : "none"} className={i < rating ? "lq-testimonial__star lq-testimonial__star--filled" : "lq-testimonial__star"} />
          ))}
        </div>
      )}

      {name !== undefined && (
        <figcaption className="lq-testimonial__attribution">
          <span className="lq-testimonial__avatar">
            {avatarSrc ? <img src={avatarSrc} alt="" /> : <span>{initials(name)}</span>}
          </span>
          <span className="lq-testimonial__identity">
            <span className="lq-testimonial__name">{name}</span>
            {role && <span className="lq-testimonial__role">{role}</span>}
          </span>
        </figcaption>
      )}
    </figure>
  );
}
