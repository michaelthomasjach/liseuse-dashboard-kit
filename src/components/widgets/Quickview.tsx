import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "../icons";
import { Tabs } from "../primitives/Tabs";
import { LqThemeProvider, useLqTheme } from "../../theme";
import "./Quickview.css";

/** Un onglet du panneau : son libellé dans la barre, son contenu dans le corps. */
export interface QuickviewTab {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  content: ReactNode;
}

export interface QuickviewProps {
  open: boolean;
  onClose: () => void;
  /** Titre du panneau, en tête. Sans titre, donnez `ariaLabel` pour que le dialogue soit nommé. */
  title?: ReactNode;
  /** Nom accessible quand `title` n'est pas un texte (ou qu'il n'y en a pas). */
  ariaLabel?: string;
  /** Bord d'où glisse le panneau. Défaut `"right"`. */
  side?: "right" | "left";
  /** Largeur : un nombre en pixels ou toute longueur CSS. Défaut `var(--lq-quickview-width, 320px)`.
   *  Jamais plus large que l'écran. */
  width?: number | string;
  /** Onglets dans la barre de tête (réutilise `Tabs`). Le corps montre alors le contenu de l'onglet
   *  actif, puis `children` s'il y en a. */
  tabs?: QuickviewTab[];
  /** Onglet actif, contrôlé. Avec `onTabChange`. */
  activeTab?: string;
  /** Onglet actif au départ, en mode libre. Défaut : le premier. */
  defaultTab?: string;
  onTabChange?: (id: string) => void;
  /** Contenu libre du corps, qui défile seul. */
  children?: ReactNode;
  /** Pied fixe, sous le corps : boutons d'action, champ de saisie… */
  footer?: ReactNode;
  /** `true` (défaut) : un voile couvre la page, un clic dessus ferme, le focus reste piégé dans le
   *  panneau. `false` : pas de voile, la page reste utilisable à côté du panneau. */
  modal?: boolean;
  /** Libellé du bouton de fermeture. Défaut « Fermer ». */
  closeLabel?: string;
  className?: string;
}

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** Durée de la sortie, à garder égale à celle de `Quickview.css`. */
const EXIT_MS = 220;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Panneau latéral qui glisse depuis le bord de l'écran par-dessus la page : notes, alertes,
 * conversation, détail d'un élément sans quitter la vue. Rendu dans un portail vers `document.body`
 * (comme `Modal`), enveloppé d'un `LqThemeProvider` qui reprend palette, surface, police et classe
 * de thème de l'appelant.
 *
 * En mode modal (défaut), un voile couvre la page, le focus est piégé dans le panneau et rendu à
 * l'élément qui l'avait au moment de la fermeture. En mode non modal, la page reste utilisable et
 * le panneau ne retient pas le focus. Échap ferme dans les deux cas.
 *
 * La barre de tête porte `data-lq-region="quickview-head"` : un thème peut y redéfinir les couleurs
 * (une barre sombre sur un panneau clair) et les onglets, le titre et la croix suivent.
 *
 * Sans animation en palette e-ink et quand le système demande moins de mouvement.
 */
export function Quickview({
  open,
  onClose,
  title,
  ariaLabel,
  side = "right",
  width,
  tabs,
  activeTab,
  defaultTab,
  onTabChange,
  children,
  footer,
  modal = true,
  closeLabel = "Fermer",
  className,
}: QuickviewProps) {
  const theme = useLqTheme();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Monté pendant la sortie : le panneau repart vers son bord avant de disparaître.
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const still = theme.palette === "eink" || prefersReducedMotion();

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    if (still) {
      setMounted(false);
      return;
    }
    setClosing(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, EXIT_MS);
    return () => window.clearTimeout(t);
    // `mounted` lu à l'instant où `open` change, pas suivi : la sortie ne se relance pas d'elle-même.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, still]);

  const [innerTab, setInnerTab] = useState(defaultTab ?? tabs?.[0]?.id);
  const currentTab = activeTab ?? innerTab;
  const tab = tabs?.find((t) => t.id === currentTab) ?? tabs?.[0];
  function selectTab(id: string) {
    if (activeTab === undefined) setInnerTab(id);
    onTabChange?.(id);
  }

  // Focus : en entrant, sur le panneau ; en sortant, rendu à qui l'avait.
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const id = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(id);
      const back = returnFocusRef.current;
      if (back && back.isConnected) back.focus({ preventScroll: true });
    };
  }, [open]);

  // Échap, et en mode modal la tabulation qui boucle dans le panneau.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Un menu ou une liste ouverte dans le panneau se ferme d'abord : on ne ferme le panneau que
        // si l'Échap n'a pas déjà été consommé.
        if (e.defaultPrevented) return;
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !modal) return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, modal]);

  // `open` compte dès le premier rendu : le panneau est dans le DOM quand les effets de focus passent.
  if (!open && !mounted) return null;

  const style: CSSProperties | undefined =
    width === undefined ? undefined : { ["--lq-quickview-width" as string]: typeof width === "number" ? `${width}px` : width };
  const named = title !== undefined && title !== null;

  return createPortal(
    <LqThemeProvider palette={theme.palette} surface={theme.surface} font={theme.font} style={{ display: "contents" }}>
      {modal && <div className={["lq-quickview__backdrop", closing && "lq-quickview__backdrop--closing"].filter(Boolean).join(" ")} onClick={onClose} aria-hidden="true" />}
      <div
        ref={panelRef}
        className={["lq-quickview", `lq-quickview--${side}`, closing && "lq-quickview--closing", className].filter(Boolean).join(" ")}
        style={style}
        role="dialog"
        aria-modal={modal ? true : undefined}
        aria-labelledby={named ? titleId : undefined}
        aria-label={named ? undefined : ariaLabel}
        tabIndex={-1}
      >
        <header className="lq-quickview__head" data-lq-region="quickview-head">
          {named && (
            <h2 id={titleId} className="lq-quickview__title">
              {title}
            </h2>
          )}
          {tabs && tabs.length > 0 && (
            <Tabs
              className="lq-quickview__tabs"
              items={tabs.map(({ id, label, icon, disabled }) => ({ id, label, icon, disabled }))}
              value={tab?.id ?? ""}
              onChange={selectTab}
            />
          )}
          <button type="button" className="lq-quickview__close" onClick={onClose} aria-label={closeLabel}>
            <CloseIcon size={16} />
          </button>
        </header>
        <div className="lq-quickview__body" role={tab ? "tabpanel" : undefined} aria-label={tab ? tab.label : undefined}>
          {tab?.content}
          {children}
        </div>
        {footer && <footer className="lq-quickview__footer">{footer}</footer>}
      </div>
    </LqThemeProvider>,
    document.body
  );
}
