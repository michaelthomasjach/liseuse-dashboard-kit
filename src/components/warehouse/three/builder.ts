import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  Shape,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Le constructeur de volumes : ce que les modules emploient pour **décrire** leur géométrie.
 *
 * ## Pourquoi un constructeur, et pas un maillage par pièce
 *
 * Un camion compte une centaine de pièces, une travée d'étagères plusieurs centaines, un
 * entrepôt de jeu plusieurs milliers. Un maillage par pièce, c'est un appel de dessin par pièce —
 * et c'est ce qui fait tomber une scène sous les vingt images par seconde bien avant la carte
 * graphique elle-même. Le constructeur ramasse les pièces, les pose à leur place, et **les fond en
 * un seul maillage par matière** : un camion entier se dessine en une dizaine d'appels, quel que
 * soit son détail. On peut donc ajouter du détail sans le payer en fluidité.
 *
 * ## Le vocabulaire
 *
 * Celui du dessin isométrique, en coordonnées monde : une boîte par ses deux coins, un prisme
 * monté sur un contour au sol, un **profil** extrudé en travers — la silhouette de côté d'une
 * cabine, qui donne d'un seul geste la pente d'un pare-brise —, un cylindre, une pièce rapportée
 * sur une face, un trait. Chaque volume est cerné de ses arêtes franches, qui sont l'identité du
 * dessin ; les arêtes molles d'un congé ou d'un cylindre ne le sont pas, sans quoi un arrondi se
 * lirait comme une hachure.
 */

export type P2 = { x: number; y: number };
export type P3 = [number, number, number];

/** Au-delà de cet angle entre deux faces, une arête est franche et se trace. */
const EDGE_ANGLE = 28;

export interface Built {
  /** Un maillage par matière de volume (`lq-iso__solid--<nom>`). */
  solids: Map<string, BufferGeometry>;
  /** Un maillage par pièce rapportée (sa classe CSS). */
  decals: Map<string, BufferGeometry>;
  /** Les arêtes des volumes, fondues. */
  edges: BufferGeometry | null;
  /** Les traits dessinés, par classe. */
  strokes: Map<string, BufferGeometry>;
}

const UNIT_BOX = new BoxGeometry(1, 1, 1).toNonIndexed();

function plain(g: BufferGeometry): BufferGeometry {
  // Les géométries se fondent si elles portent les mêmes attributs : on les ramène toutes à la même
  // forme — sans index, position et normale seulement.
  const n = g.index ? g.toNonIndexed() : g;
  const out = new BufferGeometry();
  out.setAttribute("position", n.getAttribute("position"));
  if (!n.getAttribute("normal")) n.computeVertexNormals();
  out.setAttribute("normal", n.getAttribute("normal"));
  return out;
}

/**
 * Retourner l'enroulement des triangles.
 *
 *  Une transformation de déterminant négatif — une réflexion, comme celle qui couche un profil
 *  dessiné dans `(x, y)` sur le plan `(x, z)` — retourne chaque triangle : le moteur prendrait
 *  l'extérieur pour l'intérieur et ne montrerait que le dedans du volume. Les normales, elles,
 *  sont déjà justes, la matrice des normales s'en charge ; seul l'ordre des sommets est à défaire.
 */
