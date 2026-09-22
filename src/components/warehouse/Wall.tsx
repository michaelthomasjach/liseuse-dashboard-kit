import { convexHull, frameCorners, type Point, type Project } from "./rackItems";
import { useIsoCamera } from "./isoCamera";
import "./Wall.css";

/**
 * Un mur : ce qui ferme un entrepôt, et ce qui l'ouvre.
 *
 * ## Les ouvertures
 *
 * Un mur d'entrepôt est rarement plein : c'est par lui que la marchandise sort, et un quai n'est
 * qu'une suite de **portes** où les remorques viennent se ranger. Elles ne sont donc pas un détail
 * dessiné sur le mur, ce sont des trous dedans : le mur se découpe en morceaux pleins entre les
 * ouvertures, plus un **linteau** au-dessus de chacune. Comme chaque morceau est un volume à part
 * entière, l'épaisseur du mur se voit dans le tableau de la porte — c'est ce qui la fait lire comme
 * un passage et non comme un rectangle peint.
 *
 * ## La coupe
 *
 * `cut` coupe le mur à une hauteur donnée. C'est la convention des Sims : un mur entier cache
 * exactement ce qu'on a construit derrière, et une vue isométrique n'a pas d'autre moyen de montrer
 * l'intérieur — on ne peut pas passer derrière la caméra. Coupé bas, il reste assez de mur pour
 * qu'on voie où le bâtiment s'arrête, et plus assez pour qu'il cache quoi que ce soit.
 *
 * Une ouverture plus haute que la coupe reste une ouverture : elle traverse alors tout ce qui reste
 * du mur, sans linteau. C'est juste — le linteau est au-dessus de la coupe, avec le reste — et
 * c'est surtout ce qu'on veut voir : un quai coupé doit garder ses portes, sans quoi il ne reste
 * qu'un muret plein devant lequel des remorques sont rangées sans raison.
 *
 * ## L'ordre de peinture
 *
 * Les morceaux sont disjoints **le long du mur** : leur ordre est celui où la caméra les voit sur
 * cet axe, ce que `xFace` dit. C'est lu sur l'axe du mur et non sur des emprises au sol, donc un
 * mur en biais reste juste.
 */

export interface WallOpening {
  /** Où commence l'ouverture, en cases depuis le début du mur. */
  at: number;
  /** Sa largeur, en cases. */
  width: number;
  /** Sa hauteur, en cases. Par défaut, les trois quarts du mur. */
  height?: number;
}

export interface WallProps {
  /** Longueur, en cases. */
  length?: number;
  /** Hauteur, en cases. */
  height?: number;
  /** Épaisseur, en cases. */
  thickness?: number;
  /** Les portes, les quais, les passages — des trous dans le mur. */
  openings?: WallOpening[];
  /** Couper le mur à cette hauteur, pour voir ce qu'il y a derrière. `0` ou absent : mur entier. */
  cut?: number;
  /** Rotation sur le sol, en degrés. À 0, le mur court le long des `x`. */
  rotation?: number;
  /** Poser l'ombre au sol. */
  shadows?: boolean;
  /** Où poser le coin du mur, en cases. */
  origin?: { x: number; y: number };
  /** Le pavé du monde que la `viewBox` doit couvrir, en cases. Partagé avec les autres modules
   *  d'une scène, il leur donne exactement le même repère à l'écran. */
  frame?: { x: number; y: number; width: number; depth: number; height: number };
  /** Ce qu'on dessine : tout, l'ombre seule, ou le mur seul. */
  parts?: "all" | "shadow" | "machine";
  /** Pixels par case. */
  cellSize?: number;
  className?: string;
}

const PAD = 2;

