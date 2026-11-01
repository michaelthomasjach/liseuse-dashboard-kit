import { useId, type ReactNode } from "react";
import { Avatar } from "../finance/Avatar";
import { Badge } from "../finance/Badge";
import { toneAttribute, type SurfaceTone } from "../primitives/tone";
import "./Timeline.css";

export interface TimelineEntry {
  id: string;
  /** L'horodatage tel qu'il s'affiche — « 14:32 », « 15 janv., 18:50 ». Le composant ne formate rien. */
  date: string;
  /** La même date en ISO, posée sur `<time dateTime>` pour les lecteurs d'écran et les robots. */
  dateTime?: string;
  /** L'intitulé du jour. Des entrées consécutives qui portent le même `day` sont regroupées sous lui
   *  (avec `groupByDay`, le défaut). */
  day?: string;
  title?: ReactNode;
  /** Contenu libre sous le titre : un paragraphe, une image, une carte, des boutons. */
  content?: ReactNode;
  /** Icône posée dans le jalon, qui devient une pastille ronde. Sans icône, le jalon est un point. */
  icon?: ReactNode;
  /** Couleur du jalon, parmi les tons pleins du kit. `"default"` : pastille neutre, point atténué. */
  tone?: SurfaceTone;
  /** Qui a fait l'action : un petit avatar et son nom à côté de la date. */
  author?: { name: string; avatarSrc?: string };
  /** L'entrée en cours : le jalon prend un anneau qui respire et l'entrée une étiquette « En cours ». */
  current?: boolean;
}

export interface TimelineProps {
  entries: TimelineEntry[];
  /**
   * `"left"` (défaut) : le fil à gauche, les entrées à sa droite.
   * `"alternate"` : le fil au milieu, les entrées de part et d'autre, la date en face — sur un
   * conteneur de moins de 640 px, la frise se replie d'elle-même en une colonne.
   * `"compact"` : petits points, date et titre sur une ligne, contenu resserré — pour une colonne
   * latérale ou un historique long.
   */
  variant?: "left" | "alternate" | "compact";
  /** Regroupe les entrées consécutives de même `day` sous leur intitulé. Défaut `true`. */
  groupByDay?: boolean;
  /** Pose chaque entrée sur une surface de panneau (fond, filet, ombre), comme une carte. Défaut `false`. */
  boxed?: boolean;
  /** Texte de l'étiquette de l'entrée en cours. Défaut « En cours ». */
  currentLabel?: string;
  /** Affiché quand `entries` est vide. Défaut « Aucune activité ». */
  emptyMessage?: ReactNode;
  /** Nom accessible de la frise. Défaut « Chronologie ». */
  ariaLabel?: string;
  className?: string;
}

interface Group {
  key: string;
  day?: string;
  items: { entry: TimelineEntry; index: number }[];
}

function groupEntries(entries: TimelineEntry[], byDay: boolean): Group[] {
  const groups: Group[] = [];
  entries.forEach((entry, index) => {
    const last = groups[groups.length - 1];
    if (last && (!byDay || last.day === entry.day)) last.items.push({ entry, index });
    else groups.push({ key: `${groups.length}-${byDay ? (entry.day ?? "") : ""}`, day: byDay ? entry.day : undefined, items: [{ entry, index }] });
  });
  return groups;
}

/**
 * Frise chronologique verticale : un fil, des jalons (point ou pastille à icône, colorés par ton),
 * et pour chaque entrée une date, un titre, un auteur et un contenu libre. Regroupée par jour,
 * alignée à gauche, alternée de part et d'autre du fil, ou compacte.
 *
 * Distinct de `DayTimelineWidget`, qui est une rangée horizontale de scénarios à déclencher : ici
 * on raconte ce qui s'est passé, dans l'ordre.
 */
export function Timeline({
  entries,
  variant = "left",
  groupByDay = true,
  boxed = false,
  currentLabel = "En cours",
  emptyMessage = "Aucune activité",
  ariaLabel = "Chronologie",
  className,
}: TimelineProps) {
  const baseId = useId();
  const groups = groupEntries(entries, groupByDay);

  return (
    <section
      className={["lq-timeline", `lq-timeline--${variant}`, boxed && "lq-timeline--boxed", className].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
    >
      <div className="lq-timeline__frame">
        {entries.length === 0 ? (
          <p className="lq-timeline__empty">{emptyMessage}</p>
        ) : (
          groups.map((group, g) => {
            const labelId = `${baseId}-day-${g}`;
            return (
              <div key={group.key} className="lq-timeline__group">
                {group.day ? (
                  <h3 id={labelId} className="lq-timeline__day">
                    <span className="lq-timeline__day-label">{group.day}</span>
                  </h3>
                ) : null}
                <ol className="lq-timeline__list" aria-labelledby={group.day ? labelId : undefined}>
                  {group.items.map(({ entry, index }) => (
                    <TimelineItem
                      key={entry.id}
                      entry={entry}
                      side={index % 2 === 0 ? "end" : "start"}
                      currentLabel={currentLabel}
                      compact={variant === "compact"}
                    />
                  ))}
                </ol>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function TimelineItem({
  entry,
  side,
  currentLabel,
  compact,
}: {
  entry: TimelineEntry;
  side: "start" | "end";
  currentLabel: string;
  compact: boolean;
}) {
  const tone = toneAttribute(entry.tone);
  const hasIcon = Boolean(entry.icon) && !compact;
  const date = (
    <time className="lq-timeline__date" dateTime={entry.dateTime}>
      {entry.date}
    </time>
  );

  return (
    <li
      className={[
        "lq-timeline__item",
        `lq-timeline__item--${side}`,
        entry.current && "lq-timeline__item--current",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-current={entry.current ? "step" : undefined}
    >
      {/* La date seule, de l'autre côté du fil — visible dans la variante alternée seulement. */}
      <div className="lq-timeline__aside" aria-hidden="true">
        {entry.date}
      </div>

      <div className="lq-timeline__rail">
        <span
          className={["lq-timeline__marker", hasIcon ? "lq-timeline__marker--icon" : "lq-timeline__marker--dot"].join(" ")}
          data-lq-tone={tone}
          aria-hidden="true"
        >
          {hasIcon ? <span className="lq-timeline__marker-icon">{entry.icon}</span> : null}
        </span>
      </div>

      <div className="lq-timeline__body">
        <div className={["lq-timeline__meta", !entry.author && !entry.current && "lq-timeline__meta--date-only"].filter(Boolean).join(" ")}>
          {date}
          {entry.author ? (
            <span className="lq-timeline__author">
              {compact ? null : <Avatar name={entry.author.name} src={entry.author.avatarSrc} size={20} />}
              <span className="lq-timeline__author-name">{entry.author.name}</span>
            </span>
          ) : null}
          {entry.current ? (
            <Badge tone="info" className="lq-timeline__current">
              {currentLabel}
            </Badge>
          ) : null}
        </div>
        {entry.title ? <div className="lq-timeline__title">{entry.title}</div> : null}
        {entry.content ? <div className="lq-timeline__content">{entry.content}</div> : null}
      </div>
    </li>
  );
}
