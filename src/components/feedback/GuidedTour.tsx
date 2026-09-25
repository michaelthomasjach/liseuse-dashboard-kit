import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LqThemeProvider } from "../../theme";
import { useLqThemeOptional } from "../../theme/ThemeProvider";
import { CloseIcon } from "../icons";
import "./GuidedTour.css";

/**
 * La visite guidée d'une application — la carte d'accueil qui **se déplace** d'un endroit à
 * l'autre de l'écran pour présenter chacun.
 *
 * ## Une carte qui marche, pas une suite de modales
 *
 * Une visite qui empile des fenêtres au milieu de l'écran explique l'application en la cachant.
 * Celle-ci pose sa carte **à côté** de ce qu'elle décrit, entoure la cible d'un anneau, et glisse
 * d'une cible à la suivante (une transition sur sa position, comme `WorkspaceTour`) : l'œil suit la
 * carte, et la carte l'emmène là où il faut regarder. Rien n'est bloqué — l'anneau laisse passer le
 * pointeur, et l'on peut cliquer la chose montrée sans fermer la visite.
 *
 * Une étape **sans cible** (pas de `selector`, ou `placement: "center"`) est un moment d'accueil :
 * la carte se pose au milieu, sur un voile léger — un mot de bienvenue, un « c'est parti ! ».
 *
 * ## Les étapes qui préparent l'écran
 *
 * Une étape peut avoir besoin que l'application change de vue avant d'être montrée — ouvrir un
 * onglet, cadrer le plan sur un bâtiment. `onEnter` est appelé **avant** l'étape (et attendu s'il
 * rend une promesse) ; la visite attend ensuite que sa cible apparaisse, au plus `waitMs`. Une cible
 * qui n'apparaît jamais ne fait pas sauter l'étape : elle est montrée au milieu, ce qui vaut mieux
 * qu'un trou dans l'explication.
 *
 * La carte suit sa cible : un défilement, un redimensionnement, une cible qui bouge ou change de
 * taille — on relit sa boîte à chaque image tant que la visite est ouverte.
 *
 * Au clavier : Échap ferme, → et ← passent d'une étape à l'autre.
 *
 * ## Sur un téléphone
 *
 * Sur un écran de 640 px de large ou moins, il n'y a plus de « côté » où poser une carte de 340 px
 * sans cacher ce qu'elle montre : la carte devient une **feuille** accrochée au bas de l'écran, de
 * toute sa largeur, arrondie en haut, au-dessus de la barre de geste (`env(safe-area-inset-bottom)`).
 * L'anneau continue d'entourer la cible ; si celle-ci tombe sous la feuille, on fait défiler la page
 * pour la ramener dans la partie haute, restée libre ; une cible tout en bas de la page, que rien ne
 * peut plus remonter, fait passer la feuille en haut de l'écran. La feuille ne dépasse jamais l'écran : trop
 * longue, elle défile elle-même. Ses boutons prennent la taille d'un doigt.
 */

export type GuidedTourPlacement = "auto" | "right" | "left" | "below" | "above" | "center";

export interface GuidedTourStep {
  id?: string;
  /** Un sélecteur CSS de ce que l'étape présente. Absent : l'étape est centrée. */
  selector?: string;
  title: string;
  body: ReactNode;
  /** Une icône, une illustration, au-dessus du titre. */
  media?: ReactNode;
  /** Où poser la carte par rapport à la cible. Défaut : `auto` — là où il y a la place. */
  placement?: GuidedTourPlacement;
  /** Préparer l'écran avant l'étape : changer de vue, cadrer. Attendu s'il rend une promesse. */
  onEnter?: () => void | Promise<void>;
  /** Combien de temps attendre que la cible apparaisse après `onEnter`, en ms. Défaut : 1 500. */
  waitMs?: number;
}

export interface GuidedTourLabels {
  next?: string;
  previous?: string;
  finish?: string;
  skip?: string;
  close?: string;
}

