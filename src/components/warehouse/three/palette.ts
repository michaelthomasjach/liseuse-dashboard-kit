import { createContext, useContext } from "react";
import { Color, DataTexture, DoubleSide, FrontSide, LineBasicMaterial, MeshToonMaterial, NearestFilter, RedFormat, type Material } from "three";

/**
 * Les matières de l'entrepôt 3D, **lues dans le CSS** et rendues **à la manière d'une encre**.
 *
 * ## Pourquoi le CSS, et pas une table
 *
 * Un matériau WebGL veut une couleur ; la feuille de style ne donne pas des couleurs mais des
 * calculs — `color-mix(in srgb, var(--lq-color-text) 58%, var(--lq-color-bg))` — dont les termes
 * changent avec le thème, et que la palette e-ink fait s'effondrer sur deux teintes. Les recopier
 * en JavaScript les figerait au premier thème. On demande donc au navigateur : une sonde invisible,
 * posée dans le conteneur de la scène — sous les mêmes variables et les mêmes sélecteurs — reçoit
 * les classes des modules et rend ce que `getComputedStyle` en dit. Le CSS reste la seule source,
 * et la surface sombre de la liseuse marche sans une ligne de plus.
 *
 * ## Pourquoi des paliers, et pas un dégradé
 *
 * Une lumière 3D ordinaire donne des dégradés continus : un cylindre passe du clair au sombre par
 * mille nuances, et sur un écran à encre électronique — seize niveaux de gris, un rafraîchissement
 * qui tramera tout ce qui est fin — ce dégradé devient une bouillie. Le dessin isométrique avait
 * trois tons par volume : dessus, face, côté. On garde cette discipline : le matériau est un
 * **ombrage à paliers** (`MeshToonMaterial`), qui range l'éclairage en trois tons nets. Un volume
 * lu en 3D reste lisible comme une gravure, et un cylindre a trois pans de lumière au lieu d'un
 * modelé.
 */

const NS = "http://www.w3.org/2000/svg";

/** Une couleur calculée telle que le navigateur la rend : `rgb()`, ou `color(srgb …)` pour ce qui
 *  passe par `color-mix` — forme que `three` ne sait pas lire. */
export function parseCss(css: string): { color: Color; alpha: number } | null {
  const v = css.trim();
  if (!v || v === "none" || v === "transparent") return null;
  const srgb = /color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e%-]+))?\)/.exec(v);
  if (srgb) {
    const a = srgb[4] === undefined ? 1 : srgb[4].endsWith("%") ? parseFloat(srgb[4]) / 100 : parseFloat(srgb[4]);
    return { color: new Color().setRGB(parseFloat(srgb[1]), parseFloat(srgb[2]), parseFloat(srgb[3]), "srgb"), alpha: a };
  }
  const rgb = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.%]+))?\s*\)/.exec(v);
  if (rgb) {
    const a = rgb[4] === undefined ? 1 : rgb[4].endsWith("%") ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
    return { color: new Color().setRGB(+rgb[1] / 255, +rgb[2] / 255, +rgb[3] / 255, "srgb"), alpha: a };
  }
  try {
    return { color: new Color(v), alpha: 1 };
  } catch {
    return null;
  }
}

/**
 * Les trois paliers de l'ombrage.
 *
 *  Ce sont ceux du dessin : la face au soleil prend la couleur pleine, la face de biais un ton
 *  plus bas, la face à l'ombre deux. Un texel par palier et un filtrage au plus proche — sans quoi
 *  le moteur interpolerait entre eux et on retrouverait le dégradé qu'on voulait chasser.
 */
