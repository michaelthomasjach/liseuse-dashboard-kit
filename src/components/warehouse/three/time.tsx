import { createContext, useContext, useEffect, useRef, type MutableRefObject, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/**
 * L'horloge de la simulation — **une par scène**, partagée par tout ce qui bouge dedans.
 *
 * ## Pourquoi une seule horloge
 *
 * Un colis qui passe d'un tapis à un picker, puis du picker à une étagère, n'est pas animé par
 * trois modules qui se passent le relais : il suit un itinéraire, et les machines se calent sur
 * lui. Pour que cela tienne sans une frame de décalage, il faut que tous lisent **le même
 * instant** : la position d'un colis et la pose de la machine qui le porte sont deux fonctions du
 * même temps, calculées dans la même image. Deux horloges, même démarrées ensemble, finissent par
 * dériver — et c'est à la jonction que ça se voit, précisément là où le colis sauterait.
 *
 * C'est aussi l'horloge d'un jeu : elle se **met en pause** et **s'accélère** (`speed`), et le
 * temps de simulation ne coïncide donc pas avec le temps réel. Les modules ne lisent jamais
 * l'horloge du navigateur, seulement celle-ci.
 *
 * ## Le rendu à la demande
 *
 * Une scène immobile ne coûte rien : la toile ne se redessine que quand quelque chose change. Ce
 * qui s'anime **s'inscrit** (`useAnimated`), et tant qu'il reste un inscrit, la scène se redessine
 * à chaque image. Le dernier parti, elle se rendort.
 */

interface SimClock {
  /** Secondes de simulation écoulées. */
  t: MutableRefObject<number>;
  /** Nombre de parties animées inscrites. */
  enlist: () => () => void;
  speed: MutableRefObject<number>;
  paused: MutableRefObject<boolean>;
  reduced: boolean;
}

const ClockContext = createContext<SimClock | null>(null);

export function SimClockProvider({ speed = 1, paused = false, children }: { speed?: number; paused?: boolean; children: ReactNode }) {
  const invalidate = useThree((s) => s.invalidate);
  const t = useRef(0);
  const count = useRef(0);
  const speedRef = useRef(speed);
  const pausedRef = useRef(paused);
  speedRef.current = speed;
  pausedRef.current = paused;
  const reduced = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Le temps avance d'abord, avant tout ce qui le lit : priorité négative.
  useFrame((_, delta) => {
    if (pausedRef.current || reduced) return;
    // Un onglet revenu au premier plan rendrait un delta de plusieurs secondes : les colis
    // sauteraient d'un bout à l'autre du tapis. On le borne à un dixième de seconde.
    t.current += Math.min(delta, 0.1) * speedRef.current;
  }, -100);

  // Tant qu'il reste un inscrit, redessiner à chaque image. La boucle s'arrête avec le dernier
  // inscrit — une scène au repos ne réveille plus le navigateur à chaque image pour rien — et
  // repart avec le premier qui revient.
  const raf = useRef(0);
  const loop = useRef<() => void>(() => undefined);
  loop.current = () => {
    raf.current = 0;
    if (count.current <= 0) return;
    if (!pausedRef.current && !reduced) invalidate();
    raf.current = requestAnimationFrame(() => loop.current());
  };
  const wake = useRef(() => {
    if (raf.current === 0 && count.current > 0) raf.current = requestAnimationFrame(() => loop.current());
  }).current;
  useEffect(() => {
    wake();
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [invalidate, reduced, wake]);
  // Une reprise après une pause : la toile attend une première image pour s'y remettre.
  useEffect(() => {
    if (!paused) invalidate();
  }, [paused, invalidate]);

  const value = useRef<SimClock>({
    t,
    speed: speedRef,
    paused: pausedRef,
    reduced,
    enlist: () => {
      count.current += 1;
      invalidate();
      wake();
      return () => {
        count.current -= 1;
      };
    },
  }).current;

  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>;
}

export function useSimClock(): SimClock {
  const c = useContext(ClockContext);
  if (c === null) throw new Error("useSimClock : hors d'une scène d'entrepôt");
  return c;
}

/** S'inscrire comme partie animée tant que `active` est vrai. */
export function useAnimated(active = true) {
  const clock = useSimClock();
  useEffect(() => (active ? clock.enlist() : undefined), [active, clock]);
}

/**
 * Appeler `cb` à chaque image avec le temps de simulation.
 *
 *  C'est la seule façon pour un module de bouger : lire `t`, en déduire sa pose, la poser. Rien
 *  n'est accumulé d'une image à l'autre, si bien qu'une pose ne dépend que de l'instant — la
 *  condition pour que deux modules calés sur le même itinéraire ne puissent jamais se désaccorder.
 *
 *  `passive` : un mouvement **d'agrément** — la couronne d'un arbre dans le vent — qui s'anime tant
 *  que la scène se redessine pour autre chose, mais ne la tient pas éveillée à lui seul. Sans cela, un
 *  arbre posé suffirait à redessiner toute la scène à chaque image, pour toujours ; avec, une scène où
 *  plus rien ne travaille s'endort, et l'arbre s'arrête là où il en était.
 */
export function useSimFrame(cb: (t: number) => void, active = true, opts?: { passive?: boolean }) {
  const clock = useSimClock();
  useAnimated(active && !opts?.passive);
  const ref = useRef(cb);
  ref.current = cb;
  useFrame(() => {
    if (active) ref.current(clock.t.current);
  });
}
