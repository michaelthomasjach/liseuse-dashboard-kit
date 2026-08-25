import { useEffect, useRef, useState } from "react";

export interface UseFullscreenControlled {
  isFullscreen: boolean;
  onChange: (value: boolean) => void;
}

/**
 * CSS-driven "fullscreen" (a fixed, viewport-covering overlay) rather than the
 * native Fullscreen API — the native API silently fails inside sandboxed
 * iframes (e.g. Storybook's preview frame) unless `allow="fullscreen"` is set
 * on the iframe, which a component library can't guarantee for its consumers.
 * This works everywhere and needs no permissions.
 *
 * Pass `controlled` to let an owner outside this hook decide the value instead of it managing its
 * own state — `ChartWorkspace` does this so only one panel can be "focused" at a time (setting a
 * new panel's value to `true` there naturally supersedes whichever other panel had it before,
 * since they all read from the same single piece of state). Escape-to-exit and the body-scroll
 * lock below apply identically either way.
 */
export function useFullscreen(controlled?: UseFullscreenControlled) {
  const [internalIsFullscreen, setInternalIsFullscreen] = useState(false);
  const isFullscreen = controlled?.isFullscreen ?? internalIsFullscreen;
  const setIsFullscreen = controlled?.onChange ?? setInternalIsFullscreen;
  // A controlled caller's `onChange` is a fresh function every render (ChartWorkspace's own is an
  // inline closure over the panel index) — unlike a plain useState setter, that's not something
  // exhaustive-deps can treat as stable, so it's read through a ref inside the effect instead of
  // listed as a dependency directly. That keeps the effect (and the Escape listener/body-scroll
  // lock it sets up) from tearing down and re-running every render for no reason.
  const setIsFullscreenRef = useRef(setIsFullscreen);
  setIsFullscreenRef.current = setIsFullscreen;

  useEffect(() => {
    if (!isFullscreen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsFullscreenRef.current(false);
    }
    window.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  return { isFullscreen, toggle: () => setIsFullscreen(!isFullscreen) };
}
