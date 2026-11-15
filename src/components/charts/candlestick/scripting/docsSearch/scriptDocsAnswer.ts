/** La seconde moitié de « Demander à la documentation » : la réponse de l'IA, construite sur les
 *  seuls extraits trouvés par la recherche locale (`scriptDocsSearch.ts`), puis vérifiée.
 *
 *  La bibliothèque ne parle à aucune IA d'elle-même : l'application branche la sienne
 *  (`AskScriptDocs`), sur son serveur, avec son quota. Ce fichier donne ce qui doit être pareil
 *  partout : le contrat de la réponse, le prompt, la lecture d'une réponse brute, et surtout la
 *  vérification — une fonction citée qui n'est pas dans les extraits est écartée, un exemple de
 *  code qui n'est pas dans la documentation aussi. Le modèle peut se tromper ; l'écran, non. */
import type { AiSend } from "../../ai/interfaces/AiMessage.interface";
import { answerScriptAiRequest } from "../../ai/answerScriptAiRequest";
import { scriptDocsEntries, unknownScriptNames, type ScriptDocsExcerpt, type ScriptDocsUnknownName } from "./scriptDocsSearch";

/** existe : la documentation décrit de quoi le faire ; partiel : en partie, ou avec une limite
 *  importante ; absent : rien dans la documentation. */
export type ScriptDocsVerdict = "existe" | "partiel" | "absent";

/** Ce que l'IA de l'application renvoie. */
export interface ScriptDocsAnswer {
  verdict: ScriptDocsVerdict;
  /** Deux à quatre phrases, en français. */
  explanation: string;
  /** Les identifiants (`ScriptDocsExcerpt.id`) des extraits sur lesquels la réponse s'appuie. */
  references: string[];
  /** Un petit exemple de code copié de la documentation, ou rien. */
  example?: string | null;
}

/** Branche l'IA de l'application : reçoit la question et les seuls extraits qu'elle a le droit de
 *  lire, renvoie la réponse. Une erreur levée s'affiche telle quelle (« Quota d'IA du jour
 *  atteint… »), et les résultats de la recherche restent à l'écran. */
export type AskScriptDocs = (
  question: string,
  excerpts: ScriptDocsExcerpt[],
  context?: { unknownNames: ScriptDocsUnknownName[]; signal?: AbortSignal },
) => Promise<ScriptDocsAnswer>;

/** La réponse telle qu'elle s'affiche, une fois vérifiée contre les extraits. */
export interface CheckedScriptDocsAnswer {
  verdict: ScriptDocsVerdict;
  explanation: string;
  /** Les extraits cités, dans l'ordre de la réponse (jamais un passage qui n'a pas été fourni). */
  references: ScriptDocsExcerpt[];
  /** Un exemple copié de la documentation, ou null. */
  example: string | null;
  /** Ce que la vérification a relevé : un nom de fonction cité qui n'existe pas. */
  warnings: string[];
}

export const SCRIPT_DOCS_SYSTEM_PROMPT = [
  "Tu es l'assistant de la documentation du langage de scripting d'un graphique boursier. On te donne une question et des extraits numérotés de la documentation officielle.",
  "Tu réponds UNIQUEMENT à partir de ces extraits : n'utilise jamais ce que tu crois savoir d'autres langages (Pine Script, JavaScript, Python…).",
  "Règles :",
  "- verdict « existe » si les extraits décrivent de quoi faire ce qui est demandé ; « partiel » s'ils ne le permettent qu'en partie ou avec une limite importante (dis laquelle) ; « absent » sinon.",
  "- Ne cite jamais une fonction, un paramètre ou une option qui n'apparaît pas mot pour mot dans les extraits, et ne prête pas à une fonction un rôle que son extrait ne décrit pas.",
  "- Si une remarque signale qu'un nom de la question n'existe pas, le verdict est « absent » (sauf si un extrait fait exactement la même chose sous un autre nom), et l'explication le dit d'abord.",
  "- Si les extraits ne répondent pas, l'explication commence par « Pas trouvé dans la documentation. », puis propose l'alternative la plus proche présente dans les extraits, en la citant.",
  "- L'explication est en français, en 2 à 4 phrases, sans titre ni liste.",
  "- « references » : les numéros des extraits sur lesquels tu t'appuies, le plus utile d'abord.",
  "- « exemple » : un petit exemple de code COPIÉ tel quel d'un extrait, ou une chaîne vide. N'écris jamais de code nouveau.",
  'Réponds uniquement par un objet JSON : {"verdict":"existe|partiel|absent","explication":"…","references":[1],"exemple":"…"}',
].join("\n");

/** Le message envoyé au modèle : la question, puis les extraits numérotés. */
export function scriptDocsPrompt(question: string, excerpts: ScriptDocsExcerpt[], unknownNames: ScriptDocsUnknownName[] = []): { system: string; prompt: string } {
  const notes = unknownNames.map(
    (u) => `Remarque : « ${u.name} » n'existe pas dans la documentation${u.suggestions.length ? ` (noms proches qui existent : ${u.suggestions.join(", ")})` : ""}.`,
  );
  const blocks = excerpts.map((e, i) =>
    [`[${i + 1}] ${e.signature ?? e.title} — section ${e.sectionTitle}`, e.text, e.code ? `Exemple :\n${e.code}` : ""].filter(Boolean).join("\n"),
  );
  const prompt = [
    `Question : ${question.trim()}`,
    ...notes,
    excerpts.length ? `Extraits de la documentation :\n\n${blocks.join("\n\n")}` : "Aucun extrait de la documentation ne correspond à cette question.",
  ].join("\n\n");
  return { system: SCRIPT_DOCS_SYSTEM_PROMPT, prompt };
}

