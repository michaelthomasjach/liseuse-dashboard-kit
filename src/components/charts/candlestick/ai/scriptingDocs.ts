/** Le manuel du langage de scripting, consultable par l'assistant à la demande (outil
 *  `lire_la_documentation_du_scripting`) : son sommaire, une section, ou les passages qui citent un
 *  terme. Utile quand l'application ne peut pas envoyer les ~170 Ko du manuel à chaque requête (petit
 *  modèle, quota de requêtes, contexte limité) : le modèle va chercher ce dont il a besoin. */

export const SCRIPTING_DOCS_TOOL = "lire_la_documentation_du_scripting";

interface DocSection {
  title: string;
  level: number;
  start: number;
  end: number;
}

const MAX_SECTION = 14_000;
const MAX_SEARCH = 9_000;
const fold = (v: string): string => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Les sections du manuel, d'après ses titres Markdown (#, ##, ###). */
export function docSections(manual: string): DocSection[] {
  const heads: { title: string; level: number; start: number }[] = [];
  const re = /^(#{1,4})\s+(.+)$/gm;
  for (let m = re.exec(manual); m !== null; m = re.exec(manual)) heads.push({ title: (m[2] ?? "").trim(), level: (m[1] ?? "#").length, start: m.index });
  return heads.map((h, i) => {
    // Une section court jusqu'au titre suivant de même niveau ou plus haut (sous-sections comprises).
    const next = heads.slice(i + 1).find((n) => n.level <= h.level);
    return { ...h, end: next ? next.start : manual.length };
  });
}

/** Réponse de l'outil : `section` (un titre ou un morceau de titre), `recherche` (un terme), ou rien (le sommaire). */
export function answerScriptingDocs(manual: string | null, input: Record<string, unknown>): { content: string; isError?: boolean } {
  if (!manual) return { content: "Documentation indisponible pour le moment.", isError: true };
  const sections = docSections(manual);
  const section = typeof input.section === "string" ? input.section.trim() : "";
  const search = typeof input.recherche === "string" ? input.recherche.trim() : "";

  if (section) {
    const want = fold(section);
    const exact = sections.find((s) => fold(s.title) === want);
    const found = exact ?? sections.find((s) => fold(s.title).includes(want));
    if (!found) return { content: `Aucune section « ${section} ». Demandez le sommaire (sans argument) pour la liste des titres.`, isError: true };
    const text = manual.slice(found.start, found.end);
    return { content: text.length > MAX_SECTION ? `${text.slice(0, MAX_SECTION)}\n\n[… section tronquée : demandez une sous-section plus précise]` : text };
  }

  if (search) {
    // Passages qui citent le terme ; sinon ceux qui contiennent le plus de ses mots (« rsi panneau séparé »).
    const want = fold(search);
    const words = [...new Set(want.split(/[^a-z0-9_.@]+/).filter((w) => w.length >= 3))];
    const paragraphs: { text: string; at: number }[] = [];
    let offset = 0;
    for (const p of manual.split(/\n{2,}/)) {
      paragraphs.push({ text: p, at: offset });
      offset += p.length + 2;
    }
    const scored = paragraphs
      .map((p) => {
        const f = fold(p.text);
        const score = f.includes(want) ? 1000 : words.filter((w) => f.includes(w)).length;
        return { ...p, score };
      })
      .filter((p) => p.score > 0 && (p.score >= 1000 || words.length <= 1 || p.score >= Math.min(2, words.length)))
      .sort((a, b) => b.score - a.score || a.at - b.at);
    const hits: string[] = [];
    let size = 0;
    for (const p of scored) {
      const where = [...sections].reverse().find((s) => s.start <= p.at);
      const chunk = `[${where?.title ?? "Manuel"}]\n${p.text}`;
      if (size + chunk.length > MAX_SEARCH) break;
      hits.push(chunk);
      size += chunk.length;
    }
    return hits.length
      ? { content: hits.join("\n\n") }
      : { content: `Rien sur « ${search} » dans la documentation. Demandez le sommaire (sans argument) ou une section par son titre.`, isError: true };
  }

  // Sommaire : les règles du début (avant le premier titre), puis les titres, indentés.
  const intro = manual.slice(0, sections[0]?.start ?? 0).trim().slice(0, 3_000);
  const toc = sections.filter((s) => s.level <= 3).map((s) => `${"  ".repeat(s.level - 1)}- ${s.title}`).join("\n");
  return { content: `${intro}\n\nSommaire (demandez une section par son titre, ou un terme avec « recherche ») :\n${toc}` };
}

/**
 * Le code d'un script dans une réponse écrite : le premier bloc ``` … ``` qui commence par une directive du langage
 * (@indicator, @strategy, @quant, @report). Sert à ne jamais perdre un script que le modèle a écrit dans sa réponse au
 * lieu de l'enregistrer avec `ecrire_un_script`.
 */
export function scriptInAnswer(text: string): { code: string; name: string } | null {
  const re = /```[a-zA-Z]*\n([\s\S]*?)```/g;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const code = (m[1] ?? "").trim();
    const first = code.split("\n").find((l) => l.trim() && !l.trim().startsWith("//"))?.trim() ?? "";
    if (!/^@(indicator|strategy|quant|report)\b/.test(first)) continue;
    const description = /@description\s+"([^"\n]{3,60})/.exec(code)?.[1]?.replace(/[/#*]+/g, "").trim();
    return { code, name: description || "Script de l'assistant" };
  }
  return null;
}
