import { DictationButton } from "../forms/Dictation";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronLeftIcon, SearchIcon } from "../icons";
import { Input } from "../forms/Input";
import { Avatar } from "../finance/Avatar";
import { IconButton } from "../primitives/IconButton";
import { Button } from "../primitives/Button";
import "./ChatPanel.css";

/**
 * Une **messagerie** : la liste des conversations à gauche, le fil de la conversation ouverte à
 * droite, la zone de saisie dessous.
 *
 * ## La liste
 *
 * Chaque contact : son avatar, une pastille de présence (en ligne, absent), son nom, l'aperçu du
 * dernier message et son heure, le nombre de messages non lus. Un champ filtre les contacts par nom,
 * sans tenir compte des accents. Les flèches haut et bas passent d'un contact à l'autre.
 *
 * ## Le fil
 *
 * Les bulles envoyées à droite, les reçues à gauche. Les messages qui se suivent du même expéditeur
 * à moins de cinq minutes d'écart forment un **groupe** : une seule heure, un seul avatar, à la fin
 * du groupe. Un séparateur marque chaque jour (« Aujourd'hui », « Hier », puis la date). Sous le
 * dernier message envoyé d'un groupe, son état : envoi en cours, envoyé, distribué, lu. Quand le
 * contact écrit (`typing`), trois points l'annoncent au bas du fil.
 *
 * Le fil descend tout seul au dernier message — à l'ouverture d'une conversation, à chaque message
 * envoyé, et à chaque message reçu **si l'on était déjà en bas** : on ne perd pas sa lecture quand on
 * remonte l'historique.
 *
 * ## La saisie
 *
 * Entrée envoie, Maj+Entrée va à la ligne ; le champ grandit avec le texte jusqu'à six lignes. Une
 * saisie en cours d'un éditeur de méthode d'entrée (accents composés, japonais…) n'envoie rien.
 *
 * ## Contrôlé ou libre
 *
 * Donnez `onSend` et l'application tient les messages : le composant lui passe le texte, à elle de
 * l'ajouter à `messages`. Sans `onSend`, le composant garde sa propre copie de `messages` et y ajoute
 * ce qu'on envoie — assez pour une démo. De même, `activeContactId` tient la conversation ouverte ;
 * sans lui, le composant la tient, et il efface lui-même les non-lus de la conversation qu'on ouvre.
 *
 * ## Dans un cadre étroit
 *
 * Sous 640 px (la largeur du composant, mesurée, pas celle de l'écran), une colonne à la fois : la
 * liste, puis la conversation touchée, avec un bouton « Retour ».
 *
 * Le composant **remplit son conteneur** : donnez une hauteur à celui-ci, ou `height`.
 */

export type ChatPresence = "online" | "away" | "offline";
export type ChatMessageStatus = "sending" | "sent" | "delivered" | "read";

export interface ChatContact {
  id: string;
  name: string;
  /** Une image d'avatar ; à défaut, les initiales du nom. */
  avatarSrc?: string;
  /** La pastille de présence. `offline` n'en montre pas. */
  status?: ChatPresence;
  /** Le nombre de messages non lus, en pastille dans la liste. */
  unread?: number;
  /** Le contact est en train d'écrire : trois points au bas du fil, « écrit… » dans la liste. */
  typing?: boolean;
  /** L'aperçu dans la liste. Défaut : le texte du dernier message de la conversation. */
  lastMessage?: string;
  /** L'heure de l'aperçu. Défaut : celle du dernier message. */
  lastMessageAt?: string | number | Date;
}

export interface ChatMessage {
  id: string;
  /** La conversation à laquelle le message appartient. */
  contactId: string;
  /** `me` : envoyé, à droite. `them` : reçu, à gauche. */
  from: "me" | "them";
  text: string;
  /** Une date ISO, un horodatage ou une `Date`. */
  sentAt: string | number | Date;
  /** L'état d'un message envoyé, affiché sous le dernier de son groupe. */
  status?: ChatMessageStatus;
}

