import { Fragment, isValidElement, useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";

/**
 * Le rendu des modules d'entrepôt, **sur un canvas**.
 *
 * ## Pourquoi un peintre d'arbre plutôt qu'une réécriture
 *
 * Chaque module d'entrepôt décide de ce qui passe devant quoi en **émettant ses facettes dans
 * l'ordre** : `alongX` range en longueur, `acrossY` en travers, `stackedVolume` couche par couche.
 * Cet ordre n'est écrit nulle part ailleurs que dans l'ordre du document — c'est exactement ce que
 * SVG peint, et c'est exactement ce que peint un canvas. Le porter revient donc à changer la
 * surface, pas le dessin : on parcourt l'arbre d'éléments **sans jamais le monter dans le DOM**, et
 * on trace ce qu'on rencontre, dans l'ordre où on le rencontre. Pas une ligne de géométrie ne
 * bouge, donc pas un ordre de peinture n'est remis en jeu.
 *
 * ## Pourquoi les couleurs viennent du CSS et non d'une table
 *
 * Un canvas ne connaît pas les classes : il veut une couleur. La tentation est de recopier les
 * règles en JavaScript — et c'est le piège, parce que ces règles ne sont pas des couleurs mais des
 * *calculs* : `color-mix(in srgb, var(--lq-color-text) 58%, var(--lq-color-bg))`, dont les deux
 * termes changent avec le thème, et que la palette e-ink fait par ailleurs s'effondrer sur une
 * seule teinte. Une table JavaScript serait juste le jour où on l'écrit et fausse au premier thème
 * ajouté.
 *
 * On demande donc au navigateur. Une sonde invisible, **posée dans le même conteneur** donc sous
 * les mêmes variables et les mêmes sélecteurs d'ancêtre, reçoit la chaîne de classes rencontrée et
 * rend ce que `getComputedStyle` en dit. Le CSS reste la seule source, et un thème ajouté demain
 * marchera sans qu'on touche à ce fichier. Le coût — une mesure par combinaison de classes — est
 * payé une fois : il y en a une poignée par module, et le résultat est mis en cache.
 */

const NS = "http://www.w3.org/2000/svg";

/**
 * Les animations, **interprétées** plutôt que réécrites.
 *
 *  Trois modules bougent — le chariot lève ses fourches, le tapis fait défiler ses colis, le picker
 *  parcourt son rail — et ils le disent en CSS : des `@keyframes` posées dans un `<defs><style>`, et
 *  un `animationName` sur le groupe qui bouge. Un canvas ignore tout cela : il n'a pas de feuille
 *  de style, rien qu'un contexte et une horloge.
 *
 *  La tentation est de porter chaque module à la main, en recalculant sa pose à partir d'un temps.
 *  C'est trois fois le même travail, et trois occasions de faire diverger le dessin de sa
 *  description. Or ces keyframes parlent une langue minuscule : `transform: translate(x, y)` et
 *  `opacity: n`, rien d'autre. Il est donc plus court — et plus sûr — de **lire** ce que le module
 *  a déjà écrit : on ramasse les `@keyframes` de l'arbre, et à chaque frame on interpole entre les
 *  deux arrêts qui encadrent l'instant. La description de l'animation reste là où elle était, dans
 *  le module, et elle sert aux deux surfaces.
 */

interface Stop {
  at: number;
  translate: [number, number] | null;
  opacity: number | null;
}

const KEYFRAMES = /@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\}\s*(?=@keyframes|$)/g;
const STOP = /([\d.%,\s]+?)\s*\{([^}]*)\}/g;

function parseKeyframes(css: string, into: Map<string, Stop[]>) {
  let k: RegExpExecArray | null;
  KEYFRAMES.lastIndex = 0;
  while ((k = KEYFRAMES.exec(css)) !== null) {
    const stops: Stop[] = [];
    let m: RegExpExecArray | null;
    STOP.lastIndex = 0;
    while ((m = STOP.exec(k[2])) !== null) {
      const decl = m[2];
      const tr = /transform\s*:\s*translate\(\s*(-?[\d.]+)[a-z%]*\s*,\s*(-?[\d.]+)[a-z%]*\s*\)/.exec(decl);
      const op = /opacity\s*:\s*([\d.]+)/.exec(decl);
      const translate: [number, number] | null = tr ? [parseFloat(tr[1]), parseFloat(tr[2])] : null;
      const opacity = op ? parseFloat(op[1]) : null;
      // « 0%, 100% { … } » : un même arrêt pour plusieurs instants.
      for (const part of m[1].split(",")) {
        const at = parseFloat(part);
        if (!Number.isNaN(at)) stops.push({ at: at / 100, translate, opacity });
      }
    }
    stops.sort((a, b) => a.at - b.at);
    if (stops.length > 0) into.set(k[1], stops);
  }
}

