import type { ReactNode } from "react";
import {
  IndicatorDiagram,
  DiagramSeries,
  DiagramPanel,
  DiagramThreshold,
  DiagramCallout,
} from "./DiagramPrimitives";
import {
  UPPER_BAND,
  LOWER_BAND,
  bandY,
  seriesX,
} from "./diagramMath";

/** Correlation, plus the eight fundamentals.
 *
 *  The eight share one shape, and it is not decoration: a fundamental changes **only on a
 *  publication date** and is held flat in between. Drawing them as smooth curves — which a
 *  screenshot of a line chart does — invites exactly the misreading the prose then has to correct.
 *  So they all go through `QuarterlySteps`, which draws the hold as a flat run and puts a dot on
 *  each date where a number actually arrived. */

const QUARTERS = 8;
const QUARTER_SPAN = 48;
const QUARTER_X0 = 26;

function quarterX(i: number): number {
  return QUARTER_X0 + i * QUARTER_SPAN;
}

/** Values on the 0–100 band scale, held flat until the next publication. `zero` puts a baseline in
 *  for series that can go negative. */
function QuarterlySteps({
  values,
  band,
  color = "var(--lq-color-accent)",
  zero,
  labels,
}: {
  values: number[];
  band: { top: number; bottom: number };
  color?: string;
  zero?: number;
  labels?: (string | null)[];
}) {
  const points: string[] = [];
  values.forEach((v, i) => {
    const y = bandY(v, band).toFixed(1);
    points.push(`${quarterX(i)},${y}`);
    points.push(`${quarterX(i) + QUARTER_SPAN - 8},${y}`);
  });
  return (
    <g>
      {zero !== undefined && (
        <line x1={14} y1={bandY(zero, band)} x2={418} y2={bandY(zero, band)} stroke="var(--lq-color-border-subtle)" strokeWidth={1} />
      )}
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={quarterX(i)} cy={bandY(v, band)} r={3.2} fill={color} />
          {labels?.[i] && (
            <text x={quarterX(i)} y={bandY(v, band) - 8} textAnchor="middle" fontSize={9} fontWeight={700} fill={color}>
              {labels[i]}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

/** Every fundamental diagram is this frame plus its own series — one note under the axis, always
 *  the same one, because it is the thing every one of them has to say. */
function FundamentalDiagram({ label, title, children, note }: { label: string; title: string; children: ReactNode; note?: string }) {
  const band = { top: 40, bottom: 140 };
  return (
    <IndicatorDiagram label={label}>
      <DiagramPanel band={band} title={title} />
      {children}
      {Array.from({ length: QUARTERS }, (_, i) => (
        <text key={i} x={quarterX(i)} y={158} textAnchor="middle" fontSize={8.5} fontWeight={600} fill="var(--lq-color-text-muted)">
          {`T${(i % 4) + 1}`}
        </text>
      ))}
      <text x={220} y={180} textAnchor="middle" fontSize={9.5} fontWeight={600} fill="var(--lq-color-text-muted)">
        {note ?? "La valeur ne change qu'aux dates de publication : entre deux, elle est maintenue."}
      </text>
    </IndicatorDiagram>
  );
}

/** Correlation is not a fundamental, but it shares the panel treatment. Two price lines above —
 *  one mirroring the other — and the coefficient below, crossing zero when the mirror breaks. */
const CORR_A = [40, 46, 42, 52, 58, 54, 62, 68, 64, 70, 66, 60, 56, 50, 54, 60, 66, 62, 70, 74, 70, 78];
/** The mirror of CORR_A for eleven bars, then six points under it — exactly opposed, then exactly
 *  solidaire, which is the transition the coefficient below is measuring. */
const CORR_B = [70, 64, 68, 58, 52, 56, 48, 42, 46, 40, 44, 54, 50, 44, 48, 54, 60, 56, 64, 68, 64, 72];
const CORR_VALUES = [-78, -82, -85, -88, -86, -90, -88, -84, -80, -70, -50, -20, 10, 40, 62, 75, 82, 86, 84, 88, 86, 90];

export function CorrelationDiagram() {
  return (
    <IndicatorDiagram label="Corrélation : deux instruments d'abord opposés, puis solidaires — le coefficient traverse zéro au moment où le lien s'inverse">
      <DiagramSeries values={CORR_A} band={UPPER_BAND} width={2} />
      <DiagramSeries values={CORR_B} band={UPPER_BAND} width={2} color="var(--lq-color-text-muted)" dashed />
      <text x={12} y={12} fontSize={9} fontWeight={700} fill="var(--lq-color-accent)">
        ■ symbole affiché
      </text>
      <text x={106} y={12} fontSize={9} fontWeight={600} fill="var(--lq-color-text-muted)">
        ▫ symbole de comparaison
      </text>

      <DiagramPanel band={LOWER_BAND} title="CORRÉLATION" />
      {/* The coefficient runs −100…+100 here; the band maps 0–100, so it is re-centred. */}
      <DiagramThreshold value={50} band={LOWER_BAND} label="0" color="var(--lq-color-border-subtle)" dashed={false} />
      <DiagramThreshold value={100} band={LOWER_BAND} label="+1" />
      <DiagramThreshold value={0} band={LOWER_BAND} label="−1" />
      <DiagramSeries values={CORR_VALUES.map((v) => 50 + v / 2)} band={LOWER_BAND} width={2.2} />
      <DiagramCallout x={44} y={134} toX={seriesX(3)} toY={bandY(50 + CORR_VALUES[3] / 2, LOWER_BAND)} text="ils vont en sens inverse" />
      <DiagramCallout x={400} y={168} anchor="end" toX={seriesX(17)} toY={bandY(50 + CORR_VALUES[17] / 2, LOWER_BAND)} text="désormais ils bougent ensemble : une seule position prise deux fois" />
    </IndicatorDiagram>
  );
}

export function FreeCashFlowDiagram() {
  const values = [58, 44, 30, 22, 36, 52, 66, 78];
  return (
    <FundamentalDiagram
      label="Flux de trésorerie disponible par trimestre, dont un passage sous zéro pendant une phase d'investissement"
      title="FREE CASH FLOW"
      note="Un flux négatif pendant une phase d'investissement n'est pas un mauvais signe en soi."
    >
      <QuarterlySteps values={values} band={{ top: 40, bottom: 140 }} zero={30} />
      <DiagramCallout x={430} y={30} anchor="end" toX={quarterX(3)} toY={bandY(22, { top: 40, bottom: 140 })} text="négatif : l'entreprise investit plus qu'elle n'encaisse" />
    </FundamentalDiagram>
  );
}

export function NetIncomeDiagram() {
  const values = [34, 42, 38, 52, 60, 30, 66, 74];
  return (
    <FundamentalDiagram label="Bénéfice net par trimestre, avec un trimestre creusé par un élément exceptionnel" title="BÉNÉFICE NET">
      <QuarterlySteps values={values} band={{ top: 40, bottom: 140 }} />
      <DiagramCallout x={430} y={30} anchor="end" toX={quarterX(5)} toY={bandY(30, { top: 40, bottom: 140 })} text="élément exceptionnel : l'activité, elle, n'a pas changé" />
    </FundamentalDiagram>
  );
}

export function TotalRevenueDiagram() {
  const values = [30, 38, 46, 44, 54, 62, 70, 80];
  const band = { top: 40, bottom: 140 };
  return (
    <FundamentalDiagram label="Chiffre d'affaires par trimestre, en progression régulière" title="CHIFFRE D'AFFAIRES">
      {values.map((v, i) => (
        <rect
          key={i}
          x={quarterX(i) - 14}
          y={bandY(v, band)}
          width={28}
          height={band.bottom - bandY(v, band)}
          fill="var(--lq-color-accent)"
          opacity={0.35}
        />
      ))}
      <QuarterlySteps values={values} band={band} />
      <DiagramCallout x={430} y={30} anchor="end" toX={quarterX(7)} toY={bandY(80, band)} text="ce qui compte est la croissance, pas le niveau" />
    </FundamentalDiagram>
  );
}

export function NetMarginDiagram() {
  const revenue = [30, 40, 50, 58, 66, 74, 82, 90];
  const margin = [60, 58, 56, 52, 46, 40, 34, 28];
  const band = { top: 40, bottom: 140 };
  return (
    <FundamentalDiagram
      label="Marge nette qui recule alors que le chiffre d'affaires progresse : une croissance achetée"
      title="MARGE NETTE"
      note="Croissance en hausse et marge en baisse : l'entreprise achète sa croissance."
    >
      <QuarterlySteps values={revenue} band={band} color="var(--lq-color-text-muted)" />
      <QuarterlySteps values={margin} band={band} />
      <text x={14} y={24} fontSize={9} fontWeight={700} fill="var(--lq-color-accent)">
        ■ marge nette
      </text>
      <text x={96} y={24} fontSize={9} fontWeight={600} fill="var(--lq-color-text-muted)">
        ▫ chiffre d&apos;affaires
      </text>
    </FundamentalDiagram>
  );
}

export function GrossMarginDiagram() {
  const gross = [76, 78, 75, 77, 76, 78, 77, 79];
  const net = [38, 42, 36, 40, 34, 44, 38, 42];
  const band = { top: 40, bottom: 140 };
  return (
    <FundamentalDiagram
      label="Marge brute, stable et haute, comparée à la marge nette qui varie davantage en dessous"
      title="MARGE BRUTE"
      note="La brute est plus stable : elle ignore le financement et la fiscalité."
    >
      <QuarterlySteps values={net} band={band} color="var(--lq-color-text-muted)" />
      <QuarterlySteps values={gross} band={band} />
      <text x={14} y={24} fontSize={9} fontWeight={700} fill="var(--lq-color-accent)">
        ■ marge brute
      </text>
      <text x={96} y={24} fontSize={9} fontWeight={600} fill="var(--lq-color-text-muted)">
        ▫ marge nette
      </text>
    </FundamentalDiagram>
  );
}

export function PeRatioDiagram() {
  const values = [42, 46, 44, 50, 88, 52, 48, 54];
  return (
    <FundamentalDiagram
      label="PER par trimestre, avec une envolée provoquée par un bénéfice proche de zéro"
      title="PER"
      note="Un bénéfice proche de zéro fait exploser le ratio sans rien dire de l'entreprise."
    >
      <QuarterlySteps values={values} band={{ top: 40, bottom: 140 }} />
      <DiagramCallout x={430} y={30} anchor="end" toX={quarterX(4)} toY={bandY(88, { top: 40, bottom: 140 })} text="bénéfice quasi nul : le ratio s'emballe" />
    </FundamentalDiagram>
  );
}

export function EpsDiagram() {
  const values = [34, 40, 38, 44, 48, 68, 72, 78];
  return (
    <FundamentalDiagram
      label="Bénéfice par action par trimestre, avec un saut dû à un rachat d'actions plutôt qu'à un bénéfice plus élevé"
      title="BÉNÉFICE PAR ACTION"
      note="Il peut progresser sans que l'entreprise gagne davantage."
    >
      <QuarterlySteps values={values} band={{ top: 40, bottom: 140 }} />
      <DiagramCallout x={430} y={30} anchor="end" toX={quarterX(5)} toY={bandY(68, { top: 40, bottom: 140 })} text="rachat d'actions : moins d'actions, même bénéfice" />
    </FundamentalDiagram>
  );
}

export function DebtToEquityDiagram() {
  const values = [30, 36, 42, 48, 56, 66, 72, 80];
  const band = { top: 40, bottom: 140 };
  return (
    <FundamentalDiagram
      label="Ratio d'endettement en progression, comparé à une référence sectorielle"
      title="DETTE / CAPITAUX PROPRES"
      note="Il se compare au secteur : une même valeur est normale ici et alarmante ailleurs."
    >
      <line x1={14} y1={bandY(60, band)} x2={418} y2={bandY(60, band)} stroke="var(--lq-color-text-muted)" strokeWidth={1.4} strokeDasharray="5 4" />
      <text x={16} y={bandY(60, band) - 5} fontSize={9} fontWeight={600} fill="var(--lq-color-text-muted)">
        médiane du secteur
      </text>
      <QuarterlySteps values={values} band={band} />
    </FundamentalDiagram>
  );
}