export function Wall({
  length = 10,
  height = 3.2,
  thickness = 0.3,
  openings = [],
  cut = 0,
  rotation = 0,
  shadows = false,
  origin = { x: 0, y: 0 },
  frame,
  parts = "all",
  cellSize = 30,
  className,
}: WallProps) {
  const cam = useIsoCamera();
  const L = Math.max(0.5, length);
  const D = Math.max(0.04, thickness);
  const H = Math.max(0.1, height);
  const top = cut > 0 ? Math.min(cut, H) : H;

  const theta = (rotation * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const spin = (x: number, y: number) => {
    if (!rotation) return { x, y };
    const dx = x - L / 2;
    const dy = y - D / 2;
    return { x: L / 2 + dx * cosT - dy * sinT, y: D / 2 + dx * sinT + dy * cosT };
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

  // Les trous, remis dans l'ordre du mur. Au-dessus d'un trou, il reste le linteau — et il n'en
  // reste rien si la coupe passe sous lui.
  const holes = openings
    .map((o) => ({ x0: Math.max(0, o.at), x1: Math.min(L, o.at + Math.max(0.1, o.width)), z: Math.min(o.height ?? H * 0.75, H) }))
    .filter((o) => o.x1 > o.x0)
    .sort((a, b) => a.x0 - b.x0);

  const ring = (points: Point[]) => points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  // Les clartés, comme pour une boîte : la face qui regarde selon `x` et celle qui regarde selon
  // `y` n'ont pas la même, et c'est `xOnLeft` qui dit laquelle est la plus sombre.
  const faceY = facing.xOnLeft ? "side" : "front";
  const faceX = facing.xOnLeft ? "front" : "side";

  // La face qu'on voit, et le bout qu'on voit : un mur est mince, on n'en voit jamais qu'un de
  // chaque.
  const ys = facing.yFace > 0 ? D : 0;
  const xs = facing.xFace > 0 ? L : 0;

  /** La grande face, **d'un seul tenant**, percée de ses ouvertures. */
  const sheet = () => {
    const quad = (points: Point[]) => `M ${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")} Z`;
    const outer = quad([at(0, ys, 0), at(L, ys, 0), at(L, ys, top), at(0, ys, top)]);
    const cuts = holes.map((h) => {
      const z = Math.min(h.z, top);
      return quad([at(h.x0, ys, 0), at(h.x1, ys, 0), at(h.x1, ys, z), at(h.x0, ys, z)]);
    });
    // `evenodd` : les ouvertures sont des sous-contours qui **percent** la face, et non des
    // rectangles posés dessus. C'est ce qui laisse voir la scène à travers une porte.
    return <path className={`lq-iso__face lq-iso__face--${faceY}`} fillRule="evenodd" d={[outer, ...cuts].join(" ")} />;
  };

  /** Le tableau d'une porte : le côté de l'épaisseur du mur qu'on voit dedans. Sans lui, une
   *  ouverture est un trou dans une feuille de papier ; avec lui, c'est un passage. */
  const jamb = (h: { x0: number; x1: number; z: number }, key: string) => {
    const x = facing.xFace > 0 ? h.x0 : h.x1;
    const z = Math.min(h.z, top);
    return (
      <polygon
        key={key}
        className={`lq-iso__face lq-iso__face--${faceX}`}
        points={ring([at(x, 0, 0), at(x, D, 0), at(x, D, z), at(x, 0, z)])}
      />
    );
  };

  const wall = (
    <g key="wall" className="lq-iso__solid lq-iso__solid--wall">
      {/* Les tableaux d'abord : ils sont au fond des ouvertures, et la face percée les laisse voir
          par ses trous. Puis le bout, puis le dessus, qui est au-dessus de tout. */}
      {holes.map((h, i) => jamb(h, `jamb${i}`))}
      {sheet()}
      <polygon className={`lq-iso__face lq-iso__face--${faceX}`} points={ring([at(xs, 0, 0), at(xs, D, 0), at(xs, D, top), at(xs, 0, top)])} />
      <polygon className="lq-iso__face lq-iso__face--top" points={ring([at(0, 0, top), at(L, 0, top), at(L, D, top), at(0, D, top)])} />
    </g>
  );

  // ---- l'ombre ----
  const sweep = (x0: number, x1: number, h: number, key: string) => {
    const foot = [onGround(x0, 0), onGround(x1, 0), onGround(x1, D), onGround(x0, D)];
    const cast = foot.map((p) => ({ x: p.x + cam.sun.x * h, y: p.y + cam.sun.y * h }));
    return <polygon key={key} className="lq-iso__shadow" points={ring(convexHull([...foot, ...cast].map((p) => world(p.x, p.y, 0))))} />;
  };
  // Une ouverture laisse passer la lumière, mais son linteau porte quand même : l'ombre est celle du
  // mur entier, moins les tranches de sol qu'on voit par les portes.
  const lit = holes.filter((h) => h.z >= top - 0.001);
  const spans: [number, number][] = [];
  let from = 0;
  for (const h of lit) {
    if (h.x0 > from) spans.push([from, h.x0]);
    from = Math.max(from, h.x1);
  }
  if (from < L) spans.push([from, L]);
  const shade = shadows ? <g>{spans.map(([a, b], i) => sweep(a, b, top, `s${i}`))}</g> : null;

  // ---- le cadrage ----
  const corners: Point[] = frame
    ? frameCorners(frame, world, cam.sun)
    : [0, top].flatMap((z) =>
        [
          [0, 0],
          [L, 0],
          [L, D],
          [0, D],
        ].map(([x, y]) => at(x, y, z))
      );
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  return (
    <svg
      className={["lq-wall", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={`${minX} ${minY} ${boxWidth} ${boxHeight}`}
      role="img"
      aria-label={holes.length > 0 ? `Mur à ${holes.length} ouvertures` : "Mur"}
    >
      {(parts === "all" || parts === "shadow") && shade}
      {(parts === "all" || parts === "machine") && wall}
    </svg>
  );
}
