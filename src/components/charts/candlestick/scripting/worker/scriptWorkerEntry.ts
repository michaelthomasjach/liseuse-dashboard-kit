import type { ScriptEngineSnapshot } from "../interfaces/ScriptEngineSnapshot.interface";
import { lockDownGlobals } from "./sandboxGlobals";
import { runScript } from "./runScript";

// Captured before lockdown blocks the ambient `postMessage` global (see BLOCKED_GLOBALS' own
// doc) — this module's own one legitimate use of it, below, needs to keep working even once a
// user script's own attempt to call the (now-blocked) global one throws instead.
const realPostMessage = self.postMessage.bind(self);

// Runs once, synchronously, before this module's own top-level evaluation finishes — and
// therefore strictly before `onmessage` below can ever receive anything, since a module worker
// only starts dispatching queued messages once its own top-level code has fully run. There is no
// window where a message could reach an unlocked worker.
lockDownGlobals();

self.onmessage = (e: MessageEvent<ScriptEngineSnapshot>) => {
  const result = runScript(e.data);
  realPostMessage(result);
};
