import type { MouseEvent, ReactNode } from "react";
import type { IndicatorKind } from "../interfaces/IndicatorKind.interface";
import { INDICATOR_HELP_KINDS, indicatorHelpPage } from "../indicatorHelp";
import { INDICATOR_CATALOG } from "../indicatorCatalog";
import { INDICATOR_DIAGRAMS } from "../diagrams/indicatorDiagramRegistry";
import { CodeBlock } from "../../../primitives/CodeBlock";
import { InfoText } from "./InfoText";
import "./IndicatorHelpArticle.css";

export interface IndicatorHelpArticleProps {
  /** L'indicateur intégré documenté (`IndicatorKind`) ; un identifiant inconnu affiche un message. */
  kind: string;
  /** Lien vers la page d'un autre indicateur (« Indicateurs proches ») : rendu en vrai lien `<a>`,
   *  pour qu'un site puisse l'ouvrir dans un nouvel onglet. */
  hrefFor?: (kind: IndicatorKind) => string;
  /** Clic sur un indicateur proche (sans Ctrl / Cmd) : navigation décidée par l'appelant. Sans
   *  `hrefFor`, les indicateurs proches sont des boutons qui n'appellent que ceci. */
  onOpenIndicator?: (kind: IndicatorKind) => void;
  /** Titre de l'indicateur en tête d'article (vrai par défaut ; une fenêtre qui le porte déjà dans
   *  son en-tête le masque). */
  showTitle?: boolean;
  /** Contenu ajouté sous le titre (fil d'Ariane, liens du site). */
  headerExtra?: ReactNode;
  className?: string;
}

