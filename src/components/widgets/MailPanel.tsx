import { useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Avatar } from "../finance/Avatar";
import { Button } from "../primitives/Button";
import { IconButton } from "../primitives/IconButton";
import { Checkbox } from "../forms/Checkbox";
import { Input } from "../forms/Input";
import { BanIcon, ChevronLeftIcon, FileIcon, FolderIcon, MenuIcon, PencilIcon, SearchIcon, StarIcon, TrashIcon } from "../icons";
import { IconBase, type IconProps } from "../icons/IconBase";
import { foldText } from "./KnowledgeBase";
import "./MailPanel.css";

/* ------------------------------------------------------------------ types */

/** Rôle d'un dossier : donne son icône par défaut, son compteur (non lus, ou total pour les
 *  brouillons) et, pour `trash`, la destination d'un message supprimé en mode libre. */
export type MailFolderRole = "inbox" | "sent" | "drafts" | "trash" | "spam" | "archive" | "custom";

export interface MailFolder {
  id: string;
  label: string;
  role?: MailFolderRole;
  /** Remplace l'icône du rôle. */
  icon?: ReactNode;
  /** Compteur affiché à droite. Omis : les non-lus du dossier (le total pour `drafts`). 0 le masque. */
  count?: number;
  /** Intertitre sous lequel ranger le dossier (« Libellés »…). Les dossiers sans groupe viennent en tête. */
  group?: string;
}

export interface MailPerson {
  name: string;
  email?: string;
  avatarSrc?: string;
}

export interface MailAttachment {
  name: string;
  /** Taille déjà formatée : « 2,4 Mo ». */
  size?: string;
  /** Lien de téléchargement. Sans lui, la pièce jointe est affichée sans être cliquable. */
  href?: string;
}

export interface MailMessage {
  id: string;
  folderId: string;
  from: MailPerson;
  to?: MailPerson[];
  cc?: MailPerson[];
  subject: string;
  /** Extrait sous l'objet, dans la liste. Omis : le début de `body` quand c'est un texte. */
  preview?: string;
  /** Corps du message. Un texte garde ses retours à la ligne ; un nœud React est rendu tel quel. */
  body?: ReactNode;
  /** Date ISO (`2026-10-29T10:42:00`) ou `Date`. */
  date: string | Date;
  unread?: boolean;
  starred?: boolean;
  attachments?: MailAttachment[];
}

export interface MailPanelLabels {
  compose: string;
  folders: string;
  search: string;
  selectAll: string;
  selected: (n: number) => string;
  markRead: string;
  markUnread: string;
  delete: string;
  reply: string;
  forward: string;
  star: string;
  unstar: string;
  back: string;
  to: string;
  cc: string;
  attachments: (n: number) => string;
  emptyFolder: string;
  noResult: string;
  noSelection: string;
  unread: string;
  me: string;
}

const DEFAULT_LABELS: MailPanelLabels = {
  compose: "Nouveau message",
  folders: "Dossiers",
  search: "Rechercher un message",
  selectAll: "Tout sélectionner",
  selected: (n) => (n > 1 ? `${n} sélectionnés` : `${n} sélectionné`),
  markRead: "Marquer comme lu",
  markUnread: "Marquer comme non lu",
  delete: "Supprimer",
  reply: "Répondre",
  forward: "Transférer",
  star: "Suivre",
  unstar: "Ne plus suivre",
  back: "Retour",
  to: "À",
  cc: "Cc",
  attachments: (n) => (n > 1 ? `${n} pièces jointes` : "1 pièce jointe"),
  emptyFolder: "Aucun message dans ce dossier.",
  noResult: "Aucun message ne correspond à la recherche.",
  noSelection: "Aucun message sélectionné",
  unread: "non lu",
  me: "moi",
};

export interface MailPanelProps {
  folders: MailFolder[];
  /** Messages, contrôlés : le composant ne les modifie pas, il signale chaque action par son rappel
   *  et l'application renvoie la liste à jour. */
  messages?: MailMessage[];
  /** Messages en mode libre (démos) : étoile, lu / non lu et suppression s'appliquent en interne, les
   *  rappels sont tout de même appelés. Ignoré si `messages` est fourni. */
  defaultMessages?: MailMessage[];

  /** Dossier ouvert, contrôlé. */
  folderId?: string;
  /** Dossier ouvert au départ. Défaut : le premier. */
  defaultFolderId?: string;
  onFolderChange?: (folderId: string) => void;

