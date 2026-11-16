import type { AiTool } from "./aiTools";
import type { AiChartContext } from "./interfaces/AiChartContext.interface";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import { drawingLabel } from "../drawingCatalog";
import { DATE_DOC, barIndexOf, bool, fail, fmtNum, isoDay, num, ok, parseDate, str } from "./toolHelpers";
import { findPane } from "./controlTools";

/**
 * Dessins en coordonnées date / prix : `dessiner` crée n'importe quel outil de la barre de gauche (lignes, canaux,
 * fourchettes, rectangles, Fibonacci, figures, projections, textes, notes, tableaux…), `gerer_les_dessins` les liste,
 * les modifie (couleur, style, verrouillage, texte, points), les duplique, les supprime, et masque ou verrouille tous
 * les dessins. Les dessins créés sont des dessins ordinaires : déplaçables, modifiables et annulables à la main.
 */

type LineType = NonNullable<TrendLineDrawing["lineType"]> | "trendline" | "arrowLine";

/** Nom donné au modèle → type du graphique, et nombre de points attendus (min, max). */
const SHAPES: Record<string, { type: LineType; points: [number, number]; doc: string }> = {
  ligne_de_tendance: { type: "trendline", points: [2, 2], doc: "2 points" },
  ligne_etendue: { type: "extended", points: [2, 2], doc: "2 points, prolongée des deux côtés" },
  demi_droite: { type: "trendline", points: [2, 2], doc: "2 points, prolongée vers la droite (rayon)" },
  ligne_flechee: { type: "arrowLine", points: [2, 2], doc: "2 points, flèche au bout" },
  ligne_horizontale: { type: "horizontal", points: [1, 1], doc: "1 point (prix ; date inutile) — sur un autre panneau : « panneau »" },
  rayon_horizontal: { type: "ray", points: [1, 1], doc: "1 point : ligne horizontale à partir d'une date vers la droite" },
  ligne_verticale: { type: "vertical", points: [1, 1], doc: "1 point (date)" },
  canal: { type: "channel", points: [2, 3], doc: "2 points de la première ligne, puis un 3e point (ou « decalage » en prix) qui place la parallèle" },
  canal_disjoint: { type: "disjointChannel", points: [4, 4], doc: "4 points : ligne 1 (p1, p2), puis p3 (à la date de p2) et p4 (à la date de p1)" },
  fourchette: { type: "pitchfork", points: [3, 3], doc: "3 points A, B, C (Andrews)" },
  fourchette_schiff: { type: "schiffPitchfork", points: [3, 3], doc: "3 points" },
  fourchette_schiff_modifiee: { type: "modifiedSchiffPitchfork", points: [3, 3], doc: "3 points" },
  fourchette_interieure: { type: "insidePitchfork", points: [3, 3], doc: "3 points" },
  rectangle: { type: "rectangle", points: [2, 2], doc: "2 coins opposés" },
  zones: { type: "zones", points: [2, 2], doc: "2 coins (zones positive / neutre / négative)" },
  fleche_coudee: { type: "elbowArrow", points: [2, 20], doc: "2 points ou plus" },
  pinceau: { type: "brush", points: [2, 200], doc: "suite de points à main levée" },
  fleche_haut: { type: "arrowUp", points: [1, 1], doc: "1 point" },
  fleche_bas: { type: "arrowDown", points: [1, 1], doc: "1 point" },
  fibonacci_retracement: { type: "fibonacci", points: [2, 2], doc: "2 points (0 % puis 100 %)" },
  fibonacci_extension: { type: "fibonacciExtension", points: [3, 3], doc: "3 points A, B, C" },
  elliott_impulsion: { type: "elliottImpulse", points: [6, 6], doc: "6 points 0 à 5" },
  elliott_correction: { type: "elliottCorrection", points: [4, 4], doc: "4 points 0, A, B, C" },
  tete_et_epaules: { type: "headShoulders", points: [7, 7], doc: "7 points" },
  tasse_avec_anse: { type: "cupHandle", points: [5, 5], doc: "5 points A à E" },
  projection_de_prix: { type: "forecast", points: [2, 2], doc: "2 points (départ, arrivée)" },
  projection_de_plage: { type: "rangeForecast", points: [3, 3], doc: "3 points : départ, max, min" },
  position_longue: { type: "longPosition", points: [3, 3], doc: "3 points : entrée, objectif (date de sortie, prix), stop (prix)" },
  position_courte: { type: "shortPosition", points: [3, 3], doc: "3 points : entrée, objectif, stop" },
  texte: { type: "text", points: [1, 1], doc: "1 point + « texte »" },
  commentaire: { type: "comment", points: [1, 1], doc: "1 point + « texte »" },
  panneau_indicateur: { type: "signpost", points: [1, 1], doc: "1 point + « texte »" },
  note: { type: "note", points: [2, 2], doc: "2 points (ancre, note) + « texte »" },
  note_de_prix: { type: "priceNote", points: [2, 2], doc: "2 points (ancre, note) + « texte »" },
  epingle: { type: "pin", points: [1, 1], doc: "1 point (texte facultatif)" },
  drapeau: { type: "flagMark", points: [1, 1], doc: "1 point" },
  etiquette_de_prix: { type: "priceLabel", points: [2, 2], doc: "2 points (prix visé, étiquette)" },
  tableau: { type: "table", points: [2, 2], doc: "2 coins + « lignes », « colonnes », « cellules »" },
};

