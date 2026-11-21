import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon } from "../icons";
import "./CurvedCarousel.css";

export interface CurvedCarouselItem {
  id: string;
  /** Image de la carte, recadrée pour la remplir (`object-fit: cover`). */
  src?: string;
  /** Texte alternatif de l'image. Vide par défaut : l'image est décorative si un titre l'accompagne. */
  alt?: string;
  /** Titre posé en bas de la carte, sur un dégradé qui le garde lisible. */
  title?: ReactNode;
  /** Ligne courte sous le titre. */
  caption?: ReactNode;
  /** Contenu libre à la place de l'image (une carte chiffrée, un graphique…). */
  content?: ReactNode;
  /** Lien ouvert au clic sur la carte. */
  href?: string;
  /** Appelé au clic sur la carte (un glisser n'est pas un clic). */
  onClick?: () => void;
}

export interface CurvedCarouselProps {
  items: CurvedCarouselItem[];
  /** Largeur d'une carte, en px. Défaut 240. */
  cardWidth?: number;
  /** Hauteur d'une carte, en px. Défaut 300. */
  cardHeight?: number;
  /** Espace entre deux cartes, en px. Défaut 14. */
  gap?: number;
  /**
   * Courbure de la rangée, de 0 (droite) à 1 (très creusée). Les cartes suivent l'intérieur d'un
   * cylindre : celles des bords se tournent vers le centre et grandissent. Défaut 0.55.
   */
  curvature?: number;
  /**
   * Défilement automatique, en px par seconde. Défaut 32 ; 0 pour une rangée immobile. Jamais
   * lancé quand le système demande moins d'animations (`prefers-reduced-motion: reduce`).
   */
  speed?: number;
  /** Sens du défilement automatique. Défaut `"left"` (les cartes partent vers la gauche). */
  direction?: "left" | "right";
  /** Ralentit jusqu'à l'arrêt au survol de la souris. Défaut true. */
  pauseOnHover?: boolean;
  /** Montre le bouton lecture / pause et les flèches. Défaut true. */
  controls?: boolean;
  /** Nom accessible du carrousel (ex. « Réalisations »). */
  ariaLabel?: string;
  className?: string;
}

