import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TrendLineDrawing } from "./interfaces/TrendLineDrawing.interface";

/**
 * Styles de dessin enregistrés (« types de lignes ») : l'apparence d'un dessin — couleurs, épaisseur,
 * pointillés, texte, prolongement, flèches… — sauvegardée sous un nom, par type d'outil (un style de
 * ligne ne s'applique pas à un canal). Le dernier style choisi pour un outil habille les nouveaux
 * dessins de cet outil ; « Défaut » revient au style du thème. Gardés par l'hôte (`defaultDrawingStylePresets` /
 * `onDrawingStylePresetsChange`), sinon dans ce navigateur.
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

/** Les styles de dessin enregistrés et le style actif de chaque outil : ce qu'un hôte garde (par compte, par exemple)
 *  via `defaultDrawingStylePresets` / `onDrawingStylePresetsChange`. */
export interface DrawingStylePresetsState {
  presets: DrawingStylePreset[];
  /** Style actif par outil : celui des nouveaux dessins. Absent : « Défaut ». */
  active: Record<string, string>;
}

type PresetsState = DrawingStylePresetsState;

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

/** Deux apparences identiques, champ d'apparence par champ (un champ absent des deux compte comme égal). Sert à
 *  retrouver le style enregistré qu'un dessin porte, pour l'afficher dans sa barre flottante. */
export function sameStyle(a: DrawingStyle, b: DrawingStyle): boolean {
  for (const k of DRAWING_STYLE_KEYS) {
    if (JSON.stringify((a as Record<string, unknown>)[k]) !== JSON.stringify((b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

/** Clé du `localStorage` où le kit garde les styles quand aucun hôte ne les prend en charge. */
export const DRAWING_STYLE_PRESETS_STORAGE_KEY = "lq-chart:drawing-style-presets:v1";
const STORAGE_KEY = DRAWING_STYLE_PRESETS_STORAGE_KEY;

const EMPTY: PresetsState = { presets: [], active: {} };

/** Un état lisible, ou null (valeur absente ou mal formée). */
function normalize(v: unknown): PresetsState | null {
  const s = v as Partial<PresetsState> | null | undefined;
  if (!s || !Array.isArray(s.presets)) return null;
  const presets = s.presets.filter((p): p is DrawingStylePreset => !!p && typeof p.id === "string" && typeof p.name === "string" && typeof p.tool === "string" && !!p.style && typeof p.style === "object");
  return { presets, active: s.active && typeof s.active === "object" ? s.active : {} };
}

function load(): PresetsState {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const v = raw ? normalize(JSON.parse(raw)) : null;
    if (v) return v;
  } catch {
    // Stockage indisponible ou illisible : aucun style enregistré.
  }
  return EMPTY;
}

/** Tri des styles par nom, comme la liste de TradingView (« Range » avant « Résistance », « Style 2 » avant « Style 10 »). */
const byName = (a: DrawingStylePreset, b: DrawingStylePreset): number => a.name.localeCompare(b.name, "fr", { sensitivity: "base", numeric: true });

function save(state: PresetsState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Stockage indisponible (navigation privée…) : les styles valent pour cette visite.
  }
}

/** API des styles enregistrés, partagée par la barre flottante et les paramètres du dessin. */
export interface DrawingStylesApi {
  /** Styles enregistrés pour un outil, triés par nom. */
  presetsFor: (tool: string) => DrawingStylePreset[];
  /** Style actif d'un outil (null : « Défaut »). */
  activeFor: (tool: string) => string | null;
  /** Le style d'un nouveau dessin de cet outil (null : rien à appliquer). */
  activeStyleFor: (tool: string) => DrawingStyle | null;
  /** Rend un style actif pour l'outil (null : « Défaut ») et renvoie son contenu. */
  select: (tool: string, id: string | null) => DrawingStyle | null;
  /** Enregistre un nouveau style (devient l'actif) ; renvoie son id. */
  saveNew: (tool: string, name: string, style: DrawingStyle) => string;
  /** Remplace l'apparence d'un style (qui devient l'actif de son outil). */
  overwrite: (id: string, style: DrawingStyle) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}

export interface UseDrawingStylePresetsArgs {
  /** Styles tenus par l'hôte (par compte, par exemple) : repris à chaque changement de contenu. */
  defaultDrawingStylePresets?: DrawingStylePresetsState;
  /** Présent : l'hôte garde les styles (le `localStorage` du kit n'est plus écrit) et reçoit chaque changement. */
  onDrawingStylePresetsChange?: (state: DrawingStylePresetsState) => void;
}

/**
 * Styles enregistrés. Sans hôte (`onDrawingStylePresetsChange` absent), ils vivent dans le `localStorage` du kit.
 * Avec un hôte, ils viennent de `defaultDrawingStylePresets` et chaque changement lui est remis ; si l'hôte n'a encore
 * rien (`defaultDrawingStylePresets` absent), les styles déjà présents dans le `localStorage` du kit sont repris une
 * fois et remis à l'hôte, pour qu'un utilisateur ne perde pas ceux qu'il avait enregistrés avant.
 */
export function useDrawingStylePresets({ defaultDrawingStylePresets, onDrawingStylePresetsChange }: UseDrawingStylePresetsArgs = {}): DrawingStylesApi {
  const hosted = onDrawingStylePresetsChange !== undefined;
  const hostState = hosted ? normalize(defaultDrawingStylePresets) : null;
  const hostJson = hostState ? JSON.stringify(hostState) : null;
  const [state, setState] = useState<PresetsState>(() => hostState ?? load());
  // Dernier contenu connu des deux côtés : ni écho vers l'hôte de ce qui vient de lui, ni reprise de ce qu'on lui a remis.
  const syncedRef = useRef<string>(JSON.stringify(hostState ?? EMPTY));
  const onChangeRef = useRef(onDrawingStylePresetsChange);
  onChangeRef.current = onDrawingStylePresetsChange;

  useEffect(() => {
    if (!hosted) {
      save(state);
      return;
    }
    const json = JSON.stringify(state);
    if (json === syncedRef.current) return;
    syncedRef.current = json;
    onChangeRef.current?.(state);
  }, [state, hosted]);
  // L'hôte change ses styles (chargés après coup, enregistrés depuis un autre graphique…) : on les reprend.
  useEffect(() => {
    if (hostJson === null || hostJson === syncedRef.current) return;
    syncedRef.current = hostJson;
    setState(JSON.parse(hostJson) as PresetsState);
  }, [hostJson]);
  // Sans hôte, plusieurs graphiques sur la page : un style enregistré dans l'un est aussitôt proposé dans les autres.
  useEffect(() => {
    if (hosted) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setState(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hosted]);

  const presetsFor = useCallback((tool: string) => state.presets.filter((p) => p.tool === tool).sort(byName), [state.presets]);
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
    setState((s) => {
      const target = s.presets.find((p) => p.id === id);
      if (!target) return s;
      return { presets: s.presets.map((p) => (p.id === id ? { ...p, style } : p)), active: { ...s.active, [target.tool]: id } };
    });
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
  // One object for as long as its functions hold: it is a prop of the chart's modals, memoized
  // so they skip the re-render a mouse move triggers.
  return useMemo(
    () => ({ presetsFor, activeFor, activeStyleFor, select, saveNew, overwrite, rename, remove }),
    [presetsFor, activeFor, activeStyleFor, select, saveNew, overwrite, rename, remove],
  );
}
