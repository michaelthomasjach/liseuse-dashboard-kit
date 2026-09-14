import {
  IndicatorDiagram,
  DiagramCandles,
  DiagramSeries,
  DiagramPanel,
  DiagramThreshold,
  DiagramZone,
  DiagramCallout,
} from "./DiagramPrimitives";
import {
  UPPER_BAND,
  LOWER_BAND,
  bandY,
  seriesX,
  ema,
} from "./diagramMath";

/** RSI, MACD and ADX are the three oscillators worth a picture, and each picture is built around
 *  the one reading that is hardest to get from prose. */

/** A series that makes a higher high while momentum makes a lower one — a textbook bearish
 *  divergence, which is what the RSI panel below it is drawn to show. */
const DIVERGENCE_CLOSES = [40, 46, 52, 48, 58, 66, 62, 68, 60, 54, 50, 58, 66, 74, 80, 86, 92, 84, 74, 64, 56, 48];
const RSI_VALUES = [42, 52, 61, 55, 70, 80, 74, 88, 76, 62, 54, 60, 66, 62, 56, 60, 68, 58, 48, 40, 33, 27];

export function RsiDiagram() {
  return (
    <IndicatorDiagram label="RSI : les zones de surachat et de survente, et une divergence baissière entre le prix et l'indicateur">
      <DiagramCandles closes={DIVERGENCE_CLOSES} band={UPPER_BAND} opacity={0.4} />
      {/* The two price peaks, rising — drawn so the eye can compare them with the two RSI peaks
          directly underneath, which fall. */}
      <line
        x1={seriesX(7)}
        y1={bandY(DIVERGENCE_CLOSES[7], UPPER_BAND) - 6}
        x2={seriesX(16)}
        y2={bandY(DIVERGENCE_CLOSES[16], UPPER_BAND) - 6}
        stroke="var(--lq-color-text)"
        strokeWidth={1.4}
      />
      <text x={seriesX(10)} y={18} fontSize={9} fontWeight={700} fill="var(--lq-color-text)">
        sommet plus haut
      </text>

      <DiagramPanel band={LOWER_BAND} title="RSI" />
      <DiagramZone from={70} to={100} band={LOWER_BAND} color="var(--lq-color-down)" />
      <DiagramZone from={0} to={30} band={LOWER_BAND} color="var(--lq-color-up)" />
      <DiagramThreshold value={70} band={LOWER_BAND} label="70" />
      <DiagramThreshold value={50} band={LOWER_BAND} label="50" color="var(--lq-color-border-subtle)" />
      <DiagramThreshold value={30} band={LOWER_BAND} label="30" />
      <DiagramSeries values={RSI_VALUES} band={LOWER_BAND} width={2.2} />
      <line
        x1={seriesX(7)}
        y1={bandY(RSI_VALUES[7], LOWER_BAND) - 5}
        x2={seriesX(16)}
        y2={bandY(RSI_VALUES[16], LOWER_BAND) - 5}
        stroke="var(--lq-color-down)"
        strokeWidth={1.6}
      />
      <DiagramCallout
        x={430}
        y={186}
        anchor="end"
        toX={seriesX(16)}
        toY={bandY(RSI_VALUES[16], LOWER_BAND)}
        text="…mais sommet plus bas sur le RSI : divergence"
        color="var(--lq-color-down)"
      />
    </IndicatorDiagram>
  );
}

/** The MACD diagram computes its own lines from the series above it — shortened periods (6/13/5
 *  rather than 12/26/9) so that twenty-two candles are enough to show a full crossover. */
const MACD_CLOSES = [46, 44, 48, 52, 50, 56, 62, 58, 64, 70, 66, 60, 54, 50, 44, 48, 54, 60, 66, 70, 76, 80];
const FAST = ema(MACD_CLOSES, 3);
const SLOW = ema(MACD_CLOSES, 7);
const MACD_LINE = FAST.map((f, i) => (f === null || SLOW[i] === null ? null : f - (SLOW[i] as number)));
const MACD_FROM = MACD_LINE.findIndex((v) => v !== null);
const SIGNAL_RAW = ema(MACD_LINE.slice(MACD_FROM).map((v) => v as number), 3);
const SIGNAL_LINE = MACD_LINE.map((_, i) => (i < MACD_FROM ? null : SIGNAL_RAW[i - MACD_FROM]));

/** The last bar on which the MACD line closes above its signal — found rather than hardcoded, so
 *  the callout keeps pointing at a real crossing if the series is ever retuned. The *first* one is
 *  avoided deliberately: it falls inside the signal EMA's own warm-up and is an artefact.
 *
 *  Written as a loop because `findLastIndex` is newer than this package's compile target. */
function lastCrossUp(): number {
  for (let i = MACD_LINE.length - 1; i > MACD_FROM; i -= 1) {
    const now = MACD_LINE[i];
    const before = MACD_LINE[i - 1];
    const signalNow = SIGNAL_LINE[i];
    const signalBefore = SIGNAL_LINE[i - 1];
    if (now == null || before == null || signalNow == null || signalBefore == null) continue;
    if (now > signalNow && before <= signalBefore) return i;
  }
  return MACD_LINE.length - 1;
}
const CROSS = lastCrossUp();

