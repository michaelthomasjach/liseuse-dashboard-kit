import { parser as javascriptParser } from "@lezer/javascript";
import type { SyntaxNode } from "@lezer/common";

/** The name a transformed `import` resolves through, and the object a transformed `export` writes
 *  to. Both are parameters of the compiled module function (see the worker's own module registry),
 *  never globals — a script cannot reach either by writing the name itself, because by the time
 *  anything compiles every `import`/`export` has already been rewritten into these. */
const REQUIRE = "__lqRequire";
const EXPORTS = "__lqExports";

export interface ScriptModuleDiagnostic {
  /** 1-based, in the module this came from. */
  line: number;
  message: string;
}

export interface TransformedModule {
  code: string;
  diagnostics: ScriptModuleDiagnostic[];
}

/** Every `import`/`export` form this rewriter understands, for the message a rejected one gets. */
const SUPPORTED =
  'import x from "…" · import { a, b as c } from "…" · import * as ns from "…" · export const/let/function/class · export default … · export { a, b as c }';

/** One statement's rewrite, as edits *relative to that statement's own start* rather than one
 *  replacement of the whole thing. That distinction matters: a declaration keeps its own body
 *  verbatim — untouched newlines, untouched `//` comments — and only its `export` keyword and its
 *  tail are edited. Replacing the whole node instead would have to flatten it onto one line to
 *  keep the file's line count, and a flattened `//` comment silently comments out everything after
 *  it on that line (a real bug this shape fixes: an exported class whose methods carried line
 *  comments lost every line following the first comment). */
type Edit = { from: number; to: number; text: string };
type Rewrite = { edits: Edit[] } | { message: string };

function lineOf(code: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (code[i] === "\n") line++;
  return line;
}

/** Same number of newlines as `original`, so every line after a rewritten statement keeps its own
 *  number — which is what lets a runtime error's reported line still point at the right source
 *  line (see the worker's own two-line wrapper offset). A statement that shrinks is padded with
 *  the newlines it lost; one that grows is joined onto a single line instead of spilling. Only for
 *  statements with nothing worth preserving inside them — an import clause, an export list — never
 *  for a declaration, whose body is kept verbatim by `keepBody` below instead. */
function replaceWhole(original: string, replacement: string): Edit[] {
  const originalLines = original.split("\n").length;
  const flat = replacement.replace(/\n/g, " ");
  return [{ from: 0, to: original.length, text: flat + "\n".repeat(originalLines - 1) }];
}

/** Blanks the leading `export` keyword — six spaces, not a deletion, so every offset, line and
 *  column after it in the declaration stays exactly where the author wrote it — and appends the
 *  registrations after the declaration's own last character. Nothing in between is touched. */
function keepBody(original: string, trailer: string): Edit[] {
  return [
    { from: 0, to: "export".length, text: " ".repeat("export".length) },
    { from: original.length, to: original.length, text: trailer },
  ];
}

/** Splits `{ a, b as c }` into its own pairs. Returns `null` for anything that isn't that shape. */
function parseNamedBindings(text: string): { imported: string; local: string }[] | null {
  const inner = text.slice(text.indexOf("{") + 1, text.lastIndexOf("}"));
  if (inner.trim() === "") return [];
  const parts = inner.split(",").map((p) => p.trim()).filter(Boolean);
  const out: { imported: string; local: string }[] = [];
  for (const part of parts) {
    const asMatch = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(part);
    if (asMatch) {
      out.push({ imported: asMatch[1], local: asMatch[2] });
      continue;
    }
    if (!/^[A-Za-z_$][\w$]*$/.test(part)) return null;
    out.push({ imported: part, local: part });
  }
  return out;
}

function rewriteImport(text: string): Rewrite {
  const fromMatch = /\bfrom\s*["']([^"']+)["']/.exec(text);
  // `import "./side-effect"` — no bindings at all. Still has to run the module.
  if (!fromMatch) {
    const bare = /^import\s*["']([^"']+)["']/.exec(text);
    if (bare) return { edits: replaceWhole(text, `${REQUIRE}(${JSON.stringify(bare[1])});`) };
    return { message: `Import non reconnu. Formes acceptées : ${SUPPORTED}` };
  }
  const source = JSON.stringify(fromMatch[1]);
  const clause = text.slice("import".length, fromMatch.index).trim();

  const namespace = /^\*\s+as\s+([A-Za-z_$][\w$]*)$/.exec(clause);
  if (namespace) return { edits: replaceWhole(text, `const ${namespace[1]} = ${REQUIRE}(${source});`) };

  if (clause.startsWith("{")) {
    const bindings = parseNamedBindings(clause);
    if (!bindings) return { message: `Import nommé non reconnu : « ${clause} ». Formes acceptées : ${SUPPORTED}` };
    const pairs = bindings.map((b) => (b.imported === b.local ? b.local : `${b.imported}: ${b.local}`)).join(", ");
    return { edits: replaceWhole(text, `const { ${pairs} } = ${REQUIRE}(${source});`) };
  }

  // `import Default, { a } from "…"` — the default plus named bindings in one statement.
  const mixed = /^([A-Za-z_$][\w$]*)\s*,\s*(\{[\s\S]*\})$/.exec(clause);
  if (mixed) {
    const bindings = parseNamedBindings(mixed[2]);
    if (!bindings) return { message: `Import nommé non reconnu : « ${mixed[2]} ». Formes acceptées : ${SUPPORTED}` };
    const pairs = bindings.map((b) => (b.imported === b.local ? b.local : `${b.imported}: ${b.local}`)).join(", ");
    return { edits: replaceWhole(text, `const { default: ${mixed[1]}${pairs ? `, ${pairs}` : ""} } = ${REQUIRE}(${source});`) };
  }

  if (/^[A-Za-z_$][\w$]*$/.test(clause)) return { edits: replaceWhole(text, `const { default: ${clause} } = ${REQUIRE}(${source});`) };
  return { message: `Import non reconnu : « ${clause} ». Formes acceptées : ${SUPPORTED}` };
}

