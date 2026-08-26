import { InfoDiagram, SamplePriceLine, DiagramPoint, DiagramLabel } from "./DiagramPrimitives";

// Every diagram below anchors its own glyph to a single chart point (see DiagramPoint) — these
// tools are all "click once, place a marker" rather than a geometric shape, so what actually needs
// explaining is what the marker itself looks like, not a multi-point construction.
const ANCHOR = { x: 70, y: 70 };

export function TextDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <DiagramPoint x={ANCHOR.x} y={ANCHOR.y} />
      <text x={110} y={40} fontSize={16} fontWeight={700} fill="var(--lq-color-accent)">
        Texte libre
      </text>
    </InfoDiagram>
  );
}

export function CommentDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <DiagramPoint x={ANCHOR.x} y={ANCHOR.y} />
      <path d="M110,16 h80 v34 h-50 l-14,12 v-12 h-16 z" fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinejoin="round" />
    </InfoDiagram>
  );
}

export function NoteDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <DiagramPoint x={ANCHOR.x} y={ANCHOR.y} />
      <line x1={ANCHOR.x} y1={ANCHOR.y} x2={130} y2={30} stroke="var(--lq-color-accent)" strokeWidth={1.5} />
      <rect x={130} y={12} width={70} height={26} rx={4} fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} />
    </InfoDiagram>
  );
}

export function PriceNoteDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <DiagramPoint x={ANCHOR.x} y={ANCHOR.y} />
      <line x1={ANCHOR.x} y1={ANCHOR.y} x2={130} y2={34} stroke="var(--lq-color-accent)" strokeWidth={1.5} />
      <path d="M130,16 h56 v28 h-56 l-10,-14 z" fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinejoin="round" />
      <DiagramLabel x={198} y={34} text="Prix" color="var(--lq-color-text-muted)" anchor="end" />
    </InfoDiagram>
  );
}

export function PinDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <path
        d="M110,16 C96,16 86,26 86,40 C86,58 110,84 110,84 C110,84 134,58 134,40 C134,26 124,16 110,16 Z"
        fill="none"
        stroke="var(--lq-color-accent)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle cx={110} cy={38} r={7} fill="var(--lq-color-accent)" />
    </InfoDiagram>
  );
}

export function FlagMarkDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <line x1={90} y1={16} x2={90} y2={94} stroke="var(--lq-color-accent)" strokeWidth={2} />
      <path d="M90,16 h44 l-14,14 14,14 h-44 z" fill="var(--lq-color-accent)" opacity={0.7} />
    </InfoDiagram>
  );
}

export function SignpostDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <rect x={78} y={8} width={64} height={26} rx={4} fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} />
      <line x1={110} y1={34} x2={110} y2={80} stroke="var(--lq-color-accent)" strokeWidth={2} strokeDasharray="3 3" />
      <circle cx={110} cy={86} r={4} fill="var(--lq-color-accent)" />
    </InfoDiagram>
  );
}

export function PriceLabelDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <line x1={0} y1={44} x2={220} y2={44} stroke="var(--lq-color-text-muted)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
      <path d="M150,30 h56 v28 h-56 l-10,-14 z" fill="var(--lq-color-accent)" opacity={0.85} />
      <text x={158} y={48} fontSize={9} fontWeight={700} fill="var(--lq-color-bg)">
        128.40
      </text>
    </InfoDiagram>
  );
}

export function TableDiagram() {
  return (
    <InfoDiagram>
      <SamplePriceLine opacity={0.3} />
      <rect x={64} y={14} width={92} height={70} fill="none" stroke="var(--lq-color-accent)" strokeWidth={2} />
      <line x1={64} y1={38} x2={156} y2={38} stroke="var(--lq-color-accent)" strokeWidth={1.5} />
      <line x1={64} y1={62} x2={156} y2={62} stroke="var(--lq-color-accent)" strokeWidth={1.5} />
      <line x1={95} y1={14} x2={95} y2={84} stroke="var(--lq-color-accent)" strokeWidth={1.5} />
      <line x1={126} y1={14} x2={126} y2={84} stroke="var(--lq-color-accent)" strokeWidth={1.5} />
    </InfoDiagram>
  );
}
