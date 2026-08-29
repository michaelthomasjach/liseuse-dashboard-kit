import type { ScriptEngineSnapshot } from "../interfaces/ScriptEngineSnapshot.interface";
import { lockDownGlobals } from "./sandboxGlobals";
import { runScript } from "./runScript";

// Runs once, synchronously, before this module's own top-level evaluation finishes — and
// therefore strictly before `onmessage` below can ever receive anything, since a module worker
// only starts dispatching queued messages once its own top-level code has fully run. There is no
// window where a message could reach an unlocked worker.
lockDownGlobals();

self.onmessage = (e: MessageEvent<ScriptEngineSnapshot>) => {
  const result = runScript(e.data);
  (self as unknown as Worker).postMessage(result);
};
