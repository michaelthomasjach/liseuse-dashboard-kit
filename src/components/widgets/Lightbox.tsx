import { useCallback, useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "../icons";
import { LqThemeProvider, useLqTheme } from "../../theme";
import "./Lightbox.css";

export interface LightboxImage {
  /** Adresse de l'image affichée en grand. */
  src: string;
  /** Texte de remplacement — obligatoire : c'est tout ce qu'un lecteur d'écran saura de l'image. */
  alt: string;
  /** Titre court, affiché en gras au-dessus de la légende. */
  title?: ReactNode;
  /** Légende, sous l'image. */
  caption?: ReactNode;
  /** Vignette pour la bande du bas ; `src` à défaut. */
  thumbnail?: string;
  /** Dimensions naturelles, si on les connaît : elles réservent la place avant le chargement. */
  width?: number;
  height?: number;
}

export interface LightboxLabels {
  /** Nom de la boîte de dialogue. Défaut « Visionneuse d'images ». */
  dialog?: string;
  close?: string;
  previous?: string;
  next?: string;
  /** Nom de la bande de vignettes. Défaut « Vignettes ». */
  thumbnails?: string;
  /** Le compteur, « 3 / 12 » par défaut. Reçoit une position à partir de 1. */
  counter?: (position: number, total: number) => string;
}

export interface LightboxProps {
  images: LightboxImage[];
  /** Position de l'image affichée, à partir de 0. Ramenée dans les bornes si elle en sort. */
  index: number;
  /** Demande d'aller à une autre image (flèches, boutons, vignettes, balayage). */
  onIndexChange: (index: number) => void;
  open: boolean;
  /** Échap, la croix, ou un clic sur le fond. */
  onClose: () => void;
  /** La bande de vignettes en bas. Défaut `true` (masquée d'elle-même s'il n'y a qu'une image). */
  thumbnails?: boolean;
  /** Après la dernière image, revenir à la première (et inversement). Défaut `true`. */
  loop?: boolean;
  /** Le compteur « 3 / 12 ». Défaut `true`. */
  showCounter?: boolean;
  /** `"dark"` (défaut) : la visionneuse prend toujours la surface sombre du thème, comme une
   *  table lumineuse — une photo se lit mieux sur un fond éteint. `"inherit"` : la surface de
   *  l'application. La palette (e-ink ou couleur) est toujours celle de l'application. */
  surface?: "dark" | "inherit";
  /** Un clic sur le fond (autour de l'image) ferme. Défaut `true`. */
  closeOnBackdrop?: boolean;
  labels?: LightboxLabels;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const defaultCounter = (position: number, total: number) => `${position} / ${total}`;

/**
 * Visionneuse d'images plein écran, entièrement contrôlée : l'application tient `open` et `index`,
 * la visionneuse ne fait que demander d'en changer.
 *
 * Clavier : ← et → passent d'une image à l'autre, Début et Fin vont aux extrémités, Échap ferme.
 * Le focus est piégé dans la visionneuse tant qu'elle est ouverte (Tab et Maj+Tab tournent entre
 * ses commandes) et rendu, à la fermeture, à l'élément qui l'avait — en général la vignette de la
 * galerie qui l'a ouverte. Le défilement de la page est suspendu pendant ce temps. Au doigt, un
 * balayage horizontal change d'image.
 *
 * Rendue dans un portail vers `document.body`, comme `Modal` et pour la même raison, et ré-enveloppée
 * d'un `LqThemeProvider` qui reprend palette, police et classe de thème de l'application.
 */
export function Lightbox({
  images,
  index,
  onIndexChange,
  open,
  onClose,
  thumbnails = true,
  loop = true,
  showCounter = true,
  surface = "dark",
  closeOnBackdrop = true,
  labels,
}: LightboxProps) {
  const theme = useLqTheme();
  const dialogRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{ x: number; y: number; id: number } | null>(null);
  const titleId = useId();

  const total = images.length;
  const current = total > 0 ? Math.min(Math.max(index, 0), total - 1) : -1;
  const image = current >= 0 ? images[current] : undefined;
  const hasPrev = total > 1 && (loop || current > 0);
  const hasNext = total > 1 && (loop || current < total - 1);

  const go = useCallback(
    (delta: number) => {
      if (total < 2) return;
      let next = current + delta;
      if (loop) next = (next + total) % total;
      else next = Math.min(Math.max(next, 0), total - 1);
      if (next !== current) onIndexChange(next);
    },
    [current, total, loop, onIndexChange]
  );

  // Le focus : pris à l'ouverture, rendu à la fermeture. useLayoutEffect pour que le focus parte
  // avant que le navigateur ne peigne — sinon l'anneau de focus clignote sur la vignette d'origine.
  useLayoutEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus({ preventScroll: true });
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (previous && typeof previous.focus === "function" && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);

  // La vignette courante reste visible dans la bande, quel que soit le chemin pris pour y arriver.
  useEffect(() => {
    if (!open) return;
    const strip = stripRef.current;
    const thumb = strip?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!strip || !thumb) return;
    const left = thumb.offsetLeft - (strip.clientWidth - thumb.offsetWidth) / 2;
    strip.scrollTo({ left: Math.max(0, left) });
  }, [open, current]);

  // Les voisines se chargent d'avance : le passage à la suivante ne montre pas un cadre vide.
  useEffect(() => {
    if (!open || total < 2) return;
    for (const d of [1, -1]) {
      const n = images[(current + d + total) % total];
      if (n) new Image().src = n.src;
    }
  }, [open, current, total, images]);

  if (!open || !image) return null;

  const t = {
    dialog: labels?.dialog ?? "Visionneuse d'images",
    close: labels?.close ?? "Fermer",
    previous: labels?.previous ?? "Image précédente",
    next: labels?.next ?? "Image suivante",
    thumbnails: labels?.thumbnails ?? "Vignettes",
    counter: labels?.counter ?? defaultCounter,
  };

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "Home") {
      e.preventDefault();
      if (current !== 0) onIndexChange(0);
    } else if (e.key === "End") {
      e.preventDefault();
      if (current !== total - 1) onIndexChange(total - 1);
    } else if (e.key === "Tab") {
      // Le piège : Tab sur la dernière commande revient à la première, Maj+Tab l'inverse.
      const root = dialogRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") return;
    swipeRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const s = swipeRef.current;
    swipeRef.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  }

  const showStrip = thumbnails && total > 1;

  return createPortal(
    <LqThemeProvider palette={theme.palette} surface={surface === "dark" ? "dark" : theme.surface} font={theme.font} style={{ display: "contents" }}>
      <div
        ref={dialogRef}
        className="lq-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={t.dialog}
        aria-roledescription="visionneuse"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="lq-lightbox__bar">
          {showCounter && total > 1 ? (
            <span className="lq-lightbox__counter" aria-live="polite" aria-atomic="true">
              {t.counter(current + 1, total)}
            </span>
          ) : (
            <span />
          )}
          <button type="button" className="lq-lightbox__button lq-lightbox__close" onClick={onClose} aria-label={t.close}>
            <CloseIcon size={20} />
          </button>
        </div>

        <div
          className="lq-lightbox__stage"
          onClick={closeOnBackdrop ? (e) => e.target === e.currentTarget && onClose() : undefined}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (swipeRef.current = null)}
        >
          <button
            type="button"
            className="lq-lightbox__button lq-lightbox__nav lq-lightbox__nav--prev"
            onClick={() => go(-1)}
            disabled={!hasPrev}
            aria-label={t.previous}
            hidden={total < 2}
          >
            <ChevronLeftIcon size={26} />
          </button>
          <figure className="lq-lightbox__figure" aria-labelledby={image.title ? titleId : undefined}>
            <img
              key={image.src}
              className="lq-lightbox__image"
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              draggable={false}
            />
            {(image.title || image.caption) && (
              <figcaption className="lq-lightbox__caption">
                {image.title && (
                  <span id={titleId} className="lq-lightbox__title">
                    {image.title}
                  </span>
                )}
                {image.caption && <span className="lq-lightbox__text">{image.caption}</span>}
              </figcaption>
            )}
          </figure>
          <button
            type="button"
            className="lq-lightbox__button lq-lightbox__nav lq-lightbox__nav--next"
            onClick={() => go(1)}
            disabled={!hasNext}
            aria-label={t.next}
            hidden={total < 2}
          >
            <ChevronRightIcon size={26} />
          </button>
        </div>

        {showStrip && (
          <div ref={stripRef} className="lq-lightbox__strip" role="group" aria-label={t.thumbnails}>
            {images.map((img, i) => (
              <button
                key={i}
                type="button"
                className={i === current ? "lq-lightbox__thumb lq-lightbox__thumb--active" : "lq-lightbox__thumb"}
                aria-current={i === current ? "true" : undefined}
                aria-label={`${t.counter(i + 1, total)} — ${img.alt}`}
                onClick={() => i !== current && onIndexChange(i)}
              >
                <img src={img.thumbnail ?? img.src} alt="" draggable={false} loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>
    </LqThemeProvider>,
    document.body
  );
}