export interface ChatPanelProps {
  contacts: ChatContact[];
  /** Tous les messages, toutes conversations confondues. Tenus par l'application si `onSend` est donné. */
  messages?: ChatMessage[];
  /** La conversation ouverte. Contrôlée si elle est donnée (même `null`). */
  activeContactId?: string | null;
  /** La conversation ouverte au départ, en mode libre. Défaut : le premier contact. */
  defaultActiveContactId?: string;
  onSelectContact?: (id: string) => void;
  /** Un message à envoyer. Donné, l'application tient `messages` et doit y ajouter celui-ci. */
  onSend?: (text: string, contactId: string) => void;
  /** Le titre au-dessus de la liste. Défaut : « Messages ». */
  title?: ReactNode;
  searchPlaceholder?: string;
  /** L'indication dans la zone de saisie. Défaut : « Écrire un message… ». */
  placeholder?: string;
  sendLabel?: string;
  /**
   * La zone de saisie. `inline` (défaut) : un champ d'une ligne qui grandit avec le texte, le micro et le bouton
   * d'envoi à sa droite. `stacked` : une zone de texte de plusieurs lignes avec le micro dans son coin bas droit,
   * et sous elle un bouton « Envoyer » sur toute la largeur — pour un panneau latéral étroit.
   */
  composerLayout?: "inline" | "stacked";
  backLabel?: string;
  /** Ce qu'affiche une conversation sans message. */
  emptyThreadText?: ReactNode;
  /** Ce qu'affiche la liste quand la recherche ne trouve personne. */
  emptyListText?: ReactNode;
  /** La langue des dates et des heures. Défaut : `fr-FR`. */
  locale?: string;
  /**
   * L'heure de référence : « Aujourd'hui », « Hier », et l'heure donnée aux messages envoyés en mode
   * libre. Défaut : l'heure réelle. À fixer dans une démo ou un test, pour un rendu déterministe.
   */
  now?: string | number | Date;
  /** La hauteur du composant. Défaut : celle de son conteneur (`100%`). */
  height?: number | string;
  className?: string;
}

// --- Dates ----------------------------------------------------------------------------------------

const toDate = (v: string | number | Date) => (v instanceof Date ? v : new Date(v));
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const dayDiff = (a: Date, b: Date) =>
  Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() - new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()) / 86_400_000);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** « Aujourd'hui », « Hier », puis « lundi 26 octobre » (l'année si ce n'est pas celle de `now`). */
function dayLabel(d: Date, now: Date, locale: string): string {
  const diff = dayDiff(d, now);
  if (diff === 0 || diff === -1) return capitalize(new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(diff, "day"));
  return capitalize(
    d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" })
  );
}

const timeLabel = (d: Date, locale: string) => d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

/** L'heure du jour même, « Hier », puis une date courte. */
function shortStamp(d: Date, now: Date, locale: string): string {
  const diff = dayDiff(d, now);
  if (diff === 0) return timeLabel(d, locale);
  if (diff === -1) return capitalize(new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day"));
  return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Deux messages du même expéditeur à moins de cinq minutes d'écart, le même jour : un groupe. */
const GROUP_MS = 5 * 60_000;

// --- Icônes locales -------------------------------------------------------------------------------

function SendGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12 20 4l-4 16-4-6.5L4 12Z" />
      <path d="m12 13.5 8-9.5" />
    </svg>
  );
}

function StatusGlyph({ status }: { status: ChatMessageStatus }) {
  if (status === "sending") {
    return (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 5v3l2 1.5" />
      </svg>
    );
  }
  const double = status !== "sent";
  return (
    <svg viewBox="0 0 20 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 8.5 5.5 12 12 4.5" />
      {double && <path d="M9 11.2 9.8 12 16.3 4.5" />}
    </svg>
  );
}

const STATUS_TEXT: Record<ChatMessageStatus, string> = { sending: "Envoi…", sent: "Envoyé", delivered: "Distribué", read: "Lu" };
const PRESENCE_TEXT: Record<ChatPresence, string> = { online: "En ligne", away: "Absent", offline: "Hors ligne" };

/** L'avatar et sa pastille de présence. */
function Face({ contact, size }: { contact: ChatContact; size: number }) {
  return (
    <span className="lq-chat-panel__face">
      <Avatar name={contact.name} src={contact.avatarSrc} size={size} />
      {contact.status && contact.status !== "offline" && (
        <span className={`lq-chat-panel__presence lq-chat-panel__presence--${contact.status}`} aria-hidden="true" />
      )}
    </span>
  );
}

// --- Le composant ---------------------------------------------------------------------------------

/** En deçà de cette largeur (celle du composant), une seule colonne à la fois. */
const NARROW_PX = 640;

