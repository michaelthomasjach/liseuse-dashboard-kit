import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { Group } from "three";
import { Builder, type Built, type P3 } from "./three/builder";
import { Parts, Solo, type Bounds } from "./three/scene";
import { useSimClock, useSimFrame } from "./three/time";
import { GOOD_SIZE, addGood } from "./three/goods";
import { makeRoute, sampleRoute } from "./three/transport";
import type { RackItemKind } from "./rackItems";

/**
 * Un flux de marchandises le long d'un itinéraire.
 *
 * C'est **la** façon de faire circuler des colis dans une scène : on lui donne les pistes des
 * modules traversés, dans l'ordre, et il les parcourt comme une seule courbe. Un colis qui passe
 * d'un tapis à une chute, puis à un bac, ne change donc jamais de propriétaire, de gabarit ni de
 * teinte — il ne peut pas disparaître à une jonction, puisque pour lui il n'y en a pas.
 *
 * Chaque colis a une **identité** : un numéro qui le suit du début à la fin. Sa sorte en dépend
 * (`kind` peut être une liste, parcourue en boucle), si bien qu'un bidon reste un bidon d'un bout à
 * l'autre ; et c'est ce numéro que `onArrive` rend quand il atteint le bout — de quoi compter, pour
 * un jeu, ce qui est arrivé où.
 *
 * Les colis suivent la pente et les virages : ils s'orientent sur le sens du mouvement, montent une
 * rampe inclinés comme elle, et basculent dans une chute.
 */

export interface CargoProps {
  /** Les pistes traversées, dans l'ordre — une seule piste, ou une liste de pistes à mettre bout à
   *  bout. En coordonnées monde, en cases. */
  route: P3[] | P3[][];
  /** L'itinéraire se referme sur lui-même : une boucle, parcourue sans fin. */
  closed?: boolean;
  /** Ce qui circule — une sorte, ou une liste parcourue colis après colis. */
  kind?: RackItemKind | RackItemKind[];
  /** L'écart entre deux colis, en cases. */
  spacing?: number;
  /** La vitesse, en cases par seconde de simulation. */
  speed?: number;
  /** Un décalage le long de l'itinéraire, en cases. */
  phase?: number;
  /** Au plus tant de colis à la fois. Sur une boucle, ils sont répartis régulièrement. */
  count?: number;
  /** Le flux avance. À l'arrêt, les colis restent où ils sont. */
  running?: boolean;
  /** Faire naître et s'effacer les colis aux deux bouts d'un itinéraire ouvert. Inutile quand ils
   *  sortent d'une remorque et entrent dans un bac, qui les cachent d'eux-mêmes. */
  fade?: boolean;
  /** Échelle des colis. */
  scale?: number;
  /** Un colis arrive au bout de l'itinéraire. */
  onArrive?: (id: number, kind: RackItemKind) => void;
  cellSize?: number;
  className?: string;
}

export function Cargo(props: CargoProps) {
  const { route, closed = false, cellSize = 34, className } = props;
  const r = useMemo(() => makeRoute(route, closed), [JSON.stringify(route), closed]); // eslint-disable-line react-hooks/exhaustive-deps
  const bounds: Bounds = useMemo(() => {
    const xs = r.points.map((p) => p[0]);
    const ys = r.points.map((p) => p[1]);
    const zs = r.points.map((p) => p[2]);
    return { x0: Math.min(...xs) - 0.4, x1: Math.max(...xs) + 0.4, y0: Math.min(...ys) - 0.4, y1: Math.max(...ys) + 0.4, z0: Math.min(0, ...zs), z1: Math.max(...zs) + 0.5 };
  }, [r]);
  return (
    <Solo bounds={bounds} cellSize={cellSize} className={className} ariaLabel="Flux de marchandises">
      <CargoBody {...props} />
    </Solo>
  );
}

