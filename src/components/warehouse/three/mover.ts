import type { P3 } from "./builder";
import { makeRoute, sampleRoute, type Route } from "./transport";

/**
 * Un engin **qui obéit** : ce qui fait rouler un transpalette, un chariot, un camion au gré de ce
 * qu'une application lui demande.
 *
 * ## Pourquoi pas `useFollow`
 *
 * `useFollow` fait tourner un véhicule sur un itinéraire fermé, pour toujours : sa pose ne dépend
 * que de l'instant. C'est la bonne règle pour la circulation d'une rue, pas pour un engin qui
 * travaille : on ne sait pas à l'avance quand il partira — c'est le jeu qui le dit, quand un compteur
 * bouge — ni où il ira ensuite. Un engin qui obéit tient donc une **file de tâches** : attendre,
 * tourner sur place, rouler le long d'un chemin (en avant ou en marche arrière). Il les exécute
 * l'une après l'autre au rythme de l'horloge de la scène, et chaque tâche peut dire ce qui se passe
 * quand elle s'achève — charger, décharger, prévenir le jeu, enchaîner la suivante.
 *
 * Le temps qu'on lui donne est celui de la simulation : en pause, rien ne bouge ; accélérée, tout
 * va plus vite, du même pas que le reste de la scène.
 */

export type MoverTask =
  | { kind: "wait"; secs: number; done?: () => void }
  | { kind: "turn"; to: number; done?: () => void }
  | {
      kind: "drive";
      route: Route;
      /** Cases par seconde — ou une fonction, relue à chaque pas, pour une vitesse qui change en route. */
      speed: number | (() => number);
      /** En marche arrière : l'engin regarde à l'opposé de son mouvement. */
      reverse?: boolean;
      /** Tourner sur place avant de partir, face au chemin. Défaut : oui. */
      turnFirst?: boolean;
      done?: () => void;
    };

/** La vitesse de rotation sur place, en radians par seconde. */
const TURN_RATE = 3.2;

