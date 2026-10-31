import { isValidElement, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type ReactNode } from "react";
import { toneAttribute, type SurfaceTone } from "../primitives/tone";
import "./LiveTile.css";

/** Une face composée : fond, étiquette, titre, sous-titre et pied, posés comme sur les tuiles d'un
 *  tableau de bord. Pour une face entièrement libre, passez directement un nœud React dans `faces`. */
export interface LiveTileFace {
  /** Image de fond : une URL, ou une valeur `background-image` complète (un dégradé, plusieurs
   *  couches). */
  image?: string;
  /** Couleur de fond de cette face — n'importe quelle couleur CSS, `var(--lq-…)` compris. Par défaut,
   *  le ton de la tuile. */
  background?: string;
  /** Voile dégradé de la couleur du fond, posé sur l'image pour garder le texte lisible. Défaut :
   *  `true` dès qu'il y a une `image`. */
  scrim?: boolean;
  /** Étiquette en pastille au-dessus du titre (« NEWS », « EXPLORE »). */
  tag?: ReactNode;
  /** `"soft"` : pastille translucide de la couleur du texte. `"solid"` : pastille pleine de la couleur
   *  du texte, lettres de la couleur du fond. Défaut : `"soft"`. */
  tagVariant?: "soft" | "solid";
  /** Surtitre en texte fin au-dessus du titre (« 21 janv. »). */
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Sous le sous-titre : une rangée de cours, un lien… */
  footer?: ReactNode;
  /** Où se pose le bloc de texte dans la face. Défaut : `"bottom"`. */
  align?: "top" | "bottom";
  /** Nom de la face pour les lecteurs d'écran. Par défaut, « n sur N ». */
  label?: string;
}

export interface LiveTileProps {
  /** Les faces, dans l'ordre de passage : des `LiveTileFace` composées, ou des nœuds React libres —
   *  les deux se mélangent. */
  faces: (LiveTileFace | ReactNode)[];
  /** Temps pendant lequel une face reste immobile, glissement non compris, en ms. Défaut : 3000. */
  interval?: number;
  /** Durée du glissement, en ms. Défaut : 500. */
  duration?: number;
  /** Courbe du glissement (toute valeur CSS `<easing-function>`). Défaut : `"ease"`. */
  easing?: string;
  /** Hauteur de la tuile : un nombre de pixels, ou toute longueur CSS (`"100%"` pour remplir une
   *  cellule de grille). Défaut : 320. */
  height?: number | string;
  /** Couleur de fond des faces qui n'en fixent pas — voir `SurfaceTone`. Défaut : `"accent"`. */
  tone?: SurfaceTone;
  /** Suspend le défilement tant que le pointeur survole la tuile ou que le focus clavier y est.
   *  Défaut : true. */
  pauseOnHover?: boolean;
  /** Arrête le défilement (contrôlé), par exemple derrière un bouton « pause ». */
  paused?: boolean;
  /** Face affichée au montage. Défaut : 0. */
  defaultIndex?: number;
  /** Appelé à chaque changement de face, avec le rang de la nouvelle. */
  onIndexChange?: (index: number) => void;
  /** Contrôles posés en haut à droite, au-dessus des faces : ils restent en place quand elles
   *  glissent. */
  controls?: ReactNode;
  /** Nom de la tuile pour les lecteurs d'écran. */
  label?: string;
  className?: string;
}

function isFaceObject(face: LiveTileFace | ReactNode): face is LiveTileFace {
  return typeof face === "object" && face !== null && !isValidElement(face) && !(Symbol.iterator in face);
}

/** Une URL nue devient `url("…")` ; une valeur qui est déjà une image CSS (dégradé, `url()`) passe
 *  telle quelle. */
