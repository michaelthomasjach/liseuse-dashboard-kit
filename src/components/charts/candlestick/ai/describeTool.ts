import type { AiTool } from "./aiTools";
import type { AiChartContext } from "./interfaces/AiChartContext.interface";
import { indicatorCatalogEntry } from "../indicatorCatalog";
import { analyzeScriptKind } from "../scripting/scriptKind";
import { describeView, indicatorSettings } from "./controlTools";
import { describeDrawing } from "./drawingTools";
import { dialogTitle, openDialogs, contextMenuOf } from "./uiControl";
import { fmtNum, isoDay } from "./toolHelpers";

/**
 * `decrire_le_graphique` : l'état complet du graphique en lecture, par parties — ce que l'IA lit avant d'agir, et
 * relit (avec la capture) pour vérifier. Remplace l'ancien `lire_le_graphique` (alias gardé à l'exécution).
 */

export const DESCRIBE_TOOL_NAME = "decrire_le_graphique";
const PARTS = ["resume", "vue", "axes", "panneaux", "indicateurs", "dessins", "apparence", "fenetres_ouvertes", "espace_de_travail", "alertes", "scripts"] as const;
type Part = (typeof PARTS)[number];

const SCALE_NAMES: Record<string, string> = { linear: "linéaire", log: "logarithmique", percent: "en %" };

function placementOf(chart: AiChartContext, id: string): string {
  const ind = chart.indicators.find((i) => i.id === id);
  if (!ind) return "";
  const pane = indicatorCatalogEntry(ind).pane;
  return ind.sourceId ? `sur le panneau ${ind.sourceId}` : pane === "price" ? "sur les prix" : ind.priceOverlay ? "panneau superposé aux prix" : "dans un panneau";
}

