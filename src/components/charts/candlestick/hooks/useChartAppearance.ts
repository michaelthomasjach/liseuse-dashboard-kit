import { useCallback, useEffect, useRef, useState } from "react";
import type { CandleColorRule } from "../interfaces/CandleColorRule.interface";

/** Réglages d'apparence du graphique (fenêtres « Paramètres du graphique » et « Paramètres du
 *  panneau Volume ») qu'une application peut enregistrer : couleurs des bougies et du volume,
 *  onde du dernier cours, zones rayées. Une couleur absente : celle du thème. */
export interface ChartAppearanceSettings {
  upColor?: string;
  downColor?: string;
  volumeUpColor?: string;
  volumeDownColor?: string;
  closePulse?: boolean;
  pastZone?: boolean;
  futureZone?: boolean;
  /** Couleurs conditionnelles des bougies (onglet Bougies), dans leur ordre de priorité — voir `CandleColorRule`. */
  candleColorRules?: CandleColorRule[];
}

export interface UseChartAppearanceControlledSettings {
  open: boolean;
  onChange: (open: boolean) => void;
}

export interface UseChartAppearanceArgs {
  YAutoScaling: boolean;
  livePrice: boolean;
  /** Hands ownership of the settings modal's open/closed flag to a caller outside this hook, same
   *  idiom as `useFullscreen`'s own `controlled` argument. `ChartWorkspace` passes it so the
   *  workspace holds a single "which panel's settings are open" index — which both keeps two
   *  panels from opening the modal at once, and lets the mobile layout's own toolbar open the
   *  focused panel's settings from outside the chart entirely. Left undefined, the hook owns the
   *  flag itself, exactly as before. */
  controlledSettings?: UseChartAppearanceControlledSettings;
  /** Réglages de départ (lus au montage seulement, comme `defaultIndicators`). */
  defaultAppearance?: ChartAppearanceSettings;
  /** Appelé à chaque changement d'un de ces réglages, avec l'ensemble à jour. */
  onAppearanceChange?: (settings: ChartAppearanceSettings) => void;
  /** Règles de couleur des bougies tenues par l'application (prop `candleColorRules`) : elles remplacent celles de
   *  `defaultAppearance` et chaque modification passe par `onCandleColorRulesChange`. */
  candleColorRules?: CandleColorRule[];
  onCandleColorRulesChange?: (rules: CandleColorRule[]) => void;
}

/** Chart-settings-modal state: up/down bar color overrides (candles and, independently, volume),
 *  whether either settings modal is open, and the locally-owned copy of `YAutoScaling` the
 *  settings checkbox toggles — plus the once-a-second tick that only exists to give the live-price
 *  countdown badge (a plain DOM element, not part of the canvas draw effect) a reason to
 *  re-render. None of this reads or writes `drawings`/`indicators`/zoom state, so it's cheap to
 *  keep fully separate from every other concern in this file. */
