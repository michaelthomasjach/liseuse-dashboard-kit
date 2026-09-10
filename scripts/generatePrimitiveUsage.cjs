#!/usr/bin/env node
/* Quelles primitives chaque story utilise — écrit dans src/storybookPrimitiveUsage.ts.
 *
 * Pourquoi c'est généré et non écrit à la main : il y a plus de deux cents stories, et une liste
 * tenue à la main serait fausse à la première refactorisation. Ici la source de vérité reste les
 * imports du code ; ce fichier n'en est qu'un reflet, régénéré à la demande.
 *
 *   node scripts/generatePrimitiveUsage.cjs
 *
 * On descend l'arbre des imports depuis le fichier de story, jusqu'à MAX_DEPTH. Un seul niveau ne
 * suffisait pas : une CandlestickChart n'importe plus aucune primitive directement, ce sont ses
 * sous-composants (les modales, le sélecteur d'indicateurs, l'éditeur) qui le font — la liste des
 * stories Charts revenait donc vide, c'est-à-dire fausse. La profondeur est bornée pour que la
 * liste reste une aide et non un inventaire de toute la bibliothèque.
 */
const MAX_DEPTH = 5;
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "src");
const PRIMITIVES_DIR = path.join(SRC, "components", "primitives");

/** Tous les composants exportés par primitives/, et — pour chacun — le module qui l'exporte.
 *
 *  Le module compte autant que le nom : plusieurs primitives n'ont pas de page à elles (Highlight,
 *  PanelRow, FieldGroup…), elles sont documentées sur la page du fichier qui les exporte. Lier vers
 *  une page inexistante donnait trois liens morts sur seize — vérifié contre l'index.json d'un
 *  Storybook en marche. */
function primitiveModules() {
  const byName = new Map();
  for (const file of fs.readdirSync(PRIMITIVES_DIR)) {
    if (!file.endsWith(".tsx") || file.endsWith(".stories.tsx")) continue;
    const source = fs.readFileSync(path.join(PRIMITIVES_DIR, file), "utf8");
    const moduleName = file.replace(/\.tsx$/, "");
    // Un fichier sans story n'a aucune page de documentation : ce qu'il exporte n'est pas
    // « liable », et sera écarté plus bas plutôt que produire un lien mort.
    const documented = fs.existsSync(path.join(PRIMITIVES_DIR, `${moduleName}.stories.tsx`));
    for (const m of source.matchAll(/^export function ([A-Z]\w*)/gm)) {
      byName.set(m[1], { moduleName, documented });
    }
  }
  return byName;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Les noms importés depuis un chemin contenant « primitives/ ». */
function importedPrimitives(source, known) {
  const found = new Set();
  for (const m of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g)) {
    if (!/primitives/.test(m[2])) continue;
    for (const raw of m[1].split(",")) {
      const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim();
      if (known.has(name)) found.add(name);
    }
  }
  return found;
}

/** Les fichiers du dépôt qu'un module importe en relatif — pour descendre d'un niveau. */
function localImports(file, source) {
  const out = [];
  for (const m of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    const base = path.resolve(path.dirname(file), m[1]);
    for (const candidate of [`${base}.tsx`, `${base}.ts`, path.join(base, "index.ts")]) {
      if (fs.existsSync(candidate)) {
        out.push(candidate);
        break;
      }
    }
  }
  return out;
}

const modules = primitiveModules();
const known = new Set(modules.keys());
const files = walk(SRC);
const stories = files.filter((f) => f.endsWith(".stories.tsx"));
const usage = {};

for (const storyFile of stories) {
  const source = fs.readFileSync(storyFile, "utf8");
  const title = /title:\s*["'`]([^"'`]+)["'`]/.exec(source)?.[1];
  if (!title) continue;
  // Une story de primitive ne se renvoie pas à elle-même.
  const found = new Set();
  const seen = new Set();
  const queue = [{ file: storyFile, text: source, depth: 0 }];
  while (queue.length > 0) {
    const { file, text, depth } = queue.shift();
    for (const name of importedPrimitives(text, known)) found.add(name);
    if (depth >= MAX_DEPTH) continue;
    for (const dep of localImports(file, text)) {
      if (seen.has(dep) || dep.endsWith(".stories.tsx")) continue;
      seen.add(dep);
      queue.push({ file: dep, text: fs.readFileSync(dep, "utf8"), depth: depth + 1 });
    }
  }
  const own = /^Primitives\//.test(title) ? title.split("/")[1] : null;
  const list = [...found].filter((n) => n !== own).sort();
  if (list.length > 0) usage[title] = list;
}

const HEADER = [
  "/* FICHIER GÉNÉRÉ — ne pas modifier à la main.",
  " * Régénérer avec `node scripts/generatePrimitiveUsage.cjs`.",
  " *",
  " * Quelles primitives chaque story utilise, pour que la barre de liens du décorateur global (voir",
  " * .storybook/PrimitiveLinks.tsx) renvoie vers leur documentation. Dérivé des imports du code,",
  " * jamais tenu à la main : " + stories.length + " fichiers de stories scannés, " + Object.keys(usage).length + " concernés.",
  " */",
].join("\n");

/* L'identifiant de la page « Docs » que Storybook dérive d'un titre : minuscules d'abord, puis
 * toute suite de caractères non alphanumériques devient un tiret. « Primitives/CodeBlock » donne
 * donc `primitives-codeblock`, PAS `primitives-code-block` — vérifié contre l'index.json d'un
 * Storybook en marche, où un identifiant inventé donnait un lien mort. */
const docsId = (name) => `primitives/${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "--docs";

const entries = Object.entries(usage)
  .map(([title, names]) => [
    title,
    names
      // La page visée est celle du MODULE qui exporte la primitive, pas un identifiant dérivé de
      // son nom : Highlight vit dans Card.tsx et se documente sur la page de Card.
      .map((name) => ({ name, module: modules.get(name) }))
      .filter((entry) => entry.module && entry.module.documented)
      .map(({ name, module }) => ({ name, docsId: docsId(module.moduleName) })),
  ])
  .filter(([, names]) => names.length > 0);

const out = [
  HEADER,
  "",
  "/** Une primitive dont une story dépend, et l'ancre de sa page de documentation. */",
  "export interface PrimitiveUsage {",
  "  name: string;",
  "  docsId: string;",
  "}",
  "",
  "export const PRIMITIVE_USAGE_BY_STORY: Record<string, PrimitiveUsage[]> = " + JSON.stringify(Object.fromEntries(entries), null, 2) + ";",
  "",
].join("\n");

fs.writeFileSync(path.join(SRC, "storybookPrimitiveUsage.ts"), out);
console.log(`${Object.keys(usage).length} stories référencées sur ${stories.length} fichiers scannés — src/storybookPrimitiveUsage.ts`);
