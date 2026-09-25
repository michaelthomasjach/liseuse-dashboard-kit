import { Builder, placeAt } from "./three/builder";
import { Parts, Solo, frameBounds, useBuilt } from "./three/scene";
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
 * ## En 3D
 *
 * Les morceaux de mur — trumeaux entre les ouvertures, linteaux au-dessus, allèges au-dessous —
 * sont de vrais volumes : l'épaisseur se voit dans le tableau de chaque porte, de dehors comme de
 * dedans, et la profondeur range tout sans qu'on ait à dire ce qui passe devant. Les portes de
 * quai **s'ouvrent** (`open`) : le tablier sectionnel remonte, la baie se découvre, et c'est par là
 * que la marchandise passe de la remorque au bâtiment.
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
  /** Une porte de quai ouverte : `0` fermée, `1` le tablier remonté en entier. */
  open?: number;
  /**
   * Ce qui garnit l'ouverture, hors quai :
   * - `"door"` : une **porte d'entrée** de local — huisserie, vantail plein à oculus, poignée ;
   * - `"window"` : une **fenêtre** — appui saillant, dormant, vitrage, meneau ;
   * - `"bay"` : une **baie vitrée** — un grand vitrage recoupé de montants et d'une imposte.
   * Sans lui, l'ouverture reste un trou. Chaque sorte a sa hauteur et son allège ordinaires.
   */
  kind?: "door" | "window" | "bay";
}

/** L'allège et la hauteur ordinaires de chaque garniture, en cases. */
const OPENING_DEFAULTS: Record<"door" | "window" | "bay", { sill: number; height: number }> = {
  door: { sill: 0, height: 1.1 },
  window: { sill: 0.5, height: 0.6 },
  bay: { sill: 0.04, height: 1.3 },
};

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
  /**
   * Les poteaux qui raidissent les panneaux, et c'est ce qui fait les **deux familles de murs** du
   * bâtiment.
   *
   *  - `"spaced"` — un poteau à chaque bout, puis un tous les `pierSpacing` : le mur **aveugle**.
   *    Ce sont les joints entre panneaux préfabriqués, et sans eux un mur de trente mètres est une
   *    plaque sans échelle.
   *  - `"ends"` — un poteau à chaque bout, et rien entre : le mur **à portes**.
   *  - `"none"` — aucun.
   *
   *  Par défaut, **le mur choisit d'après ses ouvertures** : aveugle, il prend ses poteaux espacés ;
   *  percé, il n'en garde qu'aux deux bouts. Ce n'est pas un réglage d'exemple, c'est ce qu'un mur à
   *  portes est : ses portes l'articulent déjà. Un poteau tous les trois mètres entre des portes
   *  tous les trois mètres donne une file d'éléments verticaux de même largeur qu'on ne lit plus
   *  comme une structure mais comme une grille — et les poteaux tombent alors sur les casquettes,
   *  qu'ils traversent, puisqu'ils sont en saillie des deux faces et les casquettes aussi.
   *
   *  `true` et `false` restent acceptés pour `"spaced"` et `"none"`.
   */
  piers?: boolean | "spaced" | "ends" | "none";
  /** Un bardage : des panneaux métalliques horizontaux sur les deux faces, leurs joints tracés —
   *  le mur d'un bâtiment logistique récent, par opposition au voile de béton nu. */
  cladding?: boolean;
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

interface Hole {
  x0: number;
  x1: number;
  z0: number;
  z: number;
  dock: boolean;
  open: number;
  kind?: "door" | "window" | "bay";
}