export interface GuidedTourProps {
  open: boolean;
  steps: GuidedTourStep[];
  /** Fermer la visite — par la croix, « Passer la visite », Échap, ou à la fin. */
  onClose: () => void;
  /** La visite est allée jusqu'au bout (le bouton final). Appelé avant `onClose`. */
  onFinish?: () => void;
  /** L'étape par laquelle commencer, à l'ouverture. */
  initialIndex?: number;
  /** Une étape est montrée. */
  onStepChange?: (index: number, step: GuidedTourStep) => void;
  labels?: GuidedTourLabels;
}

const DEFAULT_LABELS: Required<GuidedTourLabels> = {
  next: "Suivant",
  previous: "Précédent",
  finish: "C'est parti !",
  skip: "Passer la visite",
  close: "Fermer",
};

const GAP = 16;
const EDGE = 12;
const RING_PAD = 6;

type Box = { top: number; left: number; width: number; height: number };
type Side = "right" | "left" | "below" | "above" | "center";

/** Poser la carte près de sa cible, du côté demandé s'il y a la place, sinon là où il y en a. */
function placeCard(target: Box | null, card: { w: number; h: number }, want: GuidedTourPlacement): { top: number; left: number; side: Side } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(EDGE, x), Math.max(EDGE, vw - card.w - EDGE));
  const clampY = (y: number) => Math.min(Math.max(EDGE, y), Math.max(EDGE, vh - card.h - EDGE));
  if (!target || want === "center") return { left: clampX((vw - card.w) / 2), top: clampY((vh - card.h) / 2), side: "center" };
  const right = target.left + target.width;
  const bottom = target.top + target.height;
  const fits: Record<Exclude<Side, "center">, boolean> = {
    right: right + GAP + card.w + EDGE <= vw,
    left: target.left - GAP - card.w - EDGE >= 0,
    below: bottom + GAP + card.h + EDGE <= vh,
    above: target.top - GAP - card.h - EDGE >= 0,
  };
  const order: Exclude<Side, "center">[] = want === "auto" ? ["right", "left", "below", "above"] : [want, "right", "left", "below", "above"];
  const side = order.find((s) => fits[s]);
  // Une cible qui occupe tout l'écran : la carte se pose au milieu, par-dessus.
  if (!side) return { left: clampX((vw - card.w) / 2), top: clampY((vh - card.h) / 2), side: "center" };
  const midY = target.top + target.height / 2 - card.h / 2;
  const midX = target.left + target.width / 2 - card.w / 2;
  if (side === "right") return { left: clampX(right + GAP), top: clampY(midY), side };
  if (side === "left") return { left: clampX(target.left - GAP - card.w), top: clampY(midY), side };
  if (side === "below") return { left: clampX(midX), top: clampY(bottom + GAP), side };
  return { left: clampX(midX), top: clampY(target.top - GAP - card.h), side };
}

/** La requête qui fait passer la carte en feuille — la même que dans GuidedTour.css. */
const SHEET_QUERY = "(max-width: 640px)";

/** L'écran est-il assez étroit pour la feuille ? Suivi en direct : un téléphone qu'on tourne. */
function useSheetLayout(): boolean {
  const [sheet, setSheet] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(SHEET_QUERY).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(SHEET_QUERY);
    const onChange = () => setSheet(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return sheet;
}

const sameBox = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5);

