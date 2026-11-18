import type { AiTool, AiToolOutcome } from "./aiTools";
import type { AiChartContext } from "./interfaces/AiChartContext.interface";
import type { AiChartControls, AiPaneInfo } from "./aiChartControls";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { PriceScaleMode } from "../interfaces/PriceScaleMode.interface";
import type { ChartStyleSettings } from "../chartStyle";
import { CANVAS_STYLE_KEYS } from "../chartStyle";
import { DATE_DOC, barIndexOf, bool, candleAt, fail, fmtNum, isoDay, num, ok, parseDate, str } from "./toolHelpers";
import { wait } from "./uiControl";

/**
 * Outils de contrôle du graphique : navigation dans le temps, axes, apparence, réglages des indicateurs et des
 * panneaux, modèles, style conditionnel, type de graphique, alertes, affichage, annuler / rétablir. Chacun passe par
 * `chart.controls` (les fonctions que les boutons, menus et gestes du graphique appellent déjà) et rend un résultat
 * explicite ; une cible inconnue revient en erreur avec ce qui existe.
 */

/** Durée de l'animation d'un changement de vue, attendue avant de relire la vue obtenue. */
const VIEW_SETTLE_MS = 450;

const noControls = (): AiToolOutcome => fail("Ce graphique ne propose pas ces commandes ici (graphique non affiché).");

/** La vue en mots : dates des bougies visibles et leur nombre. */
export function describeView(chart: AiChartContext, controls: AiChartControls): string {
  const v = controls.view();
  const n = chart.data.length;
  if (n === 0) return "Aucune bougie.";
  const first = candleAt(chart.data, Math.max(0, Math.ceil(v.start)));
  const last = candleAt(chart.data, Math.min(n - 1, Math.floor(v.end) - 1));
  const shown = Math.max(0, Math.min(n, Math.floor(v.end)) - Math.max(0, Math.ceil(v.start)));
  const future = v.end > n ? ` (+${Math.round(v.end - n)} bougies d'espace à droite)` : "";
  return `Vue : du ${isoDay(first?.date)} au ${isoDay(last?.date)}, ${shown} bougie(s) visible(s) sur ${n}${future}.`;
}

/** Le panneau désigné par le modèle : « prix »/« price », « volume », l'id d'un panneau ou son nom. */
export function findPane(controls: AiChartControls, raw: string | undefined): AiPaneInfo | null {
  const panes = controls.panes();
  const q = (raw ?? "price").trim().toLowerCase();
  if (q === "prix" || q === "price" || q === "") return panes.find((p) => p.id === "price") ?? null;
  return panes.find((p) => p.id.toLowerCase() === q) ?? panes.find((p) => p.label.toLowerCase() === q) ?? panes.find((p) => p.label.toLowerCase().includes(q)) ?? null;
}
const paneList = (controls: AiChartControls): string =>
  controls
    .panes()
    .map((p) => `« ${p.id} » (${p.label})`)
    .join(", ");

const PANE_DOC = "Le panneau : « prix » (le graphique des prix), « volume », ou l'id d'un panneau d'indicateur (voir decrire_le_graphique, partie panneaux).";

// ─── Navigation ────────────────────────────────────────────────────────────────────────────────────────────────

const NAV_ACTIONS = ["aller_a_la_date", "defiler", "zoomer", "afficher_la_plage", "afficher_les_dernieres_bougies", "reinitialiser"] as const;

const NAVIGATE_TOOL: AiTool = {
  definition: {
    name: "naviguer_dans_le_temps",
    description:
      "Déplace la vue du graphique dans le temps, comme la souris : aller à une date, défiler de N bougies, zoomer ou dézoomer, afficher une plage de dates, afficher les N dernières bougies, ou revenir à la vue d'ouverture (loupe « − »). Les fenêtres liées suivent. Rend la période visible obtenue. Ex. : {action:\"afficher_la_plage\", debut:\"2024-01-01\", fin:\"2024-06-30\"} ; {action:\"zoomer\", facteur:2} ; {action:\"defiler\", barres:-50}.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: NAV_ACTIONS,
          description:
            "aller_a_la_date (date, position) ; defiler (barres : positif = vers le récent, négatif = vers le passé) ; zoomer (facteur > 1 = zoom avant, < 1 = zoom arrière ; centré sur « date » si donnée) ; afficher_la_plage (debut, fin) ; afficher_les_dernieres_bougies (barres) ; reinitialiser (vue d'ouverture, axes Y en automatique).",
        },
        date: { type: "string", description: DATE_DOC },
        debut: { type: "string", description: `Début de la plage. ${DATE_DOC}` },
        fin: { type: "string", description: `Fin de la plage. ${DATE_DOC}` },
        barres: { type: "number", description: "Nombre de bougies (defiler : signé ; afficher_les_dernieres_bougies : 5 à 5000)." },
        facteur: { type: "number", exclusiveMinimum: 0, description: "Zoom : 2 = deux fois moins de bougies visibles, 0.5 = deux fois plus." },
        position: { type: "string", enum: ["centre", "gauche", "droite"], description: "aller_a_la_date : où placer la date dans la vue. Défaut centre." },
        barres_visibles: { type: "number", description: "aller_a_la_date : nombre de bougies à montrer autour de la date. Défaut : la largeur actuelle." },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    const c = chart.controls;
    if (!c) return noControls();
    const n = chart.data.length;
    if (n === 0) return fail("Le graphique n'a aucune bougie.");
    const action = str(input, "action");
    const v = c.view();
    const width = Math.max(2, v.end - v.start);
    switch (action) {
      case "aller_a_la_date": {
        const date = parseDate(input.date);
        if (!date) return fail(`Date manquante ou illisible. ${DATE_DOC}`);
        const i = barIndexOf(chart.data, date);
        const w = Math.max(2, num(input, "barres_visibles") ?? width);
        const pos = str(input, "position") ?? "centre";
        const start = pos === "gauche" ? i - 1 : pos === "droite" ? i + 2 - w : i + 0.5 - w / 2;
        c.setView(start, start + w);
        break;
      }
      case "defiler": {
        const bars = num(input, "barres");
        if (bars === undefined || bars === 0) return fail("Indiquez « barres » (positif vers le récent, négatif vers le passé).");
        c.setView(v.start + bars, v.end + bars);
        break;
      }
      case "zoomer": {
        const f = num(input, "facteur");
        if (f === undefined || f <= 0) return fail("Indiquez « facteur » (> 1 zoom avant, < 1 zoom arrière).");
        const date = parseDate(input.date);
        const center = date ? barIndexOf(chart.data, date) + 0.5 : (v.start + v.end) / 2;
        const w = Math.max(2, width / f);
        c.setView(center - w / 2, center + w / 2);
        break;
      }
      case "afficher_la_plage": {
        const from = parseDate(input.debut);
        const to = parseDate(input.fin);
        if (!from || !to) return fail(`Indiquez « debut » et « fin ». ${DATE_DOC}`);
        const a = barIndexOf(chart.data, from <= to ? from : to);
        const b = barIndexOf(chart.data, from <= to ? to : from);
        c.setView(a, Math.max(a + 2, b + 1));
        break;
      }
      case "afficher_les_dernieres_bougies": {
        const bars = Math.round(num(input, "barres") ?? 100);
        if (bars < 2) return fail("« barres » doit valoir au moins 2.");
        c.setView(Math.max(0, n - bars), n);
        break;
      }
      case "reinitialiser":
        c.resetView();
        break;
      default:
        return fail(`Action inconnue. Actions : ${NAV_ACTIONS.join(", ")}.`);
    }
    await wait(VIEW_SETTLE_MS);
    return ok(describeView(chart, c));
  },
};

// ─── Axes ──────────────────────────────────────────────────────────────────────────────────────────────────────

