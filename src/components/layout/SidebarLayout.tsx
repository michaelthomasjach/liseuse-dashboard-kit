import { useEffect, useState, type ReactNode } from "react";
import { MenuIcon, CloseIcon, ChevronDownIcon } from "../icons";
import "./SidebarLayout.css";

export interface SidebarNavItem {
  id: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  /** Sub-menu: this item becomes a group header that folds its children open / closed (open by default while one of
   *  them is active). The group itself has no page — its own `href` / `onClick` are ignored. */
  children?: SidebarNavItem[];
  /** Variante `rail` : seconde ligne, plus petite et plus pâle, sous le libellé (« 12 nouveautés »). */
  details?: ReactNode;
  /** Variante `rail` : le texte de la vignette quand l'entrée n'a pas d'`icon` — c'est le cas des
   *  sous-entrées. Par défaut, la première lettre du libellé, en minuscule. */
  abbr?: string;
}

export interface SidebarLayoutProps {
  logo?: ReactNode;
  navItems: SidebarNavItem[];
  /** Rendered pinned to the bottom of the sidebar — typically a `UserMenu`. */
  footer?: ReactNode;
  /** Optional bar above the page content — breadcrumbs, page title, actions. */
  header?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Keeps `header` pinned to the top of the viewport while the page scrolls (opaque background), and on
   *  narrow screens the mobile bar (menu button + logo) too. Default false. */
  stickyHeader?: boolean;
  /**
   * `"default"` : la barre latérale est dans le flux de la page, toujours dépliée.
   *
   * `"rail"` : la barre est fixée à la fenêtre — elle ne défile pas avec la page — et réduite à une
   * colonne d'icônes. Elle s'ouvre par-dessus le contenu au survol ou au focus clavier, et le
   * bouton d'épingle de son en-tête la garde ouverte (le contenu se décale alors). Chaque entrée y
   * montre son libellé à gauche et sa vignette — `icon`, ou `abbr` pour une sous-entrée — dans la
   * colonne de droite, la seule visible quand la barre est réduite. Sous la largeur tablette, les
   * deux variantes deviennent le même tiroir.
   */
  variant?: "default" | "rail";
  /** Variante `rail` : barre épinglée ouverte (contrôlé). */
  pinned?: boolean;
  /** Variante `rail` : état initial de l'épingle quand `pinned` n'est pas fourni. Défaut : false. */
  defaultPinned?: boolean;
  onPinnedChange?: (pinned: boolean) => void;
}

/** App shell with a persistent left sidebar on desktop that collapses to an
 *  off-canvas drawer (hamburger-triggered) below the tablet breakpoint. */