const LINE_STYLES: Record<string, TrendLineDrawing["lineStyle"]> = { plein: "solid", tirets: "dashed", pointilles: "dotted", tiret_point: "dashdot" };
const EXTENDS: Record<string, TrendLineDrawing["extend"]> = { aucune: "none", gauche: "left", droite: "right", deux_cotes: "both" };

const POINT_SCHEMA = {
  type: "object",
  properties: {
    date: { type: "string", description: DATE_DOC },
    prix: { type: "number", description: "Prix (ou valeur sur l'échelle du panneau visé)." },
  },
  additionalProperties: false,
};

const STYLE_PROPS = {
  couleur: { type: "string", description: "Couleur CSS du trait (ex. « #d64545 », « red »)." },
  epaisseur: { type: "number", minimum: 1, maximum: 4, description: "Épaisseur du trait, en pixels (1 à 4)." },
  style_de_ligne: { type: "string", enum: Object.keys(LINE_STYLES), description: "plein, tirets, pointilles, tiret_point." },
  extension: { type: "string", enum: Object.keys(EXTENDS), description: "Prolonger une ligne libre ou un rectangle : aucune, gauche, droite, deux_cotes." },
  texte: { type: "string", description: "Texte du dessin (libellé d'une ligne, contenu d'un texte, d'une note…)." },
  couleur_du_texte: { type: "string", description: "Couleur du texte." },
  taille_du_texte: { type: "number", minimum: 8, maximum: 48, description: "Taille du texte, en pixels." },
  couleur_de_remplissage: { type: "string", description: "Fond d'un rectangle, d'un canal, d'une zone (CSS, transparence acceptée)." },
  verrouille: { type: "boolean", description: "Verrouillé : ne peut plus être déplacé à la souris." },
  masque: { type: "boolean", description: "Masqué (gardé mais pas dessiné)." },
} as const;

/** Les réglages de style communs aux deux outils, lus depuis l'entrée. */
function stylePatch(input: Record<string, unknown>): { patch: Partial<TrendLineDrawing>; error?: string } {
  const patch: Partial<TrendLineDrawing> = {};
  const color = str(input, "couleur");
  if (color) patch.color = color;
  const width = num(input, "epaisseur");
  if (width !== undefined) patch.strokeWidth = Math.max(1, Math.min(4, width));
  const style = str(input, "style_de_ligne");
  if (style !== undefined) {
    if (!LINE_STYLES[style]) return { patch, error: `style_de_ligne : ${Object.keys(LINE_STYLES).join(", ")}` };
    patch.lineStyle = LINE_STYLES[style];
    patch.dashed = style !== "plein";
  }
  const ext = str(input, "extension");
  if (ext !== undefined) {
    if (!EXTENDS[ext]) return { patch, error: `extension : ${Object.keys(EXTENDS).join(", ")}` };
    patch.extend = EXTENDS[ext];
  }
  const text = str(input, "texte");
  if (text !== undefined) patch.text = text;
  const textColor = str(input, "couleur_du_texte");
  if (textColor) patch.textColor = textColor;
  const textSize = num(input, "taille_du_texte");
  if (textSize !== undefined) patch.textSize = textSize;
  const fill = str(input, "couleur_de_remplissage");
  if (fill) patch.fillColor = fill;
  const locked = bool(input, "verrouille");
  if (locked !== undefined) patch.locked = locked;
  const hidden = bool(input, "masque");
  if (hidden !== undefined) patch.hidden = hidden;
  return { patch };
}

