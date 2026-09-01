// The bare Lezer grammar, not `@codemirror/lang-javascript`'s own `javascriptLanguage.parser`.
// Both expose the identical parser, but the CodeMirror package drags @codemirror/language, /state
// and /view in with it — and this module is reached from the chart itself (ScriptRunner rewrites
// parameters on every run, the settings modal reads declarations), which would pull the whole
// editor into the main bundle and defeat ScriptEditorCodeMirror's own lazy import. Measured: the
// main chunk went 1270 kB -> 1708 kB via the CodeMirror import, and back down with this one.
import { parser as javascriptParser } from "@lezer/javascript";
import type { SyntaxNode } from "@lezer/common";
import { SCRIPT_PARAM_TYPES } from "../interfaces/ScriptParam.interface";
import type { ScriptParam, ScriptParamDiagnostic, ScriptParamType, ScriptParamValue } from "../interfaces/ScriptParam.interface";

/** The identifier a script calls to declare a customisable parameter. Not injected into the sandbox
 *  as a real constructor: `applyScriptParams` below rewrites every one of these out of the source
 *  before it is ever compiled, so `Variable` never exists at runtime and a script that somehow
 *  reaches this line unrewritten fails loudly (ReferenceError) rather than silently plotting
 *  defaults. */
const VARIABLE_CTOR = "Variable";

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isNumberLiteral(node: SyntaxNode, code: string): boolean {
  if (node.name === "Number") return true;
  // `-1.5` parses as UnaryExpression(ArithOp, Number) — a negative default is the obvious case this
  // would otherwise reject, so it's worth unwrapping rather than telling the user to write `0 - 1.5`.
  if (node.name !== "UnaryExpression") return false;
  const op = node.firstChild;
  const operand = op?.nextSibling;
  return op?.name === "ArithOp" && (code.slice(op.from, op.to) === "-" || code.slice(op.from, op.to) === "+") && operand?.name === "Number";
}

/** Evaluates a literal node's own source text. Every call site checks the node's own type first —
 *  an identifier, a call, a template string, an object is rejected *before* getting here — which is
 *  what makes this `new Function` safe: it only ever sees text the parser has already confirmed is
 *  a number, a string, or an array of those. */
function literalValue(node: SyntaxNode, code: string): unknown {
  try {
    return new Function(`return (${code.slice(node.from, node.to)})`)();
  } catch {
    return undefined;
  }
}

function typeLabel(type: ScriptParamType): string {
  return type === "color" ? 'une couleur ("#rrggbb")' : type === "number" ? "un nombre" : type === "string" ? "une chaîne" : `un tableau (${type})`;
}

/** Checks one default-value node against its declared type, returning the evaluated value or a
 *  message saying what was expected. This is the "je ne peux pas mettre une valeur numérique si
 *  j'ai mis un string" rule. */
function checkDefault(type: ScriptParamType, node: SyntaxNode, code: string): { value: ScriptParamValue } | { message: string } {
  const expected = `La valeur par défaut doit être ${typeLabel(type)}.`;

  if (type === "number") {
    if (!isNumberLiteral(node, code)) return { message: expected };
    const value = literalValue(node, code);
    return typeof value === "number" && Number.isFinite(value) ? { value } : { message: expected };
  }

  if (type === "string" || type === "color") {
    if (node.name !== "String") return { message: expected };
    const value = literalValue(node, code);
    if (typeof value !== "string") return { message: expected };
    if (type === "color" && !HEX_COLOR_RE.test(value)) {
      return { message: `La valeur par défaut doit être une couleur hexadécimale, par exemple "#3b82f6".` };
    }
    return { value };
  }

  // Array[string] / Array[number] — every element checked individually, so a single stray entry
  // reports as a type error rather than being coerced.
  if (node.name !== "ArrayExpression") return { message: expected };
  const wantNumbers = type === "Array[number]";
  const elements: SyntaxNode[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === "[" || child.name === "]" || child.name === ",") continue;
    elements.push(child);
  }
  const allOk = elements.every((el) => (wantNumbers ? isNumberLiteral(el, code) : el.name === "String"));
  if (!allOk) return { message: expected };
  const value = literalValue(node, code);
  return Array.isArray(value) ? { value: value as ScriptParamValue } : { message: expected };
}

/** Reads the optional third argument, `{ description: "…" }`. Deliberately an options object
 *  rather than a third positional string: it matches `plot.pane(name, { dock: "right" })`, the
 *  convention already used elsewhere in this API, and leaves room for further options without
 *  another positional slot. */
function readOptions(node: SyntaxNode, code: string): { description?: string } | { message: string } {
  if (node.name !== "ObjectExpression") return { message: 'Le troisième argument doit être un objet, par exemple { description: "…" }.' };

  let description: string | undefined;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name !== "Property") continue;
    const key = child.firstChild;
    if (!key) continue;
    const keyName = key.name === "PropertyDefinition" || key.name === "PropertyName" ? code.slice(key.from, key.to) : null;
    if (keyName !== "description") {
      return { message: `Option inconnue${keyName ? ` : ${keyName}` : ""}. Seule { description } est acceptée.` };
    }
    // The value is the last child of the property — `description: "…"` is key, ":", value.
    const value = child.lastChild;
    if (!value || value.name !== "String") return { message: "La description doit être une chaîne de caractères." };
    const text = literalValue(value, code);
    if (typeof text !== "string") return { message: "La description doit être une chaîne de caractères." };
    description = text;
  }
  return { description };
}