const Y_AXIS_TOOL: AiTool = {
  definition: {
    name: "regler_l_axe_vertical",
    description:
      "Règle l'axe vertical (Y) d'un panneau, comme un glisser sur son axe ou un double-clic : « plage » fixe ses bornes (min, max, dans l'unité du panneau : prix, volume, valeur de l'indicateur) ; « auto » le rend automatique (double-clic : il suit les bougies visibles) ; « tout_auto » remet tous les axes en automatique. Rend les bornes affichées. Ex. : {panneau:\"prix\", action:\"plage\", min:150, max:200}.",
    inputSchema: {
      type: "object",
      properties: {
        panneau: { type: "string", description: `${PANE_DOC} Défaut « prix ».` },
        action: { type: "string", enum: ["plage", "auto", "tout_auto"], description: "plage (min et max requis), auto ou tout_auto." },
        min: { type: "number", description: "Valeur en bas du panneau (plage)." },
        max: { type: "number", description: "Valeur en haut du panneau (plage), plus grande que min." },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    const c = chart.controls;
    if (!c) return noControls();
    const action = str(input, "action");
    if (action === "tout_auto") {
      c.resetPaneRange(null);
      await wait(60);
      return ok("Tous les axes verticaux sont en automatique.");
    }
    const pane = findPane(c, str(input, "panneau"));
    if (!pane) return fail(`Panneau « ${str(input, "panneau")} » introuvable. Panneaux : ${paneList(c)}.`);
    if (action === "auto") {
      c.resetPaneRange(pane.id);
      await wait(60);
      const after = c.panes().find((p) => p.id === pane.id);
      return ok(`Axe de « ${pane.label} » en automatique${after?.range ? ` : ${fmtNum(after.range.min)} → ${fmtNum(after.range.max)}` : ""}.`);
    }
    if (action !== "plage") return fail("Action inconnue : plage, auto ou tout_auto.");
    const min = num(input, "min");
    const max = num(input, "max");
    if (min === undefined || max === undefined || max <= min) return fail("Indiquez « min » et « max » (max plus grand que min).");
    if (pane.collapsed) return fail(`Le panneau « ${pane.label} » est replié : dépliez-le d'abord (regler_panneau).`);
    if (pane.id === "price" && chart.drawings().some((d) => d.lineType === "symbolOverlay"))
      return fail("Avec des symboles de comparaison superposés, l'axe des prix s'ajuste seul (en %) : retirez les comparaisons pour fixer ses bornes.");
    if (!c.setPaneRange(pane.id, min, max)) return fail(`Impossible de régler l'axe de « ${pane.label} » (panneau non affiché, ou bornes impossibles en échelle logarithmique).`);
    await wait(60);
    const after = c.panes().find((p) => p.id === pane.id);
    return ok(`Axe de « ${pane.label} » réglé à la main : ${after?.range ? `${fmtNum(after.range.min)} → ${fmtNum(after.range.max)}` : `${min} → ${max}`}. Pour revenir à l'automatique : action « auto ».`);
  },
};

const SCALE_MODES: Record<string, PriceScaleMode> = { lineaire: "linear", logarithmique: "log", pourcentage: "percent" };
const SCALE_NAMES: Record<PriceScaleMode, string> = { linear: "linéaire", log: "logarithmique", percent: "en %" };

const AXES_TOOL: AiTool = {
  definition: {
    name: "regler_les_axes",
    description:
      "Règle l'échelle et l'affichage des axes (clic droit sur l'axe des prix, paramètres Échelles) : mode de l'échelle des prix (linéaire, logarithmique, en % depuis la première bougie visible), ajustement automatique aux bougies visibles, axes affichés ou masqués (prix, temps, panneaux) et côté de l'axe des prix. Ne passez que ce qui change. Ex. : {mode:\"logarithmique\"} ; {axe_du_temps:false}.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: Object.keys(SCALE_MODES), description: "Échelle des prix." },
        ajustement_auto: { type: "boolean", description: "Vrai : l'axe des prix suit les bougies visibles ; faux : échelle fixe sur tout l'historique." },
        axe_des_prix: { type: "boolean", description: "Afficher l'axe des prix." },
        axe_du_temps: { type: "boolean", description: "Afficher l'axe du temps (dates)." },
        axes_des_panneaux: { type: "boolean", description: "Afficher les axes des panneaux (volume, indicateurs)." },
        cote_de_l_axe: { type: "string", enum: ["droite", "gauche"], description: "Côté de l'axe des prix." },
      },
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    const c = chart.controls;
    if (!c) return noControls();
    const done: string[] = [];
    const mode = str(input, "mode");
    if (mode !== undefined) {
      const m = SCALE_MODES[mode];
      if (!m) return fail(`Mode inconnu. Modes : ${Object.keys(SCALE_MODES).join(", ")}.`);
      c.setPriceScaleMode(m);
      done.push(`échelle ${SCALE_NAMES[m]}${m === "log" && chart.data.some((d) => d.low <= 0) ? " (demandée ; une série avec des valeurs nulles ou négatives reste linéaire)" : ""}`);
    }
    const auto = bool(input, "ajustement_auto");
    if (auto !== undefined) {
      c.setAutoFit(auto);
      done.push(auto ? "ajustement automatique activé" : "ajustement automatique coupé");
    }
    const patch: Partial<ChartStyleSettings> = {};
    const priceAxis = bool(input, "axe_des_prix");
    const timeAxis = bool(input, "axe_du_temps");
    const paneAxes = bool(input, "axes_des_panneaux");
    const side = str(input, "cote_de_l_axe");
    if (priceAxis !== undefined) patch.priceAxisVisible = priceAxis;
    if (timeAxis !== undefined) patch.timeAxisVisible = timeAxis;
    if (paneAxes !== undefined) patch.paneAxesVisible = paneAxes;
    if (side === "droite" || side === "gauche") patch.priceAxisSide = side === "gauche" ? "left" : "right";
    if (Object.keys(patch).length > 0) {
      c.patchStyle(patch);
      done.push(
        [
          priceAxis !== undefined ? `axe des prix ${priceAxis ? "affiché" : "masqué"}` : "",
          timeAxis !== undefined ? `axe du temps ${timeAxis ? "affiché" : "masqué"}` : "",
          paneAxes !== undefined ? `axes des panneaux ${paneAxes ? "affichés" : "masqués"}` : "",
          patch.priceAxisSide ? `axe des prix à ${side}` : "",
        ]
          .filter(Boolean)
          .join(", "),
      );
    }
    if (done.length === 0) return fail("Rien à régler : passez mode, ajustement_auto, axe_des_prix, axe_du_temps, axes_des_panneaux ou cote_de_l_axe.");
    await wait(60);
    return ok(`Axes : ${done.join(" ; ")}.`);
  },
};

// ─── Apparence ─────────────────────────────────────────────────────────────────────────────────────────────────

const LINE_STYLES = ["solid", "dashed", "dotted"];
type StyleKeyDoc = { type: "string" | "boolean" | "number"; enum?: readonly string[]; description: string };
const STYLE_KEYS: Partial<Record<keyof ChartStyleSettings, StyleKeyDoc>> = {
  wickUpColor: { type: "string", description: "Mèches haussières (couleur CSS)." },
  wickDownColor: { type: "string", description: "Mèches baissières." },
  borderUpColor: { type: "string", description: "Bordures haussières." },
  borderDownColor: { type: "string", description: "Bordures baissières." },
  legendSymbol: { type: "boolean", description: "Ligne d'état : nom du symbole." },
  legendDescription: { type: "boolean", description: "Ligne d'état : type de graphique." },
  legendOhlc: { type: "boolean", description: "Ligne d'état : valeurs O H L C." },
  legendChange: { type: "boolean", description: "Ligne d'état : variation." },
  legendVolume: { type: "boolean", description: "Ligne d'état : volume." },
  legendIndicatorValues: { type: "boolean", description: "Valeurs des indicateurs dans la légende." },
  legendIndicatorTitles: { type: "boolean", description: "Titres des indicateurs dans la légende." },
  priceAxisVisible: { type: "boolean", description: "Axe des prix affiché." },
  timeAxisVisible: { type: "boolean", description: "Axe du temps affiché." },
  paneAxesVisible: { type: "boolean", description: "Axes des panneaux affichés." },
  priceAxisSide: { type: "string", enum: ["right", "left"], description: "Côté de l'axe des prix." },
  lastPriceLabel: { type: "boolean", description: "Pastille du dernier prix." },
  highLowLabels: { type: "boolean", description: "Pastilles plus haut / plus bas visibles." },
  indicatorAxisLabels: { type: "boolean", description: "Dernière valeur de chaque indicateur sur son axe." },
  countdown: { type: "boolean", description: "Compte à rebours de la bougie (prix en direct)." },
  lastPriceLine: { type: "boolean", description: "Ligne du dernier prix." },
  lastPriceLineStyle: { type: "string", enum: LINE_STYLES, description: "Style de la ligne du dernier prix." },
  lastPriceLineColor: { type: "string", description: "Couleur de la ligne du dernier prix, dans les deux sens (réglage d'avant)." },
  lastPriceLineUpColor: { type: "string", description: "Couleur Hausse de la ligne du dernier prix et de sa pastille sur l'axe : dernier prix au-dessus de la clôture précédente." },
  lastPriceLineDownColor: { type: "string", description: "Couleur Baisse de la ligne du dernier prix et de sa pastille sur l'axe : dernier prix au-dessous de la clôture précédente." },
  seriesLabelBg: { type: "string", description: "Valeurs des séries en « Personnalisée » : une seule couleur de fond pour la pastille du dernier prix et les dernières valeurs des indicateurs (remplace la hausse / baisse)." },
  seriesLabelText: { type: "string", description: "Couleur du texte de ces étiquettes." },
  weekdayOnLabels: { type: "boolean", description: "Jour de la semaine sur l'axe du temps." },
  dateFormat: { type: "string", enum: ["auto", "dd MMM yyyy", "dd/MM/yyyy", "dd/MM/yy", "yyyy-MM-dd", "dd MMM 'yy", "MMM yyyy"], description: "Format des dates." },
  timeFormat: { type: "string", enum: ["auto", "24h", "12h"], description: "Format des heures." },
  backgroundType: { type: "string", enum: ["solid", "gradient"], description: "Toile : fond uni ou dégradé." },
  backgroundColor: { type: "string", description: "Toile : couleur du fond." },
  backgroundColor2: { type: "string", description: "Toile : seconde couleur du dégradé." },
  vertGridVisible: { type: "boolean", description: "Toile : grille verticale." },
  vertGridColor: { type: "string", description: "Toile : couleur de la grille verticale." },
  vertGridStyle: { type: "string", enum: LINE_STYLES, description: "Toile : style de la grille verticale." },
  horzGridVisible: { type: "boolean", description: "Toile : grille horizontale." },
  horzGridColor: { type: "string", description: "Toile : couleur de la grille horizontale." },
  horzGridStyle: { type: "string", enum: LINE_STYLES, description: "Toile : style de la grille horizontale." },
  paneSeparatorColor: { type: "string", description: "Toile : séparateurs entre panneaux." },
  crosshairColor: { type: "string", description: "Toile : couleur du réticule." },
  crosshairStyle: { type: "string", enum: LINE_STYLES, description: "Toile : style du réticule." },
  crosshairWidth: { type: "number", description: "Toile : épaisseur du réticule (px)." },
  scaleTextColor: { type: "string", description: "Toile : couleur du texte des échelles." },
  scaleTextSize: { type: "number", description: "Toile : taille du texte des échelles (px)." },
  haUpColor: { type: "string", description: "Heikin Ashi : corps en hausse." },
  haDownColor: { type: "string", description: "Heikin Ashi : corps en baisse." },
  haBorderUpColor: { type: "string", description: "Heikin Ashi : bordures en hausse." },
  haBorderDownColor: { type: "string", description: "Heikin Ashi : bordures en baisse." },
  haWickUpColor: { type: "string", description: "Heikin Ashi : mèches en hausse." },
  haWickDownColor: { type: "string", description: "Heikin Ashi : mèches en baisse." },
  barUpColor: { type: "string", description: "Barres OHLC : couleur en hausse." },
  barDownColor: { type: "string", description: "Barres OHLC : couleur en baisse." },
  barWidth: { type: "number", description: "Barres OHLC : épaisseur du trait (px)." },
  lineColor: { type: "string", description: "Ligne de clôture : couleur de la ligne." },
  lineWidth: { type: "number", description: "Ligne de clôture : épaisseur (px, défaut 1,5)." },
  lineStyle: { type: "string", enum: LINE_STYLES, description: "Ligne de clôture : style du trait." },
  lineGradient: { type: "boolean", description: "Ligne de clôture : dégradé vertical sur la ligne elle-même (faux : couleur unie)." },
  lineTopColor: { type: "string", description: "Ligne de clôture : couleur du dégradé au point le plus haut de la ligne." },
  lineBottomColor: { type: "string", description: "Ligne de clôture : couleur du dégradé au point le plus bas de la ligne." },
  lineFill: { type: "boolean", description: "Ligne de clôture : remplissage sous la courbe (faux : une simple ligne)." },
  lineFillColor: { type: "string", description: "Ligne de clôture : couleur du remplissage uni, opacité comprise (#rrggbbaa)." },
  lineFillGradient: { type: "boolean", description: "Ligne de clôture : remplissage en dégradé vertical." },
  lineFillTopColor: { type: "string", description: "Ligne de clôture : couleur du haut du dégradé, opacité comprise." },
  lineFillBottomColor: { type: "string", description: "Ligne de clôture : couleur du bas du dégradé, opacité comprise." },
  renkoUpColor: { type: "string", description: "Renko : briques en hausse." },
  renkoDownColor: { type: "string", description: "Renko : briques en baisse." },
  renkoBorderUpColor: { type: "string", description: "Renko : bordures en hausse." },
  renkoBorderDownColor: { type: "string", description: "Renko : bordures en baisse." },
  renkoAtrPeriod: { type: "number", description: "Renko : période de l'ATR qui fixe la taille des briques." },
  lineBreakUpColor: { type: "string", description: "Line Break : lignes en hausse." },
  lineBreakDownColor: { type: "string", description: "Line Break : lignes en baisse." },
  lineBreakBorderUpColor: { type: "string", description: "Line Break : bordures en hausse." },
  lineBreakBorderDownColor: { type: "string", description: "Line Break : bordures en baisse." },
  lineBreakLines: { type: "number", description: "Line Break : nombre de lignes pour un renversement (défaut 3)." },
  scaleLineColor: { type: "string", description: "Toile : couleur des lignes d'échelle." },
  marginTop: { type: "number", description: "Toile : marge haute en % de l'amplitude." },
  marginBottom: { type: "number", description: "Toile : marge basse en %." },
  marginRightBars: { type: "number", description: "Toile : marge à droite, en bougies." },
  resetZoomBars: { type: "number", description: "Toile : nombre de bougies affichées par la réinitialisation du zoom (Espace, double-clic). Défaut 100." },
  watermarkVisibility: { type: "string", enum: ["always", "replay"], description: "Filigrane : toujours, ou seulement pendant un replay." },
  watermarkColor: { type: "string", description: "Couleur du filigrane." },
  navigationButtons: { type: "string", enum: ["always", "hover", "hidden"], description: "Boutons de navigation en bas des prix : toujours, au survol, masqués." },
  paneButtons: { type: "string", enum: ["always", "hover", "hidden"], description: "Boutons des en-têtes de panneaux et des lignes d'indicateurs." },
  colorMode: { type: "string", enum: ["light", "dark"], description: "Mode jour (light) ou nuit (dark) du graphique ; null : suivre le thème du site." },
};
const APPEARANCE_KEYS = {
  couleur_hausse: { type: "string", description: "Couleur des bougies haussières (null : celle du thème)." },
  couleur_baisse: { type: "string", description: "Couleur des bougies baissières." },
  couleur_volume_hausse: { type: "string", description: "Barres de volume haussières." },
  couleur_volume_baisse: { type: "string", description: "Barres de volume baissières." },
  pulsation_cloture: { type: "boolean", description: "Pulsation du dernier point (mode Ligne de clôture)." },
  zone_future: { type: "boolean", description: "Zone hachurée après la dernière bougie." },
  zone_passee: { type: "boolean", description: "Zone hachurée avant la première bougie." },
} as const;

const asSchemaProp = (d: StyleKeyDoc | { type: string; description: string }) => ({
  type: [d.type, "null"],
  ...("enum" in d && d.enum ? { enum: [...d.enum, null] } : {}),
  description: d.description,
});

const APPEARANCE_TOOL: AiTool = {
  definition: {
    name: "regler_apparence",
    description:
      "Règle l'apparence du graphique (fenêtre des paramètres système : Symbole, Ligne d'état, Échelles et lignes, Toile) : couleurs des bougies et du volume, mèches, bordures, légende, pastilles, grille, fond, réticule, marges, formats de date. Ne passez que ce qui change ; null rétablit la valeur par défaut. Sans « reglages » : rend l'apparence actuelle. Ex. : {reglages:{couleur_hausse:\"#2e9d5b\", horzGridVisible:false}}.",
    inputSchema: {
      type: "object",
      properties: {
        reglages: {
          type: "object",
          properties: {
            ...Object.fromEntries(Object.entries(APPEARANCE_KEYS).map(([k, d]) => [k, asSchemaProp(d)])),
            ...Object.fromEntries(Object.entries(STYLE_KEYS).map(([k, d]) => [k, asSchemaProp(d!)])),
          },
          additionalProperties: false,
          description: "Les réglages à changer.",
        },
      },
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    const c = chart.controls;
    if (!c) return noControls();
    const raw = input.reglages;
    if (raw === undefined) return ok(describeAppearance(c));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("« reglages » doit être un objet.");
    const entries = Object.entries(raw as Record<string, unknown>);
    if (entries.length === 0) return fail("« reglages » est vide.");
    const errors: string[] = [];
    const stylePatch: Partial<Record<keyof ChartStyleSettings, unknown>> = {};
    const appearancePatch: Parameters<AiChartControls["setAppearance"]>[0] = {};
    for (const [key, value] of entries) {
      if (key in APPEARANCE_KEYS) {
        const d = APPEARANCE_KEYS[key as keyof typeof APPEARANCE_KEYS];
        if (value !== null && typeof value !== d.type) {
          errors.push(`${key} : ${d.type} attendu`);
          continue;
        }
        if (key === "couleur_hausse") appearancePatch.upColor = (value as string | null) ?? undefined;
        if (key === "couleur_baisse") appearancePatch.downColor = (value as string | null) ?? undefined;
        if (key === "couleur_volume_hausse") appearancePatch.volumeUpColor = (value as string | null) ?? undefined;
        if (key === "couleur_volume_baisse") appearancePatch.volumeDownColor = (value as string | null) ?? undefined;
        if (key === "pulsation_cloture") appearancePatch.closePulse = value === null ? true : (value as boolean);
        if (key === "zone_future") appearancePatch.futureZone = value === null ? false : (value as boolean);
        if (key === "zone_passee") appearancePatch.pastZone = value === null ? false : (value as boolean);
        continue;
      }
      const d = STYLE_KEYS[key as keyof ChartStyleSettings];
      if (!d) {
        errors.push(`${key} : réglage inconnu`);
        continue;
      }
      if (value !== null && typeof value !== d.type) {
        errors.push(`${key} : ${d.type} attendu`);
        continue;
      }
      if (value !== null && d.enum && !d.enum.includes(value as string)) {
        errors.push(`${key} : valeurs possibles ${d.enum.join(", ")}`);
        continue;
      }
      stylePatch[key as keyof ChartStyleSettings] = value;
    }
    if (errors.length > 0) return fail(`Rien n'a été changé. ${errors.join(" ; ")}.`);
    if (Object.keys(appearancePatch).length > 0) c.setAppearance(appearancePatch);
    if (Object.keys(stylePatch).length > 0) c.patchStyle(stylePatch as Partial<ChartStyleSettings>);
    await wait(60);
    const canvasIgnored = !c.advancedAppearance() && Object.keys(stylePatch).some((k) => CANVAS_STYLE_KEYS.includes(k as keyof ChartStyleSettings));
    return ok(
      `Apparence modifiée : ${entries.map(([k, v]) => `${k} = ${v === null ? "défaut" : String(v)}`).join(", ")}.` +
        (canvasIgnored ? " Attention : les réglages de la Toile sont enregistrés mais pas appliqués (personnalisation avancée non incluse dans l'offre)." : ""),
    );
  },
};

function describeAppearance(c: AiChartControls): string {
  const a = c.appearance();
  const style = c.style();
  const lines = [
    `Couleurs : hausse ${a.upColor ?? "thème"}, baisse ${a.downColor ?? "thème"}, volume hausse ${a.volumeUpColor ?? "comme les bougies"}, volume baisse ${a.volumeDownColor ?? "comme les bougies"}.`,
    `Pulsation de clôture ${a.closePulse ? "oui" : "non"}, zone future ${a.futureZone ? "oui" : "non"}, zone passée ${a.pastZone ? "oui" : "non"}.`,
    `Style (réglages changés) : ${Object.keys(style).length ? JSON.stringify(style) : "aucun (rendu par défaut)"}.`,
    `Personnalisation avancée (Toile) : ${c.advancedAppearance() ? "appliquée" : "non incluse"}.`,
  ];
  return lines.join("\n");
}

// ─── Indicateurs ───────────────────────────────────────────────────────────────────────────────────────────────

type FieldType = "number" | "boolean" | "color" | "string" | "object" | "array" | "date" | readonly string[];
const ENUM_FIELDS: Record<string, readonly string[]> = {
  pivotType: ["classic", "fibonacci", "woodie", "camarilla"],
  pivotPeriod: ["daily", "weekly", "monthly"],
  tpoLabelStyle: ["letters", "numbers"],
  fundamentalDisplayMode: ["value", "yoyChange"],
  fundamentalChartStyle: ["line", "step", "area"],
  projectionMethod: ["linear", "quadratic", "mean", "damped", "regression", "holt"],
  expVolTimeframe: ["chart", "15m", "30m", "1h", "4h", "1d"],
};
const BOOLEAN_FIELDS = new Set([
  "macdShowHistogram", "zigzagShowLabels", "pivotShowLastOnly", "chandelierUseClose", "chandelierShowLabels", "chandelierHighlightState",
  "tpoSplitByBlocks", "atrAsPercent", "legendHidden", "projection", "hidden", "macdCrossColors", "zoneShowLabels", "zoneShowMarkers",
  "paneCollapsed", "priceOverlay", "sideAxesVisible", "expVolShowLow", "expVolShowSma", "expVolShowLabels", "expVolShowMedian",
  "rangeShowProbable", "rangeShowLabels", "rangeShowMidline", "srbShowLabels", "srbShowFactors", "rsiZonesEnabled",
  "macdZonesEnabled", "divergences", "divergenceHidden", "divergenceOnPrice", "divergenceShowLabels",
]);
const OBJECT_FIELDS = new Set(["seriesColors", "watermark", "valueFormat", "seriesCross", "rsiZoneLines", "macdZoneLines", "donchianLines", "donchianBackground"]);
const ARRAY_FIELDS = new Set(["fills", "styleRules", "areaFills"]);
const NUMBER_FIELDS = new Set([
  "period", "stdDev", "fastPeriod", "slowPeriod", "signalPeriod", "macdSignalWidth", "zigzagDeviation", "supertrendMultiplier", "sarStep", "sarMax", "gapsMinPercent",
  "ichimokuConversionPeriod", "ichimokuBasePeriod", "ichimokuSpanPeriod", "ichimokuDisplacement", "srMaxLevels", "chandelierMultiplier",
  "tpoBlockMinutes", "tpoRowCount", "tpoValueAreaPercent", "tpoOpacity", "rsiOverbought", "rsiOversold", "rsiUpperColor", "rsiLowerColor", "rsiShowMiddle", "rsiMiddleColor", "rsiZonesLookback", "rsiZonesPeaks", "donchianOffset", "chopUpperThreshold", "chopLowerThreshold",
  "adxThreshold", "correlationStrongThreshold", "projectionBars", "projectionLookback", "projectionDamping", "lineWidth", "zoneOpacity",
  "zonePadBeforeHours", "zonePadAfterHours", "expVolSmaPeriod", "expVolSessions",
  "rangeChopEarly", "rangeChopConfirm", "rangeChopTrend", "rangeAtrPeriod", "rangeVolLookback", "rangeVolPercentile", "rangeVolumeFast", "rangeVolumeSlow",
  "rangeSlopeBars", "rangeBreakoutAtr", "rangeGraceBars", "rangeMinBars", "rangeOpacity",
  "srbMaxZones", "srbSwingSpan", "srbHorizon", "srbAtrPeriod", "srbAdxPeriod", "srbEmaPeriod", "srbSmaPeriod", "srbSmaLongPeriod", "srbBbPeriod", "srbBbStdDev", "srbOpacity",
  "macdZonesPeaks", "divergencePivotLeft", "divergencePivotRight", "divergenceMinBars", "divergenceMaxBars", "divergenceLineWidth",
]);
/** Champs que l'outil ne change pas : identité, type, données calculées ailleurs. */
const LOCKED_FIELDS = new Set(["id", "kind", "customData", "correlationData", "correlationSymbol", "correlationSymbolName", "sourceId", "timeframe"]);

export function indicatorFieldType(field: string): FieldType | null {
  if (LOCKED_FIELDS.has(field)) return null;
  if (ENUM_FIELDS[field]) return ENUM_FIELDS[field];
  if (BOOLEAN_FIELDS.has(field)) return "boolean";
  if (OBJECT_FIELDS.has(field)) return "object";
  if (ARRAY_FIELDS.has(field)) return "array";
  if (field === "recognitionDateLimit") return "date";
  if (field === "expVolTimeZone") return "string";
  if (/color$/i.test(field)) return "color";
  if (NUMBER_FIELDS.has(field)) return "number";
  return null;
}

/** Les champs propres à un type d'indicateur (préfixes des champs de `Indicator`). */
const KIND_PREFIXES: Record<string, string[]> = {
  macd: ["fastPeriod", "slowPeriod", "signalPeriod", "macd", "divergence"],
  bollinger: ["stdDev"],
  donchian: ["donchian"],
  zigzag: ["zigzag"],
  supertrend: ["supertrend"],
  parabolicSar: ["sar"],
  gaps: ["gaps"],
  ichimoku: ["ichimoku"],
  pivotPoints: ["pivot"],
  supportResistance: ["sr"],
  chandelierExit: ["chandelier"],
  expectedVolatility: ["expVol"],
  rangeDetection: ["range"],
  srBounce: ["srb"],
  tpo: ["tpo"],
  rsi: ["rsi", "divergence"],
  rsiZones: ["rsi", "divergence"],
  chop: ["chop"],
  atr: ["atr"],
  adx: ["adx"],
  correlation: ["correlationStrong"],
  patternRecognition: ["recognition"],
  candleRecognition: ["recognition"],
};
const COMMON_FIELDS = ["period", "color", "lineWidth", "hidden", "legendHidden", "valueFormat", "watermark", "projection", "projectionBars", "projectionLookback", "projectionMethod", "projectionDamping", "seriesColors", "styleRules", "areaFills", "priceOverlay", "paneCollapsed", "sideAxesVisible", "zoneOpacity", "zoneShowLabels", "zoneShowMarkers"];

export function settableFieldsFor(indicator: Indicator): string[] {
  const prefixes = KIND_PREFIXES[indicator.kind] ?? (/^fundamental|revenue|eps|pe|margin/i.test(indicator.kind) ? ["fundamental"] : []);
  const all = [...NUMBER_FIELDS, ...BOOLEAN_FIELDS, ...Object.keys(ENUM_FIELDS), ...OBJECT_FIELDS, ...ARRAY_FIELDS, "recognitionDateLimit", "color", "macdHistogramUpColor", "macdHistogramDownColor", "supertrendUpColor", "supertrendDownColor", "sarUpColor", "sarDownColor", "chandelierUpColor", "chandelierDownColor", "adxPlusColor", "adxMinusColor", "macdLineAboveColor", "macdLineBelowColor", "macdSignalColor", "expVolMedianColor", "expVolSmaColor", "expVolTimeZone", "rangeProbableColor", "divergenceBullColor", "divergenceBearColor"];
  const own = all.filter((f) => prefixes.some((p) => f.startsWith(p)));
  return [...new Set([...COMMON_FIELDS, ...own, ...Object.keys(indicator).filter((k) => indicatorFieldType(k) !== null)])];
}

/** Ce qu'un indicateur a de réglé, sans ses données (séries d'un script, symbole de corrélation). */
export function indicatorSettings(indicator: Indicator): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(indicator)) {
    if (k === "customData" || k === "correlationData" || v === undefined) continue;
    out[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
  }
  if (indicator.customData) out.script = { label: indicator.customData.label, type: indicator.customData.type };
  return out;
}

function coerceField(field: string, value: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  const type = indicatorFieldType(field);
  if (type === null) return { ok: false, error: `${field} : champ inconnu ou non modifiable` };
  if (value === null) return { ok: true, value: undefined };
  if (Array.isArray(type)) return type.includes(value as string) ? { ok: true, value } : { ok: false, error: `${field} : valeurs possibles ${type.join(", ")}` };
  switch (type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, error: `${field} : nombre attendu` };
    }
    case "boolean":
      return typeof value === "boolean" ? { ok: true, value } : { ok: false, error: `${field} : vrai ou faux attendu` };
    case "color":
    case "string":
      return typeof value === "string" && value.trim() ? { ok: true, value: value.trim() } : { ok: false, error: `${field} : couleur CSS attendue` };
    case "object":
      return value && typeof value === "object" && !Array.isArray(value) ? { ok: true, value } : { ok: false, error: `${field} : objet attendu` };
    case "array":
      return Array.isArray(value) ? { ok: true, value } : { ok: false, error: `${field} : liste attendue` };
    case "date": {
      const d = parseDate(value);
      return d ? { ok: true, value: d } : { ok: false, error: `${field} : date attendue` };
    }
  }
  return { ok: false, error: `${field} : type inconnu` };
}

