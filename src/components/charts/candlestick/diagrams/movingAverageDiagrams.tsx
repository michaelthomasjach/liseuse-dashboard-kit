import {
  IndicatorDiagram,
  DiagramCandles,
  DiagramSeries,
  DiagramCallout,
  DiagramPanel,
} from "./DiagramPrimitives";
import {
  FULL_BAND,
  UPPER_BAND,
  LOWER_BAND,
  bandY,
  seriesX,
  sma,
  ema,
  SWING_CLOSES,
} from "./diagramMath";

/** The four averages, drawn on one shared series so they can be compared.
 *
 *  Each of these asks `sma`/`ema` for the real curve rather than sketching one. It matters most
 *  here: the whole claim an EMA makes is that it turns before an SMA, and a hand-drawn pair of
 *  curves would "demonstrate" that no matter what the arithmetic actually does. */

const SMA_10 = sma(SWING_CLOSES, 10);
const EMA_10 = ema(SWING_CLOSES, 10);

/** Weighted average — linear weights, highest on the most recent close. Local to this file
 *  because no other diagram needs it. */
function wma(values: number[], period: number): (number | null)[] {
  const denom = (period * (period + 1)) / 2;
  return values.map((_, i) => {
    if (i < period - 1) return null;
    let total = 0;
    for (let k = 0; k < period; k += 1) total += values[i - period + 1 + k] * (k + 1);
    return total / denom;
  });
}
const WMA_10 = wma(SWING_CLOSES, 10);

export function SmaDiagram() {
  // The turn is at index 14 (the top). The SMA is still climbing three candles later — that lag is
  // the one thing about a simple average worth a picture.
  return (
    <IndicatorDiagram label="Moyenne mobile simple : une ligne lissée qui suit le prix avec un retard visible au sommet">
      <DiagramCandles closes={SWING_CLOSES} band={FULL_BAND} opacity={0.5} />
      <DiagramSeries values={SMA_10} band={FULL_BAND} width={2.4} />
      <text x={seriesX(9)} y={bandY(SMA_10[9] ?? 0, FULL_BAND) + 14} fontSize={9} fontWeight={700} fill="var(--lq-color-accent)">
        SMA 10
      </text>
      <DiagramCallout
        x={182}
        y={34}
        toX={seriesX(14)}
        toY={bandY(SWING_CLOSES[14], FULL_BAND)}
        text="le prix se retourne ici…"
      />
      <DiagramCallout
        x={430}
        y={176}
        anchor="end"
        toX={seriesX(17)}
        toY={bandY(SMA_10[17] ?? 0, FULL_BAND)}
        text="…la moyenne, trois bougies plus tard"
      />
    </IndicatorDiagram>
  );
}

export function EmaDiagram() {
  return (
    <IndicatorDiagram label="Moyenne mobile exponentielle comparée à la simple : elle se retourne plus tôt au sommet">
      <DiagramCandles closes={SWING_CLOSES} band={FULL_BAND} opacity={0.35} />
      <DiagramSeries values={SMA_10} band={FULL_BAND} width={1.8} color="var(--lq-color-text-muted)" dashed />
      <DiagramSeries values={EMA_10} band={FULL_BAND} width={2.4} />
      <text x={12} y={176} fontSize={9} fontWeight={700} fill="var(--lq-color-accent)">
        ■ EMA 10
      </text>
      <text x={78} y={176} fontSize={9} fontWeight={600} fill="var(--lq-color-text-muted)">
        ▫ SMA 10
      </text>
      <DiagramCallout
        x={430}
        y={30}
        anchor="end"
        toX={seriesX(16)}
        toY={bandY(EMA_10[16] ?? 0, FULL_BAND)}
        text="l'exponentielle décroche du sommet la première"
      />
    </IndicatorDiagram>
  );
}

export function WmaDiagram() {
  return (
    <IndicatorDiagram label="Moyenne mobile pondérée située entre la simple et l'exponentielle">
      <DiagramCandles closes={SWING_CLOSES} band={FULL_BAND} opacity={0.3} />
      <DiagramSeries values={SMA_10} band={FULL_BAND} width={1.6} color="var(--lq-color-text-muted)" dashed />
      <DiagramSeries values={EMA_10} band={FULL_BAND} width={1.6} color="var(--lq-color-text-muted)" opacity={0.85} />
      <DiagramSeries values={WMA_10} band={FULL_BAND} width={2.4} />
      <text x={12} y={176} fontSize={9} fontWeight={700} fill="var(--lq-color-accent)">
        ■ WMA 10
      </text>
      <text x={80} y={176} fontSize={9} fontWeight={600} fill="var(--lq-color-text-muted)">
        ▫ SMA (pointillés) · EMA (plein)
      </text>
      <DiagramCallout x={430} y={28} anchor="end" toX={seriesX(17)} toY={bandY(WMA_10[17] ?? 0, FULL_BAND)} text="la pondérée passe entre les deux" />
    </IndicatorDiagram>
  );
}

/** The volume half is the whole explanation here: the line is dragged toward the prices where the
 *  bars are tall. Two deliberately huge bars sit on the two lowest closes of the pullback. */
const VWAP_CLOSES = [26, 29, 32, 38, 44, 49, 53, 58, 62, 65, 69, 72, 75, 78, 80, 83, 85, 87, 89, 91, 92, 94];
const VWAP_VOLUMES = [4, 19, 22, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4];

function vwapOf(closes: number[], volumes: number[]): (number | null)[] {
  let pv = 0;
  let v = 0;
  return closes.map((close, i) => {
    pv += close * volumes[i];
    v += volumes[i];
    return pv / v;
  });
}
const VWAP = vwapOf(VWAP_CLOSES, VWAP_VOLUMES);

export function VwapDiagram() {
  const maxVolume = Math.max(...VWAP_VOLUMES);
  return (
    <IndicatorDiagram label="VWAP : un prix moyen tiré vers les niveaux où les volumes ont été les plus importants">
      <DiagramCandles closes={VWAP_CLOSES} band={UPPER_BAND} opacity={0.45} />
      <DiagramSeries values={VWAP} band={UPPER_BAND} width={2.4} />
      <text x={seriesX(2)} y={bandY(VWAP[2] ?? 0, UPPER_BAND) - 6} fontSize={9} fontWeight={700} fill="var(--lq-color-accent)">
        VWAP
      </text>

      <DiagramPanel band={LOWER_BAND} title="VOLUMES" />
      {VWAP_VOLUMES.map((volume, i) => {
        const height = (volume / maxVolume) * (LOWER_BAND.bottom - LOWER_BAND.top) * 0.78;
        const big = volume > 8;
        return (
          <rect
            key={i}
            x={seriesX(i) - 5}
            y={LOWER_BAND.bottom - height}
            width={10}
            height={height}
            fill={big ? "var(--lq-color-accent)" : "var(--lq-color-text-muted)"}
            opacity={big ? 0.85 : 0.4}
          />
        );
      })}
      <DiagramCallout
        x={150}
        y={134}
        toX={seriesX(2)}
        toY={LOWER_BAND.bottom - (VWAP_VOLUMES[2] / maxVolume) * (LOWER_BAND.bottom - LOWER_BAND.top) * 0.78 - 4}
        text="ces deux séances pèsent plus que les vingt autres réunies"
      />
      <DiagramCallout
        x={430}
        y={22}
        anchor="end"
        toX={seriesX(19)}
        toY={bandY(VWAP[19] ?? 0, UPPER_BAND)}
        text="le prix a doublé ; le VWAP, lui, reste au niveau réellement traité"
      />
    </IndicatorDiagram>
  );
}
