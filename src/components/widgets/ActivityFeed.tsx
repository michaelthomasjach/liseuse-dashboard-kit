import { useId, useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Avatar } from "../finance/Avatar";
import { Button } from "../primitives/Button";
import { Textarea } from "../forms/Textarea";
import { CommentIcon } from "../icons";
import "./ActivityFeed.css";

export interface ActivityPerson {
  name: string;
  avatarSrc?: string;
}

export interface ActivityComment {
  id: string;
  author: ActivityPerson;
  text: ReactNode;
  /** Horodatage tel qu'il s'affiche (« il y a 3 min ») — fourni par l'appelant. */
  time?: string;
}

export interface ActivityPost {
  id: string;
  author: ActivityPerson;
  /** Ce que l'auteur a fait : « a publié », « a commenté », « a partagé une photo ». */
  action?: string;
  /** Ce sur quoi porte l'action, après le verbe : « dans Équipe produit », un lien… */
  target?: ReactNode;
  /** Horodatage relatif tel qu'il s'affiche (« il y a 5 min ») : le composant ne calcule rien. */
  time: string;
  /** La même date en ISO, posée sur `<time dateTime>`. */
  dateTime?: string;
  text?: ReactNode;
  image?: { src: string; alt: string };
  likes?: number;
  /** Le lecteur aime déjà la publication : le bouton « J'aime » est enfoncé. */
  liked?: boolean;
  shares?: number;
  comments?: ActivityComment[];
  /** Nombre total de commentaires, quand il dépasse ceux chargés dans `comments`. */
  commentCount?: number;
}

export interface ActivityFeedLabels {
  feed: string;
  like: string;
  comment: string;
  share: string;
  writeComment: string;
  publish: string;
  reactions: string;
  noComments: string;
}

const DEFAULT_LABELS: ActivityFeedLabels = {
  feed: "Fil d'activité",
  like: "J'aime",
  comment: "Commenter",
  share: "Partager",
  writeComment: "Écrire un commentaire…",
  publish: "Publier",
  reactions: "Réactions",
  noComments: "Aucun commentaire pour l'instant.",
};

export interface ActivityFeedProps {
  posts: ActivityPost[];
  /** `"cards"` (défaut) : une carte par publication, image en grand. `"list"` : des lignes resserrées
   *  séparées d'un filet, l'image en vignette à droite. */
  variant?: "cards" | "list";
  /** Clic sur « J'aime ». Reçoit l'état voulu : `true` pour aimer, `false` pour retirer. Le composant
   *  ne retient rien : c'est à l'appelant de mettre à jour `liked` et `likes`. Sans ce rappel, le
   *  bouton est désactivé. */
  onLike?: (postId: string, liked: boolean) => void;
  /** Clic sur « Partager ». Sans ce rappel, le bouton n'est pas affiché. */
  onShare?: (postId: string) => void;
  /** Envoi d'un commentaire. Sans ce rappel, la zone « Écrire un commentaire » n'est pas affichée. */
  onComment?: (postId: string, text: string) => void;
  /** Le lecteur : son avatar précède la zone de saisie d'un commentaire. */
  currentUser?: ActivityPerson;
  /** Publications dont les commentaires sont dépliés au départ. */
  defaultOpenComments?: string[];
  /** Langue des compteurs (« 23 k » en français). Défaut `"fr-FR"`. */
  locale?: string;
  labels?: Partial<ActivityFeedLabels>;
  /** Affiché quand `posts` est vide. Défaut « Aucune publication ». */
  emptyMessage?: ReactNode;
  className?: string;
}

/**
 * Fil de publications d'un réseau social interne : qui a fait quoi, quand, le texte, une image, et
 * les réactions — j'aime, commentaires (repliables, avec une zone de saisie), partage.
 *
 * Le fil est un `role="feed"` : chaque publication est un `<article>` focalisable, et Page suivante /
 * Page précédente passent de l'une à l'autre.
 */
export function ActivityFeed({
  posts,
  variant = "cards",
  onLike,
  onShare,
  onComment,
  currentUser,
  defaultOpenComments,
  locale = "fr-FR",
  labels: labelsProp,
  emptyMessage = "Aucune publication",
  className,
}: ActivityFeedProps) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(defaultOpenComments));
  const format = useMemo(() => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }), [locale]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "PageDown" && event.key !== "PageUp") return;
    // Dans la zone de saisie, Page suivante / précédente reste à la zone de texte.
    if ((event.target as HTMLElement).closest("textarea, input")) return;
    const articles = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(":scope > .lq-activity__post"));
    const current = articles.findIndex((a) => a.contains(document.activeElement));
    if (current < 0) return;
    const next = articles[current + (event.key === "PageDown" ? 1 : -1)];
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  if (posts.length === 0) {
    return (
      <div className={["lq-activity", `lq-activity--${variant}`, className].filter(Boolean).join(" ")}>
        <p className="lq-activity__empty">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      role="feed"
      aria-label={labels.feed}
      className={["lq-activity", `lq-activity--${variant}`, className].filter(Boolean).join(" ")}
      onKeyDown={onKeyDown}
    >
      {posts.map((post, index) => (
        <Post
          key={post.id}
          post={post}
          position={index + 1}
          total={posts.length}
          compact={variant === "list"}
          commentsOpen={open.has(post.id)}
          onToggleComments={() => toggle(post.id)}
          onLike={onLike}
          onShare={onShare}
          onComment={onComment}
          currentUser={currentUser}
          labels={labels}
          format={(n) => format.format(n)}
        />
      ))}
    </div>
  );
}

