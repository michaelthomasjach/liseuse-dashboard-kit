import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon, SearchIcon } from "../icons";
import { TextField } from "../forms/TextField";
import { ChipGroup } from "../forms/Chip";
import "./KnowledgeBase.css";

/**
 * Une **base de connaissances** : un glossaire, une encyclopédie, le guide d'un jeu — des entrées
 * qu'on cherche, qu'on lit, et qui renvoient les unes aux autres.
 *
 * ## La lecture
 *
 * Deux colonnes. À gauche, le champ de recherche, les catégories en puces, et la liste des entrées
 * trouvées — titre, résumé, catégorie ; à droite, l'entrée ouverte : son résumé, ses paragraphes, ses
 * astuces dans un encadré, et « Voir aussi », des boutons vers les entrées liées. Les mots cherchés
 * sont surlignés partout où ils apparaissent.
 *
 * ## Dans un cadre étroit
 *
 * Deux colonnes n'ont pas de sens sous 640 px : la base passe alors à **une vue à la fois**, comme
 * une application de téléphone. D'abord la liste, sur toute la largeur ; toucher une entrée l'ouvre à
 * la place de la liste, avec un bouton « Retour » en tête pour y revenir (le focus retrouve alors
 * l'entrée qu'on vient de lire). C'est la largeur **du composant** qui décide, mesurée par un
 * `ResizeObserver`, et non celle de l'écran : la base bascule aussi bien sur un téléphone que dans
 * une modale ou une colonne étroite d'un grand écran. Une entrée ouverte par l'application
 * (`selectedId`) s'affiche directement.
 *
 * ## Une recherche qui pardonne
 *
 * `searchKnowledge` ne demande pas l'orthographe exacte : elle ignore les accents et la casse,
 * reconnaît un **début de mot** (« trans » trouve « transformateur »), et tolère **une faute de
 * frappe** dans les mots de cinq lettres et plus (« tranformateur »). Chaque mot de la requête doit se
 * trouver quelque part ; le classement fait passer le titre avant les mots-clés, et les mots-clés
 * avant le texte.
 *
 * L'entrée ouverte et la requête peuvent être tenues par l'application (`selectedId`/`onSelect`,
 * `query`/`onQueryChange`) — pour ouvrir le guide sur l'entrée qui explique ce que le joueur regarde.
 * Si l'entrée ouverte sort des résultats d'une recherche, c'est la première trouvée qui s'affiche.
 */

export interface KnowledgeEntry {
  id: string;
  title: string;
  category: string;
  /** Des mots qui doivent aussi trouver l'entrée : synonymes, anglicismes, fautes courantes. */
  keywords?: string[];
  /** Le résumé, en tête de l'entrée et sous son titre dans la liste. Cherché s'il est du texte. */
  summary: ReactNode | string;
  paragraphs?: string[];
  tips?: string[];
  /** Les entrées liées, par leur `id` : « Voir aussi ». */
  related?: string[];
}

export interface KnowledgeHit {
  entry: KnowledgeEntry;
  score: number;
}

export interface KnowledgeBaseProps {
  entries: KnowledgeEntry[];
  /** Les catégories proposées en puces, dans l'ordre. Défaut : celles des entrées, dans leur ordre. */
  categories?: string[];
  /** L'entrée ouverte. Contrôlée si `onSelect` est donné avec elle. */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** La requête. Contrôlée si `onQueryChange` est donné avec elle. */
  query?: string;
  onQueryChange?: (query: string) => void;
  placeholder?: string;
  /** Ce qu'on dit quand rien n'est trouvé. */
  emptyText?: ReactNode;
  /** Le libellé de la puce qui montre toutes les catégories. Défaut : « Tout ». */
  allLabel?: string;
  /** Le bouton qui ramène à la liste, dans un cadre étroit. Défaut : « Retour ». */
  backLabel?: string;
  className?: string;
}

// --- La recherche ---------------------------------------------------------------------------------

/** Sans accents, en minuscules. */
export function foldText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const SPLIT = /[^a-z0-9%+]+/;

/** Les mots d'une requête, pliés : deux lettres au moins. */
export function queryTerms(query: string): string[] {
  return foldText(query)
    .split(SPLIT)
    .filter((w) => w.length >= 2);
}

/** Distance d'édition, bornée : au-delà de `max`, on s'arrête. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Ce que vaut un mot dans un texte plié : 3 s'il y est tel quel, 2 en début de mot, 1 à une faute près. */
function wordScore(word: string, text: string): number {
  if (text.includes(word)) return 3;
  const tokens = text.split(SPLIT);
  if (tokens.some((t) => t.startsWith(word))) return 2;
  if (word.length >= 5 && tokens.some((t) => t.length >= 4 && distance(word, t.slice(0, word.length + 1), 1) <= 1)) return 1;
  return 0;
}

const textOf = (v: ReactNode | string) => (typeof v === "string" ? v : "");

