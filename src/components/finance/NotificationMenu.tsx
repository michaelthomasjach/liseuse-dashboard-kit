import { useEffect, useRef, useState, type ReactNode } from "react";
import { Popover } from "../forms/Popover";
import { Avatar } from "./Avatar";
import { BellIcon } from "../icons";
import "./NotificationMenu.css";

export type NotificationMenuTone = "default" | "accent" | "success" | "info" | "warning" | "danger";

export interface NotificationMenuItem {
  id: string;
  title: ReactNode;
  /** Complément court sur la ligne du titre, en plus petit : un nom, une action (« Agir »). */
  meta?: ReactNode;
  /** Texte sous le titre, coupé à deux lignes. */
  text?: ReactNode;
  /** Icône à gauche. */
  icon?: ReactNode;
  /** Avatar à gauche, à la place de l'icône : une image, ou les initiales de `name`. */
  avatar?: { src?: string; name?: string };
  /** Horodatage, déjà mis en forme (« il y a 2 min », « hier »). */
  time?: ReactNode;
  unread?: boolean;
  /** Couleur du titre, de son complément et de l'icône. Défaut : `"default"`, la couleur du texte. */
  tone?: NotificationMenuTone;
  onClick?: () => void;
}

export interface NotificationMenuProps {
  items: NotificationMenuItem[];
  /** Icône du déclencheur. Défaut : une cloche. */
  icon?: ReactNode;
  /** Nom du déclencheur pour les lecteurs d'écran, et titre par défaut du panneau. Défaut :
   *  « Notifications ». */
  label?: string;
  /** Pastille du déclencheur : le nombre de non-lus, ou un simple point. Défaut : `"count"`. */
  badge?: "count" | "dot";
  /** Nombre de non-lus annoncé par la pastille. Par défaut, celui des éléments `unread`. */
  unreadCount?: number;
  /** Titre de l'en-tête du panneau ; `null` retire l'en-tête. Défaut : `label`. */
  title?: ReactNode;
  /** Appelé au clic sur un élément, après son propre `onClick`. */
  onItemClick?: (item: NotificationMenuItem) => void;
  /** Fait du point de chaque élément un bouton qui bascule lu / non lu. */
  onToggleRead?: (item: NotificationMenuItem) => void;
  /** Affiche dans le pied le bouton « Tout marquer comme lu » (tant qu'il reste des non-lus). */
  onMarkAllRead?: () => void;
  markAllReadLabel?: string;
  /** Contenu libre du pied, à côté de « Tout marquer comme lu » — un lien « Toutes les
   *  notifications ». */
  footer?: ReactNode;
  /** Affiché à la place de la liste quand `items` est vide. */
  emptyText?: ReactNode;
  /** Ferme le panneau au clic sur un élément. Défaut : true. */
  closeOnItemClick?: boolean;
  /** Ouverture contrôlée. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: "bottom" | "top";
  /** Largeur du panneau, en px. Défaut : 400. */
  width?: number;
  /** Hauteur maximale de la liste avant qu'elle ne défile, en px. Défaut : 340. */
  maxHeight?: number;
  className?: string;
}

/**
 * La cloche d'une barre d'application et sa liste déroulante : un bouton-icône avec une pastille de
 * non-lus, qui ouvre sous lui un panneau de notifications — icône ou avatar, titre, texte,
 * horodatage et point non-lu par ligne, avec en-tête, pied (« Tout marquer comme lu ») et état vide.
 *
 * Le panneau est un `Popover` : il passe par un portail, se replace pour rester dans la fenêtre et se
 * ferme au clic extérieur ou sur Échap. À l'ouverture il prend le focus, pour qu'on y entre au
 * clavier sans traverser toute la page — le portail le pose en fin de document — et, refermé alors
 * que le focus y était, il le rend au déclencheur.
 *
 * C'est l'application qui tient l'état lu / non lu : le composant ne fait qu'appeler
 * `onToggleRead` et `onMarkAllRead`.
 */