/** Every `VariableDefinition` in the tree, so a name that is merely *shadowed* later (a function
 *  parameter, a nested `const` of the same name) is not mistaken for a reassignment of the
 *  parameter itself. */
function collectShadowedNames(tree: ReturnType<typeof javascriptParser.parse>, code: string, paramNames: Set<string>): Set<string> {
  // Counted, not merely collected: the declaration that *created* the parameter is itself a
  // VariableDefinition, so its own presence must not make the name look shadowed — only a *second*
  // binding of the same name (a function parameter, a nested const) does.
  const bindings = new Map<string, number>();
  const cursor = tree.cursor();
  do {
    if (cursor.name !== "VariableDefinition") continue;
    const name = code.slice(cursor.from, cursor.to);
    if (!paramNames.has(name)) continue;
    bindings.set(name, (bindings.get(name) ?? 0) + 1);
  } while (cursor.next());
  return new Set([...bindings].filter(([, count]) => count > 1).map(([name]) => name));
}

/** Parses a script and reports every `new Variable(type, default)` declaration in it, along with
 *  everything wrong with them. Purely static: nothing is executed, so this is safe to run on every
 *  keystroke in the editor, and it works on a script that would not even compile.
 *
 *  The rules it enforces, all of them the user-facing contract for `Variable`:
 *  - the declaration must be `const`, never `let`/`var`, and never a bare `new Variable(...)`
 *    expression that isn't assigned to anything;
 *  - the type must be one of SCRIPT_PARAM_TYPES;
 *  - the default value must actually match that type;
 *  - the optional third argument is `{ description }` and nothing else;
 *  - a declared name may not be reassigned anywhere later in the script.
 *
 *  Both a linter (`diagnostics`) and the source of the settings form (`params`) — one parse feeding
 *  both, so the fields the user edits can never drift from what the editor says is valid. */