type Pt = { x: Date; y: number };

/** Les points donnés par le modèle ; la date manquante d'une ligne horizontale vaut la première bougie. */
function readPoints(chart: AiChartContext, raw: unknown, needDate: boolean, needPrice: boolean): { points: Pt[]; error?: string } {
  if (!Array.isArray(raw)) return { points: [], error: "« points » doit être une liste de { date, prix }." };
  const points: Pt[] = [];
  for (const [i, p] of raw.entries()) {
    const o = p && typeof p === "object" ? (p as Record<string, unknown>) : {};
    const date = parseDate(o.date);
    const price = num(o, "prix");
    if (needDate && !date) return { points, error: `Point ${i + 1} : date manquante ou illisible. ${DATE_DOC}` };
    if (needPrice && price === undefined) return { points, error: `Point ${i + 1} : prix manquant.` };
    points.push({ x: date ?? chart.data[0]?.date ?? new Date(), y: price ?? 0 });
  }
  return { points };
}

/** Écart de prix entre un point et la droite p1→p2 à sa date (le 3e clic de l'outil Canal). */
function channelOffset(chart: AiChartContext, p1: Pt, p2: Pt, p3: Pt): number {
  const i1 = barIndexOf(chart.data, p1.x);
  const i2 = barIndexOf(chart.data, p2.x);
  const i3 = barIndexOf(chart.data, p3.x);
  const at = i2 === i1 ? p1.y : p1.y + ((p2.y - p1.y) * (i3 - i1)) / (i2 - i1);
  return Math.round((p3.y - at) * 10000) / 10000;
}

const shapeOf = (d: TrendLineDrawing): string => {
  const key = d.lineType ?? (d.arrowLeft || d.arrowRight ? "arrowLine" : "trendline");
  return Object.entries(SHAPES).find(([, s]) => s.type === key)?.[0] ?? (key === "symbolOverlay" ? "comparaison" : key);
};

/** Une ligne lisible par dessin. */
export function describeDrawing(d: TrendLineDrawing): string {
  const pts = [{ x: d.x1, y: d.y1 }, { x: d.x2, y: d.y2 }, ...(d.extraPoints ?? [])];
  const shape = shapeOf(d);
  const where = d.lineType === "symbolOverlay" ? (d.overlaySymbol ?? "") : pts.map((p) => `${isoDay(p.x)} @ ${fmtNum(p.y)}`).join(" → ");
  const flags = [d.color ? `couleur ${d.color}` : "", d.lineStyle && d.lineStyle !== "solid" ? d.lineStyle : "", d.strokeWidth ? `${d.strokeWidth} px` : "", d.locked ? "verrouillé" : "", d.hidden ? "masqué" : "", d.valueAxis && d.valueAxis !== "price" ? `panneau ${d.valueAxis}` : "", d.channelOffset ? `décalage ${fmtNum(d.channelOffset)}` : ""].filter(Boolean);
  return `- ${d.id} : ${shape} « ${drawingLabel(d)} » ${where}${d.text ? ` — « ${d.text.slice(0, 60)} »` : ""}${flags.length ? ` (${flags.join(", ")})` : ""}`;
}

