import { angleDelta, distanceAt, planPath, sampleTrack, speedProfile, trackOf, type Pose, type Pt, type SpeedOptions, type Track, type TrackPose } from "./drive";

export { angleDelta };

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
 * tourner sur place, aller quelque part, suivre un trajet tout tracé. Il les exécute l'une après
 * l'autre au rythme de l'horloge de la scène, et chaque tâche peut dire ce qui se passe quand elle
 * s'achève — charger, décharger, prévenir le jeu, enchaîner la suivante.
 *
 * ## Conduire, et non glisser
 *
 * Un trajet n'est pas une ligne qu'on parcourt à vitesse fixe. Au moment où l'engin part, son chemin
 * est tracé **depuis sa pose** — un arc pour s'orienter, des virages au rayon de l'engin, un lissage
 * qui fait entrer en courbe progressivement (voir `drive.ts`) — et son allure est calculée une fois
 * pour toutes : il accélère, ralentit dans les virages serrés, freine avant l'arrêt. Son cap est la
 * tangente du chemin, et ne tourne jamais plus vite que `yawRate`. Un demi-tour est donc un
 * demi-cercle, pris au pas, et non une pirouette.
 *
 * Le temps qu'on lui donne est celui de la simulation : en pause, rien ne bouge ; accélérée, tout
 * va plus vite, du même pas que le reste de la scène. Et comme le chemin et l'allure sont fixés au
 * départ, la même suite de tâches donne toujours le même mouvement.
 */

export type MoverTask =
  | { kind: "wait"; secs: number; done?: () => void }
  /** Attendre qu'une condition soit remplie — une zone accordée, une voie libre. Relue à chaque pas. */
  | { kind: "until"; test: () => boolean; done?: () => void }
  /** Tourner sur place — un robot, un piéton : en douceur, départ et arrivée amortis. */
  | { kind: "turn"; to: number; done?: () => void }
  | {
      /** Aller, depuis là où l'on est, par `to` — le dernier point est la destination. */
      kind: "go";
      to: Pt[];
      /** Cases par seconde — ou une fonction, relue à chaque pas, pour une vitesse qui change en route. */
      speed: number | (() => number);
      /** Le rayon de braquage de l'engin. Défaut : celui du `Mover`. */
      radius?: number;
      done?: () => void;
    }
  | {
      /** Suivre un trajet déjà tracé — ou tracé au départ, depuis la pose du moment. */
      kind: "track";
      track: Track | ((pose: Pose) => Track);
      speed: number | (() => number);
      /** La vitesse au départ et à l'arrivée : 0 par défaut (il démarre et s'arrête). */
      startSpeed?: number;
      endSpeed?: number;
      done?: () => void;
    };

/** Ce qui caractérise la conduite d'un engin. */
export interface MoverStyle {
  /** Le rayon de braquage, en cases. */
  radius: number;
  /** L'accélération et le freinage, en cases par seconde². */
  accel: number;
  /** L'accélération latérale admise en courbe. */
  lateral: number;
  /** La vitesse de rotation la plus vive, en radians par seconde. */
  yawRate: number;
  /** La vitesse de rotation sur place (`turn`), en radians par seconde. */
  spin: number;
}

const DEFAULT_STYLE: MoverStyle = { radius: 0.7, accel: 1.2, lateral: 1.5, yawRate: 1.8, spin: 1.6 };

interface Running {
  track: Track;
  times: number[];
  /** La vitesse de croisière pour laquelle l'allure a été calculée : une vitesse qui change en route
   *  étire ou comprime le temps de parcours, sans refaire le calcul. */
  nominal: number;
  tau: number;
  s: number;
}

export class Mover {
  x = 0;
  y = 0;
  /** Le cap, en radians : la direction où l'engin regarde. */
  heading = 0;
  /** Le cap de sa remorque, s'il en a une (un semi) : suivi par les trajets qui le disent. */
  trailer = 0;
  /** En train de rouler (et non d'attendre ou de tourner sur place). */
  moving = false;
  /** La vitesse signée du moment, en cases par seconde : négative en marche arrière. */
  speed = 0;
  /**
   * La part de son allure qu'il garde, de 0 (arrêté) à 1 : ce que la circulation lui laisse (voir
   * `traffic.ts`). Elle freine ou relance le parcours sans rien retracer — le chemin reste le même.
   */
  throttle = 1;
  /**
   * Un écart de côté, en cases, à droite du cap (négatif : à gauche) : l'engin **serre sa droite**
   * pour en croiser un autre, sans quitter son trajet. Il ne change que sa pose montrée et celle que
   * voit la circulation.
   */
  side = 0;
  /** La pose montrée : la pose sur le trajet, décalée de `side`. */
  get shownX(): number {
    return this.x + Math.sin(this.heading) * this.side;
  }
  get shownY(): number {
    return this.y - Math.cos(this.heading) * this.side;
  }
  /** Le trajet en cours se fait en marche arrière (un semi qui recule à quai). */
  get reversingTrack(): boolean {
    return this.run?.track.reverse === true;
  }
  /** Le sens de la marche : en marche arrière sur un trajet qui le dit, ou quand il recule pour dégager. */
  get reversing(): boolean {
    return (this.run?.track.reverse === true) !== this.throttle < 0;
  }
  style: MoverStyle;
  private tasks: MoverTask[] = [];
  private elapsed = 0;
  private turn0: number | null = null;
  private run: Running | null = null;
  /** La pose lue sur le trajet, réemployée d'une image à l'autre. */
  private sample: TrackPose = { x: 0, y: 0, heading: 0 };

