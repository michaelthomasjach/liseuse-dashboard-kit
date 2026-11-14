import { useCallback, useEffect, useRef, useState } from "react";
import type { AiChartContext } from "./interfaces/AiChartContext.interface";
import type { AiContentBlock, AiMessage, AiSend, AiServerTool } from "./interfaces/AiMessage.interface";
import { availableAiTools, runAiTool } from "./aiTools";
import { buildAiSystemPrompt } from "./aiSystemPrompt";
import { loadScriptingPrompt } from "../scripting/loadScriptingPrompt";
import { answerScriptingDocs, SCRIPTING_DOCS_TOOL, scriptInAnswer } from "./scriptingDocs";

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
  /** Conversations gardées par l'application (voir `AiConversationStore`) ; sans elles, une seule conversation, perdue
   *  quand le graphique se démonte. */
  conversations?: AiConversationStore;
}

/** Une conversation de l'assistant : ce qui s'affiche et ce que le modèle relit. */
export interface AiConversation {
  id: string;
  /** Début de la première question de l'utilisateur. */
  title: string;
  updatedAt: string;
  transcript: AiTranscriptEntry[];
  history: AiMessage[];
}

/** Conversations tenues par l'application : lues au montage, rendues à chaque changement (à enregistrer). */
export interface AiConversationStore {
  initial: AiConversation[];
  activeId?: string | null;
  onChange: (conversations: AiConversation[], activeId: string | null) => void;
}

const MAX_CONVERSATIONS = 30;
const MAX_HISTORY = 40;
const MAX_TRANSCRIPT = 200;
const MAX_BLOCK_TEXT = 6_000;

/** Titre d'une conversation : le début de sa première question. */
function titleOf(transcript: AiTranscriptEntry[]): string {
  const first = transcript.find((e) => e.role === "user")?.text.replace(/\s+/g, " ").trim() ?? "";
  return first.length > 48 ? `${first.slice(0, 47)}…` : first || "Nouvelle conversation";
}

const cut = (s: string) => (s.length > MAX_BLOCK_TEXT ? `${s.slice(0, MAX_BLOCK_TEXT)}…` : s);

/** Ce qui est gardé d'une conversation : les derniers messages, textes bornés ; elle recommence toujours par une
 *  question (un résultat d'outil sans son appel serait refusé par le modèle). */
