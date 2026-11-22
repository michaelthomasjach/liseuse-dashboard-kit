import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import "./TriptychScroll.css";

export type TriptychDirection = "up" | "down";

/**
 * `"scrub"` : les trois sections suivent le défilement au pixel près, ensemble ; `"steps"` : chacune
 * bascule entière vers sa vue suivante, l'une après l'autre, une fois son seuil passé.
 */
export type TriptychMotion = "scrub" | "steps";

export interface TriptychScrollState {
  /**
   * Étape atteinte : 0 au départ, puis une de plus à chaque relève des trois sections. En mode
   * `"scrub"`, c'est la vue qui arrive : elle passe à 1 dès que le défilement commence.
   */
  step: number;
  /** Nombre d'étapes (le nombre de vues de la section qui en a le plus, moins un). */
  steps: number;
  /** Avancement du défilement sur toute la longueur du composant, de 0 à 1. */
  progress: number;
}

export interface TriptychBackground {
  /** Vidéo (MP4, WebM) : muette, en boucle, lue d'elle-même. */
  video?: string;
  /** Image, à la place de la vidéo ou en attendant qu'elle charge (`poster`). */
  image?: string;
  /** Texte alternatif ; vide par défaut (fond décoratif). */
  alt?: string;
}

export interface TriptychScrollProps {
  /**
   * Les trois sections, de gauche à droite ; chacune est une suite de vues (une image, une carte de
   * chiffres, un texte…) qui occupent toute la hauteur de la section. Toujours trois sections.
   */
  sections: [ReactNode[], ReactNode[], ReactNode[]];
  /**
   * Le mouvement des sections. `"scrub"` (défaut) : elles suivent la molette en continu, toutes en
   * même temps, sans animation ni palier — on peut s'arrêter à mi-chemin d'une vue à l'autre.
   * `"steps"` : chacune bascule entière vers sa vue suivante (0,9 s) quand le défilement passe son
   * seuil, l'une après l'autre dans l'ordre `order`.
   */
  motion?: TriptychMotion;
  /**
   * Sens de défilement de chaque section : `"up"`, la section monte et la vue suivante arrive par le
   * bas ; `"down"`, elle descend et la vue suivante arrive par le haut. Défaut : `["up", "down", "up"]`
   * en mode `"scrub"` (les bords montent, le centre descend), `["down", "up", "down"]` en mode `"steps"`.
   */
  directions?: [TriptychDirection, TriptychDirection, TriptychDirection];
  /**
   * Mode `"steps"` seulement : l'ordre dans lequel les sections se relaient à chaque étape (indices
   * 0, 1, 2 = gauche, centre, droite). Défaut `[0, 2, 1]` : la gauche, puis la droite, puis le centre.
   */
  order?: [number, number, number];
  /** Hauteur du cadre collé à l'écran (toute valeur CSS). Défaut `"100vh"`. */
  height?: string;
  /** Décalage du haut du cadre quand il est collé (une barre de menu au-dessus…). Défaut `"0px"`. */
  stickyTop?: string;
  /** Défilement nécessaire pour une étape, en part de la hauteur du cadre. Défaut 0.9. */
  stepLength?: number;
  /**
   * Un fond commun aux trois sections : une vidéo (ou une image) qui s'étend sur toute la largeur, chaque
   * section en montrant sa part, comme trois fenêtres sur la même scène. Il forme la première vue de chaque
   * section : au défilement, les sections glissent l'une après l'autre et découvrent leurs vues suivantes
   * (`sections`). La vidéo tourne en boucle, sans le son ; elle reste à l'arrêt sur sa première image quand le
   * système demande moins d'animations.
   */
  background?: TriptychBackground;
  /** Espace entre les sections, en px. Défaut 8. */
  gap?: number;
  /**
   * Posé par-dessus les trois sections : un titre, un bouton, une pastille au centre… Une fonction
   * reçoit l'étape courante (elle n'est rappelée qu'au changement d'étape).
   */
  overlay?: ReactNode | ((state: TriptychScrollState) => ReactNode);
  /** Appelé quand l'étape change. */
  onStepChange?: (step: number) => void;
  /** Nom accessible de l'ensemble. */
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Trois sections côte à côte qui amènent leurs vues suivantes au défilement de la page.
 *
 * Le composant est plus haut que l'écran ; son cadre reste collé pendant qu'on fait défiler. Par
 * défaut (`motion="scrub"`), les trois sections suivent la molette **en continu et ensemble** : les
 * bords montent pendant que le centre descend, chacun découvrant sa vue suivante, et tout s'arrête
 * là où le défilement s'arrête. Avec `motion="steps"`, chaque section bascule entière vers sa vue
 * suivante l'une après l'autre (la gauche, puis la droite, puis le centre) une fois son seuil passé.
 *
 * Sous `prefers-reduced-motion`, aucune translation : la vue la plus proche remplace l'autre d'un
 * coup. La position est lue dans la géométrie (où est le cadre collé dans le composant), donc tout
 * conteneur qui défile convient, pas seulement la fenêtre. Les positions sont écrites directement
 * sur les pistes (transformations), sans nouveau rendu à chaque image.
 */
export function TriptychScroll({
  sections: sectionsProp,
  background,
  motion = "scrub",
  directions: directionsProp,
  order = [0, 2, 1],
  height = "100vh",
  stickyTop = "0px",
  stepLength = 0.9,
  gap = 8,
  overlay,
  onStepChange,
  ariaLabel = "Sections",
  className,
  style,
}: TriptychScrollProps) {
  const directions = directionsProp ?? (motion === "scrub" ? (["up", "down", "up"] as const) : (["down", "up", "down"] as const));
  const scrub = motion === "scrub";
  const rootRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [frameHeight, setFrameHeight] = useState(0);
  const [frameWidth, setFrameWidth] = useState(0);
  const reducedMotion = useReducedMotion();
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  // Le fond commun est la première vue de chaque section.
  const sections = (background
    ? sectionsProp.map((views, c) => [<TriptychBackdrop key="backdrop" background={background} column={c} gap={gap} frameWidth={frameWidth} reducedMotion={reducedMotion} videoRef={(v) => (videoRefs.current[c] = v)} />, ...views])
    : sectionsProp) as [ReactNode[], ReactNode[], ReactNode[]];
  const counts = sections.map((s) => Math.max(1, s.length));
  const steps = Math.max(...counts) - 1;
  const [state, setState] = useState<TriptychScrollState>({ step: 0, steps, progress: 0 });
  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;

  // Hauteur totale : le cadre, plus une longueur de défilement par étape.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const ro = new ResizeObserver(() => {
      setFrameHeight(frame.clientHeight);
      setFrameWidth(frame.clientWidth);
    });
    setFrameWidth(frame.clientWidth);
    ro.observe(frame);
    setFrameHeight(frame.clientHeight);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const frame = frameRef.current;
    if (!root || !frame) return;
    // Rang de chaque section dans l'ordre de relève.
    const rank = [0, 1, 2].map((c) => Math.max(0, order.indexOf(c)));
    const current = [NaN, NaN, NaN];
    let raf = 0;
    let lastStep = -1;

    const targetFor = (u: number, c: number) => {
      // Suivi continu : la position de la piste est l'avancement lui-même, fractions comprises.
      // Moins d'animations : la vue la plus proche, sans entre-deux.
      if (scrub) return Math.min(counts[c] - 1, reducedMotion ? Math.round(u) : u);
      const k = Math.floor(u);
      const f = u - k;
      // Chaque section bascule entière vers sa vue suivante quand le défilement passe son seuil dans
      // l'étape : 15 %, 40 %, 65 % selon son rang. Jamais à mi-chemin : la relève est une animation
      // (transition CSS), pas un suivi de la molette au pixel près.
      return Math.min(counts[c] - 1, k + (f >= 0.15 + rank[c] * 0.25 ? 1 : 0));
    };

    const apply = () => {
      raf = 0;
      const r = root.getBoundingClientRect();
      const fr = frame.getBoundingClientRect();
      const travel = r.height - fr.height;
      const progress = travel > 0 ? clamp01((fr.top - r.top) / travel) : 0;
      const u = progress * steps;
      for (let c = 0; c < 3; c++) {
        const target = targetFor(u, c);
        if (target === current[c]) continue;
        current[c] = target;
        const track = trackRefs.current[c];
        if (!track) continue;
        const n = counts[c];
        // « up » : les vues sont empilées dans l'ordre et la piste monte ; « down » : empilées à
        // l'envers et la piste descend, la vue suivante arrive par le haut.
        const index = directions[c] === "down" ? n - 1 - target : target;
        track.style.transform = `translate3d(0, ${(-index * 100) / n}%, 0)`;
      }
      // « scrub » : la vue qui arrive (1 dès que le défilement commence) ; « steps » : l'étape atteinte.
      const step = Math.min(steps, scrub ? Math.max(0, Math.ceil(u - 0.02)) : Math.floor(u + 0.1));
      if (step !== lastStep) {
        lastStep = step;
        setState({ step, steps, progress });
        onStepChangeRef.current?.(step);
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    // Écoute en capture : le défilement de n'importe quel conteneur parent arrive ici.
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
    };
    // counts / directions / order : des tableaux recréés à chaque rendu, comparés par leur contenu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, counts.join(), directions.join(), order.join(), frameHeight, scrub, reducedMotion]);

  // Les trois vidéos du fond commun restent calées sur la première (même fichier, trois lecteurs).
  useEffect(() => {
    if (!background?.video || reducedMotion) return;
    const timer = window.setInterval(() => {
      const [lead, ...rest] = videoRefs.current;
      if (!lead) return;
      for (const v of rest) if (v && Math.abs(v.currentTime - lead.currentTime) > 0.12) v.currentTime = lead.currentTime;
    }, 1000);
    return () => window.clearInterval(timer);
  }, [background?.video, reducedMotion]);

  const total = frameHeight ? `calc(${height} + ${Math.round(steps * stepLength * frameHeight)}px)` : height;
  const overlayNode = typeof overlay === "function" ? overlay(state) : overlay;

  return (
    <section
      ref={rootRef}
      className={["lq-triptych", scrub && "lq-triptych--scrub", className].filter(Boolean).join(" ")}
      style={{ ...style, height: total }}
      aria-label={ariaLabel}
    >
      <div ref={frameRef} className="lq-triptych__frame" style={{ height, top: stickyTop, gap }}>
        {sections.map((views, c) => {
          const list = directions[c] === "down" ? [...views].reverse() : views;
          const n = Math.max(1, views.length);
          return (
            <div key={c} className="lq-triptych__section">
              <div
                ref={(node) => {
                  trackRefs.current[c] = node;
                }}
                className="lq-triptych__track"
                // Position de départ (première vue) avant que le script ne prenne la main.
                style={{ height: `${n * 100}%`, transform: directions[c] === "down" ? `translate3d(0, ${(-(n - 1) * 100) / n}%, 0)` : undefined }}
              >
                {list.map((view, i) => {
                  const original = directions[c] === "down" ? n - 1 - i : i;
                  return (
                    <div
                      key={original}
                      className="lq-triptych__view"
                      style={{ height: `${100 / n}%` }}
                      aria-hidden={Math.min(state.step, n - 1) !== original || undefined}
                    >
                      {view}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {overlayNode != null && <div className="lq-triptych__overlay">{overlayNode}</div>}
      </div>
    </section>
  );
}

/** Vrai quand le système demande moins d'animations. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mql) return;
    const onChange = () => setReduced(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** La part du fond commun qui revient à une section : le média à la largeur du cadre, décalé de la colonne. */
function TriptychBackdrop({
  background,
  column,
  gap,
  frameWidth,
  reducedMotion,
  videoRef,
}: {
  background: TriptychBackground;
  column: number;
  gap: number;
  frameWidth: number;
  reducedMotion: boolean;
  videoRef: (v: HTMLVideoElement | null) => void;
}) {
  const columnWidth = (frameWidth - 2 * gap) / 3;
  const style: CSSProperties = frameWidth ? { width: frameWidth, left: -column * (columnWidth + gap) } : { width: "300%", left: `${-column * 100}%` };
  return (
    <div className="lq-triptych__backdrop">
      {background.video ? (
        <video
          ref={videoRef}
          className="lq-triptych__media"
          style={style}
          src={background.video}
          poster={background.image}
          muted
          loop
          playsInline
          autoPlay={!reducedMotion}
          preload="auto"
          aria-hidden={background.alt ? undefined : true}
          aria-label={background.alt || undefined}
        />
      ) : background.image ? (
        <img className="lq-triptych__media" style={style} src={background.image} alt={background.alt ?? ""} draggable={false} />
      ) : null}
    </div>
  );
}
