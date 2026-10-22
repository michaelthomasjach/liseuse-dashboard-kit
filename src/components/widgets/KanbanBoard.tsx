import { useState, type DragEvent, type ReactNode } from "react";
import { Badge } from "../finance/Badge";
import "./KanbanBoard.css";

/**
 * Un **tableau Kanban** : des colonnes (« À faire », « En cours », « Terminé »…) et des cartes qu'on fait avancer de
 * l'une à l'autre.
 *
 * ## Ce que fait le composant, et ce qu'il laisse à l'application
 *
 * Il dessine les colonnes et les cartes, gère le glisser-déposer (avec le repère d'insertion entre deux cartes) et
 * les flèches ← → qui font passer une carte à la colonne voisine — au clavier comme à la souris. Il ne garde **aucun
 * état métier** : il reçoit les cartes déjà triées, et signale chaque déplacement par `onMove` (colonne d'arrivée et
 * place dans la colonne). C'est à l'application d'enregistrer le changement et de renvoyer les cartes.
 *
 * ## Colonnes triées par date
 *
 * Une colonne `sortable: false` (typiquement « Terminé », rangée par date de livraison) accepte les cartes, mais la
 * place où on les lâche n'a pas de sens : pas de repère d'insertion, `index` vaut 0. Les cartes d'une colonne peuvent
 * porter un `group` (« jeudi 22 octobre ») : un intertitre est posé à chaque changement de groupe.
 */
export interface KanbanColumn {
  id: string;
  title: string;
  /** Une ligne sous le titre (« En développement »). */
  hint?: string;
  /** Faux : la colonne est rangée par l'application (par date…), la place du dépôt est ignorée. Vrai par défaut. */
  sortable?: boolean;
  /** Couleur du trait en tête de colonne. */
  tone?: "neutral" | "info" | "warning" | "success";
}

export interface KanbanCard {
  id: string | number;
  columnId: string;
  title: string;
  description?: string;
  /** Étiquette (rubrique, équipe…). */
  tag?: string;
  /** Texte discret en haut à droite de la carte (« livré le 22 oct. 2026 »). */
  meta?: ReactNode;
  /** Intertitre de la colonne : posé au-dessus de la première carte de chaque groupe. */
  group?: string;
}

export interface KanbanMove {
  card: KanbanCard;
  fromColumnId: string;
  toColumnId: string;
  /** Place dans la colonne d'arrivée, la carte déplacée exclue (0 = en tête). */
  index: number;
}

export interface KanbanBoardProps {
  columns: KanbanColumn[];
  /** Cartes de toutes les colonnes, dans l'ordre d'affichage de chaque colonne. */
  cards: KanbanCard[];
  onMove?: (move: KanbanMove) => void;
  /** Bouton « Modifier » sur chaque carte (absent sans ce rappel). */
  onEdit?: (card: KanbanCard) => void;
  /** Bouton « Supprimer » sur chaque carte (absent sans ce rappel). La confirmation revient à l'application. */
  onDelete?: (card: KanbanCard) => void;
  /** Texte d'une colonne vide. */
  emptyLabel?: string;
  /** Nom du tableau pour les lecteurs d'écran. */
  ariaLabel?: string;
  className?: string;
}

type Over = { columnId: string; index: number } | null;

