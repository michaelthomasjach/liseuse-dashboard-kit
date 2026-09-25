import { PLOT_SIDES, PLOT_STREET, perimeterFenceRuns, plotSideFrame, type PlotDriveway, type PlotLayout, type PlotSide } from "./plot";
import { cornersOf, footprintOf, thicknessOf, type PlannerItem, type PlannerLinear } from "./plannerModel";

/**
 * La voie d'accès et la rue : où elles se rejoignent, et par où les camions entrent.
 *
 * ## Le raccordement
 *
 *  Une voie d'accès (`accessRoad`) est posée sur le terrain comme n'importe quel élément linéaire.
 *  Mais un de ses bouts, s'il arrive **au bord du terrain** — dessus, ou à moins d'une case et demie
 *  (`ACCESS_ROAD_REACH`) — et s'il y arrive **de face** (à 45° au plus de la perpendiculaire au bord),
 *  est raccordé à la rue qui longe ce côté :
 *
 *  - le trottoir côté terrain est **ouvert** au droit de la voie, un peu plus large qu'elle, et
 *    descend en pente de part et d'autre — un bateau (`RoadProps.driveways`) ;
 *  - l'**enrobé** de la voie continue du bout de la voie jusqu'au bord de la chaussée, à travers la
 *    bande d'herbe, en s'évasant vers la rue comme une vraie entrée charretière.
 *
 *  Un bout trop loin du bord, de biais, ou en face d'un coin de la rue reste un bout de voie simple.
 *  Les bords des échancrures (terrain en L, en T, en U) ne longent pas la rue : on ne s'y raccorde
 *  pas.
 *
 * ## L'entrée des camions
 *
 *  `accessRoadEntry` rend le point de la rue où un véhicule quitte la circulation pour entrer : sur
 *  l'axe de la voie d'accès prolongé, au milieu de la voie de la rue qui longe le terrain. C'est ce
 *  qu'attend `PlannerDockTraffic.entry` ; `accessRoadRoute` y ajoute les points de passage le long de
 *  la voie (`PlannerDockTraffic.via`), pour que les camions la suivent au lieu de couper à travers le
 *  terrain.
 */

type Pt = { x: number; y: number };
type PlotLike = Pick<PlotLayout, "width" | "depth" | "margin">;

/** Jusqu'où, du bord du terrain, un bout de voie d'accès se raccorde encore à la rue, en cases. */
export const ACCESS_ROAD_REACH = 1.5;
/** Ce que le bateau déborde la voie de chaque côté, en cases. */
const FLARE = 0.35;

/** Un bout de voie d'accès raccordé à la rue. */
export interface AccessRoadLink {
  /** Le bout raccordé : `(x0, y0)` ou `(x1, y1)`. */
  end: 0 | 1;
  /** Le côté du terrain, et donc la rue, où il se raccorde. */
  side: PlotSide;
  /** Où l'axe de la voie croise le bord du terrain. */
  edge: Pt;
  /** Où il croise le bord de la chaussée — la bordure abaissée. */
  curb: Pt;
  /** Où il croise le milieu de la voie de la rue qui longe le terrain : là où l'on entre. */
  entry: Pt;
  /** L'ouverture du trottoir, et l'enrobé qui rejoint la chaussée (voir `PlotDriveway`). */
  driveway: PlotDriveway;
}