function rewriteExport(text: string): Rewrite {
  const body = text.slice("export".length).trim();

  // `export * from "…"` — deliberately refused rather than half-implemented: re-exporting every
  // name of another module requires knowing what that module exports, which is only knowable after
  // running it, and the answer would silently shadow local names.
  if (body.startsWith("*")) {
    return { message: `« export * » n'est pas pris en charge. Ré-exportez les noms un par un : export { a, b } — ${SUPPORTED}` };
  }

  // `export default …` — the two keywords become an assignment, so whatever follows (an
  // expression, a function, a class, however many lines it spans) is kept exactly as written. The
  // appended `;` is what a bare `export default class Foo {}` would otherwise leave to ASI.
  const defaultKeyword = /^export\s+default\b/.exec(text);
  if (defaultKeyword) {
    return {
      edits: [
        { from: 0, to: defaultKeyword[0].length, text: `${EXPORTS}.default =` },
        { from: text.length, to: text.length, text: ";" },
      ],
    };
  }

  // `export { a, b as c }` — a list of names already declared above.
  if (body.startsWith("{")) {
    const bindings = parseNamedBindings(body);
    if (!bindings) return { message: `Export nommé non reconnu : « ${body} ». Formes acceptées : ${SUPPORTED}` };
    // Here `imported` is the local name and `local` the name it is exported under — the `as` reads
    // the other way round in an export than in an import.
    return { edits: replaceWhole(text, bindings.map((b) => `${EXPORTS}.${b.local} = ${b.imported};`).join(" ")) };
  }

  // `export const/let/var/function/class NAME …` — the declaration itself is never rewritten (so it
  // keeps hoisting, TDZ, its own line breaks and its own comments), only un-`export`ed, with a
  // registration appended after it.
  const decl = /^(const|let|var|function\*?|class|async\s+function\*?)\s+([A-Za-z_$][\w$]*)/.exec(body);
  if (decl) {
    // A single `const a = 1, b = 2` exports both, so every declared name is collected, not just
    // the first.
    const names =
      decl[1] === "const" || decl[1] === "let" || decl[1] === "var"
        ? Array.from(body.matchAll(/(?:^|[,;{]\s*|\b(?:const|let|var)\s+)([A-Za-z_$][\w$]*)\s*=/g)).map((m) => m[1])
        : [decl[2]];
    const unique = Array.from(new Set(names.length > 0 ? names : [decl[2]]));
    return { edits: keepBody(text, ` ${unique.map((n) => `${EXPORTS}.${n} = ${n};`).join(" ")}`) };
  }

  return { message: `Export non reconnu : « ${body} ». Formes acceptées : ${SUPPORTED}` };
}

/**
 * Rewrites a module's `import`/`export` statements into calls on the worker's own module registry,
 * so the result can be compiled by `new Function` exactly like a single-file script.
 *
 * Real ES modules are not an option here: the sandbox compiles a string with `new Function`, which
 * has no module record, no resolver and no `import` of its own — and moving to real modules would
 * mean a Blob URL per file, which is precisely the "code that appears nowhere in the script text"
 * route the sandbox lockdown exists to close.
 *
 * Only *top-level* declarations are touched. The syntax tree decides that (a nested `export` is a
 * syntax error anyway, and the word "import" inside a string or a comment must be left alone),
 * which is why this parses rather than pattern-matching the source.
 *
 * Every rewrite preserves its statement's own line count — see `replaceWhole`/`keepBody` — so a
 * runtime error still reports a line the author can find in the file they wrote.
 */
export function transformScriptModule(code: string): TransformedModule {
  const tree = javascriptParser.parse(code);
  const diagnostics: ScriptModuleDiagnostic[] = [];
  const edits: Edit[] = [];

  const cursor = tree.cursor();
  do {
    const node: SyntaxNode = cursor.node;
    if (node.name !== "ImportDeclaration" && node.name !== "ExportDeclaration") continue;
    // Top level only: `Script` is the tree's own root node.
    if (node.parent?.name !== "Script") continue;
    const text = code.slice(node.from, node.to);
    const result = node.name === "ImportDeclaration" ? rewriteImport(text) : rewriteExport(text);
    if ("message" in result) {
      diagnostics.push({ line: lineOf(code, node.from), message: result.message });
      continue;
    }
    // Statement-relative offsets become absolute here, so applying them below needs no further
    // knowledge of which statement each edit came from.
    for (const edit of result.edits) edits.push({ from: node.from + edit.from, to: node.from + edit.to, text: edit.text });
  } while (cursor.next());

  // Applied back to front so each edit's own offsets stay valid as earlier ones shift the string.
  let out = code;
  for (const edit of edits.sort((a, b) => b.from - a.from || b.to - a.to)) {
    out = out.slice(0, edit.from) + edit.text + out.slice(edit.to);
  }
  return { code: out, diagnostics };
}

/** Does this source use any module syntax at all? Lets the engine skip the whole transform — and
 *  the registry — for the single-file scripts that are still the common case. */
export function usesModuleSyntax(code: string): boolean {
  const tree = javascriptParser.parse(code);
  const cursor = tree.cursor();
  do {
    if ((cursor.name === "ImportDeclaration" || cursor.name === "ExportDeclaration") && cursor.node.parent?.name === "Script") return true;
  } while (cursor.next());
  return false;
}

export const SCRIPT_MODULE_REQUIRE = REQUIRE;
export const SCRIPT_MODULE_EXPORTS = EXPORTS;
