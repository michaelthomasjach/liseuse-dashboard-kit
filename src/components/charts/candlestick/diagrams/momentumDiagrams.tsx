import { DiagramImage } from "./DiagramPrimitives";
import rsiImg from "./images/rsi.jpg";
import macdImg from "./images/macd.jpg";
import adxImg from "./images/adx.jpg";

export function RsiDiagram() {
  return <DiagramImage src={rsiImg} alt="Relative Strength Index (RSI) tracé dans son propre panneau sous le prix, oscillant autour de la ligne 50" />;
}

export function MacdDiagram() {
  return <DiagramImage src={macdImg} alt="MACD tracé dans son propre panneau : la ligne MACD, sa ligne de signal et l'histogramme des écarts entre les deux" />;
}

export function AdxDiagram() {
  return <DiagramImage src={adxImg} alt="Average Directional Index (ADX) tracé dans son propre panneau avec les lignes +DI et -DI, mesurant la force de la tendance" />;
}