function flipWinding(g: BufferGeometry) {
  for (const name of ["position", "normal"]) {
    const a = g.getAttribute(name);
    if (!a) continue;
    const arr = a.array as Float32Array;
    for (let t = 0; t < a.count; t += 3) {
      for (let k = 0; k < 3; k += 1) {
        const i = (t + 1) * 3 + k;
        const j = (t + 2) * 3 + k;
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
    }
    a.needsUpdate = true;
  }
}

export class Builder {
  private solids = new Map<string, BufferGeometry[]>();
  private decals = new Map<string, BufferGeometry[]>();
  private edgeParts: number[] = [];
  private strokeParts = new Map<string, number[]>();
  private stack: Matrix4[] = [new Matrix4()];

  /** La transformation courante : tout ce qu'on ajoute y passe. */
  private get m(): Matrix4 {
    return this.stack[this.stack.length - 1];
  }

  /** Empiler une transformation — un module tourné, une pièce qu'on place — et la retirer. */
  push(t: Matrix4): this {
    this.stack.push(this.m.clone().multiply(t));
    return this;
  }
  pop(): this {
    if (this.stack.length > 1) this.stack.pop();
    return this;
  }
  /** Poser et tourner autour de la verticale, le temps d'un bloc. */
  within(t: Matrix4, fn: () => void): this {
    this.push(t);
    fn();
    return this.pop();
  }

  private addSolid(mat: string, g: BufferGeometry, edges: boolean | BufferGeometry, local?: Matrix4) {
    const m = local ? this.m.clone().multiply(local) : this.m;
    const p = plain(g.clone());
    p.applyMatrix4(m);
    if (m.determinant() < 0) flipWinding(p);
    const list = this.solids.get(mat) ?? [];
    list.push(p);
    this.solids.set(mat, list);
    if (edges) {
      const e = edges === true ? new EdgesGeometry(g, EDGE_ANGLE) : edges;
      const pos = e.getAttribute("position");
      const v = new Vector3();
      for (let i = 0; i < pos.count; i += 1) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m);
        this.edgeParts.push(v.x, v.y, v.z);
      }
      if (edges === true) e.dispose();
    }
  }

  /** Une boîte, par ses deux coins. */
  box(mat: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, edges = true): this {
    const sx = Math.max(1e-4, Math.abs(x1 - x0));
    const sy = Math.max(1e-4, Math.abs(y1 - y0));
    const sz = Math.max(1e-4, Math.abs(z1 - z0));
    const local = new Matrix4().makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2).multiply(new Matrix4().makeScale(sx, sy, sz));
    const m = this.m.clone().multiply(local);
    const g = plain(UNIT_BOX.clone().applyMatrix4(m));
    if (m.determinant() < 0) flipWinding(g);
    const list = this.solids.get(mat) ?? [];
    list.push(g);
    this.solids.set(mat, list);
    if (edges) {
      // Les douze arêtes d'une boîte, écrites directement : plus sûr et moins coûteux que de les
      // faire retrouver par une analyse d'angles.
      const c = [
        [-0.5, -0.5, -0.5],
        [0.5, -0.5, -0.5],
        [0.5, 0.5, -0.5],
        [-0.5, 0.5, -0.5],
        [-0.5, -0.5, 0.5],
        [0.5, -0.5, 0.5],
        [0.5, 0.5, 0.5],
        [-0.5, 0.5, 0.5],
      ].map(([x, y, z]) => new Vector3(x, y, z).applyMatrix4(m));
      const pairs = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
      for (const i of pairs) this.edgeParts.push(c[i].x, c[i].y, c[i].z);
    }
    return this;
  }

  /**
   * Un volume à huit coins libres : quatre en bas, quatre en haut, dans le même ordre.
   *
   *  C'est la forme d'une dalle en pente, d'une rampe, d'un coin de chute — tout ce qui a six faces
   *  planes sans en avoir deux parallèles. Chaque face est orientée vers l'extérieur d'après le
   *  centre du volume, si bien que l'ordre dans lequel on tourne autour importe peu.
   */
  hexa(mat: string, c: P3[], edges = true): this {
    if (c.length !== 8) return this;
    const v = c.map((p) => new Vector3(...p).applyMatrix4(this.m));
    const center = v.reduce((a, b) => a.clone().add(b), new Vector3()).multiplyScalar(1 / 8);
    const faces = [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [1, 2, 6, 5],
      [2, 3, 7, 6],
      [3, 0, 4, 7],
    ];
    const pos: number[] = [];
    const tri = (a: Vector3, b: Vector3, d: Vector3, mid: Vector3) => {
      const n = b.clone().sub(a).cross(d.clone().sub(a));
      if (n.lengthSq() < 1e-12) return;
      const out = n.dot(mid.clone().sub(center)) >= 0;
      const [p, q] = out ? [b, d] : [d, b];
      pos.push(a.x, a.y, a.z, p.x, p.y, p.z, q.x, q.y, q.z);
    };
    for (const f of faces) {
      const q = f.map((i) => v[i]);
      const mid = q.reduce((a, b) => a.clone().add(b), new Vector3()).multiplyScalar(0.25);
      tri(q[0], q[1], q[2], mid);
      tri(q[0], q[2], q[3], mid);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const list = this.solids.get(mat) ?? [];
    list.push(g);
    this.solids.set(mat, list);
    if (edges) {
      const pairs = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
      for (const i of pairs) this.edgeParts.push(v[i].x, v[i].y, v[i].z);
    }
    return this;
  }

  /** Un prisme : un contour au sol, monté de `z0` à `z1`. */
  prism(mat: string, ring: P2[], z0: number, z1: number, edges = true): this {
    if (ring.length < 3 || z1 <= z0) return this;
    const g = new ExtrudeGeometry(new Shape(ring.map((p) => ({ x: p.x, y: p.y }) as never)), { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, z0);
    this.addSolid(mat, g, edges);
    g.dispose();
    return this;
  }

  /**
   * Un profil extrudé en travers : une silhouette dans le plan `(x, z)`, épaissie de `y0` à `y1`.
   *
   *  C'est le geste qui manquait au dessin isométrique. Une cabine de camion, un toit à deux pans,
   *  une rampe, une chute : leur forme se dit de côté, et monter un pare-brise incliné en couches
   *  horizontales donnait un escalier qu'il fallait ensuite cacher. Vu de côté, c'est un polygone,
   *  et un polygone s'extrude. `bevel` en adoucit les arêtes sans changer le contour extérieur.
   */
  profile(mat: string, pts: P2[], y0: number, y1: number, opts: { bevel?: number; edges?: boolean } = {}): this {
    if (pts.length < 3 || y1 <= y0) return this;
    const bevel = Math.max(0, Math.min(opts.bevel ?? 0, (y1 - y0) / 2 - 1e-3));
    const g = new ExtrudeGeometry(new Shape(pts.map((p) => ({ x: p.x, y: p.y }) as never)), {
      depth: Math.max(1e-4, y1 - y0 - 2 * bevel),
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelOffset: -bevel,
      bevelSegments: bevel > 0 ? 2 : 0,
      curveSegments: 1,
    });
    // Le profil est dessiné dans (x, y) et extrudé selon z ; on le couche : son y devient la
    // hauteur, son extrusion la largeur.
    const local = new Matrix4().makeTranslation(0, y0 + bevel, 0).multiply(new Matrix4().makeRotationX(Math.PI / 2)).multiply(new Matrix4().makeScale(1, 1, -1));
    this.addSolid(mat, g, opts.edges ?? true, local);
    g.dispose();
    return this;
  }

  /** Un cylindre : une roue, un poteau, un fût. `axis` dit le long de quoi il s'allonge. */
  cylinder(mat: string, x: number, y: number, z: number, r: number, length: number, axis: "x" | "y" | "z" = "z", segments = 20, r2?: number, edges = true): this {
    const g = new CylinderGeometry(r2 ?? r, r, Math.max(1e-4, length), segments, 1, false);
    const rot = axis === "z" ? new Matrix4().makeRotationX(Math.PI / 2) : axis === "x" ? new Matrix4().makeRotationZ(-Math.PI / 2) : new Matrix4();
    const local = new Matrix4().makeTranslation(x, y, z).multiply(rot);
    this.addSolid(mat, g, edges, local);
    g.dispose();
    return this;
  }

  /** Une poutre de section carrée `2·half`, tendue de `a` à `b` : un segment de bras, un hauban. */
  beam(mat: string, a: P3, b: P3, half: number, edges = true): this {
    const va = new Vector3(...a);
    const vb = new Vector3(...b);
    const d = vb.clone().sub(va);
    const len = d.length();
    if (len < 1e-5) return this;
    const q = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), d.clone().normalize());
    const local = new Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new Vector3(len, half * 2, half * 2));
    this.push(local);
    this.box(mat, -0.5, 0.5, -0.5, 0.5, -0.5, 0.5, edges);
    return this.pop();
  }

  /** Un cône, pointe vers le haut. */
  cone(mat: string, x: number, y: number, z0: number, r: number, h: number, segments = 8): this {
    const g = new ConeGeometry(r, h, segments, 1);
    const local = new Matrix4().makeTranslation(x, y, z0 + h / 2).multiply(new Matrix4().makeRotationX(Math.PI / 2));
    this.addSolid(mat, g, true, local);
    g.dispose();
    return this;
  }

  /** Une boule à facettes : un feuillage, une tête. `detail` 0 ou 1, jamais lisse. */
  blob(mat: string, x: number, y: number, z: number, r: number, detail = 1, squash = 1): this {
    const g = detail < 0 ? new SphereGeometry(r, 10, 6) : new IcosahedronGeometry(r, detail);
    const local = new Matrix4().makeTranslation(x, y, z).multiply(new Matrix4().makeScale(1, 1, squash));
    this.addSolid(mat, g, true, local);
    g.dispose();
    return this;
  }

  /** Une pièce rapportée : un polygone plan posé sur une face, triangulé en éventail. */
  decal(cls: string, pts: P3[], outline = false): this {
    if (pts.length < 3) return this;
    const pos: number[] = [];
    const v = pts.map((p) => new Vector3(...p).applyMatrix4(this.m));
    for (let i = 1; i + 1 < v.length; i += 1) pos.push(v[0].x, v[0].y, v[0].z, v[i].x, v[i].y, v[i].z, v[i + 1].x, v[i + 1].y, v[i + 1].z);
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const list = this.decals.get(cls) ?? [];
    list.push(g);
    this.decals.set(cls, list);
    if (outline) {
      const segs: [P3, P3][] = pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
      this.lines(cls, segs);
    }
    return this;
  }

  /** Un rectangle posé à plat sur une face verticale d'abscisse constante. */
  faceX(cls: string, x: number, y0: number, y1: number, z0: number, z1: number, outline = false): this {
    return this.decal(cls, [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]], outline);
  }
  /** Un rectangle posé à plat sur une face verticale d'ordonnée constante. */
  faceY(cls: string, y: number, x0: number, x1: number, z0: number, z1: number, outline = false): this {
    return this.decal(cls, [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], outline);
  }
  /** Un rectangle posé à plat sur le sol ou sur un dessus. */
  faceZ(cls: string, z: number, x0: number, x1: number, y0: number, y1: number, outline = false): this {
    return this.decal(cls, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], outline);
  }

  /** Des traits. */
  lines(cls: string, segs: [P3, P3][]): this {
    const list = this.strokeParts.get(cls) ?? [];
    const v = new Vector3();
    for (const [a, b] of segs) {
      v.set(...a).applyMatrix4(this.m);
      list.push(v.x, v.y, v.z);
      v.set(...b).applyMatrix4(this.m);
      list.push(v.x, v.y, v.z);
    }
    this.strokeParts.set(cls, list);
    return this;
  }

  /** Tout fondre : un maillage par matière, un tracé par classe de trait. */
  build(): Built {
    const merge = (list: BufferGeometry[]) => {
      const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (list.length > 1) for (const p of list) p.dispose();
      return g;
    };
    const solids = new Map<string, BufferGeometry>();
    for (const [k, list] of this.solids) solids.set(k, merge(list));
    const decals = new Map<string, BufferGeometry>();
    for (const [k, list] of this.decals) decals.set(k, merge(list));
    const strokes = new Map<string, BufferGeometry>();
    for (const [k, list] of this.strokeParts) {
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(list, 3));
      strokes.set(k, g);
    }
    let edges: BufferGeometry | null = null;
    if (this.edgeParts.length > 0) {
      edges = new BufferGeometry();
      edges.setAttribute("position", new Float32BufferAttribute(this.edgeParts, 3));
    }
    return { solids, decals, edges, strokes };
  }
}

