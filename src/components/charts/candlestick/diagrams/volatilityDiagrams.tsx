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
  FULL_BAND,
  UPPER_BAND,
  LOWER_BAND,
  bandY,
  seriesX,
  sma,
  stddev,
} from "./diagramMath";

/** Bollinger, CHOP and ATR all answer the same question — how agitated is this market — so all
 *  three diagrams are built on one series that is deliberately calm for a stretch and then is not.
 *  The squeeze, the range reading and the ATR spike are the same eleven candles seen three ways. */
const CALM_THEN_BREAK = [50, 51, 49, 50, 51, 50, 49, 50, 51, 50, 50, 51, 54, 60, 67, 63, 70, 76, 72, 79, 84, 81];

const BB_MID = sma(CALM_THEN_BREAK, 8);
const BB_DEV = stddev(CALM_THEN_BREAK, 8);
const BB_UPPER = BB_MID.map((m, i) => (m === null || BB_DEV[i] === null ? null : m + 2 * (BB_DEV[i] as number)));
const BB_LOWER = BB_MID.map((m, i) => (m === null || BB_DEV[i] === null ? null : m - 2 * (BB_DEV[i] as number)));

export function BollingerDiagram() {
  // The fill between the two bands, built as one closed path: down the upper edge, back along the
  // lower. It is what makes the squeeze legible as a narrowing *shape* rather than two lines that
  // happen to be close.
  const filled = BB_UPPER.map((u, i) => (u !== null && BB_LOWER[i] !== null ? i : -1)).filter((i) => i >= 0);
  const path =
    filled.map((i) => `${seriesX(i)},${bandY(BB_UPPER[i] as number, FULL_BAND).toFixed(1)}`).join(" ") +
    " " +
    [...filled]
      .reverse()
      .map((i) => `${seriesX(i)},${bandY(BB_LOWER[i] as number, FULL_BAND).toFixed(1)}`)
      .join(" ");

  return (
    <IndicatorDiagram label="Bandes de Bollinger : un resserrement pendant la phase calme, puis un écartement à la sortie">
      <polygon points={path} fill="var(--lq-color-accent)" opacity={0.1} />
      <DiagramCandles closes={CALM_THEN_BREAK} band={FULL_BAND} opacity={0.5} />
      <DiagramSeries values={BB_UPPER} band={FULL_BAND} width={1.8} />
      <DiagramSeries values={BB_LOWER} band={FULL_BAND} width={1.8} />
      <DiagramSeries values={BB_MID} band={FULL_BAND} width={1.4} color="var(--lq-color-text-muted)" dashed />
      <text x={seriesX(9)} y={bandY((BB_MID[9] as number) ?? 50, FULL_BAND) - 5} fontSize={9} fontWeight={600} fill="var(--lq-color-text-muted)">
        médiane
      </text>
      <DiagramCallout x={26} y={30} toX={seriesX(10)} toY={bandY(BB_UPPER[10] as number, FULL_BAND)} text="squeeze — volatilité comprimée" />
      <DiagramCallout
        x={430}
        y={176}
        anchor="end"
        toX={seriesX(18)}
        toY={bandY(BB_LOWER[18] as number, FULL_BAND)}
        text="les bandes s'écartent : la sortie a eu lieu"
      />
    </IndicatorDiagram>
  );
}

/** CHOP is high when the market covers ground without going anywhere, low when it goes somewhere.
 *  The panel reading therefore falls as the price above it breaks out — which is the only thing
 *  the reader has to see. */
const CHOP_VALUES = [72, 76, 74, 78, 80, 77, 75, 79, 76, 74, 70, 62, 54, 44, 36, 33, 30, 28, 31, 27, 25, 29];

export function ChopDiagram() {
  return (
    <IndicatorDiagram label="Choppiness Index : une valeur haute pendant le range, qui s'effondre quand la tendance démarre">
      <DiagramCandles closes={CALM_THEN_BREAK} band={UPPER_BAND} opacity={0.45} />

      <DiagramPanel band={LOWER_BAND} title="CHOP" />
      <DiagramZone from={61.8} to={100} band={LOWER_BAND} color="var(--lq-color-down)" />
      <DiagramZone from={0} to={38.2} band={LOWER_BAND} color="var(--lq-color-up)" />
      <DiagramThreshold value={61.8} band={LOWER_BAND} label="61,8" />
      <DiagramThreshold value={38.2} band={LOWER_BAND} label="38,2" />
      <DiagramSeries values={CHOP_VALUES} band={LOWER_BAND} width={2.2} />
      <text x={16} y={bandY(80, LOWER_BAND) + 3} fontSize={8.5} fontWeight={600} fill="var(--lq-color-text-muted)">
        range
      </text>
      <text x={16} y={bandY(22, LOWER_BAND) + 3} fontSize={8.5} fontWeight={600} fill="var(--lq-color-text-muted)">
        tendance
      </text>
      <DiagramCallout x={430} y={106} anchor="end" toX={seriesX(13)} toY={bandY(CHOP_VALUES[13], LOWER_BAND)} text="la valeur chute : le marché a choisi un sens" />
    </IndicatorDiagram>
  );
}

/** ATR rises in the break and would rise identically in a crash — the diagram says so in as many
 *  words, because "no direction" is the single thing most often misread about it. */
const ATR_VALUES = [12, 13, 11, 12, 13, 12, 11, 12, 13, 12, 14, 22, 34, 46, 58, 52, 61, 68, 62, 70, 74, 69];

export function AtrDiagram() {
  return (
    <IndicatorDiagram label="Average True Range : une amplitude moyenne stable pendant le calme, qui explose à la sortie">
      <DiagramCandles closes={CALM_THEN_BREAK} band={UPPER_BAND} opacity={0.45} />

      <DiagramPanel band={LOWER_BAND} title="ATR" />
      <DiagramSeries values={ATR_VALUES} band={LOWER_BAND} width={2.2} />
      <DiagramCallout x={24} y={132} toX={seriesX(5)} toY={bandY(ATR_VALUES[5], LOWER_BAND)} text="bougies calmes" />
      <DiagramCallout
        x={430}
        y={186}
        anchor="end"
        toX={seriesX(17)}
        toY={bandY(ATR_VALUES[17], LOWER_BAND)}
        text="grandes bougies — il monterait pareil dans une chute"
      />
    </IndicatorDiagram>
  );
}
