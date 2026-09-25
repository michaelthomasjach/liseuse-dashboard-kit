import { useEffect, useMemo, useRef, useState } from "react";
import { Matrix4, type Group } from "three";
import { Builder } from "./three/builder";
import { Parts, Solo, frameBounds, placed, useBuilt } from "./three/scene";
import { useSimFrame } from "./three/time";
import { addCar, type CarKind, type CarTone } from "./Car";
import { PANEL_L, PANEL_W, addSolarPanel } from "./SolarPanel";
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
  /**
   * Ce qui couvre les places : rien (`"none"`), une **ombrière** — des poteaux au fond des places et
   * un toit à peine incliné vers l'allée (`"roof"`) —, ou une ombrière couverte de **panneaux
   * solaires** (`"solar"`). Les trois étapes d'un parking de site qui s'équipe.
   */
  canopy?: "none" | "roof" | "solar";
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

/** L'allée entre deux rangs adossés : de quoi manœuvrer, sans quoi le parking se lit comme un mur
 *  de voitures. */
const AISLE = 2.2;


/** Un tirage stable : la même graine donne le même parking, aujourd'hui et demain. */
function rng(seed: number) {
  let s = (seed * 2654435761) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function Parking(props: ParkingProps) {
  const { bays = 6, rows = 2, bayWidth = 1.1, bayDepth = 2.2, rotation = 0, origin = { x: 0, y: 0 }, frame, parts = "all", cellSize = 30, className } = props;
  if (parts === "shadow") return null;
  const n = Math.max(1, Math.round(bays));
  const rowCount = Math.max(1, Math.round(rows));
  const LENGTH = n * bayWidth;
  const DEPTH = rowCount > 1 ? bayDepth * 2 + AISLE : bayDepth;
  const { bounds } = placed(origin, rotation, { x0: 0, x1: LENGTH, y0: 0, y1: DEPTH, z0: 0, z1: props.canopy && props.canopy !== "none" ? 1.5 : 0.8 });
  return (
    <Solo bounds={frame ? frameBounds(frame) : bounds} cellSize={cellSize} className={["lq-parking", className].filter(Boolean).join(" ")} ariaLabel={`Parking de ${n * rowCount} places`}>
      <ParkingBody {...props} />
    </Solo>
  );
}

/** Une place du parking, tirée une fois pour toutes par la graine : où elle est, la voiture qui s'y
 *  gare quand elle est prise, et son seuil — elle est occupée dès que `fill` l'atteint. Monter `fill`
 *  n'ajoute donc que des voitures : celles qui sont là restent. */
interface Space {
  i: number;
  take: number;
  kind: CarKind;
  tone: CarTone;
  len: number;
  wide: number;
  /** Le centre de la voiture garée, et le sens de son nez (+1 : vers les `y` croissants). */
  cx: number;
  cy: number;
  nose: 1 | -1;
}

/** Une voiture qui manœuvre : elle entre ou sort ; `t0` est l'instant où elle part, posé à la
 *  première image (`delay` après), pour que plusieurs arrivées ne se suivent pas pare-chocs contre
 *  pare-chocs. */
interface Maneuver {
  i: number;
  dir: "in" | "out";
  delay: number;
  t0: number | null;
}

/** Le temps de sortir de la place (ou d'y reculer), puis la vitesse le long de l'allée. */
const PARK_SECS = 1.1;
const AISLE_SPEED = 3;

function ParkingBody({ bays = 6, rows = 2, bayWidth = 1.1, bayDepth = 2.2, fill = 0.7, seed = 3, canopy = "none", rotation = 0, origin = { x: 0, y: 0 } }: ParkingProps) {
  const n = Math.max(1, Math.round(bays));
  const rowCount = Math.max(1, Math.round(rows));
  const LENGTH = n * bayWidth;
  const DEPTH = rowCount > 1 ? bayDepth * 2 + AISLE : bayDepth;
  const { pose } = placed(origin, rotation, { x0: 0, x1: LENGTH, y0: 0, y1: DEPTH, z0: 0, z1: 1 });
  const rowY = (r: number) => (r === 0 ? 0 : DEPTH - bayDepth);

  // Les places et leurs voitures : le même tirage qu'avant, dans le même ordre.
  const spaces = useMemo<Space[]>(() => {
    const next = rng(seed);
    const kinds: CarKind[] = ["sedan", "sedan", "hatch", "van"];
    const tones: CarTone[] = ["light", "light", "dark", "cool", "warm", "light"];
    const out: Space[] = [];
    for (let r = 0; r < rowCount; r += 1) {
      const y0 = r === 0 ? 0 : DEPTH - bayDepth;
      for (let i = 0; i < n; i += 1) {
        const take = next();
        const kind = kinds[Math.floor(next() * kinds.length)];
        const tone = tones[Math.floor(next() * tones.length)];
        const len = Math.min(bayDepth * 0.9, kind === "van" ? 2.1 : kind === "hatch" ? 1.6 : 1.8);
        const wide = Math.min(bayWidth * 0.8, kind === "van" ? 0.86 : 0.78);
        // Rangée du bas nez vers l'allée (vers les y croissants), rangée du haut l'inverse.
        const nose = r === 0 ? 1 : -1;
        const y = r === 0 ? y0 + (bayDepth - len) * 0.75 : y0 + (bayDepth - len) * 0.25;
        out.push({ i: out.length, take, kind, tone, len, wide, cx: i * bayWidth + bayWidth / 2, cy: y + len / 2, nose });
      }
    }
    return out;
  }, [seed, n, rowCount, bayWidth, bayDepth, DEPTH]);

  const wanted = useMemo(() => new Set(spaces.filter((sp) => sp.take <= fill).map((sp) => sp.i)), [spaces, fill]);
  // Les voitures garées, dessinées d'un bloc avec le parking ; celles qui manœuvrent, à part, le
  // temps d'entrer ou de sortir. Au montage, tout est déjà garé : un parking rechargé est plein.
  const [parked, setParked] = useState<Set<number>>(() => new Set(wanted));
  const [moving, setMoving] = useState<Maneuver[]>([]);
  const parkedRef = useRef(parked);
  parkedRef.current = parked;
  useEffect(() => {
    const prev = parkedRef.current;
    const leaving = [...prev].filter((i) => !wanted.has(i));
    setParked(new Set([...prev].filter((i) => wanted.has(i))));
    setMoving((m) => {
      const busy = new Set(m.map((x) => x.i));
      // Une voiture qui arrivait et qu'on ne veut plus repart ; une qui partait et qu'on veut de
      // nouveau revient.
      const kept = m.map((x) =>
        x.dir === "in" && !wanted.has(x.i) ? { ...x, dir: "out" as const, delay: 0, t0: null } : x.dir === "out" && wanted.has(x.i) ? { ...x, dir: "in" as const, delay: 0, t0: null } : x
      );
      const arrive = [...wanted].filter((i) => !prev.has(i) && !busy.has(i));
      return [...kept, ...leaving.filter((i) => !busy.has(i)).map((i, k) => ({ i, dir: "out" as const, delay: k * 0.7, t0: null })), ...arrive.map((i, k) => ({ i, dir: "in" as const, delay: k * 0.7, t0: null }))];
    });
  }, [wanted]);

  const movers = useRef(new Map<number, Group | null>());
  useSimFrame(
    (t) => {
      const finished: Maneuver[] = [];
      for (const m of moving) {
        if (m.t0 === null) m.t0 = t + m.delay;
        const sp = spaces[m.i];
        const g = movers.current.get(m.i);
        const elapsed = t - m.t0;
        const pos = carPath(sp, Math.max(0, elapsed), m.dir, bayDepth, LENGTH);
        if (g) {
          // Une voiture qui arrive n'est là qu'à son départ ; une qui s'en va est là tout de suite.
          g.visible = m.dir === "out" || elapsed >= 0;
          g.position.set(pos.x, pos.y, 0);
          g.rotation.set(0, 0, pos.heading);
        }
        if (elapsed >= 0 && pos.done) finished.push(m);
      }
      if (finished.length) {
        setMoving((all) => all.filter((x) => !finished.includes(x)));
        const arrived = finished.filter((f) => f.dir === "in").map((f) => f.i);
        if (arrived.length) setParked((prev) => new Set([...prev, ...arrived]));
      }
    },
    moving.length > 0
  );

  const parkedKey = [...parked].sort((a, b) => a - b).join(",");
  const built = useBuilt(() => {
    const b = new Builder();
    const w = 0.035;
    // L'enrobé : sans lui, le marquage blanc se perd sur la page et les voitures flottent.
    b.box("asphalt", -0.15, LENGTH + 0.15, -0.15, DEPTH + 0.15, -0.04, 0, false);
    // Le marquage : un trait entre chaque place et une ligne de fond, en peinture sur l'enrobé.
    for (let r = 0; r < rowCount; r += 1) {
      const y0 = rowY(r);
      const y1 = y0 + bayDepth;
      for (let i = 0; i <= n; i += 1) b.faceZ("lq-road__mark", 0.004, i * bayWidth - w, i * bayWidth + w, y0, y1);
      const back = r === 0 ? y0 : y1;
      b.faceZ("lq-road__mark", 0.004, 0, LENGTH, back - w, back + w);
    }
    // Les voitures garées : nez vers l'allée, de gabarits et de teintes variés, comme un vrai parc.
    for (const sp of spaces) {
      if (!parked.has(sp.i)) continue;
      b.within(carPose(sp.cx, sp.cy, sp.nose > 0 ? Math.PI / 2 : -Math.PI / 2, sp), () => addCar(b, sp.kind, sp.tone, { wheels: true, length: sp.len, width: sp.wide }));
    }
    // L'ombrière : dans le repère d'un rang, le fond des places en `y = 0`, l'allée vers les `y`
    // croissants ; le second rang est le même, retourné.
    if (canopy !== "none")
      for (let r = 0; r < rowCount; r += 1) {
        const m = r === 0 ? new Matrix4() : new Matrix4().makeTranslation(LENGTH, DEPTH, 0).multiply(new Matrix4().makeRotationZ(Math.PI));
        b.within(m, () => {
          const reach = bayDepth * 0.92;
          const high = 1.36;
          const low = 1.24;
          // Les poteaux au fond, un toutes les deux places, et leur porte-à-faux vers l'allée.
          for (let i = 0; i <= n; i += 2) {
            const x = Math.min(LENGTH - 0.05, Math.max(0.05, i * bayWidth));
            b.box("steel", x - 0.05, x + 0.05, 0.05, 0.15, 0, high - 0.06);
            b.beam("steel", [x, 0.1, high - 0.06], [x, reach, low - 0.06], 0.035, false);
          }
          // Le toit : une tôle mince, à peine inclinée vers l'allée.
          b.hexa("roof", [
            [-0.1, 0, high - 0.05],
            [LENGTH + 0.1, 0, high - 0.05],
            [LENGTH + 0.1, reach, low - 0.05],
            [-0.1, reach, low - 0.05],
            [-0.1, 0, high],
            [LENGTH + 0.1, 0, high],
            [LENGTH + 0.1, reach, low],
            [-0.1, reach, low],
          ]);
          if (canopy === "solar") {
            // Les modules couchés sur le toit, dans sa pente, en rangées serrées.
            const slope = Math.atan2(low - high, reach);
            const pose = new Matrix4().makeTranslation(0, 0, high + 0.002).multiply(new Matrix4().makeRotationX(slope));
            const along = Math.hypot(reach, high - low);
            b.within(pose, () => {
              const cols = Math.floor((LENGTH + 0.1) / (PANEL_W + 0.02));
              const lines = Math.floor(along / (PANEL_L + 0.02));
              const x0 = (LENGTH - cols * (PANEL_W + 0.02)) / 2;
              const y0 = (along - lines * (PANEL_L + 0.02)) / 2;
              for (let c = 0; c < cols; c += 1) for (let k = 0; k < lines; k += 1) addSolarPanel(b, x0 + c * (PANEL_W + 0.02), y0 + k * (PANEL_L + 0.02));
            });
          }
        });
      }
    return b.build();
  }, [n, rowCount, bayWidth, bayDepth, parkedKey, spaces, LENGTH, DEPTH, canopy]);
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
      {moving.map((m) => (
        <group key={`${m.i}-${m.dir}`} ref={(g) => void movers.current.set(m.i, g)} visible={false}>
          <MovingCar space={spaces[m.i]} />
        </group>
      ))}
    </group>
  );
}