export function analyzeScriptVariables(code: string): { params: ScriptParam[]; diagnostics: ScriptParamDiagnostic[] } {
  const params: ScriptParam[] = [];
  const diagnostics: ScriptParamDiagnostic[] = [];
  const tree = javascriptParser.parse(code);

  // Pass 1 — every `new Variable(...)`, valid or not, with the declaration it belongs to.
  const declaredAt = new Map<string, number>();
  const cursor = tree.cursor();
  do {
    if (cursor.name !== "NewExpression") continue;
    const node = cursor.node;
    const callee = node.getChild("VariableName");
    if (!callee || code.slice(callee.from, callee.to) !== VARIABLE_CTOR) continue;

    // Where does this call sit? Only `const NAME = new Variable(...)` is legal.
    const parent = node.parent;
    const isDeclarationInit = parent?.name === "VariableDeclaration";
    if (!isDeclarationInit) {
      diagnostics.push({ from: node.from, to: node.to, message: "Variable doit être affecté à une constante : const NOM = new Variable(type, valeur)." });
      continue;
    }

    const keyword = parent.firstChild;
    const keywordText = keyword ? code.slice(keyword.from, keyword.to) : "";
    if (keywordText !== "const") {
      diagnostics.push({
        from: keyword ? keyword.from : parent.from,
        to: keyword ? keyword.to : parent.to,
        message: `Un paramètre doit être déclaré avec const, pas ${keywordText || "let"}.`,
      });
    }

    // The name this initializer belongs to: the nearest VariableDefinition before it, so a
    // multi-declarator `const A = ..., B = new Variable(...)` still pairs up correctly.
    let name: string | null = null;
    for (let child = parent.firstChild; child && child.from < node.from; child = child.nextSibling) {
      if (child.name === "VariableDefinition") name = code.slice(child.from, child.to);
    }
    if (name === null) continue;

    const argList = node.getChild("ArgList");
    const args: SyntaxNode[] = [];
    for (let child = argList?.firstChild ?? null; child; child = child.nextSibling) {
      if (child.name === "(" || child.name === ")" || child.name === ",") continue;
      args.push(child);
    }

    if (args.length < 2 || args.length > 3) {
      diagnostics.push({
        from: node.from,
        to: node.to,
        message: "new Variable attend le type, la valeur par défaut, puis éventuellement { description }.",
      });
      continue;
    }

    const [typeNode, defaultNode, optionsNode] = args;
    if (typeNode.name !== "String") {
      diagnostics.push({ from: typeNode.from, to: typeNode.to, message: `Le type doit être une chaîne parmi : ${SCRIPT_PARAM_TYPES.join(", ")}.` });
      continue;
    }
    const typeValue = literalValue(typeNode, code);
    if (typeof typeValue !== "string" || !(SCRIPT_PARAM_TYPES as readonly string[]).includes(typeValue)) {
      diagnostics.push({ from: typeNode.from, to: typeNode.to, message: `Type inconnu. Types acceptés : ${SCRIPT_PARAM_TYPES.join(", ")}.` });
      continue;
    }
    const type = typeValue as ScriptParamType;

    const checked = checkDefault(type, defaultNode, code);
    if ("message" in checked) {
      diagnostics.push({ from: defaultNode.from, to: defaultNode.to, message: checked.message });
      continue;
    }

    // Third argument — the options object. Only `description` is understood; an unknown key is
    // reported rather than ignored, so a typo ("descrition") surfaces instead of silently doing
    // nothing.
    let description: string | undefined;
    if (optionsNode) {
      const options = readOptions(optionsNode, code);
      if ("message" in options) {
        diagnostics.push({ from: optionsNode.from, to: optionsNode.to, message: options.message });
        continue;
      }
      description = options.description;
    }

    const previous = declaredAt.get(name);
    if (previous !== undefined) {
      diagnostics.push({ from: node.from, to: node.to, message: `Le paramètre ${name} est déjà déclaré plus haut.` });
      continue;
    }
    declaredAt.set(name, node.from);
    params.push({ name, type, defaultValue: checked.value, description, from: node.from, to: node.to });
  } while (cursor.next());

  // Pass 2 — reassignment of a declared parameter, anywhere later in the script.
  const paramNames = new Set(params.map((p) => p.name));
  if (paramNames.size > 0) {
    const shadowed = collectShadowedNames(tree, code, paramNames);
    const reassignCursor = tree.cursor();
    do {
      const node = reassignCursor.node;
      let target: SyntaxNode | null = null;
      if (node.name === "AssignmentExpression") {
        target = node.firstChild;
      } else if (node.name === "PostfixExpression") {
        // `A++` / `A--`
        target = node.getChild("VariableName");
      } else if (node.name === "UnaryExpression") {
        // `++A` / `--A`. The same node type also covers `-1.5`, `!x`, `typeof x` — all of which
        // merely *read* their operand — so the operator itself is what distinguishes them.
        const op = node.firstChild;
        const opText = op ? code.slice(op.from, op.to) : "";
        if (op?.name === "ArithOp" && (opText === "++" || opText === "--")) target = op.nextSibling;
      } else if (node.name === "ForOfSpec" || node.name === "ForInSpec") {
        // `for (A of xs)` with no declaration keyword rebinds A on every iteration. The loop
        // target is the spec's own first VariableName; the second is what's being iterated.
        const first = node.getChild("VariableName");
        if (first) target = first;
      }
      if (!target || target.name !== "VariableName") continue;

      const name = code.slice(target.from, target.to);
      if (!paramNames.has(name)) continue;
      // A name that is re-declared somewhere (function parameter, nested const) may legitimately be
      // assigned to in that inner scope — this analysis is not scope-aware, so it stays quiet rather
      // than reporting a reassignment that isn't one.
      if (shadowed.has(name)) continue;
      // An assignment *before* the declaration is somebody else's problem (a plain ReferenceError),
      // not a reassignment of the parameter.
      if (target.from < (declaredAt.get(name) ?? 0)) continue;
      diagnostics.push({ from: target.from, to: node.to, message: `${name} est un paramètre : sa valeur se change dans les réglages, pas dans le code.` });
    } while (reassignCursor.next());
  }

  diagnostics.sort((a, b) => a.from - b.from);
  return { params, diagnostics };
}

/** Resolves each parameter to its effective value — whatever the settings hold for it, falling back
 *  to the declaration's own default — and rewrites the source so the script sees a plain literal
 *  where `new Variable(...)` was. Substitution rather than an injected `Variable` object because
 *  scripts use these identifiers as bare values (`(atr ?? 1) * ATR_MULT`, `barIndex % RECALC_EVERY`);
 *  handing back a wrapper would mean writing `.value` at every use site, and would not work at all
 *  for the array types.
 *
 *  Line numbers are preserved exactly: whatever newlines the original `new Variable(...)` spanned
 *  are re-emitted after the literal, so a runtime error's own reported line still points at the
 *  right line of the user's script (see runScript's own offset doc). Columns on those specific
 *  lines can shift, which is why the padding goes after the value rather than before it. */
export function applyScriptParams(code: string, params: ScriptParam[], values: Record<string, ScriptParamValue> | undefined): string {
  if (params.length === 0) return code;
  let out = code;
  // Back to front, so each replacement's own offsets are still valid when it is applied.
  for (const param of [...params].sort((a, b) => b.from - a.from)) {
    const raw = values?.[param.name];
    const value = raw === undefined ? param.defaultValue : raw;
    const spannedLines = code.slice(param.from, param.to).split("\n").length - 1;
    out = out.slice(0, param.from) + JSON.stringify(value) + "\n".repeat(spannedLines) + out.slice(param.to);
  }
  return out;
}
