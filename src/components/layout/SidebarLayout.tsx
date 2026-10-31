import { useState, type ReactNode } from "react";
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
}

/** App shell with a persistent left sidebar on desktop that collapses to an
 *  off-canvas drawer (hamburger-triggered) below the tablet breakpoint. */
export function SidebarLayout({ logo, navItems, footer, header, children, className, stickyHeader = false }: SidebarLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={["lq-sidebar-layout", stickyHeader && "lq-sidebar-layout--sticky-header", className].filter(Boolean).join(" ")}>
      <aside
        className={["lq-sidebar-layout__sidebar", mobileOpen && "lq-sidebar-layout__sidebar--open"].filter(Boolean).join(" ")}
        data-lq-region="sidebar"
      >
        <div className="lq-sidebar-layout__logo">{logo}</div>
        <nav className="lq-sidebar-layout__nav">
          {navItems.map((item) =>
            item.children?.length ? (
              <NavGroup key={item.id} item={item} onNavigate={() => setMobileOpen(false)} />
            ) : (
              <NavLink key={item.id} item={item} onNavigate={() => setMobileOpen(false)} />
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

function NavLink({ item, onNavigate, nested = false }: { item: SidebarNavItem; onNavigate: () => void; nested?: boolean }) {
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
      {item.icon}
      {item.label}
    </a>
  );
}

/** Group of the sidebar: a header that folds its sub-items open or closed (open while one of them is active). */
function NavGroup({ item, onNavigate }: { item: SidebarNavItem; onNavigate: () => void }) {
  const childActive = item.children?.some((c) => c.active) ?? false;
  const [open, setOpen] = useState(childActive);
  const expanded = open || childActive;
  return (
    <div className={["lq-sidebar-layout__group", expanded && "lq-sidebar-layout__group--open"].filter(Boolean).join(" ")}>
      <button
        type="button"
        className={["lq-sidebar-layout__nav-item", "lq-sidebar-layout__group-head", childActive && "lq-sidebar-layout__group-head--active"].filter(Boolean).join(" ")}
        aria-expanded={expanded}
        onClick={() => setOpen((o) => (childActive ? !expanded : !o))}
      >
        {item.icon}
        <span className="lq-sidebar-layout__group-label">{item.label}</span>
        <span className="lq-sidebar-layout__group-chevron" aria-hidden="true">
          <ChevronDownIcon size={14} />
        </span>
      </button>
      {expanded && (
        <div className="lq-sidebar-layout__group-items" role="group" aria-label={item.label}>
          {item.children?.map((c) => (
            <NavLink key={c.id} item={c} onNavigate={onNavigate} nested />
          ))}
        </div>
      )}
    </div>
  );
}
