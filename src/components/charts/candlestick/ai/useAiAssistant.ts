import { useCallback, useRef, useState } from "react";
import type { AiChartContext } from "./interfaces/AiChartContext.interface";
import type { AiContentBlock, AiMessage, AiSend, AiServerTool } from "./interfaces/AiMessage.interface";
import { availableAiTools, runAiTool } from "./aiTools";
import { buildAiSystemPrompt } from "./aiSystemPrompt";
import { loadScriptingPrompt } from "../scripting/loadScriptingPrompt";

/** How many times a single question may bounce between the model and the tools before the loop
 *  gives up. Generous — "lis le graphique, ajoute trois indicateurs, écris la stratégie, exécute-la,
 *  relis le backtest" is six turns and a perfectly ordinary request — but finite, because a model
 *  that has decided to call the same tool forever should cost one bounded amount of money, not an
 *  unbounded one. */
const MAX_TOOL_ROUNDS = 12;

export interface UseAiAssistantArgs {
  chart: AiChartContext;
  send: AiSend | null;
  serverTools: AiServerTool[];
}

/** One entry of the transcript, as the panel renders it. Distinct from `AiMessage`, which is what
 *  the model is sent: a tool call and its result are one line on screen and two blocks on the
 *  wire. */
export interface AiTranscriptEntry {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  /** `role: "tool"` only — what it was asked to do, and whether it worked. */
  toolName?: string;
  isError?: boolean;
}

let nextId = 0;
const makeId = () => `ai-${++nextId}`;

/** Runs the conversation: sends a turn, executes whatever tools the model asks for, sends the
 *  results back, and repeats until it stops asking.
 *
 *  The tool loop lives here rather than in the transport because *which* tools exist is a property
 *  of this chart, not of the provider: a caller who routes the model through their own backend gets
 *  the same tools, executed in the same browser, against the same chart. The transport's only job
 *  is to turn a request into a stream of events. */
export function useAiAssistant({ chart, send, serverTools }: UseAiAssistantArgs) {
  const [transcript, setTranscript] = useState<AiTranscriptEntry[]>([]);
  const [busy, setBusy] = useState(false);
  /** The conversation as the model sees it — kept in a ref, not state: it changes several times
   *  within one `ask` (once per tool round) and nothing renders from it directly. */
  const historyRef = useRef<AiMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  /** The chart, always current. `ask` runs across many awaits, and the chart it acts on at the end
   *  must be the one on screen then, not the one captured when the question was asked. */
  const chartRef = useRef(chart);
  chartRef.current = chart;

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    historyRef.current = [];
    setTranscript([]);
  }, [stop]);

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || send === null) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);

      setTranscript((prev) => [...prev, { id: makeId(), role: "user", text }]);
      historyRef.current = [...historyRef.current, { role: "user", content: [{ type: "text", text }] }];

      // The manual is only fetched once per session and only when the assistant is actually used —
      // 107KB of prose that a consumer who never opens this panel should not download.
      const manual = await loadScriptingPrompt().catch(() => null);

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          if (controller.signal.aborted) return;
          const tools = availableAiTools(chartRef.current);
          const request = {
            messages: historyRef.current,
            system: buildAiSystemPrompt(chartRef.current, manual),
            tools: tools.map((t) => t.definition),
            serverTools,
          };

          const answer: AiContentBlock[] = [];
          const entryId = makeId();
          let streamed = "";
          let stopReason: string = "stop";
          let failed = false;

          for await (const event of send(request, controller.signal)) {
            if (controller.signal.aborted) return;
            if (event.type === "text_delta") {
              streamed += event.text;
              // One transcript entry per assistant turn, rewritten as it streams — a new entry per
              // fragment would make the list re-key on every token.
              setTranscript((prev) => {
                const existing = prev.find((e) => e.id === entryId);
                if (existing) return prev.map((e) => (e.id === entryId ? { ...e, text: streamed } : e));
                return [...prev, { id: entryId, role: "assistant", text: streamed }];
              });
            } else if (event.type === "tool_use") {
              answer.push({ type: "tool_use", id: event.id, name: event.name, input: event.input });
            } else if (event.type === "done") {
              stopReason = event.stopReason;
            } else if (event.type === "error") {
              failed = true;
              setTranscript((prev) => [...prev, { id: makeId(), role: "assistant", text: event.message, isError: true }]);
            }
          }

          if (failed) return;
          if (streamed.trim()) answer.unshift({ type: "text", text: streamed });
          if (answer.length === 0) return;
          historyRef.current = [...historyRef.current, { role: "assistant", content: answer }];

          const calls = answer.filter((block): block is Extract<AiContentBlock, { type: "tool_use" }> => block.type === "tool_use");
          if (stopReason !== "tool_use" || calls.length === 0) return;

          // Every call the model made in this turn, run in order, and *all* their results sent back
          // in one user message — the protocol requires one result per call, and sending them one
          // at a time would leave the others unanswered.
          const results: AiContentBlock[] = [];
          for (const call of calls) {
            const outcome = runAiTool(call.name, call.input, chartRef.current);
            results.push({ type: "tool_result", toolUseId: call.id, content: outcome.content, isError: outcome.isError });
            setTranscript((prev) => [
              ...prev,
              { id: makeId(), role: "tool", toolName: call.name, text: outcome.content, isError: outcome.isError },
            ]);
          }
          historyRef.current = [...historyRef.current, { role: "user", content: results }];
        }

        setTranscript((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "assistant",
            text: `L'assistant a enchaîné ${MAX_TOOL_ROUNDS} appels d'outils sans conclure — arrêté ici. Reformulez en découpant la demande.`,
            isError: true,
          },
        ]);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setBusy(false);
        }
      }
    },
    [send, serverTools],
  );

  return { transcript, busy, ask, stop, reset };
}
