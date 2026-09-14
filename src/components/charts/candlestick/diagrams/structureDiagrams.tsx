import {
  IndicatorDiagram,
  DiagramCandles,
  DiagramOhlcCandles,
  DiagramCallout,
  DiagramPanel,
  type DiagramOhlc,
} from "./DiagramPrimitives";
import { FULL_BAND, UPPER_BAND, LOWER_BAND, bandY, seriesX, CANDLE_WIDTH } from "./diagramMath";

/** The six structure indicators — the ones that mark up the price rather than plot beside it. */

/** A gap is two candles whose ranges do not overlap at **any** price, which is why these candles
 *  are written out rather than generated: the shared generator opens each candle on the previous
 *  close, so it can never produce one.
 *
 *  Two gaps, because the indicator's whole output is the distinction between them. The first is
 *  re-entered at candle 8 and its rectangle stops there; the second never is, and runs to the edge. */
const GAP_CANDLES: DiagramOhlc[] = [
  { o: 40, h: 44, l: 37, c: 42 },
  { o: 42, h: 46, l: 39, c: 44 },
  { o: 44, h: 47, l: 41, c: 45 },
  { o: 45, h: 48, l: 43, c: 46 },
  { o: 60, h: 64, l: 58, c: 62 }, // low 58 > high 48 → gap
  { o: 62, h: 65, l: 59, c: 61 },
  { o: 61, h: 64, l: 57, c: 59 },
  { o: 59, h: 62, l: 55, c: 57 },
  { o: 57, h: 60, l: 46, c: 50 }, // low 46 re-enters 48–58 → comblé
  { o: 50, h: 54, l: 47, c: 52 },
  { o: 52, h: 56, l: 49, c: 54 },
  { o: 54, h: 58, l: 51, c: 56 },
  { o: 70, h: 74, l: 67, c: 72 }, // low 67 > high 58 → gap, jamais comblé
  { o: 72, h: 76, l: 69, c: 74 },
  { o: 74, h: 78, l: 71, c: 76 },
  { o: 76, h: 80, l: 73, c: 78 },
  { o: 78, h: 82, l: 75, c: 80 },
  { o: 80, h: 84, l: 77, c: 82 },
  { o: 82, h: 86, l: 79, c: 84 },
  { o: 84, h: 88, l: 81, c: 86 },
  { o: 86, h: 90, l: 83, c: 88 },
  { o: 88, h: 92, l: 85, c: 90 },
];

/** The candles above are written in their own natural range (37–86); stretched across the band so
 *  the bodies are big enough for a gap between two of them to be the obvious feature. */
const gapScale = (v: number) => (v - 37) * 1.36 + 14;
const GAP_SCALED = GAP_CANDLES.map((k) => ({ o: gapScale(k.o), h: gapScale(k.h), l: gapScale(k.l), c: gapScale(k.c) }));

export function GapsDiagram() {
  const filledTop = bandY(gapScale(58), FULL_BAND);
  const filledBottom = bandY(gapScale(48), FULL_BAND);
  const openTop = bandY(gapScale(67), FULL_BAND);
  const openBottom = bandY(gapScale(58), FULL_BAND);
  return (
    <IndicatorDiagram label="Gaps : un écart comblé dont le rectangle s'arrête à la bougie qui le retraverse, et un écart non comblé dont le rectangle court jusqu'au bord">
      <rect
        x={seriesX(3) + CANDLE_WIDTH / 2}
        y={filledTop}
        width={seriesX(8) - seriesX(3)}
        height={filledBottom - filledTop}
        fill="var(--lq-color-up)"
        opacity={0.22}
        stroke="var(--lq-color-up)"
        strokeWidth={1}
      />
      <rect
        x={seriesX(11) + CANDLE_WIDTH / 2}
        y={openTop}
        width={430 - seriesX(11)}
        height={openBottom - openTop}
        fill="var(--lq-color-accent)"
        opacity={0.22}
        stroke="var(--lq-color-accent)"
        strokeWidth={1}
      />
      <DiagramOhlcCandles candles={GAP_SCALED} band={FULL_BAND} opacity={0.85} />
      <DiagramCallout
        x={20}
        y={28}
        toX={seriesX(8)}
        toY={(filledTop + filledBottom) / 2}
        text="comblé : la bougie 8 est redescendue dans la zone"
        color="var(--lq-color-up)"
      />
      <DiagramCallout
        x={430}
        y={182}
        anchor="end"
        toX={seriesX(16)}
        toY={(openTop + openBottom) / 2}
        text="non comblé : zone de déséquilibre toujours ouverte"
        color="var(--lq-color-accent)"
      />
    </IndicatorDiagram>
  );
}