/** Une courbe de Bézier cubique d'accélération, résolue pour `x` puis lue en `y`.
 *
 *  Newton sur cinq itérations : l'erreur retombe sous le millième, très en dessous de ce qu'un
 *  pixel peut montrer, et sans la table de correspondance qu'un solveur exact demanderait. */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const curve = (a: number, b: number, t: number) => {
    const u = 1 - t;
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
  };
  const slope = (a: number, b: number, t: number) => {
    const u = 1 - t;
    return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b);
  };
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 5; i += 1) {
      const d = slope(x1, x2, t);
      if (Math.abs(d) < 1e-6) break;
      t -= (curve(x1, x2, t) - x) / d;
    }
    return curve(y1, y2, Math.min(1, Math.max(0, t)));
  };
}

const NAMED: Record<string, (x: number) => number> = {
  linear: (x) => x,
  ease: bezier(0.25, 0.1, 0.25, 1),
  "ease-in": bezier(0.42, 0, 1, 1),
  "ease-out": bezier(0, 0, 0.58, 1),
  "ease-in-out": bezier(0.42, 0, 0.58, 1),
};

function easing(spec: string): (x: number) => number {
  const named = NAMED[spec.trim()];
  if (named) return named;
  const cb = /cubic-bezier\(([^)]*)\)/.exec(spec);
  if (cb) {
    const n = cb[1].split(",").map(Number);
    if (n.length === 4 && n.every((v) => !Number.isNaN(v))) return bezier(n[0], n[1], n[2], n[3]);
  }
  return NAMED.ease;
}

/** La pose d'une piste à un instant du cycle. */
function sample(stops: Stop[], u: number, ease: (x: number) => number) {
  let i = 0;
  while (i < stops.length - 1 && stops[i + 1].at <= u) i += 1;
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  const span = b.at - a.at;
  const k = span > 0 ? ease(Math.min(1, Math.max(0, (u - a.at) / span))) : 0;
  const lerp = (p: number | null, q: number | null) => (p === null ? q : q === null ? p : p + (q - p) * k);
  return {
    translate:
      a.translate === null
        ? b.translate
        : b.translate === null
          ? a.translate
          : ([a.translate[0] + (b.translate[0] - a.translate[0]) * k, a.translate[1] + (b.translate[1] - a.translate[1]) * k] as [number, number]),
    opacity: lerp(a.opacity, b.opacity),
  };
}

interface Resolved {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  fillOpacity: number;
  strokeOpacity: number;
  dash: number[] | null;
  linejoin: CanvasLineJoin;
  linecap: CanvasLineCap;
  /** `vector-effect: non-scaling-stroke` : le trait garde son épaisseur quelle que soit l'échelle
   *  du groupe qui le porte. Sur un canvas il faut le refaire à la main, en divisant l'épaisseur
   *  par l'échelle courante — sans quoi un module mis à l'échelle aurait des traits épaissis. */
  fixedStroke: boolean;
  /** La courbe d'accélération que le CSS donne à l'élément, pour rejouer ses keyframes. */
  timing: string;
}

const NONE = new Set(["none", "transparent", "rgba(0, 0, 0, 0)"]);
const paint = (v: string): string | null => (NONE.has(v.trim()) ? null : v);

function read(cs: CSSStyleDeclaration): Resolved {
  const dash = cs.strokeDasharray;
  return {
    fill: paint(cs.fill || "none"),
    stroke: paint(cs.stroke || "none"),
    strokeWidth: parseFloat(cs.strokeWidth) || 1,
    fillOpacity: cs.fillOpacity === "" ? 1 : Number(cs.fillOpacity),
    strokeOpacity: cs.strokeOpacity === "" ? 1 : Number(cs.strokeOpacity),
    dash: dash && dash !== "none" ? dash.split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n)) : null,
    linejoin: (cs.strokeLinejoin || "miter") as CanvasLineJoin,
    linecap: (cs.strokeLinecap || "butt") as CanvasLineCap,
    fixedStroke: cs.vectorEffect === "non-scaling-stroke",
    timing: cs.animationTimingFunction || "ease",
  };
}

/** La sonde : un `<svg>` de taille nulle dans le conteneur du module, où l'on reconstitue une
 *  chaîne de classes pour lire ce que le CSS en fait. */
