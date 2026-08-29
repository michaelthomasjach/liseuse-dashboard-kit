export interface StateApi {
  get(key: string, defaultValue?: unknown): unknown;
  set(key: string, value: unknown): void;
}

/** `state.get/set` — a plain `Map` local to one `runScript` call, never persisted anywhere beyond
 *  it. Per the approved plan, script state is *reconstructed from bar 0 on every run* rather than
 *  carried over between runs (a real-time tick is a full replay that merely goes one bar further,
 *  not a resumed continuation of some previous in-memory state) — closer to how Pine Script's own
 *  `var` behaves across a re-compile, and it sidesteps a whole class of "stale state from a
 *  previous version of the script" bugs for free. `get`'s `defaultValue` (falling back to `null`,
 *  matching every other "nothing here yet" result this API returns) is what lets a script write
 *  `state.get("count", 0)` instead of needing an `undefined` check on every read. */
export function buildStateApi(): StateApi {
  const store = new Map<string, unknown>();
  return {
    get: (key, defaultValue = null) => (store.has(key) ? store.get(key) : defaultValue),
    set: (key, value) => {
      store.set(key, value);
    },
  };
}
