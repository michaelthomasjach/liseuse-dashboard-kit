import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { LqThemeProvider } from "../../theme";
import { useLqThemeOptional } from "../../theme/ThemeProvider";
import "./Tooltip.css";

/**
 * Une **infobulle** générique : quelques mots qui apparaissent près d'un élément quand on le survole
 * ou qu'on y arrive au clavier — le nom d'un bouton qui n'affiche qu'une icône, le détail d'une jauge.
 *
 * ## Dans un portail, et pourquoi
 *
 * L'infobulle n'est pas rendue à côté de son ancre mais dans `document.body`, en `position: fixed`,
 * placée d'après le rectangle de l'ancre à l'écran. C'est le seul moyen de ne jamais être rognée :
 * une barre d'outils qui défile horizontalement, une carte en `overflow: hidden`, un panneau posé
 * sur une scène 3D coupent tout ce qui dépasse d'eux, et une infobulle dépasse par définition.
 *
 * Le prix du portail, c'est de sortir de l'arbre thémé : les jetons `--lq-color-…` sont posés sur
 * l'élément `.lq-root` de `LqThemeProvider`, et `document.body` n'en hérite pas. Le contenu du
 * portail est donc ré-enveloppé dans un `LqThemeProvider` qui reprend le thème courant, en
 * `display: contents` pour que ce fournisseur n'ajoute aucune boîte à la mise en page. Hors de tout
 * thème, l'infobulle s'affiche telle quelle, sur les couleurs de repli de sa feuille de style.
 *
 * ## Placement
 *
 * Le côté demandé (`placement`, en haut par défaut) est un souhait, pas une contrainte : s'il n'y a
 * pas la place de ce côté-là, l'infobulle passe du côté opposé, puis elle est ramenée dans l'écran
 * sur l'autre axe. La position est recalculée tant qu'elle est visible, au défilement (de n'importe
 * quel conteneur, d'où l'écoute en phase de capture) comme au redimensionnement.
 *
 * ## Quand elle apparaît
 *
 * Au survol d'une souris ou d'un stylet, après un court délai (`delay`) — sans lui, balayer une
 * barre d'outils du regard ferait clignoter une infobulle par bouton. À la prise de focus, pour le
 * clavier. Elle disparaît quand le pointeur s'en va, quand le focus part, à la touche Échap, et dès
 * qu'on appuie sur l'ancre : on a cliqué, on sait ce que fait le bouton.
 *
 * Le tactile est laissé de côté exprès : un doigt qui touche un bouton lui donne aussi le focus, et
 * une infobulle qui surgirait à chaque tape — puis resterait là, puisque le focus reste — gênerait
 * plus qu'elle n'aiderait. Un appui tactile désarme donc la prise de focus qui le suit.
 *
 * ## Accessibilité
 *
 * La bulle porte `role="tooltip"` et un identifiant ; tant qu'elle est visible, l'ancre la désigne
 * par `aria-describedby`. Quand l'enfant est un élément React unique (le cas courant : un bouton),
 * c'est lui qui reçoit l'attribut, fusionné avec le sien s'il en a déjà un — un lecteur d'écran lit
 * la description de l'élément qui a le focus, pas celle d'un conteneur autour. Sinon, c'est
 * l'enveloppe. La bulle ignore le pointeur (`pointer-events: none`) : elle ne vole jamais un clic.
 */

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface TooltipProps {
  /** Ce que dit l'infobulle. Rien (`null`, `""`) : pas d'infobulle du tout. */
  content: ReactNode;
  /** L'ancre. Un élément unique reçoit `aria-describedby` ; tout le reste est simplement enveloppé. */
  children: ReactElement | ReactNode;
  /** Le côté souhaité ; retourné s'il n'y a pas la place. Défaut : `"top"`. */
  placement?: TooltipPlacement;
  /** Délai avant l'apparition au survol, en millisecondes. Défaut : 250. */
  delay?: number;
  /** Coupe l'infobulle sans démonter l'ancre. */
  disabled?: boolean;
  /** Classe ajoutée à la bulle. */
  className?: string;
  /** Classe ajoutée à l'enveloppe de l'ancre (un `span` en `inline-flex`). */
  anchorClassName?: string;
}

/** Écart entre l'ancre et la bulle, et marge minimale gardée avec les bords de l'écran, en px. */
const GAP = 8;
const MARGIN = 6;

const OPPOSITE: Record<TooltipPlacement, TooltipPlacement> = { top: "bottom", bottom: "top", left: "right", right: "left" };

interface Position {
  top: number;
  left: number;
  side: TooltipPlacement;
}

/** Place une bulle de taille `w`×`h` autour de `a`, du côté souhaité si la place le permet, sinon du
 *  côté opposé, puis la ramène dans l'écran sur l'axe transversal. */
