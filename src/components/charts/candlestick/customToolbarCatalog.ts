import type { ComponentType } from "react";
import {
  MagnetIcon,
  EyeOffIcon,
  LockIcon,
  ZoomInIcon,
  ZoomOutIcon,
  CopyIcon,
  CameraIcon,
  PlayIcon,
  ActivityIcon,
  LayersIcon,
  GaugeIcon,
  SettingsIcon,
  MaximizeIcon,
} from "../../icons";
import { DRAWING_TOOL_CATEGORIES } from "./drawingCatalog";
import { INDICATOR_CATALOG, isFundamentalKind } from "./indicatorCatalog";
import { isTimeframeGroup } from "./timeframes";
import type { TimeframeEntry } from "./interfaces/TimeframeEntry.interface";

/** Un outil que l'on peut poser sur une barre d'outils personnalisée. */
export interface CustomToolbarToolDef {
  /** Identifiant enregistré dans `ChartCustomToolbar.tools`. */
  id: string;
  /** Nom complet (infobulle, nom accessible, liste du sélecteur). */
  label: string;
  /** Rubrique du sélecteur. */
  group: string;
  /** Icône du bouton ; absente : `text` (unité de temps, indicateur). */
  icon?: ComponentType<{ size?: number }>;
  /** Libellé court du bouton quand il n'y a pas d'icône (« 1J », « RSI »). */
  text?: string;
}

export interface CustomToolbarCatalogContext {
  timeframes?: TimeframeEntry[];
  /** Les unités de temps ne sont proposées que si l'hôte sait en changer. */
  canChangeTimeframe: boolean;
  /** Types d'indicateurs mis en favori dans le catalogue des indicateurs : proposés en premier. */
  favoriteIndicatorKinds: string[];
  zoomable: boolean;
  replay: boolean;
  fullscreenToggle: boolean;
}

/** Unité de temps abrégée pour un bouton carré : « 1 jour » → « 1J », « 4 heures » → « 4H », « 15 minutes » → « 15m ». */
export function shortTimeframeLabel(text: string): string {
  const m = /^(\d+)\s*([a-zA-Zéû]+)/.exec(text.trim());
  if (!m) return text.slice(0, 3);
  const unit = m[2].toLowerCase();
  const short = unit.startsWith("min") ? "m" : unit.startsWith("h") ? "H" : unit.startsWith("j") || unit.startsWith("d") ? "J" : unit.startsWith("s") || unit.startsWith("w") ? "S" : unit.startsWith("mo") ? "M" : unit.startsWith("a") || unit.startsWith("y") ? "A" : unit.slice(0, 1).toUpperCase();
  return `${m[1]}${short}`;
}

/** Tout ce qu'une barre personnalisée peut recevoir, rubrique par rubrique : les outils de dessin du rail (mêmes noms,
 *  mêmes icônes), les actions du graphique, les unités de temps de l'en-tête et les indicateurs (favoris d'abord). */
export function buildCustomToolbarCatalog(ctx: CustomToolbarCatalogContext): CustomToolbarToolDef[] {
  const drawing: CustomToolbarToolDef[] = DRAWING_TOOL_CATEGORIES.flatMap((c) =>
    c.tools.map((t) => ({ id: `draw:${t.type}`, label: t.label, group: c.id === "measure" ? "Actions du graphique" : `Dessin — ${c.label}`, icon: t.icon })),
  );
  const actions: CustomToolbarToolDef[] = [
    { id: "action:magnet", label: "Aimant", group: "Actions du graphique", icon: MagnetIcon },
    { id: "action:hideDrawings", label: "Masquer / afficher les dessins", group: "Actions du graphique", icon: EyeOffIcon },
    { id: "action:lockDrawings", label: "Verrouiller / déverrouiller les dessins", group: "Actions du graphique", icon: LockIcon },
    ...(ctx.zoomable
      ? [
          { id: "action:zoomIn", label: "Zoomer sur une zone", group: "Actions du graphique", icon: ZoomInIcon },
          { id: "action:resetZoom", label: "Réinitialiser le zoom", group: "Actions du graphique", icon: ZoomOutIcon },
        ]
      : []),
    { id: "action:captureCopy", label: "Capture : copier l'image", group: "Actions du graphique", icon: CopyIcon },
    { id: "action:captureDownload", label: "Capture : télécharger l'image", group: "Actions du graphique", icon: CameraIcon },
    ...(ctx.replay ? [{ id: "action:replay", label: "Replay", group: "Actions du graphique", icon: PlayIcon }] : []),
    { id: "action:indicators", label: "Ajouter un indicateur…", group: "Actions du graphique", icon: ActivityIcon },
    { id: "action:drawingsManager", label: "Dessins et indicateurs", group: "Actions du graphique", icon: LayersIcon },
    { id: "action:marketState", label: "État du marché", group: "Actions du graphique", icon: GaugeIcon },
    { id: "action:settings", label: "Paramètres du graphique", group: "Actions du graphique", icon: SettingsIcon },
    ...(ctx.fullscreenToggle ? [{ id: "action:fullscreen", label: "Plein écran", group: "Actions du graphique", icon: MaximizeIcon }] : []),
  ];
  const timeframes: CustomToolbarToolDef[] = ctx.canChangeTimeframe
    ? (ctx.timeframes ?? []).flatMap((e) => (isTimeframeGroup(e) ? e.options : [e])).map((o) => ({ id: `tf:${o.value}`, label: `Unité de temps : ${o.label}`, group: "Unités de temps", text: shortTimeframeLabel(o.label) }))
    : [];
  const indicatorEntries = INDICATOR_CATALOG.filter((e) => e.pane !== "attached" && e.kind !== "correlation" && !isFundamentalKind(e.kind));
  const toIndicator = (group: string) => (e: (typeof indicatorEntries)[number]): CustomToolbarToolDef => ({ id: `ind:${e.kind}`, label: e.label, group, text: e.shortLabel });
  const favorites = indicatorEntries.filter((e) => ctx.favoriteIndicatorKinds.includes(e.kind)).map(toIndicator("Indicateurs favoris"));
  const others = indicatorEntries.filter((e) => !ctx.favoriteIndicatorKinds.includes(e.kind)).map(toIndicator("Indicateurs"));
  // Les actions d'abord (« Mesure » y est rangée avec elles, comme dans le rail).
  const measure = drawing.filter((t) => t.group === "Actions du graphique");
  return [...actions.slice(0, 3), ...measure, ...actions.slice(3), ...drawing.filter((t) => t.group !== "Actions du graphique"), ...timeframes, ...favorites, ...others];
}
