import {
  IndicatorDiagram,
  DiagramCandles,
  DiagramSeries,
  DiagramCallout,
} from "./DiagramPrimitives";
import {
  FULL_BAND,
  bandY,
  seriesX,
  sma,
  SWING_CLOSES,
} from "./diagramMath";

/** The five trend-following overlays. All but Ichimoku share `SWING_CLOSES`, so the reader who
 *  opens two of them in a row is comparing behaviours rather than re-reading a new market. */

/** Zig Zag keeps only the pivots that survive a deviation filter, labels each against the previous
 *  one of the same kind, and — the detail worth drawing — stops at the last *confirmed* pivot. */
const ZIGZAG_CLOSES = [30, 42, 54, 62, 54, 47, 40, 50, 60, 70, 78, 70, 60, 50, 58, 64, 70, 60, 48, 36, 42, 48];

/** Every pivot the filter kept. `peak` places the label on the right side of the point, and is the
 *  pivot's own nature — not something inferable from its letters, which is how "LH" (a lower
 *  *high*) once ended up captioned underneath a peak. */
const ZZ_PIVOTS: { i: number; label: string; peak: boolean }[] = [
  { i: 0, label: "", peak: false },
  { i: 3, label: "", peak: true },
  { i: 6, label: "", peak: false },
  { i: 10, label: "HH", peak: true },
  { i: 13, label: "HL", peak: false },
  { i: 16, label: "LH", peak: true },
  { i: 19, label: "LL", peak: false },
];

export function ZigzagDiagram() {
  return (
    <IndicatorDiagram label="Zig Zag : la courbe réduite à ses pivots significatifs, étiquetés HH, HL, LH et LL">
      <DiagramCandles closes={ZIGZAG_CLOSES} band={FULL_BAND} opacity={0.3} />
      <polyline
        points={ZZ_PIVOTS.map((p) => `${seriesX(p.i)},${bandY(ZIGZAG_CLOSES[p.i], FULL_BAND).toFixed(1)}`).join(" ")}
        fill="none"
        stroke="var(--lq-color-accent)"
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      {ZZ_PIVOTS.map((p) => (
        <g key={p.i}>
          <circle cx={seriesX(p.i)} cy={bandY(ZIGZAG_CLOSES[p.i], FULL_BAND)} r={3.5} fill="var(--lq-color-accent)" />
          {p.label && (
            <text
              x={seriesX(p.i)}
              y={bandY(ZIGZAG_CLOSES[p.i], FULL_BAND) + (p.peak ? -9 : 16)}
              textAnchor="middle"
              fontSize={9.5}
              fontWeight={700}
              fill="var(--lq-color-text)"
            >
              {p.label}
            </text>
          )}
        </g>
      ))}
      <DiagramCallout x={430} y={30} anchor="end" toX={seriesX(16)} toY={bandY(ZIGZAG_CLOSES[16], FULL_BAND)} text="premier LH : la structure haussière casse" />
      <text x={430} y={180} textAnchor="end" fontSize={9.5} fontWeight={600} fill="var(--lq-color-text-muted)">
        La jambe en cours n&apos;est pas tracée : elle s&apos;arrête au dernier pivot confirmé.
      </text>
    </IndicatorDiagram>
  );
}

/** Supertrend: one band at a time, on the side the trend is not. The ratchet is the point — the
 *  line only ever approaches the price until a close pushes through it. */
const ST_CLOSES = [30, 36, 33, 42, 48, 45, 54, 60, 57, 66, 72, 68, 60, 50, 44, 48, 40, 34, 38, 30, 26, 32];
const ST_FLIP = 12;
const ST_LINE = ST_CLOSES.map((_, i) => {
  if (i < ST_FLIP) {
    // Rising stop under the price: the running minimum of what came before, raised.
    let floor = ST_CLOSES[0] - 10;
    for (let k = 0; k <= i; k += 1) floor = Math.max(floor, ST_CLOSES[k] - 12);
    return floor;
  }
  let ceiling = ST_CLOSES[ST_FLIP] + 12;
  for (let k = ST_FLIP; k <= i; k += 1) ceiling = Math.min(ceiling, ST_CLOSES[k] + 12);
  return ceiling;
});

