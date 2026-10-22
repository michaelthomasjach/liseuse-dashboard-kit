import { useCallback, useEffect, useState } from "react";
import type { TrendLineDrawing } from "./interfaces/TrendLineDrawing.interface";

/**
 * Styles de dessin enregistrés (« types de lignes ») : l'apparence d'un dessin — couleurs, épaisseur,
 * pointillés, texte, prolongement, flèches… — sauvegardée sous un nom, par type d'outil (un style de
 * ligne ne s'applique pas à un canal). Le dernier style choisi pour un outil habille les nouveaux
 * dessins de cet outil ; « Défaut » revient au style du thème. Gardés dans ce navigateur.
 */

/** Champs d'apparence copiés par un style : jamais la géométrie (points, dates, prix) ni l'identité. */
export const DRAWING_STYLE_KEYS = [
  "color",
  "strokeWidth",
  "lineStyle",
  "extend",
  "arrowLeft",
  "arrowRight",
  "text",
  "textSize",
  "textBold",
  "textItalic",
  "textAlignWithLine",
  "textHorizontalAlign",
  "textVerticalAlign",
  "textBackgroundColor",
  "textBubble",
  "textColor",
  "fillColor",
  "targetFillColor",
  "stopFillColor",
  "channelMedian",
  "timeframeLabelHidden",
] as const satisfies readonly (keyof TrendLineDrawing)[];

export type DrawingStyle = Partial<Pick<TrendLineDrawing, (typeof DRAWING_STYLE_KEYS)[number]>>;

export interface DrawingStylePreset {
  id: string;
  name: string;
  /** Outil auquel le style s'applique (`lineType` du dessin, « trendline » pour une ligne libre). */
  tool: string;
  style: DrawingStyle;
}

interface PresetsState {
  presets: DrawingStylePreset[];
  /** Style actif par outil : celui des nouveaux dessins. Absent : « Défaut ». */
  active: Record<string, string>;
}

/** Outils dont le texte est le contenu même (pas une étiquette) : le style n'emporte pas leur texte. */
const TEXT_CONTENT_TOOLS = new Set(["text", "comment", "note", "priceNote", "signpost", "priceLabel", "table"]);

export const toolKeyOf = (dr: Pick<TrendLineDrawing, "lineType">): string => dr.lineType ?? "trendline";

/** Apparence d'un dessin, prête à être enregistrée. */
export function styleOf(dr: TrendLineDrawing): DrawingStyle {
  const out: Record<string, unknown> = {};
  for (const k of DRAWING_STYLE_KEYS) {
    if (k === "text" && TEXT_CONTENT_TOOLS.has(toolKeyOf(dr))) continue;
    if (dr[k] !== undefined) out[k] = dr[k];
  }
  return out as DrawingStyle;
}

/** Le dessin habillé d'un style : ses champs d'apparence remplacés (ceux absents du style remis au défaut). */
export function withStyle(dr: TrendLineDrawing, style: DrawingStyle | null): TrendLineDrawing {
  const next: Record<string, unknown> = { ...dr };
  for (const k of DRAWING_STYLE_KEYS) {
    if (k === "text" && TEXT_CONTENT_TOOLS.has(toolKeyOf(dr))) continue;
    delete next[k];
  }
  return { ...(next as unknown as TrendLineDrawing), ...(style ?? {}) };
}

const STORAGE_KEY = "lq-chart:drawing-style-presets:v1";

function load(): PresetsState {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const v = raw ? (JSON.parse(raw) as Partial<PresetsState>) : null;
    if (v && Array.isArray(v.presets) && v.active && typeof v.active === "object") return { presets: v.presets, active: v.active };
  } catch {
    // Stockage indisponible ou illisible : aucun style enregistré.
  }
  return { presets: [], active: {} };
}

function save(state: PresetsState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Stockage indisponible (navigation privée…) : les styles valent pour cette visite.
  }
}

/** API des styles enregistrés, partagée par la barre flottante et les paramètres du dessin. */
export interface DrawingStylesApi {
  /** Styles enregistrés pour un outil. */
  presetsFor: (tool: string) => DrawingStylePreset[];
  /** Style actif d'un outil (null : « Défaut »). */
  activeFor: (tool: string) => string | null;
  /** Le style d'un nouveau dessin de cet outil (null : rien à appliquer). */
  activeStyleFor: (tool: string) => DrawingStyle | null;
  /** Rend un style actif pour l'outil (null : « Défaut ») et renvoie son contenu. */
  select: (tool: string, id: string | null) => DrawingStyle | null;
  /** Enregistre un nouveau style (devient l'actif) ; renvoie son id. */
  saveNew: (tool: string, name: string, style: DrawingStyle) => string;
  overwrite: (id: string, style: DrawingStyle) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}

export function useDrawingStylePresets(): DrawingStylesApi {
  const [state, setState] = useState<PresetsState>(load);
  useEffect(() => save(state), [state]);
  // Plusieurs graphiques sur la page : un style enregistré dans l'un est aussitôt proposé dans les autres.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setState(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const presetsFor = useCallback((tool: string) => state.presets.filter((p) => p.tool === tool), [state.presets]);
  const activeFor = useCallback((tool: string) => (state.presets.some((p) => p.id === state.active[tool]) ? state.active[tool] ?? null : null), [state]);
  const activeStyleFor = useCallback(
    (tool: string) => state.presets.find((p) => p.id === state.active[tool] && p.tool === tool)?.style ?? null,
    [state],
  );
  const select = useCallback(
    (tool: string, id: string | null) => {
      setState((s) => {
        const active = { ...s.active };
        if (id) active[tool] = id;
        else delete active[tool];
        return { ...s, active };
      });
      return id ? state.presets.find((p) => p.id === id)?.style ?? null : null;
    },
    [state.presets],
  );
  const saveNew = useCallback((tool: string, name: string, style: DrawingStyle) => {
    const id = `style-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    setState((s) => ({ presets: [...s.presets, { id, name: name.trim() || "Style", tool, style }], active: { ...s.active, [tool]: id } }));
    return id;
  }, []);
  const overwrite = useCallback((id: string, style: DrawingStyle) => {
    setState((s) => ({ ...s, presets: s.presets.map((p) => (p.id === id ? { ...p, style } : p)) }));
  }, []);
  const rename = useCallback((id: string, name: string) => {
    setState((s) => ({ ...s, presets: s.presets.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)) }));
  }, []);
  const remove = useCallback((id: string) => {
    setState((s) => {
      const active = { ...s.active };
      for (const [tool, v] of Object.entries(active)) if (v === id) delete active[tool];
      return { presets: s.presets.filter((p) => p.id !== id), active };
    });
  }, []);
  return { presetsFor, activeFor, activeStyleFor, select, saveNew, overwrite, rename, remove };
}
