/**
 * Garde-fous des indicateurs créés par l'assistant (intégré ou piloté par MCP) : un nom ne sert qu'une fois, et un
 * indicateur demandé est posé à un seul endroit — sur les prix OU dans un panneau.
 *
 * Pourquoi dans le code et pas seulement dans les consignes : le premier exemple d'indicateur du manuel (Quant Score)
 * trace un score dans un panneau ET une moyenne sur les prix, et un modèle qui l'imite rendait deux indicateurs pour
 * une demande ; un modèle qui oubliait l'id du script qu'il venait d'ouvrir en créait un second (« Momentum (2) »).
 */

/** Clé de comparaison d'un nom : sans casse, sans accents, sans espaces (« Mon  INDICATEUR » = « monindicateur »). */
export function indicatorNameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

/** Où un indicateur est posé : « prix » (superposé aux bougies) ou « panneau » (sous-panneau à lui). */
export type IndicatorPlacement = "prix" | "panneau";

export interface PlotPlacementAnalysis {
  /** Noms littéraux passés à `plot.overlay("…")`, dans l'ordre, sans doublon. */
  overlayNames: string[];
  /** Noms littéraux passés à `plot.pane("…")`, dans l'ordre, sans doublon. */
  paneNames: string[];
  /** Un `plot.overlay(…)`/`plot.pane(…)` dont le nom n'est pas une chaîne littérale (variable, gabarit). */
  dynamicNames: boolean;
}

/** Les commentaires retirés (sans toucher aux chaînes), pour ne pas compter un `plot.pane` mis en commentaire. */
function withoutComments(code: string): string {
  return code.replace(/("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (_match, str: string | undefined) => str ?? "");
}

/** Lit dans le code (sans l'exécuter) les panneaux et superpositions qu'un script déclare. */
export function analyzePlotPlacement(code: string): PlotPlacementAnalysis {
  const source = withoutComments(code);
  const overlayNames: string[] = [];
  const paneNames: string[] = [];
  let dynamicNames = false;
  const re = /\bplot\s*\.\s*(overlay|pane)\s*\(\s*(?:"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\$]|\\.)*)`|([^)\s]))/g;
  for (let m = re.exec(source); m !== null; m = re.exec(source)) {
    const literal = m[2] ?? m[3] ?? m[4];
    if (literal === undefined) {
      dynamicNames = true;
      continue;
    }
    const list = m[1] === "overlay" ? overlayNames : paneNames;
    if (!list.includes(literal)) list.push(literal);
  }
  return { overlayNames, paneNames, dynamicNames };
}

/** L'emplacement que le code déclare : « prix », « panneau », « les deux », ou null s'il ne trace aucune série. */
export function plotPlacementOf(code: string): IndicatorPlacement | "prix et panneau" | null {
  const { overlayNames, paneNames } = analyzePlotPlacement(code);
  if (overlayNames.length > 0 && paneNames.length > 0) return "prix et panneau";
  if (overlayNames.length > 0) return "prix";
  if (paneNames.length > 0) return "panneau";
  return null;
}

/**
 * Pourquoi ce code d'indicateur n'est pas « un indicateur à un seul endroit », ou null s'il l'est.
 *
 * Refusé : des séries à la fois sur les prix et dans un panneau ; plusieurs superpositions ou plusieurs panneaux de
 * noms différents (un indicateur = un nom ; ses courbes sont plusieurs séries du même handle) ; un emplacement
 * différent de celui qui a été demandé. Les marqueurs (`plot.signal`, `plot.candleColor`, `plot.horizontal`…) ne
 * sont pas des indicateurs et restent permis partout.
 */
export function placementProblem(code: string, wanted?: IndicatorPlacement): string | null {
  const { overlayNames, paneNames } = analyzePlotPlacement(code);
  const quote = (names: string[]) => names.map((n) => `« ${n} »`).join(", ");
  if (overlayNames.length > 0 && paneNames.length > 0) {
    return `Ce code pose DEUX indicateurs : ${quote(overlayNames)} sur les prix (plot.overlay) et ${quote(paneNames)} dans un panneau (plot.pane). Un indicateur demandé = un seul emplacement : gardez soit plot.overlay (emplacement « prix »), soit plot.pane (emplacement « panneau »), pas les deux.`;
  }
  if (overlayNames.length > 1) {
    return `Ce code pose ${overlayNames.length} indicateurs sur les prix (${quote(overlayNames)}). Un indicateur = un seul nom : regroupez les courbes dans un seul handle, par exemple const o = plot.overlay("${overlayNames[0]}"); o.line("Courbe 1", v1); o.line("Courbe 2", v2);`;
  }
  if (paneNames.length > 1) {
    return `Ce code ouvre ${paneNames.length} panneaux (${quote(paneNames)}). Un indicateur = un seul panneau : regroupez les courbes dans un seul handle, par exemple const p = plot.pane("${paneNames[0]}"); p.line("Courbe 1", v1); p.line("Courbe 2", v2);`;
  }
  if (wanted === "prix" && paneNames.length > 0) {
    return `L'emplacement demandé est « prix » (superposé aux bougies), mais ce code trace dans un panneau (plot.pane). Utilisez plot.overlay("Nom"), ou passez emplacement « panneau ».`;
  }
  if (wanted === "panneau" && overlayNames.length > 0) {
    return `L'emplacement demandé est « panneau », mais ce code trace sur les prix (plot.overlay). Utilisez plot.pane("Nom"), ou passez emplacement « prix ».`;
  }
  return null;
}