/**
 * Chercher dans des entrées : sans accents, par mots, débuts de mot et fautes de frappe (une faute
 * pour les mots de cinq lettres et plus). Le titre compte cinq fois, les mots-clés et la catégorie
 * trois, le texte une. Tous les mots doivent être trouvés quelque part. Une requête vide rend tout,
 * dans l'ordre donné, avec un score nul.
 */
export function searchKnowledge(entries: KnowledgeEntry[], query: string): KnowledgeHit[] {
  const words = queryTerms(query);
  if (words.length === 0) return entries.map((entry) => ({ entry, score: 0 }));
  const hits: KnowledgeHit[] = [];
  for (const entry of entries) {
    const title = foldText(entry.title);
    const keys = foldText([...(entry.keywords ?? []), entry.category].join(" "));
    const body = foldText([textOf(entry.summary), ...(entry.paragraphs ?? []), ...(entry.tips ?? [])].join(" "));
    let score = 0;
    let all = true;
    for (const w of words) {
      const s = wordScore(w, title) * 5 + wordScore(w, keys) * 3 + wordScore(w, body);
      if (s === 0) {
        all = false;
        break;
      }
      score += s;
    }
    if (all) hits.push({ entry, score });
  }
  // Un tri stable : à score égal, l'ordre des entrées.
  return hits.map((h, i) => ({ h, i })).sort((a, b) => b.h.score - a.h.score || a.i - b.i).map((x) => x.h);
}

/** Surligner les mots cherchés dans un texte, sans tenir compte des accents. */
function highlight(text: ReactNode | string, terms: string[]): ReactNode {
  if (typeof text !== "string" || terms.length === 0) return text;
  // Le texte plié garde la longueur de l'original tant qu'on n'ôte que des accents combinants :
  // on plie lettre par lettre pour garder la correspondance des positions.
  const norm = Array.from(text, (c) => foldText(c).charAt(0) || c).join("");
  const marks: [number, number][] = [];
  for (const t of terms) {
    let i = norm.indexOf(t);
    while (i >= 0) {
      marks.push([i, i + t.length]);
      i = norm.indexOf(t, i + t.length);
    }
  }
  if (marks.length === 0) return text;
  marks.sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let at = 0;
  for (const [s, e] of marks) {
    if (s < at) continue;
    out.push(<Fragment key={`t${at}`}>{text.slice(at, s)}</Fragment>, <mark key={`m${s}`}>{text.slice(s, e)}</mark>);
    at = e;
  }
  out.push(<Fragment key="end">{text.slice(at)}</Fragment>);
  return out;
}

// --- Le composant ----------------------------------------------------------------------------------

/** En deçà de cette largeur (celle du composant), une seule vue à la fois : la liste, ou l'entrée. */
const NARROW_PX = 640;