export function SupertrendDiagram() {
  return (
    <IndicatorDiagram label="Supertrend : une bande sous le prix en tendance haussière, qui bascule au-dessus après une clôture franche">
      <DiagramCandles closes={ST_CLOSES} band={FULL_BAND} opacity={0.45} />
      <DiagramSeries values={ST_LINE.map((v, i) => (i < ST_FLIP ? v : null))} band={FULL_BAND} width={2.6} color="var(--lq-color-up)" />
      <DiagramSeries values={ST_LINE.map((v, i) => (i >= ST_FLIP ? v : null))} band={FULL_BAND} width={2.6} color="var(--lq-color-down)" />
      <line x1={seriesX(ST_FLIP) - 9} y1={FULL_BAND.top - 4} x2={seriesX(ST_FLIP) - 9} y2={FULL_BAND.bottom + 4} stroke="var(--lq-color-text-muted)" strokeWidth={1} strokeDasharray="3 3" />
      <DiagramCallout x={30} y={182} toX={seriesX(6)} toY={bandY(ST_LINE[6], FULL_BAND)} text="la bande ne recule jamais : elle se resserre" color="var(--lq-color-up)" />
      <DiagramCallout x={430} y={30} anchor="end" toX={seriesX(ST_FLIP)} toY={bandY(ST_CLOSES[ST_FLIP], FULL_BAND)} text="bascule" color="var(--lq-color-down)" />
    </IndicatorDiagram>
  );
}

/** Parabolic SAR: dots, and the acceleration is visible in their spacing — far apart early in the
 *  trend, tight against the price by the end of it. */
const SAR_FLIP = 13;
const SAR_DOTS = SWING_CLOSES.map((close, i) => {
  if (i < SAR_FLIP) {
    const progress = i / SAR_FLIP;
    return close - 16 * (1 - progress) - 3;
  }
  const progress = (i - SAR_FLIP) / (SWING_CLOSES.length - SAR_FLIP);
  return close + 16 * (1 - progress) + 3;
});

export function ParabolicSarDiagram() {
  return (
    <IndicatorDiagram label="Parabolic SAR : des points sous le prix en tendance haussière, qui se rapprochent de plus en plus vite avant de basculer au-dessus">
      <DiagramCandles closes={SWING_CLOSES} band={FULL_BAND} opacity={0.45} />
      {SAR_DOTS.map((v, i) => (
        <circle key={i} cx={seriesX(i)} cy={bandY(v, FULL_BAND)} r={2.6} fill={i < SAR_FLIP ? "var(--lq-color-up)" : "var(--lq-color-down)"} />
      ))}
      <DiagramCallout x={26} y={184} toX={seriesX(2)} toY={bandY(SAR_DOTS[2], FULL_BAND)} text="loin du prix au départ…" color="var(--lq-color-up)" />
      <DiagramCallout x={160} y={150} toX={seriesX(11)} toY={bandY(SAR_DOTS[11], FULL_BAND)} text="…de plus en plus près" color="var(--lq-color-up)" />
      <DiagramCallout x={430} y={26} anchor="end" toX={seriesX(SAR_FLIP)} toY={bandY(SAR_DOTS[SAR_FLIP], FULL_BAND)} text="touché : la série se retourne" color="var(--lq-color-down)" />
    </IndicatorDiagram>
  );
}

/** Ichimoku's whole identity is the cloud, and the cloud's identity is that it sits *ahead* of the
 *  price. Both Senkou series are therefore drawn shifted right, past the last candle. */
const ICHI_CLOSES = [34, 40, 37, 46, 52, 48, 56, 62, 58, 64, 70, 66, 72, 76, 71, 78, 82, 86];
const TENKAN = sma(ICHI_CLOSES, 4);
const KIJUN = sma(ICHI_CLOSES, 9);
const SHIFT = 4;

