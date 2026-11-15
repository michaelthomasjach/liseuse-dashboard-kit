import type { AiToolDefinition } from "./interfaces/AiMessage.interface";
import type { AiChartContext } from "./interfaces/AiChartContext.interface";
import { indicatorCatalogEntry } from "../indicatorCatalog";
import { analyzeScriptKind } from "../scripting/scriptKind";
import { SCRIPTING_DOCS_TOOL } from "./scriptingDocs";
import { findUiButton, highlightUiElement, listUiButtons } from "./uiHighlight";
import { COMPARISON_TOOLS, comparisonToolAvailable } from "./comparisonTools";

/** What running one tool produced: text handed straight back to the model. Plain prose rather than
 *  JSON wherever a sentence is clearer — the reader is a language model, and "SMA(20) ajoutée"
 *  costs fewer tokens and is less ambiguous than an object describing the same thing. */
export type AiToolOutcome = { content: string; isError?: boolean };

export interface AiTool {
  definition: AiToolDefinition;
  /** La définition selon ce que ce graphique permet (ex. les seuls modes d'affichage possibles) ; `definition` sinon. */
  definitionFor?: (chart: AiChartContext) => AiToolDefinition;
  /** Synchrone pour agir sur le graphique ; une promesse pour un outil qui attend des données de l'application. */
  run: (input: Record<string, unknown>, chart: AiChartContext) => AiToolOutcome | Promise<AiToolOutcome>;
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
          chart.workspace ? `Fenêtres de l'espace de travail : ${describePanels(chart)}` : "",
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
        "Affiche un indicateur EXISTANT du catalogue, tel quel (par exemple « ajoute une SMA 50 », « affiche le RSI »). Utiliser le « kind » exact renvoyé par lister_les_indicateurs_disponibles. Pour le volume, utiliser afficher_le_volume. Ne pas l'utiliser quand on demande de faire, créer, coder, produire ou réaliser un indicateur, un système ou une stratégie (même s'il réunit des indicateurs existants) : dans ce cas, utiliser coder_un_indicateur puis ecrire_un_script.",
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
      name: SCRIPTING_DOCS_TOOL,
      description:
        "La documentation du langage de scripting de ce graphique (le seul langage que les scripts acceptent ; ce n'est ni du Pine Script ni du JavaScript libre). Sans argument : les règles et le sommaire. Avec « section » : le texte d'une section (ex. « plot.* », « market.* », « @indicator »). Avec « recherche » : les passages qui citent un terme (ex. « ta.rsi »). Consultez-la avant d'écrire ou de convertir un script.",
      inputSchema: {
        type: "object",
        properties: {
          section: { type: "string", description: "Titre (ou morceau de titre) d'une section du sommaire." },
          recherche: { type: "string", description: "Un terme à chercher dans toute la documentation." },
        },
        additionalProperties: false,
      },
    },
    // Exécuté par l'assistant (useAiAssistant), qui charge le manuel : jamais par ce tableau.
    run: () => ({ content: "Documentation indisponible ici.", isError: true }),
  },
  {
    definition: {
      name: "coder_un_indicateur",
      description:
        "À appeler EN PREMIER dès qu'on demande de faire, créer, coder, développer, produire ou réaliser un indicateur, un système, un signal ou une stratégie — y compris un indicateur qui réunit des indicateurs existants (par exemple « un indicateur qui regroupe trois SMA 50, 100 et 200 »). Ouvre la fenêtre de développement (l'éditeur de script) sur un nouveau script vide, et renvoie son id. Ensuite : écrire le code complet avec ecrire_un_script en passant cet id, puis lire le résultat (lire_le_resultat_d_un_script) et corriger.",
      inputSchema: {
        type: "object",
        properties: {
          nom: { type: "string", description: "Nom du script, court et parlant (« Trois SMA 50/100/200 »)." },
          type: { type: "string", enum: ["indicateur", "strategie", "quant"], description: "indicateur (par défaut), strategie (prend des positions, backtest) ou quant (analyse sans dessin)." },
        },
        required: ["nom"],
        additionalProperties: false,
      },
    },
    run: (input, chart) => {
      const name = str(input, "nom") ?? "Indicateur de l'assistant";
      const type = str(input, "type");
      const decorator = type === "strategie" ? "@strategy" : type === "quant" ? "@quant" : "@indicator";
      const id = chart.addScript(name, `${decorator}\n// ${name} : en cours d'écriture par l'assistant.\n`);
      chart.openScript?.(id);
      return {
        content: `Fenêtre de développement ouverte sur le script « ${name} » (id ${id}, ${decorator}). Écrivez maintenant le code complet avec ecrire_un_script et id « ${id} » (dans le langage de ce graphique, voir lire_la_documentation_du_scripting), puis lisez le résultat.`,
      };
    },
  },
  {
    definition: {
      name: "ouvrir_un_script",
      description: "Ouvre un script existant dans la fenêtre de développement (l'éditeur), sur son onglet. L'id est donné par lire_le_graphique.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false },
    },
    run: (input, chart) => {
      const id = str(input, "id");
      const script = chart.scripts.find((s) => s.id === id);
      if (!script || !id) return { content: "Script introuvable.", isError: true };
      if (!chart.openScript) return { content: "L'éditeur de script n'est pas disponible ici.", isError: true };
      chart.openScript(id);
      return { content: `Script « ${script.name} » ouvert dans l'éditeur.` };
    },
  },
  {
    definition: {
      name: "lancer_le_replay",
      description:
        "Rejoue l'historique bougie par bougie à partir d'une date (les bougies suivantes sont masquées), ou d'un instant tiré au hasard sans date. Dans un espace à plusieurs fenêtres, toutes les fenêtres ouvertes suivent la même date. L'utilisateur avance ensuite avec Lecture ou les flèches du clavier.",
      inputSchema: {
        type: "object",
        properties: { date: { type: "string", description: "Date de départ (AAAA-MM-JJ ou JJ/MM/AAAA). Omettre pour un instant au hasard." } },
        additionalProperties: false,
      },
    },
    run: (input, chart) => {
      if (!chart.startReplay) return { content: "Le replay n'est pas disponible sur ce graphique.", isError: true };
      const raw = str(input, "date");
      const at = raw ? parseDate(raw) : null;
      if (raw && !at) return { content: `Date illisible : « ${raw} ».`, isError: true };
      const start = chart.startReplay(at);
      if (!start) return { content: "Pas assez de bougies pour un replay.", isError: true };
      return { content: `Replay lancé au ${start.toISOString().slice(0, 10)}${at ? "" : " (instant tiré au hasard)"}. Lecture, flèches ← → pour avancer, Échap pour quitter.` };
    },
  },
  {
    definition: {
      name: "quitter_le_replay",
      description: "Arrête le replay en cours et révèle tout l'historique (dans toutes les fenêtres).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    run: (_input, chart) => {
      if (!chart.quitReplay) return { content: "Le replay n'est pas disponible sur ce graphique.", isError: true };
      const cutoff = chart.replayCutoff?.() ?? null;
      chart.quitReplay();
      return { content: cutoff ? "Replay arrêté." : "Aucun replay en cours." };
    },
  },
  {
    definition: {
      name: "regler_le_filigrane",
      description:
        "Affiche ou masque le nom du symbole en fond du graphique (filigrane), et règle sa taille et son opacité. Un nom trop long est réduit automatiquement pour tenir dans le graphique.",
      inputSchema: {
        type: "object",
        properties: {
          afficher: { type: "boolean" },
          taille: { type: "number", description: "En % de la taille par défaut, de 30 à 150." },
          opacite: { type: "number", description: "En %, de 2 à 40." },
        },
        additionalProperties: false,
      },
    },
    run: (input, chart) => {
      if (!chart.setWatermark || !chart.watermark) return { content: "Filigrane indisponible.", isError: true };
      const size = num(input, "taille");
      const opacity = num(input, "opacite");
      const patch: Partial<{ visible: boolean; opacity: number; size: number }> = {};
      if (typeof input.afficher === "boolean") patch.visible = input.afficher;
      if (size !== undefined) patch.size = Math.min(150, Math.max(30, Math.round(size)));
      if (opacity !== undefined) patch.opacity = Math.min(40, Math.max(2, opacity)) / 100;
      if ((patch.size !== undefined || patch.opacity !== undefined) && patch.visible === undefined) patch.visible = true;
      chart.setWatermark(patch);
      const w = { ...chart.watermark(), ...patch };
      return { content: w.visible ? `Filigrane affiché : taille ${w.size} %, opacité ${Math.round(w.opacity * 100)} %.` : "Filigrane masqué." };
    },
  },
  {
    definition: {
      name: "lister_les_boutons_de_l_interface",
      description:
        "Les boutons visibles à l'écran, avec leur nom, leur infobulle et leur emplacement (en-tête du graphique, barre d'outils de gauche, barre de droite, légende…). Pour répondre à « où se trouve… », « comment faire pour… » : trouver le bouton, puis le montrer avec montrer_un_bouton.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    run: () => {
      const buttons = listUiButtons();
      if (buttons.length === 0) return { content: "Aucun bouton visible (interface indisponible ici).", isError: true };
      const byZone = new Map<string, string[]>();
      for (const b of buttons) byZone.set(b.zone, [...(byZone.get(b.zone) ?? []), b.title ? `${b.label} — ${b.title}` : b.label]);
      return {
        content:
          [...byZone].map(([zone, labels]) => `${zone} :\n- ${labels.join("\n- ")}`).join("\n\n") +
          "\n\nCertaines fonctions sont dans le clic droit du graphique (menu contextuel), dans les paramètres du graphique (roue dentée) ou dans un menu replié : dans ce cas, montrez le bouton qui y mène et expliquez la suite.",
      };
    },
  },
  {
    definition: {
      name: "montrer_un_bouton",
      description:
        "Met un bouton de l'interface en surbrillance (il pulse jusqu'à ce que l'utilisateur le survole ou le touche), pour lui montrer où se trouve une fonctionnalité. Passer le nom exact donné par lister_les_boutons_de_l_interface. Puis dire en une phrase où il est et à quoi il sert.",
      inputSchema: {
        type: "object",
        properties: { nom: { type: "string", description: "Nom du bouton, tel que listé (par exemple « Replay », « Ajouter un indicateur »)." } },
        required: ["nom"],
        additionalProperties: false,
      },
    },
    run: (input) => {
      const name = str(input, "nom") ?? "";
      const button = findUiButton(name);
      if (!button) return { content: `Aucun bouton visible nommé « ${name} ». Appelez lister_les_boutons_de_l_interface.`, isError: true };
      highlightUiElement(button.element);
      return { content: `Bouton « ${button.label} » mis en surbrillance (${button.zone}). Il reprend son aspect dès que l'utilisateur le survole ou le touche.` };
    },
  },
  {
    definition: {
      name: "ecrire_un_script",
      description:
        "Crée un script dans un nouvel onglet de l'éditeur (qui s'ouvre) et l'exécute, ou remplace le code d'un script existant (avec « id ») — pour corriger un script que vous venez d'écrire, passez toujours son id. Le code doit être écrit dans le langage de scripting de ce graphique (voir lire_la_documentation_du_scripting). Déclarez @indicator, @strategy, @quant ou @report sur la première ligne. Pour un rapport d'entreprise, écrivez un @report : il produit un document que l'utilisateur peut lire et exporter en PDF.",
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
      return {
        content: `Script « ${name} » créé (id ${id})${run ? " et exécuté" : ""}, et ouvert dans l'éditeur. Pour le corriger, rappelez ecrire_un_script avec id « ${id} » : ne créez pas un nouveau script.`,
      };
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
  {
    definition: {
      name: "marquer_des_seances",
      description:
        "Pose une épingle sur chaque séance (bougie) donnée, avec un court texte : par exemple les pires séances renvoyées par une statistique, pour les montrer sur le graphique. Une date sans bougie est signalée.",
      inputSchema: {
        type: "object",
        properties: {
          seances: {
            type: "array",
            description: "Les séances à marquer, 30 au plus.",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: DATE_DOC },
                texte: { type: "string", description: "Court texte de l'épingle, par exemple « −12,3 % ». Facultatif." },
              },
              required: ["date"],
            },
          },
          couleur: { type: "string", description: "Couleur CSS, facultative. Par défaut : rouge pour un texte négatif, vert pour un positif." },
        },
        required: ["seances"],
        additionalProperties: false,
      },
    },
    run: (input, chart) => {
      const raw = Array.isArray(input.seances) ? input.seances.slice(0, 30) : [];
      if (raw.length === 0) return { content: "Aucune séance à marquer.", isError: true };
      if (chart.data.length === 0) return { content: "Le graphique n'a aucune bougie.", isError: true };
      const dayOf = (d: Date) => d.toISOString().slice(0, 10);
      // A date the model wrote names a calendar day, whatever hour the host stamps its daily bars
      // with: match on the day first, then the nearest bar within three days (a holiday, a time zone)
      // or within one bar's own span on a coarser timeframe (a session falls inside its weekly bar).
      const byDay = new Map(chart.data.map((c) => [dayOf(c.date), c]));
      const spacing = chart.data.length > 1 ? (chart.data[chart.data.length - 1].date.getTime() - chart.data[0].date.getTime()) / (chart.data.length - 1) : 0;
      const tolerance = Math.max(3 * 86_400_000, Math.min(31 * 86_400_000, spacing * 1.05));
      const color = str(input, "couleur");
      const added: string[] = [];
      const missing: string[] = [];
      const next = [...chart.drawings()];
      for (const item of raw) {
        const entry = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const date = parseDate(str(entry, "date"));
        if (!date) {
          missing.push(String(entry.date ?? "?"));
          continue;
        }
        let candle = byDay.get(dayOf(date));
        if (!candle) {
          const near = chart.data.reduce((best, c) => (Math.abs(c.date.getTime() - date.getTime()) < Math.abs(best.date.getTime() - date.getTime()) ? c : best));
          if (Math.abs(near.date.getTime() - date.getTime()) <= tolerance) candle = near;
        }
        if (!candle) {
          missing.push(dayOf(date));
          continue;
        }
        const text = str(entry, "texte")?.slice(0, 40);
        const down = text !== undefined && /^\s*[−-]/.test(text);
        const up = text !== undefined && /^\s*\+/.test(text);
        // A drop is pinned on the bar's low, a rise on its high: the pin points at the move itself.
        const price = down ? candle.low : candle.high;
        const pinColor = color ?? (down ? "#d64545" : up ? "#2e9d5b" : undefined);
        next.push({
          id: chart.nextDrawingId(),
          x1: candle.date,
          y1: price,
          x2: candle.date,
          y2: price,
          lineType: "pin",
          ...(text ? { text } : {}),
          ...(pinColor ? { color: pinColor } : {}),
        });
        added.push(dayOf(candle.date));
      }
      if (added.length) chart.commitDrawings(next);
      const first = dayOf(chart.data[0].date);
      const last = dayOf(chart.data[chart.data.length - 1].date);
      return {
        content:
          `${added.length} séance(s) marquée(s)${added.length ? ` : ${added.join(", ")}` : ""}.` +
          (missing.length ? ` Hors du graphique (il couvre ${first} → ${last}) : ${missing.join(", ")}.` : ""),
        ...(added.length === 0 ? { isError: true } : {}),
      };
    },
  },
  // Comparaisons entre symboles : côte à côte, performances, indice A / B (voir comparisonTools).
  ...COMPARISON_TOOLS,
];