export function ChatPanel({
  contacts,
  messages: messagesProp = [],
  activeContactId,
  defaultActiveContactId,
  onSelectContact,
  onSend,
  title = "Messages",
  searchPlaceholder = "Rechercher un contact…",
  placeholder = "Écrire un message…",
  sendLabel = "Envoyer",
  composerLayout = "inline",
  backLabel = "Retour",
  emptyThreadText = "Aucun message pour l'instant. Écrivez le premier.",
  emptyListText = "Personne ne correspond.",
  locale = "fr-FR",
  now: nowProp,
  height,
  className,
}: ChatPanelProps) {
  // Les messages : ceux de l'application si elle prend les envois, sinon une copie à nous.
  const [ownMessages, setOwnMessages] = useState<ChatMessage[]>(messagesProp);
  const messages = onSend ? messagesProp : ownMessages;
  const [ownActive, setOwnActive] = useState<string | null>(defaultActiveContactId ?? contacts[0]?.id ?? null);
  const activeId = activeContactId !== undefined ? activeContactId : ownActive;
  // En mode libre, ouvrir une conversation la marque lue.
  const [seen, setSeen] = useState<Set<string>>(() => new Set(activeId ? [activeId] : []));
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const localSeq = useRef(0);
  const hintId = useId();

  const nowDate = () => (nowProp !== undefined ? toDate(nowProp) : new Date());
  const now = nowDate();

  // Étroit ou non : la largeur du composant, mesurée avant la première peinture.
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
  const single = narrow && reading && !!activeId;

  const byContact = useMemo(() => {
    const m = new Map<string, ChatMessage[]>();
    for (const msg of messages) {
      const list = m.get(msg.contactId) ?? [];
      list.push(msg);
      m.set(msg.contactId, list);
    }
    for (const list of m.values()) list.sort((a, b) => toDate(a.sentAt).getTime() - toDate(b.sentAt).getTime());
    return m;
  }, [messages]);

  const visible = useMemo(() => {
    const q = fold(query.trim());
    return q ? contacts.filter((c) => fold(c.name).includes(q)) : contacts;
  }, [contacts, query]);

  const active = contacts.find((c) => c.id === activeId) ?? null;
  const thread = active ? (byContact.get(active.id) ?? []) : [];

  const listRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const atBottom = useRef(true);
  const forceBottom = useRef(true);

  const select = (id: string) => {
    if (activeContactId === undefined) setOwnActive(id);
    if (!onSelectContact || activeContactId === undefined) setSeen((s) => new Set(s).add(id));
    onSelectContact?.(id);
    forceBottom.current = true;
    if (narrow) {
      setReading(true);
      requestAnimationFrame(() => backRef.current?.focus({ preventScroll: true }));
    }
  };
  const back = () => {
    setReading(false);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>("[aria-selected='true']")?.focus({ preventScroll: true }));
  };

  // La conversation change : on la reprend en bas.
  useEffect(() => {
    forceBottom.current = true;
  }, [activeId]);

  // Défilement automatique : en bas à l'ouverture et après un envoi ; pour un message reçu, seulement
  // si l'on y était déjà.
  const lastMine = thread.length > 0 && thread[thread.length - 1].from === "me";
  useLayoutEffect(() => {
    const el = logRef.current;
    if (!el) return;
    if (forceBottom.current || atBottom.current || lastMine) {
      el.scrollTop = el.scrollHeight;
      atBottom.current = true;
    }
    forceBottom.current = false;
  }, [activeId, thread.length, active?.typing, lastMine, single]);

  const onLogScroll = () => {
    const el = logRef.current;
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  // Le champ grandit avec le texte, jusqu'à la hauteur fixée en CSS.
  const text = activeId ? (draft[activeId] ?? "") : "";
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text, activeId, single]);

  const send = () => {
    if (!active) return;
    const value = text.trim();
    if (!value) return;
    if (onSend) onSend(value, active.id);
    else {
      localSeq.current += 1;
      setOwnMessages((list) => [
        ...list,
        { id: `local-${localSeq.current}`, contactId: active.id, from: "me", text: value, sentAt: nowDate().toISOString(), status: "sent" },
      ]);
    }
    setDraft((d) => ({ ...d, [active.id]: "" }));
    forceBottom.current = true;
  };

  const onComposerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  // Les flèches parcourent la liste, Début et Fin vont aux extrémités.
  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>("[role='option']") ?? [])];
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

  const unreadOf = (c: ChatContact) => (c.unread && !(seen.has(c.id) && activeContactId === undefined) ? c.unread : 0);

  // Le fil, découpé en jours puis en groupes.
  const blocks: ReactNode[] = [];
  let prev: ChatMessage | null = null;
  thread.forEach((msg, i) => {
    const d = toDate(msg.sentAt);
    const prevD = prev ? toDate(prev.sentAt) : null;
    if (!prevD || dayKey(prevD) !== dayKey(d)) {
      blocks.push(
        <div key={`day-${msg.id}`} className="lq-chat-panel__day" role="separator">
          <span>{dayLabel(d, now, locale)}</span>
        </div>
      );
    }
    const next = thread[i + 1];
    const endsGroup =
      !next || next.from !== msg.from || dayKey(toDate(next.sentAt)) !== dayKey(d) || toDate(next.sentAt).getTime() - d.getTime() > GROUP_MS;
    const startsGroup =
      !prev || prev.from !== msg.from || dayKey(prevD!) !== dayKey(d) || d.getTime() - prevD!.getTime() > GROUP_MS;
    const mine = msg.from === "me";
    blocks.push(
      <div
        key={msg.id}
        className={[
          "lq-chat-panel__row",
          mine ? "lq-chat-panel__row--mine" : "lq-chat-panel__row--theirs",
          startsGroup && "lq-chat-panel__row--first",
          endsGroup && "lq-chat-panel__row--last",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {!mine && <span className="lq-chat-panel__row-face">{endsGroup && active && <Avatar name={active.name} src={active.avatarSrc} size={28} />}</span>}
        <div className="lq-chat-panel__stack">
          <div className="lq-chat-panel__bubble">
            <span className="lq-visually-hidden">{mine ? "Vous" : active?.name}, {timeLabel(d, locale)} : </span>
            {msg.text}
          </div>
          {endsGroup && (
            <span className="lq-chat-panel__meta">
              <time dateTime={d.toISOString()}>{timeLabel(d, locale)}</time>
              {mine && msg.status && (
                <span className={`lq-chat-panel__status lq-chat-panel__status--${msg.status}`} title={STATUS_TEXT[msg.status]}>
                  <StatusGlyph status={msg.status} />
                  <span className="lq-visually-hidden">{STATUS_TEXT[msg.status]}</span>
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    );
    prev = msg;
  });

  const style: CSSProperties | undefined = height !== undefined ? { height } : undefined;

  return (
    <div
      ref={rootRef}
      style={style}
      className={["lq-chat-panel", narrow && "lq-chat-panel--narrow", single && "lq-chat-panel--reading", className].filter(Boolean).join(" ")}
    >
      <aside className="lq-chat-panel__contacts" hidden={single}>
        <div className="lq-chat-panel__contacts-head">
          <h3 className="lq-chat-panel__title">{title}</h3>
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
        <div ref={listRef} className="lq-chat-panel__list" role="listbox" aria-label="Conversations" onKeyDown={onListKey}>
          {visible.length === 0 && <p className="lq-chat-panel__empty">{emptyListText}</p>}
          {visible.map((c) => {
            const list = byContact.get(c.id);
            const last = list?.[list.length - 1];
            const preview = c.typing ? "écrit…" : (c.lastMessage ?? (last ? `${last.from === "me" ? "Vous : " : ""}${last.text}` : ""));
            const stampSrc = c.lastMessageAt ?? last?.sentAt;
            const unread = unreadOf(c);
            const on = narrow ? single && c.id === activeId : c.id === activeId;
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={c.id === activeId}
                className={["lq-chat-panel__contact", on && "lq-chat-panel__contact--on", unread > 0 && "lq-chat-panel__contact--unread"].filter(Boolean).join(" ")}
                onClick={() => select(c.id)}
              >
                <Face contact={c} size={36} />
                <span className="lq-chat-panel__contact-body">
                  <span className="lq-chat-panel__contact-line">
                    <span className="lq-chat-panel__contact-name">{c.name}</span>
                    {stampSrc !== undefined && <span className="lq-chat-panel__contact-time">{shortStamp(toDate(stampSrc), now, locale)}</span>}
                  </span>
                  <span className="lq-chat-panel__contact-line">
                    <span className={["lq-chat-panel__contact-preview", c.typing && "lq-chat-panel__contact-preview--typing"].filter(Boolean).join(" ")}>
                      {preview}
                    </span>
                    {unread > 0 && (
                      <span className="lq-chat-panel__unread" aria-label={`${unread} non lu${unread > 1 ? "s" : ""}`}>
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </span>
                </span>
                {c.status && <span className="lq-visually-hidden">{PRESENCE_TEXT[c.status]}</span>}
              </button>
            );
          })}
        </div>
      </aside>

      <section className="lq-chat-panel__thread" hidden={narrow && !single} aria-label={active ? `Conversation avec ${active.name}` : "Conversation"}>
        {active ? (
          <>
            <header className="lq-chat-panel__thread-head">
              {single && (
                <button ref={backRef} type="button" className="lq-chat-panel__back" onClick={back}>
                  <ChevronLeftIcon size={16} aria-hidden="true" />
                  {backLabel}
                </button>
              )}
              <Face contact={active} size={32} />
              <span className="lq-chat-panel__thread-who">
                <span className="lq-chat-panel__thread-name">{active.name}</span>
                <span className="lq-chat-panel__thread-status">{active.typing ? "écrit…" : PRESENCE_TEXT[active.status ?? "offline"]}</span>
              </span>
            </header>
            <div ref={logRef} className="lq-chat-panel__log" role="log" aria-live="polite" aria-label={`Messages avec ${active.name}`} tabIndex={0} onScroll={onLogScroll}>
              {thread.length === 0 && <p className="lq-chat-panel__empty lq-chat-panel__empty--thread">{emptyThreadText}</p>}
              {blocks}
              {active.typing && (
                <div className="lq-chat-panel__row lq-chat-panel__row--theirs lq-chat-panel__row--first lq-chat-panel__row--last">
                  <span className="lq-chat-panel__row-face">
                    <Avatar name={active.name} src={active.avatarSrc} size={28} />
                  </span>
                  <div className="lq-chat-panel__bubble lq-chat-panel__typing" role="status">
                    <span className="lq-visually-hidden">{active.name} écrit…</span>
                    <span className="lq-chat-panel__dot" aria-hidden="true" />
                    <span className="lq-chat-panel__dot" aria-hidden="true" />
                    <span className="lq-chat-panel__dot" aria-hidden="true" />
                  </div>
                </div>
              )}
            </div>
            <form
              className={["lq-chat-panel__composer", composerLayout === "stacked" && "lq-chat-panel__composer--stacked"].filter(Boolean).join(" ")}
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              {(() => {
                const input = (
                  <textarea
                    ref={inputRef}
                    className="lq-chat-panel__input"
                    rows={composerLayout === "stacked" ? 3 : 1}
                    value={text}
                    placeholder={placeholder}
                    aria-label={`Message à ${active.name}`}
                    aria-describedby={hintId}
                    onChange={(e) => setDraft((d) => ({ ...d, [active.id]: e.target.value }))}
                    onKeyDown={onComposerKey}
                  />
                );
                const hint = (
                  <span id={hintId} className="lq-visually-hidden">
                    Entrée pour envoyer, Maj+Entrée pour aller à la ligne.
                  </span>
                );
                if (composerLayout === "stacked") {
                  return (
                    <>
                      {/* Le micro dans le coin bas droit de la zone de texte, l'envoi dessous sur toute la largeur. */}
                      <div className="lq-chat-panel__field">
                        {input}
                        <DictationButton field={inputRef} className="lq-chat-panel__mic" />
                      </div>
                      {hint}
                      <Button type="submit" tone="primary" block className="lq-chat-panel__send-wide" disabled={!text.trim()}>
                        {sendLabel}
                      </Button>
                    </>
                  );
                }
                return (
                  <>
                    {input}
                    {hint}
                    <DictationButton field={inputRef} />
                    <IconButton type="submit" className="lq-chat-panel__send" icon={<SendGlyph />} ariaLabel={sendLabel} title={sendLabel} disabled={!text.trim()} />
                  </>
                );
              })()}
            </form>
          </>
        ) : (
          <p className="lq-chat-panel__empty lq-chat-panel__empty--thread">Choisissez une conversation.</p>
        )}
      </section>
    </div>
  );
}
