/** The shapes every reference section is built from, and the four helpers that build them.
 *
 *  Plain data, never JSX: `ScriptDocumentationModal.tsx` stays a thin renderer, and the same data
 *  is flattened into the AI's own briefing (`scripts/generateScriptingPrompt.cjs`). One file per
 *  namespace lives beside this one — see `index.ts` for the order they read in. */
export interface ScriptReferenceBlock {
  kind: "text" | "code" | "list" | "heading" | "diagram";
  text?: string;
  items?: string[];
  code?: string;
  /** Only for `kind: "diagram"` — a key into `SCRIPT_DIAGRAM_REGISTRY` (`scriptDiagramRegistry.ts`),
   *  resolved to a real component only at render time. Kept as a plain string here (not a JSX
   *  reference) so this stays plain data. */
  diagramKey?: string;
  /** Only for `kind: "heading"` — which `SCRIPT_API_COMPLETIONS` labels this heading is the primary
   *  explanation for, e.g. `["ta.hma"]`. Read by `scriptDocsNav.ts` so a click on that keyword in
   *  the index lands on this heading rather than merely on its parent section. Each keyword should
   *  appear in at most one heading's own list. */
  keywords?: string[];
}

export interface ScriptReferenceSection {
  id: string;
  title: string;
  /** Which nav group this section renders under — purely a left-nav grouping, no effect on reading
   *  order or content. */
  group: string;
  blocks: ScriptReferenceBlock[];
}

export function t(text: string): ScriptReferenceBlock {
  return { kind: "text", text };
}
export function c(code: string): ScriptReferenceBlock {
  return { kind: "code", code };
}
export function l(items: string[]): ScriptReferenceBlock {
  return { kind: "list", items };
}
export function d(diagramKey: string): ScriptReferenceBlock {
  return { kind: "diagram", diagramKey };
}
/** A sub-heading within a section — a real nav sub-item (see `scriptDocsNav.ts`) and, optionally,
 *  the keyword index's own scroll target for whichever `keywords` it names. One per documented
 *  function: that is what gives every tool a section of its own. */
export function h(text: string, keywords?: string[]): ScriptReferenceBlock {
  return { kind: "heading", text, keywords };
}

/** One documented function, rendered as its own sub-section.
 *
 *  The shape is deliberately fixed — heading, what it is for, signature, parameters, what comes
 *  back, and optionally an example and a caveat — because a reference is only useful if every entry
 *  answers the same questions in the same order. A reader looking for "what does this return"
 *  should never have to hunt for where that was written this time. */
export interface ScriptFunctionDoc {
  /** The call, as it is written: `ta.hma(values, period)`. Becomes the heading. */
  signature: string;
  /** Keywords this heading is the primary explanation for — usually `["ta.hma"]`. */
  keywords?: string[];
  /** One or two sentences: what it is for, and when you would reach for it rather than a
   *  neighbour. */
  purpose: string;
  /** One line per parameter: `"period — nombre de barres de la fenêtre."` Empty for a function
   *  that takes none. */
  params: string[];
  /** What comes back, including the null case, which is where most scripts go wrong. */
  returns: string;
  /** A short, runnable line or two. */
  example?: string;
  /** Anything that will bite: a warm-up length, an ordering requirement, a rounding. */
  caveat?: string;
}

/** Expands one documented function into the blocks that render it. */
export function fn(doc: ScriptFunctionDoc): ScriptReferenceBlock[] {
  const blocks: ScriptReferenceBlock[] = [h(doc.signature, doc.keywords), t(doc.purpose)];
  if (doc.params.length > 0) blocks.push(t("Paramètres :"), l(doc.params));
  blocks.push(t(`Renvoie : ${doc.returns}`));
  if (doc.example) blocks.push(c(doc.example));
  if (doc.caveat) blocks.push(t(doc.caveat));
  return blocks;
}

/** Every documented function of one namespace, in order. */
export function fns(docs: ScriptFunctionDoc[]): ScriptReferenceBlock[] {
  return docs.flatMap(fn);
}
