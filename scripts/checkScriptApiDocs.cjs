#!/usr/bin/env node
/* Vérifie que la documentation du scripting et l'API réelle disent la même chose.
 *
 *   node scripts/checkScriptApiDocs.cjs
 *
 * Deux sens, et les deux comptent. Une fonction du moteur sans section documentée est une
 * fonctionnalité que personne ne trouvera. Une section qui documente une fonction inexistante est
 * pire : elle envoie l'auteur — ou le modèle, qui lit le même texte — écrire du code qui échouera.
 *
 * Sort en erreur sur un écart, pour qu'une API ajoutée sans sa documentation se voie tout de suite.
 */
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const SCRIPTING = path.join(ROOT, "src/components/charts/candlestick/scripting");

const probe = `
import { SCRIPT_API_REFERENCE } from ${JSON.stringify(path.join(SCRIPTING, "scriptApiReference"))};
import { mathApi } from ${JSON.stringify(path.join(SCRIPTING, "worker/mathLib"))};
import { taApi } from ${JSON.stringify(path.join(SCRIPTING, "worker/taLib"))};
import { buildReportApi } from ${JSON.stringify(path.join(SCRIPTING, "worker/buildReportApi"))};
import { buildStateApi } from ${JSON.stringify(path.join(SCRIPTING, "worker/buildStateApi"))};

// Ce que la documentation prétend couvrir : le nom lu dans un titre de fonction, plus les mots-clés
// que ce titre revendique (un titre groupé comme « math.min / math.max » les déclare tous les deux).
const couverts = new Set();
for (const section of SCRIPT_API_REFERENCE) {
  for (const b of section.blocks) {
    if (b.kind !== "heading" || !b.text) continue;
    for (const m of b.text.matchAll(/([a-zA-Z]+)\\.([a-zA-Z]+)\\s*\\(/g)) couverts.add(m[1] + "." + m[2]);
    for (const k of b.keywords ?? []) couverts.add(k);
  }
}

const familles = {
  math: Object.keys(mathApi),
  ta: Object.keys(taApi),
  report: Object.keys(buildReportApi().api),
  state: Object.keys(buildStateApi()),
};

const ecarts = [];
const reelles = new Set();
for (const [famille, noms] of Object.entries(familles)) {
  for (const nom of noms) {
    reelles.add(famille + "." + nom);
    if (!couverts.has(famille + "." + nom)) ecarts.push("non documentée : " + famille + "." + nom);
  }
}
for (const c of couverts) {
  if (/^(math|ta|report|state)\\./.test(c) && !reelles.has(c)) ecarts.push("documentée mais inexistante : " + c);
}

console.log(JSON.stringify({ couverts: couverts.size, reelles: reelles.size, ecarts }));
`;

const probeFile = path.join(ROOT, "node_modules", ".cache", "check-script-api-docs.ts");
fs.mkdirSync(path.dirname(probeFile), { recursive: true });
fs.writeFileSync(probeFile, probe);

let out;
try {
  out = execFileSync("npx", ["tsx", probeFile], { cwd: ROOT, encoding: "utf8" });
} finally {
  fs.rmSync(probeFile, { force: true });
}

const { couverts, reelles, ecarts } = JSON.parse(out.trim().split("\n").pop());
console.log(`${reelles} fonctions dans le moteur, ${couverts} entrées documentées.`);
if (ecarts.length === 0) {
  console.log("Aucun écart.");
  process.exit(0);
}
console.error(`\n${ecarts.length} écart(s) :`);
for (const e of ecarts) console.error("  - " + e);
process.exit(1);