const DRAW_TOOL: AiTool = {
  definition: {
    name: "dessiner",
    description:
      "Trace un dessin en coordonnées date / prix, comme les outils de la barre de gauche : lignes (tendance, étendue, demi-droite, fléchée, horizontale, rayon horizontal, verticale), canaux (parallèle, disjoint), fourchettes, rectangle, zones, flèches, pinceau, Fibonacci (retracement, extension), vagues d'Elliott, tête et épaules, tasse avec anse, projections, positions longue / courte, texte, commentaire, notes, épingle, drapeau, étiquette de prix, tableau. Rend l'id du dessin (pour gerer_les_dessins). Points attendus par type : " +
      Object.entries(SHAPES)
        .map(([k, s]) => `${k} (${s.doc})`)
        .join(" ; ") +
      ". Ex. : {type:\"ligne_de_tendance\", points:[{date:\"2024-03-01\", prix:170}, {date:\"2024-06-03\", prix:195}], couleur:\"#3b7dd8\"} ; {type:\"canal\", points:[p1, p2], decalage:-12}.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: Object.keys(SHAPES), description: "Le dessin." },
        points: { type: "array", items: POINT_SCHEMA, minItems: 1, maxItems: 200, description: "Les points, dans l'ordre de la barre d'outils." },
        decalage: { type: "number", description: "canal : écart de prix de la parallèle (à la place du 3e point)." },
        panneau: { type: "string", description: "ligne_horizontale, rayon_horizontal : le panneau (« volume » ou id d'un panneau d'indicateur) ; « prix » prend la valeur sur cette échelle. Défaut : prix." },
        lignes: { type: "number", minimum: 1, maximum: 20, description: "tableau : nombre de lignes." },
        colonnes: { type: "number", minimum: 1, maximum: 10, description: "tableau : nombre de colonnes." },
        cellules: { type: "array", items: { type: "string" }, description: "tableau : textes des cellules, ligne par ligne." },
        ...STYLE_PROPS,
      },
      required: ["type", "points"],
      additionalProperties: false,
    },
  },
  run: (input, chart) => {
    const key = str(input, "type") ?? "";
    const shape = SHAPES[key];
    if (!shape) return fail(`Type inconnu. Types : ${Object.keys(SHAPES).join(", ")}.`);
    if (chart.data.length === 0) return fail("Le graphique n'a aucune bougie.");
    const type = shape.type;
    const needDate = type !== "horizontal";
    const needPrice = type !== "vertical";
    const { points, error } = readPoints(chart, input.points, needDate, needPrice);
    if (error) return fail(error);
    const offsetInput = num(input, "decalage");
    const [min, max] = shape.points;
    const required = type === "channel" && offsetInput !== undefined ? 2 : min;
    if (points.length < required || points.length > max) return fail(`${key} : ${shape.doc} (${points.length} donné(s)).`);
    const style = stylePatch(input);
    if (style.error) return fail(style.error);
    const text = str(input, "texte");
    if (["text", "comment", "signpost", "note", "priceNote"].includes(type) && !text) return fail(`${key} : passez « texte ».`);
    const [p1, p2 = p1, ...rest] = points;
    const id = chart.nextDrawingId();
    const base: TrendLineDrawing = { id, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    let drawing: TrendLineDrawing;
    switch (type) {
      case "trendline":
        drawing = { ...base, ...(key === "demi_droite" ? { extend: "right" as const } : {}) };
        break;
      case "arrowLine":
        drawing = { ...base, arrowRight: true };
        break;
      case "horizontal":
      case "ray": {
        const paneArg = str(input, "panneau");
        let valueAxis: string | undefined;
        if (paneArg && chart.controls) {
          const pane = findPane(chart.controls, paneArg);
          if (!pane) return fail(`Panneau « ${paneArg} » introuvable.`);
          if (pane.id !== "price") valueAxis = pane.id;
        }
        const x1 = type === "horizontal" ? chart.data[0].date : p1.x;
        const x2 = type === "horizontal" ? chart.data[chart.data.length - 1].date : p1.x;
        drawing = { id, x1, y1: p1.y, x2, y2: p1.y, lineType: type, ...(valueAxis ? { valueAxis } : {}) };
        break;
      }
      case "vertical": {
        const lows = chart.data.map((c) => c.low);
        const highs = chart.data.map((c) => c.high);
        drawing = { id, x1: p1.x, y1: Math.min(...lows), x2: p1.x, y2: Math.max(...highs), lineType: "vertical" };
        break;
      }
      case "arrowUp":
      case "arrowDown":
      case "pin":
      case "flagMark":
      case "text":
      case "comment":
      case "signpost":
        drawing = { id, x1: p1.x, y1: p1.y, x2: p1.x, y2: p1.y, lineType: type, ...(type === "text" ? { textHorizontalAlign: "left" as const, textVerticalAlign: "bottom" as const } : {}) };
        break;
      case "note":
      case "priceNote":
        drawing = { ...base, lineType: type, textHorizontalAlign: "left", textVerticalAlign: "top" };
        break;
      case "channel":
        drawing = { ...base, lineType: "channel", channelOffset: offsetInput ?? channelOffset(chart, p1, p2, points[2]) };
        break;
      case "longPosition":
      case "shortPosition":
        drawing = { ...base, lineType: type, extraPoints: [{ x: p2.x, y: rest[0].y }] };
        break;
      case "table": {
        const rows = Math.round(num(input, "lignes") ?? 3);
        const cols = Math.round(num(input, "colonnes") ?? 2);
        const cells = (Array.isArray(input.cellules) ? input.cellules : []).map((c) => String(c));
        drawing = { ...base, lineType: "table", tableRows: rows, tableCols: cols, tableCells: cells };
        break;
      }
      default:
        drawing = { ...base, lineType: type as TrendLineDrawing["lineType"], ...(rest.length > 0 ? { extraPoints: rest } : {}) };
    }
    drawing = { ...drawing, ...style.patch };
    if (chart.timeframe) drawing.timeframe = chart.timeframe;
    chart.commitDrawings([...chart.drawings(), drawing]);
    return ok(`Dessin créé : ${describeDrawing(drawing).slice(2)}. Pour le modifier ou le supprimer : gerer_les_dessins avec l'id « ${id} ».`);
  },
};

