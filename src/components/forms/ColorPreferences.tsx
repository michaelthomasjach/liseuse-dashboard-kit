import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { normalizeColor } from "./colorUtils";

/** Un jeu de couleurs enregistré par l'utilisateur dans le sélecteur de couleur. */
export interface ColorSet {
  id: string;
  name: string;
  colors: string[];
}

/** Ce que les sélecteurs de couleur retiennent : couleurs récentes et jeux de couleurs. Un objet simple, sérialisable
 *  en JSON : l'application l'enregistre où elle veut (sur le compte de l'utilisateur, par exemple). */
export interface ColorPreferences {
  /** Dernières couleurs choisies, la plus récente d'abord (12 au plus). */
  recentColors: string[];
  /** Jeux de couleurs enregistrés. */
  colorSets: ColorSet[];
  /** Jeu « appliqué » : ses couleurs s'affichent en tête de chaque sélecteur, à la place de la palette de base. */
  activeColorSetId?: string | null;
}

export const MAX_RECENT_COLORS = 12;
export const MAX_SET_COLORS = 30;

export const EMPTY_COLOR_PREFERENCES: ColorPreferences = { recentColors: [], colorSets: [], activeColorSetId: null };

/** Remet d'aplomb des préférences venues de l'extérieur (base, ancien format, valeur partielle). */
export function normalizeColorPreferences(value: Partial<ColorPreferences> | null | undefined): ColorPreferences {
  const recent = Array.isArray(value?.recentColors) ? value.recentColors.filter((c): c is string => typeof c === "string") : [];
  const sets = Array.isArray(value?.colorSets)
    ? value.colorSets
        .filter((s): s is ColorSet => !!s && typeof s.id === "string" && Array.isArray(s.colors))
        .map((s) => ({ id: s.id, name: typeof s.name === "string" ? s.name : "Jeu", colors: s.colors.filter((c) => typeof c === "string").slice(0, MAX_SET_COLORS) }))
    : [];
  const active = typeof value?.activeColorSetId === "string" && sets.some((s) => s.id === value.activeColorSetId) ? value.activeColorSetId : null;
  return { recentColors: recent.slice(0, MAX_RECENT_COLORS), colorSets: sets, activeColorSetId: active };
}

/** La couleur en tête des récentes (sans doublon, 12 au plus). */
export function pushRecentColor(prefs: ColorPreferences, color: string): ColorPreferences {
  const c = normalizeColor(color);
  if (!c.startsWith("#")) return prefs;
  const recent = [c, ...prefs.recentColors.filter((x) => normalizeColor(x) !== c)].slice(0, MAX_RECENT_COLORS);
  if (recent.length === prefs.recentColors.length && recent.every((x, i) => x === prefs.recentColors[i])) return prefs;
  return { ...prefs, recentColors: recent };
}

export interface ColorPreferencesApi {
  preferences: ColorPreferences;
  update: (fn: (prev: ColorPreferences) => ColorPreferences) => void;
}

interface ContextValue extends ColorPreferencesApi {
  /** Tenu par un fournisseur qui a reçu des préférences de l'application (et non le repli en mémoire). */
  explicit: boolean;
}

const ColorPreferencesContext = createContext<ContextValue | null>(null);

// Repli sans fournisseur : une mémoire commune à tous les sélecteurs de la page, perdue au rechargement.
let fallback: ColorPreferences = EMPTY_COLOR_PREFERENCES;
const listeners = new Set<() => void>();
const fallbackApi = {
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => fallback,
  update: (fn: (prev: ColorPreferences) => ColorPreferences) => {
    const next = fn(fallback);
    if (next === fallback) return;
    fallback = next;
    listeners.forEach((l) => l());
  },
};

/** Préférences de couleur partagées par les sélecteurs (récentes, jeux) : celles du `ColorPreferencesProvider`
 *  le plus proche, sinon une mémoire commune à la page (non enregistrée). */
export function useColorPreferences(): ColorPreferencesApi {
  const ctx = useContext(ColorPreferencesContext);
  const local = useSyncExternalStore(fallbackApi.subscribe, fallbackApi.get, fallbackApi.get);
  return ctx ?? { preferences: local, update: fallbackApi.update };
}

export interface ColorPreferencesProviderProps {
  /** Préférences enregistrées par l'application (relues quand elles changent). Sans cette prop ni `onChange`, le
   *  fournisseur ne fait rien : les sélecteurs gardent celles du fournisseur parent, ou la mémoire de la page. */
  value?: Partial<ColorPreferences> | null;
  /** Appelé à chaque changement (couleur choisie, jeu créé, renommé, supprimé, appliqué) avec l'ensemble à jour. */
  onChange?: (preferences: ColorPreferences) => void;
  children: ReactNode;
}

/**
 * Partage les couleurs récentes et les jeux de couleurs entre tous les `ColorPicker` qu'il contient, et les remonte à
 * l'application pour qu'elle les enregistre. Un fournisseur placé dans un autre qui a déjà reçu des préférences
 * s'efface devant lui : dans un `ChartWorkspace` qui les reçoit, tous ses graphiques partagent les mêmes.
 */
export function ColorPreferencesProvider({ value, onChange, children }: ColorPreferencesProviderProps) {
  const parent = useContext(ColorPreferencesContext);
  const given = value !== undefined || onChange !== undefined;
  const [state, setState] = useState(() => normalizeColorPreferences(value));
  const stateRef = useRef(state);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Préférences relues de l'application (chargement du compte, autre onglet) : reprises si elles diffèrent.
  const valueJson = value === undefined ? undefined : JSON.stringify(normalizeColorPreferences(value));
  useEffect(() => {
    if (valueJson === undefined || valueJson === JSON.stringify(stateRef.current)) return;
    const next = JSON.parse(valueJson) as ColorPreferences;
    stateRef.current = next;
    setState(next);
  }, [valueJson]);

  const update = useCallback((fn: (prev: ColorPreferences) => ColorPreferences) => {
    const next = fn(stateRef.current);
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
    onChangeRef.current?.(next);
  }, []);

  const ctx = useMemo<ContextValue>(() => ({ preferences: state, update, explicit: true }), [state, update]);

  // Toujours le même arbre (un Provider) : passer d'un cas à l'autre ne remonte pas les enfants.
  return <ColorPreferencesContext.Provider value={!given || parent?.explicit ? parent : ctx}>{children}</ColorPreferencesContext.Provider>;
}
