import type { IndicatorKind } from "./interfaces/IndicatorKind.interface";

/** Plain-language "how this works" text for the info icon next to each row in the "Ajouter un
 *  indicateur" picker (see IndicatorModals.tsx) — deliberately separate from indicatorCatalog.ts's
 *  own `label` (a short name) and the doc comments throughout indicators.ts (for maintainers, not
 *  end users). "custom" has no entry here — a caller's own CustomIndicatorDef is something this
 *  library knows nothing about, so its row gets no info icon at all rather than a guess. */
export const INDICATOR_DESCRIPTIONS: Partial<Record<IndicatorKind, string>> = {
  sma: "La Moyenne Mobile Simple calcule la moyenne arithmétique du prix de clôture sur les N dernières bougies (la période). Elle lisse les fluctuations pour révéler la tendance de fond — plus la période est longue, plus la moyenne réagit lentement aux mouvements récents.",
  ema: "La Moyenne Mobile Exponentielle donne plus de poids aux clôtures récentes qu'aux anciennes, contrairement à la SMA qui les traite à égalité. Elle réagit donc plus vite aux changements de tendance, au prix d'un peu plus de bruit.",
  wma: "La Moyenne Mobile Pondérée attribue un poids linéairement croissant aux clôtures les plus récentes de la période. Elle se situe entre la SMA (réactivité faible) et l'EMA (réactivité forte).",
  vwap: "Le Volume Weighted Average Price pondère chaque prix par le volume échangé à ce moment, cumulé depuis le début de la session. C'est le prix moyen réellement payé par les intervenants — souvent utilisé comme référence intrajournalière par les traders institutionnels.",
  bollinger: "Les Bandes de Bollinger tracent une moyenne mobile entourée de deux bandes situées à N écarts-types de celle-ci. Elles se resserrent quand la volatilité baisse et s'élargissent quand elle augmente, signalant les phases de compression et d'expansion du marché.",
  rsi: "Le Relative Strength Index mesure l'amplitude des hausses par rapport aux baisses sur la période, sur une échelle de 0 à 100. Au-dessus de 70, le marché est généralement considéré en surachat ; en dessous de 30, en survente.",
  chop: "Le Choppiness Index indique si le marché évolue en tendance ou en range, sur une échelle de 0 à 100. Une valeur élevée signale un marché indécis/latéral, une valeur basse un marché directionnel.",
  macd: "Le MACD (Moving Average Convergence Divergence) est la différence entre deux moyennes exponentielles (rapide et lente). Une ligne de signal (moyenne du MACD lui-même) permet de repérer les croisements, et l'histogramme visualise l'écart entre les deux.",
  zigzag: "Le Zig Zag relie les sommets et creux significatifs du prix en ignorant les mouvements inférieurs au seuil de déviation choisi. Il fait ressortir la structure de la tendance (plus hauts / plus bas) en filtrant le bruit.",
  atr: "L'Average True Range mesure l'amplitude moyenne des mouvements de prix sur la période, gaps inclus. C'est un indicateur de volatilité pure, sans indication de direction.",
  supertrend: "Le Supertrend trace une ligne au-dessus ou en dessous du prix selon la tendance en cours, calculée à partir de l'ATR. Un changement de côté de la ligne signale un retournement potentiel de tendance.",
  parabolicSar: "Le Parabolic SAR place une série de points sous le prix en tendance haussière et au-dessus en tendance baissière, en se rapprochant progressivement du prix. Le passage du prix à travers les points signale un possible retournement.",
  gaps: "Cet indicateur détecte automatiquement les écarts (gaps) entre la clôture d'une bougie et l'ouverture de la suivante, au-delà du seuil choisi. Un gap non comblé est souvent surveillé comme zone de support ou de résistance potentielle.",
  patternRecognition:
    "Cet indicateur détecte automatiquement les figures chartistes classiques (double sommet/creux, épaule-tête-épaule, triangles, drapeau, tasse avec anse, diamant, Wolfe Wave, support/résistance) sur une fenêtre récente d'au plus 20 bougies se terminant à la date limite choisie dans les paramètres (par défaut, la dernière bougie disponible).",
  candleRecognition:
    "Cet indicateur détecte automatiquement les figures de chandeliers japonais classiques (marteau, pendu, avalante, étoile du matin/soir, three inside up/down, doji…) à la date limite choisie dans les paramètres (par défaut, la dernière bougie disponible).",
  ichimoku: "L'Ichimoku Kinko Hyo combine cinq lignes (conversion, base, deux spans formant le nuage, et le chikou) pour donner en un coup d'œil la tendance, le momentum et des niveaux de support/résistance. Le nuage (kumo) est la zone comprise entre les deux spans.",
  pivotPoints: "Les Points Pivots calculent, à partir du plus haut/bas/clôture de la période de référence, une série de niveaux de support et résistance horizontaux pour la période en cours. Plusieurs formules de calcul existent (Classic, Fibonacci, Woodie, Camarilla).",
  supportResistance: "Cet indicateur détecte automatiquement les niveaux de prix les plus souvent touchés sur la fenêtre analysée, à partir des sommets et creux locaux (fractales). Plus un niveau a été touché de fois, plus il est considéré comme un support ou une résistance forte.",
  adx: "L'Average Directional Index mesure la force d'une tendance (sans indiquer sa direction), accompagné des lignes +DI et -DI qui indiquent respectivement la pression acheteuse et vendeuse. Une valeur élevée signale une tendance forte, quel que soit son sens.",
  chandelierExit: "Le Chandelier Exit place un stop suiveur sous le plus haut récent (position longue) ou au-dessus du plus bas récent (position courte), à une distance de N fois l'ATR. Il sert à protéger les gains tout en laissant courir la tendance.",
  correlation: "Cet indicateur calcule le coefficient de corrélation de Pearson glissant entre le symbole du graphique et un second symbole choisi, sur une échelle de -1 à +1. +1 signifie que les deux évoluent parfaitement ensemble, -1 qu'ils évoluent en sens opposé.",
  tpo: "Le Time Price Opportunities (Market Profile) découpe chaque séance en blocs de temps représentés par une lettre, empilée à chaque niveau de prix touché durant ce bloc. La forme obtenue fait ressortir le POC (prix le plus échangé) et la zone de valeur (Value Area).",
  freeCashFlow: "Le Free Cash Flow est la trésorerie générée par l'activité de l'entreprise, une fois les investissements (capex) déduits — l'argent réellement disponible pour rembourser la dette, verser des dividendes ou racheter des actions.",
  netIncome: "Le résultat net est le bénéfice total de l'entreprise après impôts, intérêts et toutes les charges — la ligne finale du compte de résultat.",
  totalRevenue: "Le chiffre d'affaires total (Total Revenue) est la somme des ventes de l'entreprise sur la période, avant toute déduction de charges.",
  netMargin: "La marge nette exprime le résultat net en pourcentage du chiffre d'affaires — la part de chaque euro de vente qui se transforme en bénéfice.",
  grossMargin: "La marge brute exprime la différence entre le chiffre d'affaires et le coût des biens vendus, en pourcentage du chiffre d'affaires — ce qu'il reste avant les charges d'exploitation, d'administration, etc.",
  peRatio: "Le ratio Price/Earnings (P/E) rapporte le cours de l'action au bénéfice par action. Il indique combien d'années de bénéfices actuels seraient nécessaires pour « rembourser » le prix payé — un P/E élevé reflète souvent des attentes de croissance fortes.",
  eps: "L'Earnings Per Share (bénéfice par action) est le résultat net divisé par le nombre d'actions en circulation — la part du bénéfice attribuable à chaque action.",
  debtToEquity: "Le ratio Dette/Capitaux propres (Debt/Equity) compare l'endettement total de l'entreprise à ses capitaux propres. Un ratio élevé indique un financement davantage basé sur la dette que sur les fonds propres.",
};

/** Not a real `IndicatorKind` (Volume is the caller's own data, not something computed — see
 *  `showVolumeOption`'s own doc in IndicatorModals.tsx) so it can't live in the map above, but it
 *  sits in the exact same picker list and deserves the same info icon. */
export const VOLUME_DESCRIPTION =
  "Le volume affiche, pour chaque bougie, la quantité de titres échangés durant cette période. Un volume élevé accompagnant un mouvement de prix renforce généralement la fiabilité de ce mouvement.";
