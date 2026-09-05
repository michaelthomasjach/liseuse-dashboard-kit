/** `@block` — the cell delimiter (see `ScriptEditorPanel`'s own "Exécuter la cellule" button and
 *  the Jupyter-style notebook mode it drives). A line starting with it opens a new cell; whatever
 *  follows on that line is its title, free text, ignored by everything but the reader.
 *
 *  It replaces the `// %%` comment this used to be. That marker had one real advantage — being a
 *  comment, it was already valid JavaScript and needed no handling before compiling — and one real
 *  cost: it read as a piece of tooling trivia borrowed from Python editors rather than as part of
 *  this engine's own small vocabulary. `@block` sits beside `@description` instead: same shape,
 *  same "read from the source text before anything runs, then removed" contract, one idea to learn
 *  rather than two unrelated ones.
 *
 *  Being a real keyword rather than a comment, it is *not* valid JavaScript, so it has to be
 *  stripped before compiling exactly as `@description` and `new Variable(...)` already are — see
 *  `stripScriptBlocks` and its caller in `ScriptRunner.tsx`. */
const BLOCK_KEYWORD_RE = /^[ \t]*@block\b.*$/;

/** The `// %%` this replaces, still recognised so a script written before `@block` existed keeps
 *  the cells it was written with instead of silently collapsing into one. Deliberately not
 *  documented anywhere a user would read: it exists for scripts already saved, not as a second way
 *  to write new ones. */
const LEGACY_BLOCK_MARKER_RE = /^[ \t]*\/\/[ \t]*%%.*$/;

/** Whether `line` opens a new cell. Shared by the editor (which draws cell borders and decides
 *  what Shift+Enter runs) and the strip below, so the two can never disagree about where a cell
 *  begins — the failure that would cause is subtle and silent: code running under a different cell
 *  than the one highlighted around it. */
export function isBlockMarkerLine(line: string): boolean {
  return BLOCK_KEYWORD_RE.test(line) || LEGACY_BLOCK_MARKER_RE.test(line);
}

/** Removes every `@block` line so the remaining source is valid JavaScript again. Each is replaced
 *  by an empty line rather than deleted, so every line after it keeps its number — the same reason
 *  `stripScriptDescription` pads with newlines instead of collapsing (a runtime error's reported
 *  line has to still point at the line the user is looking at). The legacy `// %%` form is left
 *  alone: it is a comment, and already compiles. */
export function stripScriptBlocks(code: string): string {
  return code
    .split("\n")
    .map((line) => (BLOCK_KEYWORD_RE.test(line) ? "" : line))
    .join("\n");
}
