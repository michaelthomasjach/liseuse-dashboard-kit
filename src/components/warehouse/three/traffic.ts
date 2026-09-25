import { createContext, useContext } from "react";

/**
 * La **circulation partagée** d'une scène : ce qui empêche deux engins de se traverser.
 *
 * ## Un registre par scène
 *
 * Chaque engin qui roule — une navette, le chargeur d'un quai, un camion — s'y inscrit et y tient
 * sa pose à jour, à chaque image où il bouge. Avant d'avancer, il demande au registre **combien de
 * place il a devant lui** dans le sens où il roule : s'il y a quelqu'un, il ralentit, puis s'arrête à
 * bonne distance, et repart quand la voie se libère. Personne ne pilote l'ensemble : chacun ne
 * regarde que devant soi, comme un conducteur. Le coût est d'un passage sur les autres engins par
 * engin qui roule — une trentaine d'engins au plus, sans rien allouer.
 *
 *  Chaque engin est vu comme une **chenille de disques** le long de son axe : un transpalette en a
 *  un ou deux, un semi une dizaine. C'est assez juste pour se suivre et se croiser, assez simple pour
 *  être refait à chaque image.
 *
 * ## Qui passe
 *
 *  - on ne rattrape jamais celui qui est devant : on le suit ;
 *  - face à face, ou à un croisement où chacun voit l'autre, c'est la **priorité** qui décide —
 *    chargé avant vide, puis l'ordre des noms ; le moins prioritaire attend ;
 *  - un engin qui attend depuis longtemps un autre qui l'attend aussi (une impasse à trois) finit par
 *    passer si c'est lui le plus prioritaire des deux : rien ne reste figé pour toujours.
 *
 * ## Les zones réservées
 *
 *  Une cour de quai est une ressource : un seul camion à la fois fait sa manœuvre là où les surfaces
 *  balayées se recouvrent. `reserve(owner, zone)` la demande : elle est accordée si elle ne touche
 *  aucune zone déjà tenue **ni aucune demande plus ancienne encore en attente** — le premier arrivé
 *  est le premier servi, et un camion arrivé après ne double pas celui qui attend devant lui.
 *  `release(owner)` la rend. Les zones sont des listes de rectangles orientés ; leurs
 *  recouvrements sont calculés une fois, et gardés.
 *
 * ## Les portails
 *
 *  Un portail s'y déclare avec son centre et son rayon de détection ; les camions, à chaque image où
 *  ils bougent, disent au registre où ils sont, et le portail est prévenu quand quelqu'un entre dans
 *  son rayon ou en sort — il s'ouvre, et se referme derrière.
 */

export interface TrafficBody {
  /** Le centre de chaque disque, et son rayon, dans le plan. */
  discs: { x: number; y: number }[];
  radius: number;
}

export interface TrafficAgent {
  id: string;
  kind: "vehicle" | "truck";
  /** Les disques qui couvrent l'engin — tenus à jour par lui. */
  body: TrafficBody;
  /** Le sens où il roule, en radians (le cap, ou son opposé en marche arrière). */
  motion: number;
  /** Plus grand : passe avant. Chargé, un engin prend 1 ; vide, 0. */
  priority: number;
  /** Il attend quelqu'un (il est arrêté faute de place). */
  waiting: boolean;
  /** Depuis quand il attend, en secondes. */
  waited: number;
  /** Ne pas le compter (un camion hors du site). */
  ghost?: boolean;
  /** Un groupe qui travaille ensemble — un quai, ses camions et son chargeur : ils ne se bloquent pas
   *  entre eux (le chargeur vient **au cul** du camion qu'il sert). */
  group?: string;
  /** Celui qui l'arrête, relevé par `freeAhead`. */
  blocker?: TrafficAgent | null;
  /** Il recule pour débloquer une impasse, encore tant de secondes. */
  backing?: number;
}

