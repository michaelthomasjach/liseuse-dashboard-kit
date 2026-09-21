import { useId, type CSSProperties, type ReactNode } from "react";
import { projectIso } from "./warehouseIso";
import { paintOrder } from "./warehousePaint";
import {
  ISO_POST_SIZE,
  boxFaces,
  fitRackItem,
  isoFacing,
  rackItemIso,
  solidVolume,
  type Point,
  type Project,
  type RackItemKind,
} from "./rackItems";
import "./Conveyor.css";

/**
 * Tapis roulant — droit, ou à angle droit.
 *
 * Built out of the same vocabulary as the rack (`rackItems.tsx`): axis-aligned volumes showing the
 * three faces the camera can see, at three lightnesses of one colour under one light, opaque, with
 * the visible faces chosen from the rotation rather than assumed. A conveyor standing next to a
 * rack has to be made of the same stuff, or the picture reads as two drawings side by side.
 *
 * ## The two kinds
 *
 * A **straight** run is a bed of `length` × `width` on legs. A **corner** is the square transfer
 * module a real floor uses to turn a line: the same bed over a `width` × `width` footprint, with
 * the belt arcing across it from the middle of one edge to the middle of the next. It is a quarter
 * of a circle centred on the module's far corner, tangent to `+x` where it comes in and to `+y`
 * where it leaves, so the two ends meet a straight run square-on and nothing has to be nudged into
 * place.
 *
 * ## Guards
 *
 * A low rail runs down both edges of the belt, because that is what stops a parcel walking off the
 * side and it is the part that tells you which way the goods are contained. On a straight run each
 * is one box. On a corner each is **a chain of short boxes following the arc**, and they are not a
 * decoration laid on top: every segment is a volume like any other, so it takes its place in the
 * depth order with everything else. That matters here — the outer rail is in front of the inner one
 * over the second half of the bend and **behind it over the first**, since the camera looks from the
 * corner the arc is centred on, and a blanket "outer last" would be wrong for half the turn.
 *
 * ## Direction, and what moves
 *
 * One arrow on the belt says which way it runs, and it does not move: a mark that has to animate to
 * be read is a mark half the readers never read — `prefers-reduced-motion`, a paused tab, a
 * screenshot. What moves is the **load**, which is the honest thing to animate, since a conveyor is
 * only interesting because something is going somewhere on it.
 *
 * A load **takes the bend with the belt**, and that is the one thing here a transform cannot do.
 * This camera maps a *plane* affinely, not space: the screen displacement of a point under a floor
 * rotation depends on its height, so one matrix would shear a carton by some twenty pixels through
 * the turn. So a load on a corner is **redrawn** at each of twelve arc segments, at the bearing it
 * takes there — by turning the *projector* about the load's own centre, which draws a turned box
 * with the code that only knows how to draw square ones — and each copy slides across its own
 * segment before handing over to the next. The position never jumps; only the bearing steps, by
 * under four degrees at a time, which does not read as stepping at all. A round load is exempt: a drum looks the same at every bearing, so it is
 * drawn once and carried. It fades in where it arrives and out where it leaves, a module drawn on
 * its own having no upstream to show.
 *
 * ## Legs
 *
 * `legHeight` sets how high the bed stands, and the legs have the **rack's own post section** —
 * not a copy of the number but the same constant, since it is the same steel profile and two equal
 * constants eventually stop being equal. A long run grows intermediate legs rather than stretching
 * two: a nine-metre bed on four legs is a diving board.
 */

export type ConveyorKind = "straight" | "corner";

