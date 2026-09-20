import { useEffect, useState } from "react";

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
}

/** Chart-settings-modal state: up/down bar color overrides (candles and, independently, volume),
 *  whether either settings modal is open, and the locally-owned copy of `YAutoScaling` the
 *  settings checkbox toggles — plus the once-a-second tick that only exists to give the live-price
 *  countdown badge (a plain DOM element, not part of the canvas draw effect) a reason to
 *  re-render. None of this reads or writes `drawings`/`indicators`/zoom state, so it's cheap to
 *  keep fully separate from every other concern in this file. */
export function useChartAppearance({ YAutoScaling, livePrice, controlledSettings }: UseChartAppearanceArgs) {
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);
  const settingsOpen = controlledSettings?.open ?? internalSettingsOpen;
  const setSettingsOpen: (open: boolean) => void = controlledSettings?.onChange ?? setInternalSettingsOpen;
  // Per-chart color overrides for up/down bars — `undefined` (the default) means "use the
  // theme's own --lq-color-up/--lq-color-down", same as before this modal existed.
  const [upColorOverride, setUpColorOverride] = useState<string | undefined>(undefined);
  const [downColorOverride, setDownColorOverride] = useState<string | undefined>(undefined);
  // Same idea, scoped to the volume pane's own bars instead of the candles — `undefined` means
  // "mirror whichever of colorUp/colorDown above is currently in effect" (theme or its own
  // override), same as volume bars have always done, just now overridable independently.
  const [volumeUpColorOverride, setVolumeUpColorOverride] = useState<string | undefined>(undefined);
  const [volumeDownColorOverride, setVolumeDownColorOverride] = useState<string | undefined>(undefined);
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
  const [closePulseVisible, setClosePulseVisible] = useState(true);
  const [futureZoneVisible, setFutureZoneVisible] = useState(false);
  const [pastZoneVisible, setPastZoneVisible] = useState(false);

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
    now,
  };
}