function verdictOf(raw: unknown): ScriptDocsVerdict {
  const v = typeof raw === "string" ? raw.toLowerCase() : "";
  if (/^(existe|oui|yes|exists?)/.test(v)) return "existe";
  if (/^(partiel|partiellement|partial|en partie)/.test(v)) return "partiel";
  return "absent";
}

/** Lit la réponse brute d'un modèle (du JSON, parfois entouré de texte ou d'un bloc de code) ;
 *  les références peuvent être des numéros d'extraits (1 = le premier) ou des identifiants.
 *  null si rien de lisible. */
export function parseScriptDocsAnswer(raw: string, excerpts: ScriptDocsExcerpt[]): ScriptDocsAnswer | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const explanation = String(data.explication ?? data.explanation ?? "").trim();
  if (!explanation) return null;
  const rawRefs = Array.isArray(data.references) ? data.references : Array.isArray(data.refs) ? data.refs : [];
  const references = rawRefs.flatMap((r): string[] => {
    const asNumber = typeof r === "number" ? r : typeof r === "string" && /^\[?[eE]?\d+\]?$/.test(r.trim()) ? Number(r.replace(/\D/g, "")) : NaN;
    if (Number.isInteger(asNumber)) {
      const excerpt = excerpts[asNumber - 1];
      return excerpt ? [excerpt.id] : [];
    }
    return typeof r === "string" ? [r] : [];
  });
  const example = typeof (data.exemple ?? data.example) === "string" ? String(data.exemple ?? data.example).trim() : "";
  return { verdict: verdictOf(data.verdict), explanation, references, example: example || null };
}

const squash = (code: string): string => code.replace(/\s+/g, " ").trim();

/** Vérifie une réponse contre les extraits fournis : références hors des extraits écartées, exemple
 *  gardé seulement s'il est copié de la documentation (sinon celui du premier extrait cité), et
 *  noms de fonctions cités qui n'existent pas relevés. */
/** Une explication qui dit qu'une chose n'existe pas. */
const SAYS_MISSING = /n['’]existe pas|pas trouv|inexistant|n['’]est pas (?:dans|document)|aucune? (?:fonction|méthode)/i;

/** La question nomme une fonction qui n'existe pas (`unknownNames`, relevés par la recherche) : le
 *  verdict est « n'existe pas », quoi qu'en dise le modèle ; et une explication qui ne le dit pas
 *  (un petit modèle peut affirmer le contraire) est remplacée par le constat, avec le plus proche. */
export function guardUnknownNames(
  answer: { verdict: ScriptDocsVerdict; explanation: string },
  unknownNames: ScriptDocsUnknownName[],
  closest: string | null,
): { verdict: ScriptDocsVerdict; explanation: string } {
  if (unknownNames.length === 0) return answer;
  if (SAYS_MISSING.test(answer.explanation)) return { verdict: "absent", explanation: answer.explanation };
  const names = unknownNames.map((u) => `« ${u.name} »`).join(", ");
  const near = closest ?? unknownNames[0]?.suggestions[0] ?? null;
  return {
    verdict: "absent",
    explanation: `Pas trouvé dans la documentation : ${names} n'existe pas.${near ? ` Le plus proche dans la documentation : ${near}.` : ""}`,
  };
}

export function checkScriptDocsAnswer(answer: ScriptDocsAnswer, excerpts: ScriptDocsExcerpt[], unknownNames: ScriptDocsUnknownName[] = []): CheckedScriptDocsAnswer {
  const byId = new Map(excerpts.map((e) => [e.id, e]));
  const seen = new Set<string>();
  const references = answer.references.flatMap((id) => {
    const excerpt = byId.get(id);
    if (!excerpt || seen.has(id)) return [];
    seen.add(id);
    return [excerpt];
  });
  // Le code de toute la documentation des passages fournis (l'extrait n'en montre qu'un morceau).
  const entries = new Map(scriptDocsEntries().map((e) => [e.id, e]));
  const documented = excerpts.flatMap((e) => [...(entries.get(e.id)?.code ?? []), e.code ?? ""]).filter(Boolean).map(squash);
  const guarded = guardUnknownNames(answer, unknownNames, references.find((r) => r.signature)?.signature ?? null);
  const proposed = answer.example?.trim() ?? "";
  let example: string | null = proposed && documented.some((code) => code.includes(squash(proposed))) ? proposed : null;
  if (!example && guarded.verdict !== "absent") example = references.find((r) => r.code)?.code ?? null;
  const warnings = unknownScriptNames(guarded.explanation).map(
    (u) => `« ${u.name} » n'est pas dans la documentation${u.suggestions.length ? ` (le plus proche : ${u.suggestions[0]})` : ""}.`,
  );
  return { verdict: guarded.verdict, explanation: guarded.explanation.trim(), references, example, warnings };
}

/** Une `AskScriptDocs` sur un transport d'assistant (`ai.send`, ou `anthropicSend` avec une clé) :
 *  pour une démo ou une application qui n'a pas de route dédiée. */
export function askScriptDocsWithSend(send: AiSend): AskScriptDocs {
  return async (question, excerpts, context) => {
    const { system, prompt } = scriptDocsPrompt(question, excerpts, context?.unknownNames ?? []);
    const raw = await answerScriptAiRequest(send, prompt, { format: "json", system }, [], context?.signal ?? new AbortController().signal);
    const answer = parseScriptDocsAnswer(raw, excerpts);
    if (!answer) throw new Error("La réponse de l'IA est illisible.");
    return answer;
  };
}
