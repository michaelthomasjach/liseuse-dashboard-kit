import type { MouseEvent, ReactNode } from "react";
import type { IndicatorKind } from "../interfaces/IndicatorKind.interface";
import { INDICATOR_HELP_KINDS, indicatorHelpPage, type IndicatorHelpParam } from "../indicatorHelp";
import { ShotImage } from "../diagrams/diagramShot";
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

/** `[[illustration:example-…|Légende]]`, seul sur sa ligne : une capture d'exemple (diagramShots/exampleShots.ts). */
const ILLUSTRATION = /^\[\[illustration:([\w-]+)(?:\|([^\]]*))?\]\]$/;

/** Un texte de description (dialecte d'`InfoText`) dont certaines lignes sont des illustrations. */
function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let buffer: string[] = [];
  const flush = () => {
    const chunk = buffer.join("\n").trim();
    if (chunk) blocks.push(<InfoText key={`t${blocks.length}`}>{chunk}</InfoText>);
    buffer = [];
  };
  for (const line of text.split("\n")) {
    const match = ILLUSTRATION.exec(line.trim());
    if (!match) {
      buffer.push(line);
      continue;
    }
    flush();
    const caption = match[2]?.trim() ?? "";
    blocks.push(
      <figure key={`f${blocks.length}`} className="lq-indicator-help__figure">
        <div className="lq-indicator-help__diagram">
          <ShotImage id={match[1]} alt={caption || "Exemple sur un graphique"} />
        </div>
        {caption && <figcaption className="lq-indicator-help__caption">{caption}</figcaption>}
      </figure>,
    );
  }
  flush();
  return <>{blocks}</>;
}

/** Les réglages d'un onglet, à la manière d'une fiche : le nom en titre, la valeur par défaut et les bornes, puis ce
 *  qu'il change. */
function ParamList({ params }: { params: IndicatorHelpParam[] }) {
  return (
    <div className="lq-indicator-help__params">
      {params.map((p) => (
        <div key={p.label} className="lq-indicator-help__param">
          <h3 className="lq-indicator-help__h3">{p.label}</h3>
          <p className="lq-indicator-help__param-meta">
            Par défaut : <strong>{p.defaultValue}</strong>
            {p.range && <span className="lq-indicator-help__range">{p.range}</span>}
          </p>
          <InfoText>{p.description}</InfoText>
        </div>
      ))}
    </div>
  );
}

const PANE_LABEL ={ price: "Superposé au prix", own: "Panneau séparé", attached: "Sur un autre indicateur" } as const;

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
  const inputParams = page.params.filter((p) => p.tab !== "Style");
  const styleParams = page.params.filter((p) => p.tab === "Style");
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
        {page.history && <a href="#lq-ih-histoire" onClick={scrollToPart}>Histoire</a>}
        <a href="#lq-ih-formule" onClick={scrollToPart}>Calcul</a>
        {page.basics && <a href="#lq-ih-bases" onClick={scrollToPart}>Les bases</a>}
        {page.lookFor && <a href="#lq-ih-rechercher" onClick={scrollToPart}>Ce qu'il faut rechercher</a>}
        {page.reading.length > 0 && <a href="#lq-ih-lecture" onClick={scrollToPart}>Lecture et usages</a>}
        {page.summary && <a href="#lq-ih-resume" onClick={scrollToPart}>Résumé</a>}
        <a href="#lq-ih-parametres" onClick={scrollToPart}>Entrées</a>
        {styleParams.length > 0 && <a href="#lq-ih-style" onClick={scrollToPart}>Style</a>}
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
        <RichText text={page.definition} />
      </section>

      {page.history && (
        <section className="lq-indicator-help__section" id="lq-ih-histoire">
          <h2 className="lq-indicator-help__h2">Histoire</h2>
          <RichText text={page.history} />
        </section>
      )}

      <section className="lq-indicator-help__section" id="lq-ih-formule">
        <h2 className="lq-indicator-help__h2">Calcul</h2>
        <ol className="lq-indicator-help__formula">
          {page.formula.map((line) => (
            <li key={line}>
              <code>{line}</code>
            </li>
          ))}
        </ol>
        {page.formulaNotes && <InfoText>{page.formulaNotes}</InfoText>}
      </section>

      {page.basics && (
        <section className="lq-indicator-help__section" id="lq-ih-bases">
          <h2 className="lq-indicator-help__h2">Les bases</h2>
          <RichText text={page.basics} />
        </section>
      )}

      {page.lookFor && (
        <section className="lq-indicator-help__section" id="lq-ih-rechercher">
          <h2 className="lq-indicator-help__h2">Ce qu'il faut rechercher</h2>
          {page.lookFor.intro && <RichText text={page.lookFor.intro} />}
          {page.lookFor.cases.map((part) => (
            <div key={part.title} className="lq-indicator-help__part">
              <h3 className="lq-indicator-help__h3">{part.title}</h3>
              <RichText text={part.body} />
            </div>
          ))}
        </section>
      )}

      {page.reading.length > 0 && (
        <section className="lq-indicator-help__section" id="lq-ih-lecture">
          <h2 className="lq-indicator-help__h2">Lecture et usages</h2>
          {page.reading.map((part) => (
            <div key={part.title} className="lq-indicator-help__part">
              <h3 className="lq-indicator-help__h3">{part.title}</h3>
              <RichText text={part.body} />
            </div>
          ))}
        </section>
      )}

      {page.summary && (
        <section className="lq-indicator-help__section" id="lq-ih-resume">
          <h2 className="lq-indicator-help__h2">Résumé</h2>
          <RichText text={page.summary} />
        </section>
      )}

      <section className="lq-indicator-help__section" id="lq-ih-parametres">
        <h2 className="lq-indicator-help__h2">Entrées</h2>
        {inputParams.length === 0 ? (
          <p className="lq-indicator-help__muted">Aucun paramètre de calcul : seule l'apparence se règle (voir « Style »).</p>
        ) : (
          <ParamList params={inputParams} />
        )}
      </section>

      {styleParams.length > 0 && (
        <section className="lq-indicator-help__section" id="lq-ih-style">
          <h2 className="lq-indicator-help__h2">Style</h2>
          <ParamList params={styleParams} />
        </section>
      )}

      {page.settingsNotes && (
        <section className="lq-indicator-help__section">
          <InfoText>{page.settingsNotes}</InfoText>
        </section>
      )}

      {page.limits && (
        <section className="lq-indicator-help__section" id="lq-ih-limites">
          <h2 className="lq-indicator-help__h2">Limites</h2>
          <RichText text={page.limits} />
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
