import { IsoCanvas } from "./isoCanvas";
import { boxFaces, convexHull, frameCorners, solidVolume, type Point, type Project } from "./rackItems";
import type { Contour } from "./rackItems";
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
  /** L'équiper en **porte de quai** : casquette, tablier, butoirs et poteaux de protection. */
  dock?: boolean;
  /** À quelle hauteur commence l'ouverture, en cases. Par défaut, le sol — ou le niveau du quai
   *  pour une porte de quai, qui ne s'ouvre pas sur le vide. */
  sill?: number;
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
  /** De quel côté du mur se rangent les camions, donc où sont les équipements de quai. */
  dockSide?: "y0" | "y1";
  /** Les poteaux qui raidissent les panneaux : aux deux bouts, puis tous les `pierSpacing`. */
  piers?: boolean;
  /** L'écart entre deux poteaux, en cases. */
  pierSpacing?: number;
  /** La hauteur de la plateforme de quai, en cases. `0` : pas de quai, les portes au ras du sol. */
  dockHeight?: number;
  /**
   * Le niveau sur lequel le mur est **posé**, en cases. `0` : à même le sol.
   *
   *  Un mur de quai ne part pas de la cour : il est assis sur la plateforme, et ce qu'on voit
   *  au-dessous est la tranche de la dalle. Le poser au sol le ferait passer **devant** cette dalle
   *  plutôt que dessus — le plancher se peint avant les murs, puisqu'il est le sol — et ses
   *  1 200 mm de base viendraient recouvrir le plancher tout autour du bâtiment, si bien que le
   *  seuil des portes paraîtrait flotter au-dessus de lui. Assis dessus, il n'y a plus rien de lui
   *  sous le plancher, et la question ne se pose plus.
   */
  base?: number;
  /** Une rampe d'accès à un bout du quai, pour monter de la cour au niveau de la plateforme. */
  ramp?: "none" | "start" | "end";
  /** Sa longueur, en cases. */
  rampLength?: number;
  /** Sa largeur, en cases — une rampe est une voie, pas un nez de quai. */
  rampWidth?: number;
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

/**
 * Les cotes du quai, **en millimètres**, relevées sur la planche.
 *
 * Elles sont écrites ici en toutes lettres plutôt que converties : `0.3` ne se vérifie contre rien,
 * `600 mm` se lit sur le plan. L'échelle est celle du reste de l'entrepôt — une case vaut deux
 * mètres — ce qui met un mur de 6 000 à trois cases et une porte de 3 000 à une et demie.
 */
const MM = 1 / 2000;
/** La hauteur du quai. **C'est la cote qui commande tout le reste** : un plancher de remorque est à
 *  1 180 mm du sol, et c'est pour l'atteindre qu'un quai est une plateforme et non une porte au ras
 *  du sol. Le seuil des portes se cale donc dessus. */
const DOCK_H_MM = 1200;
/** Le nez du quai, qui déborde du nu du mur : c'est lui que la remorque touche en reculant. */
const DOCK_NOSE_MM = 300;
/** Le poteau : sa largeur, sa saillie de part et d'autre du mur, et ce dont il dépasse en tête. */
const PIER_W_MM = 600;
const PIER_OUT_MM = 150;
const PIER_UP_MM = 200;
/** La casquette de la porte : sa profondeur et l'épaisseur de son cadre. */
const SHROUD_MM = 600;
const SHROUD_T_MM = 350;
/** Le jambage de béton de part et d'autre du tablier, et le poteau de protection. */
const JAMB_MM = 250;
const BOLLARD_D_MM = 200;
const BOLLARD_H_MM = 1200;
/** Le butoir de quai. */
const BUMPER_W_MM = 250;
const BUMPER_H_MM = 500;