export function findIndicator(chart: AiChartContext, id: string | undefined): Indicator | undefined {
  if (!id) return undefined;
  const all = chart.controls?.indicators() ?? chart.indicators;
  const q = id.trim().toLowerCase();
  return all.find((i) => i.id === id) ?? all.find((i) => i.id.toLowerCase() === q) ?? all.find((i) => chart.indicatorLabel(i).toLowerCase() === q);
}
const indicatorList = (chart: AiChartContext): string => (chart.controls?.indicators() ?? chart.indicators).map((i) => `${i.id} (${chart.indicatorLabel(i)})`).join(", ") || "aucun";

const INDICATOR_TOOL: AiTool = {
  definition: {
    name: "regler_indicateur",
    description:
      "Lit ou modifie les réglages d'un indicateur affiché (ceux de sa fenêtre de paramètres : période, couleurs, épaisseur, niveaux, visibilité, légende, projection, format…). action « lire » rend tous ses champs et ceux qu'on peut régler ; « modifier » applique « champ » + « valeur », ou plusieurs champs d'un coup dans « reglages ». null rétablit la valeur par défaut. Ex. : {id:\"rsi-14\", champ:\"rsiOverbought\", valeur:80} ; {id:\"sma-50\", reglages:{period:100, color:\"#d64545\", lineWidth:2}} ; masquer : {id, champ:\"hidden\", valeur:true}. Les entrées d'un script (paramètres @input) se règlent dans sa fenêtre : ouvrir_les_parametres puis interagir_avec_l_interface.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Id de l'indicateur (decrire_le_graphique ou lister_les_indicateurs_existants)." },
        action: { type: "string", enum: ["lire", "modifier"], description: "Défaut : modifier si un réglage est donné, sinon lire." },
        champ: { type: "string", description: "Nom du champ (ex. period, color, lineWidth, rsiOverbought, stdDev, hidden, legendHidden, priceOverlay)." },
        valeur: { type: ["number", "string", "boolean", "object", "array", "null"], description: "Nouvelle valeur du champ." },
        reglages: { type: "object", description: "Plusieurs champs à la fois : { champ: valeur }." },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    const c = chart.controls;
    if (!c) return noControls();
    const indicator = findIndicator(chart, str(input, "id"));
    if (!indicator) return fail(`Aucun indicateur d'id « ${str(input, "id")} ». Affichés : ${indicatorList(chart)}.`);
    const patchIn: Record<string, unknown> = { ...((input.reglages && typeof input.reglages === "object" && !Array.isArray(input.reglages) ? input.reglages : {}) as Record<string, unknown>) };
    const field = str(input, "champ");
    if (field) patchIn[field] = input.valeur === undefined ? null : input.valeur;
    const action = str(input, "action") ?? (Object.keys(patchIn).length > 0 ? "modifier" : "lire");
    if (action === "lire") {
      return ok(
        `${chart.indicatorLabel(indicator)} (id ${indicator.id}) :\n${JSON.stringify(indicatorSettings(indicator), null, 1).slice(0, 6000)}\nChamps réglables : ${settableFieldsFor(indicator).join(", ")}.`,
      );
    }
    if (Object.keys(patchIn).length === 0) return fail("Rien à modifier : passez « champ » et « valeur », ou « reglages ».");
    const patch: Partial<Indicator> = {};
    const errors: string[] = [];
    for (const [k, v] of Object.entries(patchIn)) {
      const r = coerceField(k, v);
      if (r.ok) (patch as Record<string, unknown>)[k] = r.value;
      else errors.push(r.error);
    }
    if (errors.length > 0) return fail(`Rien n'a été changé. ${errors.join(" ; ")}. Champs réglables pour cet indicateur : ${settableFieldsFor(indicator).join(", ")}.`);
    if (!c.patchIndicator(indicator.id, patch)) return fail(`Impossible de modifier « ${chart.indicatorLabel(indicator)} ».`);
    await wait(60);
    const after = findIndicator(chart, indicator.id) ?? indicator;
    return ok(`${chart.indicatorLabel(after)} (id ${indicator.id}) modifié : ${Object.entries(patchIn).map(([k, v]) => `${k} = ${v === null ? "défaut" : JSON.stringify(v)}`).join(", ")}.`);
  },
};

