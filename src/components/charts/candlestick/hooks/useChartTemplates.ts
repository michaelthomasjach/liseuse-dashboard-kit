import { useEffect, useRef, useState } from "react";
import type { Indicator } from "../interfaces/Indicator.interface";
import type { ChartTemplate, ChartTemplateScript, ChartTemplateSnapshot } from "../interfaces/ChartTemplate.interface";
import { nextFreeId } from "./useScriptingState";

export interface UseChartTemplatesArgs {
  defaultTemplates: ChartTemplate[] | undefined;
  onTemplatesChange: ((templates: ChartTemplate[]) => void) | undefined;
  /** Le modèle que le graphique reflétait au dernier chargement (voir `CandlestickChartProps.defaultActiveTemplateId`). */
  defaultActiveTemplateId?: string | null;
  onActiveTemplateChange?: (id: string | null) => void;
  /** Le modèle appliqué à l'ouverture du graphique (voir `CandlestickChartProps.defaultStartupTemplateId`). */
  defaultStartupTemplateId?: string | null;
  onStartupTemplateChange?: (id: string | null) => void;
  /** Applique le modèle au démarrage au montage — voir `CandlestickChartProps.applyStartupTemplate`. */
  applyStartupTemplate?: boolean;
  indicators: Indicator[];
  volumePaneOrder: number;
  volumePaneState: "expanded" | "collapsed" | "hidden";
  /** Volume affiché sur le graphique des prix. */
  volumeOverlay?: boolean;
  paneHeightFractions: Record<string, number>;
  /** Les scripts affichés sur le graphique en ce moment, avec leurs entrées. */
  activeScripts: ChartTemplateScript[];
  loadIndicatorLayout: (snapshot: ChartTemplateSnapshot) => void;
  /** Affiche exactement ces scripts et retire les autres (voir `useScriptingState.applyActiveScripts`). */
  applyActiveScripts: (scripts: ChartTemplateScript[]) => void;
}

// A plain, deterministic serialization of a snapshot's own fields (not the whole object as-is —
// key order in `paneHeightFractions` can legitimately differ between two snapshots that are
// otherwise identical, e.g. after an indicator was removed and re-added, which would otherwise
// read as "dirty" for no real reason) — used to compare "current" against "the active template's
// own saved snapshot" without pulling in a general-purpose deep-equal dependency for this one spot.
// Les scripts sont triés par identifiant, leurs entrées vides comptent comme absentes, et un modèle d'avant les scripts
// (`scripts` absent) vaut « aucun script » — exactement ce que son application affiche.
function serializeSnapshot(s: ChartTemplateSnapshot): string {
  const sortedPaneHeights = Object.fromEntries(Object.entries(s.paneHeightFractions).sort(([a], [b]) => a.localeCompare(b)));
  const scripts = [...(s.scripts ?? [])]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((sc) => ({ id: sc.id, p: sc.paramValues && Object.keys(sc.paramValues).length > 0 ? Object.fromEntries(Object.entries(sc.paramValues).sort(([a], [b]) => a.localeCompare(b))) : null }));
  return JSON.stringify({ indicators: s.indicators, volumePaneOrder: s.volumePaneOrder, volumePaneState: s.volumePaneState, volumeOverlay: s.volumeOverlay === true, paneHeightFractions: sortedPaneHeights, scripts });
}

/** Named, savable/loadable snapshots of the chart's own indicator/pane layout (see the Save
 *  button + templates dropdown in the header) — CRUD'd the same uncontrolled-collection-plus-
 *  callback way as `drawings`/`indicators`/`favoriteSymbolIds` elsewhere in this file: seeded
 *  once from `defaultTemplates`, every change reported back via `onTemplatesChange`.
 *
 *  Un modèle capture tout ce qui est affiché : indicateurs (avec leurs réglages et leur style), scripts posés sur le
 *  graphique (avec leurs entrées), panneau du volume, ordre et hauteurs des panneaux. L'appliquer remplace exactement
 *  cet état — ce qui n'y est pas est retiré.
 *
 *  Le modèle actif (celui que le graphique reflète) et le « modèle au démarrage » sont rendus à l'hôte pour qu'il les
 *  garde ; le modèle au démarrage s'applique au montage quand `applyStartupTemplate` le demande. */