const MANAGE_ACTIONS = ["lister", "modifier", "dupliquer", "supprimer", "selectionner", "supprimer_la_selection", "tout_supprimer", "masquer_tout", "afficher_tout", "verrouiller_tout", "deverrouiller_tout"] as const;

const MANAGE_TOOL: AiTool = {
  definition: {
    name: "gerer_les_dessins",
    description:
      "Liste et modifie les dessins du graphique : « lister » (id, type, points, style), « modifier » un ou plusieurs dessins (couleur, épaisseur, style de ligne, extension, texte, remplissage, verrouillage, masquage, ou ses points), « dupliquer », « supprimer » (par ids), « selectionner » (un ou plusieurs ids, comme Ctrl + glisser ; ids vide = rien de sélectionné), « supprimer_la_selection » (les dessins sélectionnés par l'utilisateur ou par « selectionner »), « tout_supprimer », et pour tous les dessins à la fois : masquer_tout / afficher_tout (bouton œil), verrouiller_tout / deverrouiller_tout (cadenas). Ex. : {action:\"modifier\", ids:[\"drawing-4\"], couleur:\"#d64545\", style_de_ligne:\"tirets\", verrouille:true}.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: MANAGE_ACTIONS, description: "Ce qu'il faut faire." },
        ids: { type: "array", items: { type: "string" }, description: "Ids des dessins visés (modifier, dupliquer, supprimer, selectionner)." },
        points: { type: "array", items: POINT_SCHEMA, description: "modifier : nouveaux points (mêmes règles que dessiner)." },
        ...STYLE_PROPS,
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  run: (input, chart) => {
    const action = str(input, "action");
    const drawings = chart.drawings();
    const own = drawings.filter((d) => d.lineType !== "symbolOverlay");
    const ids = (Array.isArray(input.ids) ? input.ids : []).filter((x): x is string => typeof x === "string");
    const c = chart.controls;
    switch (action) {
      case "lister": {
        const selected = c?.selectedDrawings() ?? [];
        return ok(
          `${own.length} dessin(s)${c ? ` — tous ${c.drawingsHidden() ? "masqués" : "affichés"}, ${c.drawingsLocked() ? "verrouillés" : "déverrouillés"}` : ""} :\n${own.map(describeDrawing).join("\n") || "aucun"}${selected.length > 0 ? `\nSélectionné(s) : ${selected.join(", ")}.` : ""}`,
        );
      }
      case "supprimer_la_selection": {
        if (!c) return fail("Commande indisponible ici.");
        const selected = c.selectedDrawings();
        if (selected.length === 0) return fail("Aucun dessin sélectionné.");
        chart.commitDrawings(drawings.filter((d) => !selected.includes(d.id)));
        c.selectDrawings([]);
        return ok(`Supprimé(s) : ${selected.join(", ")}.`);
      }
      case "tout_supprimer": {
        chart.commitDrawings(drawings.filter((d) => d.lineType === "symbolOverlay"));
        return ok(`${own.length} dessin(s) supprimé(s). Les comparaisons de symboles restent (gerer_les_comparaisons).`);
      }
      case "masquer_tout":
      case "afficher_tout":
        if (!c) return fail("Commande indisponible ici.");
        c.setDrawingsHidden(action === "masquer_tout");
        return ok(action === "masquer_tout" ? "Tous les dessins sont masqués." : "Tous les dessins sont affichés.");
      case "verrouiller_tout":
      case "deverrouiller_tout":
        if (!c) return fail("Commande indisponible ici.");
        c.setDrawingsLocked(action === "verrouiller_tout");
        return ok(action === "verrouiller_tout" ? "Tous les dessins sont verrouillés." : "Les dessins sont déverrouillés.");
    }
    if (action === "selectionner" && ids.length === 0) {
      if (!c) return fail("Commande indisponible ici.");
      c.selectDrawings([]);
      return ok("Plus aucun dessin sélectionné.");
    }
    if (ids.length === 0) return fail("Indiquez « ids » (voir action « lister »).");
    const missing = ids.filter((id) => !drawings.some((d) => d.id === id));
    if (missing.length > 0) return fail(`Dessin(s) introuvable(s) : ${missing.join(", ")}. Dessins : ${own.map((d) => d.id).join(", ") || "aucun"}.`);
    if (action === "selectionner") {
      if (!c) return fail("Commande indisponible ici.");
      c.selectDrawings(ids);
      return ok(`Sélectionné(s) : ${ids.join(", ")}. Suppr les supprime d'un coup.`);
    }
    if (action === "supprimer") {
      chart.commitDrawings(drawings.filter((d) => !ids.includes(d.id)));
      return ok(`Supprimé(s) : ${ids.join(", ")}.`);
    }
    if (action === "dupliquer") {
      const copies = drawings.filter((d) => ids.includes(d.id)).map((d) => ({ ...d, id: chart.nextDrawingId(), locked: false }));
      chart.commitDrawings([...drawings, ...copies]);
      return ok(`Copie(s) créée(s) : ${copies.map((d) => d.id).join(", ")}.`);
    }
    if (action !== "modifier") return fail(`Action inconnue. Actions : ${MANAGE_ACTIONS.join(", ")}.`);
    const style = stylePatch(input);
    if (style.error) return fail(style.error);
    let pointsPatch: Partial<TrendLineDrawing> = {};
    if (input.points !== undefined) {
      const { points, error } = readPoints(chart, input.points, true, true);
      if (error) return fail(error);
      if (points.length === 0) return fail("« points » est vide.");
      const [p1, p2 = p1, ...rest] = points;
      pointsPatch = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, ...(rest.length ? { extraPoints: rest } : {}) };
    }
    const patch = { ...style.patch, ...pointsPatch };
    if (Object.keys(patch).length === 0) return fail("Rien à modifier : passez un réglage de style, « verrouille », « masque » ou « points ».");
    const next = drawings.map((d) => (ids.includes(d.id) ? { ...d, ...patch } : d));
    chart.commitDrawings(next);
    return ok(`Modifié(s) :\n${next.filter((d) => ids.includes(d.id)).map(describeDrawing).join("\n")}`);
  },
};

export const DRAWING_TOOLS: AiTool[] = [DRAW_TOOL, MANAGE_TOOL];
