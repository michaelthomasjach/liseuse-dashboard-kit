import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "../../../../primitives/Button";
import { CodeBlock } from "../../../../primitives/CodeBlock";
import { Input } from "../../../../forms/Input";
import { Spinner } from "../../../../feedback/Spinner";
import { SearchIcon } from "../../../../icons";
import { searchScriptDocs, type ScriptDocsExcerpt, type ScriptDocsSearchResult } from "../docsSearch/scriptDocsSearch";
import { checkScriptDocsAnswer, type AskScriptDocs, type CheckedScriptDocsAnswer, type ScriptDocsVerdict } from "../docsSearch/scriptDocsAnswer";
import "./ScriptDocsAsk.css";

export interface ScriptDocsAskProps {
  /** L'IA de l'application. Absente, la question passe seulement par la recherche locale, et les
   *  passages trouvés s'affichent (avec `aiNotice`, pour dire pourquoi). */
  onAskDocs?: AskScriptDocs;
  /** Pourquoi il n'y a pas de réponse de l'IA, quand `onAskDocs` est absent (« Réponse de l'IA non
   *  incluse dans votre offre »). */
  aiNotice?: ReactNode;
  /** Va à un passage de la documentation : reçoit son ancre (`ScriptDocsExcerpt.id`). Absent, les
   *  passages s'affichent sans lien. */
  onNavigate?: (anchorId: string) => void;
  /** Questions proposées avant la première question (un clic les pose). */
  suggestions?: string[];
  defaultQuestion?: string;
  className?: string;
}

const VERDICT_LABEL: Record<ScriptDocsVerdict, string> = {
  existe: "Existe",
  partiel: "Partiellement",
  absent: "N'existe pas",
};

const DEFAULT_SUGGESTIONS = ["Peut-on utiliser plusieurs unités de temps ?", "Comment mémoriser une valeur d'une bougie à l'autre ?"];

/** La première phrase d'un passage, pour la liste des résultats. */
function firstSentence(text: string): string {
  const line = text.split("\n")[0] ?? "";
  const stop = line.search(/[.!?](\s|$)/);
  const sentence = stop > 0 ? line.slice(0, stop + 1) : line;
  return sentence.length > 180 ? `${sentence.slice(0, 177).trim()}…` : sentence;
}

/** « Demander à la documentation » : une question en français, une réponse qui dit si la
 *  fonctionnalité existe, avec les fonctions documentées et des liens vers leurs sections.
 *
 *  La recherche locale (`searchScriptDocs`) passe toujours en premier et s'affiche seule sans IA ;
 *  avec `onAskDocs`, l'IA ne reçoit que les passages trouvés, et sa réponse est vérifiée contre eux
 *  (`checkScriptDocsAnswer`) avant de s'afficher : une fonction qui n'est pas dans la documentation
 *  ne peut pas apparaître comme un lien, ni dans l'exemple. */