/** Sommaire : défile jusqu'à la partie dans l'article lui-même (fenêtre ou page), sans toucher à l'adresse de la page hôte. */
function scrollToPart(e: MouseEvent<HTMLAnchorElement>) {
  const id = e.currentTarget.getAttribute("href")?.slice(1);
  const target = id ? e.currentTarget.closest(".lq-indicator-help")?.querySelector(`#${id}`) : null;
  if (!target) return;
  e.preventDefault();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

const PANE_LABEL = { price: "Superposé au prix", own: "Panneau séparé", attached: "Sur un autre indicateur" } as const;

function RelatedLink({ kind, hrefFor, onOpenIndicator, children }: { kind: IndicatorKind; hrefFor?: (kind: IndicatorKind) => string; onOpenIndicator?: (kind: IndicatorKind) => void; children: ReactNode }) {
  if (hrefFor) {
    const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
      // Ctrl / Cmd / Maj / clic du milieu : le navigateur s'en charge (nouvel onglet).
      if (!onOpenIndicator || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      onOpenIndicator(kind);
    };
    return (
      <a className="lq-indicator-help__related-link" href={hrefFor(kind)} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className="lq-indicator-help__related-link" onClick={() => onOpenIndicator?.(kind)} disabled={!onOpenIndicator}>
      {children}
    </button>
  );
}

/** Page de référence d'un indicateur intégré, à la manière des pages d'aide de TradingView :
 *  définition, formule, réglages avec leurs valeurs par défaut, lecture, limites, script équivalent
 *  et indicateurs proches. Les données viennent de `indicatorHelpPage` (indicatorHelp.ts) ; ce
 *  composant ne fait que les mettre en page, dans une fenêtre du graphique comme sur une page de
 *  site. */
export function IndicatorHelpArticle({ kind, hrefFor, onOpenIndicator, showTitle = true, headerExtra, className }: IndicatorHelpArticleProps) {
  const page = indicatorHelpPage(kind);
  if (!page) {
    return (
      <article className={["lq-indicator-help", className].filter(Boolean).join(" ")}>
        <p className="lq-indicator-help__empty">Aucune page d'aide pour cet indicateur.</p>
      </article>
    );
  }
  const Diagram = INDICATOR_DIAGRAMS[page.kind];
  return (
    <article className={["lq-indicator-help", className].filter(Boolean).join(" ")} aria-labelledby={showTitle ? `lq-indicator-help-${page.kind}` : undefined}>
      {showTitle && (
        <header className="lq-indicator-help__header">
          <h1 id={`lq-indicator-help-${page.kind}`} className="lq-indicator-help__title">
            {page.label}
          </h1>
          <p className="lq-indicator-help__meta">
            {page.category} · {PANE_LABEL[page.pane]} · <code>{page.shortLabel}</code>
          </p>
          {headerExtra}
        </header>
      )}
      {!showTitle && (
        <p className="lq-indicator-help__meta">
          {page.category} · {PANE_LABEL[page.pane]} · <code>{page.shortLabel}</code>
        </p>
      )}

      <nav className="lq-indicator-help__toc" aria-label="Sommaire">
        <a href="#lq-ih-definition" onClick={scrollToPart}>Définition</a>
        <a href="#lq-ih-formule" onClick={scrollToPart}>Formule</a>
        <a href="#lq-ih-parametres" onClick={scrollToPart}>Paramètres</a>
        {page.reading.length > 0 && <a href="#lq-ih-lecture" onClick={scrollToPart}>Lecture et usages</a>}
        {page.limits && <a href="#lq-ih-limites" onClick={scrollToPart}>Limites</a>}
        {page.script && <a href="#lq-ih-script" onClick={scrollToPart}>Script équivalent</a>}
        {page.related.length > 0 && <a href="#lq-ih-proches" onClick={scrollToPart}>Indicateurs proches</a>}
      </nav>

      <section className="lq-indicator-help__section" id="lq-ih-definition">
        <h2 className="lq-indicator-help__h2">Définition</h2>
        {Diagram && (
          <div className="lq-indicator-help__diagram">
            <Diagram />
          </div>
        )}
        <InfoText>{page.definition}</InfoText>
      </section>

      <section className="lq-indicator-help__section" id="lq-ih-formule">
        <h2 className="lq-indicator-help__h2">Formule</h2>
        <ol className="lq-indicator-help__formula">
          {page.formula.map((line) => (
            <li key={line}>
              <code>{line}</code>
            </li>
          ))}
        </ol>
        {page.formulaNotes && <InfoText>{page.formulaNotes}</InfoText>}
      </section>

      <section className="lq-indicator-help__section" id="lq-ih-parametres">
        <h2 className="lq-indicator-help__h2">Paramètres</h2>
        {page.params.length === 0 ? (
          <p className="lq-indicator-help__muted">Aucun paramètre de calcul : seuls la couleur et le style se règlent.</p>
        ) : (
          <div className="lq-indicator-help__table-wrap">
            <table className="lq-indicator-help__table">
              <thead>
                <tr>
                  <th scope="col">Réglage</th>
                  <th scope="col">Par défaut</th>
                  <th scope="col">Rôle</th>
                </tr>
              </thead>
              <tbody>
                {page.params.map((p) => (
                  <tr key={p.label}>
                    <th scope="row">
                      {p.label}
                      {p.tab && <span className="lq-indicator-help__tab">{p.tab}</span>}
                    </th>
                    <td>
                      <strong>{p.defaultValue}</strong>
                      {p.range && <span className="lq-indicator-help__range">{p.range}</span>}
                    </td>
                    <td>{p.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {page.settingsNotes && <InfoText>{page.settingsNotes}</InfoText>}
      </section>

      {page.reading.length > 0 && (
        <section className="lq-indicator-help__section" id="lq-ih-lecture">
          <h2 className="lq-indicator-help__h2">Lecture et usages</h2>
          {page.reading.map((part) => (
            <div key={part.title} className="lq-indicator-help__part">
              <h3 className="lq-indicator-help__h3">{part.title}</h3>
              <InfoText>{part.body}</InfoText>
            </div>
          ))}
        </section>
      )}

      {page.limits && (
        <section className="lq-indicator-help__section" id="lq-ih-limites">
          <h2 className="lq-indicator-help__h2">Limites</h2>
          <InfoText>{page.limits}</InfoText>
        </section>
      )}

      {page.script && (
        <section className="lq-indicator-help__section" id="lq-ih-script">
          <h2 className="lq-indicator-help__h2">Script équivalent</h2>
          <p className="lq-indicator-help__muted">
            Le même calcul écrit avec l'API de scripting du graphique, bougie par bougie : à copier dans l'éditeur de script pour le reprendre et le
            modifier.
          </p>
          <CodeBlock code={page.script} filename={`${page.shortLabel}.js`} highlight="javascript" showLineNumbers />
        </section>
      )}

      {page.related.length > 0 && (
        <section className="lq-indicator-help__section" id="lq-ih-proches">
          <h2 className="lq-indicator-help__h2">Indicateurs proches</h2>
          <ul className="lq-indicator-help__related">
            {page.related.map((k) => (
              <li key={k}>
                <RelatedLink kind={k} hrefFor={hrefFor} onOpenIndicator={onOpenIndicator}>
                  {INDICATOR_CATALOG.find((e) => e.kind === k)?.label ?? k}
                </RelatedLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

export interface IndicatorHelpIndexProps {
  hrefFor?: (kind: IndicatorKind) => string;
  onOpenIndicator?: (kind: IndicatorKind) => void;
  className?: string;
}

/** Liste de toutes les pages d'aide, groupées par catégorie du catalogue, chacune avec la phrase
 *  qui dit ce qu'est l'indicateur. */
export function IndicatorHelpIndex({ hrefFor, onOpenIndicator, className }: IndicatorHelpIndexProps) {
  const groups = new Map<string, IndicatorKind[]>();
  for (const kind of INDICATOR_HELP_KINDS) {
    const category = INDICATOR_CATALOG.find((e) => e.kind === kind)?.category ?? "Autres";
    groups.set(category, [...(groups.get(category) ?? []), kind]);
  }
  return (
    <div className={["lq-indicator-help-index", className].filter(Boolean).join(" ")}>
      {Array.from(groups.entries()).map(([category, kinds]) => (
        <section key={category} className="lq-indicator-help-index__group">
          <h2 className="lq-indicator-help__h2">{category}</h2>
          <ul className="lq-indicator-help-index__list">
            {kinds.map((k) => {
              const page = indicatorHelpPage(k)!;
              // La phrase en gras qui ouvre chaque description : ce qu'est l'indicateur.
              const lede = /^\*\*(.+?)\*\*/.exec(page.definition)?.[1] ?? "";
              return (
                <li key={k}>
                  <RelatedLink kind={k} hrefFor={hrefFor} onOpenIndicator={onOpenIndicator}>
                    {page.label}
                  </RelatedLink>
                  {lede && <span className="lq-indicator-help-index__lede">{lede}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