const PANE_ACTIONS = [
  "replier", "deplier", "plein_ecran", "quitter_plein_ecran", "deplacer", "replier_la_legende", "deplier_la_legende", "masquer_la_legende", "afficher_la_legende",
  "superposer_aux_prix", "separer_des_prix",
] as const;

const PANE_TOOL: AiTool = {
  definition: {
    name: "regler_panneau",
    description:
      "Agit sur un panneau du graphique, comme son en-tête et sa légende : le replier ou le déplier, le passer en plein écran (dans le graphique) ou en sortir, le déplacer dans l'ordre des panneaux du bas (position 0 = juste sous les prix), replier ou déplier la liste des indicateurs de sa légende, masquer ou réafficher sa légende, et superposer ses séries au graphique des prix (volume ou indicateur) ou les remettre dans leur panneau. Pour l'axe Y du panneau : regler_l_axe_vertical. Pour ses réglages : regler_indicateur ou ouvrir_les_parametres.",
    inputSchema: {
      type: "object",
      properties: {
        panneau: { type: "string", description: PANE_DOC },
        action: { type: "string", enum: PANE_ACTIONS, description: "Ce qu'il faut faire." },
        position: { type: "number", description: "deplacer : nouvelle position parmi les panneaux du bas (0 = le premier sous les prix)." },
      },
      required: ["panneau", "action"],
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    const c = chart.controls;
    if (!c) return noControls();
    const pane = findPane(c, str(input, "panneau"));
    if (!pane) return fail(`Panneau « ${str(input, "panneau")} » introuvable. Panneaux : ${paneList(c)}.`);
    const action = str(input, "action");
    let message: string;
    switch (action) {
      case "replier":
      case "deplier":
        if (pane.kind === "prix") return fail("Le panneau des prix ne se replie pas.");
        if (!c.setPaneCollapsed(pane.id, action === "replier")) return fail(`« ${pane.label} » ne peut pas être replié ici (panneau latéral ?).`);
        message = `« ${pane.label} » ${action === "replier" ? "replié" : "déplié"}.`;
        break;
      case "plein_ecran":
      case "quitter_plein_ecran":
        if (pane.fullscreen !== (action === "plein_ecran")) c.togglePaneFullscreen(pane.id);
        message = action === "plein_ecran" ? `« ${pane.label} » occupe tout le graphique.` : "Tous les panneaux sont de nouveau affichés.";
        break;
      case "deplacer": {
        const position = num(input, "position");
        if (position === undefined) return fail("Indiquez « position » (0 = juste sous les prix).");
        if (!c.movePane(pane.id, position)) return fail(`« ${pane.label} » ne se déplace pas (seuls les panneaux du bas se réordonnent).`);
        message = `« ${pane.label} » déplacé en position ${Math.round(position)}.`;
        break;
      }
      case "replier_la_legende":
      case "deplier_la_legende":
        if (pane.legendCollapsed !== (action === "replier_la_legende")) c.toggleLegendCollapsed(pane.id);
        message = `Légende de « ${pane.label} » ${action === "replier_la_legende" ? "repliée" : "dépliée"}.`;
        break;
      case "masquer_la_legende":
      case "afficher_la_legende":
        if (!c.setLegendHidden(pane.id, action === "masquer_la_legende")) return fail(`Légende de « ${pane.label} » introuvable.`);
        message = `Légende de « ${pane.label} » ${action === "masquer_la_legende" ? "masquée" : "affichée"}.`;
        break;
      case "superposer_aux_prix":
      case "separer_des_prix": {
        const on = action === "superposer_aux_prix";
        if (pane.kind === "prix") return fail("Choisissez le panneau du volume ou d'un indicateur.");
        if (pane.kind === "volume") c.setVolumeOverlay(on);
        else if (!c.patchIndicator(pane.id, { priceOverlay: on })) return fail(`« ${pane.label} » ne peut pas être superposé.`);
        message = on ? `« ${pane.label} » est dessiné sur le graphique des prix.` : `« ${pane.label} » retrouve son panneau.`;
        break;
      }
      default:
        return fail(`Action inconnue. Actions : ${PANE_ACTIONS.join(", ")}.`);
    }
    await wait(60);
    return ok(message);
  },
};

// ─── Modèles et style conditionnel ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE_TOOL: AiTool = {
  definition: {
    name: "appliquer_un_modele",
    description:
      "Les modèles de graphique (menu Modèles de l'en-tête : indicateurs, panneaux, volume, scripts actifs) : « lister » les modèles enregistrés, en « appliquer » un (par id ou par nom), ou « enregistrer » la disposition actuelle sous un nom. Un nom déjà pris (sans tenir compte de la casse ni des espaces autour) est refusé, sauf avec remplacer: true, qui écrase ce modèle sans confirmation (il garde son id, sa place et son statut actif ou de démarrage).",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["lister", "appliquer", "enregistrer"], description: "Ce qu'il faut faire." },
        modele: { type: "string", description: "appliquer : id ou nom du modèle." },
        nom: { type: "string", description: "enregistrer : nom du modèle (nouveau, ou existant avec remplacer)." },
        remplacer: { type: "boolean", description: "enregistrer : true pour écraser le modèle existant de ce nom, sans confirmation." },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    const c = chart.controls;
    if (!c) return noControls();
    const templates = c.templates();
    const action = str(input, "action");
    const list = templates.map((t) => `${t.id} « ${t.name} »${t.id === c.activeTemplateId() ? " (actif)" : ""}`).join(", ") || "aucun";
    if (action === "lister") return ok(`Modèles : ${list}.`);
    if (action === "appliquer") {
      const q = (str(input, "modele") ?? "").trim().toLowerCase();
      const t = templates.find((x) => x.id === q) ?? templates.find((x) => x.name.toLowerCase() === q) ?? templates.find((x) => x.name.toLowerCase().includes(q));
      if (!q || !t) return fail(`Modèle « ${str(input, "modele") ?? ""} » introuvable. Modèles : ${list}.`);
      c.loadTemplate(t.id);
      await wait(80);
      return ok(`Modèle « ${t.name} » appliqué.`);
    }
    if (action === "enregistrer") {
      const name = str(input, "nom")?.trim();
      if (!name) return fail("Indiquez « nom ».");
      const existing = templates.find((x) => x.name.trim().toLowerCase() === name.toLowerCase());
      if (existing) {
        if (bool(input, "remplacer") !== true) return fail(`Un modèle « ${existing.name} » existe déjà. Passez remplacer: true pour l'écraser, ou choisissez un autre nom.`);
        c.overwriteTemplate(existing.id);
        await wait(60);
        return ok(`Modèle « ${existing.name} » remplacé par la disposition actuelle.`);
      }
      c.saveTemplateAs(name);
      await wait(60);
      return ok(`Disposition enregistrée comme modèle « ${name} ».`);
    }
    return fail("Action inconnue : lister, appliquer ou enregistrer.");
  },
};