/** Se poser à `(x, y)` et tourner de `deg` autour de la verticale, pivot compris. */
export function placeAt(x: number, y: number, deg = 0, pivot: P2 = { x: 0, y: 0 }): Matrix4 {
  return new Matrix4()
    .makeTranslation(x + pivot.x, y + pivot.y, 0)
    .multiply(new Matrix4().makeRotationZ((deg * Math.PI) / 180))
    .multiply(new Matrix4().makeTranslation(-pivot.x, -pivot.y, 0));
}

/** Un contour de rectangle aux angles arrondis, en `steps` pas par angle. */
export function roundedRect(x0: number, x1: number, y0: number, y1: number, radius: number, steps = 3): P2[] {
  const r = Math.max(0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
  if (r === 0)
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ];
  const pts: P2[] = [];
  const corners: [number, number, number][] = [
    [x1 - r, y0 + r, -90],
    [x1 - r, y1 - r, 0],
    [x0 + r, y1 - r, 90],
    [x0 + r, y0 + r, 180],
  ];
  for (const [cx, cy, start] of corners)
    for (let k = 0; k <= steps; k += 1) {
      const a = ((start + (90 * k) / steps) * Math.PI) / 180;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  return pts;
}

/** Un arc de couronne dans le plan `(x, z)` : l'entre-deux de deux cercles, de `a0` à `a1`. */
export function annulus(cx: number, cz: number, ri: number, ro: number, a0: number, a1: number, steps = 16): P2[] {
  const out: P2[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push({ x: cx + ro * Math.cos(a), y: cz + ro * Math.sin(a) });
  }
  for (let i = steps; i >= 0; i -= 1) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push({ x: cx + ri * Math.cos(a), y: cz + ri * Math.sin(a) });
  }
  return out;
}
