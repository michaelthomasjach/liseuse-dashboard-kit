import { InfoDiagram, DiagramPoint, DiagramLabel } from "./DiagramPrimitives";

// Every Pitchfork variant is 3 parallel prongs from an anchor — only where that anchor sits
// (relative to B/C) actually changes between the four, matching the icons in icons.tsx (see
// PitchforkIcon's own doc there for the same reasoning, just bigger and lettered here).
function ForkProngs({ ay, by, cy }: { ay: number; by: number; cy: number }) {
  // The median's own far endpoint sits at the same "average of B/C, projected forward" spot
  // every variant shares — only where it starts (`ay`) actually differs between them.
  const medianEndY = (by + cy) / 2 - 14;
  return (
    <>
      <line x1={10} y1={ay} x2={210} y2={medianEndY} stroke="var(--lq-color-text-muted)" strokeWidth={1.5} strokeDasharray="3 3" />
      <line x1={30} y1={by} x2={210} y2={by - 10} stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" />
      <line x1={30} y1={cy} x2={210} y2={cy - 10} stroke="var(--lq-color-accent)" strokeWidth={2} strokeLinecap="round" />
      <DiagramPoint x={10} y={ay} label="A" />
      <DiagramPoint x={30} y={by} label="B" />
      <DiagramPoint x={30} y={cy} label="C" />
    </>
  );
}

export function PitchforkDiagram() {
  return (
    <InfoDiagram>
      <ForkProngs ay={54} by={20} cy={88} />
      <DiagramLabel x={6} y={104} text="Médiane depuis A, entre B et C" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function SchiffPitchforkDiagram() {
  return (
    <InfoDiagram>
      <ForkProngs ay={70} by={20} cy={88} />
      <DiagramLabel x={6} y={104} text="Médiane décalée vers A-B" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function ModifiedSchiffPitchforkDiagram() {
  return (
    <InfoDiagram>
      <ForkProngs ay={40} by={20} cy={88} />
      <DiagramLabel x={6} y={104} text="Médiane depuis le milieu A-B" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}

export function InsidePitchforkDiagram() {
  return (
    <InfoDiagram>
      <ForkProngs ay={54} by={20} cy={88} />
      <DiagramLabel x={6} y={104} text="Prongs depuis D et A" color="var(--lq-color-text-muted)" />
    </InfoDiagram>
  );
}
