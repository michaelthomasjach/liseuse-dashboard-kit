import { DiagramImage } from "./DiagramPrimitives";
import zigzagImg from "./images/zigzag.jpg";
import supertrendImg from "./images/supertrend.jpg";
import parabolicSarImg from "./images/parabolicSar.jpg";
import ichimokuImg from "./images/ichimoku.jpg";
import chandelierExitImg from "./images/chandelierExit.jpg";

export function ZigzagDiagram() {
  return <DiagramImage src={zigzagImg} alt="Zig Zag tracé en orange, reliant les sommets et creux significatifs du prix en ignorant les mouvements mineurs" />;
}

export function SupertrendDiagram() {
  return <DiagramImage src={supertrendImg} alt="Supertrend tracé sur le prix : une ligne verte sous les bougies en tendance haussière, rouge au-dessus en tendance baissière" />;
}

export function ParabolicSarDiagram() {
  return <DiagramImage src={parabolicSarImg} alt="Parabolic SAR tracé en points sous ou au-dessus des bougies selon le sens de la tendance" />;
}

export function IchimokuDiagram() {
  return <DiagramImage src={ichimokuImg} alt="Ichimoku Kinko Hyo tracé sur le prix avec ses lignes de conversion/base et son nuage (Kumo) coloré" />;
}

export function ChandelierExitDiagram() {
  return <DiagramImage src={chandelierExitImg} alt="Chandelier Exit tracé sur le prix, un stop qui suit le plus haut (ou le plus bas) récent" />;
}
