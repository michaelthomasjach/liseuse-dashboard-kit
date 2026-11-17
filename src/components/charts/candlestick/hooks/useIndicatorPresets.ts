import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Indicator } from "../interfaces/Indicator.interface";
import { indicatorDefaults } from "../components/IndicatorSettingsLayout";
import {
  indicatorSettingsKey,
  indicatorSettingsOf,
  sameIndicatorSettings,
  type IndicatorSettings,
  type IndicatorSettingsByKind,
  type IndicatorTemplate,
} from "../indicatorPresets";

/**
 * Valeur tenue par le graphique, partie d'une prop de l'hôte (lue au montage) et remontée à chaque changement. Une
 * valeur différente qui arrive par la prop ensuite (réglages du compte chargés plus tard, ou changés par un autre
 * graphique de la page) est reprise : l'ajout suivant, ici, part des réglages faits ailleurs.
 */
function useHostSyncedValue<T>(initial: T | undefined, fallback: T, onChange: ((value: T) => void) | undefined) {
  const [value, setValue] = useState<T>(() => initial ?? fallback);
  // Lu et écrit hors rendu (au moment d'un ajout, en plein enregistrement d'un réglage) : le ref tient la dernière
  // valeur sans attendre le prochain rendu.
  const ref = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const propKey = initial === undefined ? null : JSON.stringify(initial);
  useEffect(() => {
    if (propKey === null || propKey === JSON.stringify(ref.current)) return;
    const next = JSON.parse(propKey) as T;
    ref.current = next;
    setValue(next);
  }, [propKey]);
  const update = useCallback((next: T) => {
    ref.current = next;
    setValue(next);
    onChangeRef.current?.(next);
  }, []);
  return { value, ref, update };
}

const EMPTY_SETTINGS: IndicatorSettingsByKind = {};

export interface UseLastIndicatorSettingsArgs {
  /** Derniers réglages de départ, par type d'indicateur (voir `indicatorSettingsKey`). */
  defaultIndicatorSettings?: IndicatorSettingsByKind;
  /** Appelé à chaque changement, avec l'ensemble à jour : de quoi l'enregistrer (par compte, par exemple). */
  onIndicatorSettingsChange?: (settings: IndicatorSettingsByKind) => void;
  /** Faux : rien n'est retenu ni repris (voir `CandlestickChartProps.indicatorPresets`). Défaut vrai. */
  enabled?: boolean;
}

export interface LastIndicatorSettingsApi {
  /** Tous les derniers réglages, par type (état : relu au rendu). */
  all: IndicatorSettingsByKind;
  /** Les derniers réglages d'un type (null : aucun, les valeurs par défaut). Lus au moment de l'ajout. */
  settingsFor: (kind: string) => IndicatorSettings | null;
  /** Retient les réglages d'un indicateur pour son type ; revenus aux valeurs par défaut, le type est oublié. */
  remember: (ind: Indicator) => void;
}

/** Mémoire des derniers réglages par type d'indicateur. Sans `onIndicatorSettingsChange`, elle dure le temps du
 *  composant. */
export function useLastIndicatorSettings({ defaultIndicatorSettings, onIndicatorSettingsChange, enabled = true }: UseLastIndicatorSettingsArgs): LastIndicatorSettingsApi {
  const { value, ref, update } = useHostSyncedValue<IndicatorSettingsByKind>(defaultIndicatorSettings, {}, onIndicatorSettingsChange);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const settingsFor = useCallback((kind: string) => (enabledRef.current ? (ref.current[kind] ?? null) : null), [ref]);
  const remember = useCallback(
    (ind: Indicator) => {
      if (!enabledRef.current) return;
      const kind = indicatorSettingsKey(ind);
      const settings = indicatorSettingsOf(ind);
      const current = ref.current;
      // Rétabli tel qu'à son ajout : le type repart des valeurs par défaut (couleur de la palette comprise).
      if (sameIndicatorSettings(settings, indicatorSettingsOf(indicatorDefaults(ind)))) {
        if (!(kind in current)) return;
        const next = { ...current };
        delete next[kind];
        update(next);
        return;
      }
      if (sameIndicatorSettings(current[kind], settings)) return;
      update({ ...current, [kind]: settings });
    },
    [ref, update],
  );
  const all = enabled ? value : EMPTY_SETTINGS;
  return useMemo(() => ({ all, settingsFor, remember }), [all, settingsFor, remember]);
}

export interface UseIndicatorTemplatesArgs {
  defaultIndicatorTemplates?: IndicatorTemplate[];
  onIndicatorTemplatesChange?: (templates: IndicatorTemplate[]) => void;
}

export interface IndicatorTemplatesApi {
  templates: IndicatorTemplate[];
  /** Enregistre les réglages de `ind` sous ce nom ; un modèle du même type et du même nom est remplacé. */
  save: (name: string, ind: Indicator) => void;
  remove: (id: string) => void;
}

/** Modèles de configuration d'indicateur, tous types confondus. Sans `onIndicatorTemplatesChange`, ils durent le temps
 *  du composant. */
export function useIndicatorTemplates({ defaultIndicatorTemplates, onIndicatorTemplatesChange }: UseIndicatorTemplatesArgs): IndicatorTemplatesApi {
  const { value, ref, update } = useHostSyncedValue<IndicatorTemplate[]>(defaultIndicatorTemplates, [], onIndicatorTemplatesChange);
  const save = useCallback(
    (name: string, ind: Indicator) => {
      const clean = name.trim();
      if (!clean) return;
      const kind = indicatorSettingsKey(ind);
      const settings = indicatorSettingsOf(ind);
      const list = ref.current;
      const same = list.find((t) => t.kind === kind && t.name.trim().toLowerCase() === clean.toLowerCase());
      if (same) {
        update(list.map((t) => (t.id === same.id ? { ...t, name: clean, settings } : t)));
        return;
      }
      const id = `indicator-template-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      update([...list, { id, name: clean, kind, settings }]);
    },
    [ref, update],
  );
  const remove = useCallback(
    (id: string) => {
      if (!ref.current.some((t) => t.id === id)) return;
      update(ref.current.filter((t) => t.id !== id));
    },
    [ref, update],
  );
  return useMemo(() => ({ templates: value, save, remove }), [value, save, remove]);
}
