import { Children, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons";
import { IconButton } from "./IconButton";
import "./Carousel.css";

export interface CarouselProps {
  /** One element per slide — each renders full-bleed in its own turn, e.g. a `Jumbotron` with its
   *  own `backgroundImage` for a rotating hero banner, or any other content. */
  children: ReactNode[];
  /** Uncontrolled initial slide. Default 0. */
  defaultIndex?: number;
  /** Controlled current slide — pass alongside `onIndexChange` to own navigation yourself. */
  index?: number;
  onIndexChange?: (index: number) => void;
  /** Auto-advances to the next slide every this many ms, pausing while hovered or while keyboard
   *  focus is inside the carousel. Never runs when the user asks for reduced motion
   *  (`prefers-reduced-motion: reduce`). Omit (default) or 0 to disable. */
  autoplayInterval?: number;
  /** Shows the previous/next arrow buttons. Default true. Both wrap around at either end. */
  arrows?: boolean;
  /** Shows the row of dot indicators. Default true. */
  dots?: boolean;
  /** Fixed height in px for the slide viewport. Default 320. */
  height?: number;
  /** Nom accessible du carrousel (ex. « Annonces »), annoncé avec son rôle. */
  ariaLabel?: string;
  className?: string;
}

/** Vrai quand le système demande moins d'animations ; suit le réglage s'il change en cours de route. */
function usePrefersReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mql = window.matchMedia?.(query);
    if (!mql) return;
    const onChange = () => setReduced(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** Full-bleed slideshow — one slide visible at a time, arrows and dots to navigate between them,
 *  optional autoplay. Each slide is left entirely to the caller (a `Jumbotron`, a promo card,
 *  anything), the same "compose, don't configure" shape as `TabbedCard`'s own tabs. */
export function Carousel({
  children,
  defaultIndex = 0,
  index,
  onIndexChange,
  autoplayInterval = 0,
  arrows = true,
  dots = true,
  height = 320,
  ariaLabel,
  className,
}: CarouselProps) {
  const slides = Children.toArray(children);
  const [internalIndex, setInternalIndex] = useState(Math.min(defaultIndex, Math.max(0, slides.length - 1)));
  const activeIndex = Math.min(index ?? internalIndex, Math.max(0, slides.length - 1));
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  function goTo(next: number) {
    const wrapped = ((next % slides.length) + slides.length) % slides.length;
    if (index === undefined) setInternalIndex(wrapped);
    onIndexChange?.(wrapped);
  }

  // Both read through a ref rather than listed as effect dependencies — `goTo` closes over
  // `index`/`onIndexChange` (a controlled caller's own callback, likely a fresh closure every one
  // of *its* renders) and `activeIndex` changes on every slide change, so depending on either
  // directly would tear the timer down and restart it constantly instead of ticking on a steady
  // `autoplayInterval` cadence. The interval callback always reads the latest of both this way.
  const goToRef = useRef(goTo);
  goToRef.current = goTo;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  useEffect(() => {
    if (!autoplayInterval || hovered || focusWithin || reducedMotion || slides.length < 2) return;
    const id = setInterval(() => goToRef.current(activeIndexRef.current + 1), autoplayInterval);
    return () => clearInterval(id);
  }, [autoplayInterval, hovered, focusWithin, reducedMotion, slides.length]);

  if (slides.length === 0) return null;

  return (
    <div
      className={["lq-carousel", arrows && slides.length > 1 && "lq-carousel--arrows", className].filter(Boolean).join(" ")}
      style={{ height }}
      role="region"
      aria-roledescription="carrousel"
      aria-label={ariaLabel}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // La lecture auto s'arrête tant que le clavier est dans le carrousel : une diapositive ne
      // doit pas défiler sous un bouton qu'on s'apprête à activer.
      onFocus={() => setFocusWithin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false);
      }}
    >
      <div className="lq-carousel__track" style={{ transform: `translateX(-${activeIndex * 100}%)` }}>
        {slides.map((slide, i) => (
          <div
            className="lq-carousel__slide"
            key={i}
            role="group"
            aria-roledescription="diapositive"
            aria-label={`${i + 1} sur ${slides.length}`}
            aria-hidden={i !== activeIndex}
            // Une diapositive cachée garde ses boutons hors de l'ordre de tabulation. `inert` en
            // chaîne vide : React 18 ne connaît pas l'attribut et refuserait un booléen.
            {...((i !== activeIndex ? { inert: "" } : {}) as Record<string, string>)}
          >
            {slide}
          </div>
        ))}
      </div>

      {arrows && slides.length > 1 && (
        <>
          <IconButton
            icon={<ChevronLeftIcon size={18} />}
            ariaLabel="Diapositive précédente"
            className="lq-carousel__arrow lq-carousel__arrow--prev"
            onClick={() => goTo(activeIndex - 1)}
          />
          <IconButton
            icon={<ChevronRightIcon size={18} />}
            ariaLabel="Diapositive suivante"
            className="lq-carousel__arrow lq-carousel__arrow--next"
            onClick={() => goTo(activeIndex + 1)}
          />
        </>
      )}

      {dots && slides.length > 1 && (
        <div className="lq-carousel__dots">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              className={["lq-carousel__dot", i === activeIndex && "lq-carousel__dot--active"].filter(Boolean).join(" ")}
              onClick={() => goTo(i)}
              aria-label={`Aller à la diapositive ${i + 1}`}
              aria-current={i === activeIndex}
            />
          ))}
        </div>
      )}
    </div>
  );
}
