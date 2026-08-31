import { useEffect, useState } from "react";

export interface UseChartAppearanceArgs {
  YAutoScaling: boolean;
  livePrice: boolean;
}

/** Chart-settings-modal state: up/down bar color overrides (candles and, independently, volume),
 *  whether either settings modal is open, and the locally-owned copy of `YAutoScaling` the
 *  settings checkbox toggles — plus the once-a-second tick that only exists to give the live-price
 *  countdown badge (a plain DOM element, not part of the canvas draw effect) a reason to
 *  re-render. None of this reads or writes `drawings`/`indicators`/zoom state, so it's cheap to
 *  keep fully separate from every other concern in this file. */
export function useChartAppearance({ YAutoScaling, livePrice }: UseChartAppearanceArgs) {
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  // for a caller to control. Both default on — exigence : « par défaut je veux que ces 2 options
  // soit cochées » (a change from futureZoneVisible's own previous default-off, see git history).
  const [futureZoneVisible, setFutureZoneVisible] = useState(true);
  const [pastZoneVisible, setPastZoneVisible] = useState(true);

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
    futureZoneVisible,
    setFutureZoneVisible,
    pastZoneVisible,
    setPastZoneVisible,
    now,
  };
}
