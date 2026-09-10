/** One request from a script to the model, and its answer, as they cross the worker boundary.
 *
 *  A request/response pair with an id rather than one message each way: a script may ask several
 *  things, and the answers can arrive in any order. */
export interface ScriptAiRequestMessage {
  kind: "ai_request";
  id: number;
  prompt: string;
  options: { search?: boolean; format?: "texte" | "json"; system?: string };
}

export interface ScriptAiResponseMessage {
  kind: "ai_response";
  id: number;
  text?: string;
  error?: string;
}

export interface AiApi {
  /** Asks the model a question and waits for its answer.
   *
   *  `await` is not optional here — this is the one call in the whole sandbox that leaves the
   *  worker, and it is why a `@quant` or `@report` script is compiled as an async function. Every
   *  other API in this engine is synchronous and stays that way: a per-bar loop that awaited
   *  anything would not be a replay any more. */
  ask(prompt: string, options?: { search?: boolean; format?: "texte" | "json"; system?: string }): Promise<string>;
  /** Asks with the provider's own web search turned on. Sugar for `ask(prompt, { search: true })`,
   *  because "cherche sur internet" is what it is actually for and reads better as its own verb. */
  search(query: string): Promise<string>;
  /** Asks for JSON and parses it. Returns `null` rather than throwing when the answer is not
   *  valid JSON — a model that returned prose has given an answer, just not the shape asked for,
   *  and killing the whole report over it would be the wrong trade. */
  json(prompt: string, options?: { search?: boolean; system?: string }): Promise<unknown>;
}

/** `ai.*` — the one part of a script that reaches outside the sandbox.
 *
 *  Every call is forwarded to the main thread, which owns the provider (and the key), asks it, and
 *  posts the answer back. The worker never sees a credential and never opens a socket: what
 *  crosses the boundary is a string out and a string back.
 *
 *  Available only where a script can actually wait for an answer — a `@quant` analysis or a
 *  `@report`, both of which run once rather than once per bar. An indicator or a strategy is
 *  handed nothing, and calling it names what is missing, the same gate `strategy.*` and `report.*`
 *  already go through. */
export function buildAiApi(
  post: (message: ScriptAiRequestMessage) => void,
  register: (id: number, resolve: (text: string) => void, reject: (error: Error) => void) => void,
): AiApi {
  let nextId = 0;

  const ask: AiApi["ask"] = (prompt, options = {}) =>
    new Promise<string>((resolve, reject) => {
      const id = ++nextId;
      register(id, resolve, reject);
      post({ kind: "ai_request", id, prompt: String(prompt ?? ""), options });
    });

  return {
    ask,
    search: (query) => ask(query, { search: true }),
    json: async (prompt, options = {}) => {
      const answer = await ask(prompt, { ...options, format: "json" });
      try {
        // A model asked for JSON often wraps it in a fenced block anyway; unwrapping that here is
        // one line and saves every script from doing it.
        const unfenced = answer.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
        return JSON.parse(unfenced);
      } catch {
        return null;
      }
    },
  };
}
