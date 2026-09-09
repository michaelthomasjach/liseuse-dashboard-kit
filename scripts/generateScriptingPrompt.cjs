/* Renders this engine's scripting documentation into one plain-text briefing an LLM can be given
 * as context (see `CandlestickChartProps.ai` and `ScriptAssistantPanel`).
 *
 * Why generated and not written: the three sources below are already this feature's own source of
 * truth — `scriptApiReference.ts` is what the documentation modal renders, `scriptApiCompletions.ts`
 * is what the editor autocompletes from, `scriptExamples.ts` is what the examples run. A briefing
 * typed out by hand beside them would be a fourth copy, and the first API change would make it lie
 * — with the particular nastiness that a *model* reading a stale reference writes confident,
 * plausible, broken scripts rather than failing loudly.
 *
 * The output is deliberately plain text, not JSON: it is going into a prompt, and every brace and
 * quote spent on structure is a token not spent on content.
 *
 *   node scripts/generateScriptingPrompt.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "src/components/charts/candlestick/scripting/scriptingPrompt.ts");
const SCRIPTING = path.join(ROOT, "src/components/charts/candlestick/scripting");

/** The three sources are TypeScript modules holding plain data, so they are read by running them
 *  through `tsx` rather than by parsing them — the data is already exactly the shape needed, and a
 *  parser over it would be a second implementation of the module system to keep correct. */
function readSources() {
  const script = `
    import { SCRIPT_API_REFERENCE } from ${JSON.stringify(path.join(SCRIPTING, "scriptApiReference"))};
    import { SCRIPT_API_COMPLETIONS } from ${JSON.stringify(path.join(SCRIPTING, "scriptApiCompletions"))};
    import { SCRIPT_EXAMPLES } from ${JSON.stringify(path.join(SCRIPTING, "scriptExamples"))};
    process.stdout.write(JSON.stringify({
      reference: SCRIPT_API_REFERENCE,
      completions: SCRIPT_API_COMPLETIONS,
      examples: SCRIPT_EXAMPLES.map((e) => ({ id: e.id, title: e.title, code: e.code, files: e.files ?? [] })),
    }));
  `;
  const tmp = path.join(ROOT, "node_modules", ".lq-scripting-prompt.mts");
  fs.writeFileSync(tmp, script);
  try {
    return JSON.parse(execFileSync("npx", ["tsx", tmp], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** One reference section, flattened to text. Headings keep their level so the model can tell a
 *  sub-topic from a new one; code blocks are fenced, which is the one piece of structure worth its
 *  tokens (it is how a model tells prose from something it should imitate). */
function renderSection(section) {
  const lines = [`## ${section.title}`];
  for (const block of section.blocks) {
    if (block.kind === "heading" && block.text) lines.push("", `### ${block.text}`);
    else if (block.kind === "text" && block.text) lines.push("", block.text);
    else if (block.kind === "list" && block.items) lines.push("", ...block.items.map((item) => `- ${item}`));
    else if (block.kind === "code" && block.code) lines.push("", "```js", block.code, "```");
    // `diagram` blocks are drawings; they carry nothing a reader of text can use.
  }
  return lines.join("\n");
}

function build({ reference, completions, examples }) {
  const parts = [];

  parts.push(
    [
      "# Le langage de script de ce graphique",
      "",
      "Ce document est la référence complète du moteur de script embarqué dans ce composant de graphique.",
      "Ce n'est pas du JavaScript standard : le code s'exécute dans un bac à sable, une fois par bougie,",
      "avec une API fixe injectée (market, chart, plot, state, bar, math, ta, strategy, alert, console)",
      "et rien d'autre — pas de DOM, pas de réseau, pas d'import de paquet npm.",
      "",
      "Règles à respecter absolument quand tu écris un script :",
      "- N'utilise que les noms listés dans « Surface d'API complète » ci-dessous. Toute autre fonction n'existe pas.",
      "- Le script est réexécuté à chaque bougie ; garder un état d'une bougie à l'autre passe par state.*, jamais par une variable de module.",
      "- @indicator ou @strategy en première ligne dit ce qu'est le script. Sans l'un des deux, rien ne s'affiche.",
      "- Les paramètres réglables se déclarent avec new Variable(type, défaut). Ne les réaffecte jamais ailleurs.",
      "- Réponds toujours en français, et commente le code que tu écris.",
    ].join("\n"),
  );

  // The completion table first: it is the densest thing here — every name the sandbox exposes, with
  // its signature, in ~2k tokens. A model that reads only this already stops inventing functions.
  parts.push(
    [
      "# Surface d'API complète",
      "",
      "Chaque ligne : le nom, puis sa signature et ce qu'il fait. Rien en dehors de cette liste n'existe dans le bac à sable.",
      "",
      ...completions.map((c) => `- \`${c.apply ?? c.label}\` — ${c.detail}`),
    ].join("\n"),
  );

  parts.push(["# Référence détaillée", "", ...reference.map(renderSection)].join("\n\n"));

  parts.push(
    [
      "# Scripts d'exemple complets et fonctionnels",
      "",
      "Chacun s'exécute tel quel. Ce sont les modèles à imiter — pour le style, le découpage en @block et l'usage de l'API.",
      ...examples.flatMap((e) => [
        "",
        `## ${e.title}`,
        "```js",
        e.code,
        "```",
        ...e.files.flatMap((f) => ["", `Fichier joint « ${f.name} » :`, "```js", f.code, "```"]),
      ]),
    ].join("\n"),
  );

  return parts.join("\n\n---\n\n");
}

const sources = readSources();
const text = build(sources);

const header = `/* GENERATED FILE — do not edit by hand.
 * Run \`node scripts/generateScriptingPrompt.cjs\` to regenerate it.
 *
 * The scripting documentation, rendered as one plain-text briefing to hand an LLM as context —
 * see \`CandlestickChartProps.ai\`. Built from \`scriptApiReference.ts\`, \`scriptApiCompletions.ts\`
 * and \`scriptExamples.ts\`, which are already this feature's own source of truth, so a change to
 * the engine's API cannot leave the model reading a reference that no longer matches it.
 *
 * Roughly ${Math.round(text.length / 3.6 / 1000)}k tokens. That is a lot to send once and nothing to send repeatedly: it is
 * fixed text, identical on every request, which is exactly what prompt caching is for.
 *
 * Deliberately NOT a static import anywhere in the chart: a consumer who never opens the assistant
 * should not carry ${Math.round(text.length / 1024)}KB of prose in their bundle. Reached through \`loadScriptingPrompt()\`,
 * which code-splits it. */
`;

fs.writeFileSync(
  OUT,
  `${header}\nexport const SCRIPTING_PROMPT = ${JSON.stringify(text)};\n`,
);
console.log(`${(text.length / 1024).toFixed(1)} Ko (~${Math.round(text.length / 3.6 / 1000)}k tokens) écrits dans ${path.relative(ROOT, OUT)}`);