  constructor(x = 0, y = 0, heading = 0, style: Partial<MoverStyle> = {}) {
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.trailer = heading;
    this.style = { ...DEFAULT_STYLE, ...style };
  }

  get busy(): boolean {
    return this.tasks.length > 0;
  }

  get pose(): Pose {
    return { x: this.x, y: this.y, heading: this.heading };
  }

  push(...tasks: MoverTask[]): this {
    this.tasks.push(...tasks);
    return this;
  }

  /** Oublier ce qui reste à faire, et se poser là. */
  place(x: number, y: number, heading: number, trailer = heading): this {
    this.tasks = [];
    this.elapsed = 0;
    this.turn0 = null;
    this.run = null;
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.trailer = trailer;
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
      left = this.exec(this.tasks[0], left);
    }
    if (this.tasks.length === 0) {
      this.moving = false;
      this.speed = 0;
    }
  }

  /** Exécuter la tâche en cours pendant `dt` ; ce qui reste de `dt` si elle s'achève, sinon 0. */
  private exec(task: MoverTask, dt: number): number {
    if (task.kind === "until") {
      this.moving = false;
      this.speed = 0;
      return task.test() ? this.finish(task, dt) : 0;
    }
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
      // Un pivot amorti : une courbe en S du cap de départ au cap visé, sur la durée qu'il faut à
      // la vitesse de rotation de l'engin — une fois et demie, pour le démarrage et l'arrêt.
      if (this.turn0 === null) this.turn0 = this.heading;
      const d = angleDelta(this.turn0, task.to);
      const total = (Math.abs(d) / this.style.spin) * 1.5;
      const t = this.elapsed + dt;
      if (t < total) {
        this.elapsed = t;
        const u = t / total;
        this.heading = this.turn0 + d * u * u * (3 - 2 * u);
        return 0;
      }
      this.heading = this.turn0 + d;
      return this.finish(task, t - total);
    }
    if (!this.run) this.run = this.start(task);
    const r = this.run;
    const v = speedOf(task.speed);
    // Un frein négatif fait reculer l'engin sur son propre chemin — pour dégager une impasse.
    r.tau = Math.max(0, r.tau + dt * Math.max(-0.5, Math.min(1, this.throttle)) * (v / r.nominal));
    const total = r.times[r.times.length - 1] ?? 0;
    const s = distanceAt(r.track, r.times, r.tau);
    const ds = s - r.s;
    r.s = s;
    const p = sampleTrack(r.track, s, this.sample);
    this.x = p.x;
    this.y = p.y;
    // Le cap suit la tangente, sans jamais tourner plus vite que l'engin ne le peut : l'allure a
    // été calculée pour que ce soit toujours le cas — la borne n'est qu'un garde-fou.
    const maxTurn = this.style.yawRate * 1.5 * dt + 1e-4;
    this.heading += Math.max(-maxTurn, Math.min(maxTurn, angleDelta(this.heading, p.heading)));
    if (p.trailer !== undefined) this.trailer += Math.max(-maxTurn, Math.min(maxTurn, angleDelta(this.trailer, p.trailer)));
    this.moving = Math.abs(ds) > 1e-6 || this.throttle > 0.02;
    this.speed = (dt > 0 ? ds / dt : 0) * (r.track.reverse ? -1 : 1);
    if (r.tau < total && s < r.track.length - 1e-6) return 0;
    const spare = (r.tau - total) * (r.nominal / Math.max(0.05, v));
    this.heading = this.heading + angleDelta(this.heading, p.heading);
    if (p.trailer !== undefined) this.trailer = this.trailer + angleDelta(this.trailer, p.trailer);
    this.speed = 0;
    return this.finish(task, Math.max(0, spare));
  }

  /** Tracer le trajet d'une tâche au moment où elle commence, et en calculer l'allure. */
  private start(task: Extract<MoverTask, { kind: "go" | "track" }>): Running {
    const pose = this.pose;
    const nominal = Math.max(0.05, speedOf(task.speed));
    let track: Track;
    let opts: Partial<SpeedOptions> = {};
    if (task.kind === "go") {
      const radius = task.radius ?? this.style.radius;
      track = trackOf(planPath(pose, task.to, { radius }), false, pose.heading);
      // Le chemin part de la pose : son premier cap est celui de l'engin, pas une corde de l'arc.
      if (track.heading.length > 1) track.heading[0] = track.heading[1] + angleDelta(track.heading[1], pose.heading);
    } else {
      track = typeof task.track === "function" ? task.track(pose) : task.track;
      opts = { startSpeed: task.startSpeed, endSpeed: task.endSpeed };
    }
    const times = speedProfile(track, { speed: nominal, accel: this.style.accel, lateral: this.style.lateral, yawRate: this.style.yawRate, ...opts });
    return { track, times, nominal, tau: 0, s: 0 };
  }

  private finish(task: MoverTask, left: number): number {
    this.tasks.shift();
    this.elapsed = 0;
    this.turn0 = null;
    this.run = null;
    task.done?.();
    return Math.max(0, left);
  }
}

function speedOf(speed: number | (() => number)): number {
  return Math.max(0.05, typeof speed === "function" ? speed() : speed);
}
