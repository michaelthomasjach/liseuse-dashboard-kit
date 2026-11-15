/* Vérification de la recherche dans la documentation du scripting (« Demander à la documentation »).
 *
 *   node scripts/checkScriptDocsSearch.mjs                 vérifie les cas ci-dessous
 *   node scripts/checkScriptDocsSearch.mjs "ma question"   affiche le classement d'une question
 *
 * Le dépôt n'a pas de lanceur de tests (un *.test.ts casserait la construction) : comme
 * checkSankeyLayout.mjs, le TypeScript est assemblé à la volée par esbuild, puis on vérifie ce qui
 * doit rester vrai quand la documentation grandit — la bonne fonction en tête pour les questions
 * types, et rien d'inventé pour une fonction qui n'existe pas.
 */
import { build } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");

async function load(entry) {
  const outfile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "script-docs-check-")), "bundle.mjs");
  await build({
    entryPoints: [path.join(ROOT, entry)],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile,
    logLevel: "warning",
    loader: { ".css": "empty" },
    external: ["react", "react-dom", "d3"],
  });
  return import(pathToFileURL(outfile).href);
}

const search = await load("src/components/charts/candlestick/scripting/docsSearch/scriptDocsSearch.ts");
const answer = await load("src/components/charts/candlestick/scripting/docsSearch/scriptDocsAnswer.ts");

const questions = process.argv.slice(2);
if (questions.length > 0) {
  for (const q of questions) {
    const r = search.searchScriptDocs(q);
    console.log(`\n### ${q}`);
    for (const u of r.unknownNames) console.log(`  inconnu : ${u.name} → ${u.suggestions.join(", ")}`);
    for (const e of r.excerpts) console.log(`  ${String(e.score).padStart(6)}  ${e.kind.padEnd(8)} ${e.signature ?? e.title}  [${e.sectionTitle}]`);
  }
  process.exit(0);
}

const problems = [];
const check = (condition, message) => {
  if (!condition) problems.push(message);
};
const titles = (q, n = 3) => search.searchScriptDocs(q).excerpts.slice(0, n).map((e) => e.signature ?? e.title);

// Plusieurs unités de temps : resample et availableTimeframes en tête, quelle que soit la façon de demander.
for (const q of [
  "Est-ce qu'il est possible de requêter sur plusieurs timeframes ?",
  "Peut-on utiliser plusieurs unités de temps ?",
  "multi-timeframe",
  "Can I use multiple timeframes?",
]) {
  const top = titles(q, 2);
  check(top.includes("market.resample(interval)"), `« ${q} » : market.resample absent des deux premiers (${top.join(" | ")})`);
  check(top.includes("market.availableTimeframes()"), `« ${q} » : market.availableTimeframes absent des deux premiers (${top.join(" | ")})`);
}

// Un nom exact l'emporte sur tout.
check(titles("Comment marche ta.rsi ?", 1)[0]?.startsWith("ta.rsi"), "« ta.rsi » n'est pas en tête pour sa propre question");

// Une fonction qui n'existe pas : signalée comme telle, avec des voisins qui existent vraiment.
{
  const r = search.searchScriptDocs("Existe-t-il market.orderFlow() pour lire le flux d'ordres ?");
  check(r.unknownNames.length === 1 && r.unknownNames[0].name === "market.orderFlow", "market.orderFlow n'est pas signalé comme inconnu");
  const known = new Set(search.scriptDocsEntries().flatMap((e) => e.keywords));
  check((r.unknownNames[0]?.suggestions ?? []).every((s) => known.has(s) || s.includes(".")), "une suggestion pour market.orderFlow n'est pas un nom documenté");
  check(!r.excerpts.some((e) => (e.signature ?? "").includes("orderFlow")), "un passage « orderFlow » a été inventé");
}

// Une réponse d'IA qui cite une fonction absente des extraits : la fonction est écartée, le code inventé aussi.
{
  const r = search.searchScriptDocs("plusieurs unités de temps");
  const checked = answer.checkScriptDocsAnswer(
    {
      verdict: "existe",
      explanation: "Utilisez market.security(\"1d\") ou market.resample.",
      references: [r.excerpts[0].id, "lq-script-docs-heading-market-market-security"],
      example: 'const d = market.security("1d");',
    },
    r.excerpts,
  );
  check(checked.references.length === 1 && checked.references[0].id === r.excerpts[0].id, "une référence hors des extraits a été gardée");
  check(!checked.example?.includes("security"), "un exemple de code qui n'est pas dans la documentation a été gardé");
  check(checked.warnings.some((w) => w.includes("market.security")), "market.security, cité dans l'explication, n'est pas signalé");
}

// Réponse brute d'un modèle : JSON entouré de texte, références par numéro.
{
  const r = search.searchScriptDocs("plusieurs unités de temps");
  const parsed = answer.parseScriptDocsAnswer('Voici : {"verdict":"partiel","explication":"Oui, en agrégeant.","references":[1,2],"exemple":""}', r.excerpts);
  check(parsed.verdict === "partiel" && parsed.references.length === 2 && parsed.references[0] === r.excerpts[0].id, "réponse brute mal lue");
  check(answer.parseScriptDocsAnswer("pas du JSON", r.excerpts) === null, "une réponse illisible devrait donner null");
}

if (problems.length > 0) {
  console.error(`${problems.length} problème(s) :\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Recherche dans la documentation : ${search.scriptDocsEntries().length} passages indexés, tous les cas passent.`);
