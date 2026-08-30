import { SCRIPT_API_REFERENCE } from "./scriptApiReference";

/** Same slugification as `scriptOutputToCustomIndicatorDef.ts`'s own local `slugify` — duplicated
 *  rather than imported (that one lives under `scripting/`'s worker-output-conversion concern,
 *  this one is a documentation-navigation concern; nothing about either should have to change
 *  because the other did). Applied to a heading's own display text to derive a stable DOM id. */
function slugifyHeading(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";
}

export function headingAnchorId(sectionId: string, headingText: string): string {
  return `lq-script-docs-heading-${sectionId}-${slugifyHeading(headingText)}`;
}

export interface DocsNavHeading {
  id: string;
  text: string;
}

export interface DocsNavSection {
  id: string;
  title: string;
  /** Which nav group this section renders under — see `ScriptReferenceSection.group`'s own doc. */
  group: string;
  headings: DocsNavHeading[];
}

/** The left nav's own tree — one entry per `SCRIPT_API_REFERENCE` section, each carrying its own
 *  `heading`-kind blocks as sub-items (exigence : « je veux des sous-titre »). Computed once at
 *  module load (the reference data is static, never changes at runtime) rather than recomputed on
 *  every render. */
export const SCRIPT_DOCS_NAV: DocsNavSection[] = SCRIPT_API_REFERENCE.map((section) => ({
  id: section.id,
  title: section.title,
  group: section.group,
  headings: section.blocks
    .filter((block) => block.kind === "heading" && block.text)
    .map((block) => ({ id: headingAnchorId(section.id, block.text ?? ""), text: block.text ?? "" })),
}));

/** Every `SCRIPT_API_COMPLETIONS` label (`scriptApiCompletions.ts`) that a specific heading names
 *  as its own primary explanation (`ScriptReferenceBlock.keywords` — see that field's own doc),
 *  mapped to that heading's anchor id. A keyword with no entry here (most of `market.*`'s own
 *  plain functions, `state.*`, `bar.*`, `math.*`, `ta.*` — sections short/focused enough that the
 *  section itself already *is* the explanation) falls back to `KEYWORD_NAMESPACE_SECTION` below
 *  instead, resolved by `keywordAnchorId`. Built once, at module load, by scanning every section's
 *  own blocks — a keyword genuinely reused across two headings would just have the *later* one win
 *  here, but nothing in this file enforces uniqueness (see `keywords`' own doc: "should" appear in
 *  at most one, not "does"). */
const KEYWORD_HEADING_ANCHOR = new Map<string, string>();
for (const section of SCRIPT_API_REFERENCE) {
  for (const block of section.blocks) {
    if (block.kind !== "heading" || !block.keywords || !block.text) continue;
    const anchor = headingAnchorId(section.id, block.text);
    for (const keyword of block.keywords) KEYWORD_HEADING_ANCHOR.set(keyword, anchor);
  }
}

/** Fallback when a keyword has no heading of its own — its own namespace's *section*. Covers every
 *  entry in `SCRIPT_API_COMPLETIONS` that isn't already in `KEYWORD_HEADING_ANCHOR` above (most of
 *  `market.*`/`state.*`/`bar.*`/`math.*`/`ta.*`'s own plain functions — sections short/focused
 *  enough that the section itself already *is* the explanation). A bare `.value`/`.line`/etc. (an
 *  indicator handle's own method) is never a fallback case: each has its own dedicated heading in
 *  `chart.*`, so it's always resolved by `KEYWORD_HEADING_ANCHOR` above instead. */
const KEYWORD_NAMESPACE_SECTION: Record<string, string> = {
  market: "market",
  chart: "chart",
  plot: "plot",
  state: "state",
  bar: "bar",
  math: "math",
  ta: "ta",
  console: "console",
  alert: "alert",
};

/** Where clicking a keyword in the documentation's own keyword index (`ScriptKeywordsIndex.tsx`)
 *  should scroll to — a specific heading when one claims that keyword (see
 *  `KEYWORD_HEADING_ANCHOR` above), otherwise that keyword's own section as a whole. The final
 *  `?? "keywords"` fallback is defensive only (scrolls to the index itself, a harmless no-op) —
 *  every real `SCRIPT_API_COMPLETIONS` label today resolves through one of the two lookups above
 *  it. */
export function keywordAnchorId(label: string): string {
  const specific = KEYWORD_HEADING_ANCHOR.get(label);
  if (specific) return specific;
  const namespace = label.split(".")[0];
  const sectionId = KEYWORD_NAMESPACE_SECTION[namespace] ?? "keywords";
  return `lq-script-docs-${sectionId}`;
}