function computePosition(a: DOMRect, w: number, h: number, wanted: TooltipPlacement): Position {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const fits = (side: TooltipPlacement) => {
    switch (side) {
      case "top":
        return a.top - GAP - h >= MARGIN;
      case "bottom":
        return a.bottom + GAP + h <= vh - MARGIN;
      case "left":
        return a.left - GAP - w >= MARGIN;
      case "right":
        return a.right + GAP + w <= vw - MARGIN;
    }
  };
  const side = fits(wanted) || !fits(OPPOSITE[wanted]) ? wanted : OPPOSITE[wanted];
  let top: number;
  let left: number;
  if (side === "top" || side === "bottom") {
    top = side === "top" ? a.top - GAP - h : a.bottom + GAP;
    left = a.left + a.width / 2 - w / 2;
  } else {
    left = side === "left" ? a.left - GAP - w : a.right + GAP;
    top = a.top + a.height / 2 - h / 2;
  }
  const clamp = (v: number, max: number) => Math.min(Math.max(v, MARGIN), Math.max(MARGIN, max - MARGIN));
  return { top: clamp(top, vh - h), left: clamp(left, vw - w), side };
}

export function Tooltip({ content, children, placement = "top", delay = 250, disabled, className, anchorClassName }: TooltipProps) {
  const theme = useLqThemeOptional();
  const id = `lq-tooltip-${useId().replace(/:/g, "")}`;
  const anchorRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  // Un appui tactile vient de toucher l'ancre : la prise de focus qui suit ne doit pas ouvrir la bulle.
  const touchFocus = useRef(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position | null>(null);

  const empty = content === null || content === undefined || content === false || content === "";
  const active = open && !disabled && !empty;

  const show = useCallback((wait: number) => {
    window.clearTimeout(timer.current);
    if (wait <= 0) setOpen(true);
    else timer.current = window.setTimeout(() => setOpen(true), wait);
  }, []);
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
    setPos(null);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Mesure et placement : avant peinture, pour que la bulle n'apparaisse jamais au mauvais endroit.
  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const bubble = bubbleRef.current;
    if (!anchor || !bubble) return;
    // L'enveloppe peut n'avoir aucune boîte propre (un enfant en `display: contents`…) : on prend
    // alors le premier élément qu'elle contient.
    let rect = anchor.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && anchor.firstElementChild) rect = anchor.firstElementChild.getBoundingClientRect();
    setPos(computePosition(rect, bubble.offsetWidth, bubble.offsetHeight, placement));
  }, [placement]);

  useLayoutEffect(() => {
    if (!active) return;
    place();
  }, [active, place, content]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      document.removeEventListener("keydown", onKey);
    };
  }, [active, place, hide]);

  const onPointerEnter = (e: ReactPointerEvent) => {
    if (e.pointerType !== "touch") show(delay);
  };
  const onPointerLeave = (e: ReactPointerEvent) => {
    // Le focus peut rester dans l'ancre après un clic : c'est le pointeur qui s'en va, on ferme quand même.
    if (e.pointerType !== "touch") hide();
  };
  const onPointerDown = (e: ReactPointerEvent) => {
    touchFocus.current = e.pointerType === "touch";
    hide();
  };
  const onFocus = () => {
    if (touchFocus.current) {
      touchFocus.current = false;
      return;
    }
    // Au clavier, pas de délai : on n'arrive pas sur un bouton « par hasard » en tabulant.
    show(0);
  };
  const onBlur = (e: ReactFocusEvent) => {
    // Le focus qui passe d'un élément à l'autre *dans* l'ancre ne la quitte pas.
    if (e.relatedTarget instanceof Node && anchorRef.current?.contains(e.relatedTarget)) return;
    hide();
  };

  const describedBy = active ? id : undefined;
  let anchorChild: ReactNode = children;
  let wrapperDescribedBy: string | undefined = describedBy;
  if (isValidElement<{ "aria-describedby"?: string }>(children)) {
    const own = children.props["aria-describedby"];
    anchorChild = cloneElement(children, { "aria-describedby": [own, describedBy].filter(Boolean).join(" ") || undefined });
    wrapperDescribedBy = undefined;
  }

  const style: CSSProperties = pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: "hidden" };
  const bubble = active ? (
    <div
      ref={bubbleRef}
      id={id}
      role="tooltip"
      className={["lq-tooltip", `lq-tooltip--${pos?.side ?? placement}`, className].filter(Boolean).join(" ")}
      style={style}
    >
      {content}
    </div>
  ) : null;

  return (
    <>
      <span
        ref={anchorRef}
        className={["lq-tooltip-anchor", anchorClassName].filter(Boolean).join(" ")}
        aria-describedby={wrapperDescribedBy}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        {anchorChild}
      </span>
      {bubble &&
        typeof document !== "undefined" &&
        createPortal(
          theme ? (
            <LqThemeProvider palette={theme.palette} surface={theme.surface} font={theme.font} style={{ display: "contents" }}>
              {bubble}
            </LqThemeProvider>
          ) : (
            bubble
          ),
          document.body
        )}
    </>
  );
}