/** The MACD panel plots values around zero, so 0–100 band space needs a mid-point offset. */
const MACD_SCALE = 5;
const centred = (v: number | null) => (v === null ? null : 50 + v * MACD_SCALE);

export function MacdDiagram() {
  return (
    <IndicatorDiagram label="MACD : la ligne, sa ligne de signal, l'histogramme de leur écart et le croisement haussier">
      <DiagramCandles closes={MACD_CLOSES} band={UPPER_BAND} opacity={0.4} />

      <DiagramPanel band={LOWER_BAND} title="MACD" />
      <DiagramThreshold value={50} band={LOWER_BAND} label="0" color="var(--lq-color-border-subtle)" dashed={false} />
      {MACD_LINE.map((v, i) => {
        if (v === null || SIGNAL_LINE[i] === null || SIGNAL_LINE[i] === undefined) return null;
        const gap = v - (SIGNAL_LINE[i] as number);
        const zero = bandY(50, LOWER_BAND);
        const y = bandY(50 + gap * MACD_SCALE, LOWER_BAND);
        return (
          <rect
            key={i}
            x={seriesX(i) - 4}
            y={Math.min(zero, y)}
            width={8}
            height={Math.max(1, Math.abs(y - zero))}
            fill={gap >= 0 ? "var(--lq-color-up)" : "var(--lq-color-down)"}
            opacity={0.55}
          />
        );
      })}
      <DiagramSeries values={MACD_LINE.map(centred)} band={LOWER_BAND} width={2.2} />
      <DiagramSeries values={SIGNAL_LINE.map((v) => centred(v ?? null))} band={LOWER_BAND} width={1.8} color="var(--lq-color-text-muted)" dashed />
      <text x={12} y={186} fontSize={9} fontWeight={700} fill="var(--lq-color-accent)">
        ■ MACD
      </text>
      <text x={72} y={186} fontSize={9} fontWeight={600} fill="var(--lq-color-text-muted)">
        ▫ signal · barres = l'écart entre les deux
      </text>
      <DiagramCallout x={430} y={106} anchor="end" toX={seriesX(CROSS)} toY={bandY(centred(MACD_LINE[CROSS]) ?? 50, LOWER_BAND)} text="croisement haussier" />
    </IndicatorDiagram>
  );
}

/** ADX says how strong, +DI and -DI say which way. Drawing all three is the only way to show that
 *  the first can climb while the market falls. */
const ADX_CLOSES = [70, 66, 62, 58, 52, 56, 50, 44, 46, 40, 34, 30, 33, 28, 24, 26, 22, 25, 30, 36, 42, 48];
const ADX_SCALE = 1.65;
const ADX_VALUES = [16, 18, 21, 26, 31, 29, 33, 38, 36, 41, 46, 50, 47, 51, 54, 50, 52, 47, 41, 35, 29, 24];
const PLUS_DI = [30, 27, 24, 22, 20, 24, 21, 18, 20, 17, 15, 14, 16, 13, 12, 14, 13, 16, 22, 30, 37, 43];
const MINUS_DI = [30, 34, 39, 44, 48, 44, 47, 52, 49, 53, 57, 60, 56, 61, 63, 58, 59, 52, 43, 34, 27, 22];

export function AdxDiagram() {
  return (
    <IndicatorDiagram label="ADX : la force de la tendance au-dessus de 25, avec les lignes +DI et -DI qui en donnent le sens">
      <DiagramCandles closes={ADX_CLOSES} band={UPPER_BAND} opacity={0.4} />

      <DiagramPanel band={LOWER_BAND} title="ADX" />
      <DiagramZone from={25 * ADX_SCALE} to={100} band={LOWER_BAND} color="var(--lq-color-accent)" opacity={0.07} />
      <DiagramThreshold value={25 * ADX_SCALE} band={LOWER_BAND} label="25" />
      <DiagramSeries values={MINUS_DI.map((v) => v * ADX_SCALE)} band={LOWER_BAND} width={1.6} color="var(--lq-color-down)" />
      <DiagramSeries values={PLUS_DI.map((v) => v * ADX_SCALE)} band={LOWER_BAND} width={1.6} color="var(--lq-color-up)" />
      <DiagramSeries values={ADX_VALUES.map((v) => v * ADX_SCALE)} band={LOWER_BAND} width={2.4} />
      <text x={12} y={186} fontSize={9} fontWeight={700} fill="var(--lq-color-accent)">
        ■ ADX
      </text>
      <text x={62} y={186} fontSize={9} fontWeight={600} fill="var(--lq-color-up)">
        ■ +DI
      </text>
      <text x={104} y={186} fontSize={9} fontWeight={600} fill="var(--lq-color-down)">
        ■ −DI
      </text>
      <DiagramCallout
        x={430}
        y={100}
        anchor="end"
        toX={seriesX(14)}
        toY={bandY(ADX_VALUES[14] * ADX_SCALE, LOWER_BAND)}
        text="il monte alors que le marché baisse : une force, pas un sens"
      />
    </IndicatorDiagram>
  );
}
