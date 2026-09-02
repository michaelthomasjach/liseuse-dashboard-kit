import { parser } from "@lezer/javascript";
import { highlightTree, tagHighlighter, tags } from "@lezer/highlight";

export interface CodeToken {
  text: string;
  /** CSS class for this token, or `null` for text the grammar gives no tag to (whitespace,
   *  punctuation, an identifier that is nothing more specific). */
  className: string | null;
}

/** Maps Lezer tags onto this library's own code classes. Deliberately the *same* seven buckets the
 *  CodeMirror editor colours (see ScriptEditorCodeMirror's own highlightStyle), so a snippet in the
 *  documentation and the same snippet pasted into the editor look identical. */
const HIGHLIGHTER = tagHighlighter([
  { tag: tags.keyword, class: "lq-code--keyword" },
  { tag: [tags.string, tags.special(tags.string)], class: "lq-code--string" },
  { tag: tags.number, class: "lq-code--number" },
  { tag: [tags.bool, tags.null], class: "lq-code--number" },
  { tag: tags.comment, class: "lq-code--comment" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], class: "lq-code--function" },
  { tag: tags.propertyName, class: "lq-code--property" },
  { tag: tags.operator, class: "lq-code--operator" },
]);

/** Tokenises JavaScript into one array of tokens per line, ready to render as spans.
 *
 *  Split per line rather than as one flat stream because the surrounding component numbers and lays
 *  out lines individually; a token spanning a newline (a block comment, a template string) is cut at
 *  the boundary so each line stays self-contained.
 *
 *  Uses the Lezer grammar this library already ships for the script editor — no new dependency, and
 *  no second definition of what counts as a keyword. */
export function highlightJavaScript(code: string): CodeToken[][] {
  const lines = code.replace(/\n$/, "").split("\n");
  // Where each line starts in the flat string, so a tagged range can be mapped back onto lines.
  const lineStarts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineStarts.push(offset);
    offset += line.length + 1;
  }

  // Flat list of tagged ranges; the gaps between them are untagged text, filled in below.
  const ranges: { from: number; to: number; className: string }[] = [];
  try {
    highlightTree(parser.parse(code), HIGHLIGHTER, (from, to, className) => {
      if (to > from) ranges.push({ from, to, className });
    });
  } catch {
    // A grammar failure must never cost the reader the code itself — fall through to plain text.
    return lines.map((line) => [{ text: line, className: null }]);
  }

  return lines.map((line, index) => {
    const start = lineStarts[index];
    const end = start + line.length;
    const tokens: CodeToken[] = [];
    let cursor = start;
    for (const range of ranges) {
      if (range.to <= start || range.from >= end) continue;
      const from = Math.max(range.from, start);
      const to = Math.min(range.to, end);
      if (from > cursor) tokens.push({ text: code.slice(cursor, from), className: null });
      tokens.push({ text: code.slice(from, to), className: range.className });
      cursor = to;
    }
    if (cursor < end) tokens.push({ text: code.slice(cursor, end), className: null });
    return tokens.length > 0 ? tokens : [{ text: line, className: null }];
  });
}