export function SidebarLayout({
  logo,
  navItems,
  footer,
  header,
  children,
  className,
  stickyHeader = false,
  variant = "default",
  pinned: pinnedProp,
  defaultPinned = false,
  onPinnedChange,
}: SidebarLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pinnedState, setPinnedState] = useState(defaultPinned);
  const rail = variant === "rail";
  const pinned = rail && (pinnedProp ?? pinnedState);

  const togglePin = () => {
    setPinnedState(!pinned);
    onPinnedChange?.(!pinned);
  };

  return (
    <div
      className={[
        "lq-sidebar-layout",
        stickyHeader && "lq-sidebar-layout--sticky-header",
        rail && "lq-sidebar-layout--rail",
        pinned && "lq-sidebar-layout--pinned",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <aside
        className={["lq-sidebar-layout__sidebar", mobileOpen && "lq-sidebar-layout__sidebar--open"].filter(Boolean).join(" ")}
        data-lq-region="sidebar"
      >
        {rail ? (
          <div className="lq-sidebar-layout__head">
            <div className="lq-sidebar-layout__logo">{logo}</div>
            <button
              type="button"
              className="lq-sidebar-layout__pin"
              onClick={togglePin}
              aria-pressed={pinned}
              aria-label={pinned ? "Détacher le menu" : "Épingler le menu"}
              title={pinned ? "Détacher le menu" : "Épingler le menu"}
            >
              <span className="lq-sidebar-layout__pin-mark" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="lq-sidebar-layout__logo">{logo}</div>
        )}
        <nav className="lq-sidebar-layout__nav">
          {navItems.map((item) =>
            item.children?.length ? (
              <NavGroup key={item.id} item={item} rail={rail} onNavigate={() => setMobileOpen(false)} />
            ) : (
              <NavLink key={item.id} item={item} rail={rail} onNavigate={() => setMobileOpen(false)} />
            ),
          )}
        </nav>
        {footer && <div className="lq-sidebar-layout__footer">{footer}</div>}
      </aside>

      {mobileOpen && <div className="lq-sidebar-layout__scrim" onClick={() => setMobileOpen(false)} />}

      <div className="lq-sidebar-layout__main">
        <div className="lq-sidebar-layout__topbar">
          <button
            type="button"
            className="lq-sidebar-layout__menu-button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
          >
            {mobileOpen ? <CloseIcon size={20} /> : <MenuIcon size={20} />}
          </button>
          <div className="lq-sidebar-layout__logo lq-sidebar-layout__logo--mobile">{logo}</div>
        </div>
        {header && <div className="lq-sidebar-layout__header">{header}</div>}
        <main className="lq-sidebar-layout__content">{children}</main>
      </div>
    </div>
  );
}

/** Variante `rail` : libellé (et sa seconde ligne) à gauche, vignette dans la colonne du rail. */
function RailText({ item }: { item: SidebarNavItem }) {
  return (
    <span className="lq-sidebar-layout__item-text">
      <span className="lq-sidebar-layout__item-label">{item.label}</span>
      {item.details && <span className="lq-sidebar-layout__item-details">{item.details}</span>}
    </span>
  );
}

function RailThumb({ item }: { item: SidebarNavItem }) {
  return (
    <span className="lq-sidebar-layout__thumb" aria-hidden="true">
      {item.icon ?? item.abbr ?? item.label.charAt(0).toLowerCase()}
    </span>
  );
}

function NavLink({
  item,
  onNavigate,
  nested = false,
  rail = false,
}: {
  item: SidebarNavItem;
  onNavigate: () => void;
  nested?: boolean;
  rail?: boolean;
}) {
  return (
    <a
      href={item.href ?? "#"}
      className={["lq-sidebar-layout__nav-item", nested && "lq-sidebar-layout__nav-item--nested", item.active && "lq-sidebar-layout__nav-item--active"].filter(Boolean).join(" ")}
      aria-current={item.active ? "page" : undefined}
      onClick={(e) => {
        if (item.onClick) {
          e.preventDefault();
          item.onClick();
        }
        onNavigate();
      }}
    >
      {rail ? (
        <>
          <RailText item={item} />
          <RailThumb item={item} />
        </>
      ) : (
        <>
          {item.icon}
          {item.label}
        </>
      )}
    </a>
  );
}

/** Group of the sidebar: a header that folds its sub-items open or closed. Il s'ouvre de lui-même
 *  quand une de ses entrées devient active, mais reste repliable : un groupe forcé ouvert tant
 *  qu'on est sur une de ses pages ne laisse plus ranger le menu. */
function NavGroup({ item, onNavigate, rail = false }: { item: SidebarNavItem; onNavigate: () => void; rail?: boolean }) {
  const childActive = item.children?.some((c) => c.active) ?? false;
  const [open, setOpen] = useState(childActive);
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);
  const expanded = open;
  const chevron = (
    <span className="lq-sidebar-layout__group-chevron" aria-hidden="true">
      <ChevronDownIcon size={14} />
    </span>
  );
  return (
    <div className={["lq-sidebar-layout__group", expanded && "lq-sidebar-layout__group--open"].filter(Boolean).join(" ")}>
      <button
        type="button"
        className={["lq-sidebar-layout__nav-item", "lq-sidebar-layout__group-head", childActive && "lq-sidebar-layout__group-head--active"].filter(Boolean).join(" ")}
        aria-expanded={expanded}
        onClick={() => setOpen((o) => !o)}
      >
        {rail ? (
          <>
            <RailText item={item} />
            {chevron}
            <RailThumb item={item} />
          </>
        ) : (
          <>
            {item.icon}
            <span className="lq-sidebar-layout__group-label">{item.label}</span>
            {chevron}
          </>
        )}
      </button>
      {expanded && (
        <div className="lq-sidebar-layout__group-items" role="group" aria-label={item.label}>
          {item.children?.map((c) => (
            <NavLink key={c.id} item={c} rail={rail} onNavigate={onNavigate} nested />
          ))}
        </div>
      )}
    </div>
  );
}
