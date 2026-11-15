import { useCallback, useMemo, useRef, useState } from "react";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import { DRAWING_STYLE_KEYS, styleOf, toolKeyOf, type DrawingStyle } from "../drawingStylePresets";

/**
 * Derniers styles utilisés, par outil (comme TradingView) : quand l'utilisateur change la couleur,
 * l'épaisseur, le trait, le remplissage, le texte… d'un dessin, le prochain dessin du même outil
 * reprend ces réglages. Clé : l'outil (`lineType` du dessin, « trendline » pour une ligne libre).
 */
export type DrawingStylesByTool = Record<string, DrawingStyle>;

/** Apparence à retenir d'un dessin : celle d'un style enregistré, sans le texte (une étiquette, un
 *  contenu : propres à ce dessin, jamais recopiés sur le suivant). */
export function rememberedStyleOf(dr: TrendLineDrawing): DrawingStyle {
  const style: DrawingStyle = { ...styleOf(dr) };
  delete style.text;
  return style;
}

/** Le dessin habillé du dernier style de son outil : ses champs d'apparence remplacés, son texte gardé. */
export function withRememberedStyle(dr: TrendLineDrawing, style: DrawingStyle): TrendLineDrawing {
  const next: Record<string, unknown> = { ...dr };
  for (const k of DRAWING_STYLE_KEYS) if (k !== "text") delete next[k];
  const rest: DrawingStyle = { ...style };
  delete rest.text;
  return { ...(next as unknown as TrendLineDrawing), ...rest };
}

const sameStyle = (a: DrawingStyle | undefined, b: DrawingStyle | undefined): boolean => {
  if (!a || !b) return a === b;
  return DRAWING_STYLE_KEYS.every((k) => a[k] === b[k]);
};

/** Dessins dont le style vient de changer (même id, apparence différente) : de quoi retenir le dernier
 *  style de leur outil. Ni les nouveaux dessins, ni les supprimés, ni les déplacements. */
export function editedStyles(prev: TrendLineDrawing[], next: TrendLineDrawing[]): { tool: string; style: DrawingStyle }[] {
  if (prev === next) return [];
  const before = new Map(prev.map((d) => [d.id, d]));
  const out: { tool: string; style: DrawingStyle }[] = [];
  for (const d of next) {
    const old = before.get(d.id);
    if (!old || old === d || d.lineType === "symbolOverlay") continue;
    const style = rememberedStyleOf(d);
    if (!sameStyle(rememberedStyleOf(old), style)) out.push({ tool: toolKeyOf(d), style });
  }
  return out;
}

export interface UseLastDrawingStylesArgs {
  /** Derniers styles de départ, par outil (lus au montage seulement, comme `defaultAppearance`). */
  defaultDrawingStyles?: DrawingStylesByTool;
  /** Appelé à chaque changement, avec l'ensemble à jour : de quoi l'enregistrer (par compte, par exemple). */
  onDrawingStylesChange?: (styles: DrawingStylesByTool) => void;
}

export interface LastDrawingStylesApi {
  /** Le dernier style d'un outil (null : aucun, le style par défaut). Lu au moment du tracé. */
  styleFor: (tool: string) => DrawingStyle | null;
  /** Retient le style d'un outil. */
  remember: (tool: string, style: DrawingStyle) => void;
  /** Oublie le style d'un outil : ses prochains dessins reprennent le style par défaut. */
  reset: (tool: string) => void;
  /** L'outil a un dernier style retenu. */
  has: (tool: string) => boolean;
}

/** Mémoire des derniers styles par outil. Sans `onDrawingStylesChange`, elle dure le temps du composant. */
export function useLastDrawingStyles({ defaultDrawingStyles, onDrawingStylesChange }: UseLastDrawingStylesArgs): LastDrawingStylesApi {
  const [styles, setStyles] = useState<DrawingStylesByTool>(() => ({ ...(defaultDrawingStyles ?? {}) }));
  // Lus et écrits hors rendu (au moment du tracé, en plein commit des dessins) : le ref tient la
  // dernière valeur sans attendre le prochain rendu.
  const stylesRef = useRef(styles);
  const onChangeRef = useRef(onDrawingStylesChange);
  onChangeRef.current = onDrawingStylesChange;

  const update = useCallback((next: DrawingStylesByTool) => {
    stylesRef.current = next;
    setStyles(next);
    onChangeRef.current?.(next);
  }, []);
  const styleFor = useCallback((tool: string) => stylesRef.current[tool] ?? null, []);
  const remember = useCallback(
    (tool: string, style: DrawingStyle) => {
      const clean: DrawingStyle = { ...style };
      delete clean.text;
      if (sameStyle(stylesRef.current[tool], clean)) return;
      update({ ...stylesRef.current, [tool]: clean });
    },
    [update],
  );
  const reset = useCallback(
    (tool: string) => {
      if (!(tool in stylesRef.current)) return;
      const next = { ...stylesRef.current };
      delete next[tool];
      update(next);
    },
    [update],
  );
  const has = useCallback((tool: string) => tool in styles, [styles]);
  return useMemo(() => ({ styleFor, remember, reset, has }), [styleFor, remember, reset, has]);
}
