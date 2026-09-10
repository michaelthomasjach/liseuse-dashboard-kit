import type { AiSend, AiServerTool } from "./interfaces/AiMessage.interface";

/** One complete answer, collected from a stream.
 *
 *  A script asked a question and is blocked waiting for it: there is nothing for it to do with a
 *  half-arrived answer, so unlike the panel this does not stream — it gathers and returns. Tool
 *  calls are ignored on purpose: the model is answering a script's question here, not driving the
 *  chart, and letting a `@report` quietly rewrite the user's indicators from inside a run is a
 *  capability nobody asked for. */
export async function answerScriptAiRequest(
  send: AiSend,
  prompt: string,
  options: { search?: boolean; format?: "texte" | "json"; system?: string },
  serverTools: AiServerTool[],
  signal: AbortSignal,
): Promise<string> {
  const system = [
    options.system ??
      "Tu réponds à une question posée depuis un script d'analyse financière. Sois bref, factuel, et n'invente aucun chiffre : si tu ne sais pas, dis-le.",
    options.format === "json" ? "Réponds uniquement par du JSON valide, sans texte autour et sans bloc de code." : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let text = "";
  for await (const event of send(
    {
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      system,
      tools: [],
      // Web search only when the script asked for it — a lookup the author did not request is one
      // they did not budget for either.
      serverTools: options.search ? serverTools.filter((tool) => tool === "web_search" || tool === "web_fetch") : [],
    },
    signal,
  )) {
    if (event.type === "text_delta") text += event.text;
    else if (event.type === "error") throw new Error(event.message);
  }
  return text.trim();
}