function backgroundImage(image: string): string {
  return /^(url|image-set|(repeating-)?(linear|radial|conic)-gradient)\(/.test(image.trim()) ? image : `url("${image}")`;
}

/** `prefers-reduced-motion`, suivi en direct. La tuile ne bouge pas par CSS mais par l'API Web
 *  Animations, si bien que la préférence doit se lire ici plutôt que dans une media query. */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Tuile « vivante » : plusieurs faces de même taille qui se relaient à intervalle régulier, la
 * nouvelle montant par le bas pendant que l'ancienne sort par le haut — les tuiles qui bougent d'un
 * tableau de bord d'administration (actualité, cours, date du jour).
 *
 * Les valeurs par défaut sont celles mesurées sur ce genre de tableau de bord : une face reste 3 s,
 * glisse en 500 ms sur la courbe `ease`. Le glissement passe par l'API Web Animations plutôt que par
 * une transition CSS : avec deux faces, celle qui vient de sortir par le haut est aussi la prochaine à
 * entrer par le bas, et une transition la ferait redescendre à travers la tuile ; une animation part
 * toujours de la position qu'on lui donne.
 *
 * Accessibilité : le défilement est suspendu au survol et tant que le focus clavier est dans la
 * tuile, `paused` permet de l'arrêter tout à fait, les faces cachées sont retirées de l'arbre
 * d'accessibilité et la zone n'est pas annoncée (`aria-live="off"`) — un lecteur d'écran n'a pas à
 * être interrompu toutes les trois secondes. Avec `prefers-reduced-motion`, les faces se relaient
 * sans glisser.
 */
export function LiveTile({
  faces,
  interval = 3000,
  duration = 500,
  easing = "ease",
  height = 320,
  tone = "accent",
  pauseOnHover = true,
  paused = false,
  defaultIndex = 0,
  onIndexChange,
  controls,
  label,
  className,
}: LiveTileProps) {
  const count = faces.length;
  const [state, setState] = useState<{ index: number; from: number | null }>({ index: defaultIndex, from: null });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const faceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const onIndexChangeRef = useRef(onIndexChange);
  onIndexChangeRef.current = onIndexChange;

  const index = count > 0 ? ((state.index % count) + count) % count : 0;
  const slide = !reducedMotion && duration > 0;
  const running = count > 1 && !paused && !(pauseOnHover && (hovered || focused));

  // Une face reste `interval` ms immobile ; le minuteur compte aussi le glissement qui l'a amenée.
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(
      () => {
        setState((s) => ({ index: (s.index + 1) % count, from: s.index % count }));
      },
      interval + (slide ? duration : 0),
    );
    return () => window.clearTimeout(id);
  }, [running, state, count, interval, duration, slide]);

  useEffect(() => {
    if (state.from !== null) onIndexChangeRef.current?.(index);
  }, [state, index]);

  // Le glissement lui-même, joué avant que le navigateur ne peigne la nouvelle face à sa place.
  useLayoutEffect(() => {
    if (!slide || state.from === null || state.from === index) return;
    const incoming = faceRefs.current[index];
    const outgoing = faceRefs.current[state.from];
    const timing: KeyframeAnimationOptions = { duration, easing };
    const animations = [
      incoming?.animate?.([{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], timing),
      outgoing?.animate?.(
        [
          { transform: "translateY(0)", visibility: "visible" },
          { transform: "translateY(-100%)", visibility: "visible" },
        ],
        timing,
      ),
    ];
    return () => animations.forEach((a) => a?.cancel());
  }, [state, index, slide, duration, easing]);

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };

  const style: CSSProperties = { height: typeof height === "number" ? `${height}px` : height };

  return (
    <div
      className={["lq-live-tile", className].filter(Boolean).join(" ")}
      style={style}
      data-lq-tone={toneAttribute(tone)}
      role="group"
      aria-roledescription="tuile animée"
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
    >
      <div className="lq-live-tile__faces" aria-live="off">
        {faces.map((face, i) => {
          const current = i === index;
          const composed = isFaceObject(face);
          const faceStyle: CSSProperties | undefined =
            composed && (face.background || face.image)
              ? { backgroundColor: face.background, backgroundImage: face.image ? backgroundImage(face.image) : undefined }
              : undefined;
          return (
            <div
              key={i}
              ref={(el) => {
                faceRefs.current[i] = el;
              }}
              className={["lq-live-tile__face", current && "lq-live-tile__face--current", composed && face.image && "lq-live-tile__face--image"]
                .filter(Boolean)
                .join(" ")}
              style={faceStyle}
              role="group"
              aria-roledescription="face"
              aria-label={(composed && face.label) || `${i + 1} sur ${count}`}
              aria-hidden={current ? undefined : true}
            >
              {composed ? <ComposedFace face={face} /> : face}
            </div>
          );
        })}
      </div>
      {controls && <div className="lq-live-tile__controls">{controls}</div>}
    </div>
  );
}

function ComposedFace({ face }: { face: LiveTileFace }) {
  const scrim = face.scrim ?? Boolean(face.image);
  return (
    <>
      {scrim && <div className="lq-live-tile__scrim" aria-hidden="true" />}
      <div className={["lq-live-tile__content", `lq-live-tile__content--${face.align ?? "bottom"}`].join(" ")}>
        {face.tag && <span className={["lq-live-tile__tag", `lq-live-tile__tag--${face.tagVariant ?? "soft"}`].join(" ")}>{face.tag}</span>}
        {face.eyebrow && <span className="lq-live-tile__eyebrow">{face.eyebrow}</span>}
        {face.title && <div className="lq-live-tile__title">{face.title}</div>}
        {face.subtitle && <div className="lq-live-tile__subtitle">{face.subtitle}</div>}
        {face.footer && <div className="lq-live-tile__footer">{face.footer}</div>}
      </div>
    </>
  );
}
