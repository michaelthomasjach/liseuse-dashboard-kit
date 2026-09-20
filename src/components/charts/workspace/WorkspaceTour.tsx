import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { CloseIcon } from "../../icons";
import "./WorkspaceTour.css";

export interface WorkspaceTourStep {
  /** A CSS selector for the thing this step is about. The first match in the document wins.
   *
   *  A selector rather than a ref, because the things worth pointing at are spread across four
   *  components that know nothing about each other — the rail, the header, the tools column, a
   *  docked panel — and threading a ref out of each one would make every one of them aware of a
   *  tour it has no other reason to know exists. The cost is honest: a step whose target is not on
   *  screen is skipped rather than pointing at nothing. */
  selector: string;
  title: string;
  body: string;
}

export interface WorkspaceTourProps {
  open: boolean;
  steps: WorkspaceTourStep[];
  onClose: () => void;
}

/** Where the card sits relative to the thing it describes, and where the spotlight goes. */
interface Placement {
  top: number;
  left: number;
  /** The target's own box, for the ring drawn around it. */
  ring: { top: number; left: number; width: number; height: number };
  side: "right" | "left" | "below" | "above";
}

/** How long the tour waits for the workspace to finish mounting before concluding it has nothing
 *  to point at, and how often it looks. */
const TARGET_WAIT_MS = 5000;
const TARGET_POLL_MS = 200;

const CARD_WIDTH = 300;
const GAP = 14;
const EDGE = 12;

/** Puts the card beside its target, on whichever side has room.
 *
 *  Right first, then left, then below, then above — a left-to-right reading order prefers the
 *  side the eye lands on next, and the vertical fallbacks exist for a target pinned against both
 *  edges, which is what a full-width header is. Whatever is chosen, the card is then pulled back
 *  inside the viewport, so a step near a corner never puts half its text off screen. */
function place(target: DOMRect, cardHeight: number): Placement {
  const ring = { top: target.top, left: target.left, width: target.width, height: target.height };
  const fitsRight = target.right + GAP + CARD_WIDTH + EDGE <= window.innerWidth;
  const fitsLeft = target.left - GAP - CARD_WIDTH - EDGE >= 0;
  const side: Placement["side"] = fitsRight ? "right" : fitsLeft ? "left" : target.bottom + GAP + cardHeight + EDGE <= window.innerHeight ? "below" : "above";

  let left: number;
  let top: number;
  if (side === "right") {
    left = target.right + GAP;
    top = target.top + target.height / 2 - cardHeight / 2;
  } else if (side === "left") {
    left = target.left - GAP - CARD_WIDTH;
    top = target.top + target.height / 2 - cardHeight / 2;
  } else if (side === "below") {
    left = target.left + target.width / 2 - CARD_WIDTH / 2;
    top = target.bottom + GAP;
  } else {
    left = target.left + target.width / 2 - CARD_WIDTH / 2;
    top = target.top - GAP - cardHeight;
  }
  return {
    left: Math.min(Math.max(EDGE, left), Math.max(EDGE, window.innerWidth - CARD_WIDTH - EDGE)),
    top: Math.min(Math.max(EDGE, top), Math.max(EDGE, window.innerHeight - cardHeight - EDGE)),
    ring,
    side,
  };
}

/** A card that walks around the workspace explaining what each part of it is for.
 *
 *  Deliberately not a modal. A modal would darken everything and explain the workspace by hiding
 *  it, which is the opposite of what a tour is for: the card moves to sit *beside* each thing it
 *  names, with a ring around it, and the workspace stays visible and readable the whole way
 *  through. Nothing behind it is blocked either — a reader who wants to stop reading and use the
 *  chart should be able to, and closing is one click.
 *
 *  A step whose target is not in the document is skipped rather than shown against nothing: a
 *  workspace with no watchlist has no watchlist to point at, and pointing at the middle of the
 *  screen and claiming otherwise would be worse than saying nothing. */
export function WorkspaceTour({ open, steps, onClose }: WorkspaceTourProps) {
  const [index, setIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [card, setCard] = useState<HTMLDivElement | null>(null);

  // Only the steps that have something to point at.
  //
  // Resolved by polling rather than once on open, and that is not laziness: the workspace mounts a
  // chart, a rail and whatever panels it was given over several frames, so a single pass at open
  // time runs before any of the targets exist and leaves the tour with nothing to show — which is
  // exactly what it did. It settles as soon as anything matches, and gives up after
  // TARGET_WAIT_MS so a workspace that genuinely has none of them does not poll forever.
  const [live, setLive] = useState<WorkspaceTourStep[]>([]);
  useEffect(() => {
    if (!open) {
      setLive([]);
      return;
    }
    setIndex(0);
    const resolve = () => steps.filter((step) => document.querySelector(step.selector) !== null);
    // Settled means "stopped growing", not "found something". The rail exists on the first frame
    // while the chart and its tool column arrive later, so taking the first non-empty answer gave a
    // two-step tour of a four-step workspace — it pointed at the side rail and the help button and
    // never mentioned the chart.
    const startedAt = Date.now();
    let previousCount = -1;
    const settle = () => {
      const next = resolve();
      const stable = next.length > 0 && next.length === previousCount;
      previousCount = next.length;
      if (stable || Date.now() - startedAt > TARGET_WAIT_MS) {
        setLive(next);
        return true;
      }
      return false;
    };
    const timer = window.setInterval(() => {
      if (settle()) window.clearInterval(timer);
    }, TARGET_POLL_MS);
    return () => window.clearInterval(timer);
  }, [open, steps]);

  const step = live[index] ?? null;

  const reposition = useCallback(() => {
    if (step === null || card === null) return;
    const target = document.querySelector(step.selector);
    if (target === null) return;
    setPlacement(place(target.getBoundingClientRect(), card.offsetHeight));
  }, [step, card]);

  // Before paint, so the card never appears at its previous step's position first.
  useLayoutEffect(reposition, [reposition]);
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition]);

  // Escape closes, like every other dismissible surface here.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || step === null) return null;
  const last = index === live.length - 1;

  return (
    <>
      {/* The ring, not a spotlight cut out of a dark overlay: darkening the workspace to explain
          the workspace makes every step harder to read than the thing it describes. */}
      {placement !== null && (
        <div
          className="lq-tour__ring"
          style={{ top: placement.ring.top, left: placement.ring.left, width: placement.ring.width, height: placement.ring.height }}
          aria-hidden="true"
        />
      )}
      <div
        ref={setCard}
        className="lq-tour__card"
        style={placement === null ? { visibility: "hidden" } : { top: placement.top, left: placement.left }}
        role="dialog"
        aria-label="Visite guidée"
      >
        <div className="lq-tour__head">
          <span className="lq-tour__count">
            {index + 1} / {live.length}
          </span>
          <button type="button" className="lq-tour__close" onClick={onClose} aria-label="Fermer la visite guidée">
            <CloseIcon size={12} />
          </button>
        </div>
        <h3 className="lq-tour__title">{step.title}</h3>
        <p className="lq-tour__body">{step.body}</p>
        <div className="lq-tour__actions">
          <button type="button" className="lq-tour__skip" onClick={onClose}>
            {last ? "Fermer" : "Passer"}
          </button>
          <button type="button" className="lq-tour__next" onClick={() => (last ? onClose() : setIndex((i) => i + 1))}>
            {last ? "Terminer" : "Suivant"}
          </button>
        </div>
      </div>
    </>
  );
}
