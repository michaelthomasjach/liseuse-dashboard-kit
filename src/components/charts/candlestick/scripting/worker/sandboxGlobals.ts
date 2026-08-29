/** Every global a user script must never reach, neutralized once at the top of
 *  scriptWorkerEntry.ts — before `onmessage` is even registered, so there's no window where a
 *  message could be processed against an unlocked worker. `Worker` itself is included: a Worker
 *  can spawn nested workers, which would otherwise be a trivial way back out to everything this
 *  list is trying to block. Deliberately *not* included: `Math`/`Date`/`JSON`/`Array`/typed
 *  arrays/`Map`/`Set` — safe, pure-value builtins a script legitimately needs (see runScript.ts's
 *  own doc on why `Date` specifically is left ticking rather than frozen). `console` is wrapped,
 *  not blocked — see buildScriptApi.ts. */
const BLOCKED_GLOBALS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "importScripts",
  "Worker",
  "indexedDB",
  "caches",
  "Notification",
] as const;

/** Reassignment-to-throw, not `delete`: a global's own data-property `delete` can silently no-op
 *  if the engine happens to mark it non-configurable, leaving the caller with no signal that
 *  anything went wrong; reassigning a plain writable property always takes effect. The `try/catch`
 *  is defense-in-depth's own admission of its limits — if a given engine *does* expose one of
 *  these as non-writable/non-configurable, this can't force it closed, which is exactly why the
 *  approved plan calls this "eventual forced termination" (the timeout backstop in
 *  useScriptEngine.ts), not airtight sandboxing (that's what a future stricter interpreter
 *  backend would buy instead — see the plan's own sandbox-swap note). */
export function lockDownGlobals() {
  const globalScope = self as unknown as Record<string, unknown>;
  for (const name of BLOCKED_GLOBALS) {
    try {
      globalScope[name] = () => {
        throw new Error(`"${name}" n'est pas accessible depuis un script.`);
      };
    } catch {
      // Non-writable in this engine — nothing more this mechanism can do.
    }
  }
  // navigator.sendBeacon sits one level down, not a top-level global — same reassignment
  // mechanism, scoped to just this one method rather than freezing all of `navigator` (a script
  // reading e.g. navigator.userAgent is harmless and not worth blocking).
  try {
    (navigator as unknown as Record<string, unknown>).sendBeacon = () => {
      throw new Error('"navigator.sendBeacon" n\'est pas accessible depuis un script.');
    };
  } catch {
    // Same reasoning as above.
  }
}