function CargoBody({ route, closed = false, kind = "carton", spacing = 1, speed = 1, phase = 0, count, running = true, fade = true, scale = 1, onArrive }: CargoProps) {
  const r = useMemo(() => makeRoute(route, closed), [JSON.stringify(route), closed]); // eslint-disable-line react-hooks/exhaustive-deps
  const kinds = useMemo(() => (Array.isArray(kind) ? kind : [kind]), [Array.isArray(kind) ? kind.join(",") : kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const unique = useMemo(() => [...new Set(kinds)], [kinds]);
  const gap = Math.max(0.15, spacing);
  const slots = closed ? Math.max(1, Math.min(count ?? Math.floor(r.length / gap), 400)) : Math.max(1, Math.min(count ?? Math.ceil(r.length / gap) + 1, 400));
  const pitch = closed ? r.length / slots : gap;

  // Une géométrie par sorte, construite une fois, posée à l'origine : chaque colis la réemploie.
  const built = useMemo(
    () =>
      unique.map((k): Built => {
        const b = new Builder();
        const g = GOOD_SIZE[k];
        addGood(b, k, 0, 0, 0, g.half * scale, g.height * scale);
        return b.build();
      }),
    [unique, scale]
  );
  useEffect(
    () => () => {
      for (const bt of built) for (const g of [...bt.solids.values(), ...bt.decals.values(), ...bt.strokes.values(), bt.edges]) g?.dispose();
    },
    [built]
  );
  const invalidate = useThree((st) => st.invalidate);

  const holders = useRef<(Group | null)[]>([]);
  const faces = useRef<(Group | null)[][]>([]);
  const lastBase = useRef<number | null>(null);
  const clock = useSimClock();

  const place = (t: number) => {
    const base = (running ? t * speed : 0) + phase;
    for (let k = 0; k < slots; k += 1) {
      const holder = holders.current[k];
      if (!holder) continue;
      let s: number;
      let id: number;
      if (closed) {
        s = base + k * pitch;
        id = k;
      } else {
        const lead = ((base % pitch) + pitch) % pitch;
        s = lead + k * pitch;
        id = Math.floor(base / pitch) - k;
      }
      if (!closed && (s < 0 || s > r.length)) {
        holder.visible = false;
        continue;
      }
      holder.visible = true;
      const p = sampleRoute(r, s);
      holder.position.set(p.x, p.y, p.z);
      holder.rotation.set(0, -p.pitch, p.heading, "ZYX");
      // Naître et s'effacer : grandir sur les premiers décimètres, rétrécir sur les derniers.
      let g = 1;
      if (fade && !closed) {
        const edge = Math.min(s, r.length - s);
        g = Math.max(0.001, Math.min(1, edge / 0.25));
      }
      holder.scale.setScalar(g);
      const which = kinds[((id % kinds.length) + kinds.length) % kinds.length];
      const row = faces.current[k] ?? [];
      unique.forEach((u, i) => {
        const f = row[i];
        if (f) f.visible = u === which;
      });
    }
    // Les arrivées : tout colis dont la position a franchi le bout depuis la dernière image.
    if (onArrive && !closed && running) {
      const prev = lastBase.current;
      if (prev !== null && base > prev) {
        const first = Math.ceil((prev - r.length) / pitch);
        const last = Math.floor((base - r.length) / pitch);
        for (let id = first; id <= last; id += 1) onArrive(id, kinds[((id % kinds.length) + kinds.length) % kinds.length]);
      }
      lastBase.current = base;
    }
  };

  useSimFrame(place, running);
  // Une première pose, même à l'arrêt : sans elle, un flux figé resterait empilé à l'origine.
  useLayoutEffect(() => {
    place(clock.t.current);
    invalidate();
  });

  return (
    <group>
      {Array.from({ length: slots }, (_, k) => (
        <group key={k} ref={(el) => (holders.current[k] = el)} visible={false}>
          {built.map((bt, i) => (
            <group
              key={unique[i]}
              ref={(el) => {
                faces.current[k] = faces.current[k] ?? [];
                faces.current[k][i] = el;
              }}
            >
              <Parts built={bt} />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}
