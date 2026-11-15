/** Recherche locale dans la documentation du scripting : la première moitié de « Demander à la
 *  documentation ».
 *
 *  L'index est construit depuis la référence elle-même (`SCRIPT_API_REFERENCE`, un passage par
 *  sous-titre, donc une fonction par passage) et depuis les exemples exécutables. Rien n'est écrit à
 *  la main ici : une fonction ajoutée à la référence est trouvable sans toucher à ce fichier.
 *
 *  La recherche ne dépend d'aucune IA. Elle sert seule quand l'application n'en branche pas (ou que
 *  l'offre de l'utilisateur ne l'inclut pas), et elle choisit les seuls extraits que l'IA reçoit
 *  sinon : le modèle répond à partir de ces passages, jamais de sa mémoire. */
import { SCRIPT_API_REFERENCE, type ScriptReferenceBlock, type ScriptReferenceSection } from "../scriptApiReference";
import { SCRIPT_API_COMPLETIONS } from "../scriptApiCompletions";
import { SCRIPT_EXAMPLES } from "../scriptExamples";
import { headingAnchorId } from "../scriptDocsNav";

/** Un passage de la documentation : une section (son introduction), un sous-titre ou un exemple. */
export interface ScriptDocsEntry {
  /** L'ancre du passage dans la documentation (identifiant DOM du titre ou de la section). */
  id: string;
  sectionId: string;
  sectionTitle: string;
  /** Le sous-titre (la signature, pour une fonction), ou le titre de la section. */
  title: string;
  /** La signature telle qu'elle est documentée (`market.resample(interval)`), pour une fonction. */
  signature: string | null;
  kind: "function" | "topic" | "section" | "example";
  /** Les mots-clés que ce passage explique en premier (`market.resample`). */
  keywords: string[];
  /** Le texte du passage : prose et listes. */
  text: string;
  /** Les blocs de code du passage, tels qu'écrits dans la documentation. */
  code: string[];
}

/** Un passage retenu pour une question : ce qu'on affiche, et tout ce que l'IA a le droit de lire. */
export interface ScriptDocsExcerpt {
  id: string;
  sectionId: string;
  sectionTitle: string;
  title: string;
  signature: string | null;
  kind: ScriptDocsEntry["kind"];
  /** Le texte du passage, raccourci. */
  text: string;
  /** Le premier exemple de code du passage, tel qu'écrit dans la documentation. */
  code: string | null;
  score: number;
}

/** Un nom écrit dans la question qui ressemble à une fonction de l'API mais n'est pas documenté. */
export interface ScriptDocsUnknownName {
  name: string;
  /** Les fonctions documentées les plus proches (même famille, ou même nom dans une autre). */
  suggestions: string[];
}

export interface ScriptDocsSearchResult {
  question: string;
  excerpts: ScriptDocsExcerpt[];
  unknownNames: ScriptDocsUnknownName[];
}

// ---------------------------------------------------------------------------------------------
// Construction de l'index
// ---------------------------------------------------------------------------------------------

