import { SCRIPT_API_REFERENCE } from "./scriptApiReference";
import type { ScriptReferenceBlock, ScriptReferenceSection } from "./scriptApiReference";
import { SCRIPT_EXAMPLES } from "./scriptExamples";

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
 *  every render. "examples" is the one exception: its own `blocks` are deliberately empty (a
 *  whole-section override, see `scriptApiReference.ts`'s own doc on that entry) — its sub-items
 *  come from `SCRIPT_EXAMPLES` (`scriptExamples.ts`) instead, one per runnable script, using the
 *  exact same `headingAnchorId("examples", ...)` scheme `ScriptExampleRunner.tsx` stamps on each
 *  example's own container so a nav click still scrolls to the right place. */
export const SCRIPT_DOCS_NAV: DocsNavSection[] = SCRIPT_API_REFERENCE.map((section) => ({
  id: section.id,
  title: section.title,
  group: section.group,
  headings:
    section.id === "examples"
      ? SCRIPT_EXAMPLES.map((example) => ({ id: headingAnchorId("examples", example.title), text: example.title }))
      : section.blocks
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

/** All the searchable text one reference block carries — its prose, its list items, its code. A
 *  block's own `diagramKey` is deliberately excluded: it is an internal registry key, never
 *  anything the reader sees. */
function blockText(block: ScriptReferenceBlock): string {
  return [block.text, block.code, ...(block.items ?? [])].filter(Boolean).join("\n");
}

/** A section's own blocks, split into the groups its `heading` blocks delimit: the text before the
 *  first heading belongs to the section itself (key `null`), everything after a heading belongs to
 *  that heading until the next one. This is what lets a content match narrow down to the *heading*
 *  that actually discusses the term rather than just naming its whole section. */
function blocksByHeading(section: ScriptReferenceSection): { heading: string | null; text: string }[] {
  const groups: { heading: string | null; text: string }[] = [{ heading: null, text: "" }];
  for (const block of section.blocks) {
    if (block.kind === "heading" && block.text) {
      groups.push({ heading: block.text, text: block.text });
      continue;
    }
    groups[groups.length - 1].text += "\n" + blockText(block);
  }
  return groups;
}

/** Everything the "examples" section holds, keyed the same way — its own blocks are empty by
 *  design (a whole-section override, see SCRIPT_API_REFERENCE's own doc), so its searchable text
 *  is each runnable example's own title, description and code instead. */
function exampleGroups(): { heading: string | null; text: string }[] {
  return SCRIPT_EXAMPLES.map((example) => ({
    heading: example.title,
    text: [example.title, example.description, example.code].filter(Boolean).join("\n"),
  }));
}

/** The nav tree narrowed to whatever matches `query` — section titles, sub-heading titles, *and*
 *  the body text under each of them (prose, lists, code samples).
 *
 *  Searching only the titles is what made a term like `close` return nothing at all: no heading is
 *  named after it, it only ever appears inside `market.close(0)` in the prose and the examples —
 *  precisely where a reader looking it up expects it to be found. A section is kept when its own
 *  title matches, or when any of its headings match by title or by the text underneath them; a
 *  section kept for a title match keeps all its headings, one kept for a content match shows only
 *  the headings that actually matched, so the result stays a set of places to go rather than the
 *  whole tree again. */
export function searchDocsNav(query: string): DocsNavSection[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return SCRIPT_DOCS_NAV;

  const groupsBySectionId = new Map<string, { heading: string | null; text: string }[]>();
  for (const section of SCRIPT_API_REFERENCE) {
    groupsBySectionId.set(section.id, section.id === "examples" ? exampleGroups() : blocksByHeading(section));
  }

  const result: DocsNavSection[] = [];
  for (const section of SCRIPT_DOCS_NAV) {
    if (section.title.toLowerCase().includes(needle)) {
      result.push(section);
      continue;
    }
    const groups = groupsBySectionId.get(section.id) ?? [];
    // A match in the section's own lead-in text (before any heading) is about the section as a
    // whole — keep every heading, since none of them is more relevant than the others.
    const leadMatches = groups.some((group) => group.heading === null && group.text.toLowerCase().includes(needle));
    if (leadMatches) {
      result.push(section);
      continue;
    }
    const matchedHeadings = new Set(
      groups.filter((group) => group.heading !== null && group.text.toLowerCase().includes(needle)).map((group) => group.heading as string)
    );
    const headings = section.headings.filter((heading) => matchedHeadings.has(heading.text));
    if (headings.length > 0) result.push({ ...section, headings });
  }
  return result;
}