function tones(): DataTexture {
  const data = new Uint8Array([150, 205, 255]);
  const t = new DataTexture(data, 3, 1, RedFormat);
  t.minFilter = NearestFilter;
  t.magFilter = NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

export interface Palette {
  /** La matière d'un volume par son nom : `"cab"`, `"iron"`, `"wall"`… — la classe
   *  `lq-iso__solid--<nom>` du CSS. */
  solid: (name: string) => Material;
  /** Une pièce rapportée sur une face — vitrage, calandre, feu, marquage — par sa classe CSS. */
  decal: (cls: string) => Material;
  /** Le trait d'une classe. */
  stroke: (cls: string) => LineBasicMaterial;
  /** Le trait qui cerne les volumes. */
  edge: LineBasicMaterial;
  /** La couleur du fond de page, pour ce qui doit s'y fondre. */
  paper: Color;
  /** La couleur de l'encre. */
  ink: Color;
  dispose: () => void;
}

export function createPalette(host: HTMLElement): Palette {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  host.appendChild(svg);

  const probe = (chain: string[], tag = "polygon") => {
    let parent: Element = svg;
    for (const cls of chain.slice(0, -1)) {
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", cls);
      parent.appendChild(g);
      parent = g;
    }
    const leaf = document.createElementNS(NS, tag);
    leaf.setAttribute("class", chain[chain.length - 1]);
    parent.appendChild(leaf);
    const cs = getComputedStyle(leaf);
    const out = { fill: cs.fill, stroke: cs.stroke, color: getComputedStyle(host).color, bg: getComputedStyle(host).getPropertyValue("--lq-color-bg") };
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    return out;
  };

  const gradientMap = tones();
  const cache = new Map<string, Material>();
  const lines = new Map<string, LineBasicMaterial>();
  const outline = parseCss(probe(["lq-iso__outline"]).stroke);
  const edge = new LineBasicMaterial({ color: outline?.color ?? new Color("#333"), transparent: (outline?.alpha ?? 1) < 1, opacity: outline?.alpha ?? 1 });
  const base = probe(["lq-iso__outline"]);
  const ink = parseCss(base.color)?.color ?? new Color("#111");
  const paper = parseCss(base.bg)?.color ?? new Color("#f1eee6");

  const toon = (color: Color, opts: { decal?: boolean; alpha?: number } = {}) =>
    new MeshToonMaterial({
      color,
      gradientMap,
      side: opts.decal ? DoubleSide : FrontSide,
      transparent: (opts.alpha ?? 1) < 1,
      opacity: opts.alpha ?? 1,
      // Une pièce rapportée est posée **sur** une face : sans ce décalage, elle se disputerait le
      // même pixel avec elle et scintillerait à chaque cap.
      polygonOffset: opts.decal === true,
      polygonOffsetFactor: opts.decal ? -2 : 0,
      polygonOffsetUnits: opts.decal ? -2 : 0,
    });

  return {
    solid(name) {
      const key = `s:${name}`;
      let m = cache.get(key);
      if (m) return m;
      const face = parseCss(probe([`lq-iso__solid lq-iso__solid--${name}`, "lq-iso__face lq-iso__face--top"]).fill);
      m = toon(face?.color ?? new Color("#bdbab4"));
      cache.set(key, m);
      return m;
    },
    decal(cls) {
      const key = `d:${cls}`;
      let m = cache.get(key);
      if (m) return m;
      const fill = parseCss(probe([cls]).fill);
      m = toon(fill?.color ?? new Color("#777"), { decal: true, alpha: fill?.alpha });
      cache.set(key, m);
      return m;
    },
    stroke(cls) {
      let m = lines.get(cls);
      if (m) return m;
      const s = parseCss(probe([cls], "line").stroke);
      m = s ? new LineBasicMaterial({ color: s.color, transparent: s.alpha < 1, opacity: s.alpha }) : edge;
      lines.set(cls, m);
      return m;
    },
    edge,
    ink,
    paper,
    dispose() {
      svg.remove();
      for (const m of cache.values()) m.dispose();
      for (const m of lines.values()) if (m !== edge) m.dispose();
      edge.dispose();
      gradientMap.dispose();
    },
  };
}

export const PaletteContext = createContext<Palette | null>(null);

export function usePalette(): Palette {
  const p = useContext(PaletteContext);
  if (p === null) throw new Error("usePalette : hors d'une scène d'entrepôt");
  return p;
}