export function NotificationMenu({
  items,
  icon,
  label = "Notifications",
  badge = "count",
  unreadCount,
  title,
  onItemClick,
  onToggleRead,
  onMarkAllRead,
  markAllReadLabel = "Tout marquer comme lu",
  footer,
  emptyText = "Aucune notification",
  closeOnItemClick = true,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = "bottom",
  width = 400,
  maxHeight = 340,
  className,
}: NotificationMenuProps) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const unread = unreadCount ?? items.filter((i) => i.unread).length;
  const heading = title === undefined ? label : title;

  const setOpen = (next: boolean) => {
    if (!next && panelRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  };

  // Une image plus tard : le Popover reste invisible le temps de se placer, et un élément invisible
  // ne prend pas le focus.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const selectItem = (item: NotificationMenuItem) => {
    item.onClick?.();
    onItemClick?.(item);
    if (closeOnItemClick) setOpen(false);
  };

  const triggerLabel = unread > 0 ? `${label}, ${unread} non lue${unread > 1 ? "s" : ""}` : label;
  const showMarkAll = Boolean(onMarkAllRead) && unread > 0;

  return (
    <div className={["lq-notification-menu", className].filter(Boolean).join(" ")}>
      <button
        ref={triggerRef}
        type="button"
        className="lq-notification-menu__trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={triggerLabel}
        title={label}
      >
        <span className="lq-notification-menu__trigger-icon">
          {icon ?? <BellIcon size={20} />}
          {unread > 0 &&
            (badge === "dot" ? (
              <span className="lq-notification-menu__badge lq-notification-menu__badge--dot" aria-hidden="true" />
            ) : (
              <span className="lq-notification-menu__badge lq-notification-menu__badge--count" aria-hidden="true">
                {unread > 99 ? "99+" : unread}
              </span>
            ))}
        </span>
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={triggerRef} placement={placement}>
        <div
          ref={panelRef}
          className="lq-notification-menu__panel"
          style={{ width }}
          role="dialog"
          aria-label={typeof heading === "string" ? heading : label}
          tabIndex={-1}
        >
          {heading !== null && (
            <div className="lq-notification-menu__header">
              <span className="lq-notification-menu__title">{heading}</span>
              {unread > 0 && (
                <span className="lq-notification-menu__count">
                  {unread} non lue{unread > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {items.length === 0 ? (
            <div className="lq-notification-menu__empty">
              <BellIcon size={28} />
              <span>{emptyText}</span>
            </div>
          ) : (
            <ul className="lq-notification-menu__list" style={{ maxHeight }}>
              {items.map((item) => (
                <NotificationRow key={item.id} item={item} onSelect={selectItem} onToggleRead={onToggleRead} clickable={Boolean(item.onClick || onItemClick)} />
              ))}
            </ul>
          )}

          {(showMarkAll || footer) && (
            <div className="lq-notification-menu__footer">
              {footer}
              {showMarkAll && (
                <button type="button" className="lq-notification-menu__mark-all" onClick={onMarkAllRead}>
                  {markAllReadLabel}
                </button>
              )}
            </div>
          )}
        </div>
      </Popover>
    </div>
  );
}

function NotificationRow({
  item,
  onSelect,
  onToggleRead,
  clickable,
}: {
  item: NotificationMenuItem;
  onSelect: (item: NotificationMenuItem) => void;
  onToggleRead?: (item: NotificationMenuItem) => void;
  clickable: boolean;
}) {
  const lead = item.avatar ? <Avatar name={item.avatar.name} src={item.avatar.src} size={24} /> : item.icon;
  const content = (
    <>
      {lead && <span className="lq-notification-menu__lead">{lead}</span>}
      <span className="lq-notification-menu__body">
        <span className="lq-notification-menu__line">
          <span className="lq-notification-menu__item-title">{item.title}</span>
          {item.meta && <span className="lq-notification-menu__meta">{item.meta}</span>}
        </span>
        {item.text && <span className="lq-notification-menu__text">{item.text}</span>}
      </span>
      {item.time && <span className="lq-notification-menu__time">{item.time}</span>}
      {item.unread && <span className="lq-visually-hidden">(non lue)</span>}
    </>
  );

  return (
    <li
      className={[
        "lq-notification-menu__item",
        item.unread && "lq-notification-menu__item--unread",
        `lq-notification-menu__item--${item.tone ?? "default"}`,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {clickable ? (
        <button type="button" className="lq-notification-menu__main" onClick={() => onSelect(item)}>
          {content}
        </button>
      ) : (
        <div className="lq-notification-menu__main">{content}</div>
      )}
      {onToggleRead ? (
        <button
          type="button"
          className="lq-notification-menu__mark"
          onClick={() => onToggleRead(item)}
          aria-label={item.unread ? "Marquer comme lue" : "Marquer comme non lue"}
          title={item.unread ? "Marquer comme lue" : "Marquer comme non lue"}
        >
          <span className="lq-notification-menu__dot" />
        </button>
      ) : (
        <span className="lq-notification-menu__mark" aria-hidden="true">
          <span className="lq-notification-menu__dot" />
        </span>
      )}
    </li>
  );
}
