import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { ChevronLeftIcon, PlusIcon, SearchIcon, TrashIcon } from "../icons";
import { Input } from "../forms/Input";
import { IconButton } from "../primitives/IconButton";
import "./NotesPanel.css";

/**
 * Un **bloc-notes** : la liste des notes à gauche, la note ouverte à droite, qu'on écrit sur place.
 *
 * ## La liste
 *
 * Chaque note : son titre (« Sans titre » s'il manque), le début de son texte, sa date de dernière
 * modification. Un champ cherche dans les titres et les textes, sans tenir compte des accents. Un
 * bouton crée une note vide, en tête, et l'ouvre le curseur dans le titre ; une corbeille, sur chaque
 * ligne et dans l'éditeur, supprime la note. Les flèches haut et bas passent d'une note à l'autre.
 *
 * ## L'éditeur
 *
 * Volontairement minimal : un titre, un texte brut dans un champ qui grandit avec ce qu'on écrit,
 * le nombre de mots et la date de la dernière modification. Pas de mise en forme — pour du texte
 * riche, `WysiwygEditor`.
 *
 * ## Contrôlé ou libre
 *
 * Donnez `onChange` et l'application tient les notes : chaque frappe lui rend la note modifiée
 * (`updatedAt` mis à jour), à elle de la remettre dans `notes` — et d'y ajouter ou d'en retirer la note
 * que lui passent `onCreate` et `onDelete` (sans eux, les boutons correspondants n'apparaissent pas).
 * Sans `onChange`, le composant garde sa propre copie de `notes` et fait tout lui-même ; les rappels
 * donnés sont tout de même appelés. `activeNoteId` tient de même la note ouverte.
 *
 * ## Dans un cadre étroit
 *
 * Sous 640 px (la largeur du composant, mesurée), une colonne à la fois : la liste, puis la note
 * touchée, avec un bouton « Retour ».
 *
 * Le composant **remplit son conteneur** : donnez une hauteur à celui-ci, ou `height`.
 */

export interface Note {
  id: string;
  title: string;
  /** Le texte, brut : les sauts de ligne sont gardés. */
  body: string;
  /** La dernière modification : une date ISO, un horodatage ou une `Date`. */
  updatedAt: string | number | Date;
}

export interface NotesPanelProps {
  notes?: Note[];
  /** La note ouverte. Contrôlée si elle est donnée (même `null`). */
  activeNoteId?: string | null;
  /** La note ouverte au départ, en mode libre. Défaut : la première. */
  defaultActiveNoteId?: string;
  onSelectNote?: (id: string) => void;
  /** Une note modifiée. Donné, l'application tient `notes`. */
  onChange?: (note: Note) => void;
  /** Une note créée, déjà ouverte. En mode contrôlé, à ajouter à `notes`. */
  onCreate?: (note: Note) => void;
  /** Une note supprimée. En mode contrôlé, à retirer de `notes`. */
  onDelete?: (id: string) => void;
  /** Le titre au-dessus de la liste. Défaut : « Notes ». */
  title?: ReactNode;
  searchPlaceholder?: string;
  newLabel?: string;
  deleteLabel?: string;
  backLabel?: string;
  titlePlaceholder?: string;
  bodyPlaceholder?: string;
  /** Le titre affiché pour une note qui n'en a pas. Défaut : « Sans titre ». */
  untitledLabel?: string;
  /** Ce qu'affiche la liste vide, ou une recherche qui ne trouve rien. */
  emptyText?: ReactNode;
  /** La langue des dates. Défaut : `fr-FR`. */
  locale?: string;
  /**
   * L'heure de référence : « aujourd'hui », « hier », et la date donnée aux notes modifiées ou créées.
   * Défaut : l'heure réelle. À fixer dans une démo ou un test, pour un rendu déterministe.
   */
  now?: string | number | Date;
  /** La hauteur du composant. Défaut : celle de son conteneur (`100%`). */
  height?: number | string;
  className?: string;
}

// --- Dates et texte -------------------------------------------------------------------------------

const toDate = (v: string | number | Date) => (v instanceof Date ? v : new Date(v));
const dayDiff = (a: Date, b: Date) =>
  Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() - new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()) / 86_400_000);
const relDay = (diff: number, locale: string) => new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(diff, "day");
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const timeLabel = (d: Date, locale: string) => d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

