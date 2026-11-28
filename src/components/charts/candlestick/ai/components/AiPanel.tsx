import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpIcon, CheckIcon, ChevronDownIcon, CloseIcon, DetachWindowIcon, MaximizeIcon, PlusIcon, SparkleIcon, TrashIcon } from "../../../../icons";
import { toolStep, type AiTranscriptEntry } from "../useAiAssistant";
import type { AiChartContext } from "../interfaces/AiChartContext.interface";
import type { AiSend } from "../interfaces/AiMessage.interface";
import type { AiAssistant } from "../useAiAssistant";
import { filterSlashCommands, slashCommandsFor, slashQueryAt, type SlashCommand } from "../slashCommands";
import { filterMentions, mentionQueryAt, mentionSegments, type Mentionable } from "../mentions";
import { DictationButton } from "../../../../forms/Dictation";
import "./AiPanel.css";
import { AiMarkdown } from "./AiMarkdown";
import type { ScriptReport } from "../../scripting/interfaces/ScriptReport.interface";
import { ReportPrintWindow } from "../../scripting/components/ReportPrintWindow";
import { ReportView } from "../../scripting/components/ReportView";
import { Modal } from "../../../../primitives/Modal";
import { DropdownPanel } from "../../../../primitives/DropdownPanel";

export interface AiPanelProps {
  open: boolean;
  onClose: () => void;
  chart: AiChartContext;
  /** Null when the caller configured no transport — the panel then explains that rather than
   *  offering a box that could never answer. Only read to decide *that*: running the conversation
   *  is the host's job now (see `assistant`). */
  send: AiSend | null;
  /** Extra symbols to offer in the `/` menu, beyond the chart's own — a watchlist, typically. */
  symbols: string[];
  /** The conversation, owned above this panel. It has to be: this same panel is unmounted and
   *  remounted as it moves between the dock, a floating window and a torn-off browser window, and
   *  a transcript held here would be thrown away on each move — exigence : « l'historique des
   *  conversations doit être affiché dans la discussion ». */
  assistant: AiAssistant;
  /** The composer's text, owned above for the same reason as `assistant`: a half-typed question
   *  should survive being popped out, not be the price of popping out. */
  draft: string;
  onDraftChange: (draft: string) => void;
  /** Opens the assistant in a floating window that can be dragged around the screen. Absent means
   *  the host does not offer it and no button appears — the same convention the strategy tester's
   *  own header follows. */
  onRequestWindow?: () => void;
  /** Tears it off into a real second browser window. */
  onRequestDetach?: () => void;
  /** "bare" drops the header's own window controls — for the floating window and the detached one,
   *  each of which supplies its own way out and its own frame. The docked pane is "full". */
  chrome?: "full" | "bare";
}

const PLACEHOLDER = "Posez une question, ou tapez / pour une commande";

/** The assistant, docked to the right of the chart.
 *
 *  A panel rather than a modal: everything it is asked about is on the chart behind it, and a
 *  dialog that covers the very thing being discussed would have to be dismissed to check its own
 *  answers. */