function section(chart: AiChartContext, part: Part): string {
  const c = chart.controls;
  const n = chart.data.length;
  switch (part) {
    case "resume": {
      const first = chart.data[0];
      const last = chart.data[n - 1];
      return [
        `Symbole : ${chart.symbol ?? "non renseigné"}`,
        `Unité de temps : ${chart.timeframe ?? "non renseignée"} (disponibles : ${chart.availableTimeframes.join(", ") || "aucune"})`,
        `Type de graphique : ${c ? (c.displayModes().find((m) => m.mode === c.displayMode())?.label ?? c.displayMode()) : "?"}`,
        `Bougies : ${n}${first && last ? ` du ${isoDay(first.date)} au ${isoDay(last.date)}` : ""}${last ? ` ; dernière clôture ${last.close}` : ""}`,
        `Volume : ${chart.volumeVisible ? (c?.volumeOverlay() ? "sur les prix" : "affiché") : "masqué"}`,
        `Comparaisons : ${chart.drawings().filter((d) => d.lineType === "symbolOverlay").map((d) => d.overlaySymbol).join(", ") || "aucune"}`,
        `Données fondamentales : ${chart.fundamentals?.length ?? 0} points`,
        chart.replayCutoff?.() ? `Replay en cours : dernière bougie révélée ${isoDay(chart.replayCutoff()!)}` : "",
        c ? `Plein écran : ${c.fullscreen() ? "oui" : "non"}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "vue":
      return c ? describeView(chart, c) : "Vue : indisponible.";
    case "axes": {
      if (!c) return "Axes : indisponibles.";
      const style = c.style();
      return [
        `Échelle des prix : ${SCALE_NAMES[c.priceScaleMode()] ?? c.priceScaleMode()}, ajustement automatique ${c.autoFit() ? "oui" : "non"}.`,
        `Axe des prix ${style.priceAxisVisible === false ? "masqué" : "affiché"} (${style.priceAxisSide === "left" ? "à gauche" : "à droite"}), axe du temps ${style.timeAxisVisible === false ? "masqué" : "affiché"}, axes des panneaux ${style.paneAxesVisible === false ? "masqués" : "affichés"}.`,
      ].join("\n");
    }
    case "panneaux":
      if (!c) return "Panneaux : indisponibles.";
      return `Panneaux :\n${c
        .panes()
        .map(
          (p) =>
            `- ${p.id} : ${p.label}${p.order !== undefined ? ` (position ${p.order})` : ""} — axe Y ${p.yAuto ? "auto" : "manuel"}${p.range ? ` ${fmtNum(p.range.min)} → ${fmtNum(p.range.max)}` : ""}${p.collapsed ? ", replié" : ""}${p.fullscreen ? ", plein écran" : ""}${p.legendHidden ? ", légende masquée" : ""}${p.legendCollapsed ? ", légende repliée" : ""}${p.indicatorIds.length ? `, indicateurs : ${p.indicatorIds.join(", ")}` : ""}`,
        )
        .join("\n")}`;
    case "indicateurs": {
      const list = c?.indicators() ?? chart.indicators;
      if (list.length === 0) return "Indicateurs : aucun.";
      return `Indicateurs :\n${list
        .map((i) => {
          const s = indicatorSettings(i);
          delete s.id;
          delete s.kind;
          return `- ${i.id} : ${chart.indicatorLabel(i)} (${placementOf(chart, i.id) || "dans un panneau"}${i.hidden ? ", masqué" : ""}) ${JSON.stringify(s).slice(0, 400)}`;
        })
        .join("\n")}`;
    }
    case "dessins": {
      const own = chart.drawings().filter((d) => d.lineType !== "symbolOverlay");
      return `Dessins (${own.length})${c ? ` — ${c.drawingsHidden() ? "tous masqués" : "affichés"}, ${c.drawingsLocked() ? "verrouillés" : "déverrouillés"}` : ""} :\n${own.slice(0, 80).map(describeDrawing).join("\n") || "aucun"}`;
    }
    case "apparence": {
      if (!c) return "Apparence : indisponible.";
      const a = c.appearance();
      const style = c.style();
      return `Apparence : hausse ${a.upColor ?? "thème"}, baisse ${a.downColor ?? "thème"}, volume ${a.volumeUpColor ?? "auto"}/${a.volumeDownColor ?? "auto"} ; réglages changés : ${Object.keys(style).length ? JSON.stringify(style) : "aucun"} ; style conditionnel des bougies : ${c.candleColorRules().length} règle(s) ; filigrane : ${chart.watermark?.().visible ? "affiché" : "masqué"}.`;
    }
    case "fenetres_ouvertes": {
      if (typeof document === "undefined") return "Fenêtres ouvertes : aucune.";
      const dialogs = openDialogs().map(dialogTitle);
      const menu = contextMenuOf(c?.root() ?? null);
      return `Fenêtres ouvertes : ${dialogs.join(", ") || "aucune"}${menu ? " ; menu du clic droit ouvert" : ""}.`;
    }
    case "espace_de_travail": {
      const ws = chart.workspace;
      if (!ws) return "Espace de travail : une seule fenêtre.";
      const target = ws.target?.() ?? 0;
      const groups = ws.linkGroups?.() ?? [];
      return `Espace de travail (${ws.layoutId?.() ?? ""}) :\n${ws
        .panels()
        .map((p) => `- Fenêtre ${p.index + 1} : ${p.symbol ?? "sans symbole"}${p.timeframe ? ` (${p.timeframe})` : ""}${p.index === target ? " — active" : ""}`)
        .join("\n")}\nGroupes liés : ${groups.filter((g) => g.length >= 2).map((g) => g.map((i) => i + 1).join("+")).join(" ; ") || "aucun"}.`;
    }
    case "alertes": {
      const alerts = c?.alerts() ?? [];
      return `Alertes du graphique : ${alerts.length === 0 ? "aucune" : alerts.map((a) => `${a.id} (${a.conditionIndicatorId}${a.value !== undefined ? ` ${a.value}` : ""})`).join(", ")}.`;
    }
    case "scripts": {
      const scripts = chart.allScripts?.() ?? chart.scripts;
      return `Scripts : ${scripts.map((s) => `${s.name} [${analyzeScriptKind(s.code).kind}] (id ${s.id}${s.enabled === false ? ", désactivé" : ""})`).join(" ; ") || "aucun"}.`;
    }
  }
}

export const DESCRIBE_TOOL: AiTool = {
  definition: {
    name: DESCRIBE_TOOL_NAME,
    description:
      "L'état complet du graphique en lecture, à appeler avant d'agir (et après, avec capturer_le_graphique, pour vérifier) : résumé (symbole, unité de temps, type, bougies, volume, comparaisons, replay), vue (période visible), axes (échelle, ajustement, axes affichés), panneaux (id, axe Y et ses bornes, replié, légende), indicateurs (id, emplacement, réglages), dessins (id, type, points, style), apparence, fenêtres ouvertes, espace de travail (fenêtres, fenêtre active, groupes liés), alertes, scripts. « parties » limite la réponse. Pour l'inventaire avant de créer un indicateur : lister_les_indicateurs_existants.",
    inputSchema: {
      type: "object",
      properties: {
        parties: { type: "array", items: { type: "string", enum: PARTS }, description: "Parties à rendre. Défaut : toutes." },
      },
      additionalProperties: false,
    },
  },
  run: (input, chart) => {
    const asked = Array.isArray(input.parties) ? (input.parties as unknown[]).filter((p): p is Part => PARTS.includes(p as Part)) : [];
    const parts = asked.length > 0 ? asked : [...PARTS];
    return { content: parts.map((p) => section(chart, p)).join("\n\n").slice(0, 20000) };
  },
};
