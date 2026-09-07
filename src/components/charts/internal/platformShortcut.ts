/** Whether the running platform labels its own primary modifier "⌘" rather than "Ctrl".
 *
 *  Detected once at module load from the UA, since it cannot change under a running page. Every
 *  keyboard *handler* in this library already accepts either modifier (`e.ctrlKey || e.metaKey`),
 *  so this is only ever about what the user is told to press — a Mac user reading "Ctrl+S" on a
 *  button whose shortcut is really ⌘S has been given the wrong instruction, even though pressing
 *  it would have worked. */
const IS_APPLE_PLATFORM =
  typeof navigator !== "undefined" &&
  // `userAgentData.platform` where it exists, falling back to the classic strings. iPadOS reports
  // itself as "MacIntel" with touch points, which lands on ⌘ either way — correct for a hardware
  // keyboard, and irrelevant without one.
  /mac|iphone|ipad|ipod/i.test(
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? navigator.userAgent,
  );

/** The platform's own spelling of a primary-modifier shortcut: `shortcutLabel("S")` reads "⌘S" on
 *  a Mac and "Ctrl+S" everywhere else. */
export function shortcutLabel(key: string): string {
  return IS_APPLE_PLATFORM ? `⌘${key.toUpperCase()}` : `Ctrl+${key.toUpperCase()}`;
}

export { IS_APPLE_PLATFORM };
