import type { AiImage } from "./interfaces/AiMessage.interface";
import type { AiChartContext, AiChartCapture, AiCaptureZone } from "./interfaces/AiChartContext.interface";
import type { AiTool } from "./aiTools";

/**
 * Capture du graphique pour l'IA : `capturer_le_graphique` rend une image de ce qui est à l'écran (bougies, axes,
 * légendes, dessins — la même composition que le bouton appareil photo) et un court texte de ce qu'elle devrait
 * montrer, pour que le modèle vérifie ce qu'il vient de faire (un tracé au bon prix, un indicateur bien affiché, la
 * bonne couleur) et se corrige au besoin.
 */

export const CAPTURE_TOOL = "capturer_le_graphique";

/** Poids maximal d'une image après compression (octets décodés). Au-delà, elle est réduite puis recompressée. */
export const MAX_CAPTURE_BYTES = 1_500_000;
export const DEFAULT_CAPTURE_WIDTH = 1600;
const MIN_CAPTURE_WIDTH = 480;

export type AiCaptureFormat = "png" | "jpeg" | "webp";

/** Ce qu'il faut d'un canevas pour l'encoder : de quoi tester le calcul sans navigateur. */
export interface EncodableCanvas {
  width: number;
  height: number;
  toDataURL(type?: string, quality?: number): string;
}

export interface EncodeCaptureOptions {
  maxWidth?: number;
  format?: AiCaptureFormat;
  /** 0,1 à 1 (jpeg, webp). */
  quality?: number;
  maxBytes?: number;
}

/** Une image encodée, ses dimensions et son poids (octets décodés). */
export interface EncodedCapture {
  image: AiImage;
  width: number;
  height: number;
  bytes: number;
}

/** Poids réel d'une chaîne base64, sans la décoder. */
export function base64Bytes(data: string): number {
  const padding = data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0;
  return Math.floor((data.length * 3) / 4) - padding;
}

/** Copie réduite d'un canevas (navigateur). */
function resizeCanvas(source: EncodableCanvas, width: number): EncodableCanvas {
  const height = Math.max(1, Math.round((source.height * width) / source.width));
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source as unknown as CanvasImageSource, 0, 0, width, height);
  }
  return out;
}

const MIME: Record<AiCaptureFormat, AiImage["mimeType"]> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

/**
 * Encode une capture en restant sous `maxBytes` : d'abord à `maxWidth` au plus, puis, tant que c'est trop lourd,
 * qualité réduite (jpeg, webp) et largeur réduite d'un quart à chaque essai ; un PNG trop lourd passe en JPEG.
 * Rend null si même la plus petite image dépasse (ce qui n'arrive pas pour un graphique).
 */
export function encodeCapture(
  canvas: EncodableCanvas,
  options: EncodeCaptureOptions = {},
  resize: (source: EncodableCanvas, width: number) => EncodableCanvas = resizeCanvas,
): EncodedCapture | null {
  const maxBytes = options.maxBytes ?? MAX_CAPTURE_BYTES;
  let format: AiCaptureFormat = options.format ?? "png";
  let quality = Math.min(1, Math.max(0.1, options.quality ?? 0.85));
  let width = Math.max(1, Math.min(canvas.width, Math.round(options.maxWidth ?? DEFAULT_CAPTURE_WIDTH)));
  for (let attempt = 0; attempt < 12; attempt++) {
    const scaled = width < canvas.width ? resize(canvas, width) : canvas;
    const url = scaled.toDataURL(MIME[format], format === "png" ? undefined : quality);
    const comma = url.indexOf(",");
    // Un navigateur qui ne sait pas encoder ce format rend du PNG : le type annoncé est celui reçu.
    const mimeType = (/^data:([^;,]+)/.exec(url)?.[1] ?? MIME[format]) as AiImage["mimeType"];
    const data = comma >= 0 ? url.slice(comma + 1) : "";
    const bytes = base64Bytes(data);
    if (data && bytes <= maxBytes) return { image: { data, mimeType }, width: scaled.width, height: scaled.height, bytes };
    // Trop lourd : un PNG passe d'abord en JPEG à la même taille ; ensuite qualité et largeur baissent ensemble.
    if (format === "png") {
      format = "jpeg";
      continue;
    }
    if (width <= MIN_CAPTURE_WIDTH && quality <= 0.5) break;
    quality = Math.max(0.5, quality - 0.15);
    width = Math.min(canvas.width, Math.max(MIN_CAPTURE_WIDTH, Math.round(width * 0.75)));
  }
  return null;
}

const day = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");