/** `a` passe-t-il après `b` ? Chargé avant vide, puis l'ordre des noms. */
export function yieldsBefore(a: TrafficAgent, b: TrafficAgent): boolean {
  return (a.priority - b.priority || (a.id < b.id ? 1 : -1)) < 0;
}

/** Un rectangle orienté : son centre, ses demi-côtés, son angle. */
export interface OrientedBox {
  cx: number;
  cy: number;
  hl: number;
  hw: number;
  angle: number;
}

export interface TrafficZone {
  boxes: OrientedBox[];
  /** Le pavé qui les contient toutes : on l'essaie d'abord. */
  aabb: { x0: number; y0: number; x1: number; y1: number };
}

interface Reservation {
  owner: string;
  zone: TrafficZone;
  since: number;
  granted: boolean;
}

interface GateSensor {
  x: number;
  y: number;
  radius: number;
  inside: Set<string>;
  listener: (open: boolean) => void;
}

let seq = 0;

export class TrafficRegistry {
  readonly agents = new Set<TrafficAgent>();
  private reservations = new Map<string, Reservation>();
  private overlapCache = new WeakMap<TrafficZone, WeakMap<TrafficZone, boolean>>();
  private gates = new Set<GateSensor>();

  add(agent: TrafficAgent): () => void {
    this.agents.add(agent);
    return () => {
      this.agents.delete(agent);
      this.release(agent.id);
      for (const g of this.gates) if (g.inside.delete(agent.id) && g.inside.size === 0) g.listener(false);
    };
  }

  /**
   * La place libre devant `self`, dans le sens où il roule, en cases : la distance de son disque de
   * tête au premier engin qu'il rencontrerait dans son couloir, ou `Infinity`. `reach` borne la
   * recherche. Un engin qu'on voit de face et qui passe avant nous (priorité) ne compte pas comme
   * libre ; un engin moins prioritaire qui nous voit de face nous laisse passer.
   */
  freeAhead(self: TrafficAgent, reach: number): number {
    const d0 = self.body.discs;
    if (!d0.length) return Infinity;
    const cx = Math.cos(self.motion);
    const cy = Math.sin(self.motion);
    // La tête : le disque le plus en avant dans le sens de la marche.
    let head = d0[0];
    let best = -Infinity;
    for (const d of d0) {
      const a = d.x * cx + d.y * cy;
      if (a > best) {
        best = a;
        head = d;
      }
    }
    let free = Infinity;
    self.blocker = null;
    for (const other of this.agents) {
      if (other === self || other.ghost || (self.group !== undefined && other.group === self.group)) continue;
      const lane = self.body.radius + other.body.radius;
      let hit = Infinity;
      for (const d of other.body.discs) {
        const dx = d.x - head.x;
        const dy = d.y - head.y;
        const along = dx * cx + dy * cy;
        if (along < -self.body.radius * 0.5 || along > reach + lane) continue;
        const side = Math.abs(-dx * cy + dy * cx);
        if (side >= lane) continue;
        // La distance le long de notre axe jusqu'au contact avec ce disque.
        const gap = along - Math.sqrt(Math.max(0, lane * lane - side * side));
        if (gap < hit) hit = gap;
      }
      if (hit === Infinity) continue;
      // Même prioritaire, on ne fonce pas dans quelqu'un : tout près, on s'arrête aussi.
      if ((this.yieldsTo(self, other) || hit < 0.35) && hit < free) {
        free = hit;
        self.blocker = other;
      }
    }
    return free;
  }