export function AiPanel({
  open,
  onClose,
  chart,
  send,
  symbols,
  assistant,
  draft,
  onDraftChange,
  onRequestWindow,
  onRequestDetach,
  chrome = "full",
}: AiPanelProps) {
  const { transcript, busy, ask, stop, reset, conversations, activeConversationId, newConversation, selectConversation, deleteConversation } = assistant;
  /** Liste des conversations (menu déroulant du kit sous le titre) et conversation dont la suppression attend confirmation. */
  const [conversationsOpen, setConversationsOpen] = useState(false);
  const conversationsAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [conversationToDelete, setConversationToDelete] = useState<{ id: string; title: string } | null>(null);
  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;
  const setDraft = onDraftChange;
  const [menuIndex, setMenuIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  /** Whether new text should pull the view down with it. True until the reader scrolls away from
   *  the bottom, true again as soon as they come back — and forced back on when they send a
   *  question, since their own message arriving off-screen would read as nothing having happened.
   *  A ref, not state: it changes on every scroll event and nothing renders from it. */
  const stickToBottomRef = useRef(true);
  const [caret, setCaret] = useState(0);
  /** The `/` the menu is currently dismissed for. Escape closes the menu without touching the text
   *  — the slash the user typed is theirs to keep — so "closed" cannot be expressed by moving the
   *  caret, which the very next keystroke would undo. Cleared as soon as the query changes, so
   *  typing on carries the menu back. */
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState<string | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const commands = useMemo(() => slashCommandsFor(chart, symbols), [chart, symbols]);
  /** What an `@` can name: the strategies the chart holds, and every symbol it knows about — its
   *  own plus whatever the host passes in, a watchlist typically. Nothing else: a mention that
   *  resolves has to resolve against something real, or the green pill is a lie. */
  const mentionables = useMemo<Mentionable[]>(() => {
    const scripts = chart.scripts.map((script) => ({ kind: "strategy" as const, label: script.name, hint: "Stratégie" }));
    const tickers = [...new Set([chart.symbol, ...symbols].filter((s): s is string => typeof s === "string" && s !== ""))];
    return [...scripts, ...tickers.map((ticker) => ({ kind: "symbol" as const, label: ticker, hint: "Symbole" }))];
  }, [chart.scripts, chart.symbol, symbols]);
  /** Every script whose last run produced a document. Read from the run outputs rather than kept
   *  here, so a report regenerated by a second run replaces the first instead of stacking. */
  const reports = useMemo(
    () =>
      chart.scripts
        .map((script) => ({ script, report: chart.runOutputs[script.id]?.result?.report ?? null }))
        .filter((entry): entry is { script: (typeof chart.scripts)[number]; report: ScriptReport } => entry.report !== null),
    // `chart` itself is a fresh object every render (see useAiChartContext) — depending on it
    // would rebuild this list on every commit, which is exactly what the two fields it actually
    // reads are here to avoid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chart.scripts, chart.runOutputs],
  );
  const [openReport, setOpenReport] = useState<ScriptReport | null>(null);
  const [printTarget, setPrintTarget] = useState<{ report: ScriptReport; target: Window } | null>(null);

  /** Opened inside the click — a `window.open` from anywhere else is blocked as a popup. */
  function printReport(report: ScriptReport) {
    const target = window.open("", "", "width=900,height=1000");
    if (target === null) return;
    setPrintTarget({ report, target });
  }
  const slash = slashQueryAt(draft, caret);
  const matches = slash === null ? [] : filterSlashCommands(commands, slash.query).slice(0, 8);
  const menuOpen = slash !== null && matches.length > 0 && dismissed !== slash.query;

  // `@` mentions. The two menus never share the screen: a `/` only starts a line and an `@` never
  // does, so the caret can only be inside one of them.
  const mention = mentionQueryAt(draft, caret);
  const mentionMatches = mention === null ? [] : filterMentions(mentionables, mention.query).slice(0, 8);
  const mentionOpen = mention !== null && mentionMatches.length > 0 && mentionDismissed !== mention.query;
  // The composer's own painted copy of the draft — see `.lq-ai__highlight` for how it sits behind
  // the box, and `mentionSegments` for what it splits into.
  const segments = useMemo(() => mentionSegments(draft, mentionables), [draft, mentionables]);

  // Follows the conversation as it grows — but only while the reader is already at the bottom.
  //
  // Unconditionally, it made the transcript impossible to read back: an answer arrives in dozens of
  // chunks, each one a `transcript` change, so scrolling up was undone within milliseconds and the
  // panel looked like it had no scrolling at all. Following what is being written is only useful to
  // someone watching it being written; the moment they go looking at what was said earlier, the
  // right thing to do is nothing.
  //
  // `scrollTop` rather than scrollIntoView: the panel is its own scroller, and scrolling an element
  // into view would drag the whole page on a narrow layout.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [transcript]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setMenuIndex(0);
    setDismissed((current) => (current === slash?.query ? current : null));
  }, [slash?.query]);

  useEffect(() => {
    setMentionIndex(0);
    setMentionDismissed((current) => (current === mention?.query ? current : null));
  }, [mention?.query]);

  // The highlight layer is a second copy of the text sitting behind a transparent box; if it does
  // not scroll with the box, the colours slide off the words the moment the draft is taller than
  // three rows.
  useEffect(() => {
    const el = highlightRef.current;
    const input = inputRef.current;
    if (el && input) el.scrollTop = input.scrollTop;
  }, [draft]);

  if (!open) return null;

  function applyCommand(command: SlashCommand) {
    if (slash === null) return;
    const caretMark = command.template.indexOf("…");
    const next = draft.slice(0, slash.from) + command.template + draft.slice(caret);
    setDraft(next);
    const position = slash.from + (caretMark === -1 ? command.template.length : caretMark);
    // After the state has landed, so the box has the new text to place a caret in.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(position, position + (caretMark === -1 ? 0 : 1));
      setCaret(position);
    });
  }

  /** Completes the `@…` being typed into the full name, and leaves the caret after it with a
   *  trailing space — the sentence carries on where it left off. */
  function applyMention(item: Mentionable) {
    if (mention === null) return;
    const inserted = `@${item.label} `;
    const next = draft.slice(0, mention.from) + inserted + draft.slice(caret);
    setDraft(next);
    const position = mention.from + inserted.length;
    // After the state has landed, so the box has the new text to place a caret in.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(position, position);
      setCaret(position);
    });
  }

  function submit() {
    stickToBottomRef.current = true;
    if (busy || draft.trim() === "") return;
    void ask(draft);
    setDraft("");
    setCaret(0);
  }

  return (
    <aside
      className={["lq-ai", chrome === "bare" && "lq-ai--bare"].filter(Boolean).join(" ")}
      aria-label="Assistant"
    >
      <header className="lq-ai__header">
        <span className="lq-ai__title">
          <SparkleIcon size={13} /> Assistant
        </span>
        {/* Nouvelle conversation, à droite du titre : l'actuelle reste dans la liste. */}
        <button
          type="button"
          className="lq-ai__header-button lq-ai__new-conversation"
          onClick={newConversation}
          disabled={transcript.length === 0}
          aria-label="Nouvelle conversation"
          title="Nouvelle conversation"
        >
          <PlusIcon size={13} />
        </button>
        {/* Les conversations enregistrées, nommées par leur première question. */}
        {conversations.length > 0 && (
          <button
            ref={conversationsAnchorRef}
            type="button"
            className={["lq-ai__conversation-trigger", conversationsOpen && "lq-ai__conversation-trigger--open"].filter(Boolean).join(" ")}
            onClick={() => setConversationsOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={conversationsOpen}
            aria-label="Conversation"
            title="Changer de conversation"
          >
            <span className="lq-ai__conversation-trigger-label">{activeConversation?.title ?? "Nouvelle conversation"}</span>
            <ChevronDownIcon size={12} />
          </button>
        )}
        {/* Menu déroulant du kit (comme les modèles enregistrés de l'en-tête du graphique) : une ligne par conversation,
            sa corbeille à droite. Les lignes survolées ou choisies restent en retrait des bords de la liste. */}
        <DropdownPanel
          open={conversationsOpen && conversations.length > 0}
          onClose={() => setConversationsOpen(false)}
          anchorRef={conversationsAnchorRef}
          placement="bottom"
          width={300}
          className="lq-ai__conversations"
          header={
            <div className="lq-dropdown-panel__header-row">
              <span>Conversations</span>
              <span className="lq-dropdown-panel__header-count">{conversations.length}</span>
            </div>
          }
        >
          <div role="listbox" aria-label="Conversations" className="lq-ai__conversation-list">
            {activeConversationId === null && (
              <div className="lq-ai__conversation-row lq-ai__conversation-row--active" role="option" aria-selected>
                <span className="lq-ai__conversation-name">
                  <CheckIcon size={12} />
                  Nouvelle conversation
                </span>
              </div>
            )}
            {conversations.map((c) => {
              const active = c.id === activeConversationId;
              return (
                <div key={c.id} className={["lq-ai__conversation-row", active && "lq-ai__conversation-row--active"].filter(Boolean).join(" ")} role="option" aria-selected={active}>
                  <button
                    type="button"
                    className="lq-ai__conversation-name"
                    onClick={() => {
                      selectConversation(c.id);
                      setConversationsOpen(false);
                    }}
                    title={c.title}
                  >
                    {active && <CheckIcon size={12} />}
                    <span className="lq-ai__conversation-title">{c.title}</span>
                  </button>
                  <button
                    type="button"
                    className="lq-ai__conversation-delete"
                    onClick={() => {
                      setConversationsOpen(false);
                      setConversationToDelete({ id: c.id, title: c.title });
                    }}
                    aria-label={`Supprimer la conversation « ${c.title} »`}
                    title="Supprimer cette conversation"
                  >
                    <TrashIcon size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </DropdownPanel>
        <span className="lq-ai__header-actions">
          {transcript.length > 0 && (
            <button type="button" className="lq-ai__header-button" onClick={reset} title="Effacer cette conversation (retirée de la liste)">
              Effacer
            </button>
          )}
          {chrome === "full" && onRequestWindow && (
            <button
              type="button"
              className="lq-ai__header-button"
              onClick={onRequestWindow}
              aria-label="Ouvrir l'assistant dans une fenêtre déplaçable"
              title="Ouvrir dans une fenêtre déplaçable"
            >
              <MaximizeIcon size={13} />
            </button>
          )}
          {chrome === "full" && onRequestDetach && (
            <button
              type="button"
              className="lq-ai__header-button"
              onClick={onRequestDetach}
              aria-label="Détacher l'assistant dans une nouvelle fenêtre"
              title="Détacher dans une nouvelle fenêtre"
            >
              <DetachWindowIcon size={13} />
            </button>
          )}
          {chrome === "full" && (
          <button type="button" className="lq-ai__header-button" onClick={onClose} aria-label="Fermer l'assistant" title="Fermer">
            <CloseIcon size={12} />
          </button>
          )}
        </span>
      </header>

      <div
        className="lq-ai__scroll"
        ref={scrollRef}
        onScroll={(e) => {
          // A few pixels of tolerance: sub-pixel heights and momentum scrolling rarely land exactly
          // on the bottom, and a reader who is plainly at the end should not stop being followed
          // because of a rounding error.
          const el = e.currentTarget;
          stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
      >
        {send === null && (
          <p className="lq-ai__notice">
            Aucun moteur d'IA n'est configuré. L'application doit fournir la prop <code>ai</code> du graphique — soit une clé d'API, soit sa
            propre fonction d'envoi.
          </p>
        )}
        {transcript.length === 0 && send !== null && (
          <div className="lq-ai__intro">
            <p>Je vois ce que montre le graphique et je peux agir dessus : indicateurs, dessins, scripts, analyses.</p>
            <ul>
              <li>« Affiche le volume, une SMA 20 et une EMA 50 »</li>
              <li>« Dessine les canaux entre le 10/10/2025 et le 05/02/2026 »</li>
              <li>« Sur la stratégie …, comment améliorer le Sharpe sans surajuster ? »</li>
              <li>« Écris une stratégie qui passe LONG quand … »</li>
            </ul>
            <p className="lq-ai__intro-hint">Tapez / pour viser un script, un symbole ou une commande.</p>
          </div>
        )}
        {/* Une question : une bulle violette à droite. Une réponse : sans fond, l'étoile de l'assistant à gauche, et
            chacune de ses actions en étape cochée (l'étape en cours tourne, avec ses secondes). */}
        {groupTurns(transcript).map((turn, t, turns) =>
          turn.kind === "user" ? (
            <div key={turn.entry.id} className="lq-ai__message lq-ai__message--user">
              {turn.entry.text}
            </div>
          ) : (
            <AiTurn key={turn.entries[0]?.id ?? `turn-${t}`} entries={turn.entries} running={busy && t === turns.length - 1 ? assistant.progress : null} />
          ),
        )}
        {/* Any report a script has produced, offered here rather than only in the editor: the
            assistant is where one gets asked for, so it is where the answer should be reachable —
            and opening the print window has to happen inside a real click, which a tool call is
            not. */}
        {reports.map(({ script, report }) => (
          <div key={script.id} className="lq-ai__report">
            <span className="lq-ai__report-title">{report.title}</span>
            <span className="lq-ai__report-meta">
              {report.symbol ? `${report.symbol} · ` : ""}
              {report.blocks.length} sections · {script.name}
            </span>
            <span className="lq-ai__report-actions">
              <button type="button" onClick={() => setOpenReport(report)}>
                Lire
              </button>
              <button type="button" onClick={() => printReport(report)}>
                Exporter en PDF
              </button>
            </span>
          </div>
        ))}
      </div>

      {conversationToDelete !== null && (
        <Modal
          open
          onClose={() => setConversationToDelete(null)}
          title="Supprimer cette conversation ?"
          footer={
            <div className="lq-chart__edit-drawing-footer">
              <button type="button" className="lq-chart__reset-button" onClick={() => setConversationToDelete(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="lq-chart__confirm-button"
                onClick={() => {
                  deleteConversation(conversationToDelete.id);
                  setConversationToDelete(null);
                }}
              >
                Supprimer
              </button>
            </div>
          }
        >
          <p className="lq-ai__confirm-text">
            «&nbsp;{conversationToDelete.title}&nbsp;» sera retirée de vos conversations, questions et réponses comprises. Cette action est irréversible.
          </p>
        </Modal>
      )}
      {openReport !== null && (
        <Modal open onClose={() => setOpenReport(null)} title={openReport.title} size="wide" footer={null}>
          <ReportView report={openReport} />
        </Modal>
      )}
      {printTarget !== null && (
        <ReportPrintWindow
          report={printTarget.report}
          target={printTarget.target}
          onDone={() => setPrintTarget(null)}
          themeSource={typeof document === "undefined" ? null : (document.querySelector(".lq-root") as HTMLElement | null)}
        />
      )}

      <div className="lq-ai__composer">
        {menuOpen && (
          <ul className="lq-ai__menu" role="listbox" aria-label="Commandes">
            {matches.map((command, i) => (
              <li key={command.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === menuIndex}
                  className={["lq-ai__menu-item", i === menuIndex && "lq-ai__menu-item--active"].filter(Boolean).join(" ")}
                  // Mousedown, not click: a click would first blur the textarea, and the caret this
                  // insertion is anchored to would be gone by the time the handler ran.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyCommand(command);
                  }}
                >
                  <span className="lq-ai__menu-label">{command.label}</span>
                  <span className="lq-ai__menu-hint">{command.hint}</span>
                  <span className="lq-ai__menu-group">{command.group}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {mentionOpen && (
          <ul className="lq-ai__menu lq-ai__menu--mentions" role="listbox" aria-label="Mentions">
            {mentionMatches.map((item, i) => (
              <li key={`${item.kind}-${item.label}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === mentionIndex}
                  className={["lq-ai__menu-item", i === mentionIndex && "lq-ai__menu-item--active"].filter(Boolean).join(" ")}
                  // Mousedown, not click: a click blurs the textarea first, and the caret this
                  // insertion is anchored to would be gone by the time the handler ran.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyMention(item);
                  }}
                >
                  <span className="lq-ai__menu-label">@{item.label}</span>
                  <span className="lq-ai__menu-group">{item.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {/* The composer is two layers: this painted copy of the text, and the real box on top of
            it with transparent text. A textarea cannot colour part of its own content, and the
            alternative — a contenteditable — would mean re-implementing the caret, selection, undo
            and IME behaviour that comes free here. Both layers must share every metric that
            affects wrapping, which is what `.lq-ai__highlight` and `.lq-ai__input` do in CSS. */}
        <div className="lq-ai__composer-stack">
          <div className="lq-ai__highlight" ref={highlightRef} aria-hidden="true">
            {segments.map((segment, i) =>
              segment.resolved === null ? (
                <span key={i}>{segment.text}</span>
              ) : (
                <mark key={i} className={`lq-ai__mention lq-ai__mention--${segment.resolved ? "known" : "unknown"}`}>
                  {segment.text}
                </mark>
              ),
            )}
            {/* A trailing newline is not rendered by a div the way it is by a textarea, so without
                this the last line scrolls out of step with the box above it. */}
            {"\u000A"}
          </div>
          <textarea
          ref={inputRef}
          className="lq-ai__input"
          value={draft}
          rows={3}
          placeholder={PLACEHOLDER}
          disabled={send === null}
          onChange={(e) => {
            setDraft(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
          }}
          onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onKeyDown={(e) => {
            if (mentionOpen) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIndex((i) => (i + 1) % mentionMatches.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                applyMention(mentionMatches[mentionIndex]);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setMentionDismissed(mention?.query ?? null);
                return;
              }
            }
            if (menuOpen) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMenuIndex((i) => (i + 1) % matches.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMenuIndex((i) => (i - 1 + matches.length) % matches.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                applyCommand(matches[menuIndex]);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setDismissed(slash?.query ?? null);
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          onScroll={(e) => {
            const el = highlightRef.current;
            if (el) el.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
          }}
          />
          {/* Dans la zone de saisie, en bas à droite : la dictée et la flèche d'envoi (un carré pour arrêter). */}
          <span className="lq-ai__composer-inline">
            <DictationButton field={inputRef} disabled={send === null || busy} />
            {busy ? (
              <button type="button" className="lq-ai__send lq-ai__send--stop" onClick={stop} aria-label="Arrêter" title="Arrêter">
                <span className="lq-ai__send-stop" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                className="lq-ai__send"
                onClick={submit}
                disabled={send === null || draft.trim() === ""}
                aria-label="Envoyer"
                title="Envoyer (Entrée) · Maj+Entrée : retour à la ligne"
              >
                <ArrowUpIcon size={14} />
              </button>
            )}
          </span>
        </div>
      </div>
    </aside>
  );
}

/** « L'assistant travaille… 12 s · Réflexion (tour 2) » : le temps écoulé, mis à jour chaque seconde, et l'étape. */
function AiBusy({ progress }: { progress: import("../useAiAssistant").AiProgress | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = progress ? Math.max(0, Math.floor((now - progress.startedAt) / 1000)) : 0;
  return (
    <li className="lq-ai__step lq-ai__step--running" role="status" aria-live="polite">
      <span className="lq-ai__step-spinner" aria-hidden="true" />
      <span>
        {progress?.step ?? "L'assistant travaille"}
        <span className="lq-ai__busy-time"> · {seconds} s</span>
      </span>
    </li>
  );
}

type AiTurnGroup = { kind: "user"; entry: AiTranscriptEntry } | { kind: "assistant"; entries: AiTranscriptEntry[] };

/** Le fil en tours de parole : chaque question seule, puis tout ce que l'assistant a fait et dit jusqu'à la suivante. */
function groupTurns(transcript: AiTranscriptEntry[]): AiTurnGroup[] {
  const turns: AiTurnGroup[] = [];
  for (const entry of transcript) {
    if (entry.role === "user") {
      turns.push({ kind: "user", entry });
      continue;
    }
    const last = turns[turns.length - 1];
    if (last && last.kind === "assistant") last.entries.push(entry);
    else turns.push({ kind: "assistant", entries: [entry] });
  }
  return turns;
}

/** Une réponse de l'assistant : son étoile, ses textes, et ses actions en étapes cochées (l'étape en cours tourne). */
function AiTurn({ entries, running }: { entries: AiTranscriptEntry[]; running: import("../useAiAssistant").AiProgress | null }) {
  // Les étapes qui se suivent forment une liste ; un texte entre deux coupe la liste.
  const blocks: ({ kind: "text"; entry: AiTranscriptEntry } | { kind: "steps"; entries: AiTranscriptEntry[] })[] = [];
  for (const entry of entries) {
    if (entry.role === "tool") {
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "steps") last.entries.push(entry);
      else blocks.push({ kind: "steps", entries: [entry] });
    } else blocks.push({ kind: "text", entry });
  }
  // L'étape en cours s'ajoute à la dernière liste (ou en ouvre une).
  if (running && (blocks.length === 0 || blocks[blocks.length - 1].kind === "text")) blocks.push({ kind: "steps", entries: [] });
  return (
    <div className="lq-ai__turn">
      <span className="lq-ai__avatar" aria-hidden="true">
        <SparkleIcon size={13} />
      </span>
      <div className="lq-ai__turn-body">
        {blocks.map((block, b) =>
          block.kind === "text" ? (
            <div key={block.entry.id} className={["lq-ai__message", "lq-ai__message--assistant", "lq-ai__message--md", block.entry.isError && "lq-ai__message--error"].filter(Boolean).join(" ")}>
              {/* Markdown de la réponse (titres, gras, liens, listes, tableaux) rendu aux couleurs du thème. */}
              {block.entry.isError ? block.entry.text : <AiMarkdown text={block.entry.text} />}
              {block.entry.truncated && (
                <p className="lq-ai__truncated" role="note">
                  Réponse coupée : la limite de longueur du modèle a été atteinte. Demandez « continue » pour la suite.
                </p>
              )}
            </div>
          ) : (
            <ul key={`steps-${b}`} className="lq-ai__steps">
              {block.entries.map((step) => (
                <li key={step.id} className={["lq-ai__step", step.isError && "lq-ai__step--error"].filter(Boolean).join(" ")}>
                  <details>
                    <summary>
                      <span className="lq-ai__step-mark" aria-hidden="true">
                        {step.isError ? "×" : <StepCheck />}
                      </span>
                      <span>{step.isError ? `${toolStep(step.toolName ?? "")} : échec` : toolStep(step.toolName ?? "")}</span>
                    </summary>
                    <pre>{step.text}</pre>
                  </details>
                </li>
              ))}
              {running && b === blocks.length - 1 && <AiBusy progress={running} />}
            </ul>
          ),
        )}
      </div>
    </div>
  );
}

function StepCheck() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 6.2 5 8.6 9.5 3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