/** Les cotes dérivées d'un mur : ses ouvertures remises dans l'ordre, sa hauteur utile. */
function wallLayout(props: WallProps) {
  const { length = 10, height = 3.2, thickness = 0.3, openings = [], cut = 0, dockHeight, base = 0 } = props;
  const L = Math.max(0.5, length);
  const D = Math.max(0.04, thickness);
  const H = Math.max(0.1, height);
  const sole = Math.max(0, base);
  const top = sole + (cut > 0 ? Math.min(cut, H) : H);
  const dockZ = dockHeight ?? (openings.some((o) => o.dock) ? DOCK_H_MM * MM : 0);
  const holes: Hole[] = openings
    .map((o) => {
      // Une porte de quai se cale sur la plateforme, que le mur soit assis dessus ou planté dans
      // la cour : dans le premier cas c'est déjà son pied, dans le second c'est 1 200 mm plus haut.
      const def = o.kind ? OPENING_DEFAULTS[o.kind] : null;
      const sill = Math.max(sole, Math.min(o.sill ?? (o.dock ? Math.max(sole, dockZ) : sole + (def?.sill ?? 0)), sole + H));
      return {
        x0: Math.max(0, o.at),
        x1: Math.min(L, o.at + Math.max(0.1, o.width)),
        z0: sill,
        z: Math.min(sill + (o.height ?? def?.height ?? H * 0.75), sole + H),
        dock: o.dock === true,
        open: Math.max(0, Math.min(1, o.open ?? 0)),
        kind: o.dock ? undefined : o.kind,
      };
    })
    .filter((o) => o.x1 > o.x0 && o.z > o.z0)
    .sort((a, b) => a.x0 - b.x0);
  return { L, D, H, sole, top, dockZ, holes, pierTop: top + PIER_UP_MM * MM };
}

export function Wall(props: WallProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, frame, parts = "all", cellSize = 30, className, dockSide = "y0" } = props;
  if (parts === "shadow") return null;
  const { L, D, holes, pierTop } = wallLayout(props);
  const nose = DOCK_NOSE_MM * MM;
  const out = holes.some((h) => h.dock) ? nose + 0.4 : PIER_OUT_MM * MM;
  const y0 = dockSide === "y0" ? -out : -PIER_OUT_MM * MM;
  const y1 = dockSide === "y1" ? D + out : D + PIER_OUT_MM * MM;
  const pose = placeAt(origin.x, origin.y, rotation, { x: L / 2, y: D / 2 });
  const e = pose.elements;
  const pts = [
    [0, y0],
    [L, y0],
    [L, y1],
    [0, y1],
  ].map(([x, y]) => ({ x: e[0] * x + e[4] * y + e[12], y: e[1] * x + e[5] * y + e[13] }));
  const bounds = frame
    ? frameBounds(frame)
    : { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)), z0: 0, z1: pierTop };
  return (
    <Solo bounds={bounds} cellSize={cellSize} className={["lq-wall", className].filter(Boolean).join(" ")} ariaLabel={holes.length > 0 ? `Mur à ${holes.length} ouvertures` : "Mur"}>
      <WallBody {...props} />
    </Solo>
  );
}