export function GuidedTour({ open, steps, onClose, onFinish, initialIndex = 0, onStepChange, labels }: GuidedTourProps) {
  const L = { ...DEFAULT_LABELS, ...labels };
  // Hors d'un thème du kit, la visite s'affiche quand même, avec les couleurs de la page.
  const theme = useLqThemeOptional();
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const count = steps.length;
  const clamp = useCallback((i: number) => Math.max(0, Math.min(stepsRef.current.length - 1, i)), []);

  /** L'étape demandée, et celle qui est montrée — une fois son écran prêt et sa cible trouvée. */
  const [index, setIndex] = useState(() => clamp(initialIndex));
  const [shown, setShown] = useState<{ index: number; target: Element | null } | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [card, setCard] = useState({ w: 340, h: 220 });
  const [, setViewport] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const sheet = useSheetLayout();
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;
  const titleId = useId();
  const bodyId = useId();

  // À chaque ouverture, on repart de l'étape initiale.
  useEffect(() => {
    if (open) setIndex(clamp(initialIndex));
    else {
      setShown(null);
      setBox(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Préparer l'étape, puis attendre sa cible. Lue par une référence : un tableau d'étapes recréé à
  // chaque rendu de l'application ne doit pas rappeler `onEnter`.
  useEffect(() => {
    if (!open) return;
    const step = stepsRef.current[index];
    if (!step) return;
    let cancelled = false;
    let timer: number | undefined;
    const run = async () => {
      try {
        await step.onEnter?.();
      } catch {
        // Une préparation qui échoue n'arrête pas la visite : l'étape sera montrée au milieu.
      }
      if (cancelled) return;
      if (!step.selector || step.placement === "center") {
        setShown({ index, target: null });
        return;
      }
      const started = performance.now();
      const wait = step.waitMs ?? 1500;
      const poll = () => {
        if (cancelled) return;
        const el = document.querySelector(step.selector as string);
        if (el || performance.now() - started >= wait) {
          setShown({ index, target: el });
          return;
        }
        timer = window.setTimeout(poll, 60);
      };
      poll();
    };
    void run();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [open, index]);

  const shownStep = shown ? stepsRef.current[shown.index] ?? null : null;

  // Prévenir l'application, amener la cible à l'écran, et donner le focus à la carte.
  useEffect(() => {
    if (!shown || !shownStep) return;
    onStepChange?.(shown.index, shownStep);
    const el = shown.target;
    if (el) {
      const r = el.getBoundingClientRect();
      const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (sheetRef.current) {
        // En feuille, seule la partie de l'écran au-dessus de la carte est libre : une cible qui
        // passe dessous (ou dépasse en haut) est ramenée en tête de page, avec un peu d'air.
        const free = window.innerHeight - (cardRef.current?.offsetHeight ?? 0) - GAP;
        const hidden = r.top < 0 || r.bottom > free || r.right < 0 || r.left > window.innerWidth;
        if (hidden && "scrollIntoView" in el) {
          const h = el as HTMLElement;
          const before = h.style.scrollMarginTop;
          h.style.scrollMarginTop = `${GAP * 2}px`;
          h.scrollIntoView({ block: "start", inline: "nearest", behavior: smooth ? "smooth" : "auto" });
          h.style.scrollMarginTop = before;
        }
      } else {
        const off = r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth;
        if (off && "scrollIntoView" in el) (el as HTMLElement).scrollIntoView({ block: "center", inline: "nearest", behavior: smooth ? "smooth" : "auto" });
      }
    }
    cardRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  // Suivre la cible à chaque image : défilement, redimensionnement, cible qui bouge ou grandit.
  useEffect(() => {
    if (!open || !shown) return;
    let raf = 0;
    let target = shown.target;
    const selector = shownStep?.selector;
    const loop = () => {
      if (target && !target.isConnected) target = selector ? document.querySelector(selector) : null;
      const r = target?.getBoundingClientRect();
      const next = r && (r.width > 0 || r.height > 0) ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      setBox((b) => (sameBox(b, next) ? b : next));
      raf = requestAnimationFrame(loop);
    };
    loop();
    const onResize = () => setViewport((v) => v + 1);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [open, shown, shownStep?.selector]);

  // La taille de la carte, pour la poser : elle change avec le contenu de l'étape.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => setCard((c) => (Math.abs(c.w - el.offsetWidth) < 1 && Math.abs(c.h - el.offsetHeight) < 1 ? c : { w: el.offsetWidth, h: el.offsetHeight }));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shown]);

  const go = useCallback(
    (to: number) => {
      if (to < 0) return;
      if (to >= stepsRef.current.length) {
        onFinish?.();
        onClose();
        return;
      }
      setIndex(to);
    },
    [onClose, onFinish]
  );

  // Au clavier : Échap ferme, les flèches naviguent — sauf dans un champ de saisie.
  const current = shown?.index ?? index;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(current + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, go, current]);

  if (!open || typeof document === "undefined") return null;
  const step = shownStep;
  const targeted = !!step && !!shown?.target && !!box && step.placement !== "center";
  const pos = placeCard(targeted ? box : null, card, step?.placement ?? "auto");
  const last = current >= count - 1;
  const pending = !shown || shown.index !== index;
  // Une cible collée au bas de la page, que le défilement ne peut plus remonter : la feuille la
  // couvrirait. Elle passe alors en haut de l'écran, s'il y a la place au-dessus de la cible.
  const sheetTop =
    sheet && targeted && !!box && box.top + box.height > window.innerHeight - card.h - GAP && box.top - GAP >= card.h;

  const content = (
    <>
      {!targeted && <div className="lq-gtour__backdrop" aria-hidden="true" />}
      {targeted && box && (
        <div
          className="lq-gtour__ring"
          style={{ top: box.top - RING_PAD, left: box.left - RING_PAD, width: box.width + RING_PAD * 2, height: box.height + RING_PAD * 2 }}
          aria-hidden="true"
        />
      )}
      <div
        ref={cardRef}
        className={["lq-gtour__card", !targeted && "lq-gtour__card--center", sheet && "lq-gtour__card--sheet", sheetTop && "lq-gtour__card--sheet-top", pending && "lq-gtour__card--pending", step && `lq-gtour__card--${pos.side}`].filter(Boolean).join(" ")}
        // En feuille, la position vient de la feuille de style (le bas de l'écran) : pas de coordonnées.
        style={!step ? { visibility: "hidden" } : sheet ? undefined : { top: pos.top, left: pos.left }}
        role="dialog"
        aria-modal={!targeted}
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        aria-busy={pending}
        tabIndex={-1}
      >
        {step && (
          <>
            <div className="lq-gtour__head">
              <span className="lq-gtour__count">
                {current + 1} / {count}
              </span>
              <button type="button" className="lq-gtour__close" onClick={onClose} aria-label={L.close} title={L.close}>
                <CloseIcon size={12} />
              </button>
            </div>
            {step.media && <div className="lq-gtour__media">{step.media}</div>}
            <h3 id={titleId} className="lq-gtour__title">
              {step.title}
            </h3>
            <div id={bodyId} className="lq-gtour__body">
              {step.body}
            </div>
            <div className="lq-gtour__dots" aria-hidden="true">
              {steps.map((s, i) => (
                <span key={s.id ?? i} className={["lq-gtour__dot", i === current && "is-current", i < current && "is-done"].filter(Boolean).join(" ")} />
              ))}
            </div>
            <div className="lq-gtour__actions">
              {!last ? (
                <button type="button" className="lq-gtour__skip" onClick={onClose}>
                  {L.skip}
                </button>
              ) : (
                <span />
              )}
              <div className="lq-gtour__nav">
                {current > 0 && (
                  <button type="button" className="lq-gtour__prev" onClick={() => go(current - 1)}>
                    {L.previous}
                  </button>
                )}
                <button type="button" className="lq-gtour__next" onClick={() => go(current + 1)}>
                  {last ? L.finish : L.next}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );

  return createPortal(
    theme ? (
      <LqThemeProvider palette={theme.palette} surface={theme.surface} font={theme.font} style={{ display: "contents" }}>
        {content}
      </LqThemeProvider>
    ) : (
      content
    ),
    document.body
  );
}
