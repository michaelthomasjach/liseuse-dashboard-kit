import { IndicatorDiagram } from "./DiagramPrimitives";

/** The four pitchforks, drawn from their real construction.
 *
 *  They used to be four copies of the same three near-horizontal lines, separated only by their
 *  captions — which meant the one question a reader opens these with, *how is this one different*,
 *  had no answer in the picture. Here each variant states only where its median starts, and
 *  everything else follows: the prongs are parallel to the median through B and through C, so the
 *  Schiff really is flatter than the Andrews and the Inside really is narrower than both.
 *
 *  They also use the wider indicator canvas rather than the 220×110 one the other drawing tools
 *  share. Three parallel lines fanning across a chart need the room; at half this size the upper
 *  prong left the frame before it was recognisable as a prong. */

const VIEW = { x0: 14, x1: 426, y0: 16, y1: 174 };

/** A, B and C — three successive pivots: a low, the high after it, the low after that. Chosen so
 *  that all three parallel lines of every variant stay inside the frame. */
const A = { x: 40, y: 130 };
const B = { x: 120, y: 80 };
const C = { x: 190, y: 120 };
/** The point every median aims at: the middle of B–C. */
const M = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };

/** The segment of the infinite line through (px, py) with direction (dx, dy) that lies inside the
 *  frame — so a line simply stops at the edge instead of being drawn outside it. */
function clip(px: number, py: number, dx: number, dy: number): { x1: number; y1: number; x2: number; y2: number } | null {
  let tMin = -Infinity;
  let tMax = Infinity;
  const spans: [number, number, number][] = [
    [dx, VIEW.x0 - px, VIEW.x1 - px],
    [dy, VIEW.y0 - py, VIEW.y1 - py],
  ];
  for (const [d, lo, hi] of spans) {
    if (d === 0) {
      if (lo > 0 || hi < 0) return null;
      continue;
    }
    const t1 = lo / d;
    const t2 = hi / d;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
  }
  if (tMin > tMax) return null;
  return { x1: px + dx * tMin, y1: py + dy * tMin, x2: px + dx * tMax, y2: py + dy * tMax };
}

function Line({ through, dx, dy, median }: { through: { x: number; y: number }; dx: number; dy: number; median?: boolean }) {
  const seg = clip(through.x, through.y, dx, dy);
  if (seg === null) return null;
  return (
    <line
      {...seg}
      stroke={median ? "var(--lq-color-text-muted)" : "var(--lq-color-accent)"}
      strokeWidth={median ? 1.6 : 2.2}
      strokeDasharray={median ? "5 4" : undefined}
      strokeLinecap="round"
    />
  );
}

function Pivot({ at, label, below }: { at: { x: number; y: number }; label: string; below?: boolean }) {
  return (
    <g>
      <circle cx={at.x} cy={at.y} r={4} fill="var(--lq-color-accent)" />
      <text x={at.x} y={at.y + (below ? 18 : -10)} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--lq-color-text)">
        {label}
      </text>
    </g>
  );
}

/** The shared frame: the A–B–C construction, the three parallel lines, and a note saying what this
 *  variant moved. `origin` is the only thing that differs between the first three. */
function Fork({
  label,
  origin,
  prongs,
  medianThrough,
  note,
}: {
  label: string;
  origin: { x: number; y: number };
  prongs: { x: number; y: number }[];
  medianThrough: { x: number; y: number };
  note: string;
}) {
  const dx = M.x - origin.x;
  const dy = M.y - origin.y;
  return (
    <IndicatorDiagram label={label}>
      <polyline
        points={`${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}`}
        fill="none"
        stroke="var(--lq-color-text-muted)"
        strokeWidth={1.2}
        opacity={0.55}
      />
      <Line through={medianThrough} dx={dx} dy={dy} median />
      {prongs.map((p, i) => (
        <Line key={i} through={p} dx={dx} dy={dy} />
      ))}
      <Pivot at={A} label="A" below />
      <Pivot at={B} label="B" />
      <Pivot at={C} label="C" below />
      {(origin.x !== A.x || origin.y !== A.y) && (
        <g>
          <circle cx={origin.x} cy={origin.y} r={4} fill="none" stroke="var(--lq-color-text)" strokeWidth={1.6} />
          <text x={origin.x + 8} y={origin.y - 6} fontSize={9.5} fontWeight={700} fill="var(--lq-color-text)">
            origine
          </text>
        </g>
      )}
      <circle cx={M.x} cy={M.y} r={3} fill="var(--lq-color-text-muted)" />
      <text x={M.x + 6} y={M.y + 13} fontSize={9} fontWeight={600} fill="var(--lq-color-text-muted)">
        milieu B-C
      </text>
      <text x={14} y={186} fontSize={9.5} fontWeight={600} fill="var(--lq-color-text-muted)">
        {note}
      </text>
    </IndicatorDiagram>
  );
}

export function PitchforkDiagram() {
  return (
    <Fork
      label="Fourche d'Andrews : la médiane part de A et passe par le milieu de B-C, les deux dents lui étant parallèles"
      origin={A}
      medianThrough={A}
      prongs={[B, C]}
      note="La médiane part de A. C'est la construction d'origine."
    />
  );
}

export function SchiffPitchforkDiagram() {
  // Same date as A, half the price of A–B: the shift is vertical only.
  const origin = { x: A.x, y: (A.y + B.y) / 2 };
  return (
    <Fork
      label="Fourche de Schiff : la médiane part de la mi-hauteur entre A et B, à la date de A, ce qui aplatit la fourche"
      origin={origin}
      medianThrough={origin}
      prongs={[B, C]}
      note="Origine relevée à mi-hauteur de A-B, à la date de A : la fourche s'aplatit."
    />
  );
}

export function ModifiedSchiffPitchforkDiagram() {
  // Half the price *and* half the date.
  const origin = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  return (
    <Fork
      label="Fourche de Schiff modifiée : la médiane part du milieu exact du segment A-B, décalé en prix comme en date"
      origin={origin}
      medianThrough={origin}
      prongs={[B, C]}
      note="Origine au milieu exact de A-B — décalée en prix et en date."
    />
  );
}

export function InsidePitchforkDiagram() {
  // The one variant whose *prongs* move: through the middle of A–B and through B, which is what
  // makes its corridor narrower than the others' rather than merely tilted.
  const inner = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  return (
    <Fork
      label="Inside Pitchfork : les dents passent par le milieu de A-B et par B, ce qui donne un couloir plus étroit que la fourche classique"
      origin={inner}
      medianThrough={M}
      prongs={[inner, B]}
      note="Les dents passent par le milieu de A-B et par B : couloir plus étroit."
    />
  );
}
