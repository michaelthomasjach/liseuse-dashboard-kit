import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { rovingTarget } from "../../internal/rovingFocus";
import { Popover } from "../forms/Popover";
import { Avatar } from "./Avatar";
import { ChevronDownIcon, ChevronRightIcon } from "../icons";
import "./UserMenu.css";

export interface UserMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  /** Nested items rendered as a flyout submenu (opens right, or left if there isn't room). */
  children?: UserMenuItem[];
}

export interface UserMenuProps {
  name: string;
  subtitle?: string;
  avatarSrc?: string;
  items: UserMenuItem[];
  placement?: "bottom" | "top";
  className?: string;
  /** Contenu du déclencheur à la place de l'avatar, du nom et du chevron (une barre d'en-tête n'y met souvent que
   *  l'avatar, ou sa propre photo). Le menu, son clavier et ses entrées restent les mêmes. */
  trigger?: ReactNode;
  /** Nom accessible (et infobulle) du déclencheur ; utile avec `trigger`, quand le nom n'y est pas écrit. */
  triggerLabel?: string;
  /** Classe ajoutée au déclencheur (bouton). */
  triggerClassName?: string;
}

/** Les entrées d'un menu, sans celles de ses sous-menus. */
function menuItemsOf(menu: HTMLElement): HTMLElement[] {
  return Array.from(menu.querySelectorAll<HTMLElement>(':scope > li > [role="menuitem"]'));
}

/** ↑ ↓ Début Fin dans le menu qui contient le focus (motif « menu » de l'APG). */
function onMenuKeyDown(e: KeyboardEvent<HTMLUListElement>) {
  const active = document.activeElement as HTMLElement | null;
  if (active?.closest('[role="menu"]') !== e.currentTarget) return;
  const items = menuItemsOf(e.currentTarget);
  const target = rovingTarget(e.key, items.indexOf(active), items.length, "vertical");
  if (target === null) return;
  e.preventDefault();
  items[target]?.focus();
}

/** Avatar + name trigger opening an adaptive dropdown menu — the usual header/sidebar account switcher.
 *
 *  Clavier : ↓, Entrée ou Espace sur le déclencheur ouvrent le menu et y mettent le focus ; ↑ ↓
 *  circulent (en bouclant), Début / Fin vont aux extrémités, → (ou Entrée) ouvre un sous-menu et
 *  entre dedans, ← ou Échap en ressortent ; Échap au premier niveau et Tab referment le menu, et le
 *  focus revient au déclencheur. */
export function UserMenu({ name, subtitle, avatarSrc, items, placement = "bottom", className, trigger, triggerLabel, triggerClassName }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div className={["lq-user-menu", className].filter(Boolean).join(" ")}>
      <button
        ref={anchorRef}
        type="button"
        className={["lq-user-menu__trigger", trigger !== undefined && "lq-user-menu__trigger--custom", triggerClassName].filter(Boolean).join(" ")}
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {trigger !== undefined ? (
          trigger
        ) : (
          <>
            <Avatar name={name} src={avatarSrc} size={32} />
            <span className="lq-user-menu__identity">
              <span className="lq-user-menu__name">{name}</span>
              {subtitle && <span className="lq-user-menu__subtitle">{subtitle}</span>}
            </span>
            <ChevronDownIcon size={16} />
          </>
        )}
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        placement={placement}
        initialFocus={(panel) => panel.querySelector<HTMLElement>('[role="menuitem"]')}
      >
        <ul
          className="lq-user-menu__list"
          role="menu"
          aria-label={name}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              // Le menu vit en fin de document : rendre la main au déclencheur, d'où Tab repart.
              anchorRef.current?.focus();
              setOpen(false);
              return;
            }
            onMenuKeyDown(e);
          }}
        >
          {items.map((item) => (
            <UserMenuRow key={item.id} item={item} onSelect={() => setOpen(false)} />
          ))}
        </ul>
      </Popover>
    </div>
  );
}

function UserMenuRow({ item, onSelect }: { item: UserMenuItem; onSelect: () => void }) {
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [openLeft, setOpenLeft] = useState(false);
  const rowRef = useRef<HTMLLIElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLUListElement>(null);
  const [enterSubmenu, setEnterSubmenu] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const hasChildren = Boolean(item.children && item.children.length > 0);

  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  // Ouvert au clavier : le focus entre dans le sous-menu dès qu'il est rendu.
  useEffect(() => {
    if (!submenuOpen || !enterSubmenu) return;
    setEnterSubmenu(false);
    submenuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [submenuOpen, enterSubmenu]);

  function cancelClose() {
    clearTimeout(closeTimerRef.current);
  }

  // Moving the mouse from the trigger to the flyout crosses a gap that belongs to
  // neither element — closing immediately on mouseleave makes the submenu
  // impossible to reach diagonally. Delay the close briefly instead, and cancel
  // it if the pointer lands back on the trigger *or* the flyout in that window.
  function scheduleClose() {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setSubmenuOpen(false), 300);
  }

  function openSubmenu() {
    cancelClose();
    const rect = rowRef.current?.getBoundingClientRect();
    if (rect) setOpenLeft(rect.right + 200 > window.innerWidth);
    setSubmenuOpen(true);
  }

  return (
    <li
      ref={rowRef}
      className="lq-user-menu__list-item"
      onMouseEnter={hasChildren ? openSubmenu : undefined}
      onMouseLeave={hasChildren ? scheduleClose : undefined}
    >
      <button
        ref={buttonRef}
        type="button"
        role="menuitem"
        tabIndex={-1}
        onKeyDown={
          hasChildren
            ? (e) => {
                if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openSubmenu();
                  setEnterSubmenu(true);
                }
              }
            : undefined
        }
        aria-haspopup={hasChildren ? "menu" : undefined}
        aria-expanded={hasChildren ? submenuOpen : undefined}
        className={["lq-user-menu__item", item.danger && "lq-user-menu__item--danger"].filter(Boolean).join(" ")}
        onClick={() => {
          if (hasChildren) {
            if (submenuOpen) setSubmenuOpen(false);
            else openSubmenu();
            return;
          }
          item.onClick?.();
          onSelect();
        }}
      >
        {item.icon}
        <span className="lq-user-menu__item-label">{item.label}</span>
        {hasChildren && <ChevronRightIcon size={14} className="lq-user-menu__submenu-caret" />}
      </button>

      {hasChildren && submenuOpen && (
        <ul
          ref={submenuRef}
          className={["lq-user-menu__list", "lq-user-menu__submenu", openLeft && "lq-user-menu__submenu--left"]
            .filter(Boolean)
            .join(" ")}
          role="menu"
          aria-label={item.label}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "Escape") {
              // Ressortir d'un cran seulement : ni le menu parent ni le Popover ne voient la touche.
              e.preventDefault();
              e.stopPropagation();
              cancelClose();
              setSubmenuOpen(false);
              buttonRef.current?.focus();
              return;
            }
            onMenuKeyDown(e);
            // Déjà traité ici : le menu parent n'a pas à recommencer.
            if (e.defaultPrevented) e.stopPropagation();
          }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          {item.children!.map((child) => (
            <UserMenuRow key={child.id} item={child} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}
