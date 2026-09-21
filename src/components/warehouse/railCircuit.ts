import type { RailKind } from "./Rail";

/**
 * Un circuit de rail : des droits et des angles mis bout à bout, et la voie qu'ils tracent.
 *
 * ## Chaîner des modules
 *
 * L'entrée d'une voie est au même endroit dans le repère local d'un droit et d'un angle —
 * `(0, largeur / 2)`, cap `+x` — donc chaîner revient à faire tomber l'entrée d'un module sur la
 * sortie du précédent. Un module tourne autour de son propre centre (c'est ce que fait `rotation`
 * sur `Rail`) : on cherche donc l'`origin` qui amène l'entrée tournée au bon endroit, et le reste
 * suit. Le cap s'accumule tout seul : un angle tourne d'un quart, vers la droite du sens de marche.
 * Quatre angles bouclent un circuit, et c'est la somme des longueurs qui dit s'il se referme.
 *
 * ## La voie, pour ce qui roule dessus
 *
 * `at(s)` donne le point de l'axe de la voie et le cap à une distance `s` du départ. C'est le même
 * calcul que le placement des modules — le point local de l'axe, passé par la même transformation —
 * donc une machine posée là est sur les files, et non à côté d'une courbe qui leur ressemble. Dans un
 * angle, le cap est la tangente au quart de cercle : il tourne continûment, et c'est ce qui oblige à
 * redessiner la machine à chaque image plutôt qu'à la translater.
 */

export type CircuitPiece = { kind: "straight"; length: number } | { kind: "corner" };

export interface CircuitModule {
  kind: RailKind;
  /** Longueur, pour un droit ; le côté du carré, pour un angle. */
  length: number;
  /** Cap du module, en degrés — la `rotation` à donner au `Rail`. */
  rotation: number;
  /** Où poser le module — l'`origin` à donner au `Rail`. */
  origin: { x: number; y: number };
  /** Profondeur de son centre vu de la caméra (x + y) : l'ordre dans lequel peindre les modules,
   *  qui sont disjoints et ne peuvent donc pas se recouvrir autrement. */
  depth: number;
  /** Où commence le module le long de la voie, en cases. */
  start: number;
  /** Longueur de voie dans ce module, en cases — l'arc pour un angle. */
  run: number;
}

export interface CircuitPose {
  x: number;
  y: number;
  /** Cap, en degrés : la `rotation` à donner à la machine. */
  heading: number;
  /** Vrai dans un angle. Une machine y ralentit. */
  turning: boolean;
}

export interface RailCircuit {
  modules: CircuitModule[];
  /** Longueur totale de la voie, en cases. */
  length: number;
  /** Le point de l'axe et le cap à une distance `s` du départ ; `s` boucle sur la longueur. */
  at: (s: number) => CircuitPose;
  /** L'emprise des modules au sol, en cases. */
  bounds: { x: number; y: number; width: number; depth: number };
}

const RAD = Math.PI / 180;

/**
 * `curveRadius` est celui de l'axe dans les angles — à donner aussi à chaque `Rail` d'angle, ou à
 * laisser par défaut des deux côtés : c'est la même valeur par défaut, la largeur de la voie.
 */
export function railCircuit(
  pieces: CircuitPiece[],
  width: number,
  { start = { x: 0, y: 0 }, heading = 0, curveRadius }: { start?: { x: number; y: number }; heading?: number; curveRadius?: number } = {}
): RailCircuit {
  const W = width;
  // La même règle que `Rail` : jamais sous la demi-largeur, la largeur par défaut.
  const R = Math.max(W / 2, curveRadius ?? W);
  const side = R + W / 2;
  const modules: CircuitModule[] = [];
  const locals: ((u: number) => { x: number; y: number; heading: number })[] = [];
  const places: ((p: { x: number; y: number }) => { x: number; y: number })[] = [];

  // L'entrée du premier module : `start` est le coin du premier droit, comme l'`origin` d'un Rail
  // non tourné — son entrée est donc à mi-largeur.
  let entry = { x: start.x, y: start.y + W / 2 };
  let h = heading;
  let s = 0;

  for (const piece of pieces) {
    const spanX = piece.kind === "straight" ? Math.max(W, piece.length) : side;
    const spanY = piece.kind === "straight" ? W : side;
    const c = { x: spanX / 2, y: spanY / 2 };
    const cos = Math.cos(h * RAD);
    const sin = Math.sin(h * RAD);
    const turn = (p: { x: number; y: number }) => ({
      x: c.x + (p.x - c.x) * cos - (p.y - c.y) * sin,
      y: c.y + (p.x - c.x) * sin + (p.y - c.y) * cos,
    });
    // L'origine qui amène l'entrée locale (0, W/2), une fois tournée, sur la sortie du précédent.
    const e = turn({ x: 0, y: W / 2 });
    const origin = { x: entry.x - e.x, y: entry.y - e.y };
    const place = (p: { x: number; y: number }) => {
      const q = turn(p);
      return { x: q.x + origin.x, y: q.y + origin.y };
    };

    const run = piece.kind === "straight" ? spanX : (Math.PI / 2) * R;
    const h0 = h;
    // L'axe de la voie en local, à une fraction `u` du module, et le cap qu'on y a.
    const local =
      piece.kind === "straight"
        ? (u: number) => ({ x: u * spanX, y: W / 2, heading: h0 })
        : (u: number) => {
            // De −90° à 0° autour du coin (0, côté) : entrée à l'ouest, sortie au sud.
            const a = -Math.PI / 2 + (Math.PI / 2) * u;
            return { x: R * Math.cos(a), y: side + R * Math.sin(a), heading: h0 + u * 90 };
          };

    const mid = place(c);
    modules.push({
      kind: piece.kind,
      length: spanX,
      rotation: h,
      origin,
      depth: mid.x + mid.y,
      start: s,
      run,
    });
    locals.push(local);
    places.push(place);

    const out = local(1);
    entry = place(out);
    h = piece.kind === "corner" ? h + 90 : h;
    s += run;
  }

  const length = s;
  const at = (distance: number): CircuitPose => {
    const d = length > 0 ? ((distance % length) + length) % length : 0;
    let i = modules.length - 1;
    for (let k = 0; k < modules.length; k += 1) {
      if (d < modules[k].start + modules[k].run) {
        i = k;
        break;
      }
    }
    const m = modules[i];
    const u = m.run > 0 ? (d - m.start) / m.run : 0;
    const p = locals[i](u);
    const q = places[i](p);
    return { x: q.x, y: q.y, heading: p.heading, turning: m.kind === "corner" };
  };

  // L'emprise : les quatre coins de chaque module, tournés et posés.
  const pts = modules.flatMap((m, i) =>
    [
      { x: 0, y: 0 },
      { x: m.length, y: 0 },
      { x: m.length, y: m.kind === "straight" ? W : side },
      { x: 0, y: m.kind === "straight" ? W : side },
    ].map((p) => places[i](p))
  );
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);

  return { modules, length, at, bounds: { x, y, width: Math.max(...xs) - x, depth: Math.max(...ys) - y } };
}