/** Dans la liste : l'heure du jour même, « Hier », puis une date courte. */
function shortStamp(d: Date, now: Date, locale: string): string {
  const diff = dayDiff(d, now);
  if (diff === 0) return timeLabel(d, locale);
  if (diff === -1) return capitalize(relDay(-1, locale));
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

/** Dans l'éditeur : « Modifiée aujourd'hui à 14:05 », « … le 12 octobre 2026 ». */
function longStamp(d: Date, now: Date, locale: string): string {
  const diff = dayDiff(d, now);
  if (diff === 0 || diff === -1) return `Modifiée ${relDay(diff, locale)} à ${timeLabel(d, locale)}`;
  return `Modifiée le ${d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}`;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const countWords = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);
const excerpt = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 160);

// --- Le composant ---------------------------------------------------------------------------------

/** En deçà de cette largeur (celle du composant), une seule colonne à la fois. */
const NARROW_PX = 640;

export function NotesPanel({
  notes: notesProp = [],
  activeNoteId,
  defaultActiveNoteId,
  onSelectNote,
  onChange,
  onCreate,
  onDelete,
  title = "Notes",
  searchPlaceholder = "Rechercher dans les notes…",
  newLabel = "Nouvelle note",
  deleteLabel = "Supprimer la note",
  backLabel = "Retour",
  titlePlaceholder = "Titre",
  bodyPlaceholder = "Écrivez ici…",
  untitledLabel = "Sans titre",
  emptyText = "Aucune note.",
  locale = "fr-FR",
  now: nowProp,
  height,
  className,
}: NotesPanelProps) {
  const controlled = !!onChange;
  const [ownNotes, setOwnNotes] = useState<Note[]>(notesProp);
  const notes = controlled ? notesProp : ownNotes;
  const [ownActive, setOwnActive] = useState<string | null>(defaultActiveNoteId ?? notesProp[0]?.id ?? null);
  const activeId = activeNoteId !== undefined ? activeNoteId : ownActive;
  const [query, setQuery] = useState("");
  const seq = useRef(0);

  const nowDate = () => (nowProp !== undefined ? toDate(nowProp) : new Date());
  const now = nowDate();
  const canCreate = !controlled || !!onCreate;
  const canDelete = !controlled || !!onDelete;

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
  const [reading, setReading] = useState(false);

  const visible = useMemo(() => {
    const q = fold(query.trim());
    return q ? notes.filter((n) => fold(`${n.title} ${n.body}`).includes(q)) : notes;
  }, [notes, query]);
  const active = notes.find((n) => n.id === activeId) ?? null;
  const single = narrow && reading && !!active;

  const listRef = useRef<HTMLUListElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const focusTitle = useRef(false);

  const select = (id: string | null) => {
    if (activeNoteId === undefined) setOwnActive(id);
    if (id) onSelectNote?.(id);
  };
  const open = (id: string) => {
    select(id);
    if (narrow) {
      setReading(true);
      requestAnimationFrame(() => backRef.current?.focus({ preventScroll: true }));
    }
  };
  const back = () => {
    setReading(false);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>("[aria-current='true']")?.focus({ preventScroll: true }));
  };

  const update = (note: Note, patch: Partial<Pick<Note, "title" | "body">>) => {
    const next: Note = { ...note, ...patch, updatedAt: nowDate().toISOString() };
    if (!controlled) setOwnNotes((list) => list.map((n) => (n.id === note.id ? next : n)));
    onChange?.(next);
  };

  const create = () => {
    const ids = new Set(notes.map((n) => n.id));
    let id: string;
    do {
      seq.current += 1;
      id = `note-${seq.current}`;
    } while (ids.has(id));
    const note: Note = { id, title: "", body: "", updatedAt: nowDate().toISOString() };
    if (!controlled) setOwnNotes((list) => [note, ...list]);
    onCreate?.(note);
    setQuery("");
    select(id);
    if (narrow) setReading(true);
    focusTitle.current = true;
  };

  const remove = (id: string) => {
    const i = visible.findIndex((n) => n.id === id);
    const rest = visible.filter((n) => n.id !== id);
    const nextId = rest[Math.min(Math.max(i, 0), rest.length - 1)]?.id ?? null;
    if (!controlled) setOwnNotes((list) => list.filter((n) => n.id !== id));
    onDelete?.(id);
    if (id === activeId) {
      select(nextId);
      if (narrow) setReading(false);
    }
  };

  // Une note neuve : le curseur dans son titre.
  useLayoutEffect(() => {
    if (focusTitle.current && active) {
      focusTitle.current = false;
      titleRef.current?.focus();
    }
  });

  // Le texte grandit avec ce qu'on écrit : c'est l'éditeur entier qui défile, pas le champ.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [active?.body, active?.id, single, narrow]);

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>(".lq-notes-panel__open") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowDown") next = Math.min(items.length - 1, at + 1);
    else if (e.key === "ArrowUp") next = Math.max(0, at - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next < 0) return;
    e.preventDefault();
    items[next]?.focus();
  };

  const words = active ? countWords(active.body) : 0;
  const style: CSSProperties | undefined = height !== undefined ? { height } : undefined;

  return (
    <div
      ref={rootRef}
      style={style}
      className={["lq-notes-panel", narrow && "lq-notes-panel--narrow", single && "lq-notes-panel--reading", className].filter(Boolean).join(" ")}
    >
      <aside className="lq-notes-panel__index" hidden={single} aria-label={typeof title === "string" ? title : "Notes"}>
        <div className="lq-notes-panel__index-head">
          <div className="lq-notes-panel__index-bar">
            <h3 className="lq-notes-panel__title">{title}</h3>
            {canCreate && <IconButton size="sm" icon={<PlusIcon size={16} />} ariaLabel={newLabel} title={newLabel} onClick={create} />}
          </div>
          <Input
            type="search"
            size="small"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(e) => setQuery(e.target.value)}
            leadingIcon={<SearchIcon size={14} />}
            aria-label={searchPlaceholder}
          />
        </div>
        {visible.length === 0 ? (
          <p className="lq-notes-panel__empty">{emptyText}</p>
        ) : (
          <ul ref={listRef} className="lq-notes-panel__list" onKeyDown={onListKey}>
            {visible.map((n) => {
              const current = n.id === activeId;
              const on = narrow ? single && current : current;
              return (
                <li key={n.id} className={["lq-notes-panel__item", on && "lq-notes-panel__item--on"].filter(Boolean).join(" ")}>
                  <button type="button" className="lq-notes-panel__open" aria-current={current ? "true" : undefined} onClick={() => open(n.id)}>
                    <span className="lq-notes-panel__item-line">
                      <span className={["lq-notes-panel__item-title", !n.title.trim() && "lq-notes-panel__item-title--untitled"].filter(Boolean).join(" ")}>
                        {n.title.trim() || untitledLabel}
                      </span>
                      <time className="lq-notes-panel__item-date" dateTime={toDate(n.updatedAt).toISOString()}>
                        {shortStamp(toDate(n.updatedAt), now, locale)}
                      </time>
                    </span>
                    {n.body.trim() && <span className="lq-notes-panel__item-excerpt">{excerpt(n.body)}</span>}
                  </button>
                  {canDelete && (
                    <IconButton
                      size="sm"
                      className="lq-notes-panel__item-delete"
                      icon={<TrashIcon size={14} />}
                      ariaLabel={`${deleteLabel} « ${n.title.trim() || untitledLabel} »`}
                      title={deleteLabel}
                      onClick={() => remove(n.id)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className="lq-notes-panel__editor" hidden={narrow && !single} aria-label={active ? `Note : ${active.title.trim() || untitledLabel}` : "Note"}>
        {active ? (
          <>
            <div className="lq-notes-panel__toolbar">
              {single && (
                <button ref={backRef} type="button" className="lq-notes-panel__back" onClick={back}>
                  <ChevronLeftIcon size={16} aria-hidden="true" />
                  {backLabel}
                </button>
              )}
              <span className="lq-notes-panel__stamp">{longStamp(toDate(active.updatedAt), now, locale)}</span>
              <span className="lq-notes-panel__count" aria-live="polite">
                {words} mot{words > 1 ? "s" : ""}
              </span>
              {canDelete && <IconButton size="sm" icon={<TrashIcon size={14} />} ariaLabel={deleteLabel} title={deleteLabel} onClick={() => remove(active.id)} />}
            </div>
            <div className="lq-notes-panel__paper">
              <input
                ref={titleRef}
                className="lq-notes-panel__title-input"
                value={active.title}
                placeholder={titlePlaceholder}
                aria-label={titlePlaceholder}
                onChange={(e) => update(active, { title: e.target.value })}
                onKeyDown={(e) => {
                  // Entrée dans le titre passe au texte, comme dans un traitement de texte.
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    bodyRef.current?.focus();
                  }
                }}
              />
              <textarea
                ref={bodyRef}
                className="lq-notes-panel__body"
                value={active.body}
                placeholder={bodyPlaceholder}
                aria-label="Texte de la note"
                rows={6}
                onChange={(e) => update(active, { body: e.target.value })}
              />
            </div>
          </>
        ) : (
          <div className="lq-notes-panel__none">
            <p>{notes.length === 0 ? emptyText : "Choisissez une note."}</p>
          </div>
        )}
      </section>
    </div>
  );
}
