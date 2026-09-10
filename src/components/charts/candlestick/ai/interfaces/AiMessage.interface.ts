/** One block of a message. Deliberately a small, provider-neutral set: text the user or the model
 *  wrote, a tool the model asked for, and that tool's own result. Anything a specific provider
 *  offers beyond these (thinking blocks, citations, images) is either mapped onto text or dropped
 *  by that provider's own adapter — this library's conversation model is what the panel renders
 *  and what a caller-supplied transport has to satisfy, so it stays the smaller of the two. */
export type AiContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; content: string; isError?: boolean };

export interface AiMessage {
  role: "user" | "assistant";
  content: AiContentBlock[];
}

/** What the model may do, described the way every current provider describes it: a name, a
 *  sentence, and a JSON Schema for the arguments. */
export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** A server-side tool the provider itself runs (web search, web fetch) — named rather than
 *  described, because the provider owns its implementation and its schema. An unsupported name is
 *  dropped by the adapter rather than failing the request. */
export type AiServerTool = "web_search" | "web_fetch";

export interface AiRequest {
  /** The whole conversation so far, oldest first. */
  messages: AiMessage[];
  /** Prepended context: who the assistant is, what the chart currently holds, and — when the
   *  request touches scripting — the whole scripting manual. Sent as the system prompt, which is
   *  what makes it cacheable across turns. */
  system: string;
  tools: AiToolDefinition[];
  serverTools: AiServerTool[];
}

/** What a turn produces, as it arrives. `text` streams in fragments; a `tool_use` arrives whole,
 *  because a half-parsed argument object is not something anything can act on. */
export type AiStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "done"; stopReason: "end_turn" | "tool_use" | "max_tokens" | "stop" }
  | { type: "error"; message: string };

/** The one thing this library needs from an AI provider: turn a request into a stream of events.
 *
 *  A function rather than a class, and part of the public props, because *where the model lives is
 *  the caller's decision*: a server route of their own that holds the key, a gateway, or — with
 *  `apiKey` — Anthropic straight from the browser. This library never stores a key, never chooses
 *  a provider on the caller's behalf, and works identically whichever they pick. */
export type AiSend = (request: AiRequest, signal: AbortSignal) => AsyncIterable<AiStreamEvent>;