let ruleSeq = 0;
const ruleId = () => `ia-${Date.now().toString(36)}-${(ruleSeq++).toString(36)}`;

const CONDITIONAL_TOOL: AiTool = {
  definition: {
    name: "regler_le_style_conditionnel",
    description:
      "Le style conditionnel : des règles qui colorent les bougies (cible « bougies », Paramètres du graphique → Bougies) ou peignent un indicateur (cible = id de l'indicateur, onglet Style). action « lire » rend les règles ; « ajouter » les ajoute à la fin ; « remplacer » remplace toute la liste ; « effacer » les retire toutes. Règle de bougies : {conditions:[{metric:\"changePrev\", operator:\"gt\", value:3}], combine:\"and\", color:\"#2e9d5b\", wickColor?, borderColor?, recolor?, icon?:{name:\"arrow-up\", position:\"above\"}, name?}. metric : changeOpen, changePrev, range, body, gap (en %), volume (multiple de la moyenne sur period), closeAbove/closeBelow (series:{source:\"indicator\", indicatorId}), highest/lowest (period), bullish/bearish ; operator : gt, lt, between (value2). Règle d'indicateur : {a:{source:\"indicator\"}, condition:\"above\", b:{source:\"value\", value:70}, effect:\"line\"|\"fill\"|\"background\"|\"icon\", color:\"#d64545\", elseColor?, opacity?, c?} ; condition : above, below, gte, lte, crossUp, crossDown, between, outside ; b (ou c) peut aussi être une ligne de niveau de l'indicateur, qui suit ses réglages : {source:\"level\", level:\"upper\"|\"lower\"|\"middle\"} (RSI : surachat, survente, médiane 50 ; CHOP : seuils haut, bas, médiane). L'id de chaque règle est créé s'il manque.",
    inputSchema: {
      type: "object",
      properties: {
        cible: { type: "string", description: "« bougies », ou l'id d'un indicateur affiché." },
        action: { type: "string", enum: ["lire", "ajouter", "remplacer", "effacer"], description: "Ce qu'il faut faire." },
        regles: { type: "array", items: { type: "object" }, description: "Les règles (ajouter, remplacer), dans l'ordre : la première qui s'applique gagne." },
      },
      required: ["cible", "action"],
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    const c = chart.controls;
    if (!c) return noControls();
    const target = str(input, "cible") ?? "";
    const action = str(input, "action");
    const raw = Array.isArray(input.regles) ? (input.regles as unknown[]) : [];
    const rules = raw.filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && !Array.isArray(r)).map((r): Record<string, unknown> => ({ id: typeof r.id === "string" ? r.id : ruleId(), ...r }));
    if ((action === "ajouter" || action === "remplacer") && rules.length === 0) return fail("Passez au moins une règle dans « regles ».");
    if (target === "bougies") {
      const current = c.candleColorRules();
      if (action === "lire") return ok(`Règles des bougies (${current.length}) :\n${JSON.stringify(current, null, 1).slice(0, 6000)}`);
      for (const r of rules) {
        if (!Array.isArray(r.conditions) || typeof r.color !== "string") return fail("Une règle de bougies a besoin de « conditions » (liste) et de « color ».");
      }
      const next = action === "effacer" ? [] : action === "ajouter" ? [...current, ...rules] : rules;
      c.setCandleColorRules(next);
      await wait(60);
      return ok(`Style conditionnel des bougies : ${next.length} règle(s).`);
    }
    const indicator = findIndicator(chart, target);
    if (!indicator) return fail(`Cible « ${target} » introuvable : « bougies » ou l'id d'un indicateur (${indicatorList(chart)}).`);
    const current = indicator.styleRules ?? [];
    if (action === "lire") return ok(`Règles de ${chart.indicatorLabel(indicator)} (${current.length}) :\n${JSON.stringify(current, null, 1).slice(0, 6000)}`);
    for (const r of rules) {
      if (!r.a || !r.condition || !r.b || !r.effect || typeof r.color !== "string") return fail("Une règle d'indicateur a besoin de « a », « condition », « b », « effect » et « color ».");
    }
    const next = action === "effacer" ? [] : action === "ajouter" ? [...current, ...rules] : rules;
    if (!c.patchIndicator(indicator.id, { styleRules: next as unknown as Indicator["styleRules"] })) return fail("Impossible de modifier cet indicateur.");
    await wait(60);
    return ok(`Style conditionnel de ${chart.indicatorLabel(indicator)} : ${next.length} règle(s).`);
  },
};