  /** Message ouvert dans le panneau de lecture, contrôlé (`null` : aucun). */
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelect?: (id: string | null) => void;

  /** Messages cochés pour une action groupée, contrôlés. */
  checkedIds?: string[];
  defaultCheckedIds?: string[];
  onCheckedChange?: (ids: string[]) => void;

  /** Texte de la recherche, contrôlé. Elle porte sur l'expéditeur, l'objet et l'extrait, dans le
   *  dossier ouvert, sans tenir compte des accents ni de la casse. */
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;

  /** Ouvrir un message non lu le marque comme lu : `onMarkRead([id], true)`. */
  onMarkRead?: (ids: string[], read: boolean) => void;
  onToggleStar?: (id: string, starred: boolean) => void;
  /** En mode libre, un message supprimé passe dans le dossier `role: "trash"` ; supprimé depuis la
   *  corbeille (ou sans corbeille), il disparaît. */
  onDelete?: (ids: string[]) => void;
  /** Affiche le bouton « Nouveau message ». */
  onCompose?: () => void;
  /** Affiche « Répondre » dans le panneau de lecture. */
  onReply?: (message: MailMessage) => void;
  /** Affiche « Transférer » dans le panneau de lecture. */
  onForward?: (message: MailMessage) => void;

  /** Instant de référence pour les dates de la liste (l'heure pour un message du jour, le jour et le
   *  mois sinon). Défaut : maintenant. Fixez-le pour un rendu reproductible. */
  now?: Date;
  /** Remplace le format des dates : `where` vaut `"list"` ou `"detail"`. */
  formatDate?: (date: Date, where: "list" | "detail") => string;
  labels?: Partial<MailPanelLabels>;
  /** Nom de la région. Défaut « Messagerie ». */
  ariaLabel?: string;
  className?: string;
}

/* ------------------------------------------------------------------ icônes locales */

const InboxIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3.5 13.5h4.5l1.5 2.5h5l1.5-2.5h4.5" />
    <path d="M5.6 5.5h12.8l2.1 8V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-5.5Z" />
  </IconBase>
);
const SendIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M20.5 3.5 10 14" />
    <path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4Z" />
  </IconBase>
);
const ArchiveIcon = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="3.5" y="4.5" width="17" height="4" rx="0.5" />
    <path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4" />
  </IconBase>
);
const PaperclipIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M20 11.5 12.2 19.3a5 5 0 0 1-7.1-7.1l8.1-8.1a3.4 3.4 0 0 1 4.8 4.8l-8.1 8.1a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4" />
  </IconBase>
);
const ReplyIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M9.5 7 4.5 12l5 5" />
    <path d="M4.5 12H14a5.5 5.5 0 0 1 5.5 5.5v1" />
  </IconBase>
);
const ForwardIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="m14.5 7 5 5-5 5" />
    <path d="M19.5 12H10a5.5 5.5 0 0 0-5.5 5.5v1" />
  </IconBase>
);
const MailIcon = (p: IconProps) => (
  <IconBase {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="1" />
    <path d="m4 6.5 8 6 8-6" />
  </IconBase>
);
const MailOpenIcon = (p: IconProps) => (
  <IconBase {...p}>
    <path d="M3.5 10 12 4l8.5 6v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1Z" />
    <path d="m4 10.5 8 5.5 8-5.5" />
  </IconBase>
);

function roleIcon(role: MailFolderRole | undefined): ReactNode {
  switch (role) {
    case "inbox":
      return <InboxIcon size={18} />;
    case "sent":
      return <SendIcon size={18} />;
    case "drafts":
      return <PencilIcon size={18} />;
    case "trash":
      return <TrashIcon size={18} />;
    case "spam":
      return <BanIcon size={18} />;
    case "archive":
      return <ArchiveIcon size={18} />;
    default:
      return <FolderIcon size={18} />;
  }
}

/* ------------------------------------------------------------------ outils */

/** Valeur contrôlée si la prop est fournie, sinon état interne ; le rappel est appelé dans les deux cas. */
function useControllable<T>(value: T | undefined, initial: T, onChange?: (v: T) => void): [T, (v: T) => void] {
  const [inner, setInner] = useState<T>(initial);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  return [
    current,
    (v: T) => {
      if (!controlled) setInner(v);
      onChange?.(v);
    },
  ];
}

const toDate = (d: string | Date) => (d instanceof Date ? d : new Date(d));
const isoOf = (d: string | Date) => {
  const date = toDate(d);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

function defaultFormat(date: Date, where: "list" | "detail", now: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  if (where === "detail") {
    const day = date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const time = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return `${day} à ${time}`;
  }
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function previewOf(m: MailMessage): string {
  if (m.preview !== undefined) return m.preview;
  return typeof m.body === "string" ? m.body.replace(/\s+/g, " ").trim().slice(0, 160) : "";
}

const personLabel = (p: MailPerson) => (p.email ? `${p.name} <${p.email}>` : p.name);

/* ------------------------------------------------------------------ composant */

type View = "folders" | "list" | "reading";

/**
 * Boîte mail en trois colonnes : dossiers (avec compteurs et « Nouveau message »), liste des
 * messages (cases à cocher, actions groupées, recherche, étoile, pièce jointe), panneau de lecture
 * (en-tête, destinataires, corps, pièces jointes, Répondre / Transférer / Supprimer).
 *
 * Chaque état — dossier ouvert, message ouvert, cases cochées, recherche — est contrôlable par sa
 * prop, ou libre avec sa valeur `default…`. Les messages aussi : `messages` (l'application applique
 * les actions) ou `defaultMessages` (le composant les applique lui-même, pour une démo).
 *
 * Remplit son conteneur (`height: 100%`) : donnez-lui une hauteur. Sous 860 px de large (requête de
 * conteneur, pas de fenêtre), une seule colonne à la fois : la liste, le message ouvert avec un
 * bouton « Retour », ou les dossiers derrière un bouton « Dossiers ».
 *
 * Clavier : ↑ / ↓ (et Début / Fin) passent d'un message à l'autre dans la liste, Entrée l'ouvre.
 */
export function MailPanel({
  folders,
  messages: messagesProp,
  defaultMessages,
  folderId: folderIdProp,
  defaultFolderId,
  onFolderChange,
  selectedId: selectedIdProp,
  defaultSelectedId = null,
  onSelect,
  checkedIds: checkedIdsProp,
  defaultCheckedIds = [],
  onCheckedChange,
  query: queryProp,
  defaultQuery = "",
  onQueryChange,
  onMarkRead,
  onToggleStar,
  onDelete,
  onCompose,
  onReply,
  onForward,
  now: nowProp,
  formatDate,
  labels: labelsProp,
  ariaLabel = "Messagerie",
  className,
}: MailPanelProps) {
  const L = { ...DEFAULT_LABELS, ...labelsProp };
  const uid = useId();
  const free = messagesProp === undefined;
  const [innerMessages, setInnerMessages] = useState<MailMessage[]>(defaultMessages ?? []);
  const messages = free ? innerMessages : messagesProp;

  const [folderId, setFolderId] = useControllable(folderIdProp, defaultFolderId ?? folders[0]?.id ?? "", onFolderChange);
  const [selectedId, setSelectedId] = useControllable<string | null>(selectedIdProp, defaultSelectedId, onSelect);
  const [checkedIds, setCheckedIds] = useControllable(checkedIdsProp, defaultCheckedIds, onCheckedChange);
  const [query, setQuery] = useControllable(queryProp, defaultQuery, onQueryChange);
  const [view, setView] = useState<View>(selectedIdProp ?? defaultSelectedId ? "reading" : "list");

  const now = nowProp ?? new Date();
  const fmt = (d: string | Date, where: "list" | "detail") => {
    const date = toDate(d);
    return formatDate ? formatDate(date, where) : defaultFormat(date, where, now);
  };

  const canStar = free || Boolean(onToggleStar);
  const canRead = free || Boolean(onMarkRead);
  const canDelete = free || Boolean(onDelete);

  /* ---- données dérivées */

  const folder = folders.find((f) => f.id === folderId) ?? folders[0];
  const inFolder = useMemo(() => messages.filter((m) => m.folderId === folder?.id), [messages, folder?.id]);
  const visible = useMemo(() => {
    const q = foldText(query.trim());
    if (!q) return inFolder;
    return inFolder.filter((m) =>
      foldText([m.from.name, m.from.email ?? "", m.subject, previewOf(m)].join(" ")).includes(q)
    );
  }, [inFolder, query]);
  const selected = selectedId ? messages.find((m) => m.id === selectedId) ?? null : null;
  const visibleIds = new Set(visible.map((m) => m.id));
  const checkedVisible = checkedIds.filter((id) => visibleIds.has(id));
  const allChecked = visible.length > 0 && checkedVisible.length === visible.length;

  function folderCount(f: MailFolder): number {
    if (f.count !== undefined) return f.count;
    const own = messages.filter((m) => m.folderId === f.id);
    return f.role === "drafts" ? own.length : own.filter((m) => m.unread).length;
  }

  const groups = useMemo(() => {
    const out: { name: string | undefined; items: MailFolder[] }[] = [];
    for (const f of folders) {
      const g = out.find((x) => x.name === f.group);
      if (g) g.items.push(f);
      else out.push({ name: f.group, items: [f] });
    }
    // Les dossiers sans groupe d'abord, quel que soit l'ordre d'arrivée.
    return out.sort((a, b) => Number(a.name !== undefined) - Number(b.name !== undefined));
  }, [folders]);

  /* ---- actions */

  function patch(ids: string[], change: (m: MailMessage) => MailMessage | null) {
    if (!free) return;
    const set = new Set(ids);
    setInnerMessages((list) => list.flatMap((m) => (set.has(m.id) ? [change(m)].filter((x): x is MailMessage => x !== null) : [m])));
  }

  function markRead(ids: string[], read: boolean) {
    if (ids.length === 0) return;
    patch(ids, (m) => ({ ...m, unread: !read }));
    onMarkRead?.(ids, read);
  }

  function toggleStar(m: MailMessage) {
    patch([m.id], (x) => ({ ...x, starred: !m.starred }));
    onToggleStar?.(m.id, !m.starred);
  }

  function remove(ids: string[]) {
    if (ids.length === 0) return;
    const trash = folders.find((f) => f.role === "trash");
    patch(ids, (m) => (trash && m.folderId !== trash.id ? { ...m, folderId: trash.id } : null));
    onDelete?.(ids);
    const gone = new Set(ids);
    if (checkedIds.some((id) => gone.has(id))) setCheckedIds(checkedIds.filter((id) => !gone.has(id)));
    if (selectedId && gone.has(selectedId)) {
      setSelectedId(null);
      setView("list");
    }
  }

  function open(m: MailMessage) {
    setSelectedId(m.id);
    setView("reading");
    if (m.unread && canRead) markRead([m.id], true);
  }

  function chooseFolder(id: string) {
    if (id !== folderId) {
      setFolderId(id);
      if (checkedIds.length) setCheckedIds([]);
    }
    setView("list");
  }

  function toggleChecked(id: string, on: boolean) {
    setCheckedIds(on ? [...checkedIds.filter((x) => x !== id), id] : checkedIds.filter((x) => x !== id));
  }

  function toggleAll(on: boolean) {
    const rest = checkedIds.filter((id) => !visibleIds.has(id));
    setCheckedIds(on ? [...rest, ...visible.map((m) => m.id)] : rest);
  }

  /* ---- clavier dans la liste */

  const listRef = useRef<HTMLUListElement>(null);
  function onRowKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    const rows = listRef.current?.querySelectorAll<HTMLButtonElement>(".lq-mail__open");
    if (!rows || rows.length === 0) return;
    let next = -1;
    if (e.key === "ArrowDown") next = Math.min(index + 1, rows.length - 1);
    else if (e.key === "ArrowUp") next = Math.max(index - 1, 0);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = rows.length - 1;
    if (next < 0) return;
    e.preventDefault();
    rows[next].focus();
  }

  /* ---- rendu */

  const checkedCount = checkedVisible.length;
  const subjectId = `${uid}-subject`;

  return (
    <section className={["lq-mail", className].filter(Boolean).join(" ")} data-view={view} aria-label={ariaLabel}>
      <div className="lq-mail__frame">
        {/* Dossiers */}
        <nav className="lq-mail__folders" aria-label={L.folders}>
          <div className="lq-mail__folders-head">
            <button type="button" className="lq-mail__back" onClick={() => setView("list")}>
              <ChevronLeftIcon size={16} />
              {L.back}
            </button>
            {onCompose && (
              <Button tone="info" icon={<PencilIcon size={16} />} onClick={onCompose}>
                {L.compose}
              </Button>
            )}
          </div>
          {groups.map((g) => (
            <div key={g.name ?? ""} className="lq-mail__folder-group">
              {g.name && <h3 className="lq-mail__group-title">{g.name}</h3>}
              <ul className="lq-mail__folder-list">
                {g.items.map((f) => {
                  const count = folderCount(f);
                  const active = f.id === folder?.id;
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        className={["lq-mail__folder", active && "lq-mail__folder--active"].filter(Boolean).join(" ")}
                        aria-current={active ? "page" : undefined}
                        onClick={() => chooseFolder(f.id)}
                      >
                        <span className="lq-mail__folder-icon">{f.icon ?? roleIcon(f.role)}</span>
                        <span className="lq-mail__folder-label">{f.label}</span>
                        {count > 0 && <span className="lq-mail__folder-count">{count}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Liste */}
        <div className="lq-mail__list-pane">
          <div className="lq-mail__list-head">
            <div className="lq-mail__list-title">
              <button type="button" className="lq-mail__back" onClick={() => setView("folders")} aria-label={L.folders}>
                <MenuIcon size={16} />
              </button>
              <h2 className="lq-mail__folder-name">{folder?.label}</h2>
              <span className="lq-mail__total">{inFolder.length}</span>
            </div>
            <Input
              size="small"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={L.search}
              aria-label={L.search}
              leadingIcon={<SearchIcon size={16} />}
              containerClassName="lq-mail__search"
            />
            <div className="lq-mail__bulk">
              <Checkbox
                checked={allChecked}
                indeterminate={checkedCount > 0 && !allChecked}
                onChange={toggleAll}
                disabled={visible.length === 0}
                label={<span className={checkedCount ? undefined : "lq-visually-hidden"}>{checkedCount ? L.selected(checkedCount) : L.selectAll}</span>}
              />
              {checkedCount > 0 && (
                <div className="lq-mail__bulk-actions" role="toolbar" aria-label={L.selected(checkedCount)}>
                  {canRead && (
                    <>
                      <IconButton size="sm" icon={<MailOpenIcon size={16} />} ariaLabel={L.markRead} title={L.markRead} onClick={() => markRead(checkedVisible, true)} />
                      <IconButton size="sm" icon={<MailIcon size={16} />} ariaLabel={L.markUnread} title={L.markUnread} onClick={() => markRead(checkedVisible, false)} />
                    </>
                  )}
                  {canDelete && (
                    <IconButton size="sm" icon={<TrashIcon size={16} />} ariaLabel={L.delete} title={L.delete} onClick={() => remove(checkedVisible)} />
                  )}
                </div>
              )}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="lq-mail__empty">{query.trim() ? L.noResult : L.emptyFolder}</p>
          ) : (
            <ul ref={listRef} className="lq-mail__list" aria-label={folder?.label}>
              {visible.map((m, i) => {
                const isOpen = m.id === selected?.id;
                const isChecked = checkedIds.includes(m.id);
                return (
                  <li
                    key={m.id}
                    className={[
                      "lq-mail__item",
                      m.unread && "lq-mail__item--unread",
                      isOpen && "lq-mail__item--open",
                      isChecked && "lq-mail__item--checked",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Checkbox
                      className="lq-mail__check"
                      checked={isChecked}
                      onChange={(on) => toggleChecked(m.id, on)}
                      label={<span className="lq-visually-hidden">{m.subject}</span>}
                    />
                    <button
                      type="button"
                      className="lq-mail__open"
                      aria-current={isOpen ? "true" : undefined}
                      onClick={() => open(m)}
                      onKeyDown={(e) => onRowKeyDown(e, i)}
                    >
                      <Avatar className="lq-mail__avatar" name={m.from.name} src={m.from.avatarSrc} size={32} />
                      <span className="lq-mail__line lq-mail__line--top">
                        <span className="lq-mail__from">
                          {m.unread && <span className="lq-mail__dot" aria-hidden="true" />}
                          {m.from.name}
                          {m.unread && <span className="lq-visually-hidden">, {L.unread}</span>}
                        </span>
                        <time className="lq-mail__date" dateTime={isoOf(m.date)}>
                          {fmt(m.date, "list")}
                        </time>
                      </span>
                      <span className="lq-mail__line">
                        <span className="lq-mail__subject">{m.subject}</span>
                        {m.attachments && m.attachments.length > 0 && (
                          <span className="lq-mail__clip" title={L.attachments(m.attachments.length)}>
                            <PaperclipIcon size={14} />
                            <span className="lq-visually-hidden">{L.attachments(m.attachments.length)}</span>
                          </span>
                        )}
                      </span>
                      <span className="lq-mail__preview">{previewOf(m)}</span>
                    </button>
                    {canStar ? (
                      <button
                        type="button"
                        className={["lq-mail__star", m.starred && "lq-mail__star--on"].filter(Boolean).join(" ")}
                        aria-pressed={Boolean(m.starred)}
                        aria-label={m.starred ? L.unstar : L.star}
                        title={m.starred ? L.unstar : L.star}
                        onClick={() => toggleStar(m)}
                      >
                        <StarIcon size={16} />
                      </button>
                    ) : (
                      m.starred && (
                        <span className="lq-mail__star lq-mail__star--on lq-mail__star--static">
                          <StarIcon size={16} />
                        </span>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Lecture */}
        <div className="lq-mail__reader">
          {selected ? (
            <article className="lq-mail__message" aria-labelledby={subjectId}>
              <div className="lq-mail__reader-bar">
                <button type="button" className="lq-mail__back" onClick={() => setView("list")}>
                  <ChevronLeftIcon size={16} />
                  {L.back}
                </button>
                <div className="lq-mail__actions">
                  {onReply && (
                    <Button className="lq-mail__action" icon={<ReplyIcon size={16} />} aria-label={L.reply} title={L.reply} onClick={() => onReply(selected)}>
                      <span className="lq-mail__action-label">{L.reply}</span>
                    </Button>
                  )}
                  {onForward && (
                    <Button className="lq-mail__action" icon={<ForwardIcon size={16} />} aria-label={L.forward} title={L.forward} onClick={() => onForward(selected)}>
                      <span className="lq-mail__action-label">{L.forward}</span>
                    </Button>
                  )}
                  {canRead && (
                    <IconButton
                      size="sm"
                      icon={selected.unread ? <MailOpenIcon size={16} /> : <MailIcon size={16} />}
                      ariaLabel={selected.unread ? L.markRead : L.markUnread}
                      title={selected.unread ? L.markRead : L.markUnread}
                      onClick={() => markRead([selected.id], Boolean(selected.unread))}
                    />
                  )}
                  {canDelete && (
                    <IconButton size="sm" icon={<TrashIcon size={16} />} ariaLabel={L.delete} title={L.delete} onClick={() => remove([selected.id])} />
                  )}
                </div>
              </div>

              <header className="lq-mail__message-head">
                <h2 id={subjectId} className="lq-mail__message-subject">
                  {selected.subject}
                </h2>
                <div className="lq-mail__sender">
                  <Avatar name={selected.from.name} src={selected.from.avatarSrc} size={40} />
                  <div className="lq-mail__sender-text">
                    <p className="lq-mail__sender-name">
                      <strong>{selected.from.name}</strong>
                      {selected.from.email && <span className="lq-mail__sender-email">{selected.from.email}</span>}
                    </p>
                    {selected.to && selected.to.length > 0 && (
                      <p className="lq-mail__recipients">
                        {L.to} : {selected.to.map(personLabel).join(", ")}
                      </p>
                    )}
                    {selected.cc && selected.cc.length > 0 && (
                      <p className="lq-mail__recipients">
                        {L.cc} : {selected.cc.map(personLabel).join(", ")}
                      </p>
                    )}
                  </div>
                  <time className="lq-mail__message-date" dateTime={isoOf(selected.date)}>
                    {fmt(selected.date, "detail")}
                  </time>
                </div>
              </header>

              <div className={["lq-mail__body", typeof selected.body === "string" && "lq-mail__body--text"].filter(Boolean).join(" ")}>
                {selected.body ?? previewOf(selected)}
              </div>

              {selected.attachments && selected.attachments.length > 0 && (
                <section className="lq-mail__attachments" aria-label={L.attachments(selected.attachments.length)}>
                  <h3 className="lq-mail__group-title">{L.attachments(selected.attachments.length)}</h3>
                  <ul className="lq-mail__attachment-list">
                    {selected.attachments.map((a) => {
                      const inner = (
                        <>
                          <FileIcon size={18} />
                          <span className="lq-mail__attachment-name">{a.name}</span>
                          {a.size && <span className="lq-mail__attachment-size">{a.size}</span>}
                        </>
                      );
                      return (
                        <li key={a.name}>
                          {a.href ? (
                            <a className="lq-mail__attachment" href={a.href} download={a.name}>
                              {inner}
                            </a>
                          ) : (
                            <span className="lq-mail__attachment">{inner}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </article>
          ) : (
            <p className="lq-mail__no-selection">{L.noSelection}</p>
          )}
        </div>
      </div>
    </section>
  );
}
