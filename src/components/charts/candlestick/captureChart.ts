/**
 * Capture d'un graphique en image PNG, comme le bouton appareil photo de TradingView.
 *
 * Le graphique est fait de couches : le canevas des bougies et indicateurs, le SVG des axes et des événements, et
 * du HTML par-dessus (légendes, en-têtes de panneaux, étiquettes de prix). Elles sont recomposées une à une dans un
 * canevas à la résolution de l'écran, dans l'ordre du document — sans dépendance : un SVG est sérialisé avec ses
 * styles calculés recopiés en ligne (une image SVG ne voit pas les feuilles de style de la page), le HTML est réduit
 * à ses fonds pleins et à ses textes. Le réticule (couche « crosshair ») et les boutons ne sont pas repris.
 */

/** Propriétés recopiées sur chaque nœud d'un SVG avant de le sérialiser. */
const SVG_STYLE_PROPS = [
  "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "stroke-linecap", "stroke-linejoin",
  "opacity", "color", "font-family", "font-size", "font-weight", "font-style", "text-anchor", "dominant-baseline",
  "visibility", "display", "shape-rendering",
];

export interface ChartCaptureOptions {
  /** Couleur de fond de l'image ; par défaut celle, calculée, de l'élément capturé (ou de ses parents). */
  background?: string;
  /** Une ligne écrite en bas à gauche de l'image (ex. « CAC 40 · 30 minutes · 14/11/2026 15:42 »). */
  caption?: string;
}

function visible(el: Element, cs: CSSStyleDeclaration): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0;
}

function transparent(color: string): boolean {
  return color === "transparent" || /rgba?\([^)]*,\s*0\)$/.test(color.replace(/\s+/g, " ")) || color === "rgba(0, 0, 0, 0)";
}

function backgroundOf(el: Element): string {
  for (let e: Element | null = el; e; e = e.parentElement) {
    const bg = getComputedStyle(e).backgroundColor;
    if (!transparent(bg)) return bg;
  }
  return "#ffffff";
}

async function svgImage(svg: SVGSVGElement): Promise<HTMLImageElement | null> {
  const r = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = [svg, ...Array.from(svg.querySelectorAll("*"))];
  const dst = [clone, ...Array.from(clone.querySelectorAll("*"))];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    (dst[i] as Element).setAttribute("style", SVG_STYLE_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";"));
  });
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(r.width));
  clone.setAttribute("height", String(r.height));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Compose l'élément `root` (la colonne du graphique) en un canevas à la résolution de l'écran. */
export async function captureChartCanvas(root: HTMLElement, options: ChartCaptureOptions = {}): Promise<HTMLCanvasElement> {
  const box = root.getBoundingClientRect();
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const captionHeight = options.caption ? 26 : 0;
  const out = document.createElement("canvas");
  out.width = Math.round(box.width * dpr);
  out.height = Math.round((box.height + captionHeight) * dpr);
  const ctx = out.getContext("2d");
  if (!ctx) return out;
  ctx.scale(dpr, dpr);
  const background = options.background ?? backgroundOf(root);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, box.width, box.height + captionHeight);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  const svgs: { el: SVGSVGElement; order: number }[] = [];
  const ops: (() => void | Promise<void>)[] = [];
  for (let node: Node | null = walker.currentNode; node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\s+/g, " ").trim();
      const parent = node.parentElement;
      if (!text || !parent || parent.closest("svg, [role=menu], [role=dialog]")) continue;
      const cs = getComputedStyle(parent);
      if (!visible(parent, cs)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getClientRects()[0];
      if (!rect || rect.width === 0) continue;
      ops.push(() => {
        ctx.save();
        ctx.globalAlpha = Number(cs.opacity) || 1;
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        ctx.fillStyle = cs.color;
        ctx.textBaseline = "middle";
        ctx.fillText(text, rect.left - box.left, rect.top - box.top + rect.height / 2);
        ctx.restore();
      });
      continue;
    }
    const el = node as Element;
    if (el instanceof HTMLCanvasElement) {
      if (el.classList.contains("lq-chart__canvas--crosshair")) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      ops.push(() => ctx.drawImage(el, r.left - box.left, r.top - box.top, r.width, r.height));
      continue;
    }
    if (el instanceof SVGSVGElement) {
      // Seuls les grands SVG (axes, événements) : les petites icônes appartiennent aux boutons.
      const r = el.getBoundingClientRect();
      if (r.width > 60 && r.height > 60 && !el.closest("button")) {
        svgs.push({ el, order: ops.length });
        ops.push(() => undefined);
      }
      continue;
    }
    if (el === root || el.closest("button, [role=menu], [role=dialog]")) continue;
    const cs = getComputedStyle(el);
    if (!transparent(cs.backgroundColor) && visible(el, cs)) {
      const r = el.getBoundingClientRect();
      // Fonds des petites pastilles (étiquettes de prix, en-têtes) ; jamais un panneau entier qui masquerait le tracé.
      if (r.width * r.height < box.width * box.height * 0.2) {
        ops.push(() => {
          ctx.fillStyle = cs.backgroundColor;
          ctx.fillRect(r.left - box.left, r.top - box.top, r.width, r.height);
        });
      }
    }
  }
  // Les SVG se chargent comme images (asynchrone) ; ils prennent leur place dans l'ordre de dessin.
  const images = await Promise.all(svgs.map((s) => svgImage(s.el)));
  svgs.forEach((s, i) => {
    const img = images[i];
    if (!img) return;
    const r = s.el.getBoundingClientRect();
    ops[s.order] = () => ctx.drawImage(img, r.left - box.left, r.top - box.top, r.width, r.height);
  });
  for (const op of ops) await op();

  if (options.caption) {
    const cs = getComputedStyle(root);
    ctx.font = `500 12px ${cs.fontFamily}`;
    ctx.fillStyle = cs.color;
    ctx.globalAlpha = 0.75;
    ctx.textBaseline = "middle";
    ctx.fillText(options.caption, 10, box.height + captionHeight / 2);
    ctx.globalAlpha = 1;
  }
  return out;
}

export async function captureChartBlob(root: HTMLElement, options?: ChartCaptureOptions): Promise<Blob> {
  const canvas = await captureChartCanvas(root, options);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Capture impossible"))), "image/png"));
}

/** Nom de fichier lisible et sûr : « graphique-CAC40-30min-2026-11-14_15-42.png ». */
export function captureFileName(symbol?: string, timeframe?: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const clean = (s?: string) => (s ?? "").replace(/[^\p{L}\p{N}]+/gu, "").slice(0, 40);
  return ["graphique", clean(symbol), clean(timeframe), stamp].filter(Boolean).join("-") + ".png";
}
