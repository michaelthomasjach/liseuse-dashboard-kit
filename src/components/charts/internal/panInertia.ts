/**
 * Inertie au relâchement d'un glisser : le graphique continue un peu sur sa lancée puis s'arrête en douceur, au lieu
 * de se figer net sous le pointeur. Une seule implémentation pour tout le kit — le déplacement d3-zoom
 * (`useD3Zoom` : chandeliers, lignes, barres, écarts, heatmap, matrice, Sankey), le glisser vertical de l'axe des prix
 * et des sous-panneaux des chandeliers, la carte à tuiles.
 *
 * Deux pièces, sans React :
 * - `PanVelocityTracker` mesure la vitesse du pointeur sur les dernières ~100 ms du geste (pas sur tout le geste) et
 *   n'en rend une au relâchement que si le geste était encore rapide à cet instant : un glisser lent, ou un pointeur
 *   resté immobile avant de lâcher, ne lance rien.
 * - `startPanInertia` rejoue cette vitesse image par image (`requestAnimationFrame`) avec une décroissance
 *   exponentielle. Chaque image passe par la fonction `step` de l'appelant, qui applique le déplacement avec ses
 *   propres contraintes et dit ce qui a vraiment bougé : un axe bloqué par une limite s'arrête aussitôt. Un nouvel
 *   appui, la molette, un toucher (pincement) ou une touche du clavier l'arrêtent net, n'importe où dans la page.
 *
 * `prefers-reduced-motion: reduce` : jamais d'inertie.
 */

/** Réglages de l'inertie, partagés par tous les graphiques. */
export const PAN_INERTIA = {
  /** Fenêtre de mesure de la vitesse, juste avant le relâchement. */
  sampleWindowMs: 100,
  /** Pointeur immobile plus longtemps que ça avant de lâcher : pas d'inertie. */
  idleMs: 90,
  /** Vitesse minimale au relâchement (px/ms, soit 300 px/s) : en dessous, le geste était un placement, pas un lancer. */
  minSpeed: 0.3,
  /** Vitesse de départ plafonnée (px/ms) : un lancer très rapide ne part pas loin (au plus ~300 px parcourus). */
  maxSpeed: 2.5,
  /** Constante de temps de la décroissance : la vitesse est divisée par e toutes les 120 ms, et la distance parcourue
   *  vaut vitesse × 120 ms (un lancer à 1 000 px/s glisse encore de ~120 px). */
  timeConstantMs: 120,
  /** Durée maximale. */
  maxDurationMs: 600,
  /** Vitesse sous laquelle l'inertie s'arrête (px/ms). */
  stopSpeed: 0.02,
} as const;

export interface PanVelocity {
  /** px/ms, positif vers la droite. */
  vx: number;
  /** px/ms, positif vers le bas. */
  vy: number;
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** L'utilisateur a demandé moins d'animations. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Positions successives d'un glisser (en pixels écran, cumulées depuis n'importe quelle origine fixe) et leur heure. */
export class PanVelocityTracker {
  private samples: { x: number; y: number; t: number }[] = [];

  reset(): void {
    this.samples = [];
  }

  push(x: number, y: number, t: number = now()): void {
    this.samples.push({ x, y, t });
    // On ne garde que de quoi couvrir la fenêtre de mesure (plus un point d'avant, pour son début).
    const limit = t - PAN_INERTIA.sampleWindowMs * 2;
    while (this.samples.length > 2 && this.samples[1]!.t < limit) this.samples.shift();
  }

