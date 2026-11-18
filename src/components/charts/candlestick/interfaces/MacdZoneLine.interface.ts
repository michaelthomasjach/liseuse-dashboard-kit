/** Les quatre lignes horizontales de l'option « Lignes des pics et des creux » du MACD : le plus haut et la moyenne des
 *  derniers pics (passages de la ligne MACD au-dessus de 0), la moyenne et le plus bas des derniers creux (passages
 *  sous 0). Réglées comme celles du RSI (`IndicatorLineStyle`). */
export type MacdZoneLineKey = "peakMax" | "peakMean" | "troughMean" | "troughMin";