/** Le repère d'une voiture dont le centre est en (x, y), le nez dans la direction `heading`. */
function carPose(x: number, y: number, heading: number, sp: { len: number; wide: number }) {
  return new Matrix4().makeTranslation(x, y, 0).multiply(new Matrix4().makeRotationZ(heading)).multiply(new Matrix4().makeTranslation(-sp.len / 2, -sp.wide / 2, 0));
}

/** Une voiture qui manœuvre, dessinée seule, autour de son centre : le parent la déplace. */
function MovingCar({ space }: { space: Space }) {
  const built = useBuilt(() => {
    const b = new Builder();
    b.within(new Matrix4().makeTranslation(-space.len / 2, -space.wide / 2, 0), () => addCar(b, space.kind, space.tone, { wheels: true, length: space.len, width: space.wide }));
    return b.build();
  }, [space.kind, space.tone, space.len, space.wide]);
  return <Parts built={built} />;
}

/**
 * Où en est une voiture qui entre ou sort, `t` secondes après le début de sa manœuvre. Elle sort
 * **en marche avant** — son nez est déjà vers l'allée —, tourne, longe l'allée jusqu'au bout du
 * parking le plus proche et s'en va ; elle entre par le même chemin à rebours, et finit en
 * reculant dans sa place.
 */
