import type { AiMessage, AiRequest, AiSend, AiStreamEvent } from "./interfaces/AiMessage.interface";

/** Default model. Opus 5 rather than a smaller one because of what this assistant is actually
 *  asked to do — read a backtest and say why its Sharpe is fragile, write a strategy from a
 *  description, decide which of a dozen chart tools a sentence means. */
export const DEFAULT_AI_MODEL = "claude-opus-5";

const API_VERSION = "2023-06-01";
/** Server tools, by the name this library uses. The dated identifiers are the provider's, and are
 *  what a request has to carry — mapped here so the rest of the code never spells one out. */
const SERVER_TOOL_TYPES: Record<string, { type: string; name: string }> = {
  web_search: { type: "web_search_20260209", name: "web_search" },
  web_fetch: { type: "web_fetch_20260209", name: "web_fetch" },
};

export interface AnthropicSendOptions {
  /** Sent as `x-api-key`. See `CandlestickChartProps.ai` on why putting one in a browser is a
   *  decision the caller makes deliberately, not a default. */
  apiKey: string;
  model?: string;
  /** For a gateway or proxy that speaks the same protocol. Defaults to the public API. */
  baseUrl?: string;
  maxTokens?: number;
}

function toApiMessages(messages: AiMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content.map((block) => {
      if (block.type === "text") return { type: "text", text: block.text };
      if (block.type === "tool_use") return { type: "tool_use", id: block.id, name: block.name, input: block.input };
      return { type: "tool_result", tool_use_id: block.toolUseId, content: block.content, is_error: block.isError };
    }),
  }));
}

/** Talks to the Anthropic Messages API straight from the browser.
 *
 *  Written against `fetch` and the raw SSE stream rather than the SDK: this is a charting library,
 *  and adding an API client to its dependency tree — for a feature most consumers will wire to
 *  their own backend instead — is a cost every one of them would pay. The protocol used here is
 *  small and stable: `messages`, `tools`, and the handful of `content_block_*` events below.
 *
 *  Adaptive thinking, because the questions this assistant is asked are the kind that deserve it,
 *  and streaming, because a turn that thinks and then calls three tools is long enough that
 *  waiting in silence reads as a hang. */
export function anthropicSend({ apiKey, model = DEFAULT_AI_MODEL, baseUrl = "https://api.anthropic.com", maxTokens = 8192 }: AnthropicSendOptions): AiSend {
  return async function* send(request: AiRequest, signal: AbortSignal): AsyncIterable<AiStreamEvent> {
    const tools = [
      ...request.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema })),
      // An unknown server-tool name is dropped rather than sent: the request would be rejected
      // whole, losing the turn over a capability that was optional to begin with.
      ...request.serverTools.flatMap((name) => (SERVER_TOOL_TYPES[name] ? [SERVER_TOOL_TYPES[name]] : [])),
    ];

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": API_VERSION,
          // Without this the API refuses a browser origin outright. Naming the risk in the header
          // is the provider's own design; see the `ai` prop's doc for what it means here.
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          stream: true,
          thinking: { type: "adaptive" },
          // The briefing is long and identical on every turn — exactly what caching is for.
          system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
          messages: toApiMessages(request.messages),
          ...(tools.length > 0 ? { tools } : {}),
        }),
      });
    } catch (err) {
      if (signal.aborted) return;
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
      return;
    }

    if (!response.ok || response.body === null) {
      const detail = await response.text().catch(() => "");
      yield { type: "error", message: `L'API a répondu ${response.status}. ${detail.slice(0, 400)}` };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    // A tool call arrives as a name, then its arguments in fragments, then a stop — assembled here
    // and only emitted whole, because half an argument object is not something anything can act on.
    const pendingTools = new Map<number, { id: string; name: string; json: string }>();
    let stopReason: "end_turn" | "tool_use" | "max_tokens" | "stop" = "stop";

    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (err) {
        if (signal.aborted) return;
        yield { type: "error", message: err instanceof Error ? err.message : String(err) };
        return;
      }
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      // SSE frames are separated by a blank line; a partial one stays in the buffer for the next
      // read rather than being parsed early.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        let event: Record<string, unknown>;
        try {
          event = JSON.parse(dataLine.slice(5).trim());
        } catch {
          continue;
        }
        const type = event.type;

        if (type === "content_block_start") {
          const block = event.content_block as { type?: string; id?: string; name?: string } | undefined;
          if (block?.type === "tool_use" && block.id && block.name) {
            pendingTools.set(event.index as number, { id: block.id, name: block.name, json: "" });
          }
        } else if (type === "content_block_delta") {
          const delta = event.delta as { type?: string; text?: string; partial_json?: string } | undefined;
          if (delta?.type === "text_delta" && delta.text) {
            yield { type: "text_delta", text: delta.text };
          } else if (delta?.type === "input_json_delta" && delta.partial_json !== undefined) {
            const pending = pendingTools.get(event.index as number);
            if (pending) pending.json += delta.partial_json;
          }
        } else if (type === "content_block_stop") {
          const pending = pendingTools.get(event.index as number);
          if (pending) {
            pendingTools.delete(event.index as number);
            let input: Record<string, unknown> = {};
            try {
              // An empty argument list streams as no fragments at all, not as "{}".
              input = pending.json.trim() === "" ? {} : (JSON.parse(pending.json) as Record<string, unknown>);
            } catch {
              yield { type: "error", message: `Arguments illisibles pour l'outil « ${pending.name} ».` };
              continue;
            }
            yield { type: "tool_use", id: pending.id, name: pending.name, input };
          }
        } else if (type === "message_delta") {
          const reason = (event.delta as { stop_reason?: string } | undefined)?.stop_reason;
          if (reason === "tool_use" || reason === "end_turn" || reason === "max_tokens") stopReason = reason;
        } else if (type === "error") {
          const message = (event.error as { message?: string } | undefined)?.message;
          yield { type: "error", message: message ?? "Erreur inconnue de l'API." };
          return;
        }
      }
    }

    yield { type: "done", stopReason };
  };
}
