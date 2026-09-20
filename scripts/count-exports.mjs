/**
 * Counts what the library actually exports, by name.
 *
 * The landing page claims a number of exported components, so that number needs a source anyone can
 * re-derive. Counting `export` lines in the barrels would count types as components and would miss
 * whatever is re-exported through a second barrel; the built bundle is minified and its exported
 * names are single letters. The type checker knows the real answer, so it is asked.
 *
 * Usage: `node scripts/count-exports.mjs`
 */
import ts from "typescript";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const entry = resolve("src/index.ts");
const program = ts.createProgram([entry], {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
  noEmit: true,
  skipLibCheck: true,
});
const checker = program.getTypeChecker();
const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(entry));
const exported = checker.getExportsOfModule(moduleSymbol);

/**
 * Follows a re-export back to what it actually is.
 *
 * Everything in `src/index.ts` arrives through `export *` from a barrel, so every symbol here is an
 * alias. Reading the flags off the alias says "type" for all 484 of them, which is how a first run
 * of this script reported zero components in a library of a hundred.
 */
function resolve_(symbol) {
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

/** A symbol is a value when it has a value declaration — types and interfaces do not. */
function isValue(symbol) {
  const target = resolve_(symbol);
  return Boolean(target.flags & ts.SymbolFlags.Value) || Boolean(target.valueDeclaration);
}

/** Where the symbol is declared, so a component can be told from a re-exported constant. */
function fileOf(symbol) {
  const target = resolve_(symbol);
  const declaration = target.valueDeclaration ?? target.declarations?.[0];
  if (!declaration) return "";
  return declaration.getSourceFile().fileName.split("\\").join("/");
}

const values = exported.filter(isValue);
const types = exported.filter((symbol) => !isValue(symbol));

// A component is a PascalCase value declared in a .tsx file. The extension is what separates a
// component from an exported constant or helper, which live in .ts.
const components = values.filter(
  (symbol) => /^[A-Z][A-Za-z0-9]*$/.test(symbol.getName()) && fileOf(symbol).endsWith(".tsx")
);
const icons = components.filter((symbol) => /\/components\/icons\//.test(fileOf(symbol)));
const charts = components.filter((symbol) => /\/components\/(charts|globe|map)\//.test(fileOf(symbol)));
// "D3 charts" means the ones that actually draw with d3, not everything filed under charts: the
// globe is raw WebGL and the tile map is plain Canvas 2D, and counting them as d3 would be a claim
// about the dependency that is not true.
const d3Charts = charts.filter((symbol) => {
  const file = fileOf(symbol);
  try {
    return /from "d3"|from 'd3'|d3-/.test(readFileSync(file, "utf8"));
  } catch {
    return false;
  }
});

const name = (symbol) => symbol.getName();
console.log("exports totaux      :", exported.length);
console.log("  dont types        :", types.length);
console.log("  dont valeurs      :", values.length);
console.log("composants (.tsx)   :", components.length);
console.log("  dont icônes       :", icons.length);
console.log("  hors icônes       :", components.length - icons.length);
console.log("charts/globe/map    :", charts.length);
console.log("  dont tracés en d3 :", d3Charts.length);
console.log("\ncomposants :\n" + components.map(name).sort().join(", "));
console.log("\ncharts + globe :\n" + charts.map(name).sort().join(", "));
