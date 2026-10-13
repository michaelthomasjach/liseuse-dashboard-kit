import { useState, type ReactNode } from "react";
import { MenuIcon, CloseIcon } from "../icons";
import "./SidebarLayout.css";

export interface SidebarNavItem {
  id: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
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
      <aside className={["lq-sidebar-layout__sidebar", mobileOpen && "lq-sidebar-layout__sidebar--open"].filter(Boolean).join(" ")}>
        <div className="lq-sidebar-layout__logo">{logo}</div>
        <nav className="lq-sidebar-layout__nav">
          {navItems.map((item) => (
            <a
              key={item.id}
              href={item.href ?? "#"}
              className={["lq-sidebar-layout__nav-item", item.active && "lq-sidebar-layout__nav-item--active"].filter(Boolean).join(" ")}
              onClick={(e) => {
                if (item.onClick) {
                  e.preventDefault();
                  item.onClick();
                }
                setMobileOpen(false);
              }}
            >
              {item.icon}
              {item.label}
            </a>
          ))}
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