export function useChartAppearance({ YAutoScaling, livePrice, controlledSettings, defaultAppearance, onAppearanceChange, candleColorRules: candleColorRulesProp, onCandleColorRulesChange }: UseChartAppearanceArgs) {
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);
  const settingsOpen = controlledSettings?.open ?? internalSettingsOpen;
  const setSettingsOpen: (open: boolean) => void = controlledSettings?.onChange ?? setInternalSettingsOpen;
  // Per-chart color overrides for up/down bars — `undefined` (the default) means "use the
  // theme's own --lq-color-up/--lq-color-down", same as before this modal existed.
  const [upColorOverride, setUpColorOverride] = useState<string | undefined>(defaultAppearance?.upColor);
  const [downColorOverride, setDownColorOverride] = useState<string | undefined>(defaultAppearance?.downColor);
  // Same idea, scoped to the volume pane's own bars instead of the candles — `undefined` means
  // "mirror whichever of colorUp/colorDown above is currently in effect" (theme or its own
  // override), same as volume bars have always done, just now overridable independently.
  const [volumeUpColorOverride, setVolumeUpColorOverride] = useState<string | undefined>(defaultAppearance?.volumeUpColor);
  const [volumeDownColorOverride, setVolumeDownColorOverride] = useState<string | undefined>(defaultAppearance?.volumeDownColor);
  const [volumeSettingsOpen, setVolumeSettingsOpen] = useState(false);
  // Seeded from the `YAutoScaling` prop, then owned locally once the settings-modal checkbox can
  // change it — same uncontrolled pattern as `drawings`/`indicators`, not a live mirror of the
  // prop after mount.
  const [yAutoScalingState, setYAutoScalingState] = useState(YAutoScaling);
  // Whether the hatched "future"/"past" zones (past the last candle to the plot's own right edge,
  // and before the first candle to its left edge) are drawn — chart-settings toggles, not props,
  // same reasoning as yAutoScalingState above: purely a viewer preference, with no data of its own
  // for a caller to control. Both default **off** — exigence : « par défaut je ne veux pas les
  // zones rayées avant et après d'activées ». They were briefly defaulted on, at the same user's
  // earlier request; the toggles themselves are unchanged, only where they start.
  // The ripple on the close line's last point. Same kind of state as the two zones below — a
  // viewer preference with no data of its own — except that the setting is only ever *shown* in the
  // "Ligne de clôture" mode, the only one with a close line to put it on. Kept, not reset, when the
  // mode changes: coming back to the line should find it as it was left.
  const [closePulseVisible, setClosePulseVisible] = useState(defaultAppearance?.closePulse ?? true);
  const [futureZoneVisible, setFutureZoneVisible] = useState(defaultAppearance?.futureZone ?? false);
  const [pastZoneVisible, setPastZoneVisible] = useState(defaultAppearance?.pastZone ?? false);
  // Couleurs conditionnelles des bougies : tenues ici (lues au montage dans `defaultAppearance`), sauf quand
  // l'application les tient elle-même par la prop `candleColorRules`.
  const [internalCandleColorRules, setInternalCandleColorRules] = useState<CandleColorRule[]>(defaultAppearance?.candleColorRules ?? []);
  const candleColorRules = candleColorRulesProp ?? internalCandleColorRules;
  const onCandleColorRulesChangeRef = useRef(onCandleColorRulesChange);
  onCandleColorRulesChangeRef.current = onCandleColorRulesChange;
  const controlledRules = candleColorRulesProp !== undefined;
  const setCandleColorRules = useCallback(
    (rules: CandleColorRule[]) => {
      if (!controlledRules) setInternalCandleColorRules(rules);
      onCandleColorRulesChangeRef.current?.(rules);
    },
    [controlledRules],
  );

  // Remonte chaque changement à l'application (pas le premier rendu : rien n'a encore changé).
  const onAppearanceChangeRef = useRef(onAppearanceChange);
  onAppearanceChangeRef.current = onAppearanceChange;
  const appearanceMounted = useRef(false);
  useEffect(() => {
    if (!appearanceMounted.current) {
      appearanceMounted.current = true;
      return;
    }
    onAppearanceChangeRef.current?.({
      upColor: upColorOverride,
      downColor: downColorOverride,
      volumeUpColor: volumeUpColorOverride,
      volumeDownColor: volumeDownColorOverride,
      closePulse: closePulseVisible,
      pastZone: pastZoneVisible,
      futureZone: futureZoneVisible,
      candleColorRules: internalCandleColorRules,
    });
  }, [upColorOverride, downColorOverride, volumeUpColorOverride, volumeDownColorOverride, closePulseVisible, pastZoneVisible, futureZoneVisible, internalCandleColorRules]);

  // Ticks once a second, only while `livePrice` is on — its only job is giving the countdown
  // badge (a plain DOM element, not part of the canvas draw effect) a reason to re-render each
  // second; the dashed line/price badge themselves only depend on `data` and don't need this.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!livePrice) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [livePrice]);

  return {
    settingsOpen,
    setSettingsOpen,
    upColorOverride,
    setUpColorOverride,
    downColorOverride,
    setDownColorOverride,
    volumeUpColorOverride,
    setVolumeUpColorOverride,
    volumeDownColorOverride,
    setVolumeDownColorOverride,
    volumeSettingsOpen,
    setVolumeSettingsOpen,
    yAutoScalingState,
    setYAutoScalingState,
    closePulseVisible,
    setClosePulseVisible,
    futureZoneVisible,
    setFutureZoneVisible,
    pastZoneVisible,
    setPastZoneVisible,
    candleColorRules,
    setCandleColorRules,
    now,
  };
}
