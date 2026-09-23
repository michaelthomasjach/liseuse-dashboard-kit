import type { ReactNode } from "react";
import { IsoCanvas } from "./isoCanvas";
import { convexHull, frameCorners, prismVolume, roundedRing, type Point, type Project } from "./rackItems";
import { useIsoCamera } from "./isoCamera";
import "./Parking.css";

/**
 * Le parking : des **places tracées** et les voitures garées dessus.
 *
 * ## Pourquoi les places comptent autant que les voitures
 *
 * Un parking vide reste un parking : ce sont les traces au sol qui le disent, pas ce qui est
 * dessus. Elles donnent aussi l'échelle de tout le reste — une place fait la même chose partout, et
 * un entrepôt se mesure en places de parking aussi sûrement qu'en palettes. Le composant dessine
 * donc d'abord le marquage, et les voitures ensuite, par-dessus.
 *
 * ## Les voitures
 *
 * Trois volumes aux angles abattus — bas de caisse, caisse, pavillon — et quatre roues qu'on ne
 * dessine pas : à cette échelle, une voiture fait quarante pixels de long, et ses roues y seraient
 * quatre taches de trois pixels que l'œil lirait comme du bruit. Ce qui la fait lire comme une
 * voiture, c'est sa **silhouette en trois marches** et le retrait du bas de caisse, qui la met sur
 * ses roues sans en dessiner.
 *
 * Elles ne sont pas toutes pareilles : `seed` tire leur longueur, leur teinte et les places
 * occupées. Un rang de voitures identiques se lit comme un motif, pas comme un parking — et comme
 * un tirage, il doit être **stable** : deux rendus du même parking donnent la même image, sans quoi
 * aucune comparaison n'est possible.
 */