function pruned(history: AiMessage[]): AiMessage[] {
  let kept = history.slice(-MAX_HISTORY);
  while (kept.length && !(kept[0].role === "user" && kept[0].content.some((b) => b.type === "text"))) kept = kept.slice(1);
  return kept.map((m) => ({
    ...m,
    content: m.content.map((b) => (b.type === "text" ? { ...b, text: cut(b.text) } : b.type === "tool_result" ? { ...b, content: cut(b.content) } : b)),
  }));
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
// Unique d'une page à l'autre : des conversations enregistrées reviennent avec leurs identifiants.
const makeId = () => `ai-${Date.now().toString(36)}-${(++nextId).toString(36)}`;

/** One live conversation: what has been said, whether a turn is in flight, and the three things
 *  that can be done to it. Named rather than inferred because it travels as a prop — the panel that
 *  renders a conversation is mounted and unmounted as it moves between the dock, a floating window
 *  and a torn-off browser window, so the conversation itself has to live above all three. */
export interface AiAssistant {
  transcript: AiTranscriptEntry[];
  busy: boolean;
  ask: (question: string) => Promise<void>;
  stop: () => void;
  /** Efface la conversation en cours (retirée de la liste). */
  reset: () => void;
  /** Conversations enregistrées, la plus récente d'abord, et celle affichée. */
  conversations: AiConversation[];
  activeConversationId: string | null;
  /** Une conversation neuve (l'actuelle reste dans la liste). */
  newConversation: () => void;
  selectConversation: (id: string) => void;
}

/** Runs the conversation: sends a turn, executes whatever tools the model asks for, sends the
 *  results back, and repeats until it stops asking.
 *
 *  The tool loop lives here rather than in the transport because *which* tools exist is a property
 *  of this chart, not of the provider: a caller who routes the model through their own backend gets
 *  the same tools, executed in the same browser, against the same chart. The transport's only job
 *  is to turn a request into a stream of events. */
export function useAiAssistant({ chart, send, serverTools, conversations: store }: UseAiAssistantArgs): AiAssistant {
  // Conversations : celles de l'application au montage ; la conversation affichée est reprise telle quelle.
  const [conversations, setConversations] = useState<AiConversation[]>(() => store?.initial ?? []);
  const initialActive = store?.initial.find((c) => c.id === store.activeId) ?? null;
  const [activeId, setActiveId] = useState<string>(() => initialActive?.id ?? makeId());
  const [transcript, setTranscript] = useState<AiTranscriptEntry[]>(() => initialActive?.transcript ?? []);
  const [busy, setBusy] = useState(false);
  const storeRef = useRef(store);
  storeRef.current = store;
  /** Une question a été posée depuis le dernier enregistrement (choisir une conversation ne la ré-enregistre pas). */
  const dirtyRef = useRef(false);
  /** The conversation as the model sees it — kept in a ref, not state: it changes several times
   *  within one `ask` (once per tool round) and nothing renders from it directly. */
  const historyRef = useRef<AiMessage[]>(initialActive?.history ?? []);
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

  /** Rend la liste à l'application (à enregistrer). */
  const publish = useCallback((list: AiConversation[], active: string | null) => {
    setConversations(list);
    storeRef.current?.onChange(list, active);
  }, []);

  // Chaque réponse terminée : la conversation affichée est enregistrée (en tête de liste), nommée par sa première question.
  useEffect(() => {
    if (busy || !dirtyRef.current || transcript.length === 0) return;
    dirtyRef.current = false;
    setConversations((prev) => {
      const current: AiConversation = {
        id: activeId,
        title: titleOf(transcript),
        updatedAt: new Date().toISOString(),
        transcript: transcript.slice(-MAX_TRANSCRIPT).map((e) => ({ ...e, text: cut(e.text) })),
        history: pruned(historyRef.current),
      };
      const next = [current, ...prev.filter((c) => c.id !== activeId)].slice(0, MAX_CONVERSATIONS);
      storeRef.current?.onChange(next, activeId);
      return next;
    });
  }, [busy, transcript, activeId]);

  const reset = useCallback(() => {
    stop();
    historyRef.current = [];
    setTranscript([]);
    const fresh = makeId();
    setActiveId(fresh);
    publish(
      conversations.filter((c) => c.id !== activeId),
      fresh,
    );
  }, [stop, publish, conversations, activeId]);

  const newConversation = useCallback(() => {
    stop();
    historyRef.current = [];
    setTranscript([]);
    const fresh = makeId();
    setActiveId(fresh);
    storeRef.current?.onChange(conversations, fresh);
  }, [stop, conversations]);

  const selectConversation = useCallback(
    (id: string) => {
      const c = conversations.find((x) => x.id === id);
      if (!c || id === activeId) return;
      stop();
      historyRef.current = c.history;
      setTranscript(c.transcript);
      setActiveId(id);
      storeRef.current?.onChange(conversations, id);
    },
    [conversations, activeId, stop],
  );

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || send === null) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      dirtyRef.current = true;

      setTranscript((prev) => [...prev, { id: makeId(), role: "user", text }]);
      historyRef.current = [...historyRef.current, { role: "user", content: [{ type: "text", text }] }];

      // The manual is only fetched once per session and only when the assistant is actually used —
      // 107KB of prose that a consumer who never opens this panel should not download.
      const manual = await loadScriptingPrompt().catch(() => null);
      // Un script a-t-il été enregistré par l'outil pendant cette question ? Sinon, celui que le modèle aurait écrit
      // dans sa réponse est enregistré à sa place (voir `keepScriptFromAnswer`).
      let scriptSaved = false;
      /** Script créé pendant cette question : une nouvelle écriture sans « id » (le modèle qui corrige son code) le
       *  remplace au lieu d'ouvrir un onglet de plus. */
      let createdId: string | null = null;
      /** Code d'un script laissé dans la réponse écrite au lieu de passer par `ecrire_un_script` : enregistré dans un
       *  nouvel onglet de l'éditeur, ouvert et exécuté — jamais perdu, et jamais « affiché » seulement en paroles. */
      const keepScriptFromAnswer = (answerText: string) => {
        if (scriptSaved) return;
        const found = scriptInAnswer(answerText);
        if (!found) return;
        const chart = chartRef.current;
        const id = chart.addScript(found.name, found.code);
        chart.runScript(id);
        chart.openScript?.(id);
        scriptSaved = true;
        createdId = id;
        setTranscript((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "tool",
            toolName: "ecrire_un_script",
            text: `Code de la réponse enregistré dans un nouvel onglet de l'éditeur (« ${found.name} ») et exécuté.`,
          },
        ]);
      };

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
          if (stopReason !== "tool_use" || calls.length === 0) {
            keepScriptFromAnswer(streamed);
            return;
          }

          // Every call the model made in this turn, run in order, and *all* their results sent back
          // in one user message — the protocol requires one result per call, and sending them one
          // at a time would leave the others unanswered.
          const results: AiContentBlock[] = [];
          for (const call of calls) {
            // Correction du script qu'il vient de créer : le même onglet, pas un nouveau fichier.
            const input: Record<string, unknown> =
              call.name === "ecrire_un_script" && createdId !== null && typeof call.input.id !== "string" && chartRef.current.scripts.some((s) => s.id === createdId)
                ? { ...call.input, id: createdId }
                : call.input;
            // La documentation est servie ici, où le manuel est chargé ; tout autre outil agit sur le graphique.
            const outcome = call.name === SCRIPTING_DOCS_TOOL ? answerScriptingDocs(manual, input) : runAiTool(call.name, input, chartRef.current);
            if (call.name === "ecrire_un_script" && !outcome.isError) {
              scriptSaved = true;
              createdId = typeof input.id === "string" ? input.id : (/\(id ([^)\s]+)\)/.exec(outcome.content)?.[1] ?? createdId);
            }
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

  return {
    transcript,
    busy,
    ask,
    stop,
    reset,
    conversations,
    activeConversationId: transcript.length > 0 || conversations.some((c) => c.id === activeId) ? activeId : null,
    newConversation,
    selectConversation,
  };
}