export interface ConveyorProps {
  /** Droit, ou à angle droit. */
  kind?: ConveyorKind;
  /** Longueur du tapis, en cases. Un angle est carré : il prend sa largeur. */
  length?: number;
  /** Largeur du tapis, en cases. */
  width?: number;
  /** Hauteur sous le bâti, en cases. */
  legHeight?: number;
  /** Section d'un pied, en cases. Par défaut celle d'un montant d'étagère — le même profilé. */
  legSize?: number;
  /** Épaisseur du bâti qui porte la bande. */
  bedThickness?: number;
  /** Hauteur des barrières de rive, en cases. Zéro pour un tapis sans joues. */
  guardHeight?: number;
  /** Ce qui voyage sur la bande. `null` pour un tapis à vide. */
  load?: RackItemKind | null;
  /** Combien de charges à la fois, réparties le long du parcours. */
  loadCount?: number;
  /** Le tapis va en arrière. */
  reversed?: boolean;
  /** Le tapis tourne. À faux, la flèche dit encore le sens. */
  running?: boolean;
  /** Vitesse de la bande, en cases par seconde. La même vitesse donne le meme deplacement sur un
   *  tapis long comme sur un angle — une duree, elle, les ferait aller a des allures differentes. */
  speed?: number;
  /** Rotation du tapis sur le sol, en degrés. */
  rotation?: number;
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

const PAD = 2;

/** Part de la largeur occupée par la bande, le reste étant le bâti de chaque côté. */
const BELT_SHARE = 0.74;

/** Hauteur d'une barrière, en cases. Basse : elle retient un colis, elle ne le cache pas. */
const DEFAULT_GUARD = 0.14;

/** Points d'echantillonnage du parcours d'une charge, tous troncons confondus. Un arc en demande
 *  beaucoup ; une ligne droite s'en contenterait de deux. */
const LOAD_SAMPLES = 24;

/** Troncons d'arc sur lesquels une charge anguleuse est redessinee, dans un angle. Tourner un
 *  volume n'est pas une transformation d'ecran : la camera envoie un *plan* affinement, pas
 *  l'espace, et le deplacement d'un point sous une rotation du sol depend de sa hauteur. Une seule
 *  matrice cisaillerait donc le colis d'une vingtaine de pixels dans le virage. Il est redessine a
 *  chaque troncon, au cap qu'il y prend, et chaque exemplaire glisse sur sa part du parcours : la
 *  position ne saute jamais, seul le cap change — de moins de quatre degres a la fois, ce qui ne
 *  se voit plus. */
const TURN_STEPS = 24;

type Piece = { x: number; y: number; width: number; height: number; render: () => ReactNode };
/** Un point du parcours et la direction qu'y prend la bande. */
type Step = { x: number; y: number; hx: number; hy: number };

export function Conveyor({
  kind = "straight",
  length = 6,
  width = 1.6,
  legHeight = 1,
  legSize = ISO_POST_SIZE,
  bedThickness = 0.22,
  guardHeight = DEFAULT_GUARD,
  load = null,
  loadCount = 1,
  reversed = false,
  running = true,
  speed = 1.1,
  rotation = 0,
  cellSize = 34,
  className,
}: ConveyorProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  // Un angle est carré : il tourne dans son propre encombrement, et une longueur n'aurait aucun
  // sens à lui donner.
  const spanX = kind === "corner" ? width : Math.max(width, length);
  const spanY = width;

  const theta = (rotation * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const spin = (x: number, y: number) => {
    if (!rotation) return { x, y };
    const dx = x - spanX / 2;
    const dy = y - spanY / 2;
    return { x: spanX / 2 + dx * cosT - dy * sinT, y: spanY / 2 + dx * sinT + dy * cosT };
  };
  const at: Project = (x, y, z) => {
    const p = spin(x, y);
    return projectIso(p.x * cellSize, p.y * cellSize, z * cellSize);
  };
  const facing = isoFacing(rotation);
  const ring = (points: Point[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  const footprint = (xs: number[], ys: number[]) => {
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  };

  const leg = Math.max(0.04, Math.min(legSize, Math.min(spanX, spanY) / 2));
  const bedZ = Math.max(0, legHeight);
  const bedTop = bedZ + Math.max(0.02, bedThickness);
  const beltHalf = (spanY * BELT_SHARE) / 2;
  const guard = Math.max(0, guardHeight);
  const guardThick = Math.max(0.03, spanY * 0.045);
  /** Ce que le bati deborde de part et d'autre de la bande : de quoi porter la barriere et un peu
   *  de rive au-dela. */
  const bedMargin = guardThick * 1.8;

  // ---- le parcours de la bande ----
  // Un angle est un quart de cercle centré sur le coin (0, largeur) : tangent à +x où il entre, à
  // +y où il sort, donc il se raccorde d'équerre à un tapis droit des deux côtés.
  const radius = spanY / 2;
  const run = kind === "corner" ? (Math.PI / 2) * radius : spanX;
  const stepAt = (t: number): Step => {
    if (kind === "corner") {
      const a = -Math.PI / 2 + (Math.PI / 2) * t;
      return { x: radius * Math.cos(a), y: spanY + radius * Math.sin(a), hx: -Math.sin(a), hy: Math.cos(a) };
    }
    return { x: run * t, y: spanY / 2, hx: 1, hy: 0 };
  };
  /** Un point de l'anneau d'un angle, par rayon et par angle. */
  const arcPoint = (r: number, a: number, z: number) => at(r * Math.cos(a), spanY + r * Math.sin(a), z);
  /** L'angle du parcours au tronçon `i` d'un découpage en `n`. */
  const arcAngle = (i: number, n: number) => -Math.PI / 2 + (Math.PI / 2) * (i / n);
  /**
   * Un anneau **d'un seul tenant** : sa face du dessus, ses deux parois, et ses deux bouts droits
   * quand ils regardent la caméra. Le bâti d'un angle et ses barrières sont tous deux faits de ça —
   * un bâti n'est qu'un anneau très épais, et il ne sert à rien d'en écrire deux fois la géométrie.
   *
   * Il était d'abord découpé en tronçons, un volume par facette, pour que chacun montre la paroi
   * que la caméra voit de son côté de l'arc — car ce côté change en cours de virage. Mais chaque
   * facette porte son propre trait, et une bordure faite de quatorze petits rectangles cernés se
   * lit comme quatorze petits rectangles. Les deux parois sont donc dessinées entières, d'une seule
   * courbe, et **de la même teinte** : celle qui se trouve derrière est alors recouverte par l'autre
   * sans que rien ne le montre, et la réunion des deux couvre exactement la silhouette vraie. La
   * face du dessus passe en dernier et recouvre la paroi lointaine, qui pend sous elle.
   */
  const arcRing = (material: string, rIn: number, rOut: number, z0: number, z1: number, key: string): ReactNode => {
    const N = 48;
    const band = (r: number, z: number) => Array.from({ length: N + 1 }, (_, i) => arcPoint(r, arcAngle(i, N), z));
    const outerTop = band(rOut, z1);
    const innerTop = band(rIn, z1);
    const outerLow = band(rOut, z0);
    const innerLow = band(rIn, z0);
    const caps: Point[][] = [];
    const capAt = (a: number, sign: number) => {
      const t = spin(-Math.sin(a) * sign, Math.cos(a) * sign);
      const o = spin(0, 0);
      return t.x - o.x + (t.y - o.y) > 0;
    };
    const a0 = arcAngle(0, 1);
    const a1 = arcAngle(1, 1);
    if (capAt(a0, -1)) caps.push([arcPoint(rIn, a0, z0), arcPoint(rOut, a0, z0), arcPoint(rOut, a0, z1), arcPoint(rIn, a0, z1)]);
    if (capAt(a1, 1)) caps.push([arcPoint(rIn, a1, z0), arcPoint(rOut, a1, z0), arcPoint(rOut, a1, z1), arcPoint(rIn, a1, z1)]);
    return (
      <g key={key} className={`lq-iso__solid lq-iso__solid--${material}`}>
        <polygon className="lq-iso__face lq-iso__face--front" points={ring([...innerTop, ...[...innerLow].reverse()])} />
        <polygon className="lq-iso__face lq-iso__face--front" points={ring([...outerTop, ...[...outerLow].reverse()])} />
        {caps.map((c, k) => (
          <polygon key={`cap${k}`} className="lq-iso__face lq-iso__face--front" points={ring(c)} />
        ))}
        <polygon className="lq-iso__face lq-iso__face--top" points={ring([...outerTop, ...[...innerTop].reverse()])} />
      </g>
    );
  };

  /** La bande elle-même : le ruban balayé par le parcours, à plat sur le bâti. */
  const beltFace = (() => {
    if (kind === "corner") {
      const outer: Point[] = [];
      const inner: Point[] = [];
      for (let i = 0; i <= 48; i += 1) {
        const a = arcAngle(i, 48);
        outer.push(arcPoint(radius + beltHalf, a, bedTop));
        inner.push(arcPoint(radius - beltHalf, a, bedTop));
      }
      return [...outer, ...inner.reverse()];
    }
    return [
      at(0, spanY / 2 - beltHalf, bedTop),
      at(spanX, spanY / 2 - beltHalf, bedTop),
      at(spanX, spanY / 2 + beltHalf, bedTop),
      at(0, spanY / 2 + beltHalf, bedTop),
    ];
  })();

  /** La flèche : une seule, au milieu du parcours, et elle ne bouge pas. */
  const arrow = (() => {
    const way = reversed ? -1 : 1;
    const tip = stepAt(0.5 + 0.09 * way);
    const tail = stepAt(0.5 - 0.09 * way);
    const nx = -tail.hy;
    const ny = tail.hx;
    const armLen = beltHalf * 0.5;
    return ring([
      at(tail.x + nx * armLen, tail.y + ny * armLen, bedTop),
      at(tip.x, tip.y, bedTop),
      at(tail.x - nx * armLen, tail.y - ny * armLen, bedTop),
    ]);
  })();

  // ---- ce qui se tient sur le bâti : les barrières, et la charge ----
  const pieces: Piece[] = [];

  // Les barrières d'un angle sont deux anneaux minces ; celles d'un droit, deux boîtes. Leur ordre
  // entre elles est sans objet : toute la largeur de la bande les sépare, donc elles ne se
  // recouvrent jamais à l'écran. Ce qui compte est qu'elles passent toutes deux *avant* ce qui
  // voyage sur la bande.
  const guards: ReactNode[] = [];
  if (guard > 0) {
    if (kind === "corner") {
      for (const r of [radius - beltHalf - guardThick / 2, radius + beltHalf + guardThick / 2]) {
        guards.push(arcRing("post", r - guardThick / 2, r + guardThick / 2, bedTop, bedTop + guard, `g${r.toFixed(3)}`));
      }
    } else {
      for (const edge of [spanY / 2 - beltHalf - guardThick, spanY / 2 + beltHalf]) {
        guards.push(
          solidVolume(
            "post",
            `g${edge.toFixed(3)}`,
            boxFaces(at, 0, spanX, edge, edge + guardThick, bedTop, bedTop + guard, facing)
          )
        );
      }
    }
  }

  // ---- ce qui voyage dessus ----
  /** Le projecteur d'une charge qui a pris le cap `deg` autour de son propre centre. Tourner le
   *  projecteur plutot que la boite, c'est dessiner une boite tournee avec le code qui n'en sait
   *  dessiner que des droites. */
  const bearingAt = (deg: number, cx: number, cy: number) => {
    const r = (deg * Math.PI) / 180;
    const c = Math.cos(r);
    const sn = Math.sin(r);
    const project: Project = (x, y, z) => {
      const dx = x - cx;
      const dy = y - cy;
      return at(cx + dx * c - dy * sn, cy + dx * sn + dy * c, z);
    };
    return { project, facing: isoFacing(rotation + deg) };
  };

  const travel = run / Math.max(0.01, speed);
  const many = Math.max(1, Math.floor(loadCount));
  // Un colis rond a le meme dessin sous tous les caps : inutile de le redecouper. Un colis
  // anguleux dans un angle, si.
  const rounded = load ? fitRackItem(load, { x: 0, y: 0, width: 1, depth: 1 }, 0, Infinity).spec.round : false;
  const turns = kind === "corner" && load && !rounded ? TURN_STEPS : 1;
  const perTurn = Math.max(2, Math.round(LOAD_SAMPLES / turns));
  const berth = beltHalf * 2;
  const along = (t: number) => stepAt(reversed ? 1 - t : t);
  const bearing = (t: number) => {
    const h = along(t);
    const way = reversed ? -1 : 1;
    return (Math.atan2(h.hy * way, h.hx * way) * 180) / Math.PI;
  };

  const rideFrames: string[] = [];
  const rides: ReactNode[] = [];
  for (let i = 0; i < turns; i += 1) {
    const t0 = i / turns;
    const t1 = (i + 1) / turns;
    const here = along(t0);
    const view = bearingAt(bearing(t0), here.x, here.y);
    const fit = fitRackItem(
      load ?? "carton",
      { x: here.x - berth / 2, y: here.y - berth / 2, width: berth, depth: berth },
      bedTop,
      Infinity
    );
    const base = at(here.x, here.y, bedTop);
    const shift = (t: number) => {
      const p = along(t);
      const q = at(p.x, p.y, bedTop);
      return `translate(${(q.x - base.x).toFixed(3)}px,${(q.y - base.y).toFixed(3)}px)`;
    };
    const pct = (t: number) => (t * 100).toFixed(3);
    // Hors de sa fenetre l'exemplaire est transparent ; le passage de relais est franc, les deux
    // exemplaires voisins etant au meme endroit a cet instant, seul leur cap differant.
    const fadeIn = i === 0 ? 0.03 : 0;
    const fadeOut = i === turns - 1 ? 0.03 : 0;
    const stops: string[] = [];
    // Deux arrets ne peuvent pas partager le meme pourcentage : le dernier ecrase le premier, et
    // l'opacite 0 qui devait tenir jusqu'a la fenetre disparaissait — chaque exemplaire fondait
    // alors en continu depuis le debut du cycle, et les douze se voyaient tous en meme temps, en
    // eventail. Le relais se fait donc sur un millieme de cycle, ce qui est franc a l'oeil.
    const BLINK = 0.0005;
    if (t0 > 0)
      stops.push(`0%{opacity:0;transform:${shift(t0)}}`, `${pct(t0 - BLINK)}%{opacity:0;transform:${shift(t0)}}`);
    stops.push(`${pct(t0)}%{opacity:${fadeIn ? 0 : 1};transform:${shift(t0)}}`);
    if (fadeIn) stops.push(`${pct(t0 + fadeIn)}%{opacity:1;transform:${shift(t0 + fadeIn)}}`);
    for (let k = 1; k < perTurn; k += 1) {
      const t = t0 + ((t1 - t0) * k) / perTurn;
      if (t <= t0 + fadeIn || t >= t1 - fadeOut) continue;
      stops.push(`${pct(t)}%{opacity:1;transform:${shift(t)}}`);
    }
    if (fadeOut) stops.push(`${pct(t1 - fadeOut)}%{opacity:1;transform:${shift(t1 - fadeOut)}}`);
    stops.push(`${pct(t1)}%{opacity:${fadeOut ? 0 : 1};transform:${shift(t1)}}`);
    if (t1 < 1)
      stops.push(`${pct(t1 + BLINK)}%{opacity:0;transform:${shift(t1)}}`, `100%{opacity:0;transform:${shift(t1)}}`);
    rideFrames.push(`@keyframes lq-ride-${uid}-${i}{${stops.join("")}}`);

    if (!load) continue;
    for (let n = 0; n < many; n += 1) {
      rides.push(
        <g
          key={`load${i}-${n}`}
          className="lq-conveyor__ride"
          style={
            running
              ? {
                  animationName: `lq-ride-${uid}-${i}`,
                  animationDuration: `${travel}s`,
                  animationDelay: `${-(travel * n) / many}s`,
                }
              : { opacity: i === 0 ? 1 : 0 }
          }
        >
          {rackItemIso(load, fit, view.project, view.facing, `load${i}-${n}`)}
        </g>
      );
    }
  }

  if (load) {
    // Triee a mi-parcours : c'est la position la plus representative d'une charge qui se deplace,
    // et elle reste de toute facon entre les deux barrieres d'un bout a l'autre.
    const mid = stepAt(0.5);
    pieces.push({
      x: mid.x - berth / 2,
      y: mid.y - berth / 2,
      width: berth,
      height: berth,
      render: () => <g key="loads">{rides}</g>,
    });
  }

  // ---- le bâti ----
  // Dans un angle, il suit la courbe : un plateau carré sous une bande qui tourne dit que la
  // machine est une caisse à laquelle on a peint un arc dessus, alors que c'est une courbe qui a
  // une largeur. C'est le même anneau que les barrières, en beaucoup plus épais.
  const bed: ReactNode =
    kind === "corner" ? (
      arcRing("steel", radius - beltHalf - bedMargin, radius + beltHalf + bedMargin, bedZ, bedTop, "bed")
    ) : (
      solidVolume("steel", "bed", boxFaces(at, 0, spanX, 0, spanY, bedZ, bedTop, facing))
    );

  // ---- les pieds ----
  // Un tapis long fait pousser des pieds intermédiaires : un bâti de neuf mètres sur quatre pieds
  // est un plongeoir.
  const legs: Piece[] = [];
  const legAt = (cx: number, cy: number, key: string) =>
    legs.push({
      x: cx - leg / 2,
      y: cy - leg / 2,
      width: leg,
      height: leg,
      render: () =>
        solidVolume("post", key, boxFaces(at, cx - leg / 2, cx + leg / 2, cy - leg / 2, cy + leg / 2, 0, bedZ, facing)),
    });
  if (kind === "corner") {
    // Un pied sous chaque coin de l'anneau : ce sont les quatre seuls endroits où le bâti a un
    // bout droit sur lequel poser quelque chose.
    // Un poteau affleure le bord du bâti, et un poteau est un carré : ce dont il déborde dans une
    // direction n'est donc pas la moitié de son côté mais `h·(|cos| + |sin|)` — la moitié à plat,
    // la demi-diagonale en biais. Posé en biais avec un retrait d'une demi-largeur, comme il
    // l'était, il sortait de l'anneau d'un cinquième de sa taille.
    const h = leg / 2;
    const reachAt = (ux: number, uy: number) => h * (Math.abs(ux) + Math.abs(uy));
    const stand = (a: number, outer: boolean, tangentSign: number, key: string) => {
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const edge = outer ? radius + beltHalf + bedMargin : radius - beltHalf - bedMargin;
      const r = outer ? edge - reachAt(ux, uy) : edge + reachAt(ux, uy);
      // Aux deux bouts, il affleure aussi le plan droit qui ferme l'anneau.
      const tx = -uy * tangentSign;
      const ty = ux * tangentSign;
      const slide = tangentSign === 0 ? 0 : reachAt(tx, ty);
      legAt(r * ux + tx * slide, spanY + r * uy + ty * slide, key);
    };
    stand(arcAngle(0, 1), false, 1, "l-in-start");
    stand(arcAngle(0, 1), true, 1, "l-out-start");
    stand(arcAngle(1, 1), false, -1, "l-in-end");
    stand(arcAngle(1, 1), true, -1, "l-out-end");
    // Et un cinquième au milieu de la courbe, sur la rive extérieure : c'est la portée la plus
    // longue du bâti, et la seule qui n'a rien sous elle entre les deux bouts.
    stand(arcAngle(1, 2), true, 0, "l-mid");
  } else {
    const rows = Math.max(2, Math.round(spanX / 2.5) + 1);
    for (let r = 0; r < rows; r += 1) {
      const x0 = leg / 2 + ((spanX - leg) * r) / (rows - 1);
      for (const y0 of [leg / 2, spanY - leg / 2]) legAt(x0, y0, `l${r}-${y0}`);
    }
  }

  const sorted = (list: Piece[]) =>
    paintOrder(
      list.map((piece) => {
        if (!rotation) return piece;
        const pts = [
          spin(piece.x, piece.y),
          spin(piece.x + piece.width, piece.y),
          spin(piece.x + piece.width, piece.y + piece.height),
          spin(piece.x, piece.y + piece.height),
        ];
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        return { ...footprint(xs, ys), render: piece.render };
      })
    );

  const corners = [
    at(0, 0, 0),
    at(spanX, 0, 0),
    at(spanX, spanY, 0),
    at(0, spanY, 0),
    at(0, 0, bedTop + guard),
    at(spanX, 0, bedTop + guard),
    at(spanX, spanY, bedTop + guard),
    at(0, spanY, bedTop + guard),
  ];
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  return (
    <svg
      className={["lq-conveyor", !running && "lq-conveyor--stopped", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`}
      style={{ "--lq-conveyor-cycle": `${travel}s` } as CSSProperties}
      role="img"
      aria-label={`Tapis roulant ${kind === "corner" ? "d'angle" : "droit"}${running ? ", en marche" : ", arrêté"}`}
    >
      {load && (
        <defs>
          <style>{rideFrames.join("")}</style>
        </defs>
      )}

      {sorted(legs).map((piece) => piece.render())}
      {bed}
      {/* La bande et sa flèche sont à plat sur le bâti : rien ne peut passer dessous, donc elles
          sont posées avant tout ce qui se dresse dessus plutôt que triées avec. */}
      <polygon className="lq-conveyor__belt" points={ring(beltFace)} />
      <polyline className="lq-conveyor__arrow" points={arrow} />
      {/* Les deux barrières avant tout ce qui voyage, jamais après. Une barrière fait cinq pixels
          de haut et un colis en fait cinquante : la rive qui lui passe devant ne se lit pas comme
          « le colis est derrière la rive », elle se lit comme un colis coupé. Les deux barrières
          entre elles n'ont pas d'ordre à avoir — toute la largeur de la bande les sépare, donc
          elles ne se recouvrent jamais à l'écran. */}
      {guards}
      {sorted(pieces).map((piece) => piece.render())}
    </svg>
  );
}