const SIGNATURE = /^[@a-zA-Z_][\w.]*\s*\(/;

function blockText(block: ScriptReferenceBlock): string {
  return [block.text, ...(block.items ?? [])].filter(Boolean).join("\n");
}

function sectionEntries(section: ScriptReferenceSection): ScriptDocsEntry[] {
  const entries: ScriptDocsEntry[] = [];
  let current: ScriptDocsEntry = {
    id: `lq-script-docs-${section.id}`,
    sectionId: section.id,
    sectionTitle: section.title,
    title: section.title,
    signature: null,
    kind: "section",
    keywords: [],
    text: "",
    code: [],
  };
  entries.push(current);
  for (const block of section.blocks) {
    if (block.kind === "heading" && block.text) {
      const heading = block.text.trim();
      const isCall = SIGNATURE.test(heading) || /^[a-z]+\.[a-zA-Z_]\w*$/.test(heading);
      current = {
        id: headingAnchorId(section.id, heading),
        sectionId: section.id,
        sectionTitle: section.title,
        title: heading,
        signature: isCall ? heading : null,
        kind: isCall ? "function" : "topic",
        keywords: block.keywords ?? [],
        text: "",
        code: [],
      };
      entries.push(current);
      continue;
    }
    if (block.kind === "code" && block.code) current.code.push(block.code);
    else if (block.kind === "text" || block.kind === "list") {
      const text = blockText(block);
      if (text) current.text += (current.text ? "\n" : "") + text;
    }
  }
  return entries.filter((e) => e.text.trim() !== "" || e.code.length > 0 || e.kind !== "section");
}

function exampleEntries(): ScriptDocsEntry[] {
  const section = SCRIPT_API_REFERENCE.find((s) => s.id === "examples");
  return SCRIPT_EXAMPLES.map((example) => ({
    id: headingAnchorId("examples", example.title),
    sectionId: "examples",
    sectionTitle: section?.title ?? "Exemples",
    title: example.title,
    signature: null,
    kind: "example" as const,
    keywords: [],
    text: example.description,
    code: [example.code],
  }));
}

let cachedEntries: ScriptDocsEntry[] | null = null;

/** Tous les passages de la documentation, dans l'ordre de lecture (calculés une fois). */
export function scriptDocsEntries(): ScriptDocsEntry[] {
  if (cachedEntries) return cachedEntries;
  const entries: ScriptDocsEntry[] = [];
  for (const section of SCRIPT_API_REFERENCE) {
    // L'index des mots-clés n'a pas de texte propre ; les exemples ont le leur, plus bas.
    if (section.id === "keywords" || section.id === "examples") continue;
    entries.push(...sectionEntries(section));
  }
  entries.push(...exampleEntries());
  cachedEntries = entries;
  return entries;
}

// ---------------------------------------------------------------------------------------------
// Mots : normalisation, synonymes français / anglais
// ---------------------------------------------------------------------------------------------

export const foldText = (value: string): string => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Expressions de plusieurs mots ramenées à un seul, avant le découpage (texte déjà sans accents). */
const PHRASES: [RegExp, string][] = [
  [/\bmulti[- ]?(?:timeframes?|time[- ]frames?|unites?(?: de temps)?|intervalles?|tf)\b/g, " timeframe "],
  [/\bunites? de temps\b/g, " timeframe "],
  [/\btime[- ]frames?\b/g, " timeframe "],
  [/\bmoyennes? mobiles?\b/g, " movingaverage "],
  [/\bmoving averages?\b/g, " movingaverage "],
  // L'apostrophe est déjà devenue une espace : « carnet d ordres ».
  [/\bcarnets? d[' ]?ordres?\b/g, " orderbook "],
  [/\border ?books?\b/g, " orderbook "],
  [/\bflux d[' ]?ordres?\b/g, " orderflow orderbook "],
  [/\border ?flows?\b/g, " orderflow orderbook "],
  [/\btime (?:and|&) sales\b/g, " orderflow "],
  [/\bplus haut\b/g, " high "],
  [/\bplus bas\b/g, " low "],
  [/\bheikin[- ]?ashi\b/g, " heikinashi "],
];

/** Mots vides : ils ne disent rien de ce qu'on cherche. */
const STOPWORDS = new Set(
  (
    "le la les l un une des de du d au aux a et ou en dans sur sous par pour avec sans pas ne n y est sont etre ce cet cette ces " +
    "que qu qui quoi quel quelle quels quelles comment pourquoi quand peut peux pouvons pouvez peuvent pourrait possible possibilite " +
    "on il ils elle elles je j tu nous vous me m mon ma mes ton ta tes son sa ses leur leurs se s t c ca cela ceci celui celle " +
    "existe exister existent existant faire fait fonction fonctions fonctionnalite fonctionnalites si oui non bien aussi tout tous " +
    "toute toutes tres deja encore alors donc mais car via entre chaque meme dire savoir voir veux voudrais aimerais souhaite " +
    "plusieurs multiple multiples multi requeter requete requetes interroger utiliser utilise script scripts " +
    "the an is are be can could i we you it to of in on for with how do does there any use using query function functions feature"
  ).split(" "),
);

/** Synonymes : chaque mot de la liste ajoute aussi le premier (forme commune aux deux langues). */
const SYNONYM_GROUPS: string[][] = [
  ["timeframe", "tf", "mtf", "intervalle", "interval", "resample", "reechantillonner", "reechantillonnage", "agreger", "agregation", "agrege", "agregee", "hebdomadaire", "journalier", "horaire", "daily", "weekly", "hourly"],
  ["indicator", "indicateur"],
  ["strategy", "strategie", "backtest", "backtester"],
  ["position", "ordre", "order", "trade", "achat", "vente", "acheter", "vendre", "buy", "sell", "entree", "sortie", "entry", "exit"],
  ["plot", "tracer", "dessiner", "afficher", "courbe", "draw", "display", "trace"],
  ["alert", "alerte", "notification", "notifier", "prevenir"],
  ["state", "etat", "memoriser", "memoire", "persister", "persistant"],
  ["price", "prix", "cours", "cotation"],
  ["close", "cloture", "fermeture"],
  ["open", "ouverture"],
  ["high", "haut", "sommet"],
  ["low", "bas", "creux"],
  ["symbol", "symbole", "ticker", "instrument", "actif"],
  ["report", "rapport", "pdf"],
  ["ai", "ia", "llm", "gpt", "claude"],
  ["company", "entreprise", "societe", "fondamentaux", "fondamental", "fundamentals", "fundamental"],
  ["param", "parametre", "input", "reglage"],
  ["color", "couleur"],
  ["movingaverage", "sma", "ema", "wma", "hma", "moyenne"],
  ["ema", "exponentielle", "exponential", "exponentiel"],
  ["orderbook", "carnet", "book", "profondeur", "depth"],
  ["orderflow", "tape", "transaction", "execution", "print", "delta", "iceberg"],
  ["network", "reseau", "http", "https", "internet", "web", "url", "fetch", "websocket", "xmlhttprequest"],
  ["bar", "bougie", "chandelle", "candle", "barre", "chandelier"],
  ["time", "date", "heure", "horodatage", "timestamp"],
  ["volume"],
  ["signal"],
];

const SYNONYMS = new Map<string, string>();
for (const group of SYNONYM_GROUPS) for (const word of group) if (!SYNONYMS.has(word)) SYNONYMS.set(word, group[0]);

/** Pluriels français et anglais, sans plus : assez pour « timeframes » ou « signaux ». */
function stem(word: string): string {
  if (word.includes(".") || word.length <= 3) return word;
  if (word.endsWith("aux") && word.length > 4) return `${word.slice(0, -3)}al`;
  if ((word.endsWith("s") || word.endsWith("x")) && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

interface Term {
  term: string;
  /** Poids du mot dans la question : 1 pour un mot écrit, moins pour un synonyme ajouté. */
  weight: number;
}

/** Les mots d'un texte, chacun avec ses synonymes. `identifiers` garde aussi les noms pointés entiers
 *  (`market.resample`), qui comptent le plus. */
function terms(raw: string): Term[] {
  const out: Term[] = [];
  const push = (word: string, weight: number) => {
    if (STOPWORDS.has(word)) return;
    const w = stem(word);
    if (!w || w.length < 2 || STOPWORDS.has(w)) return;
    out.push({ term: w, weight });
    const syn = SYNONYMS.get(w);
    if (syn && syn !== w) out.push({ term: syn, weight: weight * 0.7 });
  };
  // Les bosses d'un nom en camelCase (`availableTimeframes` → available, timeframes), lues avant
  // la mise en minuscules qui les effacerait.
  for (const match of raw.matchAll(/[A-Za-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+/g)) {
    for (const part of match[0].split(/(?=[A-Z])/)) push(foldText(part), 0.8);
  }
  let folded = foldText(raw).replace(/[’']/g, " ");
  for (const [pattern, replacement] of PHRASES) folded = folded.replace(pattern, replacement);
  for (const match of folded.matchAll(/[a-z0-9_@]+(?:\.[a-z0-9_]+)*/g)) {
    const word = match[0];
    if (word.includes(".")) {
      out.push({ term: word, weight: 1.5 });
      for (const part of word.split(".")) push(part, 1);
    } else push(word, 1);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Index et score
// ---------------------------------------------------------------------------------------------

interface IndexedEntry {
  entry: ScriptDocsEntry;
  title: Set<string>;
  keywords: Set<string>;
  text: Map<string, number>;
  code: Set<string>;
}

interface Index {
  entries: IndexedEntry[];
  /** Nombre de passages qui contiennent chaque mot (pour l'IDF). */
  df: Map<string, number>;
  /** Les noms documentés (`market.resample`), en minuscules → forme écrite. */
  known: Map<string, string>;
  namespaces: Set<string>;
}

let cachedIndex: Index | null = null;

function buildIndex(): Index {
  if (cachedIndex) return cachedIndex;
  const df = new Map<string, number>();
  const entries = scriptDocsEntries().map((entry) => {
    const title = new Set(terms(`${entry.title} ${entry.kind === "section" ? "" : entry.sectionTitle}`).map((t) => t.term));
    const keywords = new Set(entry.keywords.flatMap((k) => [foldText(k), ...terms(k).map((t) => t.term)]));
    const text = new Map<string, number>();
    for (const t of terms(entry.text)) text.set(t.term, (text.get(t.term) ?? 0) + 1);
    const code = new Set(entry.code.flatMap((c) => terms(c).map((t) => t.term)));
    const all = new Set([...title, ...keywords, ...text.keys(), ...code]);
    for (const term of all) df.set(term, (df.get(term) ?? 0) + 1);
    return { entry, title, keywords, text, code };
  });
  const known = new Map<string, string>();
  const addKnown = (name: string) => {
    const clean = name.replace(/^\./, "").replace(/\(.*$/, "").trim();
    if (/^[@a-zA-Z_][\w]*(\.[a-zA-Z_]\w*)+$/.test(clean)) known.set(clean.toLowerCase(), clean);
  };
  for (const c of SCRIPT_API_COMPLETIONS) addKnown(c.label);
  for (const e of entries) {
    for (const k of e.entry.keywords) addKnown(k);
    if (e.entry.signature) addKnown(e.entry.signature);
  }
  const namespaces = new Set([...known.keys()].map((k) => k.split(".")[0]));
  cachedIndex = { entries, df, known, namespaces };
  return cachedIndex;
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Les noms de la question qui ressemblent à une fonction de l'API (`market.foo`) sans être
 *  documentés, avec les fonctions documentées les plus proches. */
export function unknownScriptNames(question: string): ScriptDocsUnknownName[] {
  const index = buildIndex();
  const seen = new Set<string>();
  const out: ScriptDocsUnknownName[] = [];
  for (const match of question.matchAll(/\b([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)(?:\.[a-zA-Z_]\w*)*/g)) {
    const name = match[0];
    const lower = name.toLowerCase();
    const namespace = match[1].toLowerCase();
    if (!index.namespaces.has(namespace) || index.known.has(lower) || seen.has(lower)) continue;
    seen.add(lower);
    const method = lower.slice(namespace.length + 1);
    const candidates = [...index.known.entries()]
      .map(([key, written]) => {
        const sameName = key.split(".").slice(1).join(".") === method;
        const sameNamespace = key.startsWith(`${namespace}.`);
        const distance = levenshtein(method, key.split(".").slice(1).join("."));
        return { written, rank: sameName ? -1 : sameNamespace ? distance : distance + 4 };
      })
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 3)
      .map((c) => c.written);
    out.push({ name, suggestions: candidates });
  }
  return out;
}

function shorten(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("\n"));
  return `${(lastStop > max * 0.6 ? cut.slice(0, lastStop + 1) : cut).trim()} …`;
}

export interface ScriptDocsSearchOptions {
  /** Nombre de passages au plus (6 par défaut). */
  limit?: number;
}

/** Les passages de la documentation qui répondent le mieux à une question, du plus pertinent au
 *  moins pertinent, et les noms de fonctions de la question qui n'existent pas.
 *
 *  Le score est un BM25 simplifié : chaque mot compte selon sa rareté dans la documentation, plus
 *  dans un titre ou un mot-clé que dans le corps du texte, et un nom de fonction écrit en entier
 *  dans la question l'emporte sur tout le reste. */
export function searchScriptDocs(question: string, options: ScriptDocsSearchOptions = {}): ScriptDocsSearchResult {
  const limit = options.limit ?? 6;
  const index = buildIndex();
  const unknownNames = unknownScriptNames(question);
  // Un mot écrit deux fois ne compte qu'une fois, avec son poids le plus fort.
  const queryTerms = new Map<string, number>();
  for (const t of terms(question)) queryTerms.set(t.term, Math.max(queryTerms.get(t.term) ?? 0, t.weight));
  // Un nom inconnu (`market.foo`) n'apporte que sa famille (`market`), pas une fausse piste.
  for (const unknown of unknownNames) queryTerms.delete(unknown.name.toLowerCase());
  if (queryTerms.size === 0) return { question, excerpts: [], unknownNames };

  const n = index.entries.length;
  const scored = index.entries.map((item) => {
    let score = 0;
    let matched = 0;
    for (const [term, weight] of queryTerms) {
      const df = index.df.get(term) ?? 0;
      if (df === 0) continue;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      const tf = item.text.get(term) ?? 0;
      const field =
        (item.title.has(term) ? 5 : 0) +
        (item.keywords.has(term) ? 4 : 0) +
        (tf > 0 ? (2.2 * tf) / (tf + 1.2) : 0) +
        (item.code.has(term) ? 0.8 : 0);
      if (field === 0) continue;
      matched += weight;
      score += weight * idf * field;
      // Le nom complet d'une fonction, écrit dans la question : c'est elle qu'on cherche.
      if (term.includes(".") && (item.keywords.has(term) || item.title.has(term))) score += 40;
    }
    const totalWeight = [...queryTerms.values()].reduce((a, b) => a + b, 0);
    // Un passage qui couvre plus de mots de la question passe devant un passage qui en répète un seul.
    score *= Math.sqrt(matched / totalWeight);
    if (item.entry.kind === "section") score *= 0.75;
    if (item.entry.kind === "example") score *= 0.6;
    return { item, score };
  });

  const ranked = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score ?? 0;
  // Trop loin derrière le premier, un passage n'est plus une réponse, seulement un mot en commun.
  const kept = ranked.filter((s) => s.score >= Math.max(1.5, top * 0.22)).slice(0, limit);
  return {
    question,
    unknownNames,
    excerpts: kept.map(({ item, score }) => ({
      id: item.entry.id,
      sectionId: item.entry.sectionId,
      sectionTitle: item.entry.sectionTitle,
      title: item.entry.title,
      signature: item.entry.signature,
      kind: item.entry.kind,
      text: shorten(item.entry.text, item.entry.kind === "function" ? 1400 : 800),
      code: item.entry.code[0] ? shorten(item.entry.code[0], 900) : null,
      score: Math.round(score * 10) / 10,
    })),
  };
}

/** Les passages de la documentation sous forme de texte, pour un modèle (outil de l'assistant). */
export function formatScriptDocsExcerpts(result: ScriptDocsSearchResult): string {
  const parts: string[] = [];
  for (const unknown of result.unknownNames) {
    parts.push(
      `« ${unknown.name} » n'existe pas dans la documentation.${unknown.suggestions.length ? ` Les plus proches : ${unknown.suggestions.join(", ")}.` : ""}`,
    );
  }
  result.excerpts.forEach((e, i) => {
    parts.push(
      [`[${i + 1}] ${e.signature ?? e.title} (section ${e.sectionTitle})`, e.text, e.code ? `Exemple :\n${e.code}` : ""].filter(Boolean).join("\n"),
    );
  });
  if (result.excerpts.length === 0) parts.push("Rien de pertinent dans la documentation pour cette question.");
  return parts.join("\n\n");
}