/** Les bouts d'une voie d'accès raccordés à la rue du terrain — aucun, un, ou les deux. */
export function accessRoadLinks(road: PlannerLinear, plot: PlotLike): AccessRoadLink[] {
  if (road.kind !== "accessRoad") return [];
  const L = Math.hypot(road.x1 - road.x0, road.y1 - road.y0);
  if (L < 0.5) return [];
  const T = thicknessOf(road);
  const m = plot.margin;
  const sw = PLOT_STREET.sidewalk;
  const lw = PLOT_STREET.laneWidth;
  const out: AccessRoadLink[] = [];
  const ends: { end: 0 | 1; p: Pt; q: Pt }[] = [
    { end: 0, p: { x: road.x0, y: road.y0 }, q: { x: road.x1, y: road.y1 } },
    { end: 1, p: { x: road.x1, y: road.y1 }, q: { x: road.x0, y: road.y0 } },
  ];
  for (const { end, p, q } of ends) {
    // La direction de la voie, vers ce bout-ci : c'est par là qu'elle sort du terrain.
    const u = { x: (p.x - q.x) / L, y: (p.y - q.y) / L };
    let best: AccessRoadLink | null = null;
    let bestGap = Infinity;
    for (const side of PLOT_SIDES) {
      const f = plotSideFrame(plot, side);
      const d = f.out(p);
      if (d > 0.01 || d < -ACCESS_ROAD_REACH) continue;
      const toward = u.x * f.o.x + u.y * f.o.y;
      if (toward < Math.SQRT1_2 - 1e-6) continue;
      const sideways = u.x * f.t.x + u.y * f.t.y;
      // L'axe prolongé jusqu'à la distance `dd` du bord : le long du côté, où est-il ?
      const aAt = (dd: number) => f.along(p) + ((dd - d) * sideways) / toward;
      const a = aAt(0);
      // En face d'un coin de la rue, pas de trottoir droit à ouvrir.
      if (a < 1 || a > f.length - 1) continue;
      const n = { x: -u.y, y: u.x };
      const c1 = { x: p.x + (n.x * T) / 2, y: p.y + (n.y * T) / 2 };
      const c2 = { x: p.x - (n.x * T) / 2, y: p.y - (n.y * T) / 2 };
      const [cLo, cHi] = f.along(c1) <= f.along(c2) ? [c1, c2] : [c2, c1];
      // L'ouverture suit la voie prolongée jusqu'au trottoir, et la déborde un peu de chaque côté.
      const shift = ((m - d) * sideways) / toward;
      const lo = Math.min(f.along(cLo), f.along(cLo) + shift) - FLARE;
      const hi = Math.max(f.along(cHi), f.along(cHi) + shift) + FLARE;
      // Du bout de la voie au bord de la chaussée, en s'évasant jusqu'au trottoir.
      const apron = [cLo, cHi, f.at(hi, m), f.at(hi, m + sw + 0.02), f.at(lo, m + sw + 0.02), f.at(lo, m)];
      const link: AccessRoadLink = {
        end,
        side,
        edge: f.at(a, 0),
        curb: f.at(aAt(m + sw), m + sw),
        entry: f.at(aAt(m + sw + lw / 2), m + sw + lw / 2),
        driveway: { side, from: lo, to: hi, apron },
      };
      if (-d < bestGap) {
        bestGap = -d;
        best = link;
      }
    }
    if (best) out.push(best);
  }
  return out;
}

/**
 * Le point de la rue où les véhicules entrent par cette voie d'accès — à passer à
 * `PlannerDockTraffic.entry` —, ou `null` si aucun de ses bouts n'est raccordé à la rue.
 *
 *  C'est, sur l'axe de la voie prolongé, le milieu de la voie de circulation de la rue qui longe le
 *  terrain (la plus proche de lui). Si les deux bouts sont raccordés, c'est celui de `(x0, y0)`.
 */
export function accessRoadEntry(road: PlannerLinear, plot: PlotLike): Pt | null {
  return accessRoadLinks(road, plot)[0]?.entry ?? null;
}

/**
 * Le trajet d'un véhicule qui entre par la voie d'accès : le point d'entrée sur la rue, le bord du
 * terrain, puis l'autre bout de la voie — ou `null` si elle n'est pas raccordée.
 *
 *  `route[0]` est `accessRoadEntry` ; le reste, ce sont les points de passage
 *  (`PlannerDockTraffic.via`) qui font suivre la voie aux camions avant qu'ils ne tournent vers leur
 *  quai : `<PlannerDockTraffic entry={route[0]} via={route.slice(1)} … />`.
 */
export function accessRoadRoute(road: PlannerLinear, plot: PlotLike): Pt[] | null {
  const link = accessRoadLinks(road, plot)[0];
  if (!link) return null;
  const far = link.end === 0 ? { x: road.x1, y: road.y1 } : { x: road.x0, y: road.y0 };
  return [link.entry, link.edge, far];
}

