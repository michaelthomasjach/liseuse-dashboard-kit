import { DiagramImage } from "./DiagramPrimitives";
import bollingerImg from "./images/bollinger.jpg";
import chopImg from "./images/chop.jpg";
import atrImg from "./images/atr.jpg";

export function BollingerDiagram() {
  return <DiagramImage src={bollingerImg} alt="Bandes de Bollinger tracées en orange autour des bougies, une bande supérieure et une bande inférieure encadrant le prix" />;
}

export function ChopDiagram() {
  return <DiagramImage src={chopImg} alt="Choppiness Index (CHOP) tracé dans son propre panneau sous le prix, oscillant entre range et tendance" />;
}

export function AtrDiagram() {
  return <DiagramImage src={atrImg} alt="Average True Range (ATR) tracé dans son propre panneau sous le prix, mesurant l'amplitude moyenne des bougies" />;
}