/** Les fenêtres de l'espace de travail en une ligne : « 1 : AAPL (1day) ; 2 : MSFT (1day) ». */
export function describePanels(chart: AiChartContext): string {
  return (chart.workspace?.panels() ?? []).map((p) => `${p.index + 1} : ${p.symbol ?? "sans symbole"}${p.timeframe ? ` (${p.timeframe})` : ""}`).join(" ; ");
}

/** The tools, filtered to what this chart can actually do. A lever the host did not wire up is not
 *  offered at all — a model told it may change the timeframe, that then fails every time, spends
 *  the user's turn learning what the schema could have said up front. */
/** Définitions seules (nom, description, paramètres) de tous les outils de l'assistant. */
export const CHART_AI_TOOL_DEFINITIONS: AiToolDefinition[] = AI_TOOLS.map((t) => t.definition);

export function availableAiTools(chart: AiChartContext): AiTool[] {
  return AI_TOOLS.filter((tool) => {
    const comparison = comparisonToolAvailable(tool.definition.name, chart);
    if (comparison !== undefined) return comparison;
    if (tool.definition.name === "changer_l_unite_de_temps") return chart.setTimeframe !== undefined && chart.availableTimeframes.length > 0;
    if (tool.definition.name === "changer_de_symbole") return chart.setSymbol !== undefined;
    if (tool.definition.name === "lire_les_donnees_fondamentales") return (chart.fundamentals?.length ?? 0) > 0;
    if (tool.definition.name === "lancer_le_replay" || tool.definition.name === "quitter_le_replay") return chart.startReplay !== undefined;
    if (tool.definition.name === "regler_le_filigrane") return chart.setWatermark !== undefined && chart.symbol !== undefined;
    if (tool.definition.name === "ouvrir_un_script") return chart.openScript !== undefined;
    return true;
  }).map((tool) => (tool.definitionFor ? { ...tool, definition: tool.definitionFor(chart) } : tool));
}

/** Runs one tool call, never throwing: a tool that fails has to come back as a *result* the model
 *  can read and work around, not as an exception that ends the turn. */
export async function runAiTool(name: string, input: Record<string, unknown>, chart: AiChartContext): Promise<AiToolOutcome> {
  const tool = AI_TOOLS.find((t) => t.definition.name === name);
  if (!tool) return { content: `Outil inconnu : ${name}.`, isError: true };
  try {
    return await tool.run(input, chart);
  } catch (err) {
    return { content: `L'outil « ${name} » a échoué : ${err instanceof Error ? err.message : String(err)}`, isError: true };
  }
}

/** Kept so the catalogue's own `indicatorCatalogEntry` stays the one way an indicator's metadata is
 *  read, here as everywhere else. */
export { indicatorCatalogEntry };