function makeProbe(host: HTMLElement) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  host.appendChild(svg);
  const cache = new Map<string, Resolved>();
  return {
    /** `path` est la chaîne d'ancêtres déjà assemblée — la même pour toutes les facettes d'un
     *  groupe, donc assemblée une fois par groupe et non une fois par facette. */
    resolve(path: string, cls: string, tag: string): Resolved {
      const key = `${tag}|${path}>${cls}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const chain = cls ? [...path.split(">").filter(Boolean), cls] : path.split(">").filter(Boolean);
      let parent: Element = svg;
      for (const c of chain) {
        const g = document.createElementNS(NS, "g");
        g.setAttribute("class", c);
        parent.appendChild(g);
        parent = g;
      }
      const leaf = document.createElementNS(NS, tag);
      parent.appendChild(leaf);
      const out = read(getComputedStyle(leaf));
      cache.set(key, out);
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      return out;
    },
    clear() {
      cache.clear();
    },
    destroy() {
      svg.remove();
    },
  };
}

export type StyleProbe = ReturnType<typeof makeProbe>;

/**
 * Les masques, **publiés d'un module à l'autre**.
 *
 *  Le picker publie la silhouette de ses fourches, et l'étagère s'en sert pour se redessiner
 *  par-dessus lui à cet endroit-là — c'est ce qui fait passer les fourches *dans* l'alvéole plutôt
 *  que devant. En SVG cela marchait tout seul : les deux dessins sont dans le même document, donc
 *  un `url(#id)` traverse les frontières. Deux canvas n'ont rien de commun, d'où ce registre — la
 *  même portée globale qu'avaient les `id`, rendue explicite.
 *
 *  Il transporte aussi les `@keyframes` du publieur : le masque bouge avec la machine, donc le
 *  consommateur doit savoir l'animer, et il ne peut pas le deviner depuis son propre arbre.
 */
const masks = new Map<string, { node: ReactNode; frames: Map<string, Stop[]> }>();

/** L'origine des temps, **commune à tous les modules**.
 *
 *  Un masque et la machine qu'il suit sont dessinés par deux composants différents : s'ils
 *  comptaient chacun depuis leur propre montage, ils dériveraient l'un de l'autre du délai entre
 *  les deux — et la silhouette ne serait plus au même endroit que les fourches. Une seule origine
 *  les met en phase par construction. */
const EPOCH = typeof performance !== "undefined" ? performance.now() : 0;

interface Clock {
  /** Secondes écoulées depuis l'origine commune. */
  t: number;
  frames: Map<string, Stop[]>;
  /** Les masques empruntés à d'autres modules pendant cette peinture. */
  consumed: string[];
  /** Un calque de la taille et du repère du canvas courant, pour composer un masque. */
  layer: () => CanvasRenderingContext2D | null;
  /** Le visiteur a demandé qu'on ne l'anime pas : on montre alors la pose de repos, comme le ferait
   *  `animation: none`, et non le premier arrêt de la piste. */
  reduced: boolean;
}

interface Frame {
  /** La chaîne d'ancêtres, jointe par `>` : assemblée une fois par groupe. */
  chain: string;
  /** La matrice du dessin à cet endroit de l'arbre — sans la mise à l'écran. */
  m: Mat;
  /** L'échelle accumulée des `transform` de groupe, pour le trait à épaisseur fixe. */
  scale: number;
  alpha: number;
}

/**
 * L'étendue réellement dessinée — **et pourquoi il faut la mesurer**.
 *
 *  Tous les modules posent `overflow: visible` sur leur racine : leur ombre déborde du cadre sans
 *  l'agrandir, si bien qu'un module occupe la place de son corps et pas celle de son ombre. C'est
 *  délibéré, et c'est ce qui permet d'aligner deux modules sur leur emprise au sol. Un canvas, lui,
 *  ne déborde pas : il s'arrête à son bitmap, et l'ombre serait coupée net.
 *
 *  On mesure donc l'arbre avant de le peindre — même parcours, sans rien tracer — pour savoir de
 *  combien le dessin sort du cadre. Le bitmap est agrandi d'autant et recalé par des décalages
 *  négatifs : la boîte de mise en page reste celle du corps, le dessin déborde comme avant.
 */
/** Le débord du dessin hors de son cadre, en points d'écran, côté par côté. */
interface Bleed {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Extent {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const grow = (e: Extent, x: number, y: number) => {
  if (x < e.minX) e.minX = x;
  if (y < e.minY) e.minY = y;
  if (x > e.maxX) e.maxX = x;
  if (y > e.maxY) e.maxY = y;
};

/**
 * Les points d'une forme, passés par la matrice du groupe puis versés dans l'étendue.
 *
 *  La matrice est portée par le parcours et non demandée au contexte. Deux raisons, et la seconde
 *  est la vraie : `getTransform()` alloue une `DOMMatrix` à chaque forme, ce qui pèse plus que la
 *  mesure elle-même ; mais surtout le contexte porte **la matrice de peinture**, qui inclut le
 *  débord et le rapport de pixels. Mesurée à travers elle, l'étendue reviendrait en pixels
 *  d'appareil alors qu'on la compare au cadre, qui est en unités de dessin — et le débord calculé
 *  dessus n'aurait aucun sens. Le parcours garde donc la matrice du dessin seul.
 */
function measure(m: Mat, e: Extent | null, pts: number[], pad: number) {
  if (e === null) return;
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const x = m[0] * pts[i] + m[2] * pts[i + 1] + m[4];
    const y = m[1] * pts[i] + m[3] * pts[i + 1] + m[5];
    grow(e, x - pad, y - pad);
    grow(e, x + pad, y + pad);
  }
}

/** Une matrice affine du plan : `a b c d e f`, comme en SVG. */
type Mat = [number, number, number, number, number, number];
const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];
const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

/** `transform="translate(a b) rotate(d) scale(s)"` — la poignée de formes qu'émettent les modules,
 *  appliquées telles quelles au contexte. Rien de général : ce qui n'est pas reconnu est ignoré,
 *  parce qu'un transform inconnu qui décale silencieusement le dessin est pire qu'un transform
 *  absent. */
function applyTransform(ctx: CanvasRenderingContext2D, spec: string, into: Mat): { scale: number; m: Mat } {
  let scale = 1;
  let acc = into;
  const re = /(matrix|translate|rotate|scale|skewX|skewY)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  const step = (n: Mat) => {
    acc = mul(acc, n);
  };
  while ((m = re.exec(spec)) !== null) {
    // `parseFloat` et non `Number` : une transformation CSS porte ses unités (`3px`, `20deg`),
    // une transformation SVG non, et les deux passent ici.
    const n = m[2].split(/[\s,]+/).filter(Boolean).map(parseFloat);
    switch (m[1]) {
      case "matrix":
        ctx.transform(n[0], n[1], n[2], n[3], n[4], n[5]);
        step([n[0], n[1], n[2], n[3], n[4], n[5]]);
        scale *= Math.sqrt(Math.abs(n[0] * n[3] - n[1] * n[2])) || 1;
        break;
      case "translate":
        ctx.translate(n[0] || 0, n[1] || 0);
        step([1, 0, 0, 1, n[0] || 0, n[1] || 0]);
        break;
      case "rotate": {
        const a = ((n[0] || 0) * Math.PI) / 180;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        if (n.length >= 3) {
          ctx.translate(n[1], n[2]);
          ctx.rotate(a);
          ctx.translate(-n[1], -n[2]);
          step([1, 0, 0, 1, n[1], n[2]]);
          step([cos, sin, -sin, cos, 0, 0]);
          step([1, 0, 0, 1, -n[1], -n[2]]);
        } else {
          ctx.rotate(a);
          step([cos, sin, -sin, cos, 0, 0]);
        }
        break;
      }
      case "scale": {
        const kx = n[0] ?? 1;
        const ky = n[1] ?? kx;
        ctx.scale(kx, ky);
        step([kx, 0, 0, ky, 0, 0]);
        scale *= Math.sqrt(Math.abs(kx * ky)) || 1;
        break;
      }
      case "skewX": {
        const t = Math.tan(((n[0] || 0) * Math.PI) / 180);
        ctx.transform(1, 0, t, 1, 0, 0);
        step([1, 0, t, 1, 0, 0]);
        break;
      }
      case "skewY": {
        const t = Math.tan(((n[0] || 0) * Math.PI) / 180);
        ctx.transform(1, t, 0, 1, 0, 0);
        step([1, t, 0, 1, 0, 0]);
        break;
      }
    }
  }
  return { scale, m: acc };
}

/** Les modules donnent leurs contours en nombres ; une chaîne reste acceptée, parce qu'un `points`
 *  écrit à la main dans une story doit continuer de marcher. */
const points = (spec: string | number[]): number[] =>
  Array.isArray(spec)
    ? spec
    : spec
        .trim()
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => !Number.isNaN(n));

function tracePoints(ctx: CanvasRenderingContext2D, n: number[], close: boolean) {
  if (n.length < 4) return false;
  ctx.beginPath();
  ctx.moveTo(n[0], n[1]);
  for (let i = 2; i + 1 < n.length; i += 2) ctx.lineTo(n[i], n[i + 1]);
  if (close) ctx.closePath();
  return true;
}

/** Le remplissage et le trait d'une forme déjà tracée dans le contexte.
 *
 *  Les attributs posés sur l'élément l'emportent sur le CSS : c'est ainsi que se lit un `fill="none"`
 *  écrit à la main sur un tracé, et c'est le seul endroit où les modules contredisent leur feuille
 *  de style. */
function strokeAndFill(ctx: CanvasRenderingContext2D, s: Resolved, props: Record<string, unknown>, frame: Frame, fillRule?: CanvasFillRule) {
  const fill = typeof props.fill === "string" ? paint(props.fill) : s.fill;
  const stroke = typeof props.stroke === "string" ? paint(props.stroke) : s.stroke;
  const width = props.strokeWidth !== undefined ? Number(props.strokeWidth) : s.strokeWidth;
  if (fill) {
    ctx.globalAlpha = frame.alpha * s.fillOpacity;
    ctx.fillStyle = fill;
    ctx.fill(fillRule ?? "nonzero");
  }
  if (stroke && width > 0) {
    ctx.globalAlpha = frame.alpha * s.strokeOpacity;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = s.fixedStroke ? width / frame.scale : width;
    ctx.lineJoin = s.linejoin;
    ctx.lineCap = s.linecap;
    if (s.dash) ctx.setLineDash(s.dash);
    ctx.stroke();
    if (s.dash) ctx.setLineDash([]);
  }
  ctx.globalAlpha = frame.alpha;
}

/**
 * Le parcours.
 *
 *  Il ne connaît que les éléments hôtes et les fragments — donc exactement ce que les modules
 *  émettent. Un composant qu'on ne saurait pas dérouler sans le rendre est signalé plutôt
 *  qu'ignoré : un objet qui disparaît du dessin sans un mot est un bug qu'on met des heures à
 *  retrouver.
 */
function walk(ctx: CanvasRenderingContext2D, node: ReactNode, frame: Frame, probe: StyleProbe, missing: Set<string>, extent: Extent | null, clock: Clock) {
  if (node === null || node === undefined || node === false || node === true) return;
  if (Array.isArray(node)) {
    for (const child of node) walk(ctx, child, frame, probe, missing, extent, clock);
    return;
  }
  if (!isValidElement(node)) return;
  const el = node as ReactElement<Record<string, unknown>>;
  const props = el.props ?? {};
  const kids = props.children as ReactNode;

  if (el.type === Fragment) {
    walk(ctx, kids, frame, probe, missing, extent, clock);
    return;
  }
  if (typeof el.type !== "string") {
    missing.add(typeof el.type === "function" ? el.type.name || "anonyme" : String(el.type));
    return;
  }

  const tag = el.type;
  const cls = typeof props.className === "string" ? props.className : "";

  // Un groupe masqué : on le dessine à part, on l'ampute de ce que le masque ne garde pas, puis on
  // pose le calque. `destination-in` est l'exact équivalent du masque de luminance employé ici,
  // puisque le publieur peint ses formes en blanc plein : là où il a peint, on garde.
  if (typeof props.mask === "string") {
    const id = /url\(#([^)]+)\)/.exec(props.mask)?.[1];
    const src = id ? masks.get(id) : undefined;
    if (id) clock.consumed.push(id);
    if (src !== undefined) {
      const lctx = clock.layer();
      if (lctx !== null) {
        const inner: Clock = { ...clock, frames: src.frames };
        walk(lctx, kids, { ...frame, alpha: 1 }, probe, missing, extent, clock);
        lctx.globalCompositeOperation = "destination-in";
        walk(lctx, src.node, { ...frame, alpha: 1 }, probe, missing, null, inner);
        lctx.globalCompositeOperation = "source-over";
        const keep = ctx.getTransform();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = frame.alpha;
        ctx.drawImage(lctx.canvas, 0, 0);
        ctx.setTransform(keep);
        return;
      }
    }
  }

  // Les conteneurs : ils n'ont pas de dessin propre, seulement un contexte.
  if (tag === "g" || tag === "svg") {
    const style = props.style as (CSSProperties & { animationName?: string; animationDuration?: string }) | undefined;
    const chainHere = cls ? (frame.chain ? `${frame.chain}>${cls}` : cls) : frame.chain;
    let opacity = props.opacity !== undefined ? Number(props.opacity) : style?.opacity !== undefined ? Number(style.opacity) : 1;
    // La transformation vient de l'attribut SVG ou de la propriété CSS — les modules emploient les
    // deux — et l'animation, quand il y en a une, l'emporte sur les deux. Toutes sont des
    // translations, donc l'origine de transformation, qui diffère entre les deux écritures, ne
    // change rien ici.
    let transform = typeof props.transform === "string" ? props.transform : typeof style?.transform === "string" ? style.transform : null;
    const track = style?.animationName ? clock.frames.get(style.animationName) : undefined;
    if (track !== undefined && !clock.reduced) {
      const seconds = style?.animationDuration ? parseFloat(style.animationDuration) : 1;
      const u = seconds > 0 ? (((clock.t / seconds) % 1) + 1) % 1 : 0;
      const pose = sample(track, u, easing(probe.resolve(chainHere, "", "g").timing));
      if (pose.translate !== null) transform = `translate(${pose.translate[0]} ${pose.translate[1]})`;
      if (pose.opacity !== null) opacity *= pose.opacity;
    }
    const next: Frame = { chain: chainHere, m: frame.m, scale: frame.scale, alpha: frame.alpha * opacity };
    if (transform) {
      ctx.save();
      const applied = applyTransform(ctx, transform, frame.m);
      next.m = applied.m;
      next.scale = frame.scale * applied.scale;
      ctx.globalAlpha = next.alpha;
      walk(ctx, kids, next, probe, missing, extent, clock);
      ctx.restore();
      ctx.globalAlpha = frame.alpha;
    } else {
      ctx.globalAlpha = next.alpha;
      walk(ctx, kids, next, probe, missing, extent, clock);
      ctx.globalAlpha = frame.alpha;
    }
    return;
  }
  // `<defs>` et `<mask>` ne se peignent pas — mais on les lit au passage.
  //
  // Le ramassage se faisait dans un parcours à part, pour ne rien devoir à l'ordre de l'arbre. Un
  // troisième parcours par image, pour trouver trois éléments : les modules écrivent tous leur
  // `<defs>` en tête, donc une piste est connue avant le groupe qui s'y réfère. Si elle ne l'était
  // pas, la première image serait à l'arrêt et la suivante juste — la boucle d'animation repasse.
  if (tag === "defs") {
    walk(ctx, kids, frame, probe, missing, extent, clock);
    return;
  }
  if (tag === "style") {
    const text = Array.isArray(kids) ? kids.join("") : typeof kids === "string" ? kids : "";
    if (text) parseKeyframes(text, clock.frames);
    return;
  }
  if (tag === "mask") {
    if (typeof props.id === "string") masks.set(props.id, { node: kids, frames: clock.frames });
    return;
  }
  if (tag === "title" || tag === "desc" || tag === "clipPath") return;

  const s = probe.resolve(frame.chain, cls, tag);

  const pad = s.stroke ? (s.fixedStroke ? s.strokeWidth / frame.scale : s.strokeWidth) : 0;

  switch (tag) {
    case "polygon":
    case "polyline": {
      const spec = points((props.points as string | number[] | undefined) ?? "");
      measure(frame.m, extent, spec, pad);
      if (tracePoints(ctx, spec, tag === "polygon")) strokeAndFill(ctx, s, props, frame);
      return;
    }
    case "line": {
      const seg = [Number(props.x1) || 0, Number(props.y1) || 0, Number(props.x2) || 0, Number(props.y2) || 0];
      measure(frame.m, extent, seg, pad);
      ctx.beginPath();
      ctx.moveTo(seg[0], seg[1]);
      ctx.lineTo(seg[2], seg[3]);
      strokeAndFill(ctx, { ...s, fill: null }, props, frame);
      return;
    }
    case "path": {
      const d = typeof props.d === "string" ? props.d : "";
      if (!d) return;
      // Les nombres d'un `d`, pris deux à deux. Exact pour les tracés que les modules écrivent —
      // ils n'emploient que `M` et `L` — et jamais sous-estimé pour un tracé courbe, puisque les
      // points de contrôle d'une Bézier encadrent la courbe.
      if (extent !== null) measure(frame.m, extent, d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number) ?? [], pad);
      const p = new Path2D(d);
      const fill = typeof props.fill === "string" ? paint(props.fill) : s.fill;
      const stroke = typeof props.stroke === "string" ? paint(props.stroke) : s.stroke;
      const width = props.strokeWidth !== undefined ? Number(props.strokeWidth) : s.strokeWidth;
      if (fill) {
        ctx.globalAlpha = frame.alpha * s.fillOpacity;
        ctx.fillStyle = fill;
        ctx.fill(p);
      }
      if (stroke && width > 0) {
        ctx.globalAlpha = frame.alpha * s.strokeOpacity;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = s.fixedStroke ? width / frame.scale : width;
        ctx.lineJoin = s.linejoin;
        ctx.lineCap = s.linecap;
        if (s.dash) ctx.setLineDash(s.dash);
        ctx.stroke(p);
        if (s.dash) ctx.setLineDash([]);
      }
      ctx.globalAlpha = frame.alpha;
      return;
    }
    case "circle": {
      const r = Number(props.r) || 0;
      if (r <= 0) return;
      if (extent !== null) {
        const cx = Number(props.cx) || 0;
        const cy = Number(props.cy) || 0;
        measure(frame.m, extent, [cx - r, cy - r, cx + r, cy + r], pad);
      }
      ctx.beginPath();
      ctx.arc(Number(props.cx) || 0, Number(props.cy) || 0, r, 0, Math.PI * 2);
      strokeAndFill(ctx, s, props, frame);
      return;
    }
    case "ellipse": {
      const rx = Number(props.rx) || 0;
      const ry = Number(props.ry) || 0;
      if (rx <= 0 || ry <= 0) return;
      if (extent !== null) {
        const cx = Number(props.cx) || 0;
        const cy = Number(props.cy) || 0;
        measure(frame.m, extent, [cx - rx, cy - ry, cx + rx, cy + ry], pad);
      }
      ctx.beginPath();
      ctx.ellipse(Number(props.cx) || 0, Number(props.cy) || 0, rx, ry, 0, 0, Math.PI * 2);
      strokeAndFill(ctx, s, props, frame);
      return;
    }
    case "rect": {
      const w = Number(props.width) || 0;
      const h = Number(props.height) || 0;
      if (w <= 0 || h <= 0) return;
      const x = Number(props.x) || 0;
      const y = Number(props.y) || 0;
      if (extent !== null) measure(frame.m, extent, [x, y, x + w, y + h], pad);
      const rx = Math.min(Number(props.rx) || 0, w / 2, h / 2);
      ctx.beginPath();
      if (rx > 0) ctx.roundRect(x, y, w, h, rx);
      else ctx.rect(x, y, w, h);
      strokeAndFill(ctx, s, props, frame);
      return;
    }
    default:
      missing.add(tag);
  }
}

export interface IsoCanvasProps {
  /** La fenêtre du monde à couvrir, dans les mêmes unités que le dessin : `[x, y, largeur, hauteur]`. */
  viewBox: [number, number, number, number];
  width: number;
  height: number;
  className?: string;
  role?: string;
  ariaLabel?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Le canvas, et le dessin qu'on y verse.
 *
 *  `children` n'est **pas rendu** : il est parcouru. L'arbre sert de description du dessin, ce qui
 *  laisse aux modules exactement le code qu'ils avaient — et permet d'y revenir en SVG en changeant
 *  une ligne, si l'on veut un jour comparer les deux à l'œil.
 *
 *  La peinture se fait en effet de rendu, après le montage du conteneur : la sonde a besoin d'être
 *  dans le document pour que `getComputedStyle` ait quelque chose à dire. C'est aussi pour cela que
 *  le premier dessin arrive une frame après le montage, ce qui ne se voit pas mais explique
 *  pourquoi le canvas est dimensionné dès le rendu, lui, afin de ne pas faire sauter la mise en
 *  page.
 */
export function IsoCanvas({ viewBox, width, height, className, role = "img", ariaLabel, style, children }: IsoCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const probe = useRef<StyleProbe | null>(null);
  /** La largeur réellement occupée à l'écran, en pixels de l'appareil. Elle sert de déclencheur de
   *  repeinture, et c'est l'observateur qui la fournit. */
  const [shown, setShown] = useState(0);
  /** Pixels d'appareil par point de mise en page : le ratio du moniteur **multiplié par le zoom**.
   *
   *  Il était relu à chaque peinture par `getBoundingClientRect`, ce qui force une mise en page —
   *  treize fois par image pendant une rotation. Or il ne change que quand la taille affichée
   *  change, ce que l'observateur signale déjà. */
  const scale = useRef(0);
  /** Le débord retenu d'une peinture à la suivante. */
  const spill = useRef<Bleed>({ left: 0, top: 0, right: 0, bottom: 0 });
  const [minX, minY, vw, vh] = viewBox;
  /** Le tracé courant, partagé avec la boucle d'animation. Une **référence** et non un état : une
   *  animation qui re-rendrait React soixante fois par seconde ferait payer à tout l'arbre ce qui
   *  ne concerne qu'un bitmap. La boucle repeint le même arbre, c'est tout. */
  const draw = useRef<((t: number) => void) | null>(null);

  useEffect(() => {
    const el = host.current;
    if (el === null) return;
    probe.current = makeProbe(el);
    return () => {
      probe.current?.destroy();
      probe.current = null;
    };
  }, []);

  // Le canvas est tramé à la taille **réellement affichée**, pas à celle demandée.
  //
  // Un SVG agrandi reste net : il est retracé à la taille d'affichage. Un canvas, non — il est
  // tramé une fois, puis étiré. Or la scène d'entrepôt a un zoom, qui agrandit par la mise en page
  // sans toucher au rapport de pixels du moniteur : tramé sur la taille demandée, le dessin
  // deviendrait flou dès le premier cran de loupe, ce qui serait une régression franche par
  // rapport au vectoriel. On mesure donc, et on repeint quand la mesure change.
  useEffect(() => {
    const cv = canvas.current;
    if (cv === null || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      // Les deux tailles **de la même entrée** : les pixels d'appareil et les points de mise en
      // page d'un seul et même instant. Rapportée à la largeur qu'on avait posée au dernier tracé,
      // la mesure se serait comparée à une valeur d'un autre moment — et un ratio faux d'un
      // centième décale tout le dessin d'un demi-pixel.
      const dev = entries[0]?.devicePixelContentBoxSize?.[0]?.inlineSize;
      const css = entries[0]?.contentBoxSize?.[0]?.inlineSize;
      if (dev !== undefined && css !== undefined && css > 0) {
        scale.current = dev / css;
        setShown(dev);
      }
    });
    try {
      ro.observe(cv, { box: "device-pixel-content-box" });
    } catch {
      ro.observe(cv);
    }
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    if (cv === null || probe.current === null) return;
    const ctx = cv.getContext("2d");
    if (ctx === null) return;
    const probeNow = probe.current;
    const missing = new Set<string>();
    const frames = new Map<string, Stop[]>();
    const consumed: string[] = [];
    const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let sheet: HTMLCanvasElement | null = null;
    const clock: Clock = {
      t: 0,
      frames,
      consumed,
      reduced,
      layer: () => {
        if (sheet === null) sheet = document.createElement("canvas");
        if (sheet.width !== cv.width || sheet.height !== cv.height) {
          sheet.width = cv.width;
          sheet.height = cv.height;
        }
        const lc = sheet.getContext("2d");
        if (lc === null) return null;
        lc.setTransform(1, 0, 0, 1, 0, 0);
        lc.clearRect(0, 0, sheet.width, sheet.height);
        lc.setTransform(ctx.getTransform());
        lc.globalAlpha = 1;
        return lc;
      },
    };
    const chain = className ?? "";
    const sx = width / vw;
    const sy = height / vh;
    const base: Frame = { chain, m: IDENTITY, scale: Math.sqrt(Math.abs(sx * sy)) || 1, alpha: 1 };
    // Le rapport de pixels du moniteur, multiplié par le grossissement que la mise en page a
    // appliqué : sur un écran à deux pixels par point, un canvas dimensionné en points rend un
    // dessin flou là où le SVG restait net.
    const dpr = scale.current > 0 ? scale.current : window.devicePixelRatio || 1;

    /** Une peinture, avec le débord qu'on croit nécessaire — et l'étendue réellement rencontrée. */
    const paint = (t: number, b: Bleed): Extent => {
      const cw = width + b.left + b.right;
      const ch = height + b.top + b.bottom;
      const pw = Math.max(1, Math.round(cw * dpr));
      const ph = Math.max(1, Math.round(ch * dpr));
      cv.style.width = `${cw}px`;
      cv.style.height = `${ch}px`;
      cv.style.left = `${-b.left}px`;
      cv.style.top = `${-b.top}px`;
      if (cv.width !== pw) cv.width = pw;
      if (cv.height !== ph) cv.height = ph;
      const e: Extent = { minX, minY, maxX: minX + vw, maxY: minY + vh };
      clock.t = t;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pw, ph);
      ctx.setTransform(sx * dpr, 0, 0, sy * dpr, (b.left - minX * sx) * dpr, (b.top - minY * sy) * dpr);
      ctx.globalAlpha = 1;
      walk(ctx, children, base, probeNow, missing, e, clock);
      return e;
    };

    /** Le débord qu'aurait demandé une étendue, en points d'écran, arrondi au point supérieur pour
     *  ne jamais raboter d'un pixel. */
    const needed = (e: Extent): Bleed => ({
      left: Math.ceil(Math.max(0, minX - e.minX) * sx),
      top: Math.ceil(Math.max(0, minY - e.minY) * sy),
      right: Math.ceil(Math.max(0, e.maxX - (minX + vw)) * sx),
      bottom: Math.ceil(Math.max(0, e.maxY - (minY + vh)) * sy),
    });

    /**
     * Peindre, et se corriger si le débord manquait.
     *
     *  Le débord n'est connu qu'une fois l'arbre parcouru, et il servait pour cela d'une passe de
     *  mesure — un second parcours complet, à chaque image, dont la peinture ne profitait pas. Or
     *  la peinture rencontre exactement les mêmes points : elle peut donc les relever au passage.
     *  On peint avec le débord de la fois précédente, et s'il se révèle trop court on repeint. Pendant
     *  une rotation le débord ne bouge pratiquement pas — l'ombre est portée par un soleil fixe à
     *  l'écran — si bien que la seconde passe ne se produit presque jamais.
     */
    const render = (t: number) => {
      const want = needed(paint(t, spill.current));
      const grew = want.left > spill.current.left || want.top > spill.current.top || want.right > spill.current.right || want.bottom > spill.current.bottom;
      // On ne rétrécit que franchement : à la marge, le bitmap garderait sa taille pour rien mais
      // une oscillation d'un pixel ferait réallouer à chaque image.
      const shrank = want.left + want.top + want.right + want.bottom < (spill.current.left + spill.current.top + spill.current.right + spill.current.bottom) / 2;
      if (grew || shrank) {
        spill.current = grew
          ? {
              left: Math.max(want.left, spill.current.left),
              top: Math.max(want.top, spill.current.top),
              right: Math.max(want.right, spill.current.right),
              bottom: Math.max(want.bottom, spill.current.bottom),
            }
          : want;
        paint(t, spill.current);
      }
    };

    render(0);
    if (missing.size > 0 && typeof console !== "undefined") {
      console.warn(`[IsoCanvas] non peint : ${[...missing].join(", ")}`);
    }
    // Un masque consommé anime le calque qui le porte : c'est le publieur qui bouge, pas nous.
    const borrowed = consumed.some((id) => (masks.get(id)?.frames.size ?? 0) > 0);
    if ((frames.size === 0 && !borrowed) || reduced) return;
    // Une seule boucle par module, et seulement quand il y a quelque chose à animer : un entrepôt à
    // l'arrêt ne consomme rien.
    draw.current = render;
    let raf = 0;
    const tick = (now: number) => {
      draw.current?.((now - EPOCH) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      draw.current = null;
    };
  });
  void shown;

  return (
    <div
      ref={host}
      className={className}
      style={{ position: "relative", display: "inline-block", lineHeight: 0, width: `${width}px`, height: `${height}px`, ...style }}
      role={role}
      aria-label={ariaLabel}
    >
      {/* En position absolue, et non dans le flux : c'est ce qui lui permet de déborder du cadre —
          l'ombre — sans que le cadre grandisse. La boîte de mise en page reste celle du conteneur,
          dimensionnée sur le corps du module. */}
      <canvas ref={canvas} style={{ position: "absolute", left: 0, top: 0, width: `${width}px`, height: `${height}px`, display: "block" }} />
    </div>
  );
}
