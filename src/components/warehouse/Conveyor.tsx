import type { CSSProperties, ReactNode } from "react";
import { projectIso } from "./warehouseIso";
import { paintOrder } from "./warehousePaint";
import { ISO_POST_SIZE, boxFaces, isoFacing, solidVolume, type Point, type Project } from "./rackItems";
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
 * ## Showing that it moves
 *
 * The chevrons **do not slide**: their brightness travels along the run instead, one wave passing
 * down the line. A slide would have to leave the arc at a corner and would have nowhere to go —
 * the same reason the floor plan's own conveyors are animated this way, and the two now agree.
 *
 * Direction is carried twice over. The chevrons *point* the way the belt runs, which is what
 * survives `prefers-reduced-motion` and a still screenshot; the wave then says it is running now.
 * Motion is never the only thing saying something here, because motion is the one thing a reader
 * can be unable to see.
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
  /** Le tapis va en arrière. */
  reversed?: boolean;
  /** Le tapis tourne. À faux, les chevrons restent en place et disent encore le sens. */
  running?: boolean;
  /** Durée d'un passage de l'onde sur toute la longueur, en secondes. */
  cycle?: number;
  /** Rotation du tapis sur le sol, en degrés. */
  rotation?: number;
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

const PAD = 2;

/** Part de la largeur occupée par la bande, le reste étant le bâti de chaque côté — ce sont ces
 *  deux bandes d'acier qui tiennent lieu de joues et empêchent la charge de sortir. */
const BELT_SHARE = 0.72;

/** Intervalle visé entre deux chevrons, en cases. Fixe : des chevrons plus serrés sur un tapis
 *  court se liraient comme un tapis plus rapide, or c'est le même tapis. */
const CHEVRON_STEP = 0.6;

/** En deçà, l'onde n'a plus assez de marches pour descendre et le tapis clignote au lieu d'avancer.
 *  Un angle est court — un quart de cercle d'une case et demie — et tomberait sous ce seuil. */
const CHEVRON_MIN = 4;

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
  reversed = false,
  running = true,
  cycle = 1.8,
  rotation = 0,
  cellSize = 34,
  className,
}: ConveyorProps) {
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

  /** La bande elle-même : le ruban balayé par le parcours, à plat sur le bâti. */
  const beltFace = () => {
    if (kind === "corner") {
      const radius = spanY / 2;
      const outer: Point[] = [];
      const inner: Point[] = [];
      for (let i = 0; i <= 24; i += 1) {
        const a = -Math.PI / 2 + (Math.PI / 2) * (i / 24);
        outer.push(at((radius + beltHalf) * Math.cos(a), spanY + (radius + beltHalf) * Math.sin(a), bedTop));
        inner.push(at((radius - beltHalf) * Math.cos(a), spanY + (radius - beltHalf) * Math.sin(a), bedTop));
      }
      return [...outer, ...inner.reverse()];
    }
    return [
      at(0, spanY / 2 - beltHalf, bedTop),
      at(spanX, spanY / 2 - beltHalf, bedTop),
      at(spanX, spanY / 2 + beltHalf, bedTop),
      at(0, spanY / 2 + beltHalf, bedTop),
    ];
  };

  // Un chevron est fait de trois points *du parcours* : la pointe un peu devant, les deux branches
  // un peu derrière, écartées en travers. Reculer d'une distance constante dans le plan, comme
  // c'était fait, marche sur une ligne droite et pas dans un angle : sur le rayon intérieur d'un
  // quart de cercle d'une case, 0,24 case de recul vaut 31° d'arc, et la branche sortait de la
  // bande par le bout. En reculant le long du parcours, le chevron suit la courbe et y reste.
  const reach = 0.24;
  const arm = beltHalf * 0.78;
  const dt = Math.min(0.35, reach / run);
  const span = Math.max(0.05, 1 - 2 * dt);
  const total = Math.max(CHEVRON_MIN, Math.round(run / CHEVRON_STEP));
  const chevrons = Array.from({ length: total }, (_, i) => {
    // Au milieu de leur part du parcours, et non à ses bornes : il y en a ainsi le compte demandé
    // et aucun ne déborde du bout de la bande.
    const t = dt + (span * (i + 0.5)) / total;
    const ahead = reversed ? -1 : 1;
    const tipStep = stepAt(t + dt * ahead);
    const tail = stepAt(t - dt * ahead);
    // La perpendiculaire au parcours, dans le plan du sol : les branches s'ouvrent en travers.
    const nx = -tail.hy;
    const ny = tail.hx;
    const tip = at(tipStep.x, tipStep.y, bedTop);
    const left = at(tail.x + nx * arm, tail.y + ny * arm, bedTop);
    const right = at(tail.x - nx * arm, tail.y - ny * arm, bedTop);
    // L'onde descend le parcours : chaque chevron reprend la même animation, décalée de sa place
    // dans la file. Le décalage est négatif, donc l'onde est déjà en route au premier rendu.
    const at01 = i / total;
    const phase = reversed ? 1 - at01 : at01;
    return (
      <polyline
        key={`c${i}`}
        className="lq-conveyor__chevron"
        points={ring([left, tip, right])}
        style={{ animationDelay: `${-(phase * cycle).toFixed(3)}s` }}
      />
    );
  });

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
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y, render: piece.render };
      })
    );

  const corners = [
    at(0, 0, 0),
    at(spanX, 0, 0),
    at(spanX, spanY, 0),
    at(0, spanY, 0),
    at(0, 0, bedTop),
    at(spanX, 0, bedTop),
    at(spanX, spanY, bedTop),
    at(0, spanY, bedTop),
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
      style={{ "--lq-conveyor-cycle": `${cycle}s` } as CSSProperties}
      role="img"
      aria-label={`Tapis roulant ${kind === "corner" ? "d'angle" : "droit"}${running ? ", en marche" : ", arrêté"}`}
    >
      {sorted(legs).map((piece) => piece.render())}
      {solidVolume("steel", "bed", boxFaces(at, 0, spanX, 0, spanY, bedZ, bedTop, facing))}
      <polygon className="lq-conveyor__belt" points={ring(beltFace())} />
      {chevrons}
    </svg>
  );
}
