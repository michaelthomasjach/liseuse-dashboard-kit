#!/usr/bin/env node
/* Un vrai appel à l'API, avec la vraie clé, à travers le vrai transport de la bibliothèque.
 *
 * Pourquoi ce script existe : `anthropicSend` parle SSE à l'API. Tout le reste de la
 * fonctionnalité a été vérifié dans le navigateur contre un transport simulé — ce qu'un simulateur
 * ne peut pas prouver, c'est que le protocole réel est bien parlé. C'est la seule chose que ce
 * fichier teste, et il la teste de bout en bout : texte en streaming, puis un appel d'outil,
 * puis le résultat de l'outil renvoyé au modèle.
 *
 * La clé est lue depuis .env.local (jamais commité, voir .gitignore) ou depuis la variable
 * d'environnement ANTHROPIC_API_KEY. Elle n'est jamais affichée, ni écrite nulle part.
 *
 *   node scripts/testAiTransport.cjs
 */
const fs = require("fs");
const path = require("path");

function readEnvFile() {
  const envFile = path.join(__dirname, "..", ".env.local");
  const values = {};
  if (!fs.existsSync(envFile)) return values;
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const match = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

const ENV = readEnvFile();

function readKey() {
  if (process.env.ANTHROPIC_API_KEY) return { key: process.env.ANTHROPIC_API_KEY, source: "variable d'environnement ANTHROPIC_API_KEY" };
  const fromFile = ENV.ANTHROPIC_API_KEY || ENV.VITE_ANTHROPIC_API_KEY;
  return fromFile ? { key: fromFile, source: ".env.local" } : null;
}

/** Requis quand la clé appartient à l'organisation plutôt qu'à un workspace : l'API refuse alors la
 *  requête en nommant cet en-tête. Une clé rattachée à un workspace n'en a pas besoin. */
function readWorkspaceId() {
  return process.env.ANTHROPIC_WORKSPACE_ID || ENV.ANTHROPIC_WORKSPACE_ID || ENV.VITE_ANTHROPIC_WORKSPACE_ID || null;
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";
const API = "https://api.anthropic.com/v1/messages";

/** The same SSE reading `anthropicSend` does, in plain Node — same event names, same assembly of a
 *  tool call from its fragments. If this works and the browser one does not, the difference is the
 *  browser, not the protocol. */
async function stream(body, onEvent) {
  const response = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": readKey().key,
      "anthropic-version": "2023-06-01",
      ...(readWorkspaceId() ? { "anthropic-workspace-id": readWorkspaceId() } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} — ${(await response.text()).slice(0, 500)}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const pending = new Map();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      let event;
      try {
        event = JSON.parse(dataLine.slice(5).trim());
      } catch {
        continue;
      }
      if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
        pending.set(event.index, { id: event.content_block.id, name: event.content_block.name, json: "" });
      } else if (event.type === "content_block_delta") {
        if (event.delta?.type === "text_delta") onEvent({ type: "text", text: event.delta.text });
        else if (event.delta?.type === "input_json_delta") {
          const p = pending.get(event.index);
          if (p) p.json += event.delta.partial_json;
        }
      } else if (event.type === "content_block_stop") {
        const p = pending.get(event.index);
        if (p) {
          pending.delete(event.index);
          onEvent({ type: "tool_use", id: p.id, name: p.name, input: p.json.trim() === "" ? {} : JSON.parse(p.json) });
        }
      } else if (event.type === "message_delta" && event.delta?.stop_reason) {
        onEvent({ type: "stop", reason: event.delta.stop_reason });
      } else if (event.type === "error") {
        throw new Error(event.error?.message ?? "erreur inconnue");
      }
    }
  }
}

const OUTIL = {
  name: "ajouter_un_indicateur",
  description: "Ajoute un indicateur au graphique.",
  input_schema: {
    type: "object",
    properties: { kind: { type: "string", description: "sma, ema, rsi, macd…" }, period: { type: "number" } },
    required: ["kind"],
    additionalProperties: false,
  },
};

