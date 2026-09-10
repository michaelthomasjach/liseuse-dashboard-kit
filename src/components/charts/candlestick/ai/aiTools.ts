import type { AiToolDefinition } from "./interfaces/AiMessage.interface";
import type { AiChartContext } from "./interfaces/AiChartContext.interface";
import { indicatorCatalogEntry } from "../indicatorCatalog";
import { analyzeScriptKind } from "../scripting/scriptKind";

/** What running one tool produced: text handed straight back to the model. Plain prose rather than
 *  JSON wherever a sentence is clearer — the reader is a language model, and "SMA(20) ajoutée"
 *  costs fewer tokens and is less ambiguous than an object describing the same thing. */
export type AiToolOutcome = { content: string; isError?: boolean };

export interface AiTool {
  definition: AiToolDefinition;
  run: (input: Record<string, unknown>, chart: AiChartContext) => AiToolOutcome;
}

const str = (input: Record<string, unknown>, key: string): string | undefined => {
  const value = input[key];
  return typeof value === "string" ? value : undefined;
};
const num = (input: Record<string, unknown>, key: string): number | undefined => {
  const value = input[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

/** A date the model wrote, as a real one. Accepts ISO and the `JJ/MM/AAAA` a French speaker types
 *  — the assistant is talked to in French, and refusing "10/10/2025" because it is not ISO would
 *  be pedantry the user pays for. */
function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const french = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  const date = french ? new Date(Number(french[3]), Number(french[2]) - 1, Number(french[1])) : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The bar nearest a date, and the price extremes over a span — what every "between these two
 *  dates" tool needs, in the one place they can agree on it. */
function spanBetween(chart: AiChartContext, from: Date, to: Date) {
  const [start, end] = from <= to ? [from, to] : [to, from];
  const inside = chart.data.filter((candle) => candle.date >= start && candle.date <= end);
  if (inside.length === 0) return null;
  return {
    first: inside[0],
    last: inside[inside.length - 1],
    high: Math.max(...inside.map((c) => c.high)),
    low: Math.min(...inside.map((c) => c.low)),
    count: inside.length,
  };
}

const DATE_DOC = "Date au format AAAA-MM-JJ ou JJ/MM/AAAA.";

export const AI_TOOLS: AiTool[] = [
  {
    definition: {
      name: "lire_le_graphique",
      description:
        "Ce que le graphique montre en ce moment : symbole, unité de temps, nombre de bougies, période couverte, dernier cours, indicateurs actifs, dessins, scripts. À appeler avant toute action dont la réponse dépend de l'état courant.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    run: (_input, chart) => {
      const first = chart.data[0];
      const last = chart.data[chart.data.length - 1];
      const indicators = chart.indicators.map((i) => `${chart.indicatorLabel(i)} (id ${i.id})`);
      const scripts = chart.scripts.map((s) => `${s.name} [${analyzeScriptKind(s.code).kind}] (id ${s.id}${s.enabled === false ? ", désactivé" : ""})`);
      return {
        content: [
          `Symbole : ${chart.symbol ?? "non renseigné"}`,
          `Unité de temps : ${chart.timeframe ?? "non renseignée"} (disponibles : ${chart.availableTimeframes.join(", ") || "aucune"})`,
          `Bougies : ${chart.data.length}${first && last ? ` du ${first.date.toISOString().slice(0, 10)} au ${last.date.toISOString().slice(0, 10)}` : ""}`,
          last ? `Dernière clôture : ${last.close}` : "",
          `Volume affiché : ${chart.volumeVisible ? "oui" : "non"}`,
          `Indicateurs : ${indicators.join(" ; ") || "aucun"}`,
          `Dessins : ${chart.drawings().length}`,
          `Scripts : ${scripts.join(" ; ") || "aucun"}`,
          `Données fondamentales : ${chart.fundamentals?.length ?? 0} points`,
        ]
          .filter(Boolean)
          .join("\n"),
      };
    },
  },
  {
    definition: {
      name: "lister_les_indicateurs_disponibles",
      description: "Le catalogue des indicateurs que ce graphique sait afficher, avec leur identifiant technique (kind) et leur catégorie.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    run: (_input, chart) => ({
      content: chart.indicatorCatalog.map((entry) => `${entry.kind} — ${entry.label} (${entry.category}, panneau ${entry.pane})`).join("\n"),
    }),
  },
  {
    definition: {
      name: "ajouter_un_indicateur",
      description:
        "Ajoute un indicateur au graphique. Utiliser le « kind » exact renvoyé par lister_les_indicateurs_disponibles. Pour le volume, utiliser afficher_le_volume à la place.",
      inputSchema: {
        type: "object",
        properties: {
          kind: { type: "string", description: "Identifiant technique de l'indicateur, par exemple sma, ema, rsi, macd." },
          period: { type: "number", description: "Période, quand l'indicateur en accepte une. Sinon sa valeur par défaut est utilisée." },
        },
        required: ["kind"],
        additionalProperties: false,
      },
    },
    run: (input, chart) => {
      const kind = str(input, "kind");
      const entry = chart.indicatorCatalog.find((e) => e.kind === kind);
      if (!entry) return { content: `Aucun indicateur « ${kind} ». Appelez lister_les_indicateurs_disponibles.`, isError: true };
      const period = num(input, "period");
      chart.addIndicator(period !== undefined && entry.hasPeriod ? { ...entry, defaultPeriod: period } : entry);
      return { content: `${entry.label}${period !== undefined && entry.hasPeriod ? ` (période ${period})` : ""} ajouté au graphique.` };
    },
  },
  {
    definition: {
      name: "retirer_un_indicateur",
      description: "Retire un indicateur du graphique, par son id (voir lire_le_graphique).",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
    },
    run: (input, chart) => {
      const id = str(input, "id");
      const indicator = chart.indicators.find((i) => i.id === id);
      if (!indicator) return { content: `Aucun indicateur d'id « ${id} » sur le graphique.`, isError: true };
      chart.removeIndicator(indicator.id);
      return { content: `${chart.indicatorLabel(indicator)} retiré.` };
    },
  },
  {
    definition: {
      name: "afficher_le_volume",
      description: "Affiche ou masque le panneau de volume sous les bougies.",
      inputSchema: { type: "object", properties: { visible: { type: "boolean" } }, required: ["visible"], additionalProperties: false },
    },
    run: (input, chart) => {
      const visible = input.visible === true;
      chart.setVolumeVisible(visible);
      return { content: visible ? "Volume affiché." : "Volume masqué." };
    },
  },
  {
    definition: {
      name: "changer_l_unite_de_temps",
      description: "Change l'unité de temps du graphique. La valeur doit être l'une de celles renvoyées par lire_le_graphique.",
      inputSchema: { type: "object", properties: { timeframe: { type: "string" } }, required: ["timeframe"], additionalProperties: false },
    },
    run: (input, chart) => {
      const timeframe = str(input, "timeframe");
      if (!chart.setTimeframe) return { content: "Ce graphique ne permet pas de changer d'unité de temps.", isError: true };
      if (!timeframe || !chart.availableTimeframes.includes(timeframe)) {
        return { content: `Unité de temps inconnue. Disponibles : ${chart.availableTimeframes.join(", ")}.`, isError: true };
      }
      chart.setTimeframe(timeframe);
      return { content: `Unité de temps : ${timeframe}.` };
    },
  },
  {
    definition: {
      name: "changer_de_symbole",
      description: "Affiche un autre symbole sur ce graphique.",
      inputSchema: { type: "object", properties: { symbole: { type: "string" } }, required: ["symbole"], additionalProperties: false },
    },
    run: (input, chart) => {
      const symbol = str(input, "symbole");
      if (!chart.setSymbol) return { content: "Ce graphique ne permet pas de changer de symbole.", isError: true };
      if (!symbol) return { content: "Aucun symbole fourni.", isError: true };
      chart.setSymbol(symbol.toUpperCase());
      return { content: `Symbole demandé : ${symbol.toUpperCase()}. C'est l'application qui fournit les données ; si elle n'en a pas pour ce symbole, le graphique ne changera pas.` };
    },
  },
  {
    definition: {
      name: "tracer_une_ligne_horizontale",
      description: "Trace une ligne horizontale à un prix donné, sur toute la largeur du graphique.",
      inputSchema: {
        type: "object",
        properties: { prix: { type: "number" }, couleur: { type: "string", description: "Couleur CSS, facultative." } },
        required: ["prix"],
        additionalProperties: false,
      },
    },
    run: (input, chart) => {
      const price = num(input, "prix");
      if (price === undefined) return { content: "Prix manquant.", isError: true };
      if (chart.data.length === 0) return { content: "Le graphique n'a aucune bougie.", isError: true };
      chart.commitDrawings([
        ...chart.drawings(),
        {
          id: chart.nextDrawingId(),
          x1: chart.data[0].date,
          y1: price,
          x2: chart.data[chart.data.length - 1].date,
          y2: price,
          lineType: "horizontal",
          color: str(input, "couleur"),
        },
      ]);
      return { content: `Ligne horizontale tracée à ${price}.` };
    },
  },
  {
    definition: {
      name: "tracer_un_canal",
      description:
        "Trace un canal d'évolution des prix entre deux dates : deux droites parallèles, l'une sur les plus hauts, l'autre sur les plus bas de la période. C'est l'outil à utiliser pour « dessine-moi les canaux entre telle et telle date ».",
      inputSchema: {
        type: "object",
        properties: {
          debut: { type: "string", description: DATE_DOC },
          fin: { type: "string", description: DATE_DOC },
          couleur: { type: "string", description: "Couleur CSS, facultative." },
        },
        required: ["debut", "fin"],
        additionalProperties: false,
      },
    },
    run: (input, chart) => {
      const from = parseDate(str(input, "debut"));
      const to = parseDate(str(input, "fin"));
      if (!from || !to) return { content: `Dates illisibles. ${DATE_DOC}`, isError: true };
      const span = spanBetween(chart, from, to);
      if (!span) {
        const first = chart.data[0]?.date.toISOString().slice(0, 10);
        const last = chart.data[chart.data.length - 1]?.date.toISOString().slice(0, 10);
        return { content: `Aucune bougie entre ces deux dates. Le graphique couvre ${first} → ${last}.`, isError: true };
      }
      // The channel is drawn from the span's own extremes: a top line on its highs, a bottom line
      // on its lows, both spanning the same dates. Two ordinary drawings rather than a new kind of
      // object — they can then be moved, restyled and deleted like anything else on the chart.
      const color = str(input, "couleur") ?? "#3b7dd8";
      chart.commitDrawings([
        ...chart.drawings(),
        { id: chart.nextDrawingId(), x1: span.first.date, y1: span.high, x2: span.last.date, y2: span.high, color },
        { id: chart.nextDrawingId(), x1: span.first.date, y1: span.low, x2: span.last.date, y2: span.low, color },
      ]);
      return {
        content: `Canal tracé sur ${span.count} bougies : haut ${span.high.toFixed(2)}, bas ${span.low.toFixed(2)}, du ${span.first.date.toISOString().slice(0, 10)} au ${span.last.date.toISOString().slice(0, 10)}.`,
      };
    },
  },
  {
    definition: {
      name: "effacer_les_dessins",
      description: "Efface tous les dessins du graphique.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    run: (_input, chart) => {
      const count = chart.drawings().length;
      chart.commitDrawings([]);
      return { content: `${count} dessin(s) effacé(s).` };
    },
  },
  {
    definition: {
      name: "lire_un_script",
      description: "Le code source d'un script (indicateur, stratégie ou analyse @quant), par son id.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
    },
    run: (input, chart) => {
      const script = chart.scripts.find((s) => s.id === str(input, "id"));
      if (!script) return { content: "Script introuvable.", isError: true };
      const files = (script.files ?? []).map((f) => `\n--- fichier ${f.name} ---\n${f.code}`).join("");
      return { content: `--- ${script.name} ---\n${script.code}${files}` };
    },
  },
  {
    definition: {
      name: "ecrire_un_script",
      description:
        "Crée un script, ou remplace le code d'un script existant. Le code doit être écrit dans le langage de scripting de ce graphique, dont le manuel complet vous a été fourni. Déclarez @indicator, @strategy, @quant ou @report sur la première ligne. Pour un rapport d'entreprise, écrivez un @report : il produit un document que l'utilisateur peut lire et exporter en PDF.",
      inputSchema: {
        type: "object",
        properties: {
          nom: { type: "string" },
          code: { type: "string" },
          id: { type: "string", description: "Pour remplacer un script existant. Omettre pour en créer un." },
          executer: { type: "boolean", description: "Exécuter le script tout de suite. Vrai par défaut." },
        },
        required: ["code"],
        additionalProperties: false,
      },
    },
    run: (input, chart) => {
      const code = str(input, "code");
      if (!code) return { content: "Aucun code fourni.", isError: true };
      const existingId = str(input, "id");
      const run = input.executer !== false;
      if (existingId) {
        const script = chart.scripts.find((s) => s.id === existingId);
        if (!script) return { content: "Script introuvable.", isError: true };
        chart.updateScript(existingId, code);
        if (run) chart.runScript(existingId);
        chart.openScript?.(existingId);
        return { content: `Script « ${script.name} » mis à jour${run ? " et exécuté" : ""}.` };
      }
      const name = str(input, "nom") ?? "Script de l'assistant";
      const id = chart.addScript(name, code);
      if (run) chart.runScript(id);
      chart.openScript?.(id);
      return { content: `Script « ${name} » créé (id ${id})${run ? " et exécuté" : ""}, et ouvert dans l'éditeur.` };
    },
  },
  {
    definition: {
      name: "lire_le_resultat_d_un_script",
      description:
        "Ce qu'un script a produit à sa dernière exécution : erreurs, journal, et selon son type le backtest d'une @strategy (P&L, Sharpe, Sortino, drawdown, trades), les résultats d'une analyse @quant, ou le document d'un @report.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
    },
    run: (input, chart) => {
      const id = str(input, "id");
      const script = chart.scripts.find((s) => s.id === id);
      if (!script) return { content: "Script introuvable.", isError: true };
      const output = id === undefined ? undefined : chart.runOutputs[id];
      const result = output?.result;
      if (!result) return { content: `« ${script.name} » n'a pas encore été exécuté.`, isError: true };
      const parts = [`--- ${script.name} ---`];
      if (result.error) parts.push(`Erreur : ${result.error.message}${result.error.line ? ` (ligne ${result.error.line})` : ""}`);
      if (result.logs.length > 0) parts.push(`Journal :\n${result.logs.slice(0, 40).join("\n")}`);
      if (result.strategy) parts.push(`Backtest :\n${JSON.stringify(result.strategy, null, 1).slice(0, 6000)}`);
      if (result.quant) parts.push(`Analyse @quant :\n${JSON.stringify(result.quant.rows, null, 1).slice(0, 6000)}`);
      if (result.report) {
        parts.push(
          `Rapport « ${result.report.title} » — ${result.report.blocks.length} sections. Il est affiché dans le panneau, avec un bouton d'export PDF.\n${JSON.stringify(result.report.blocks, null, 1).slice(0, 8000)}`,
        );
      }
      if (parts.length === 1) parts.push("Aucune sortie.");
      return { content: parts.join("\n\n") };
    },
  },
  {
    definition: {
      name: "lire_les_donnees_fondamentales",
      description:
        "Les données fondamentales que l'application a fournies pour ce symbole : chiffre d'affaires, résultat net, BPA, marges, dette, capitaux propres, flux de trésorerie, impôts, CAPEX… selon ce qu'elle a transmis.",
      inputSchema: {
        type: "object",
        properties: { derniers: { type: "number", description: "Nombre de périodes les plus récentes à renvoyer. 12 par défaut." } },
        additionalProperties: false,
      },
    },
    run: (input, chart) => {
      const points = chart.fundamentals ?? [];
      if (points.length === 0) {
        return { content: "L'application n'a fourni aucune donnée fondamentale pour ce symbole.", isError: true };
      }
      const count = num(input, "derniers") ?? 12;
      const recent = points.slice(-Math.max(1, Math.min(count, points.length)));
      return { content: JSON.stringify(recent, null, 1).slice(0, 12000) };
    },
  },
  {
    definition: {
      name: "lire_les_prix",
      description:
        "Les bougies du graphique, éventuellement bornées à une période. À utiliser pour un calcul que vous faites vous-même ; pour un calcul répétable, écrivez plutôt un script.",
      inputSchema: {
        type: "object",
        properties: {
          debut: { type: "string", description: DATE_DOC },
          fin: { type: "string", description: DATE_DOC },
          derniers: { type: "number", description: "À défaut de dates : les N dernières bougies. 60 par défaut." },
        },
        additionalProperties: false,
      },
    },
    run: (input, chart) => {
      const from = parseDate(str(input, "debut"));
      const to = parseDate(str(input, "fin"));
      let slice = chart.data;
      if (from && to) {
        const span = spanBetween(chart, from, to);
        if (!span) return { content: "Aucune bougie entre ces deux dates.", isError: true };
        slice = chart.data.filter((c) => c.date >= span.first.date && c.date <= span.last.date);
      } else {
        slice = chart.data.slice(-Math.max(1, num(input, "derniers") ?? 60));
      }
      // Compact on purpose: one line per bar, no field names repeated 500 times.
      const rows = slice.map((c) => `${c.date.toISOString().slice(0, 10)} O${c.open} H${c.high} L${c.low} C${c.close}${c.volume !== undefined ? ` V${c.volume}` : ""}`);
      return { content: `${rows.length} bougies\n${rows.join("\n")}`.slice(0, 20000) };
    },
  },
];

/** The tools, filtered to what this chart can actually do. A lever the host did not wire up is not
 *  offered at all — a model told it may change the timeframe, that then fails every time, spends
 *  the user's turn learning what the schema could have said up front. */
export function availableAiTools(chart: AiChartContext): AiTool[] {
  return AI_TOOLS.filter((tool) => {
    if (tool.definition.name === "changer_l_unite_de_temps") return chart.setTimeframe !== undefined && chart.availableTimeframes.length > 0;
    if (tool.definition.name === "changer_de_symbole") return chart.setSymbol !== undefined;
    if (tool.definition.name === "lire_les_donnees_fondamentales") return (chart.fundamentals?.length ?? 0) > 0;
    return true;
  });
}

/** Runs one tool call, never throwing: a tool that fails has to come back as a *result* the model
 *  can read and work around, not as an exception that ends the turn. */
export function runAiTool(name: string, input: Record<string, unknown>, chart: AiChartContext): AiToolOutcome {
  const tool = AI_TOOLS.find((t) => t.definition.name === name);
  if (!tool) return { content: `Outil inconnu : ${name}.`, isError: true };
  try {
    return tool.run(input, chart);
  } catch (err) {
    return { content: `L'outil « ${name} » a échoué : ${err instanceof Error ? err.message : String(err)}`, isError: true };
  }
}

/** Kept so the catalogue's own `indicatorCatalogEntry` stays the one way an indicator's metadata is
 *  read, here as everywhere else. */
export { indicatorCatalogEntry };