function Post({
  post,
  position,
  total,
  compact,
  commentsOpen,
  onToggleComments,
  onLike,
  onShare,
  onComment,
  currentUser,
  labels,
  format,
}: {
  post: ActivityPost;
  position: number;
  total: number;
  compact: boolean;
  commentsOpen: boolean;
  onToggleComments: () => void;
  onLike?: ActivityFeedProps["onLike"];
  onShare?: ActivityFeedProps["onShare"];
  onComment?: ActivityFeedProps["onComment"];
  currentUser?: ActivityPerson;
  labels: ActivityFeedLabels;
  format: (n: number) => string;
}) {
  const id = useId();
  const comments = post.comments ?? [];
  const commentCount = post.commentCount ?? comments.length;
  const likes = post.likes ?? 0;
  const liked = Boolean(post.liked);

  const image = post.image ? (
    <figure className="lq-activity__media">
      <img src={post.image.src} alt={post.image.alt} loading="lazy" />
    </figure>
  ) : null;

  return (
    <article
      className="lq-activity__post"
      tabIndex={0}
      aria-labelledby={`${id}-head`}
      aria-describedby={post.text ? `${id}-text` : undefined}
      aria-posinset={position}
      aria-setsize={total}
    >
      <Avatar className="lq-activity__avatar" name={post.author.name} src={post.author.avatarSrc} size={compact ? 32 : 40} />

      <div className="lq-activity__main">
        <header className="lq-activity__head" id={`${id}-head`}>
          <span className="lq-activity__line">
            <span className="lq-activity__name">{post.author.name}</span>
            {post.action ? <span className="lq-activity__action"> {post.action}</span> : null}
            {post.target ? <span className="lq-activity__target"> {post.target}</span> : null}
          </span>
          <time className="lq-activity__time" dateTime={post.dateTime}>
            {post.time}
          </time>
        </header>

        {post.text ? (
          <div className="lq-activity__text" id={`${id}-text`}>
            {post.text}
          </div>
        ) : null}

        {!compact ? image : null}

        <div className="lq-activity__actions" role="group" aria-label={labels.reactions}>
          <button
            type="button"
            className="lq-activity__action-btn lq-activity__like"
            aria-pressed={liked}
            disabled={!onLike}
            onClick={() => onLike?.(post.id, !liked)}
          >
            <HeartIcon filled={liked} />
            <span className={compact ? "lq-activity__sr" : undefined}>{labels.like}</span>
            {likes > 0 ? <span className="lq-activity__count">{format(likes)}</span> : null}
          </button>
          <button
            type="button"
            className="lq-activity__action-btn"
            aria-expanded={commentsOpen}
            aria-controls={`${id}-comments`}
            onClick={onToggleComments}
          >
            <CommentIcon size={16} />
            <span className={compact ? "lq-activity__sr" : undefined}>{labels.comment}</span>
            {commentCount > 0 ? <span className="lq-activity__count">{format(commentCount)}</span> : null}
          </button>
          {onShare ? (
            <button type="button" className="lq-activity__action-btn" onClick={() => onShare(post.id)}>
              <ShareIcon />
              <span className={compact ? "lq-activity__sr" : undefined}>{labels.share}</span>
              {post.shares ? <span className="lq-activity__count">{format(post.shares)}</span> : null}
            </button>
          ) : null}
        </div>

        <div className="lq-activity__comments" id={`${id}-comments`} hidden={!commentsOpen}>
          {commentsOpen ? (
            <>
              {comments.length > 0 ? (
                <ul className="lq-activity__comment-list">
                  {comments.map((c) => (
                    <li key={c.id} className="lq-activity__comment">
                      <Avatar name={c.author.name} src={c.author.avatarSrc} size={28} />
                      <div className="lq-activity__bubble">
                        <span className="lq-activity__comment-name">{c.author.name}</span>
                        <div className="lq-activity__comment-text">{c.text}</div>
                        {c.time ? <span className="lq-activity__comment-time">{c.time}</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="lq-activity__no-comments">{labels.noComments}</p>
              )}
              {onComment ? <Composer postId={post.id} currentUser={currentUser} labels={labels} onComment={onComment} /> : null}
            </>
          ) : null}
        </div>
      </div>

      {compact ? <div className="lq-activity__thumb">{image}</div> : null}
    </article>
  );
}

function Composer({
  postId,
  currentUser,
  labels,
  onComment,
}: {
  postId: string;
  currentUser?: ActivityPerson;
  labels: ActivityFeedLabels;
  onComment: (postId: string, text: string) => void;
}) {
  const [text, setText] = useState("");
  const send = () => {
    const value = text.trim();
    if (!value) return;
    onComment(postId, value);
    setText("");
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };
  // Entrée envoie, Maj+Entrée passe à la ligne ; pendant une composition (IME), Entrée valide le mot.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };
  return (
    <form className="lq-activity__composer" onSubmit={submit}>
      {currentUser ? <Avatar name={currentUser.name} src={currentUser.avatarSrc} size={28} /> : null}
      <Textarea
        containerClassName="lq-activity__composer-field"
        aria-label={labels.writeComment}
        placeholder={labels.writeComment}
        autoResize
        minRows={1}
        maxRows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <Button type="submit" className="lq-activity__send" disabled={!text.trim()}>
        {labels.publish}
      </Button>
    </form>
  );
}

/* Icônes locales, non exportées : le kit n'a ni cœur ni partage. */

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="lq-activity__heart" width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="M8.2 10.8 15.8 6.7M8.2 13.2l7.6 4.1" />
    </svg>
  );
}