  /** La vitesse au relâchement, ou null : geste trop lent, pointeur arrêté avant de lâcher, trop peu de mesures. */
  release(t: number = now()): PanVelocity | null {
    const samples = this.samples;
    this.samples = [];
    if (samples.length < 2) return null;
    const last = samples[samples.length - 1]!;
    if (t - last.t > PAN_INERTIA.idleMs) return null;
    const from = t - PAN_INERTIA.sampleWindowMs;
    let first = samples.length - 1;
    while (first > 0 && samples[first - 1]!.t >= from) first--;
    // Une seule mesure dans la fenêtre : on part de celle d'avant.
    if (first === samples.length - 1) first--;
    const start = samples[first]!;
    // Jusqu'au relâchement, pas jusqu'à la dernière mesure : une pause juste avant de lâcher fait baisser la vitesse.
    const dt = Math.max(16, t - start.t);
    const vx = (last.x - start.x) / dt;
    const vy = (last.y - start.y) / dt;
    if (!Number.isFinite(vx) || !Number.isFinite(vy) || Math.hypot(vx, vy) < PAN_INERTIA.minSpeed) return null;
    return { vx, vy };
  }
}

export interface PanInertiaHandle {
  cancel(): void;
}

/** Applique un déplacement (px écran) et rend ce qui a vraiment bougé, contraintes appliquées. Rendre `undefined` :
 *  tout a bougé. Un axe qui bouge moins de la moitié de ce qui était demandé est arrêté (limite atteinte). */
export type PanInertiaStep = (dx: number, dy: number) => { dx: number; dy: number } | void;

/**
 * Lance l'inertie à la vitesse donnée. Ne fait rien (rend null) sous `prefers-reduced-motion`, sans
 * `requestAnimationFrame`, ou si la vitesse est nulle. Chaque appelant garde son handle et arrête lui-même la
 * précédente avant d'en lancer une autre : un glisser en diagonale des chandeliers en lance deux à la fois, une en X
 * (d3-zoom) et une sur l'axe des prix.
 */
export function startPanInertia(velocity: PanVelocity, step: PanInertiaStep, options: { onEnd?: () => void } = {}): PanInertiaHandle | null {
  if (prefersReducedMotion() || typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return null;
  let { vx, vy } = velocity;
  const speed = Math.hypot(vx, vy);
  if (!(speed > 0)) return null;
  if (speed > PAN_INERTIA.maxSpeed) {
    vx = (vx * PAN_INERTIA.maxSpeed) / speed;
    vy = (vy * PAN_INERTIA.maxSpeed) / speed;
  }

  const tau = PAN_INERTIA.timeConstantMs;
  const start = now();
  let elapsed = 0;
  let frame = 0;
  const stopEvents = ["pointerdown", "mousedown", "touchstart", "wheel", "keydown"] as const;
  const onInterrupt = () => handle.cancel();
  const handle = {
    done: false,
    cancel() {
      if (handle.done) return;
      handle.done = true;
      window.cancelAnimationFrame(frame);
      for (const type of stopEvents) window.removeEventListener(type, onInterrupt, true);
      options.onEnd?.();
    },
  };
  for (const type of stopEvents) window.addEventListener(type, onInterrupt, { capture: true, passive: true });

  // Distance parcourue au temps t : v·τ·(1 − e^(−t/τ)) — intégrale exacte de la vitesse v·e^(−t/τ), donc le même trajet
  // quel que soit le rythme des images.
  const travelled = (t: number) => tau * (1 - Math.exp(-t / tau));
  const tick = () => {
    if (handle.done) return;
    const t = Math.min(PAN_INERTIA.maxDurationMs, now() - start);
    const f = travelled(t) - travelled(elapsed);
    elapsed = t;
    const dx = vx * f;
    const dy = vy * f;
    const applied = step(dx, dy);
    if (applied) {
      if (Math.abs(dx) > 0.05 && Math.abs(applied.dx) < Math.abs(dx) / 2) vx = 0;
      if (Math.abs(dy) > 0.05 && Math.abs(applied.dy) < Math.abs(dy) / 2) vy = 0;
    }
    const decay = Math.exp(-t / tau);
    if (t >= PAN_INERTIA.maxDurationMs || Math.hypot(vx, vy) * decay < PAN_INERTIA.stopSpeed) {
      handle.cancel();
      return;
    }
    frame = window.requestAnimationFrame(tick);
  };
  frame = window.requestAnimationFrame(tick);
  return handle;
}