const SYSTEM =
  "Tu es l'assistant intégré à un graphique boursier. Tu réponds en français, brièvement, et tu agis avec les outils fournis plutôt que de décrire ce qu'il faudrait faire.";

(async () => {
  const found = readKey();
  if (!found) {
    console.log("Aucune clé trouvée.\n");
    console.log("Deux façons de la fournir, aucune ne passe par la conversation :");
    console.log("  1. echo 'ANTHROPIC_API_KEY=sk-ant-…' > .env.local     (déjà dans .gitignore)");
    console.log("  2. export ANTHROPIC_API_KEY=sk-ant-…                  (dans votre shell)");
    console.log("\nPuis : node scripts/testAiTransport.cjs");
    process.exit(2);
  }
  const workspace = readWorkspaceId();
  console.log(`Clé lue depuis  : ${found.source}`);
  console.log(`Workspace       : ${workspace ? workspace : "aucun (clé supposée rattachée à un workspace)"}`);
  console.log(`Modèle          : ${MODEL}\n`);

  // --- 1. Le streaming de texte ---
  console.log("1. Texte en streaming");
  let texte = "";
  let stop1 = null;
  await stream(
    {
      model: MODEL,
      max_tokens: 300,
      stream: true,
      thinking: { type: "adaptive" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: [{ type: "text", text: "En une phrase : à quoi sert une moyenne mobile exponentielle ?" }] }],
    },
    (e) => {
      if (e.type === "text") texte += e.text;
      if (e.type === "stop") stop1 = e.reason;
    },
  );
  console.log(`   reçu (${texte.length} caractères, stop=${stop1}) : ${texte.trim().slice(0, 160)}`);

  // --- 2. L'appel d'outil ---
  console.log("\n2. Appel d'outil");
  const appels = [];
  let stop2 = null;
  const question = "Affiche une moyenne mobile simple de période 20 sur le graphique.";
  await stream(
    {
      model: MODEL,
      max_tokens: 500,
      stream: true,
      thinking: { type: "adaptive" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: [{ type: "text", text: question }] }],
      tools: [OUTIL],
    },
    (e) => {
      if (e.type === "tool_use") appels.push(e);
      if (e.type === "stop") stop2 = e.reason;
    },
  );
  console.log(`   stop=${stop2}, ${appels.length} appel(s) : ${appels.map((a) => `${a.name}(${JSON.stringify(a.input)})`).join(", ") || "aucun"}`);

  // --- 3. Le résultat de l'outil renvoyé, et la conclusion ---
  if (appels.length === 0) {
    console.log("\n3. Boucle d'outils : sautée (le modèle n'a appelé aucun outil)");
  } else {
    console.log("\n3. Résultat renvoyé au modèle");
    let conclusion = "";
    await stream(
      {
        model: MODEL,
        max_tokens: 300,
        stream: true,
        thinking: { type: "adaptive" },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [
          { role: "user", content: [{ type: "text", text: question }] },
          { role: "assistant", content: appels.map((a) => ({ type: "tool_use", id: a.id, name: a.name, input: a.input })) },
          {
            role: "user",
            content: appels.map((a) => ({ type: "tool_result", tool_use_id: a.id, content: "Moyenne mobile simple (période 20) ajoutée au graphique." })),
          },
        ],
        tools: [OUTIL],
      },
      (e) => {
        if (e.type === "text") conclusion += e.text;
      },
    );
    console.log(`   conclusion : ${conclusion.trim().slice(0, 200)}`);
  }

  const ok = texte.length > 0 && appels.length > 0;
  console.log(`\nVerdict : ${ok ? "le transport parle bien le protocole réel." : "quelque chose ne va pas — voir ci-dessus."}`);
  process.exit(ok ? 0 : 1);
})().catch((err) => {
  console.error(`\nÉchec : ${err.message}`);
  process.exit(1);
});