  /**
   * L'engin qui vient **en face** dans notre couloir, le plus proche dans `reach` cases, et de
   * combien il faudrait s'écarter pour le croiser : chacun serre sa droite de la moitié. `null` si
   * personne.
   */
  oncoming(self: TrafficAgent, reach: number): { agent: TrafficAgent; need: number } | null {
    const d0 = self.body.discs;
    if (!d0.length) return null;
    const cx = Math.cos(self.motion);
    const cy = Math.sin(self.motion);
    const mid = d0[Math.floor(d0.length / 2)];
    let best: { agent: TrafficAgent; need: number; along: number } | null = null;
    // (Chacun s'écartant de la moitié, les deux ensemble couvrent l'écart.)
    for (const other of this.agents) {
      if (other === self || other.ghost || (self.group !== undefined && other.group === self.group) || Math.cos(other.motion - self.motion) > -0.5) continue;
      const lane = self.body.radius + other.body.radius + 0.2;
      for (const d of other.body.discs) {
        const dx = d.x - mid.x;
        const dy = d.y - mid.y;
        const along = dx * cx + dy * cy;
        // Tant qu'il est devant ou encore à notre hauteur, on le compte : on ne se rabat qu'une fois
        // qu'il est passé.
        if (along < -2 || along > reach) continue;
        const side = -dx * cy + dy * cx;
        if (Math.abs(side) >= lane + 0.8) continue;
        // Positif : serrer à droite de tant ; négatif (il est sur notre droite) : à gauche. Déjà assez
        // loin : zéro — on garde l'écart pris.
        const need = side >= 0 ? Math.max(0, lane - side) : Math.min(0, -(lane + side));
        if (!best || along < best.along) best = { agent: other, need, along };
      }
    }
    return best && { agent: best.agent, need: best.need };
  }

  /** `self` doit-il laisser passer `other`, qu'il a dans son couloir ? */
  private yieldsTo(self: TrafficAgent, other: TrafficAgent): boolean {
    // L'autre nous voit-il aussi devant lui ? Si non, il s'éloigne ou croise devant : on le suit.
    const facing = Math.cos(other.motion - self.motion) < -0.3;
    if (!facing) return true;
    // Face à face : le plus prioritaire passe ; à égalité, l'ordre des noms.
    const mine = self.priority - other.priority || (self.id < other.id ? 1 : -1);
    if (mine > 0) {
      // Nous passons… sauf si l'autre est déjà bloqué par nous depuis longtemps et que nous
      // attendons aussi : on ne reste pas deux à se regarder.
      return false;
    }
    // Il passe. Mais s'il attend lui aussi depuis longtemps, c'est une impasse : celui qui a le
    // plus attendu y va.
    if (other.waiting && self.waiting && self.waited > 6 && self.waited > other.waited + 1) return false;
    return true;
  }

  // --- Les zones ---------------------------------------------------------------------------------

  /** Demander une zone. Vrai si elle est tenue (accordée maintenant ou déjà). */
  reserve(owner: string, zone: TrafficZone, now: number): boolean {
    let r = this.reservations.get(owner);
    if (!r || r.zone !== zone) {
      r = { owner, zone, since: now + (seq++) * 1e-9, granted: false };
      this.reservations.set(owner, r);
    }
    if (r.granted) return true;
    for (const other of this.reservations.values()) {
      if (other === r) continue;
      // Une zone tenue, ou une demande plus ancienne encore en attente, qui touche la nôtre.
      if ((other.granted || other.since < r.since) && this.zonesOverlap(r.zone, other.zone)) return false;
    }
    r.granted = true;
    return true;
  }

  /** Une zone est-elle libre pour y poser quelque chose (un camion qui apparaît) ? */
  zoneFree(zone: TrafficZone, except?: string): boolean {
    for (const other of this.reservations.values()) if (other.owner !== except && other.granted && this.zonesOverlap(zone, other.zone)) return false;
    return true;
  }

  release(owner: string): void {
    this.reservations.delete(owner);
  }

  holds(owner: string): boolean {
    return this.reservations.get(owner)?.granted === true;
  }

  zonesOverlap(a: TrafficZone, b: TrafficZone): boolean {
    let m = this.overlapCache.get(a);
    const hit = m?.get(b);
    if (hit !== undefined) return hit;
    const v = zonesOverlap(a, b);
    if (!m) this.overlapCache.set(a, (m = new WeakMap()));
    m.set(b, v);
    return v;
  }