export function KnowledgeBase({
  entries,
  categories,
  selectedId,
  onSelect,
  query: queryProp,
  onQueryChange,
  placeholder = "Rechercher…",
  emptyText = "Rien trouvé. Essayez un autre mot.",
  allLabel = "Tout",
  backLabel = "Retour",
  className,
}: KnowledgeBaseProps) {
  const [ownQuery, setOwnQuery] = useState("");
  const query = queryProp ?? ownQuery;
  const setQuery = (q: string) => {
    setOwnQuery(q);
    onQueryChange?.(q);
  };
  const [ownId, setOwnId] = useState<string | null>(null);
  const openId = selectedId !== undefined ? selectedId : ownId;

  // Étroit ou non : la largeur du composant lui-même, relue à chaque redimensionnement. Mesurée
  // avant la première peinture, pour ne jamais montrer deux colonnes écrasées le temps d'une image.
  const rootRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => setNarrow(el.getBoundingClientRect().width <= NARROW_PX);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Dans un cadre étroit, la vue montrée : la liste, ou l'entrée ouverte. Une entrée choisie par
  // l'application s'ouvre d'elle-même — c'est ce qu'elle demande en la choisissant.
  const [reading, setReading] = useState(() => !!selectedId);
  useEffect(() => {
    if (selectedId) setReading(true);
  }, [selectedId]);
  const listRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const [returnFocus, setReturnFocus] = useState(false);

  const open = (id: string) => {
    setOwnId(id);
    onSelect?.(id);
    if (!narrow) return;
    const fromList = !reading;
    setReading(true);
    // La liste disparaît sous le doigt : le focus passe au bouton « Retour », et l'entrée s'affiche
    // depuis son début, même si l'on avait fait défiler la page loin dans la liste — ou dans
    // l'entrée précédente, quand on arrive par « Voir aussi ».
    requestAnimationFrame(() => {
      if (fromList) backRef.current?.focus({ preventScroll: true });
      const top = rootRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) rootRef.current?.scrollIntoView({ block: "start" });
    });
  };
  const back = () => {
    setReading(false);
    setReturnFocus(true);
  };
  const [category, setCategory] = useState<string | null>(null);
  const cats = useMemo(() => categories ?? [...new Set(entries.map((e) => e.category))], [categories, entries]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const found = useMemo(() => searchKnowledge(entries, query), [entries, query]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const h of found) m.set(h.entry.category, (m.get(h.entry.category) ?? 0) + 1);
    return m;
  }, [found]);
  const hits = category ? found.filter((h) => h.entry.category === category) : found;
  const terms = queryTerms(query);
  // L'entrée ouverte suit la recherche : si elle n'est plus dans les résultats, on montre la première.
  const current = openId ? byId.get(openId) : undefined;
  const shown = (current && (terms.length === 0 || hits.some((h) => h.entry.id === current.id)) ? current : hits[0]?.entry) ?? null;
  const single = narrow && reading && !!shown;

  // Revenu à la liste : le focus retrouve l'entrée qu'on vient de lire, au lieu de repartir du haut.
  useEffect(() => {
    if (!returnFocus || single) return;
    setReturnFocus(false);
    const on = listRef.current?.querySelector<HTMLElement>("[aria-selected='true']");
    on?.focus({ preventScroll: true });
    on?.scrollIntoView({ block: "nearest" });
  }, [returnFocus, single]);

  return (
    <div ref={rootRef} className={["lq-kb", narrow && "lq-kb--narrow", single && "lq-kb--reading", className].filter(Boolean).join(" ")}>
      <div className="lq-kb__layout">
        <aside className="lq-kb__index" hidden={single}>
          <TextField
            type="search"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leadingIcon={<SearchIcon size={14} />}
            aria-label="Rechercher"
          />
          {cats.length > 1 && (
            <ChipGroup
              label="Catégories"
              allLabel={allLabel}
              value={category}
              onChange={setCategory}
              options={cats.map((c) => ({ value: c, label: c, count: terms.length > 0 ? (counts.get(c) ?? 0) : undefined }))}
            />
          )}
          <div ref={listRef} className="lq-kb__results" role="listbox" aria-label="Résultats">
            {hits.length === 0 && <p className="lq-kb__empty">{emptyText}</p>}
            {hits.map(({ entry }) => {
              // Dans la liste seule, rien n'est « ouvert » tant qu'on n'a rien touché : la première
              // entrée, montrée par défaut à côté de la liste sur un grand écran, n'y est pas marquée.
              const on = narrow ? !!current && current.id === entry.id : shown?.id === entry.id;
              return (
                <button key={entry.id} type="button" role="option" aria-selected={on} className={["lq-kb__hit", on && "lq-kb__hit--on"].filter(Boolean).join(" ")} onClick={() => open(entry.id)}>
                  <span className="lq-kb__hit-title">{highlight(entry.title, terms)}</span>
                  <span className="lq-kb__hit-summary">{highlight(entry.summary, terms)}</span>
                  <span className="lq-kb__hit-cat">{entry.category}</span>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="lq-kb__entry" aria-live="polite" hidden={narrow && !single}>
          {single && (
            <button ref={backRef} type="button" className="lq-kb__back" onClick={back}>
              <ChevronLeftIcon size={16} aria-hidden="true" />
              {backLabel}
            </button>
          )}
          {shown && (
            <article className="lq-kb__article">
              <header className="lq-kb__head">
                <span className="lq-kb__cat">{shown.category}</span>
                <h3 className="lq-kb__title">{highlight(shown.title, terms)}</h3>
              </header>
              <div className="lq-kb__summary">{highlight(shown.summary, terms)}</div>
              {(shown.paragraphs ?? []).map((p, i) => (
                <p key={i} className="lq-kb__para">
                  {highlight(p, terms)}
                </p>
              ))}
              {shown.tips && shown.tips.length > 0 && (
                <aside className="lq-kb__tips" aria-label="Astuces">
                  <span className="lq-kb__tips-title">Astuces</span>
                  <ul>
                    {shown.tips.map((t, i) => (
                      <li key={i}>{highlight(t, terms)}</li>
                    ))}
                  </ul>
                </aside>
              )}
              {shown.related && shown.related.some((id) => byId.has(id)) && (
                <nav className="lq-kb__related" aria-label="Voir aussi">
                  <span className="lq-kb__related-title">Voir aussi</span>
                  {shown.related
                    .map((id) => byId.get(id))
                    .filter((e): e is KnowledgeEntry => !!e)
                    .map((e) => (
                      <button key={e.id} type="button" className="lq-kb__related-link" onClick={() => open(e.id)}>
                        {e.title}
                      </button>
                    ))}
                </nav>
              )}
              {shown.keywords && shown.keywords.length > 0 && (
                <div className="lq-kb__keywords">
                  {shown.keywords.slice(0, 10).map((k) => (
                    <span key={k} className="lq-kb__keyword">
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </article>
          )}
        </section>
      </div>
    </div>
  );
}
