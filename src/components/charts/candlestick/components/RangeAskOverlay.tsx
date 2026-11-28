import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { ScaleLinear } from "d3";
import { ArrowRightIcon, CloseIcon, SparkleIcon } from "../../../icons";
import type { Candle } from "../interfaces/Candle.interface";
import type { ChartRangeAsk, ChartRangeAskKind } from "../interfaces/ChartRangeAsk.interface";
import { RANGE_ASK_OPTIONS, orderedRange } from "../rangeAsk";
import "./RangeAskOverlay.css";

export interface RangeAskOverlayProps {
  range: ChartRangeAsk;
  onRangeChange: (range: ChartRangeAsk) => void;
  onClose: () => void;
  onAsk: (kind: ChartRangeAskKind, question?: string) => void;
  data: Candle[];
  indexForDate: (d: Date) => number;
  zoomedXScale: ScaleLinear<number, number>;
  /** Cadre de la zone de tracé dans le conteneur du graphique (marge gauche, haut, largeur, hauteur des panneaux). */
  left: number;
  top: number;
  width: number;
  height: number;
  formatDate: (d: Date) => string;
  /** Index de la dernière bougie close (voir `lastClosedCandleIndex`) : les bords ne vont pas au-delà. Défaut : la
   *  dernière bougie. */
  maxIndex?: number;
}

const MENU_WIDTH = 300;
const MENU_HEIGHT = 230;
const GAP = 12;

/** La zone choisie avec l'outil « Interroger l'IA sur une zone » : un bandeau entre deux lignes verticales, une
 *  poignée au milieu de chaque ligne pour en déplacer le bord (au doigt comme à la souris), la date de chaque bord sur
 *  l'axe du temps, et l'infobulle des questions à l'IA posée à côté de la zone (à gauche s'il y a la place, sinon à
 *  droite, sinon dedans).
 *
 *  En HTML au-dessus du canevas plutôt que dessiné dedans : les poignées et l'infobulle sont des contrôles (focus,
 *  clavier, saisie), et la zone suit le défilement et le zoom en se recalculant à chaque rendu. Le cadre laisse passer
 *  le pointeur partout ailleurs : le graphique reste utilisable autour. Échap ou la croix retirent la zone. */
export function RangeAskOverlay({
  range,
  onRangeChange,
  onClose,
  onAsk,
  data,
  indexForDate,
  zoomedXScale,
  left,
  top,
  width,
  height,
  formatDate,
  maxIndex,
}: RangeAskOverlayProps) {
  // Bords bornés aux bougies closes : ni futur à droite de la dernière bougie, ni bougie en formation.
  const lastIndex = Math.max(0, Math.min(data.length - 1, maxIndex ?? data.length - 1));
  const rootRef = useRef<HTMLDivElement>(null);
  const [question, setQuestion] = useState("");
  const dragRef = useRef<{ edge: "from" | "to"; pointerId: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (data.length === 0) return null;
  const x0 = zoomedXScale(indexForDate(range.from) + 0.5);
  const x1 = zoomedXScale(indexForDate(range.to) + 0.5);
  const bandLeft = Math.max(0, Math.min(width, x0));
  const bandRight = Math.max(0, Math.min(width, x1));
  const count = Math.max(1, indexForDate(range.to) - indexForDate(range.from) + 1);

  const menuWidth = Math.min(MENU_WIDTH, width - 16);
  let menuLeft = x0 - menuWidth - GAP;
  if (menuLeft < 8) menuLeft = x1 + GAP;
  if (menuLeft + menuWidth > width - 8) menuLeft = Math.max(8, Math.min(width - menuWidth - 8, (bandLeft + bandRight) / 2 - menuWidth / 2));
  const menuTop = Math.max(8, Math.min(height - MENU_HEIGHT - 8, height * 0.3));

  function dateAt(clientX: number): Date {
    const rect = rootRef.current!.getBoundingClientRect();
    const raw = Math.round(zoomedXScale.invert(clientX - rect.left) - 0.5);
    const i = Math.max(0, Math.min(lastIndex, raw));
    return data[i].date;
  }

  function startDrag(edge: "from" | "to") {
    return (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { edge, pointerId: e.pointerId };
    };
  }
  function moveDrag(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const d = dateAt(e.clientX);
    const next = orderedRange(drag.edge === "from" ? d : range.from, drag.edge === "to" ? d : range.to);
    // Un bord passé de l'autre côté devient l'autre bord : la poignée tenue reste celle sous le doigt.
    if (drag.edge === "from" && d.getTime() > range.to.getTime()) drag.edge = "to";
    else if (drag.edge === "to" && d.getTime() < range.from.getTime()) drag.edge = "from";
    if (next.from.getTime() !== range.from.getTime() || next.to.getTime() !== range.to.getTime()) onRangeChange(next);
  }
  function endDrag(e: ReactPointerEvent<HTMLButtonElement>) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null;
  }
  function nudge(edge: "from" | "to", step: number) {
    const i = Math.max(0, Math.min(lastIndex, indexForDate(range[edge]) + step));
    onRangeChange(orderedRange(edge === "from" ? data[i].date : range.from, edge === "to" ? data[i].date : range.to));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    onAsk("custom", q);
    setQuestion("");
  }

  const edge = (which: "from" | "to", x: number) =>
    x >= 0 && x <= width ? (
      <div className="lq-chart__range-ask-line" style={{ left: x }}>
        <button
          type="button"
          className="lq-chart__range-ask-handle"
          style={{ top: height / 2 }}
          aria-label={which === "from" ? "Déplacer le début de la zone" : "Déplacer la fin de la zone"}
          title="Glisser pour déplacer ce bord (flèches gauche / droite au clavier)"
          onPointerDown={startDrag(which)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              nudge(which, e.key === "ArrowLeft" ? -1 : 1);
            }
          }}
        />
        <span className="lq-chart__range-ask-date" style={{ top: height }}>
          {formatDate(range[which])}
        </span>
      </div>
    ) : null;

  return (
    <div ref={rootRef} className="lq-chart__range-ask" style={{ left, top, width, height }}>
      {bandRight > bandLeft && <div className="lq-chart__range-ask-band" style={{ left: bandLeft, width: bandRight - bandLeft }} />}
      {edge("from", x0)}
      {edge("to", x1)}
      <div
        className="lq-chart__range-ask-menu"
        role="dialog"
        aria-label="Interroger l'IA sur cette zone"
        style={{ left: menuLeft, top: menuTop, width: menuWidth }}
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="lq-chart__range-ask-head">
          <span className="lq-chart__range-ask-title">
            {count} bougie{count > 1 ? "s" : ""}
          </span>
          <button type="button" className="lq-chart__range-ask-close" onClick={onClose} aria-label="Retirer la zone" title="Retirer la zone (Échap)">
            <CloseIcon size={12} />
          </button>
        </div>
        {RANGE_ASK_OPTIONS.map((o) => (
          <button key={o.kind} type="button" className="lq-chart__range-ask-option" onClick={() => onAsk(o.kind)}>
            <SparkleIcon size={13} />
            {o.label}
          </button>
        ))}
        <form className="lq-chart__range-ask-form" onSubmit={submit}>
          <input
            className="lq-chart__range-ask-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Poser une question sur cette zone…"
            aria-label="Poser une question sur cette zone"
          />
          <button type="submit" className="lq-chart__range-ask-send" disabled={question.trim() === ""} aria-label="Envoyer la question">
            <ArrowRightIcon size={13} />
          </button>
        </form>
      </div>
    </div>
  );
}