  // --- Les portails ------------------------------------------------------------------------------

  /** Déclarer un portail : `listener(true)` quand un camion entre dans son rayon, `false` quand le
   *  dernier en sort. */
  addGate(x: number, y: number, radius: number, listener: (open: boolean) => void): () => void {
    const g: GateSensor = { x, y, radius, inside: new Set(), listener };
    this.gates.add(g);
    return () => void this.gates.delete(g);
  }

  /** Un camion dit où il est : les portails dans le rayon desquels il entre ou sort sont prévenus. */
  sense(id: string, x: number, y: number): void {
    for (const g of this.gates) {
      const near = Math.hypot(x - g.x, y - g.y) < g.radius;
      if (near && !g.inside.has(id)) {
        g.inside.add(id);
        if (g.inside.size === 1) g.listener(true);
      } else if (!near && g.inside.has(id)) {
        g.inside.delete(id);
        if (g.inside.size === 0) g.listener(false);
      }
    }
  }
}

// --- La géométrie --------------------------------------------------------------------------------

export function boxCorners(b: OrientedBox): { x: number; y: number }[] {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  return [
    [-b.hl, -b.hw],
    [b.hl, -b.hw],
    [b.hl, b.hw],
    [-b.hl, b.hw],
  ].map(([u, v]) => ({ x: b.cx + u * c - v * s, y: b.cy + u * s + v * c }));
}

/** Deux rectangles orientés se recouvrent-ils ? Les axes séparateurs. */
export function boxesOverlap(a: OrientedBox, b: OrientedBox): boolean {
  const ca = boxCorners(a);
  const cb = boxCorners(b);
  for (const angle of [a.angle, a.angle + Math.PI / 2, b.angle, b.angle + Math.PI / 2]) {
    const ax = Math.cos(angle);
    const ay = Math.sin(angle);
    let a0 = Infinity;
    let a1 = -Infinity;
    let b0 = Infinity;
    let b1 = -Infinity;
    for (const p of ca) {
      const d = p.x * ax + p.y * ay;
      a0 = Math.min(a0, d);
      a1 = Math.max(a1, d);
    }
    for (const p of cb) {
      const d = p.x * ax + p.y * ay;
      b0 = Math.min(b0, d);
      b1 = Math.max(b1, d);
    }
    if (a1 <= b0 || b1 <= a0) return false;
  }
  return true;
}

export function makeZone(boxes: OrientedBox[]): TrafficZone {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of boxes)
    for (const p of boxCorners(b)) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
  return { boxes, aabb: { x0, y0, x1, y1 } };
}

export function zonesOverlap(a: TrafficZone, b: TrafficZone): boolean {
  if (a.aabb.x1 <= b.aabb.x0 || b.aabb.x1 <= a.aabb.x0 || a.aabb.y1 <= b.aabb.y0 || b.aabb.y1 <= a.aabb.y0) return false;
  for (const p of a.boxes) for (const q of b.boxes) if (boxesOverlap(p, q)) return true;
  return false;
}

// --- Le registre de la scène -----------------------------------------------------------------------

/** Le registre d'une scène. Hors d'une scène (un module seul), chacun a le sien — personne à croiser. */
export const TrafficContext = createContext<TrafficRegistry | null>(null);

const orphan = new TrafficRegistry();

export function useTraffic(): TrafficRegistry {
  return useContext(TrafficContext) ?? orphan;
}

/**
 * Le frein d'un engin : de la place libre devant lui à la part de sa vitesse qu'il garde, de 1 (voie
 * libre) à 0 (arrêté à `gap` de l'autre). `brake` : la distance sur laquelle il ralentit.
 */
export function throttleFor(free: number, gap: number, brake: number): number {
  if (free === Infinity) return 1;
  return Math.max(0, Math.min(1, (free - gap) / Math.max(0.1, brake)));
}