export function IchimokuDiagram() {
  // Senkou A and B, pushed SHIFT slots to the right — the last few land beyond the final candle,
  // which is exactly where the reader needs to see them.
  const senkouA: (number | null)[] = [];
  const senkouB: (number | null)[] = [];
  for (let i = 0; i < ICHI_CLOSES.length + SHIFT; i += 1) {
    const src = i - SHIFT;
    const a = src >= 0 && TENKAN[src] !== null && KIJUN[src] !== null ? ((TENKAN[src] as number) + (KIJUN[src] as number)) / 2 : null;
    senkouA.push(a);
    senkouB.push(src >= 0 && KIJUN[src] !== null ? (KIJUN[src] as number) - 9 : null);
  }
  const cloudIdx = senkouA.map((a, i) => (a !== null && senkouB[i] !== null ? i : -1)).filter((i) => i >= 0);
  const cloud =
    cloudIdx.map((i) => `${seriesX(i)},${bandY(senkouA[i] as number, FULL_BAND).toFixed(1)}`).join(" ") +
    " " +
    [...cloudIdx].reverse().map((i) => `${seriesX(i)},${bandY(senkouB[i] as number, FULL_BAND).toFixed(1)}`).join(" ");

  return (
    <IndicatorDiagram label="Ichimoku : la ligne de conversion, la ligne de base et le nuage projeté en avant du prix">
      <polygon points={cloud} fill="var(--lq-color-up)" opacity={0.16} />
      <DiagramCandles closes={ICHI_CLOSES} band={FULL_BAND} opacity={0.4} />
      <DiagramSeries values={senkouA} band={FULL_BAND} width={1.4} color="var(--lq-color-up)" opacity={0.9} />
      <DiagramSeries values={senkouB} band={FULL_BAND} width={1.4} color="var(--lq-color-up)" opacity={0.9} />
      <DiagramSeries values={KIJUN} band={FULL_BAND} width={1.8} color="var(--lq-color-text-muted)" dashed />
      <DiagramSeries values={TENKAN} band={FULL_BAND} width={2} />
      <text x={12} y={184} fontSize={9} fontWeight={700} fill="var(--lq-color-accent)">
        ■ Tenkan
      </text>
      <text x={72} y={184} fontSize={9} fontWeight={600} fill="var(--lq-color-text-muted)">
        ▫ Kijun
      </text>
      <text x={124} y={184} fontSize={9} fontWeight={600} fill="var(--lq-color-up)">
        ▨ nuage
      </text>
      <DiagramCallout
        x={430}
        y={30}
        anchor="end"
        toX={seriesX(ICHI_CLOSES.length + SHIFT - 1)}
        toY={bandY(senkouB[ICHI_CLOSES.length + SHIFT - 1] as number, FULL_BAND)}
        text="le nuage est projeté en avant du dernier prix"
      />
      <line
        x1={seriesX(ICHI_CLOSES.length - 1) + 9}
        y1={FULL_BAND.top - 6}
        x2={seriesX(ICHI_CLOSES.length - 1) + 9}
        y2={FULL_BAND.bottom + 6}
        stroke="var(--lq-color-text-muted)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      <text x={seriesX(ICHI_CLOSES.length - 1) + 13} y={FULL_BAND.bottom + 6} fontSize={8.5} fontWeight={600} fill="var(--lq-color-text-muted)">
        dernière bougie
      </text>
    </IndicatorDiagram>
  );
}

/** Chandelier Exit hangs off the running extreme, not off the current price — so the diagram draws
 *  that extreme too, and the drop between them. */
const CE_CLOSES = [30, 38, 34, 46, 52, 48, 58, 66, 61, 70, 76, 72, 66, 58, 50, 55, 46, 40, 44, 36, 32, 38];
const CE_FLIP = 13;
const CE_RUNNING_HIGH = CE_CLOSES.map((_, i) => Math.max(...CE_CLOSES.slice(0, i + 1)));
const CE_STOP = CE_CLOSES.map((_, i) => (i < CE_FLIP ? CE_RUNNING_HIGH[i] - 18 : Math.min(...CE_CLOSES.slice(CE_FLIP, i + 1)) + 18));

export function ChandelierExitDiagram() {
  const fillIdx = CE_CLOSES.map((_, i) => i).filter((i) => i < CE_FLIP);
  const fill =
    fillIdx.map((i) => `${seriesX(i)},${bandY(CE_CLOSES[i], FULL_BAND).toFixed(1)}`).join(" ") +
    " " +
    [...fillIdx].reverse().map((i) => `${seriesX(i)},${bandY(CE_STOP[i], FULL_BAND).toFixed(1)}`).join(" ");

  return (
    <IndicatorDiagram label="Chandelier Exit : un stop suiveur accroché au plus haut atteint, qui bascule de l'autre côté après une clôture franche">
      <polygon points={fill} fill="var(--lq-color-up)" opacity={0.1} />
      <DiagramCandles closes={CE_CLOSES} band={FULL_BAND} opacity={0.4} />
      <DiagramSeries values={CE_RUNNING_HIGH.map((v, i) => (i < CE_FLIP ? v : null))} band={FULL_BAND} width={1.2} color="var(--lq-color-text-muted)" dashed />
      <DiagramSeries values={CE_STOP.map((v, i) => (i < CE_FLIP ? v : null))} band={FULL_BAND} width={2.4} color="var(--lq-color-up)" />
      <DiagramSeries values={CE_STOP.map((v, i) => (i >= CE_FLIP ? v : null))} band={FULL_BAND} width={2.4} color="var(--lq-color-down)" />
      <text x={seriesX(2)} y={bandY(CE_RUNNING_HIGH[4], FULL_BAND) - 9} fontSize={9} fontWeight={600} fill="var(--lq-color-text-muted)">
        plus haut atteint
      </text>
      <DiagramCallout x={22} y={182} toX={seriesX(7)} toY={bandY(CE_STOP[7], FULL_BAND)} text="le stop pend sous ce plus haut, à un multiple de l'ATR" color="var(--lq-color-up)" />
      <DiagramCallout x={430} y={28} anchor="end" toX={seriesX(CE_FLIP)} toY={bandY(CE_STOP[CE_FLIP], FULL_BAND)} text="Vente" color="var(--lq-color-down)" />
    </IndicatorDiagram>
  );
}
