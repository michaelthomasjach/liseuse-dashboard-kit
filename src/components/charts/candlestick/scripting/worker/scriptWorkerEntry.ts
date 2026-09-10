import type { ScriptEngineSnapshot } from "../interfaces/ScriptEngineSnapshot.interface";
import { lockDownGlobals } from "./sandboxGlobals";
import { runScript } from "./runScript";
import { buildAiApi, type ScriptAiRequestMessage, type ScriptAiResponseMessage } from "./buildAiApi";

// Captured before lockdown blocks the ambient `postMessage` global (see BLOCKED_GLOBALS' own
// doc) — this module's own one legitimate use of it, below, needs to keep working even once a
// user script's own attempt to call the (now-blocked) global one throws instead.
const realPostMessage = self.postMessage.bind(self);

// Runs once, synchronously, before this module's own top-level evaluation finishes — and
// therefore strictly before `onmessage` below can ever receive anything, since a module worker
// only starts dispatching queued messages once its own top-level code has fully run. There is no
// window where a message could reach an unlocked worker.
lockDownGlobals();

/** Script questions still waiting on the main thread, by id. Cleared when the answer arrives, and
 *  rejected wholesale if a new run starts — a question asked by the previous run has nobody left
 *  to hear its answer. */
const pendingAi = new Map<number, { resolve: (text: string) => void; reject: (error: Error) => void }>();

function failPendingAi(reason: string) {
  for (const { reject } of pendingAi.values()) reject(new Error(reason));
  pendingAi.clear();
}

self.onmessage = async (e: MessageEvent<ScriptEngineSnapshot | ScriptAiResponseMessage>) => {
  const data = e.data;

  // An answer to something a running script asked. Routed by id rather than assumed to be the
  // oldest: a script may have several questions in flight, and they can come back in any order.
  if ((data as ScriptAiResponseMessage).kind === "ai_response") {
    const message = data as ScriptAiResponseMessage;
    const waiting = pendingAi.get(message.id);
    if (!waiting) return;
    pendingAi.delete(message.id);
    if (message.error !== undefined) waiting.reject(new Error(message.error));
    else waiting.resolve(message.text ?? "");
    return;
  }

  failPendingAi("Une nouvelle exécution a commencé avant la réponse de l'IA.");
  const snapshot = data as ScriptEngineSnapshot;
  // Built only where a script can actually wait for an answer, which is the same gate every other
  // capability goes through — see buildAiApi. An indicator or a strategy gets `null`, so calling
  // `ai.ask(...)` there names what is missing rather than hanging forever.
  const ai =
    snapshot.quant !== undefined || snapshot.report !== undefined
      ? buildAiApi(
          (message: ScriptAiRequestMessage) => realPostMessage(message),
          (id, resolve, reject) => pendingAi.set(id, { resolve, reject }),
        )
      : null;

  const result = await runScript(snapshot, ai);
  failPendingAi("Le script s'est terminé avant la réponse de l'IA.");
  realPostMessage(result);
};
