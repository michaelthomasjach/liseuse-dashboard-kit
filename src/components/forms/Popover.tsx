import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { focusableIn } from "../../internal/useFocusTrap";
import { createPortal } from "react-dom";
import { usePopoverPosition, type PopoverPlacement } from "./internal/usePopoverPosition";
import { LqThemeProvider, useLqTheme } from "../../theme";
import "./Popover.css";

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  /** Preferred side; flips to the other side (and shifts horizontally) when there isn't room. */
  placement?: PopoverPlacement;
  /** Match the panel's width to the anchor's width (typical for a Select). */
  matchAnchorWidth?: boolean;
  /** Re-measure whenever this changes — for an anchor that moves without the page scrolling or
   *  resizing, such as an element on a canvas being panned, zoomed or dragged. See
   *  `usePopoverPosition`. */
  trackKey?: string | number;
  /** Où mettre le focus une fois le panneau affiché (pas avant : un panneau encore masqué, le
   *  temps d'être positionné, ne peut pas le recevoir). `true` : le premier élément focalisable du
   *  panneau ; une fonction : l'élément qu'elle renvoie (ex. l'option choisie d'une liste). Omis
   *  (défaut) : le focus reste où il est — un sélecteur de date ouvert depuis son champ, par
   *  exemple, garde la saisie au clavier. */
  initialFocus?: boolean | ((panel: HTMLElement) => HTMLElement | null | undefined);
  children: ReactNode;
  className?: string;
}

/**
 * Low-level anchored floating panel: portals to `document.body`, positions
 * itself with collision detection (see `usePopoverPosition`), and closes on
 * outside click / Escape. Powers `Select`, `DatePicker`, and any menu-style
 * dropdown built on top of this library.
 *
 * Focus : à la fermeture, s'il était dans le panneau (ou perdu), il revient à l'ancre — sans quoi
 * il tomberait sur `<body>`, au début du document. Échap ne remonte pas plus haut que le panneau :
 * une `Modal` qui contient le déclencheur reste ouverte. Voir `initialFocus` pour l'ouverture.
 */
export function Popover({ open, onClose, anchorRef, placement = "bottom", matchAnchorWidth, trackKey, initialFocus, children, className }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const position = usePopoverPosition(anchorRef, panelRef, open, placement, trackKey);
  const theme = useLqTheme();

  // Focus initial, une seule fois par ouverture, dès que le panneau est visible.
  const initialFocusRef = useRef(initialFocus);
  initialFocusRef.current = initialFocus;
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      focusedRef.current = false;
      return;
    }
    const panel = panelRef.current;
    const wanted = initialFocusRef.current;
    if (!position.ready || focusedRef.current || !panel || !wanted) return;
    focusedRef.current = true;
    const target = typeof wanted === "function" ? wanted(panel) : focusableIn(panel)[0];
    target?.focus({ preventScroll: true });
  }, [open, position.ready]);

  // Retour du focus à l'ancre à la fermeture (y compris au démontage du panneau ouvert).
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const anchor = anchorRef.current;
    return () => {
      const current = document.activeElement;
      const lost = !current || current === document.body || !current.isConnected || !!panel?.contains(current);
      if (lost && anchor?.isConnected) anchor.focus({ preventScroll: true });
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Le panneau consomme Échap : une Modal autour (écouteur sur window) ne se ferme pas avec.
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const width = matchAnchorWidth ? anchorRef.current?.getBoundingClientRect().width : undefined;

  return createPortal(
    <LqThemeProvider palette={theme.palette} surface={theme.surface} font={theme.font} style={{ display: "contents" }}>
      <div
        ref={panelRef}
        className={["lq-popover", className].filter(Boolean).join(" ")}
        style={{
          top: position.top,
          left: position.left,
          width,
          visibility: position.ready ? "visible" : "hidden",
        }}
        data-placement={position.placement}
      >
        {children}
      </div>
    </LqThemeProvider>,
    document.body
  );
}