/** Pattern recognition tests each family independently on a 20-candle window. The double top is the
 *  clearest one to draw, neckline included, since the neckline is what the figure resolves on. */
const PATTERN_CLOSES = [34, 42, 50, 58, 66, 74, 70, 62, 56, 50, 56, 62, 70, 75, 68, 60, 52, 46, 40, 34, 30, 26];

export function PatternRecognitionDiagram() {
  const neckY = bandY(50, FULL_BAND);
  return (
    <IndicatorDiagram label="Reconnaissance de figures : un double sommet détecté, avec sa ligne de cou dont la cassure résout la figure">
      <DiagramCandles closes={PATTERN_CLOSES} band={FULL_BAND} opacity={0.35} />
      <polyline
        points={[5, 9, 13].map((i) => `${seriesX(i)},${bandY(PATTERN_CLOSES[i], FULL_BAND).toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--lq-color-accent)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <line x1={12} y1={neckY} x2={404} y2={neckY} stroke="var(--lq-color-down)" strokeWidth={1.5} strokeDasharray="5 4" />
      <text x={408} y={neckY + 3} fontSize={9} fontWeight={600} fill="var(--lq-color-down)">
        cou
      </text>
      {[5, 13].map((i) => (
        <circle key={i} cx={seriesX(i)} cy={bandY(PATTERN_CLOSES[i], FULL_BAND)} r={3.5} fill="var(--lq-color-accent)" />
      ))}
      <text x={12} y={18} fontSize={10} fontWeight={700} fill="var(--lq-color-text)">
        Double sommet
      </text>
      <DiagramCallout x={430} y={30} anchor="end" toX={seriesX(13)} toY={bandY(PATTERN_CLOSES[13], FULL_BAND)} text="deux sommets à moins de 1,5 % l'un de l'autre" />
      <DiagramCallout x={430} y={184} anchor="end" toX={seriesX(17)} toY={neckY} text="la cassure du cou résout la figure" color="var(--lq-color-down)" />
    </IndicatorDiagram>
  );
}

/** Written out candle by candle, because the point is four specific silhouettes.
 *
 *  The hammer and the hanging man are deliberately identical — that is the diagram's whole claim —
 *  and the engulfing needs two candles, since "englobe le précédent" has nothing to englobe
 *  otherwise. */
interface NamedFigure {
  name: string;
  candles: DiagramOhlc[];
  note?: string;
  highlighted?: boolean;
}
const FIGURES: NamedFigure[] = [
  { name: "Marteau", candles: [{ o: 62, h: 71, l: 32, c: 68 }], note: "après une baisse", highlighted: true },
  { name: "Pendu", candles: [{ o: 62, h: 71, l: 32, c: 68 }], note: "après une hausse", highlighted: true },
  { name: "Doji", candles: [{ o: 54, h: 76, l: 30, c: 53 }] },
  {
    name: "Avalante",
    candles: [
      { o: 58, h: 62, l: 48, c: 50 },
      { o: 46, h: 76, l: 42, c: 72 },
    ],
  },
  { name: "Étoile filante", candles: [{ o: 38, h: 74, l: 34, c: 32 }] },
];

export function CandleRecognitionDiagram() {
  const band = { top: 46, bottom: 148 };
  const slot = 440 / FIGURES.length;
  return (
    <IndicatorDiagram label="Reconnaissance de bougies : le marteau et le pendu ont exactement la même silhouette et ne se distinguent que par la tendance qui les précède">
      {FIGURES.map((figure, i) => {
        const centre = slot * i + slot / 2;
        const pair = figure.candles.length === 2;
        return (
          <g key={figure.name}>
            {figure.highlighted && <rect x={centre - 34} y={32} width={68} height={134} rx={4} fill="var(--lq-color-accent)" opacity={0.09} />}
            <DiagramOhlcCandles
              candles={figure.candles}
              band={band}
              width={pair ? 14 : 18}
              x={(k) => (pair ? centre - 10 + k * 20 : centre)}
            />
            <text x={centre} y={26} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="var(--lq-color-text)">
              {figure.name}
            </text>
            {figure.note && (
              <text x={centre} y={164} textAnchor="middle" fontSize={8.5} fontWeight={600} fill="var(--lq-color-accent)">
                {figure.note}
              </text>
            )}
          </g>
        );
      })}
      <text x={220} y={184} textAnchor="middle" fontSize={9.5} fontWeight={600} fill="var(--lq-color-text-muted)">
        Même forme, deux lectures opposées : c&apos;est la tendance précédente qui tranche.
      </text>
    </IndicatorDiagram>
  );
}

/** Pivot points are recomputed once a period and then held — so the diagram's defining feature is
 *  the step, not the levels. */
const PIVOT_CLOSES = [48, 54, 50, 58, 62, 56, 60, 52, 46, 50, 44, 40, 46, 52, 48, 56, 60, 54, 62, 66, 60, 68];

export function PivotPointsDiagram() {
  const rows: { label: string; a: number; b: number; strong?: boolean }[] = [
    { label: "R2", a: 80, b: 88 },
    { label: "R1", a: 70, b: 78 },
    { label: "P", a: 55, b: 62, strong: true },
    { label: "S1", a: 40, b: 46 },
    { label: "S2", a: 30, b: 36 },
  ];
  const xMid = seriesX(11) - 9;
  return (
    <IndicatorDiagram label="Points pivots : une grille de niveaux calculée une fois par période et maintenue constante ensuite, d'où l'aspect en escalier">
      <DiagramCandles closes={PIVOT_CLOSES} band={FULL_BAND} opacity={0.3} />
      {rows.map((row) => (
        <g key={row.label}>
          <line x1={12} y1={bandY(row.a, FULL_BAND)} x2={xMid} y2={bandY(row.a, FULL_BAND)} stroke="var(--lq-color-accent)" strokeWidth={row.strong ? 2 : 1.2} opacity={row.strong ? 1 : 0.65} />
          <line x1={xMid} y1={bandY(row.a, FULL_BAND)} x2={xMid} y2={bandY(row.b, FULL_BAND)} stroke="var(--lq-color-accent)" strokeWidth={1} opacity={0.3} strokeDasharray="2 2" />
          <line x1={xMid} y1={bandY(row.b, FULL_BAND)} x2={404} y2={bandY(row.b, FULL_BAND)} stroke="var(--lq-color-accent)" strokeWidth={row.strong ? 2 : 1.2} opacity={row.strong ? 1 : 0.65} />
          <text x={408} y={bandY(row.b, FULL_BAND) + 3} fontSize={9} fontWeight={row.strong ? 700 : 600} fill="var(--lq-color-accent)">
            {row.label}
          </text>
        </g>
      ))}
      <line x1={xMid} y1={FULL_BAND.top - 8} x2={xMid} y2={FULL_BAND.bottom + 6} stroke="var(--lq-color-text-muted)" strokeWidth={1} strokeDasharray="3 3" />
      <text x={xMid + 5} y={FULL_BAND.top - 11} fontSize={9} fontWeight={600} fill="var(--lq-color-text-muted)">
        nouvelle période
      </text>
      <text x={16} y={180} fontSize={9.5} fontWeight={600} fill="var(--lq-color-text-muted)">
        Les niveaux ne bougent pas pendant la période : ils sont connus à l&apos;avance.
      </text>
    </IndicatorDiagram>
  );
}

/** The support/resistance indicator's output is a level *and* a touch count, so the diagram marks
 *  each touch — otherwise "plus un niveau a été touché, plus il compte" has nothing to point at. */
const SR_CLOSES = [40, 56, 72, 58, 42, 54, 71, 60, 44, 52, 70, 56, 40, 50, 69, 58, 44, 54, 71, 60, 46, 52];

export function SupportResistanceDiagram() {
  return (
    <IndicatorDiagram label="Support et résistance déduits automatiquement : chaque niveau porte le nombre de fois où le prix y a réagi">
      <DiagramCandles closes={SR_CLOSES} band={FULL_BAND} opacity={0.35} />
      {[
        { value: 71, touches: [2, 6, 10, 14, 18], label: "Résistance · 5 touches", color: "var(--lq-color-down)" },
        { value: 41, touches: [0, 4, 8, 12, 16], label: "Support · 5 touches", color: "var(--lq-color-up)" },
      ].map((level) => (
        <g key={level.label}>
          <line x1={12} y1={bandY(level.value, FULL_BAND)} x2={404} y2={bandY(level.value, FULL_BAND)} stroke={level.color} strokeWidth={2} />
          {level.touches.map((i) => (
            <circle key={i} cx={seriesX(i)} cy={bandY(level.value, FULL_BAND)} r={3} fill={level.color} />
          ))}
          <text x={16} y={bandY(level.value, FULL_BAND) - 6} fontSize={9} fontWeight={700} fill={level.color}>
            {level.label}
          </text>
        </g>
      ))}
      <text x={16} y={180} fontSize={9.5} fontWeight={600} fill="var(--lq-color-text-muted)">
        Un extrême isolé n&apos;est pas un niveau : il faut au moins deux points regroupés.
      </text>
    </IndicatorDiagram>
  );
}

/** TPO counts time at each price. The profile is pinned to the right edge and grows leftwards — the
 *  way a profile is conventionally read — so it sits beside the candles instead of on top of them. */
const TPO_CLOSES = [50, 56, 52, 60, 54, 48, 52, 58, 54, 50, 56, 52];
const TPO_ROWS = [
  { price: 66, count: 1 },
  { price: 62, count: 2 },
  { price: 58, count: 5 },
  { price: 54, count: 9 },
  { price: 50, count: 12 },
  { price: 46, count: 7 },
  { price: 42, count: 3 },
  { price: 38, count: 1 },
];

export function TpoDiagram() {
  const maxCount = Math.max(...TPO_ROWS.map((r) => r.count));
  const right = 404;
  const widest = 150;
  const poc = TPO_ROWS.reduce((best, r) => (r.count > best.count ? r : best), TPO_ROWS[0]);
  return (
    <IndicatorDiagram label="Profil TPO : le temps passé à chaque niveau de prix, le niveau le plus visité formant le point de contrôle">
      <DiagramCandles closes={TPO_CLOSES} band={FULL_BAND} opacity={0.22} />
      {TPO_ROWS.map((row) => {
        const y = bandY(row.price, FULL_BAND);
        const width = (row.count / maxCount) * widest;
        const isPoc = row.price === poc.price;
        return (
          <g key={row.price}>
            <rect x={right - width} y={y - 6} width={width} height={12} fill={isPoc ? "var(--lq-color-accent)" : "var(--lq-color-text-muted)"} opacity={isPoc ? 0.9 : 0.45} />
            {isPoc && (
              <text x={right - width - 6} y={y + 3} textAnchor="end" fontSize={9} fontWeight={700} fill="var(--lq-color-accent)">
                POC
              </text>
            )}
          </g>
        );
      })}
      <DiagramCallout
        x={200}
        y={28}
        anchor="end"
        toX={right - (TPO_ROWS[1].count / maxCount) * widest}
        toY={bandY(TPO_ROWS[1].price, FULL_BAND)}
        text="palier traversé vite : souvent retraversé vite"
      />
      <text x={16} y={180} fontSize={9.5} fontWeight={600} fill="var(--lq-color-text-muted)">
        Large = le marché s&apos;y est organisé. Étroit = il n&apos;a fait que passer.
      </text>
    </IndicatorDiagram>
  );
}

/** Volume is not an `IndicatorKind`, so it has no entry in `INDICATOR_DIAGRAMS` — the info modal
 *  reaches for this one by name (see IndicatorModals.tsx). It earns a picture all the same,
 *  because the two readings that matter are comparative and a single histogram shows neither:
 *  here a breakout lands on a volume spike, and the rally after it thins out bar by bar. */
const VOLUME_CLOSES = [46, 44, 47, 45, 48, 46, 62, 66, 70, 73, 75, 76, 77, 78, 79, 79, 80, 80, 81, 81, 82, 82];
const VOLUME_BARS = [30, 26, 32, 24, 28, 25, 92, 78, 62, 70, 58, 50, 44, 40, 34, 30, 26, 22, 20, 17, 15, 13];

export function VolumeDiagram() {
  return (
    <IndicatorDiagram label="Volume : une cassure accompagnée d'un volume très supérieur à la moyenne, puis une hausse qui se poursuit sur des volumes déclinants">
      <DiagramCandles closes={VOLUME_CLOSES} band={UPPER_BAND} opacity={0.5} />

      <DiagramPanel band={LOWER_BAND} title="VOLUMES" />
      {VOLUME_BARS.map((volume, i) => {
        const height = (volume / 100) * (LOWER_BAND.bottom - LOWER_BAND.top) * 0.82;
        const rising = VOLUME_CLOSES[i] >= (i === 0 ? VOLUME_CLOSES[0] : VOLUME_CLOSES[i - 1]);
        return (
          <rect
            key={i}
            x={seriesX(i) - 5}
            y={LOWER_BAND.bottom - height}
            width={10}
            height={height}
            fill={rising ? "var(--lq-color-up)" : "var(--lq-color-down)"}
            opacity={i === 6 ? 1 : 0.6}
          />
        );
      })}
      <DiagramCallout
        x={140}
        y={106}
        toX={seriesX(6)}
        toY={LOWER_BAND.bottom - (VOLUME_BARS[6] / 100) * (LOWER_BAND.bottom - LOWER_BAND.top) * 0.82 - 4}
        text="cassure sur volume massif : crédible"
        color="var(--lq-color-up)"
      />
      <DiagramCallout
        x={430}
        y={186}
        anchor="end"
        toX={seriesX(19)}
        toY={LOWER_BAND.bottom - (VOLUME_BARS[19] / 100) * (LOWER_BAND.bottom - LOWER_BAND.top) * 0.82 - 4}
        text="la hausse continue, mais portée par de moins en moins de monde"
      />
    </IndicatorDiagram>
  );
}
