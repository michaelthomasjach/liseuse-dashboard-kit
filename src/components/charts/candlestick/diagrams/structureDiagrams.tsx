import { DiagramImage } from "./DiagramPrimitives";
import gapsImg from "./images/gaps.jpg";
import patternRecognitionImg from "./images/patternRecognition.jpg";
import candleRecognitionImg from "./images/candleRecognition.jpg";
import pivotPointsImg from "./images/pivotPoints.jpg";
import supportResistanceImg from "./images/supportResistance.jpg";
import tpoImg from "./images/tpo.jpg";

export function GapsDiagram() {
  return <DiagramImage src={gapsImg} alt="Gaps Recognition actif sur le prix — signale par un rectangle ombré tout écart de cours non comblé entre deux bougies" />;
}

export function PatternRecognitionDiagram() {
  return (
    <DiagramImage
      src={patternRecognitionImg}
      alt="Pattern Recognition détectant plusieurs figures chartistes sur les dernières bougies (Wolfe Wave, Diamant, Tasse avec anse), chacune annotée sur le graphique"
    />
  );
}

export function CandleRecognitionDiagram() {
  return <DiagramImage src={candleRecognitionImg} alt="Candle Recognition annotant une bougie détectée comme Doji directement sur le graphique" />;
}

export function PivotPointsDiagram() {
  return <DiagramImage src={pivotPointsImg} alt="Points Pivots tracés en niveaux horizontaux sur le prix (pivot central, supports et résistances R1/S1)" />;
}

export function SupportResistanceDiagram() {
  return <DiagramImage src={supportResistanceImg} alt="Support/Résistance (auto) tracés en niveaux horizontaux sur le prix aux zones où les cours ont réagi plusieurs fois" />;
}

export function TpoDiagram() {
  return <DiagramImage src={tpoImg} alt="Profil TPO d'une poignée de séances, chaque colonne de lettres empilées montrant le temps passé à chaque niveau de prix" />;
}