/** Les raccordements de toutes les voies d'accès d'un plan — ce que `BuildPlot.driveways` attend. */
export function accessRoadDriveways(items: PlannerItem[], plot: PlotLike): PlotDriveway[] {
  return items.flatMap((it) => (it.kind === "accessRoad" ? accessRoadLinks(it as PlannerLinear, plot).map((l) => l.driveway) : []));
}

/**
 * Les ouvertures qu'une clôture de pourtour (`BuildPlot.perimeterFence`) laisse aux voies d'accès :
 * l'emprise de chacune, élargie de `margin` cases — un polygone convexe par voie.
 */
export function accessRoadOpenings(items: PlannerItem[], margin = 0.3): Pt[][] {
  return items
    .filter((it) => it.kind === "accessRoad")
    .map((it) => {
      const f = footprintOf(it);
      return cornersOf({ ...f, halfL: f.halfL + margin, halfW: f.halfW + margin });
    });
}

// --- Les portails de la clôture de pourtour ------------------------------------------------------------

/** Un portail percé dans la clôture de pourtour (voir `WarehousePlanner.gates`). */
export interface PlannerGate {
  id: string;
  /** Un point du bord constructible, sur un côté qui longe la rue — le milieu du portail. En cases. */
  x: number;
  y: number;
  /** La largeur de l'ouverture, en cases. Défaut : 3. */
  width?: number;
  /** L'ouverture du vantail, de 0 (fermé) à 1 (ouvert, défaut). */
  open?: number;
}

/** Où un portail est posé, et tout ce qui en découle. */
export interface GateLayout {
  side: PlotSide;
  /** Le milieu du portail le long du côté (repère de `plotSideFrame`), et sa largeur. */
  along: number;
  width: number;
  /** Le portail coulissant : son coin, son cap, sa largeur — ce qu'attend `SlidingGate`. */
  slide: { origin: Pt; rotation: number; length: number };
  /** L'ouverture qu'il fait dans la clôture (un polygone convexe) et son raccordement à la rue. */
  opening: Pt[];
  driveway: PlotDriveway;
  /** Le point de la rue d'où viennent les véhicules, et un point juste à l'intérieur. */
  entry: Pt;
  inside: Pt;
}

/** La largeur d'un portail, par défaut. */
export const GATE_WIDTH = 3;
/** Ce que l'enrobé d'un portail entre dans le terrain, en cases. */
const GATE_APRON = 1.2;

/** Le côté qui longe la rue sur lequel tombe un point du bord, et sa place le long de ce côté. */
function streetSideAt(p: Pt, plot: Pick<PlotLayout, "width" | "depth">, tolerance = 0.35): { side: PlotSide; along: number } | null {
  let best: { side: PlotSide; along: number; d: number } | null = null;
  for (const side of PLOT_SIDES) {
    const f = plotSideFrame(plot, side);
    const d = Math.abs(f.out(p));
    const a = f.along(p);
    if (d > tolerance || a < 0 || a > f.length) continue;
    if (!best || d < best.d) best = { side, along: a, d };
  }
  return best && { side: best.side, along: best.along };
}

/**
 * Tout ce qu'un portail entraîne, ou `null` s'il n'est pas sur un côté qui longe la rue.
 *
 *  Le portail est un `SlidingGate` posé un rien en retrait du bord, le long de lui ; son vantail
 *  s'efface du côté où la clôture a le plus de place (`room` : la longueur de clôture libre de part et
 *  d'autre, si on la connaît). La clôture de pourtour s'interrompt sur sa largeur (`opening`), le
 *  trottoir s'ouvre en face et l'enrobé court de la chaussée jusqu'à un peu dans le terrain
 *  (`driveway`).
 */