/** L'écart d'angle le plus court de `a` vers `b`, dans ]−π, π]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export class Mover {
  x = 0;
  y = 0;
  /** Le cap, en radians : la direction où l'engin regarde. */
  heading = 0;
  /** En train de rouler (et non d'attendre ou de tourner sur place). */
  moving = false;
  /** La vitesse signée du moment, en cases par seconde : négative en marche arrière. */
  speed = 0;
  private tasks: MoverTask[] = [];
  private elapsed = 0;
  private started = false;

  constructor(x = 0, y = 0, heading = 0) {
    this.x = x;
    this.y = y;
    this.heading = heading;
  }

  get busy(): boolean {
    return this.tasks.length > 0;
  }

  push(...tasks: MoverTask[]): this {
    this.tasks.push(...tasks);
    return this;
  }

  /** Oublier ce qui reste à faire, et se poser là. */
  place(x: number, y: number, heading: number): this {
    this.tasks = [];
    this.elapsed = 0;
    this.started = false;
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.moving = false;
    this.speed = 0;
    return this;
  }

  /** Avancer de `dt` secondes de simulation, d'une tâche à la suivante s'il le faut. */
  step(dt: number): void {
    let left = dt;
    let guard = 0;
    while (left > 0 && this.tasks.length > 0 && guard < 64) {
      guard += 1;
      left = this.run(this.tasks[0], left);
    }
    if (this.tasks.length === 0) {
      this.moving = false;
      this.speed = 0;
    }
  }

  /** Exécuter la tâche en cours pendant `dt` ; ce qui reste de `dt` si elle s'achève, sinon 0. */
  private run(task: MoverTask, dt: number): number {
    if (task.kind === "wait") {
      this.moving = false;
      this.speed = 0;
      const need = task.secs - this.elapsed;
      if (dt < need) {
        this.elapsed += dt;
        return 0;
      }
      return this.finish(task, dt - Math.max(0, need));
    }
    if (task.kind === "turn") {
      this.moving = false;
      this.speed = 0;
      const d = angleDelta(this.heading, task.to);
      const need = Math.abs(d) / TURN_RATE;
      if (dt < need) {
        this.heading += Math.sign(d) * TURN_RATE * dt;
        return 0;
      }
      this.heading = task.to;
      return this.finish(task, dt - need);
    }
    const { route, speed, reverse = false, turnFirst = true } = task;
    if (!this.started) {
      // Face au chemin d'abord, s'il le faut : un engin de manutention pivote sur place.
      const start = sampleRoute(route, Math.min(0.05, route.length / 2));
      const face = start.heading + (reverse ? Math.PI : 0);
      const d = angleDelta(this.heading, face);
      if (turnFirst && Math.abs(d) > 0.02 && route.length > 1e-3) {
        this.moving = false;
        const need = Math.abs(d) / TURN_RATE;
        if (dt < need) {
          this.heading += Math.sign(d) * TURN_RATE * dt;
          return 0;
        }
        this.heading = face;
        dt -= need;
      }
      this.started = true;
    }
    const v = Math.max(0.05, typeof speed === "function" ? speed() : speed);
    const s = this.elapsed + dt * v;
    this.moving = true;
    this.speed = reverse ? -v : v;
    if (s < route.length) {
      this.elapsed = s;
      const p = sampleRoute(route, s);
      this.x = p.x;
      this.y = p.y;
      this.heading = p.heading + (reverse ? Math.PI : 0);
      return 0;
    }
    const end = sampleRoute(route, route.length);
    this.x = end.x;
    this.y = end.y;
    if (route.length > 1e-3) {
      const last = sampleRoute(route, Math.max(0, route.length - 0.05));
      this.heading = last.heading + (reverse ? Math.PI : 0);
    }
    return this.finish(task, (s - route.length) / v);
  }

  private finish(task: MoverTask, left: number): number {
    this.tasks.shift();
    this.elapsed = 0;
    this.started = false;
    task.done?.();
    return Math.max(0, left);
  }
}

/**
 * Un chemin au sol par des points, **aux angles arrondis** : un engin ne pivote pas d'un coup à
 * chaque sommet, il prend le virage. Chaque angle est remplacé par une courbe qui le coupe à
 * `radius` de son sommet — au plus à la moitié des côtés qui s'y rejoignent.
 */
export function groundPath(points: { x: number; y: number }[], radius = 0.8): Route {
  const pts = points.filter((p, i) => i === 0 || Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) > 1e-4);
  const out: P3[] = [];
  if (pts.length === 0) return makeRoute([[0, 0, 0]]);
  out.push([pts[0].x, pts[0].y, 0]);
  for (let i = 1; i < pts.length - 1; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    const c = pts[i + 1];
    const l0 = Math.hypot(b.x - a.x, b.y - a.y);
    const l1 = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.min(radius, l0 / 2, l1 / 2);
    if (r < 1e-3) {
      out.push([b.x, b.y, 0]);
      continue;
    }
    const p0 = { x: b.x + ((a.x - b.x) / l0) * r, y: b.y + ((a.y - b.y) / l0) * r };
    const p1 = { x: b.x + ((c.x - b.x) / l1) * r, y: b.y + ((c.y - b.y) / l1) * r };
    const n = 8;
    for (let k = 0; k <= n; k += 1) {
      const u = k / n;
      // Une courbe de Bézier quadratique, dont le sommet de l'angle est le point de contrôle.
      const x = (1 - u) * (1 - u) * p0.x + 2 * (1 - u) * u * b.x + u * u * p1.x;
      const y = (1 - u) * (1 - u) * p0.y + 2 * (1 - u) * u * b.y + u * u * p1.y;
      out.push([x, y, 0]);
    }
  }
  if (pts.length > 1) out.push([pts[pts.length - 1].x, pts[pts.length - 1].y, 0]);
  return makeRoute(out, false);
}