export interface ParkingProps {
  /** Nombre de places dans le rang. */
  bays?: number;
  /** Nombre de rangs, adossés deux à deux. */
  rows?: number;
  /** Largeur d'une place, en cases. */
  bayWidth?: number;
  /** Profondeur d'une place, en cases. */
  bayDepth?: number;
  /** Part des places occupées, de 0 à 1. */
  fill?: number;
  /** La graine du tirage : mêmes voitures aux mêmes places, à chaque rendu. */
  seed?: number;
  /** Rotation sur le sol, en degrés. À 0, les rangs courent le long des `x`. */
  rotation?: number;
  /** Poser les ombres des voitures au sol. */
  shadows?: boolean;
  /** Où poser le coin du parking, en cases. */
  origin?: { x: number; y: number };
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine : tout, les ombres seules, ou le parking seul. */
  parts?: "all" | "shadow" | "machine";
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

const PAD = 2;
/** L'allée entre deux rangs adossés : de quoi manœuvrer, sans quoi le parking se lit comme un mur
 *  de voitures. */
const AISLE = 2.2;

const ring = (points: Point[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

/** Un tirage stable : la même graine donne le même parking, aujourd'hui et demain. */
function rng(seed: number) {
  let s = (seed * 2654435761) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function Parking({
  bays = 6,
  rows = 2,
  bayWidth = 1.1,
  bayDepth = 2.2,
  fill = 0.7,
  seed = 3,
  rotation = 0,
  shadows = false,
  origin = { x: 0, y: 0 },
  frame,
  parts = "all",
  cellSize = 30,
  className,
}: ParkingProps) {
  const cam = useIsoCamera();
  const n = Math.max(1, Math.round(bays));
  const rowCount = Math.max(1, Math.round(rows));
  const LENGTH = n * bayWidth;
  const DEPTH = rowCount > 1 ? bayDepth * 2 + AISLE : bayDepth;

  const theta = (rotation * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const spin = (x: number, y: number) => {
    if (!rotation) return { x, y };
    const dx = x - LENGTH / 2;
    const dy = y - DEPTH / 2;
    return { x: LENGTH / 2 + dx * cosT - dy * sinT, y: DEPTH / 2 + dx * sinT + dy * cosT };
  };
  const world: Project = (x, y, z) => cam.project(x * cellSize, y * cellSize, z * cellSize);
  const onGround = (x: number, y: number) => {
    const p = spin(x, y);
    return { x: p.x + origin.x, y: p.y + origin.y };
  };
  const at: Project = (x, y, z) => {
    const p = onGround(x, y);
    return world(p.x, p.y, z);
  };
  const facing = cam.facing(rotation);
  const localView = { x: cam.view.x * cosT + cam.view.y * sinT, y: -cam.view.x * sinT + cam.view.y * cosT };
  const prism = (material: string, key: string, ground: Point[], z0: number, z1: number) =>
    prismVolume(material, key, at, ground, z0, z1, facing, localView);

  // ---- le marquage ----
  const marks: ReactNode[] = [];
  const rowY = (r: number) => (r === 0 ? 0 : DEPTH - bayDepth);
  for (let r = 0; r < rowCount; r += 1) {
    const y0 = rowY(r);
    const y1 = y0 + bayDepth;
    for (let i = 0; i <= n; i += 1) {
      const x = i * bayWidth;
      const a = at(x, y0, 0);
      const b = at(x, y1, 0);
      marks.push(<line key={`m${r}${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />);
    }
    // La ligne de fond ferme les places : sans elle, un rang est une suite de traits parallèles.
    const back = r === 0 ? y0 : y1;
    const c = at(0, back, 0);
    const d = at(LENGTH, back, 0);
    marks.push(<line key={`b${r}`} x1={c.x} y1={c.y} x2={d.x} y2={d.y} />);
  }

  // ---- les voitures ----
  const next = rng(seed);
  interface Car {
    x: number;
    y: number;
    len: number;
    wide: number;
    tone: string;
    nose: number;
  }
  const cars: Car[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const y0 = rowY(r);
    for (let i = 0; i < n; i += 1) {
      const take = next();
      const len = bayDepth * (0.74 + next() * 0.12);
      const wide = bayWidth * (0.66 + next() * 0.1);
      const tone = next() < 0.35 ? "car-dark" : "car";
      if (take > fill) continue;
      cars.push({
        x: i * bayWidth + (bayWidth - wide) / 2,
        y: r === 0 ? y0 + (bayDepth - len) * 0.75 : y0 + (bayDepth - len) * 0.25,
        len,
        wide,
        tone,
        // Le capot est du côté de l'allée : une voiture se gare en marche arrière ou de face, mais
        // jamais en travers, et c'est ce qui donne au rang son sens.
        nose: r === 0 ? 1 : -1,
      });
    }
  }

  /** Un pan de vitrage : du haut de l'habitacle, en `yTop`, au capot, en `yFoot`. */
  const glassPane = (c: Car, yTop: number, yFoot: number, key: string) => (
    <polygon
      key={key}
      className="lq-parking__glass"
      points={ring([
        at(c.x + 0.07, yTop, 0.5),
        at(c.x + c.wide - 0.07, yTop, 0.5),
        at(c.x + c.wide - 0.07, yFoot, 0.34),
        at(c.x + 0.07, yFoot, 0.34),
      ])}
    />
  );

  const carBody = (c: Car) => {
    const y0 = c.y;
    const y1 = c.y + c.len;
    const capotTo = c.nose > 0 ? y1 - c.len * 0.08 : y0 + c.len * 0.08;
    const capotBack = c.nose > 0 ? y0 + c.len * 0.08 : y1 - c.len * 0.08;
    const cabinFrom = c.nose > 0 ? y0 + c.len * 0.3 : y0 + c.len * 0.34;
    const cabinTo = c.nose > 0 ? y0 + c.len * 0.66 : y1 - c.len * 0.3;
    const rect = (a: number, b: number, inset: number, rad: number) =>
      roundedRing(c.x + inset, c.x + c.wide - inset, a + inset, b - inset, rad, 3);
    return (
      <g key={`car${c.x.toFixed(2)}${c.y.toFixed(2)}`}>
        {prism(c.tone, "under", rect(y0, y1, 0.05, 0.1), 0.02, 0.09)}
        {prism(c.tone, "body", rect(y0, y1, 0, 0.14), 0.09, 0.32)}
        {/* L'habitacle, rentré et plus haut que la ceinture de caisse : c'est la marche qui fait
            lire une voiture plutôt qu'un galet. */}
        {prism(c.tone, "cabin", rect(cabinFrom, cabinTo, 0.06, 0.12), 0.32, 0.5)}
        {/* Le pare-brise et la lunette : deux pans **inclinés**, les seules surfaces obliques de
            tout le kit. Un vitrage vertical se perd sous le pavillon dans une vue de dessus, et
            c'est pourtant lui qui dit de quel côté la voiture regarde. */}
        {glassPane(c, cabinFrom, capotTo, "ws")}
        {glassPane(c, cabinTo, capotBack, "rw")}
      </g>
    );
  };

  const shade = shadows ? (
    <g>
      {cars.map((c) => {
        const foot = [onGround(c.x, c.y), onGround(c.x + c.wide, c.y), onGround(c.x + c.wide, c.y + c.len), onGround(c.x, c.y + c.len)];
        const cast = foot.map((p) => ({ x: p.x + cam.sun.x * 0.5, y: p.y + cam.sun.y * 0.5 }));
        return (
          <polygon
            key={`s${c.x.toFixed(2)}${c.y.toFixed(2)}`}
            className="lq-iso__shadow"
            points={ring(convexHull([...foot, ...cast].map((p) => world(p.x, p.y, 0))))}
          />
        );
      })}
    </g>
  ) : null;

  const corners: Point[] = frame
    ? frameCorners(frame, world, cam.sun)
    : [0, 0.6].flatMap((z) =>
        [
          [0, 0],
          [LENGTH, 0],
          [LENGTH, DEPTH],
          [0, DEPTH],
        ].map(([x, y]) => at(x, y, z))
      );
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  return (
    <IsoCanvas
      className={["lq-parking", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={[minX, minY, boxWidth, boxHeight]}
      ariaLabel={`Parking de ${n * rowCount} places`}
    >
      {(parts === "all" || parts === "shadow") && shade}
      {(parts === "all" || parts === "machine") && (
        <>
          <g className="lq-parking__marks">{marks}</g>
          {/* Du fond vers l'avant : les voitures sont disjointes, c'est la caméra qui les range. */}
          {cam.order(cars.map((c) => ({ ...c, width: c.wide, height: c.len }))).map((c) => carBody(c))}
        </>
      )}
    </IsoCanvas>
  );
}