export function useChartTemplates({
  defaultTemplates,
  onTemplatesChange,
  defaultActiveTemplateId,
  onActiveTemplateChange,
  defaultStartupTemplateId,
  onStartupTemplateChange,
  applyStartupTemplate = true,
  indicators,
  volumePaneOrder,
  volumePaneState,
  volumeOverlay = false,
  paneHeightFractions,
  activeScripts,
  loadIndicatorLayout,
  applyActiveScripts,
}: UseChartTemplatesArgs) {
  const [templates, setTemplates] = useState<ChartTemplate[]>(defaultTemplates ?? []);
  // Which template the chart currently reflects — repris de l'hôte au chargement (s'il existe encore), annoncé à
  // chaque changement pour qu'il le garde.
  const [activeTemplateId, setActiveTemplateIdRaw] = useState<string | null>(() =>
    defaultActiveTemplateId && (defaultTemplates ?? []).some((t) => t.id === defaultActiveTemplateId) ? defaultActiveTemplateId : null
  );
  const [startupTemplateId, setStartupTemplateIdRaw] = useState<string | null>(() =>
    defaultStartupTemplateId && (defaultTemplates ?? []).some((t) => t.id === defaultStartupTemplateId) ? defaultStartupTemplateId : null
  );
  const templateIdRef = useRef(0);
  const templatesRef = useRef(templates);
  templatesRef.current = templates;

  function setActiveTemplateId(id: string | null) {
    setActiveTemplateIdRaw((prev) => {
      if (prev !== id) queueMicrotask(() => onActiveTemplateChange?.(id));
      return id;
    });
  }

  function setStartupTemplateId(id: string | null) {
    setStartupTemplateIdRaw(id);
    onStartupTemplateChange?.(id);
  }

  function commitTemplates(next: ChartTemplate[]) {
    templatesRef.current = next;
    setTemplates(next);
    onTemplatesChange?.(next);
  }

  function currentSnapshot(): ChartTemplateSnapshot {
    return { indicators, volumePaneOrder, volumePaneState, ...(volumeOverlay ? { volumeOverlay } : {}), paneHeightFractions, scripts: activeScripts };
  }

  const activeTemplate = templates.find((t) => t.id === activeTemplateId) ?? null;
  const currentSerialized = serializeSnapshot(currentSnapshot());
  // Template active: dirty means the live layout has drifted from what was last saved under it.
  // Aucun modèle actif : non enregistré dès qu'il y a quelque chose sur le graphique (indicateur ou script) qu'aucun
  // modèle ne contient tel quel — le volume seul est l'état de départ, pas une modification.
  const isDirty = activeTemplate
    ? currentSerialized !== serializeSnapshot(activeTemplate)
    : (indicators.length > 0 || activeScripts.length > 0) && !templates.some((t) => serializeSnapshot(t) === currentSerialized);

  function createTemplate(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = nextFreeId("template", templateIdRef, templatesRef.current);
    commitTemplates([...templatesRef.current, { id, name: trimmed, ...currentSnapshot() }]);
    setActiveTemplateId(id);
  }

  /** No active template: creates a new one named `name` and makes it active — `name` is
   *  required here (the caller collects it via the "name this template" modal first). Active
   *  template already set: overwrites its own snapshot in place, `name` ignored — this is the
   *  "click Save again just re-saves, no modal" half of the feature. */
  function saveTemplate(name?: string) {
    if (activeTemplate) {
      commitTemplates(templatesRef.current.map((t) => (t.id === activeTemplate.id ? { ...t, ...currentSnapshot() } : t)));
      return;
    }
    if (name) createTemplate(name);
  }

  /** "Enregistrer sous" — always creates a brand new template from the current layout and makes
   *  it active, even with one already active (unlike `saveTemplate`, which overwrites that one
   *  instead). The header's own small "+" next to Save is the only entry point for this. */
  function saveTemplateAs(name: string) {
    createTemplate(name);
  }

  function loadTemplate(id: string) {
    const template = templatesRef.current.find((t) => t.id === id);
    if (!template) return;
    loadIndicatorLayout(template);
    applyActiveScripts(template.scripts ?? []);
    setActiveTemplateId(id);
  }

  function deleteTemplate(id: string) {
    commitTemplates(templatesRef.current.filter((t) => t.id !== id));
    if (activeTemplateId === id) setActiveTemplateId(null);
    if (startupTemplateId === id) setStartupTemplateId(null);
  }

  /** « Modèle au démarrage » : le même modèle une seconde fois l'enlève. */
  function toggleStartupTemplate(id: string) {
    setStartupTemplateId(startupTemplateId === id ? null : id);
  }

  // Le modèle au démarrage, une fois, à l'ouverture du graphique — quand l'hôte le demande (par défaut toujours ; un
  // hôte qui garde le dernier état du graphique ne le demande que pour un graphique sans état gardé).
  const startupAppliedRef = useRef(false);
  const loadTemplateRef = useRef(loadTemplate);
  loadTemplateRef.current = loadTemplate;
  useEffect(() => {
    if (startupAppliedRef.current) return;
    startupAppliedRef.current = true;
    if (applyStartupTemplate && startupTemplateId) loadTemplateRef.current(startupTemplateId);
    // Au montage seulement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    templates,
    activeTemplateId,
    activeTemplate,
    startupTemplateId,
    isDirty,
    saveTemplate,
    saveTemplateAs,
    loadTemplate,
    deleteTemplate,
    toggleStartupTemplate,
  };
}
