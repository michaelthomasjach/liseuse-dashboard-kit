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
  type Faces,
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
 * seven degrees at a time. A round load is exempt: a drum looks the same at every bearing, so it is
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

/** Nombre de tronçons d'une barrière d'angle. Assez pour que le pan coupé ne se voie pas, assez peu
 *  pour que chaque tronçon reste un volume qu'on trie avec les autres. */
const GUARD_SEGMENTS = 14;

/** Points d'echantillonnage du parcours d'une charge, tous troncons confondus. Un arc en demande
 *  beaucoup ; une ligne droite s'en contenterait de deux. */
const LOAD_SAMPLES = 24;

/** Troncons d'arc sur lesquels une charge anguleuse est redessinee, dans un angle. Tourner un
 *  volume n'est pas une transformation d'ecran : la camera envoie un *plan* affinement, pas
 *  l'espace, et le deplacement d'un point sous une rotation du sol depend de sa hauteur. Une seule
 *  matrice cisaillerait donc le colis d'une vingtaine de pixels dans le virage. Il est redessine a
 *  chaque troncon, au cap qu'il y prend, et chaque exemplaire glisse sur sa part du parcours : la
 *  position ne saute jamais, seul le cap change, de sept degres a la fois. */
const TURN_STEPS = 12;

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

  const leg = Math.max(0.04, Math.min(legSize, Math.min(spanX, spanY) / 2));
  const bedZ = Math.max(0, legHeight);
  const bedTop = bedZ + Math.max(0.02, bedThickness);
  const beltHalf = (spanY * BELT_SHARE) / 2;
  const guard = Math.max(0, guardHeight);
  const guardThick = Math.max(0.03, spanY * 0.045);

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

  /** La bande elle-même : le ruban balayé par le parcours, à plat sur le bâti. */
  const beltFace = (() => {
    if (kind === "corner") {
      const outer: Point[] = [];
      const inner: Point[] = [];
      for (let i = 0; i <= 24; i += 1) {
        const a = -Math.PI / 2 + (Math.PI / 2) * (i / 24);
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
    const arm = beltHalf * 0.5;
    return ring([
      at(tail.x + nx * arm, tail.y + ny * arm, bedTop),
      at(tip.x, tip.y, bedTop),
      at(tail.x - nx * arm, tail.y - ny * arm, bedTop),
    ]);
  })();

  // ---- ce qui se tient sur le bâti : les barrières, et la charge ----
  const pieces: Piece[] = [];
  const footprint = (xs: number[], ys: number[]) => {
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  };

  if (guard > 0) {
    if (kind === "corner") {
      // Chaque barrière est une chaîne de tronçons droits le long de l'arc, et chacun est un volume
      // trié avec le reste : l'extérieure passe devant l'intérieure sur la seconde moitié du virage
      // et derrière sur la première, puisque la caméra regarde depuis le coin même où l'arc est
      // centré. Une barrière d'un bloc ne pourrait pas dire les deux.
      for (const r of [radius - beltHalf - guardThick / 2, radius + beltHalf + guardThick / 2]) {
        for (let i = 0; i < GUARD_SEGMENTS; i += 1) {
          const a0 = -Math.PI / 2 + (Math.PI / 2) * (i / GUARD_SEGMENTS);
          const a1 = -Math.PI / 2 + (Math.PI / 2) * ((i + 1) / GUARD_SEGMENTS);
          const ri = r - guardThick / 2;
          const ro = r + guardThick / 2;
          const corners = [
            [ri, a0],
            [ro, a0],
            [ro, a1],
            [ri, a1],
          ] as const;
          const world = corners.map(([rr, aa]) => ({ x: rr * Math.cos(aa), y: spanY + rr * Math.sin(aa) }));
          // La face qu'on voit est celle dont la normale, une fois tournée, regarde la caméra ; sur
          // un arc elle change de bord en cours de route, donc elle se décide par tronçon.
          const am = (a0 + a1) / 2;
          const n = spin(Math.cos(am), Math.sin(am));
          const o = spin(0, 0);
          const outward = n.x - o.x + (n.y - o.y) > 0;
          const wallR = outward ? ro : ri;
          const faces: Faces = {
            top: [
              arcPoint(ri, a0, bedTop + guard),
              arcPoint(ro, a0, bedTop + guard),
              arcPoint(ro, a1, bedTop + guard),
              arcPoint(ri, a1, bedTop + guard),
            ],
            front: [
              arcPoint(wallR, a0, bedTop),
              arcPoint(wallR, a1, bedTop),
              arcPoint(wallR, a1, bedTop + guard),
              arcPoint(wallR, a0, bedTop + guard),
            ],
            side: [],
          };
          pieces.push({
            ...footprint(
              world.map((p) => p.x),
              world.map((p) => p.y)
            ),
            render: () => (
              <g key={`g${r.toFixed(3)}-${i}`} className="lq-iso__solid lq-iso__solid--post">
                <polygon className="lq-iso__face lq-iso__face--front" points={ring(faces.front)} />
                <polygon className="lq-iso__face lq-iso__face--top" points={ring(faces.top)} />
              </g>
            ),
          });
        }
      }
    } else {
      for (const edge of [spanY / 2 - beltHalf - guardThick, spanY / 2 + beltHalf]) {
        pieces.push({
          x: 0,
          y: edge,
          width: spanX,
          height: guardThick,
          render: () =>
            solidVolume(
              "post",
              `g${edge.toFixed(3)}`,
              boxFaces(at, 0, spanX, edge, edge + guardThick, bedTop, bedTop + guard, facing)
            ),
        });
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
    if (t0 > 0) stops.push(`0%{opacity:0;transform:${shift(t0)}}`, `${pct(t0)}%{opacity:0;transform:${shift(t0)}}`);
    stops.push(`${pct(t0)}%{opacity:${fadeIn ? 0 : 1};transform:${shift(t0)}}`);
    if (fadeIn) stops.push(`${pct(t0 + fadeIn)}%{opacity:1;transform:${shift(t0 + fadeIn)}}`);
    for (let k = 1; k < perTurn; k += 1) {
      const t = t0 + ((t1 - t0) * k) / perTurn;
      if (t <= t0 + fadeIn || t >= t1 - fadeOut) continue;
      stops.push(`${pct(t)}%{opacity:1;transform:${shift(t)}}`);
    }
    if (fadeOut) stops.push(`${pct(t1 - fadeOut)}%{opacity:1;transform:${shift(t1 - fadeOut)}}`);
    stops.push(`${pct(t1)}%{opacity:${fadeOut ? 0 : 1};transform:${shift(t1)}}`);
    if (t1 < 1) stops.push(`${pct(t1)}%{opacity:0;transform:${shift(t1)}}`, `100%{opacity:0;transform:${shift(t1)}}`);
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

  // ---- les pieds ----
  // Un tapis long fait pousser des pieds intermédiaires : un bâti de neuf mètres sur quatre pieds
  // est un plongeoir.
  const rows = kind === "corner" ? 2 : Math.max(2, Math.round(spanX / 2.5) + 1);
  const legs: Piece[] = [];
  for (let r = 0; r < rows; r += 1) {
    const x0 = ((spanX - leg) * r) / (rows - 1);
    for (const y0 of [0, spanY - leg]) {
      legs.push({
        x: x0,
        y: y0,
        width: leg,
        height: leg,
        render: () => solidVolume("post", `l${r}-${y0}`, boxFaces(at, x0, x0 + leg, y0, y0 + leg, 0, bedZ, facing)),
      });
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
      {solidVolume("steel", "bed", boxFaces(at, 0, spanX, 0, spanY, bedZ, bedTop, facing))}
      {/* La bande et sa flèche sont à plat sur le bâti : rien ne peut passer dessous, donc elles
          sont posées avant tout ce qui se dresse dessus plutôt que triées avec. */}
      <polygon className="lq-conveyor__belt" points={ring(beltFace)} />
      <polyline className="lq-conveyor__arrow" points={arrow} />
      {sorted(pieces).map((piece) => piece.render())}
    </svg>
  );
}