export function gateLayout(gate: PlannerGate, plot: Pick<PlotLayout, "width" | "depth" | "margin">, room?: { low: number; high: number }): GateLayout | null {
  const at = streetSideAt(gate, plot);
  if (!at) return null;
  const f = plotSideFrame(plot, at.side);
  const w = Math.max(1, gate.width ?? GATE_WIDTH);
  const a = at.along;
  const m = plot.margin;
  const sw = PLOT_STREET.sidewalk;
  const lw = PLOT_STREET.laneWidth;
  // Le vantail glisse vers les `a` décroissants — ou croissants, s'il y a plus de place de ce côté.
  const towardHigh = room ? room.high > room.low : false;
  const angle = (Math.atan2(f.t.y, f.t.x) * 180) / Math.PI + (towardHigh ? 180 : 0);
  const mid = f.at(a, -0.15);
  const lo = a - w / 2;
  const hi = a + w / 2;
  return {
    side: at.side,
    along: a,
    width: w,
    slide: { origin: { x: mid.x - w / 2, y: mid.y }, rotation: angle, length: w },
    opening: [f.at(lo - 0.05, -0.4), f.at(hi + 0.05, -0.4), f.at(hi + 0.05, 0.4), f.at(lo - 0.05, 0.4)],
    driveway: {
      side: at.side,
      from: lo - FLARE,
      to: hi + FLARE,
      apron: [f.at(lo, -GATE_APRON), f.at(hi, -GATE_APRON), f.at(hi + FLARE, m), f.at(hi + FLARE, m + sw + 0.02), f.at(lo - FLARE, m + sw + 0.02), f.at(lo - FLARE, m)],
    },
    entry: f.at(a, m + sw + lw / 2),
    inside: f.at(a, -2.5),
  };
}

/**
 * Par où les véhicules passent un portail : `entry`, le milieu de la voie de la rue qui longe le
 * terrain, en face du portail — à passer à `PlannerDockTraffic.entry` — et `inside`, un point à
 * deux cases et demie à l'intérieur, dans l'axe — à mettre en tête de `PlannerDockTraffic.via`.
 * `null` si le portail n'est pas sur un côté qui longe la rue (ou tombe dans une parcelle à vendre).
 */
export function gateEntry(gate: PlannerGate, plot: PlotLayout, lockedAreas?: PlotRectLike[]): { entry: Pt; inside: Pt } | null {
  const g = gateLayout(gate, plot);
  if (!g) return null;
  const inLocked = (lockedAreas ?? plot.locked ?? []).some((r) => gate.x >= r.x - 1e-6 && gate.x <= r.x + r.width + 1e-6 && gate.y >= r.y - 1e-6 && gate.y <= r.y + r.depth + 1e-6);
  if (inLocked) return null;
  return { entry: g.entry, inside: g.inside };
}

type PlotRectLike = { x: number; y: number; width: number; depth: number };

/**
 * Les portails, posés : chacun sur son côté, son vantail effacé du côté où la clôture a le plus de
 * place — ce qu'on mesure sur la clôture de pourtour percée des seules autres ouvertures.
 */
export function layGates(plot: PlotLayout, gates: PlannerGate[], openings: { x: number; y: number }[][] = []): { gate: PlannerGate; layout: GateLayout }[] {
  const bare = perimeterFenceRuns(plot, openings);
  const out: { gate: PlannerGate; layout: GateLayout }[] = [];
  for (const g of gates) {
    const first = gateLayout(g, plot);
    if (!first) continue;
    // La clôture libre de part et d'autre : le tronçon qui porte le portail, jusqu'à ses bouts.
    const run = bare.find((r) => (r.y0 === r.y1 ? Math.abs(r.y0 - g.y) < 0.35 && g.x >= Math.min(r.x0, r.x1) && g.x <= Math.max(r.x0, r.x1) : Math.abs(r.x0 - g.x) < 0.35 && g.y >= Math.min(r.y0, r.y1) && g.y <= Math.max(r.y0, r.y1)));
    const along = (p: { x: number; y: number }) => (run && run.y0 === run.y1 ? p.x : p.y);
    const room = run ? { low: first.along - first.width / 2 - Math.min(along({ x: run.x0, y: run.y0 }), along({ x: run.x1, y: run.y1 })), high: Math.max(along({ x: run.x0, y: run.y0 }), along({ x: run.x1, y: run.y1 })) - first.along - first.width / 2 } : undefined;
    out.push({ gate: g, layout: gateLayout(g, plot, room) ?? first });
  }
  return out;
}