function carPath(sp: Space, t: number, dir: "in" | "out", bayDepth: number, length: number): { x: number; y: number; heading: number; done: boolean } {
  const noseHeading = sp.nose > 0 ? Math.PI / 2 : -Math.PI / 2;
  const ay = sp.cy + sp.nose * (bayDepth * 0.5 + 0.9);
  const endX = sp.cx < length / 2 ? -1.6 : length + 1.6;
  const alongHeading = endX < sp.cx ? Math.PI : 0;
  const leg2 = Math.max(0.2, Math.abs(endX - sp.cx) / AISLE_SPEED);
  const total = PARK_SECS + leg2;
  const ease = (u: number) => u * u * (3 - 2 * u);
  // Le temps de la sortie ; l'entrée est la même manœuvre jouée à l'envers.
  const k = dir === "out" ? t : total - t;
  const done = t >= total;
  if (k <= PARK_SECS) {
    const u = ease(Math.max(0, Math.min(1, k / PARK_SECS)));
    // Vers la fin de la sortie, le nez tourne déjà vers le bout de l'allée.
    const turn = Math.max(0, (u - 0.6) / 0.4);
    return { x: sp.cx, y: sp.cy + (ay - sp.cy) * u, heading: noseHeading + shortAngle(alongHeading - noseHeading) * turn, done };
  }
  const u = Math.max(0, Math.min(1, (k - PARK_SECS) / leg2));
  return { x: sp.cx + (endX - sp.cx) * u, y: ay, heading: alongHeading, done };
}

function shortAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