/** Vrai quand le système demande moins d'animations ; suit le réglage s'il change. */
function useReducedMotion() {
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

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * Rangée de cartes posée sur une courbe creuse, qui défile toute seule en boucle.
 *
 * Les cartes suivent l'intérieur d'un cylindre : au centre elles sont de face, vers les bords elles
 * se tournent vers le lecteur et grandissent un peu, ce qui donne la profondeur. La rangée tourne
 * sans fin (les cartes sont recopiées autant qu'il faut pour couvrir la largeur). On la prend à la
 * souris ou au doigt pour la faire glisser — elle garde l'élan au lâcher —, on la fait défiler à la
 * molette horizontale ou avec les flèches du clavier ; le survol la ralentit jusqu'à l'arrêt.
 *
 * Tout le mouvement est écrit directement dans le style des cartes à chaque image (aucun rendu React
 * par image) et s'arrête quand le carrousel sort de l'écran ou que l'onglet est caché.
 */
export function CurvedCarousel({
  items,
  cardWidth = 240,
  cardHeight = 300,
  gap = 14,
  curvature = 0.55,
  speed = 32,
  direction = "left",
  pauseOnHover = true,
  controls = true,
  ariaLabel = "Carrousel",
  className,
}: CurvedCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useReducedMotion();

  const step = cardWidth + gap;
  const n = items.length;
  // Assez de copies pour que la boucle dépasse la largeur visible d'au moins deux cartes de chaque côté.
  const copies = n === 0 ? 0 : Math.max(1, Math.ceil((viewportWidth + 4 * step) / (n * step)));
  const total = copies * n;
  const loop = total * step;

  // État du mouvement, hors de React : position, vitesse courante, glisser en cours.
  const motion = useRef({ offset: 0, velocity: 0, target: null as number | null, hover: false, focus: false, visible: true, dragging: false, lastX: 0, lastT: 0, dragVelocity: 0, moved: 0 });
  const autoplay = reducedMotion || paused ? 0 : speed * (direction === "left" ? -1 : 1);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportWidth(el.clientWidth));
    ro.observe(el);
    setViewportWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  /** Place chaque carte sur la courbe à partir de la position courante. */
  const layout = useCallback(() => {
    if (!loop || !viewportWidth) return;
    const { offset } = motion.current;
    const k = Math.max(0, Math.min(1, curvature));
    // Rayon du cylindre : plus la courbure est forte, plus il est petit. À 0, une ligne droite.
    const maxAngle = (k * 62 * Math.PI) / 180;
    const radius = maxAngle > 0 ? viewportWidth / 2 / Math.sin(Math.min(maxAngle, Math.PI / 2.2)) : Infinity;
    for (let i = 0; i < total; i++) {
      const card = cardRefs.current[i];
      if (!card) continue;
      const along = mod(i * step + offset + loop / 2, loop) - loop / 2;
      let x = along;
      let z = 0;
      let angle = 0;
      if (radius !== Infinity) {
        angle = along / radius;
        x = radius * Math.sin(angle);
        z = radius * (1 - Math.cos(angle));
      }
      const hidden = Math.abs(angle) > Math.PI / 2.1 || Math.abs(x) > viewportWidth / 2 + cardWidth * 1.5;
      card.style.transform = `translate3d(${x.toFixed(2)}px, 0, ${z.toFixed(2)}px) rotateY(${(-angle).toFixed(4)}rad)`;
      card.style.visibility = hidden ? "hidden" : "";
      card.style.zIndex = String(1000 - Math.round(Math.abs(along) / 10));
    }
  }, [loop, viewportWidth, curvature, total, step, cardWidth]);

  // Boucle d'animation : défilement automatique, élan après un glisser, déplacement vers une cible.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const m = motion.current;
      if (!m.dragging) {
        if (m.target !== null) {
          const delta = m.target - m.offset;
          m.offset += delta * Math.min(1, dt * 9);
          if (Math.abs(delta) < 0.5) {
            m.offset = m.target;
            m.target = null;
          }
          m.velocity = 0;
        } else {
          const wanted = (pauseOnHover && m.hover) || m.focus ? 0 : autoplay;
          // La vitesse rejoint en douceur celle voulue : élan du lâcher, arrêt au survol, reprise.
          m.velocity += (wanted - m.velocity) * Math.min(1, dt * 2.4);
          m.offset += m.velocity * dt;
        }
      }
      layout();
      if (m.visible && !document.hidden) raf = requestAnimationFrame(tick);
      else raf = 0;
    };
    const start = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    start();
    const el = viewportRef.current;
    const io = el
      ? new IntersectionObserver(([entry]) => {
          motion.current.visible = entry.isIntersecting;
          if (entry.isIntersecting) start();
        })
      : null;
    if (el && io) io.observe(el);
    const onVisibility = () => {
      if (!document.hidden) start();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [autoplay, layout, pauseOnHover]);

  // Molette horizontale (pavé tactile, Maj + molette) : déplace la rangée sans bloquer le défilement vertical.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (!dx) return;
      e.preventDefault();
      const m = motion.current;
      m.target = null;
      m.offset -= dx;
      m.velocity = 0;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function moveBy(cards: number) {
    const m = motion.current;
    const base = m.target ?? m.offset;
    // Cale la cible sur une carte entière pour que la plus proche finisse bien au centre.
    m.target = Math.round(base / step) * step + cards * step;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    const m = motion.current;
    m.dragging = true;
    m.target = null;
    m.lastX = e.clientX;
    m.lastT = performance.now();
    m.dragVelocity = 0;
    m.moved = 0;
  }

  function onPointerMove(e: React.PointerEvent) {
    const m = motion.current;
    if (!m.dragging) return;
    const now = performance.now();
    const dx = e.clientX - m.lastX;
    m.offset += dx;
    m.moved += Math.abs(dx);
    // Capturé seulement une fois le glisser engagé : un simple appui reste un clic sur la carte.
    const el = e.currentTarget as HTMLElement;
    if (m.moved > 4 && !el.hasPointerCapture?.(e.pointerId)) el.setPointerCapture?.(e.pointerId);
    const dt = Math.max(1, now - m.lastT) / 1000;
    m.dragVelocity = m.dragVelocity * 0.6 + (dx / dt) * 0.4;
    m.lastX = e.clientX;
    m.lastT = now;
  }

  function onPointerUp(e: React.PointerEvent) {
    const m = motion.current;
    if (!m.dragging) return;
    m.dragging = false;
    // L'élan du lâcher, plafonné, retombe ensuite vers la vitesse de croisière.
    m.velocity = Math.max(-2400, Math.min(2400, m.dragVelocity));
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveBy(1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      moveBy(-1);
    }
  }

  const height = Math.round(cardHeight * (1 + Math.max(0, Math.min(1, curvature)) * 0.32));
  const classes = ["lq-curved-carousel", className].filter(Boolean).join(" ");

  return (
    <section className={classes} aria-roledescription="carrousel" aria-label={ariaLabel}>
      <div
        ref={viewportRef}
        className="lq-curved-carousel__viewport"
        style={{ height, perspective: `${Math.round(Math.max(700, viewportWidth * 0.85))}px` }}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerEnter={() => (motion.current.hover = true)}
        onPointerLeave={() => (motion.current.hover = false)}
        onFocus={() => (motion.current.focus = true)}
        onBlur={() => (motion.current.focus = false)}
        aria-label={`${ariaLabel} — flèches gauche et droite pour faire défiler`}
      >
        <div className="lq-curved-carousel__stage" role="list">
          {Array.from({ length: total }, (_, i) => {
            const item = items[i % n];
            const clone = i >= n;
            const body = (
              <>
                {item.content ?? (item.src ? <img className="lq-curved-carousel__image" src={item.src} alt={item.alt ?? ""} draggable={false} loading="lazy" /> : null)}
                {(item.title || item.caption) && (
                  <span className="lq-curved-carousel__text">
                    {item.title && <span className="lq-curved-carousel__title">{item.title}</span>}
                    {item.caption && <span className="lq-curved-carousel__caption">{item.caption}</span>}
                  </span>
                )}
              </>
            );
            const common = {
              ref: (node: HTMLElement | null) => {
                cardRefs.current[i] = node;
              },
              className: ["lq-curved-carousel__card", (item.href || item.onClick) && "lq-curved-carousel__card--interactive", item.content != null && "lq-curved-carousel__card--content"].filter(Boolean).join(" "),
              style: { width: cardWidth, height: cardHeight, marginLeft: -cardWidth / 2, marginTop: -cardHeight / 2 },
              role: "listitem",
              "aria-hidden": clone || undefined,
            };
            const guardClick = (e: React.MouseEvent) => {
              // Un glisser qui se termine sur une carte n'est pas un clic.
              if (motion.current.moved > 6) {
                e.preventDefault();
                return;
              }
              item.onClick?.();
            };
            return item.href ? (
              <a key={`${item.id}-${i}`} {...common} href={item.href} tabIndex={clone ? -1 : undefined} onClick={guardClick} draggable={false}>
                {body}
              </a>
            ) : (
              <div key={`${item.id}-${i}`} {...common} onClick={item.onClick ? guardClick : undefined}>
                {body}
              </div>
            );
          })}
        </div>
      </div>
      {controls && n > 0 && (
        <div className="lq-curved-carousel__controls">
          <button type="button" className="lq-curved-carousel__control" onClick={() => moveBy(1)} aria-label="Carte précédente">
            <ChevronLeftIcon size={16} />
          </button>
          {!reducedMotion && speed > 0 && (
            <button
              type="button"
              className="lq-curved-carousel__control"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Reprendre le défilement" : "Mettre le défilement en pause"}
              aria-pressed={paused}
            >
              {paused ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
            </button>
          )}
          <button type="button" className="lq-curved-carousel__control" onClick={() => moveBy(-1)} aria-label="Carte suivante">
            <ChevronRightIcon size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