function WallBody(props: WallProps) {
  const { rotation = 0, origin = { x: 0, y: 0 }, dockSide = "y0", piers, pierSpacing = 3, cladding = false } = props;
  const { L, D, sole, top, dockZ, holes, pierTop } = wallLayout(props);
  const key = JSON.stringify([props.length, props.height, props.thickness, props.openings, props.cut, props.dockHeight, props.base, dockSide, piers, pierSpacing, cladding]);
  const built = useBuilt(() => {
    const b = new Builder();
    const nose = DOCK_NOSE_MM * MM;

    // ---- Les panneaux : trumeaux, linteaux, allèges ----
    let from = 0;
    for (const h of holes) {
      if (h.x0 > from) b.box("wall", from, h.x0, 0, D, sole, top);
      const z = Math.min(h.z, top);
      if (z < top) b.box("wall", h.x0, h.x1, 0, D, z, top);
      if (h.z0 > sole) b.box("wall", h.x0, h.x1, 0, D, sole, h.z0);
      from = Math.max(from, h.x1);
    }
    if (from < L) b.box("wall", from, L, 0, D, sole, top);
    // La couvertine, qui court au-dessus de tout et donne au mur son arête franche.
    b.box("wall-cap", 0, L, -0.035, D + 0.035, top - 0.07, top);
    // Le bardage : les joints horizontaux des panneaux, tous les 60 cm, hors des baies.
    if (cladding) {
      const joints: [[number, number, number], [number, number, number]][] = [];
      for (let z = sole + 0.3; z < top - 0.1; z += 0.3)
        for (const y of [-0.002, D + 0.002]) {
          let x = 0;
          for (const h of holes) {
            if (z > h.z0 && z < h.z) {
              if (h.x0 > x) joints.push([[x, y, z], [h.x0, y, z]]);
              x = Math.max(x, h.x1);
            }
          }
          if (x < L) joints.push([[x, y, z], [L, y, z]]);
        }
      b.lines("lq-trailer__line", joints);
    }

    // ---- Les poteaux ----
    const pierW = PIER_W_MM * MM;
    const pierOut = PIER_OUT_MM * MM;
    const pierMode = piers === true ? "spaced" : piers === false ? "none" : (piers ?? (holes.length > 0 ? "ends" : "spaced"));
    if (pierMode !== "none") {
      const xs = [0, L - pierW];
      if (pierMode === "spaced") for (let x = pierSpacing; x < L - pierW; x += Math.max(0.5, pierSpacing)) xs.push(x - pierW / 2);
      for (const x of [...new Set(xs.map((v) => Math.max(0, Math.min(L - pierW, v))))]) b.box("wall", x, x + pierW, -pierOut, D + pierOut, sole, pierTop);
    }

    // ---- Les garnitures : portes, fenêtres, baies ----
    for (const h of holes) {
      if (!h.kind) continue;
      const f = 0.045;
      const mid = D / 2;
      const zt = Math.min(h.z, top);
      // L'huisserie ou le dormant : deux montants, une traverse haute, et une basse hors porte.
      b.box("frame", h.x0, h.x0 + f, mid - 0.05, mid + 0.05, h.z0, zt);
      b.box("frame", h.x1 - f, h.x1, mid - 0.05, mid + 0.05, h.z0, zt);
      b.box("frame", h.x0, h.x1, mid - 0.05, mid + 0.05, zt - f, zt);
      if (h.kind !== "door") b.box("frame", h.x0, h.x1, mid - 0.05, mid + 0.05, h.z0, h.z0 + f);
      if (h.kind === "door") {
        // Le vantail plein, son oculus, sa poignée de chaque côté.
        b.box("door-leaf", h.x0 + f, h.x1 - f, mid - 0.02, mid + 0.02, h.z0, zt - f);
        for (const y of [mid - 0.021, mid + 0.021]) {
          b.faceY("lq-building__window", y, (h.x0 + h.x1) / 2 - 0.08, (h.x0 + h.x1) / 2 + 0.08, h.z0 + (zt - h.z0) * 0.6, h.z0 + (zt - h.z0) * 0.85, true);
        }
        b.box("chrome", h.x1 - f - 0.1, h.x1 - f - 0.04, mid - 0.06, mid + 0.06, h.z0 + 0.48, h.z0 + 0.51, false);
      } else {
        b.box("glass-tint", h.x0 + f, h.x1 - f, mid - 0.008, mid + 0.008, h.z0 + f, zt - f, false);
        // Les montants : un meneau pour une fenêtre, un tous les 60 cm pour une baie, et l'imposte.
        const step = h.kind === "bay" ? 0.6 : (h.x1 - h.x0) / 2;
        for (let x = h.x0 + step; x < h.x1 - 0.1; x += step) b.box("frame", x - 0.02, x + 0.02, mid - 0.03, mid + 0.03, h.z0, zt);
        if (h.kind === "bay") {
          const zi = h.z0 + (zt - h.z0) * 0.8;
          b.box("frame", h.x0, h.x1, mid - 0.03, mid + 0.03, zi - 0.02, zi + 0.02);
        } else {
          // L'appui de fenêtre, en saillie des deux côtés.
          b.box("kerb", h.x0 - 0.04, h.x1 + 0.04, -0.06, D + 0.06, h.z0 - 0.04, h.z0);
        }
      }
    }

    // ---- Le quai ----
    const hasDock = holes.some((h) => h.dock);
    const outSign = dockSide === "y0" ? -1 : 1;
    const face = dockSide === "y0" ? 0 : D;
    const span = (depth: number): [number, number] => (outSign < 0 ? [face - depth, face] : [face, face + depth]);
    if (dockZ > sole && hasDock) {
      const [a0, a1] = span(nose);
      b.box("wall", 0, L, a0, a1, sole, dockZ);
    }

    for (const h of holes) {
      if (!h.dock) continue;
      const z = Math.min(h.z, top);
      if (h.z0 >= z) continue;
      const jambW = JAMB_MM * MM;
      const frameT = SHROUD_T_MM * MM;
      const [sy0, sy1] = span(SHROUD_MM * MM);
      // La casquette : deux piédroits et un linteau sombres, en saillie de 600 mm.
      b.box("dock", h.x0 - frameT, h.x0, sy0, sy1, h.z0, z + frameT);
      b.box("dock", h.x1, h.x1 + frameT, sy0, sy1, h.z0, z + frameT);
      b.box("dock", h.x0 - frameT, h.x1 + frameT, sy0, sy1, z, z + frameT);
      // Les jambages de béton, dans le tableau.
      b.box("wall", h.x0, h.x0 + jambW, 0, D, h.z0, z);
      b.box("wall", h.x1 - jambW, h.x1, 0, D, h.z0, z);
      // Le tablier : il remonte avec `open`, en gardant ses refends.
      const px0 = h.x0 + jambW;
      const px1 = h.x1 - jambW;
      const clear = (z - h.z0) * h.open;
      const lz0 = h.z0 + clear;
      const lz1 = z - 0.01;
      const leafY = D / 2;
      if (lz1 - lz0 > 0.02) {
        b.box("dock-leaf", px0, px1, leafY - 0.02, leafY + 0.02, lz0, lz1);
        // La bande de sécurité au bas du tablier : jaune, en léger relief — elle se voit de loin et
        // dit où la porte s'arrête.
        const band = Math.min(0.16, (lz1 - lz0) * 0.3);
        b.box("safety", px0, px1, leafY - 0.028, leafY + 0.028, lz0, lz0 + band);
        const n = Math.max(1, Math.round((lz1 - lz0) / 0.22));
        const segs: [[number, number, number], [number, number, number]][] = [];
        for (let i = 1; i < n; i += 1) {
          const zz = lz0 + ((lz1 - lz0) * i) / n;
          for (const yy of [leafY - 0.021, leafY + 0.021]) segs.push([[px0, yy, zz], [px1, yy, zz]]);
        }
        b.lines("lq-wall__section", segs);
        // Les deux hublots, s'ils sont encore sous le linteau.
        const zc = lz0 + (lz1 - lz0) * 0.6;
        if (lz1 - lz0 > 0.4)
          for (const f of [0.28, 0.56]) {
            const a = px0 + (px1 - px0) * f;
            for (const yy of [leafY - 0.022, leafY + 0.022]) b.faceY("lq-wall__pane", yy, a, a + (px1 - px0) * 0.16, zc, zc + 0.09, true);
          }
      }
      // Le niveleur : une tôle au seuil, qui franchit le jeu entre le quai et le plancher de la
      // remorque.
      const [ly0, ly1] = span(nose);
      b.box("leveller", px0, px1, Math.min(ly0, face), Math.max(ly1, face), h.z0 - 0.02, h.z0 + 0.005);
      // Ses deux rives peintes en jaune, comme sur un vrai quai.
      for (const ex of [px0, px1 - 0.06]) b.box("safety", ex, ex + 0.06, Math.min(ly0, face), Math.max(ly1, face), h.z0 + 0.005, h.z0 + 0.012);
      // Les butoirs, sur le nez du quai.
      const bw = BUMPER_W_MM * MM;
      const bh = BUMPER_H_MM * MM;
      const [by0, by1] = span(nose + 0.05);
      if (h.z0 - bh - 0.04 >= sole) for (const bx of [h.x0 + jambW * 0.2, h.x1 - jambW * 0.2 - bw]) b.box("dock", bx, bx + bw, by0, by1, h.z0 - bh - 0.04, h.z0 - 0.04);
      // Les poteaux de protection, plantés dans la cour : de vrais tubes, avec leur calotte.
      if (dockZ > sole) {
        const bd = BOLLARD_D_MM * MM;
        const bz = BOLLARD_H_MM * MM;
        const py = outSign < 0 ? face - nose - 0.22 : face + nose + 0.22;
        for (const bx of [h.x0 - frameT * 0.5, h.x1 + frameT * 0.5]) {
          b.cylinder("safety", bx, py, sole + bz / 2, bd / 2, bz, "z", 14);
          b.cylinder("safety", bx, py, sole + bz + 0.012, bd / 2 * 0.7, 0.024, "z", 14, bd / 2);
        }
      }
    }
    return b.build();
  }, [key]);

  const pose = placeAt(origin.x, origin.y, rotation, { x: L / 2, y: D / 2 });
  return (
    <group matrixAutoUpdate={false} matrix={pose}>
      <Parts built={built} />
    </group>
  );
}
