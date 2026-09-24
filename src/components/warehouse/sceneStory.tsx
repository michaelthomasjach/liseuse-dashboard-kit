import { Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { WarehouseScene, frameBounds } from "./three/scene";
import { useIsoCamera } from "./isoCamera";
import { frameCorners } from "./rackItems";

/**
 * Ce dont les stories ont besoin pour composer une scène de plusieurs modules — et que la caméra
 * tournante oblige à calculer au lieu de l'écrire.
 *
 * Les modules d'une scène partagent un **cadre** (`frame`), donc la même `viewBox` : on les empile en
 * position absolue et ils se raccordent sans rien aligner. Deux choses restent à la charge de la
 * scène, et toutes deux dépendent de la caméra : la **place** que le cadre prend à l'écran, que le
 * conteneur doit réserver, et l'**ordre** dans lequel peindre les modules. Écrit une fois pour toutes
 * du fond vers l'avant, cet ordre est juste pour la caméra par défaut et faux dès qu'elle tourne —
 * au demi-tour, le fond est devant. Ici chaque groupe déclare son emprise au sol, et c'est la caméra
 * qui les range.
 *
 * Pas exporté par le paquet : c'est l'outillage des exemples, pas un composant.
 */

export type Frame = { x: number; y: number; width: number; depth: number; height: number };

/**
 * La place que le cadre prend à l'écran, sous la caméra courante — **la même règle que la `viewBox`
 * des modules** (`frameCorners`), ombre portée comprise. Deux règles différentes et le conteneur
 * cadrerait autre chose que ce que les modules dessinent : le dessin se décalerait dedans.
 */
export function useFrameBox(frame: Frame, cellSize: number) {
  const cam = useIsoCamera();
  const shot = frameCorners(frame, (x, y, z) => cam.project(x * cellSize, y * cellSize, z * cellSize), cam.sun);
  return {
    width: Math.max(...shot.map((p) => p.x)) - Math.min(...shot.map((p) => p.x)) + 4,
    height: Math.max(...shot.map((p) => p.y)) - Math.min(...shot.map((p) => p.y)) + 4,
  };
}

/**
 * L'emprise au sol d'un module de `spanX × spanY` cases posé à `origin` et tourné de `rotation`
 * autour de son centre — la règle de tous les modules du kit. Les caps sont des quarts de tour.
 */
export function footprint(origin: { x: number; y: number }, spanX: number, spanY: number, rotation = 0) {
  const flat = Math.round(rotation / 90) % 2 === 0;
  const width = flat ? spanX : spanY;
  const height = flat ? spanY : spanX;
  const cx = origin.x + spanX / 2;
  const cy = origin.y + spanY / 2;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}

/** Un groupe de la scène : son emprise au sol, en cases, son ombre et son dessin. */
export interface SceneUnit {
  key: string;
  x: number;
  y: number;
  width: number;
  /** Profondeur de l'emprise, le long de `y`. */
  height: number;
  shadow?: ReactNode;
  machine: ReactNode;
  /** Ce qui voyage sur le module — des colis qui passent d'un tapis au suivant. Peint après toutes
   *  les machines : un colis qui arrive à la jonction serait sinon recouvert par le module suivant,
   *  plus proche. */
  load?: ReactNode;
}

export const layer = { position: "absolute", left: 0, top: 0 } as const;

/**
 * Déballer les calques d'une scène écrite pour le dessin.
 *
 *  Les scènes isométriques empilaient chaque module dans un `<div>` en position absolue — une toile
 *  par module, superposées. Une scène 3D n'a qu'une toile, et un `<div>` n'y a pas sa place : on ne
 *  garde que ce qu'il contient. C'est ce qui laisse les stories écrites en calques marcher sans
 *  être réécrites, en attendant qu'elles le soient.
 */
export function unwrapLayers(node: ReactNode): ReactNode {
  if (node === null || node === undefined || typeof node === "boolean") return null;
  if (Array.isArray(node)) return node.map((n, i) => <Fragment key={i}>{unwrapLayers(n)}</Fragment>);
  if (!isValidElement(node)) return null;
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (el.type === "div" || el.type === Fragment) return unwrapLayers(el.props.children);
  return el;
}

/**
 * Une scène : **une seule** scène 3D pour tous ses modules.
 *
 *  Plus d'ombres d'abord, plus de groupes rangés du plus lointain au plus proche : la profondeur
 *  s'en charge, et les ombres viennent de la lumière. Les `shadow` des unités ne servent donc plus
 *  — leur module en `parts="shadow"` ne dessine rien — et seules les machines et leurs charges
 *  sont posées dans la scène.
 */
export function Scene({
  frame,
  cellSize,
  units,
  padding = 24,
  under,
  speed,
  paused,
}: {
  frame: Frame;
  cellSize: number;
  units: SceneUnit[];
  padding?: number;
  /** Ce qui est sous la scène — une dalle. */
  under?: ReactNode;
  speed?: number;
  paused?: boolean;
}) {
  return (
    <div style={{ padding }}>
      <WarehouseScene bounds={frameBounds(frame)} cellSize={cellSize} speed={speed} paused={paused}>
        {unwrapLayers(under)}
        {units.map((u) => (
          <Fragment key={u.key}>
            {unwrapLayers(u.machine)}
            {unwrapLayers(u.load)}
          </Fragment>
        ))}
      </WarehouseScene>
    </div>
  );
}

/** Une scène libre, cadrée sur `frame` : ce qu'on y pose est déballé de ses calques. */
export function SceneBox({ frame, cellSize, children, speed, paused }: { frame: Frame; cellSize: number; children: ReactNode; speed?: number; paused?: boolean }) {
  return (
    <WarehouseScene bounds={frameBounds(frame)} cellSize={cellSize} speed={speed} paused={paused}>
      {unwrapLayers(children)}
    </WarehouseScene>
  );
}
