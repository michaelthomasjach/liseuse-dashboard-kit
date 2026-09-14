import { useEffect, useMemo, useRef, useState } from "react";
import { SparkleIcon } from "../components/icons";
import "./AiShowcase.css";

/** One turn of the demonstration: what is asked, what the assistant does about it, and what comes
 *  back. The tool lines are the part worth showing — an assistant that only talks is a chat box,
 *  and this one reaches the chart through the very functions the buttons call. */
interface AiTurn {
  question: string;
  /** What appears, one line at a time, while the answer is being prepared. */
  tools: string[];
  answer: string;
}

const TURNS: AiTurn[] = [
  {
    question: "Que raconte ce graphique depuis six mois ?",
    tools: ["lit 220 bougies", "lit les indicateurs affichés"],
    answer:
      "Une hausse en trois temps, chacune suivie d'un repli plus court que la précédente. Le dernier creux tient au-dessus de la SMA 50, que le prix n'a pas refermée depuis mars. Le volume accompagne les hausses et s'éteint dans les replis — c'est la signature d'une tendance encore portée, pas d'une distribution.",
  },
  {
    question: "Ajoute un RSI et dis-moi s'il confirme.",
    tools: ["ajoute RSI(14)", "lit RSI(14)"],
    answer:
      "Ajouté sous le prix. Il est à 61 : dans le haut de sa plage, sans excès. Surtout, ses creux montent depuis mars alors que le prix faisait des creux plats — la divergence joue dans le sens de la hausse. Un passage sous 45 serait le premier vrai désaccord.",
  },
  {
    question: "Trace le support qui a tenu trois fois.",
    tools: ["détecte les niveaux", "trace une horizontale à 104,90"],
    answer:
      "Tracée. 104,90 a été touché en mars, en juin et la semaine dernière, avec une mèche à chaque fois plutôt qu'une clôture en dessous : le niveau est défendu en séance. C'est aussi là que passe la SMA 50, ce qui explique une partie de sa solidité.",
  },
];

/** Milliseconds per character while a question is being typed, and while an answer streams back.
 *  The answer is faster because it is far longer — a model does not type, and reading it at
 *  question speed would take a quarter of a minute per turn. */
const QUESTION_SPEED = 34;
const ANSWER_SPEED = 9;
const TOOL_DELAY = 420;
const PAUSE_BEFORE_ANSWER = 350;
const PAUSE_AFTER_TURN = 2600;

type Phase = "typing" | "tools" | "answering" | "resting";

/** The assistant, answering questions about the chart, typed out live.
 *
 *  Scripted rather than connected, and that is the honest way to put an assistant on a landing
 *  page: a real transport needs a key, and a key on a public page is a key anyone can read out of
 *  it. What is shown is what the real panel does — the questions are the kind it answers, and the
 *  tool lines are the calls it actually makes (`lit les bougies`, `ajoute un indicateur`, `trace`),
 *  because every action it takes goes through the same functions the chart's own buttons call.
 *
 *  Stops moving entirely under `prefers-reduced-motion`: the whole conversation is shown at once,
 *  which is the same information without the animation. */
export function AiShowcase() {
  const reduced = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );
  const [turnIndex, setTurnIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const [typed, setTyped] = useState("");
  const [toolCount, setToolCount] = useState(0);
  const [answered, setAnswered] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const turn = TURNS[turnIndex];

  // One effect per phase transition rather than one timer doing everything: each phase has its own
  // tempo, and a single interval juggling three of them is where an animation like this starts
  // dropping characters.
  useEffect(() => {
    if (reduced) return;
    if (phase !== "typing") return;
    if (typed.length >= turn.question.length) {
      const id = window.setTimeout(() => setPhase("tools"), PAUSE_BEFORE_ANSWER);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setTyped(turn.question.slice(0, typed.length + 1)), QUESTION_SPEED);
    return () => window.clearTimeout(id);
  }, [reduced, phase, typed, turn.question]);

  useEffect(() => {
    if (reduced) return;
    if (phase !== "tools") return;
    if (toolCount >= turn.tools.length) {
      const id = window.setTimeout(() => setPhase("answering"), PAUSE_BEFORE_ANSWER);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setToolCount((count) => count + 1), TOOL_DELAY);
    return () => window.clearTimeout(id);
  }, [reduced, phase, toolCount, turn.tools.length]);

  useEffect(() => {
    if (reduced) return;
    if (phase !== "answering") return;
    if (answered.length >= turn.answer.length) {
      const id = window.setTimeout(() => setPhase("resting"), PAUSE_AFTER_TURN);
      return () => window.clearTimeout(id);
    }
    // Several characters per tick rather than one every few milliseconds: a timer that fires every
    // 3 ms is a timer the browser will miss, and the result reads as stuttering rather than fast.
    const id = window.setTimeout(() => setAnswered(turn.answer.slice(0, answered.length + 3)), ANSWER_SPEED);
    return () => window.clearTimeout(id);
  }, [reduced, phase, answered, turn.answer]);

  useEffect(() => {
    if (reduced) return;
    if (phase !== "resting") return;
    const id = window.setTimeout(() => {
      setTurnIndex((index) => (index + 1) % TURNS.length);
      setTyped("");
      setToolCount(0);
      setAnswered("");
      setPhase("typing");
    }, 600);
    return () => window.clearTimeout(id);
  }, [reduced, phase]);

  // Keeps the newest line in view as the answer grows past the box.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [answered, toolCount, typed]);

  const showQuestion = reduced ? turn.question : typed;
  const shownTools = reduced ? turn.tools : turn.tools.slice(0, toolCount);
  const showAnswer = reduced ? turn.answer : answered;

  return (
    <div className="lqx-ai">
      <div className="lqx-ai__panel" role="img" aria-label="Démonstration de l'assistant répondant à une question sur le graphique">
        <header className="lqx-ai__head">
          <SparkleIcon size={13} animated={!reduced} />
          <span className="lqx-ai__title">Assistant</span>
          <span className="lqx-ai__chart">MSFT · 1 jour</span>
        </header>

        <div className="lqx-ai__scroll" ref={scrollRef}>
          <p className="lqx-ai__question">
            {showQuestion}
            {!reduced && phase === "typing" && <span className="lqx-ai__caret" aria-hidden="true" />}
          </p>

          {shownTools.map((tool) => (
            <p key={tool} className="lqx-ai__tool">
              <span className="lqx-ai__tool-dot" aria-hidden="true" />
              {tool}
            </p>
          ))}

          {(showAnswer.length > 0 || reduced) && (
            <p className="lqx-ai__answer">
              {showAnswer}
              {!reduced && phase === "answering" && <span className="lqx-ai__caret" aria-hidden="true" />}
            </p>
          )}
        </div>

        <div className="lqx-ai__composer">
          <span className="lqx-ai__composer-text">
            {phase === "typing" && !reduced ? showQuestion : "Posez une question, ou tapez / pour une commande"}
          </span>
        </div>
      </div>

      <ol className="lqx-ai__dots" aria-hidden="true">
        {TURNS.map((entry, index) => (
          <li
            key={entry.question}
            className={["lqx-ai__dot", index === turnIndex && "lqx-ai__dot--current"].filter(Boolean).join(" ")}
          />
        ))}
      </ol>
    </div>
  );
}
