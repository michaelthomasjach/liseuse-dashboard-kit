import { DiagramImage } from "./DiagramPrimitives";
import smaImg from "./images/sma.jpg";
import emaImg from "./images/ema.jpg";
import wmaImg from "./images/wma.jpg";
import vwapImg from "./images/vwap.jpg";

export function SmaDiagram() {
  return <DiagramImage src={smaImg} alt="Moyenne mobile simple (SMA) tracée en orange par-dessus les bougies, lissant le prix avec un léger retard" />;
}

export function EmaDiagram() {
  return <DiagramImage src={emaImg} alt="Moyenne mobile exponentielle (EMA) tracée en orange par-dessus les bougies, plus réactive aux derniers cours que la SMA" />;
}

export function WmaDiagram() {
  return <DiagramImage src={wmaImg} alt="Moyenne mobile pondérée (WMA) tracée en orange par-dessus les bougies" />;
}

export function VwapDiagram() {
  return <DiagramImage src={vwapImg} alt="VWAP (prix moyen pondéré par le volume) tracé en orange par-dessus les bougies" />;
}