export function ScriptDocsAsk({ onAskDocs, aiNotice, onNavigate, suggestions = DEFAULT_SUGGESTIONS, defaultQuestion = "", className }: ScriptDocsAskProps) {
  const [question, setQuestion] = useState(defaultQuestion);
  const [result, setResult] = useState<ScriptDocsSearchResult | null>(null);
  const [answer, setAnswer] = useState<CheckedScriptDocsAnswer | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function ask(raw: string) {
    const q = raw.trim();
    if (!q) return;
    abortRef.current?.abort();
    const found = searchScriptDocs(q);
    setResult(found);
    setAnswer(null);
    setError(null);
    // Rien trouvé : la réponse est déjà connue, inutile de dépenser une demande à l'IA.
    if (!onAskDocs || found.excerpts.length === 0) {
      setPending(false);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setPending(true);
    try {
      const raw = await onAskDocs(q, found.excerpts, { unknownNames: found.unknownNames, signal: controller.signal });
      if (controller.signal.aborted) return;
      setAnswer(checkScriptDocsAnswer(raw, found.excerpts));
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error && err.message ? err.message : "erreur inconnue");
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void ask(question);
  }

  const link = (excerpt: ScriptDocsExcerpt, label: ReactNode) =>
    onNavigate ? (
      <button type="button" className="lq-script-docs-ask__link" onClick={() => onNavigate(excerpt.id)} title={`Aller à « ${excerpt.title} »`}>
        {label}
      </button>
    ) : (
      <span className="lq-script-docs-ask__link lq-script-docs-ask__link--static">{label}</span>
    );

  const functions = answer?.references.filter((r) => r.signature) ?? [];
  const others = answer?.references.filter((r) => !r.signature) ?? [];

  return (
    <section className={["lq-script-docs-ask", className].filter(Boolean).join(" ")} aria-label="Demander à la documentation">
      <div className="lq-script-docs-ask__head">
        <span className="lq-script-docs-ask__title">Demander à la documentation</span>
        <span className="lq-script-docs-ask__hint">
          {onAskDocs ? "Une question en français : la réponse dit si la fonctionnalité existe et cite les fonctions documentées." : "Une question en français : les passages de la documentation qui y répondent."}
        </span>
      </div>
      <form className="lq-script-docs-ask__form" onSubmit={onSubmit}>
        <Input
          containerClassName="lq-script-docs-ask__input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex. : peut-on utiliser plusieurs unités de temps ?"
          aria-label="Question sur la documentation"
          leadingIcon={<SearchIcon size={14} />}
          maxLength={400}
        />
        <Button type="submit" tone="primary" loading={pending} loadingLabel="Réponse en cours" disabled={!question.trim()}>
          Demander
        </Button>
      </form>

      {!result && suggestions.length > 0 && (
        <div className="lq-script-docs-ask__suggestions">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="lq-script-docs-ask__suggestion"
              onClick={() => {
                setQuestion(s);
                void ask(s);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="lq-script-docs-ask__result" aria-live="polite">
          {pending && (
            <p className="lq-script-docs-ask__status">
              <Spinner size={14} label="Réponse en cours" /> L'IA lit les passages trouvés…
            </p>
          )}

          {answer && (
            <div className={`lq-script-docs-ask__answer lq-script-docs-ask__answer--${answer.verdict}`}>
              <span className={`lq-script-docs-ask__verdict lq-script-docs-ask__verdict--${answer.verdict}`}>{VERDICT_LABEL[answer.verdict]}</span>
              <p className="lq-script-docs-ask__explanation">{answer.explanation}</p>
              {/* Un nom déjà signalé depuis la question (plus bas) ne l'est pas deux fois. */}
              {answer.warnings.filter((w) => !result.unknownNames.some((u) => w.includes(`« ${u.name} »`))).map((w) => (
                <p key={w} className="lq-script-docs-ask__warning">
                  {w}
                </p>
              ))}
              {functions.length > 0 && (
                <>
                  <div className="lq-script-docs-ask__label">Fonctions concernées</div>
                  <ul className="lq-script-docs-ask__functions">
                    {functions.map((r) => (
                      <li key={r.id}>
                        {link(r, <code>{r.signature}</code>)}
                        <span className="lq-script-docs-ask__section">{r.sectionTitle}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {others.length > 0 && (
                <>
                  <div className="lq-script-docs-ask__label">Voir aussi</div>
                  <ul className="lq-script-docs-ask__functions">
                    {others.map((r) => (
                      <li key={r.id}>
                        {link(r, r.title)}
                        <span className="lq-script-docs-ask__section">{r.sectionTitle}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {answer.example && (
                <>
                  <div className="lq-script-docs-ask__label">Exemple tiré de la documentation</div>
                  <CodeBlock code={answer.example} language="JavaScript" highlight="javascript" className="lq-script-docs-ask__code" />
                </>
              )}
              <p className="lq-script-docs-ask__footnote">Réponse rédigée par l'IA à partir des seuls passages de la documentation listés ci-dessous.</p>
            </div>
          )}

          {error && <p className="lq-script-docs-ask__error">L'IA n'a pas pu répondre : {error} Voici les passages trouvés par la recherche.</p>}
          {!onAskDocs && aiNotice && result.excerpts.length > 0 && <p className="lq-script-docs-ask__status">{aiNotice}</p>}

          {result.unknownNames.map((u) => (
            <p key={u.name} className="lq-script-docs-ask__warning">
              « {u.name} » : pas trouvé dans la documentation.
              {u.suggestions.length > 0 && ` Noms proches qui existent : ${u.suggestions.join(", ")}.`}
            </p>
          ))}

          {result.excerpts.length === 0 ? (
            <p className="lq-script-docs-ask__empty">
              Pas trouvé dans la documentation. Essayez d'autres mots (le nom d'une fonction, « unité de temps », « alerte »…), ou parcourez le sommaire.
            </p>
          ) : (
            <div className="lq-script-docs-ask__found">
              <div className="lq-script-docs-ask__label">{answer || pending ? "Passages lus par l'IA" : "Passages trouvés dans la documentation"}</div>
              <ul>
                {result.excerpts.map((e) => (
                  <li key={e.id}>
                    {link(e, e.signature ? <code>{e.signature}</code> : e.title)}
                    <span className="lq-script-docs-ask__section">{e.sectionTitle}</span>
                    {e.text && <p className="lq-script-docs-ask__snippet">{firstSentence(e.text)}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