// ─── Type de graphique, comparaisons ───────────────────────────────────────────────────────────────────────────

const DISPLAY_MODE_NAMES: Record<string, string> = { bougies: "candle", barres: "bar", ligne: "line", heikin_ashi: "heikinAshi", renko: "renko", line_break: "lineBreak" };

const CHART_TYPE_TOOL: AiTool = {
  definition: {
    name: "changer_le_type_de_graphique",
    description: "Change le type de graphique (menu de l'en-tête) : bougies, barres, ligne de clôture, Heikin Ashi, Renko ou Line Break.",
    inputSchema: {
      type: "object",
      properties: { type: { type: "string", enum: Object.keys(DISPLAY_MODE_NAMES), description: "Le type de graphique." } },
      required: ["type"],
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    const c = chart.controls;
    if (!c) return noControls();
    const mode = DISPLAY_MODE_NAMES[str(input, "type") ?? ""];
    const available = c.displayModes();
    if (!mode || !available.some((m) => m.mode === mode)) return fail(`Type inconnu. Types : ${Object.keys(DISPLAY_MODE_NAMES).join(", ")}.`);
    c.setDisplayMode(mode);
    await wait(60);
    return ok(`Type de graphique : ${available.find((m) => m.mode === mode)?.label ?? mode}.`);
  },
};

const COMPARISON_TOOL: AiTool = {
  definition: {
    name: "gerer_les_comparaisons",
    description:
      "Les symboles de comparaison superposés au graphique (le « + » de la recherche de symbole) : « ajouter » des symboles (l'axe des prix passe en % depuis la première bougie visible), « retirer » des symboles, « tout_retirer », ou « lister ». Pour chiffrer l'écart : mesurer_la_performance.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["ajouter", "retirer", "tout_retirer", "lister"], description: "Ce qu'il faut faire." },
        symboles: { type: "array", items: { type: "string" }, maxItems: 8, description: "Tickers de l'application (ex. « ^GSPC », « GC=F »)." },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    const action = str(input, "action");
    const symbols = (Array.isArray(input.symboles) ? input.symboles : []).filter((s): s is string => typeof s === "string" && s.trim() !== "").map((s) => s.trim().toUpperCase());
    const overlays = () => chart.drawings().filter((d) => d.lineType === "symbolOverlay");
    if (action === "lister") return ok(`Comparaisons : ${overlays().map((d) => d.overlaySymbol).join(", ") || "aucune"}.`);
    if (action === "tout_retirer" || action === "retirer") {
      const drop = (sym?: string) => action === "tout_retirer" || symbols.includes((sym ?? "").toUpperCase());
      const removed = overlays().filter((d) => drop(d.overlaySymbol)).map((d) => d.overlaySymbol);
      if (removed.length === 0) return fail(`Aucune comparaison à retirer. Comparaisons : ${overlays().map((d) => d.overlaySymbol).join(", ") || "aucune"}.`);
      chart.commitDrawings(chart.drawings().filter((d) => !(d.lineType === "symbolOverlay" && drop(d.overlaySymbol))));
      return ok(`Comparaison retirée : ${removed.join(", ")}.`);
    }
    if (action !== "ajouter") return fail("Action inconnue : ajouter, retirer, tout_retirer ou lister.");
    if (symbols.length === 0) return fail("Indiquez « symboles ».");
    if (!chart.loadCandles || !chart.addComparison) return fail("Ce graphique ne propose pas la comparaison de symboles.");
    const added: string[] = [];
    const problems: string[] = [];
    for (const symbol of symbols) {
      const candles = await chart.loadCandles(symbol).catch(() => []);
      if (candles.length === 0) {
        problems.push(`${symbol} (pas de données)`);
        continue;
      }
      const points = candles.map((k) => ({ date: k.date, value: k.close, open: k.open, high: k.high, low: k.low }));
      if (chart.addComparison(symbol, symbol, points)) added.push(symbol);
      else problems.push(`${symbol} (déjà superposé)`);
    }
    return added.length > 0
      ? ok(`Superposé au graphique (axe en %) : ${added.join(", ")}.${problems.length ? ` Non ajouté : ${problems.join(", ")}.` : ""}`)
      : fail(`Aucune comparaison ajoutée : ${problems.join(", ")}.`);
  },
};

// ─── Alertes, affichage, historique ────────────────────────────────────────────────────────────────────────────

const CROSSINGS = ["crossing", "crossingUp", "crossingDown", "greaterThan", "lessThan"] as const;
const TRIGGERS = ["onlyOnce", "oncePerBar", "oncePerBarClose", "oncePerMinute"] as const;

const ALERT_TOOL: AiTool = {
  definition: {
    name: "gerer_les_alertes_du_graphique",
    description:
      "Les alertes posées sur ce graphique (cloche d'un dessin ou d'un indicateur, clic droit → Ajouter une alerte) : « lister », « ajouter » (sur le prix, un indicateur ou un dessin), « modifier » ou « supprimer » (par id). Ex. : {action:\"ajouter\", sur:\"price\", condition:\"crossingUp\", valeur:200, message:\"Cassure 200\"} ; sur un dessin : {action:\"ajouter\", dessin:\"drawing-3\", condition:\"crossing\"}.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["lister", "ajouter", "modifier", "supprimer"], description: "Ce qu'il faut faire." },
        id: { type: "string", description: "modifier, supprimer : id de l'alerte." },
        sur: { type: "string", description: "Série surveillée : « price » (le cours) ou l'id d'un indicateur. Défaut price." },
        dessin: { type: "string", description: "Id du dessin dont la ligne fait le niveau (facultatif)." },
        condition: { type: "string", enum: CROSSINGS, description: "crossing (croise), crossingUp, crossingDown, greaterThan, lessThan." },
        valeur: { type: "number", description: "Niveau comparé, sans dessin." },
        declenchement: { type: "string", enum: TRIGGERS, description: "Fréquence. Défaut onlyOnce." },
        message: { type: "string", description: "Texte de l'alerte." },
        expiration: { type: "string", description: `Date d'expiration, facultative. ${DATE_DOC}` },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    const c = chart.controls;
    if (!c) return noControls();
    const alerts = c.alerts();
    const action = str(input, "action");
    if (action === "lister") {
      return ok(
        alerts.length === 0
          ? "Aucune alerte sur ce graphique."
          : alerts
              .map((a) => `- ${a.id} : ${a.conditionIndicatorId} ${"level" in a.crossing ? `niveau Fibonacci ${a.crossing.level}` : a.crossing.kind}${a.value !== undefined ? ` ${a.value}` : ""}${a.drawingId ? ` (dessin ${a.drawingId})` : ""}, ${a.trigger}${a.message ? ` — « ${a.message} »` : ""}`)
              .join("\n"),
      );
    }
    if (action === "supprimer") {
      const a = alerts.find((x) => x.id === str(input, "id"));
      if (!a) return fail(`Alerte « ${str(input, "id")} » introuvable. Alertes : ${alerts.map((x) => x.id).join(", ") || "aucune"}.`);
      if (!c.deleteAlert) return fail("Ce graphique ne permet pas de supprimer une alerte.");
      c.deleteAlert(a.id);
      return ok(`Alerte ${a.id} supprimée.`);
    }
    const base = action === "modifier" ? alerts.find((x) => x.id === str(input, "id")) : undefined;
    if (action === "modifier" && !base) return fail(`Alerte « ${str(input, "id")} » introuvable.`);
    if (action !== "ajouter" && action !== "modifier") return fail("Action inconnue : lister, ajouter, modifier ou supprimer.");
    const drawingId = str(input, "dessin") ?? base?.drawingId ?? null;
    if (drawingId && !chart.drawings().some((d) => d.id === drawingId)) return fail(`Dessin « ${drawingId} » introuvable.`);
    const on = str(input, "sur") ?? base?.conditionIndicatorId ?? "price";
    if (on !== "price" && !findIndicator(chart, on)) return fail(`« sur » : « price » ou l'id d'un indicateur (${indicatorList(chart)}).`);
    const value = num(input, "valeur") ?? base?.value;
    if (!drawingId && value === undefined) return fail("Indiquez « valeur » (ou un « dessin » dont la ligne fait le niveau).");
    const kind = (str(input, "condition") ?? (base && "kind" in base.crossing ? base.crossing.kind : "crossing")) as (typeof CROSSINGS)[number];
    if (!CROSSINGS.includes(kind)) return fail(`Condition inconnue : ${CROSSINGS.join(", ")}.`);
    const trigger = (str(input, "declenchement") ?? base?.trigger ?? "onlyOnce") as (typeof TRIGGERS)[number];
    const expires = input.expiration !== undefined ? parseDate(input.expiration) : (base?.expiresAt ?? null);
    const draft = {
      drawingId,
      conditionIndicatorId: on,
      crossing: { kind },
      ...(drawingId ? {} : { value }),
      trigger,
      sound: base?.sound ?? "default",
      message: str(input, "message") ?? base?.message ?? "",
      expiresAt: expires,
    };
    if (action === "ajouter") {
      if (!c.createAlert) return fail("Ce graphique ne permet pas de créer une alerte.");
      c.createAlert(draft);
      return ok(`Alerte créée : ${on} ${kind}${value !== undefined && !drawingId ? ` ${value}` : ""}${drawingId ? ` (dessin ${drawingId})` : ""}, ${trigger}.`);
    }
    if (!c.updateAlert) return fail("Ce graphique ne permet pas de modifier une alerte.");
    c.updateAlert(base!.id, draft);
    return ok(`Alerte ${base!.id} modifiée.`);
  },
};

const DISPLAY_TOOL: AiTool = {
  definition: {
    name: "regler_l_affichage",
    description:
      "Bascule l'affichage du graphique : plein écran (dans un espace à plusieurs fenêtres : la fenêtre occupe toute la grille), ligne d'informations du symbole (légende en haut à gauche), panneau « État du marché ». Ne passez que ce qui change.",
    inputSchema: {
      type: "object",
      properties: {
        plein_ecran: { type: "boolean", description: "Plein écran du graphique." },
        infos_du_symbole: { type: "boolean", description: "Ligne d'informations du symbole affichée." },
        etat_du_marche: { type: "boolean", description: "Panneau « État du marché » ouvert." },
      },
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    const c = chart.controls;
    if (!c) return noControls();
    const done: string[] = [];
    const full = bool(input, "plein_ecran");
    if (full !== undefined) {
      if (c.fullscreen() !== full) c.toggleFullscreen();
      done.push(full ? "plein écran" : "plein écran quitté");
    }
    const info = bool(input, "infos_du_symbole");
    if (info !== undefined) {
      c.setSymbolInfoHidden(!info);
      done.push(info ? "infos du symbole affichées" : "infos du symbole masquées");
    }
    const market = bool(input, "etat_du_marche");
    if (market !== undefined) {
      c.setMarketStateOpen(market);
      done.push(market ? "état du marché ouvert" : "état du marché fermé");
    }
    if (done.length === 0) return fail("Rien à régler : plein_ecran, infos_du_symbole ou etat_du_marche.");
    await wait(80);
    return ok(`Affichage : ${done.join(", ")}.`);
  },
};

const UNDO_TOOL: AiTool = {
  definition: {
    name: "annuler_ou_retablir",
    description: "Annule (Ctrl+Z) ou rétablit (Ctrl+Y) la dernière modification des dessins ou de la disposition des indicateurs, autant de fois que demandé.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["annuler", "retablir"], description: "Annuler ou rétablir." },
        fois: { type: "number", minimum: 1, maximum: 50, description: "Nombre d'étapes. Défaut 1." },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  run: async (input, chart) => {
    const c = chart.controls;
    if (!c) return noControls();
    const undo = str(input, "action") === "annuler";
    const times = Math.max(1, Math.min(50, Math.round(num(input, "fois") ?? 1)));
    let done = 0;
    for (let i = 0; i < times; i++) {
      if (!(undo ? c.undo() : c.redo())) break;
      done++;
      await wait(30);
    }
    return done > 0 ? ok(`${done} étape(s) ${undo ? "annulée(s)" : "rétablie(s)"}.`) : fail(`Rien à ${undo ? "annuler" : "rétablir"}.`);
  },
};

export const CONTROL_TOOLS: AiTool[] = [
  NAVIGATE_TOOL,
  Y_AXIS_TOOL,
  AXES_TOOL,
  APPEARANCE_TOOL,
  INDICATOR_TOOL,
  PANE_TOOL,
  TEMPLATE_TOOL,
  CONDITIONAL_TOOL,
  CHART_TYPE_TOOL,
  COMPARISON_TOOL,
  ALERT_TOOL,
  DISPLAY_TOOL,
  UNDO_TOOL,
];

/** Outils de ce fichier qui n'ont de sens que si l'application fournit ce qu'ils actionnent. */
export function controlToolAvailable(name: string, chart: AiChartContext): boolean | undefined {
  if (!CONTROL_TOOLS.some((t) => t.definition.name === name)) return undefined;
  if (!chart.controls) return false;
  if (name === "gerer_les_comparaisons") return chart.addComparison !== undefined;
  if (name === "gerer_les_alertes_du_graphique") return chart.controls.createAlert !== undefined || chart.controls.alerts().length > 0;
  return true;
}