export function KanbanBoard({
  columns,
  cards,
  onMove,
  onEdit,
  onDelete,
  emptyLabel = "Glissez une carte ici.",
  ariaLabel = "Tableau Kanban",
  className,
}: KanbanBoardProps) {
  const [dragId, setDragId] = useState<KanbanCard["id"] | null>(null);
  const [over, setOver] = useState<Over>(null);
  const dragged = dragId === null ? null : (cards.find((c) => c.id === dragId) ?? null);

  const finish = (): void => {
    setDragId(null);
    setOver(null);
  };

  const drop = (column: KanbanColumn, index: number): void => {
    const card = dragged;
    finish();
    if (!card || !onMove) return;
    const sortable = column.sortable !== false;
    // Même colonne rangée par l'application : rien ne change.
    if (!sortable && card.columnId === column.id) return;
    const list = cards.filter((c) => c.columnId === column.id && c.id !== card.id);
    const at = sortable ? Math.min(index, list.length) : 0;
    // Lâchée à sa propre place : pas de déplacement.
    if (card.columnId === column.id) {
      const before = cards.filter((c) => c.columnId === column.id).findIndex((c) => c.id === card.id);
      if (before === at) return;
    }
    onMove({ card, fromColumnId: card.columnId, toColumnId: column.id, index: at });
  };

  const step = (card: KanbanCard, dir: -1 | 1): void => {
    const i = columns.findIndex((c) => c.id === card.columnId);
    const target = columns[i + dir];
    if (target && onMove) onMove({ card, fromColumnId: card.columnId, toColumnId: target.id, index: cards.filter((c) => c.columnId === target.id).length });
  };

  return (
    <div className={["lq-kanban", className].filter(Boolean).join(" ")} role="region" aria-label={ariaLabel}>
      {columns.map((col, ci) => {
        const list = cards.filter((c) => c.columnId === col.id);
        const sortable = col.sortable !== false;
        const isOver = over?.columnId === col.id;
        // Index d'affichage du repère (la carte glissée elle-même compte encore dans la liste affichée).
        const marker = isOver && sortable ? over.index : -1;
        let lastGroup: string | undefined;
        return (
          <section
            key={col.id}
            className={["lq-kanban__col", col.tone && `lq-kanban__col--${col.tone}`, isOver && "lq-kanban__col--over"].filter(Boolean).join(" ")}
            aria-label={`${col.title} (${list.length})`}
            onDragOver={(e: DragEvent) => {
              if (dragId === null) return;
              e.preventDefault();
              if (!isOver) setOver({ columnId: col.id, index: list.length });
            }}
            onDragLeave={(e: DragEvent) => {
              if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              drop(col, isOver ? over.index : list.length);
            }}
          >
            <header className="lq-kanban__head">
              <h3 className="lq-kanban__title">
                {col.title} <span className="lq-kanban__count">{list.length}</span>
              </h3>
              {col.hint && <p className="lq-kanban__hint">{col.hint}</p>}
            </header>
            <ol className="lq-kanban__list">
              {list.map((card, i) => {
                const showGroup = card.group !== undefined && card.group !== lastGroup;
                lastGroup = card.group;
                return (
                  <li key={card.id} className="lq-kanban__item">
                    {showGroup && <p className="lq-kanban__group">{card.group}</p>}
                    {marker === i && <span className="lq-kanban__drop" aria-hidden="true" />}
                    <article
                      className={["lq-kanban__card", dragId === card.id && "lq-kanban__card--dragging"].filter(Boolean).join(" ")}
                      draggable={Boolean(onMove)}
                      onDragStart={(e: DragEvent) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(card.id));
                        setDragId(card.id);
                      }}
                      onDragEnd={finish}
                      onDragOver={(e: DragEvent) => {
                        if (dragId === null || !sortable) return;
                        e.preventDefault();
                        e.stopPropagation();
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const index = e.clientY < r.top + r.height / 2 ? i : i + 1;
                        if (!isOver || over.index !== index) setOver({ columnId: col.id, index });
                      }}
                    >
                      {(card.tag || card.meta) && (
                        <div className="lq-kanban__cardhead">
                          {card.tag && <Badge tone="neutral">{card.tag}</Badge>}
                          {card.meta && <span className="lq-kanban__meta">{card.meta}</span>}
                        </div>
                      )}
                      <h4 className="lq-kanban__cardtitle">{card.title}</h4>
                      {card.description && <p className="lq-kanban__desc">{card.description}</p>}
                      {(onMove || onEdit || onDelete) && (
                        <div className="lq-kanban__actions">
                          {onMove && (
                            <>
                              <button type="button" className="lq-kanban__icon" onClick={() => step(card, -1)} disabled={ci === 0} aria-label={`Déplacer « ${card.title} » vers ${columns[ci - 1]?.title ?? "la colonne précédente"}`} title="Colonne précédente">
                                ←
                              </button>
                              <button type="button" className="lq-kanban__icon" onClick={() => step(card, 1)} disabled={ci === columns.length - 1} aria-label={`Déplacer « ${card.title} » vers ${columns[ci + 1]?.title ?? "la colonne suivante"}`} title="Colonne suivante">
                                →
                              </button>
                            </>
                          )}
                          <span className="lq-kanban__spacer" />
                          {onEdit && (
                            <button type="button" className="lq-kanban__icon" onClick={() => onEdit(card)} aria-label={`Modifier « ${card.title} »`} title="Modifier">
                              ✎
                            </button>
                          )}
                          {onDelete && (
                            <button type="button" className="lq-kanban__icon lq-kanban__icon--danger" onClick={() => onDelete(card)} aria-label={`Supprimer « ${card.title} »`} title="Supprimer">
                              ✕
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  </li>
                );
              })}
              {marker >= list.length && <span className="lq-kanban__drop" aria-hidden="true" />}
              {list.length === 0 && <li className="lq-kanban__empty">{emptyLabel}</li>}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