export function Wall({
  length = 10,
  height = 3.2,
  thickness = 0.3,
  openings = [],
  cut = 0,
  dockSide = "y0",
  piers = true,
  pierSpacing = 3,
  dockHeight,
  base = 0,
  ramp = "none",
  rampLength = 2,
  rampWidth = 1.6,
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
  /** L'assise du mur : son pied. Tout ce qui est du mur part de là, et rien n'existe au-dessous. */
  const sole = Math.max(0, base);
  const top = sole + (cut > 0 ? Math.min(cut, H) : H);

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

  /**
   * Le niveau du quai.
   *
   *  Il vaut 1 200 mm dès qu'une porte de quai est demandée, et c'est la cote qui commande tout le
   *  reste : le plancher d'une remorque est à 1 180 mm du sol, et une porte de quai n'existe que
   *  pour arriver à ce niveau-là. Posée au ras du sol, elle ouvre sur le vide sous la remorque et
   *  rien ne peut passer — c'est un quai dessiné, pas un quai.
   */
  const dockZ = dockHeight ?? (openings.some((o) => o.dock) ? DOCK_H_MM * MM : 0);
  /** Le nez du quai : ce dont la plateforme déborde du nu du mur, côté cour. */
  const nose = DOCK_NOSE_MM * MM;

  // Les trous, remis dans l'ordre du mur. Au-dessus d'un trou, il reste le linteau — et il n'en
  // reste rien si la coupe passe sous lui.
  const holes = openings
    .map((o) => {
      // Une porte de quai se cale sur la plateforme, que le mur soit assis dessus ou planté dans la
      // cour : dans le premier cas c'est déjà son pied, dans le second c'est 1 200 mm plus haut.
      const sill = Math.max(sole, Math.min(o.sill ?? (o.dock ? Math.max(sole, dockZ) : sole), sole + H));
      return {
        x0: Math.max(0, o.at),
        x1: Math.min(L, o.at + Math.max(0.1, o.width)),
        z0: sill,
        z: Math.min(sill + (o.height ?? H * 0.75), sole + H),
        dock: o.dock === true,
      };
    })
    .filter((o) => o.x1 > o.x0 && o.z > o.z0)
    .sort((a, b) => a.x0 - b.x0);

  /**
   * Un contour, **rendu en nombres et non en texte**.
   *
   *  Il rendait `"12.34,56.78 …"`, parce qu'un attribut `points` de SVG est une chaîne. Depuis que le
   *  dessin va sur un canvas, cette chaîne n'est plus lue par personne : elle est fabriquée à coups
   *  de `toFixed`, puis re-découpée et reconvertie en nombres par le peintre. Deux conversions et une
   *  allocation par facette, à chaque image — c'était le premier poste du profil pendant une
   *  rotation. Les éléments n'étant jamais montés dans le document, rien n'oblige à passer par du
   *  texte : le tableau va directement du calcul au tracé.
   */
  const ring = (points: Point[]): Contour => {
    const out = new Array<number>(points.length * 2);
    for (let i = 0; i < points.length; i += 1) {
      out[i * 2] = points[i].x;
      out[i * 2 + 1] = points[i].y;
    }
    // Le tableau se donne pour une chaîne : voir `Contour`.
    return out as unknown as Contour;
  };
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
    const outer = quad([at(0, ys, sole), at(L, ys, sole), at(L, ys, top), at(0, ys, top)]);
    const cuts = holes
      .filter((h) => h.z0 < top)
      .map((h) => {
        const z = Math.min(h.z, top);
        return quad([at(h.x0, ys, h.z0), at(h.x1, ys, h.z0), at(h.x1, ys, z), at(h.x0, ys, z)]);
      });
    // `evenodd` : les ouvertures sont des sous-contours qui **percent** la face, et non des
    // rectangles posés dessus. C'est ce qui laisse voir la scène à travers une porte.
    return <path className={`lq-iso__face lq-iso__face--${faceY}`} fillRule="evenodd" d={[outer, ...cuts].join(" ")} />;
  };

  /** Le tableau d'une porte : le côté de l'épaisseur du mur qu'on voit dedans. Sans lui, une
   *  ouverture est un trou dans une feuille de papier ; avec lui, c'est un passage. */
  const jamb = (h: { x0: number; x1: number; z0: number; z: number }, key: string) => {
    const x = facing.xFace > 0 ? h.x0 : h.x1;
    const z = Math.min(h.z, top);
    if (h.z0 >= z) return null;
    return (
      <g key={key}>
        <polygon
          className={`lq-iso__face lq-iso__face--${faceX}`}
          points={ring([at(x, 0, h.z0), at(x, D, h.z0), at(x, D, z), at(x, 0, z)])}
        />
        {/* L'allège : le dessus du muret sous la porte, qu'on voit dans l'embrasure dès que le seuil
            est au-dessus du sol. Sans elle, une porte de quai s'ouvre sur un trou. */}
        {h.z0 > sole && (
          <polygon
            className="lq-iso__face lq-iso__face--top"
            points={ring([at(h.x0, 0, h.z0), at(h.x1, 0, h.z0), at(h.x1, D, h.z0), at(h.x0, D, h.z0)])}
          />
        )}
      </g>
    );
  };

  /**
   * Ce qui fait d'une ouverture une **porte de quai**, d'après la planche.
   *
   *  Cinq pièces, et chacune a une raison d'être là : la **casquette**, un cadre sombre de 600 mm
   *  de saillie qui coiffe l'ouverture sur trois côtés — c'est elle qu'on reconnaît de loin, et
   *  c'est contre elle que la remorque vient se plaquer ; le **tablier**, sectionnel et clair, avec
   *  ses deux hublots ; les deux **jambages** de béton de 250 mm qui réduisent le passage à
   *  3 000 mm ; les deux **butoirs** noirs de 250 × 500 boulonnés sur le nez du quai, que le
   *  pare-chocs de la remorque touche en reculant ; et les deux **poteaux de protection** jaunes,
   *  Ø 200 sur 1 200 de haut, plantés dans la cour — ils arrêtent la remorque avant le mur, et leur
   *  hauteur n'est pas un hasard : c'est celle du quai.
   *
   *  Tout cela est sur la face du quai et ne se dessine donc que quand c'est elle qu'on regarde :
   *  vue de l'intérieur, une porte de quai n'est qu'une porte.
   */
  const fittings = (h: { x0: number; x1: number; z0: number; z: number; dock: boolean }, key: string) => {
    if (!h.dock) return null;
    const z = Math.min(h.z, top);
    if (h.z0 >= z) return null;
    const out = dockSide === "y0" ? -1 : 1;
    /** Le nu de la face quai, et le sens dans lequel les pièces en sortent. */
    const face = dockSide === "y0" ? 0 : D;
    const span = (depth: number): [number, number] => (out < 0 ? [face - depth, face] : [face, face + depth]);

    const jambW = JAMB_MM * MM;
    const shroud = SHROUD_MM * MM;
    const frameT = SHROUD_T_MM * MM;
    const [sy0, sy1] = span(shroud);

    /** La casquette : deux piédroits et un linteau, tous en saillie du mur. */
    const hood = [
      solidVolume("dock", `hood-l${key}`, boxFaces(at, h.x0 - frameT, h.x0, sy0, sy1, h.z0, z + frameT, facing)),
      solidVolume("dock", `hood-r${key}`, boxFaces(at, h.x1, h.x1 + frameT, sy0, sy1, h.z0, z + frameT, facing)),
      solidVolume("dock", `hood-t${key}`, boxFaces(at, h.x0 - frameT, h.x1 + frameT, sy0, sy1, z, z + frameT, facing)),
    ];

    /** Le tablier, dans le plan du mur : un panneau clair, ses refends horizontaux et ses hublots. */
    const px0 = h.x0 + jambW;
    const px1 = h.x1 - jambW;
    const pz1 = z - 0.02;
    const leafFace = out < 0 ? face + 0.004 : face - 0.004;
    const sections = Math.max(3, Math.round((pz1 - h.z0) / 0.22));
    const leaf = (
      <g key={`leaf${key}`}>
        <polygon className="lq-wall__leaf" points={ring([at(px0, leafFace, h.z0), at(px1, leafFace, h.z0), at(px1, leafFace, pz1), at(px0, leafFace, pz1)])} />
        <g className="lq-wall__section">
          {Array.from({ length: sections - 1 }, (_, i) => {
            const zz = h.z0 + ((pz1 - h.z0) * (i + 1)) / sections;
            const a = at(px0, leafFace, zz);
            const b = at(px1, leafFace, zz);
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
        </g>
        {/* Deux hublots, aux deux tiers de la hauteur : c'est par là que le cariste voit le quai. */}
        {[0.28, 0.56].map((f) => {
          const a = px0 + (px1 - px0) * f;
          const b = a + (px1 - px0) * 0.16;
          const zc = h.z0 + (pz1 - h.z0) * 0.62;
          return (
            <polygon
              key={f}
              className="lq-wall__pane"
              points={ring([at(a, leafFace, zc), at(b, leafFace, zc), at(b, leafFace, zc + 0.09), at(a, leafFace, zc + 0.09)])}
            />
          );
        })}
      </g>
    );

    /** Les butoirs, sur le nez du quai, sous les jambages. */
    const bw = BUMPER_W_MM * MM;
    const bh = BUMPER_H_MM * MM;
    const [by0, by1] = span(nose + 0.05);
    const bumpers =
      h.z0 > bh
        ? [h.x0 + jambW * 0.2, h.x1 - jambW * 0.2 - bw].map((bx, i) =>
            solidVolume("dock", `bump${i}${key}`, boxFaces(at, bx, bx + bw, by0, by1, h.z0 - bh - 0.04, h.z0 - 0.04, facing))
          )
        : [];

    /** Les poteaux de protection, plantés dans la cour devant les butoirs. */
    const bd = BOLLARD_D_MM * MM;
    const bz = BOLLARD_H_MM * MM;
    const py = out < 0 ? face - nose - 0.22 : face + nose + 0.22;
    const bollards = [h.x0 - frameT * 0.5, h.x1 + frameT * 0.5 - bd].map((bx, i) =>
      solidVolume("safety", `boll${i}${key}`, boxFaces(at, bx, bx + bd, py - bd / 2, py + bd / 2, 0, bz, facing))
    );

    return (
      <g key={key}>
        {leaf}
        {hood}
        {bumpers}
        {bollards}
      </g>
    );
  };

  const dockFaceVisible = dockSide === "y0" ? facing.yFace < 0 : facing.yFace > 0;

  /**
   * La plateforme de quai, et la rampe qui y monte.
   *
   *  La plateforme est le sol du bâtiment, porté à 1 200 mm : c'est elle qui met le seuil des
   *  portes à hauteur de plancher de remorque. Vue de la cour on n'en voit que le nez — 300 mm de
   *  béton en avant du mur — et c'est contre ce nez que la remorque vient buter.
   *
   *  La rampe est le seul moyen d'y monter autrement que par une porte : un plan incliné à un bout
   *  du quai, qui descend jusqu'à la cour. Elle n'est pas un pavé — une rampe qui serait une marche
   *  n'en serait pas une — donc ses faces sont écrites une à une : le plan incliné, les deux
   *  triangles de flanc, et le petit bout vertical qui la raccorde à la plateforme.
   */
  const apronY: [number, number] = dockSide === "y0" ? [-nose, 0] : [D, D + nose];
  /** Le quai n'appartient qu'aux murs qui en portent un : un mur aveugle n'a pas de nez, même quand
   *  la scène lui donne la hauteur de plateforme pour que ses portes tombent au bon niveau. */
  const hasDock = holes.some((h) => h.dock) || ramp !== "none";
  const apron =
    dockZ > 0 && hasDock ? solidVolume("wall", "apron", boxFaces(at, 0, L, apronY[0], apronY[1], 0, dockZ, facing)) : null;

  const slope = (() => {
    if (ramp === "none" || dockZ <= 0) return null;
    const len = Math.max(0.5, rampLength);
    const [a, b] = ramp === "start" ? [-len, 0] : [L, L + len];
    // Le haut de la pente est du côté du quai, le bas du côté de la cour.
    const up = ramp === "start" ? b : a;
    const down = ramp === "start" ? a : b;
    // La rampe est large : c'est une voie qu'on monte, pas le nez du quai.
    const [y0, y1]: [number, number] = dockSide === "y0" ? [-Math.max(nose, rampWidth), 0] : [D, D + Math.max(nose, rampWidth)];
    const near = facing.yFace > 0 ? y1 : y0;
    const quad = (pts: Point[], cls: string, k: string) => <polygon key={k} className={`lq-iso__face lq-iso__face--${cls}`} points={ring(pts)} />;
    return (
      <g key="ramp">
        {quad([at(down, y0, 0), at(up, y0, dockZ), at(up, y1, dockZ), at(down, y1, 0)], "top", "slope")}
        {quad([at(down, near, 0), at(up, near, dockZ), at(up, near, 0)], faceY, "cheek")}
        {quad([at(up, y0, 0), at(up, y1, 0), at(up, y1, dockZ), at(up, y0, dockZ)], faceX, "riser")}
      </g>
    );
  })();

  /**
   * Les poteaux, et la couvertine.
   *
   *  Un mur d'entrepôt est fait de panneaux préfabriqués, et ce qui les tient sont des poteaux :
   *  un à chaque bout, un à chaque joint. Ils débordent des deux faces et **dépassent en tête**,
   *  ce qui est exactement ce qui se voit sur la planche — sans eux, un mur est une plaque, et une
   *  plaque n'a pas d'échelle. La couvertine est la bande qui court au-dessus de tout : c'est elle
   *  qui donne au mur son arête franche, et elle passe devant les panneaux comme devant les
   *  poteaux.
   */
  const pierW = PIER_W_MM * MM;
  const pierOut = PIER_OUT_MM * MM;
  const pierTop = top + PIER_UP_MM * MM;
  const pierXs = (() => {
    if (!piers) return [];
    const xs = [0, L - pierW];
    const step = Math.max(0.5, pierSpacing);
    for (let x = step; x < L - pierW; x += step) xs.push(x - pierW / 2);
    return [...new Set(xs.map((x) => Math.max(0, Math.min(L - pierW, x))))].sort((a, b) => a - b);
  })();
  const pierRow = pierXs.map((x) => ({
    x,
    node: solidVolume("wall", `pier${x.toFixed(2)}`, boxFaces(at, x, x + pierW, -pierOut, D + pierOut, sole, pierTop, facing)),
  }));
  const coping = solidVolume("wall", "coping", boxFaces(at, 0, L, -0.035, D + 0.035, top - 0.07, top, facing));

  const wall = (
    <g key="wall" className="lq-iso__solid lq-iso__solid--wall">
      {/* Les tableaux d'abord : ils sont au fond des ouvertures, et la face percée les laisse voir
          par ses trous. Puis le bout, puis le dessus, qui est au-dessus de tout. */}
      {/* Le quai est **d'un seul côté du mur**, et il se range donc comme tout ce qui l'est : devant
          quand on est de ce côté-là, derrière sinon. Peint systématiquement après le mur, son nez
          revenait par-dessus les panneaux vus de l'intérieur — une bande claire courant le long de
          la façade, dans le bâtiment — et la rampe débordait par-dessus le mur voisin. */}
      {!dockFaceVisible && slope}
      {!dockFaceVisible && apron}
      {holes.map((h, i) => jamb(h, `jamb${i}`))}
      {sheet()}
      <polygon className={`lq-iso__face lq-iso__face--${faceX}`} points={ring([at(xs, 0, sole), at(xs, D, sole), at(xs, D, top), at(xs, 0, top)])} />
      {coping}
      {/* Les poteaux après les panneaux : ils sont en saillie des deux faces, donc rien du mur ne
          passe devant eux. Rangés le long du mur, puisqu'ils ne se chevauchent pas entre eux. */}
      {[...pierRow].sort((a, b) => (a.x - b.x) * facing.xFace).map((p) => p.node)}
      {dockFaceVisible && slope}
      {dockFaceVisible && apron}
      {dockFaceVisible && holes.map((h, i) => fittings(h, `dock${i}`))}
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
    : [0, Math.max(top, pierTop)].flatMap((z) =>
        [
          [ramp === "start" ? -rampLength : 0, apronY[0]],
          [ramp === "end" ? L + rampLength : L, apronY[0]],
          [ramp === "end" ? L + rampLength : L, apronY[1]],
          [ramp === "start" ? -rampLength : 0, apronY[1]],
        ].map(([x, y]) => at(x, y, z))
      );
  const minX = Math.min(...corners.map((p) => p.x)) - PAD;
  const minY = Math.min(...corners.map((p) => p.y)) - PAD;
  const boxWidth = Math.max(...corners.map((p) => p.x)) + PAD - minX;
  const boxHeight = Math.max(...corners.map((p) => p.y)) + PAD - minY;

  return (
    <IsoCanvas
      className={["lq-wall", className].filter(Boolean).join(" ")}
      width={boxWidth}
      height={boxHeight}
      viewBox={[minX, minY, boxWidth, boxHeight]}
      ariaLabel={holes.length > 0 ? `Mur à ${holes.length} ouvertures` : "Mur"}
    >
      {(parts === "all" || parts === "shadow") && shade}
      {(parts === "all" || parts === "machine") && wall}
    </IsoCanvas>
  );
}