/** Ce que la capture devrait montrer, en quelques lignes : de quoi confronter l'image à l'intention. */
export function describeCapture(chart: AiChartContext, shot: AiChartCapture, encoded: EncodedCapture, zone: AiCaptureZone): string {
  const drawings = chart.drawings();
  const drawingLines = drawings.slice(0, 20).map((d) => {
    const kind = d.lineType ?? "ligne";
    const text = d.text ? ` « ${d.text} »` : "";
    const where = d.lineType === "horizontal" ? ` à ${d.y1}` : d.lineType === "symbolOverlay" ? ` ${d.overlaySymbol ?? ""}` : "";
    return `${kind}${where}${text}${d.color ? ` (${d.color})` : ""}`;
  });
  const indicators = chart.indicators.map((i) => `${chart.indicatorLabel(i)}${i.color ? ` (${i.color})` : ""}`);
  return [
    `Capture ${zone === "espace_de_travail" ? "de l'espace de travail entier" : "du graphique au premier plan"} : ${encoded.width} × ${encoded.height} px, ${encoded.image.mimeType}, ${Math.round(encoded.bytes / 1024)} Ko.`,
    `Symbole : ${chart.symbol ?? "non renseigné"} · unité de temps : ${chart.timeframe ?? "non renseignée"}`,
    shot.visibleFrom && shot.visibleTo ? `Zone visible : du ${day(shot.visibleFrom)} au ${day(shot.visibleTo)}` : "",
    zone === "espace_de_travail" && chart.workspace ? `Fenêtres : ${(chart.workspace.panels() ?? []).map((p) => `${p.index + 1} : ${p.symbol ?? "?"}`).join(" ; ")}` : "",
    `Volume : ${chart.volumeVisible ? "affiché" : "masqué"}`,
    `Indicateurs : ${indicators.join(" ; ") || "aucun"}`,
    `Dessins (${drawings.length}) : ${drawingLines.join(" ; ") || "aucun"}${drawings.length > 20 ? " ; …" : ""}`,
    "Vérifie sur l'image que le résultat correspond à la demande (position, couleur, légende) ; corrige si besoin, sans recapturer plus de deux fois pour une même demande.",
  ]
    .filter(Boolean)
    .join("\n");
}

const FORMATS: AiCaptureFormat[] = ["png", "jpeg", "webp"];

export const CAPTURE_TOOLS: AiTool[] = [
  {
    definition: {
      name: CAPTURE_TOOL,
      description:
        "Capture d'écran du graphique tel qu'il est affiché (bougies, axes, légendes, indicateurs, dessins), renvoyée en image avec un court texte (symbole, unité de temps, zone visible, indicateurs et dessins). À utiliser après une action visible (tracé, indicateur, comparaison, couleurs) pour vérifier le résultat et se corriger : au plus deux captures par demande.",
      inputSchema: {
        type: "object",
        properties: {
          zone: {
            type: "string",
            enum: ["graphique", "espace_de_travail"],
            description: "graphique (par défaut) : la fenêtre au premier plan ; espace_de_travail : toutes les fenêtres quand il y en a plusieurs.",
          },
          largeur_max: { type: "number", minimum: 480, maximum: 2400, description: "Largeur maximale de l'image en pixels (1600 par défaut)." },
          format: { type: "string", enum: FORMATS, description: "png (par défaut, net) ; jpeg ou webp, plus légers." },
          qualite: { type: "number", minimum: 0.3, maximum: 1, description: "Qualité de 0,3 à 1 pour jpeg et webp (0,85 par défaut)." },
        },
        additionalProperties: false,
      },
    },
    run: async (input, chart) => {
      if (!chart.capture) return { content: "La capture n'est pas disponible sur ce graphique.", isError: true };
      const zone: AiCaptureZone = input.zone === "espace_de_travail" && chart.workspace ? "espace_de_travail" : "graphique";
      const format = FORMATS.includes(input.format as AiCaptureFormat) ? (input.format as AiCaptureFormat) : "png";
      const maxWidth = typeof input.largeur_max === "number" && Number.isFinite(input.largeur_max) ? Math.min(2400, Math.max(480, input.largeur_max)) : DEFAULT_CAPTURE_WIDTH;
      const quality = typeof input.qualite === "number" && Number.isFinite(input.qualite) ? input.qualite : undefined;
      const shot = await chart.capture(zone);
      if (!shot) return { content: "Capture impossible : le graphique n'est pas affiché.", isError: true };
      const encoded = encodeCapture(shot.canvas, { maxWidth, format, ...(quality !== undefined ? { quality } : {}) });
      if (!encoded) return { content: "Capture trop lourde, même réduite.", isError: true };
      return { content: describeCapture(chart, shot, encoded, zone), image: encoded.image };
    },
  },
];
