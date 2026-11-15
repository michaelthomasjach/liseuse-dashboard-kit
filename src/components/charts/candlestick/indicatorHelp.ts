import type { IndicatorKind } from "./interfaces/IndicatorKind.interface";
import { INDICATOR_CATALOG, type IndicatorCatalogEntry } from "./indicatorCatalog";
import { INDICATOR_DESCRIPTIONS } from "./indicatorDescriptions";
import { INDICATOR_SCRIPT_SOURCES } from "./indicatorScriptSources";

/** Un réglage d'un indicateur, tel que la fenêtre de paramètres le montre : son nom à l'écran, sa
 *  valeur par défaut et ses bornes (celles des champs de `IndicatorSettingsFields`). */
export interface IndicatorHelpParam {
  label: string;
  defaultValue: string;
  /** Bornes du champ (« 1 à 500 »), absentes pour une case à cocher ou une liste. */
  range?: string;
  description: string;
  /** Onglet de la fenêtre de paramètres où il se trouve. */
  tab?: "Entrées" | "Style";
}

/** Ce que la page d'aide ajoute à la description de l'indicateur (`INDICATOR_DESCRIPTIONS`) : la
 *  formule exacte, les réglages et les indicateurs voisins. Rédigé contre le code de calcul
 *  (indicators.ts, patternRecognition.ts, candleRecognition.ts, chartModes.ts et les calculs de
 *  `technicalindicators` qu'indicators.ts appelle) : une formule qui s'écarterait du calcul réel
 *  serait pire que pas de formule du tout. */
export interface IndicatorHelpDetails {
  /** Les étapes du calcul, une par ligne, en notation courte (C clôture, O ouverture, H plus haut,
   *  L plus bas, V volume, N période, t la bougie courante). */
  formula: string[];
  /** Précisions sur le calcul (amorçage, cas limites), dans le petit dialecte d'`InfoText`. */
  formulaNotes?: string;
  params: IndicatorHelpParam[];
  related: IndicatorKind[];
}

/** Une page d'aide complète, prête à afficher : le catalogue, la description découpée en parties et
 *  les détails ci-dessus. */
export interface IndicatorHelpPage extends IndicatorHelpDetails {
  kind: IndicatorKind;
  label: string;
  shortLabel: string;
  category: string;
  pane: IndicatorCatalogEntry["pane"];
  /** Premier paragraphe(s) de la description : ce qu'est l'indicateur. */
  definition: string;
  /** Les parties de lecture (« Comment il se lit », « Les critères, chiffrés »…), dans l'ordre. */
  reading: { title: string; body: string }[];
  /** La partie « Ce qu'il ne dit pas ». */
  limits: string | null;
  /** La partie « Réglages » / « Affichage » de la description, reprise sous le tableau des réglages. */
  settingsNotes: string | null;
  /** Le script équivalent (`INDICATOR_SCRIPT_SOURCES`), absent quand l'API ne permet pas de le
   *  réécrire fidèlement. */
  script: string | null;
}

const FUNDAMENTAL_PARAMS: IndicatorHelpParam[] = [
  {
    label: "Affichage",
    defaultValue: "Valeur",
    description: "« Valeur » trace le chiffre publié ; « Variation sur 1 an (%) » trace sa variation par rapport à la publication d'au moins un an plus tôt.",
    tab: "Entrées",
  },
  { label: "Style", defaultValue: "Ligne", description: "Ligne, palier ou aire.", tab: "Style" },
  { label: "Format des valeurs", defaultValue: "Automatique", description: "Unité de l'axe et de la légende (k / M / B, entier, décimales, pourcentage, brut).", tab: "Style" },
];

const FUNDAMENTAL_NOTES = `Ce chiffre n'est **pas calculé par le graphique** : il est fourni par l'application, à chaque date de publication. La formule ci-dessus en donne la définition comptable.

Entre deux publications, la dernière valeur connue est **reportée sur chaque bougie**, d'où le tracé en escalier ; rien n'est tracé avant la première publication.

En **variation sur 1 an** : 100 × (valeur − valeur publiée au moins 365 jours plus tôt) / cette valeur antérieure. Pas de variation quand la valeur antérieure est nulle ou négative (le pourcentage n'aurait pas de sens).`;

const FUNDAMENTAL_RELATED: IndicatorKind[] = ["totalRevenue", "netIncome", "netMargin", "grossMargin", "freeCashFlow", "eps", "peRatio", "debtToEquity"];

function fundamental(formula: string[], self: IndicatorKind): IndicatorHelpDetails {
  return { formula, formulaNotes: FUNDAMENTAL_NOTES, params: FUNDAMENTAL_PARAMS, related: FUNDAMENTAL_RELATED.filter((k) => k !== self).slice(0, 4) };
}

const PERIOD = (def: number, description: string): IndicatorHelpParam => ({ label: "Période", defaultValue: String(def), range: "1 à 500", description, tab: "Entrées" });

export const INDICATOR_HELP_DETAILS: Partial<Record<IndicatorKind, IndicatorHelpDetails>> = {
  sma: {
    formula: ["SMA(t) = (C(t) + C(t−1) + … + C(t−N+1)) / N"],
    formulaNotes: "Chaque clôture de la fenêtre pèse 1/N. La première valeur apparaît à la **Nᵉ bougie** de l'historique chargé.",
    params: [PERIOD(20, "Nombre de clôtures moyennées.")],
    related: ["ema", "wma", "bollinger", "vwap"],
  },
  ema: {
    formula: ["k = 2 / (N + 1)", "EMA(N) = moyenne simple des N premières clôtures", "EMA(t) = k × C(t) + (1 − k) × EMA(t−1)"],
    formulaNotes:
      "Le calcul part de la **première bougie chargée** : la toute première valeur est une moyenne simple, puis chaque clôture est ajoutée avec le poids k. L'effet de cet amorçage s'efface au fil des bougies, mais deux historiques de longueurs différentes peuvent donner des valeurs très légèrement différentes au début.",
    params: [PERIOD(20, "Fixe le coefficient de lissage k = 2 / (N + 1).")],
    related: ["sma", "wma", "macd"],
  },
  wma: {
    formula: ["WMA(t) = (1 × C(t−N+1) + 2 × C(t−N+2) + … + N × C(t)) / (N × (N + 1) / 2)"],
    formulaNotes: "La clôture la plus récente pèse N fois plus que la plus ancienne. Première valeur à la **Nᵉ bougie**.",
    params: [PERIOD(20, "Nombre de clôtures pondérées.")],
    related: ["sma", "ema"],
  },
  vwap: {
    formula: ["Prix typique TP(i) = (H(i) + L(i) + C(i)) / 3", "VWAP(t) = Σ TP(i) × V(i) / Σ V(i), sommes de la première bougie chargée jusqu'à t"],
    formulaNotes:
      "Le cumul commence à la **première bougie de l'historique chargé** et n'est jamais remis à zéro (ni par séance, ni par jour). Sans volume, le quotient n'est pas défini et rien n'est tracé.",
    params: [],
    related: ["sma", "tpo"],
  },
  bollinger: {
    formula: [
      "Médiane(t) = SMA(N) des clôtures",
      "σ(t) = √( Σ (C(i) − Médiane(t))² / N ), sur les N dernières clôtures",
      "Bande haute = Médiane + k × σ",
      "Bande basse = Médiane − k × σ",
    ],
    formulaNotes: "σ est l'écart-type **de population** (division par N, pas par N − 1). Première valeur à la Nᵉ bougie.",
    params: [
      PERIOD(20, "Fenêtre de la moyenne et de l'écart-type."),
      { label: "Écart-type (bandes)", defaultValue: "2", range: "0,5 à 5", description: "Le multiplicateur k : distance des bandes à la médiane, en écarts-types.", tab: "Entrées" },
    ],
    related: ["sma", "atr", "chop"],
  },
  rsi: {
    formula: [
      "Gain(t) = max(C(t) − C(t−1), 0) ; Perte(t) = max(C(t−1) − C(t), 0)",
      "MoyG, MoyP initiales = moyenne simple des N premiers gains et des N premières pertes",
      "MoyG(t) = (MoyG(t−1) × (N − 1) + Gain(t)) / N, idem pour MoyP (lissage de Wilder)",
      "RS = MoyG / MoyP ; RSI = 100 − 100 / (1 + RS)",
    ],
    formulaNotes:
      "Il faut **N + 1 clôtures** pour la première valeur. RSI = 100 quand la moyenne des pertes est nulle, 0 quand celle des gains l'est. La valeur est arrondie à deux décimales.",
    params: [
      PERIOD(14, "Longueur du lissage des gains et des pertes."),
      { label: "Seuil de surachat", defaultValue: "70", range: "50 à 99", description: "Ligne horizontale haute du panneau. N'entre pas dans le calcul.", tab: "Entrées" },
      { label: "Seuil de survente", defaultValue: "30", range: "1 à 50", description: "Ligne horizontale basse du panneau. N'entre pas dans le calcul.", tab: "Entrées" },
    ],
    related: ["macd", "chop", "adx"],
  },
  chop: {
    formula: [
      "TR(t) = max(H(t) − L(t), |H(t) − C(t−1)|, |L(t) − C(t−1)|) ; pour la première bougie, H − L",
      "CHOP(t) = 100 × log10( Σ TR sur N / (plus haut des H sur N − plus bas des L sur N) ) / log10(N)",
    ],
    formulaNotes: "Première valeur à la Nᵉ bougie. Pas de valeur quand la fenêtre n'a aucune amplitude (plus haut = plus bas). La période doit valoir au moins 2 (log10(1) = 0).",
    params: [
      PERIOD(14, "Fenêtre des sommes et des extrêmes."),
      { label: "Seuil haut (marché indécis)", defaultValue: "61,8", range: "50 à 99", description: "Ligne horizontale du panneau.", tab: "Entrées" },
      { label: "Seuil bas (marché directionnel)", defaultValue: "38,2", range: "1 à 50", description: "Ligne horizontale du panneau.", tab: "Entrées" },
    ],
    related: ["adx", "atr", "bollinger"],
  },
  macd: {
    formula: ["MACD(t) = EMA(rapide)(t) − EMA(lente)(t), sur les clôtures", "Signal(t) = EMA(signal) de la ligne MACD", "Histogramme(t) = MACD(t) − Signal(t)"],
    formulaNotes:
      "Les trois moyennes sont **exponentielles**, amorcées sur une moyenne simple comme l'EMA. La ligne MACD apparaît une fois la moyenne lente amorcée ; le signal et l'histogramme, après la période du signal en plus.",
    params: [
      { label: "Rapide", defaultValue: "12", range: "1 à 200", description: "Période de l'EMA rapide.", tab: "Entrées" },
      { label: "Lent", defaultValue: "26", range: "1 à 400", description: "Période de l'EMA lente.", tab: "Entrées" },
      { label: "Signal", defaultValue: "9", range: "1 à 200", description: "Période de l'EMA de la ligne MACD.", tab: "Entrées" },
      { label: "Afficher l'histogramme", defaultValue: "Oui", description: "Barres de l'écart MACD − signal, avec leurs couleurs.", tab: "Style" },
    ],
    related: ["ema", "rsi", "adx"],
  },
  zigzag: {
    formula: [
      "s = déviation / 100 (au moins 0,01 %)",
      "Un sommet provisoire M est confirmé dès qu'une clôture C vérifie (M − C) / M ≥ s",
      "Un creux provisoire m est confirmé dès qu'une clôture C vérifie (C − m) / m ≥ s",
      "Après un sommet confirmé, on cherche un creux, et inversement",
      "HH / LH : sommet plus haut / plus bas que le sommet confirmé précédent ; HL / LL : creux plus haut / plus bas que le creux précédent",
    ],
    formulaNotes: "Calcul sur les **clôtures**, pas sur les mèches. La jambe en cours, pas encore confirmée, n'est pas tracée.",
    params: [
      { label: "Déviation (%)", defaultValue: "5", range: "0,5 à 50", description: "Retournement minimal, en pourcentage, pour confirmer un pivot.", tab: "Entrées" },
      { label: "Afficher les labels HH / HL / LH / LL", defaultValue: "Oui", description: "Étiquette de chaque pivot confirmé.", tab: "Style" },
    ],
    related: ["supportResistance", "patternRecognition", "pivotPoints"],
  },
  atr: {
    formula: [
      "TR(t) = max(H(t) − L(t), |H(t) − C(t−1)|, |L(t) − C(t−1)|), à partir de la 2ᵉ bougie",
      "ATR initial = moyenne simple des N premiers TR",
      "ATR(t) = ATR(t−1) + (TR(t) − ATR(t−1)) / N (lissage de Wilder)",
      "En % du prix : 100 × ATR(t) / C(t)",
    ],
    formulaNotes: "La première valeur arrive à la bougie N + 1 (le premier TR a besoin d'une clôture précédente).",
    params: [
      PERIOD(14, "Longueur du lissage de Wilder."),
      { label: "Afficher en % du prix", defaultValue: "Non", description: "Rapporte chaque valeur à la clôture de sa bougie, pour comparer des instruments entre eux.", tab: "Style" },
    ],
    related: ["supertrend", "chandelierExit", "bollinger", "chop"],
  },
  supertrend: {
    formula: [
      "Milieu(t) = (H(t) + L(t)) / 2 ; ATR(t) sur N périodes (voir ATR)",
      "Haute de base = Milieu + m × ATR ; basse de base = Milieu − m × ATR",
      "Haute finale = haute de base si elle est sous la haute finale précédente ou si C(t−1) > haute finale précédente ; sinon la précédente",
      "Basse finale = basse de base si elle est au-dessus de la basse finale précédente ou si C(t−1) < basse finale précédente ; sinon la précédente",
      "Tendance : devient baissière si C(t) < basse finale, haussière si C(t) > haute finale, sinon inchangée",
      "Ligne tracée = basse finale en tendance haussière, haute finale en tendance baissière",
    ],
    formulaNotes: "À la première bougie calculée, la tendance est haussière si la clôture est au-dessus de la bande basse.",
    params: [
      PERIOD(10, "Période de l'ATR."),
      { label: "Multiplicateur (× ATR)", defaultValue: "3", range: "0,5 à 10", description: "Distance des bandes au milieu de la bougie, en ATR.", tab: "Entrées" },
      { label: "Couleurs haussière / baissière", defaultValue: "Couleurs de hausse et de baisse du graphique", description: "Une couleur par sens.", tab: "Style" },
    ],
    related: ["atr", "chandelierExit", "parabolicSar"],
  },
  parabolicSar: {
    formula: [
      "SAR(t) = SAR(t−1) + AF × (EP − SAR(t−1))",
      "EP = extrême de la tendance en cours : plus haut atteint en hausse, plus bas en baisse",
      "AF part du pas, augmente du pas à chaque nouvel extrême, sans dépasser le max",
      "En hausse, le SAR est ramené sous le plus bas des deux bougies précédentes ; en baisse, au-dessus de leur plus haut",
      "Si L(t) passe sous le SAR (en hausse) ou H(t) au-dessus (en baisse) : retournement, SAR = EP, AF = pas",
    ],
    formulaNotes: "Seuls les plus hauts et les plus bas entrent dans le calcul. La série démarre en tendance haussière, avec le plus bas de la première bougie comme premier SAR.",
    params: [
      { label: "Pas", defaultValue: "0,02", range: "0,01 à 1", description: "Valeur de départ et incrément du facteur d'accélération AF.", tab: "Entrées" },
      { label: "Max", defaultValue: "0,2", range: "0,05 à 1", description: "Plafond du facteur d'accélération.", tab: "Entrées" },
      { label: "Couleurs haussière / baissière", defaultValue: "Couleurs de hausse et de baisse du graphique", description: "Une couleur par sens.", tab: "Style" },
    ],
    related: ["supertrend", "chandelierExit", "adx"],
  },
  gaps: {
    formula: [
      "Gap haussier en t : L(t) > H(t−1) et (L(t) − H(t−1)) / H(t−1) ≥ seuil",
      "Gap baissier en t : H(t) < L(t−1) et (L(t−1) − H(t)) / L(t−1) ≥ seuil",
      "Zone vide : de H(t−1) à L(t) (haussier), de H(t) à L(t−1) (baissier)",
      "Comblé à la première bougie suivante dont la plage [L, H] recoupe la zone ; sinon la zone court jusqu'à la dernière bougie",
    ],
    params: [{ label: "Écart minimum (%)", defaultValue: "0,1", range: "0 à 20", description: "Taille minimale du vide, en pourcentage du prix de la bougie précédente.", tab: "Entrées" }],
    related: ["supportResistance", "pivotPoints", "candleRecognition"],
  },
  patternRecognition: {
    formula: [
      "Fenêtre : au plus les 20 bougies qui finissent à la date limite",
      "Pivot : bougie dont le plus haut (ou le plus bas) dépasse strictement celui de ses deux voisines immédiates",
      "Double sommet / creux : deux pivots à moins de 1,5 % l'un de l'autre, séparés par un creux (un sommet) d'au moins 2 %",
      "Épaule-tête-épaule : tête au moins 1 % au-delà des deux épaules, épaules à moins de 3 % l'une de l'autre",
      "Triangles : pentes des droites premier → dernier sommet et premier → dernier creux, « plate » sous 0,15 % du dernier cours par bougie",
      "Drapeau : mouvement de la 1ʳᵉ moitié ≥ 3 × l'amplitude moyenne de ses bougies, amplitude de la 2ᵉ moitié < la moitié de ce mouvement",
      "Tasse avec anse : rebord à moins de 5 % du départ, anse qui reprend au plus la moitié de la profondeur de la tasse",
      "Losange : amplitude des oscillations qui s'élargit de plus de 15 %, puis se resserre de plus de 15 %",
      "Supports et résistances : pivots regroupés quand ils sont à moins de 2 % de l'étendue des pivots",
    ],
    formulaNotes: "Chaque famille est testée séparément ; la vague de Wolfe est cherchée sur cinq pivots successifs alternant sommets et creux, chaque extrême dépassant le précédent de même nature.",
    params: [{ label: "Date limite", defaultValue: "Dernière bougie", description: "Fin de la fenêtre analysée ; sans date, elle suit la dernière bougie.", tab: "Entrées" }],
    related: ["candleRecognition", "supportResistance", "zigzag"],
  },
  candleRecognition: {
    formula: [
      "Corps = |C − O| ; amplitude = H − L ; mèches = H − max(O, C) et min(O, C) − L",
      "Tendance précédente : C(t−1) − C(t−5), haussière au-delà de +0,1 % de C(t−5), baissière en deçà de −0,1 %",
      "Étoile du matin / du soir : 1ʳᵉ bougie de corps > 50 % de son amplitude ; 2ᵉ de corps < 30 % de la plus petite amplitude des deux autres ; 3ᵉ de couleur opposée clôturant au-delà du milieu du corps de la 1ʳᵉ",
      "Three inside up / down : corps de la 2ᵉ contenu dans celui de la 1ʳᵉ ; 3ᵉ clôturant au-delà de l'ouverture de la 1ʳᵉ",
      "Avalante : bougie de couleur opposée, de corps plus grand, qui ouvre et clôture au-delà du corps précédent",
      "Marteau / pendu : corps ≤ 35 % de l'amplitude, mèche basse ≥ 2 × corps, mèche haute ≤ corps / 2 (marteau inversé / étoile filante : mèches inversées)",
      "Marteau et marteau inversé après une baisse ; pendu et étoile filante après une hausse ; rien en tendance plate",
      "Doji : corps ≤ 10 % de l'amplitude",
    ],
    formulaNotes: "Ordre des tests : étoile, three inside, avalante, marteaux, doji. **Une seule figure** est retenue, à la date limite.",
    params: [{ label: "Date limite", defaultValue: "Dernière bougie", description: "La bougie analysée ; sans date, la dernière.", tab: "Entrées" }],
    related: ["patternRecognition", "gaps"],
  },
  ichimoku: {
    formula: [
      "Milieu(p) = (plus haut des H + plus bas des L sur p bougies) / 2",
      "Tenkan = Milieu(conversion) ; Kijun = Milieu(base)",
      "Senkou A = (Tenkan + Kijun) / 2, tracé « déplacement » bougies plus loin",
      "Senkou B = Milieu(span B), tracé « déplacement » bougies plus loin",
      "Chikou = clôture, tracée « déplacement » bougies plus tôt",
    ],
    formulaNotes:
      "Le nuage est tracé sur l'historique, à la place que lui donne le décalage ; la partie qui tomberait **au-delà de la dernière bougie** (le nuage « futur ») n'est pas dessinée.",
    params: [
      { label: "Conversion", defaultValue: "9", range: "1 à 100", description: "Période de la Tenkan.", tab: "Entrées" },
      { label: "Base", defaultValue: "26", range: "1 à 200", description: "Période de la Kijun.", tab: "Entrées" },
      { label: "Span B", defaultValue: "52", range: "1 à 300", description: "Période de la Senkou B.", tab: "Entrées" },
      { label: "Déplacement", defaultValue: "26", range: "1 à 200", description: "Décalage du nuage vers l'avant et de la Chikou vers l'arrière.", tab: "Entrées" },
    ],
    related: ["sma", "supertrend", "adx"],
  },
  pivotPoints: {
    formula: [
      "H, L, C : plus haut, plus bas et dernière clôture de la période précédente ; R = H − L",
      "Classic : PP = (H + L + C) / 3 ; R1 = 2PP − L ; S1 = 2PP − H ; R2 = PP + R ; S2 = PP − R ; R3 = H + 2(PP − L) ; S3 = L − 2(H − PP)",
      "Fibonacci : PP = (H + L + C) / 3 ; R1/S1 = PP ± 0,382R ; R2/S2 = PP ± 0,618R ; R3/S3 = PP ± R",
      "Woodie : PP = (H + L + 2C) / 4, puis les niveaux de Classic",
      "Camarilla : R1/S1 = C ± 1,1R / 12 ; R2/S2 = C ± 1,1R / 6 ; R3/S3 = C ± 1,1R / 4 (PP = (H + L + C) / 3)",
    ],
    formulaNotes:
      "Les niveaux restent constants sur toute la période en cours. La semaine commence le lundi, le mois au 1ᵉʳ, en heure UTC. La première période de l'historique n'a pas de période précédente : rien n'y est tracé.",
    params: [
      { label: "Type", defaultValue: "Classic", description: "Classic, Fibonacci, Woodie ou Camarilla.", tab: "Entrées" },
      { label: "Période de référence", defaultValue: "Hebdomadaire", description: "Journalière, hebdomadaire ou mensuelle.", tab: "Entrées" },
      { label: "Afficher uniquement le dernier pivot", defaultValue: "Non", description: "Ne garde que la grille de la période en cours.", tab: "Style" },
    ],
    related: ["supportResistance", "gaps", "tpo"],
  },
  supportResistance: {
    formula: [
      "Fenêtre : les max(10, N) dernières bougies",
      "Extrême local : H (ou L) strictement au-dessus (au-dessous) de celui des 3 bougies de chaque côté",
      "Extrêmes triés par prix ; nouveau groupe dès que l'écart au précédent dépasse 1 % de l'amplitude de la fenêtre",
      "Niveau = prix moyen du groupe ; touches = nombre d'extrêmes du groupe",
      "Groupes d'au moins 2 touches, classés par nombre de touches ; les K premiers sont tracés",
    ],
    formulaNotes: "Les 3 dernières bougies ne peuvent pas encore être des extrêmes : il leur manque des voisines à droite.",
    params: [
      PERIOD(100, "Nombre de bougies analysées (10 au minimum)."),
      { label: "Nombre de niveaux", defaultValue: "6", range: "1 à 20", description: "K : niveaux gardés, les plus touchés d'abord.", tab: "Entrées" },
    ],
    related: ["pivotPoints", "zigzag", "patternRecognition"],
  },
  adx: {
    formula: [
      "+DM(t) = H(t) − H(t−1) si cette hausse est positive et dépasse L(t−1) − L(t), sinon 0 ; −DM symétrique",
      "TR, +DM et −DM lissés (Wilder) : S = somme des N premiers, puis S(t) = S(t−1) − S(t−1) / N + valeur(t)",
      "+DI = 100 × +DM lissé / TR lissé ; −DI = 100 × −DM lissé / TR lissé",
      "DX = 100 × |+DI − −DI| / (+DI + −DI)",
      "ADX = moyenne de Wilder de DX sur N (amorcée par la moyenne simple des N premiers DX)",
    ],
    formulaNotes: "+DI et −DI apparaissent après N + 1 bougies ; l'ADX, lissé une seconde fois, après environ 2N.",
    params: [
      PERIOD(14, "Période des lissages."),
      { label: "Seuil de tendance forte", defaultValue: "25", range: "5 à 60", description: "Ligne horizontale du panneau.", tab: "Entrées" },
      { label: "Couleurs +DI / −DI", defaultValue: "Couleurs de hausse et de baisse du graphique", description: "Couleurs des deux lignes directionnelles.", tab: "Style" },
    ],
    related: ["chop", "atr", "macd", "parabolicSar"],
  },
  chandelierExit: {
    formula: [
      "A(t) = m × ATR(t) sur N périodes",
      "Stop long brut = plus haut sur N (des clôtures, ou des plus hauts) − A",
      "Stop court brut = plus bas sur N (des clôtures, ou des plus bas) + A",
      "Stop long = max(brut, stop long précédent) si C(t−1) > stop long précédent, sinon le brut",
      "Stop court = min(brut, stop court précédent) si C(t−1) < stop court précédent, sinon le brut",
      "Sens : long si C(t) > stop court précédent, court si C(t) < stop long précédent, sinon inchangé",
    ],
    formulaNotes: "Un changement de sens donne un signal **Achat** (vers long) ou **Vente** (vers court). Adapté du script Pine « Chandelier Exit ».",
    params: [
      PERIOD(22, "Période de l'ATR et des extrêmes."),
      { label: "Multiplicateur ATR", defaultValue: "3", range: "0,5 à 10", description: "m : distance des stops aux extrêmes, en ATR.", tab: "Entrées" },
      { label: "Utiliser le prix de clôture pour les extrêmes", defaultValue: "Oui", description: "Décoché : les plus hauts et plus bas des mèches.", tab: "Entrées" },
      { label: "Afficher les labels Achat/Vente", defaultValue: "Oui", description: "Étiquette à chaque changement de sens.", tab: "Style" },
      { label: "Surligner l'état (remplissage)", defaultValue: "Oui", description: "Remplit la zone entre le prix et le stop actif.", tab: "Style" },
    ],
    related: ["supertrend", "atr", "parabolicSar"],
  },
  correlation: {
    formula: [
      "B(t) = clôture du symbole de comparaison, reportée sur chaque bougie (dernière valeur connue)",
      "r(t) = Σ (C(i) − C̄)(B(i) − B̄) / √( Σ (C(i) − C̄)² × Σ (B(i) − B̄)² ), sur les N dernières bougies",
    ],
    formulaNotes:
      "C'est le coefficient de Pearson, calculé sur les **niveaux** de clôture (pas sur les variations). Pas de valeur tant que la série comparée n'a pas commencé, ni quand l'une des deux séries est constante sur la fenêtre.",
    params: [
      { label: "Symbole de comparaison", defaultValue: "À choisir", description: "Demandé à l'ajout de l'indicateur.", tab: "Entrées" },
      PERIOD(20, "Longueur de la fenêtre glissante."),
      { label: "Seuil de corrélation forte", defaultValue: "0,7", range: "0,1 à 1", description: "Lignes horizontales à ± ce seuil.", tab: "Entrées" },
    ],
    related: ["atr", "bollinger"],
  },
  tpo: {
    formula: [
      "Séance = un jour calendaire ; son étendue (plus bas → plus haut) est découpée en L lignes égales",
      "Bloc = b minutes ; chaque bloc marque toutes les lignes que ses bougies ont touchées, avec sa lettre ou son numéro",
      "Bougie plus longue qu'un bloc : découpée en blocs synthétiques (approximation)",
      "POC = ligne la plus marquée",
      "Zone de valeur : part du POC et s'étend vers la ligne voisine la plus marquée jusqu'à couvrir v % des marques",
    ],
    formulaNotes: "Le profil est calculé sur les bougies affichées, séance par séance.",
    params: [
      { label: "Taille du bloc (min)", defaultValue: "30", range: "1 à 1440", description: "b : durée d'un bloc.", tab: "Entrées" },
      { label: "Lignes de prix", defaultValue: "24", range: "5 à 100", description: "L : nombre de lignes par séance.", tab: "Entrées" },
      { label: "Zone de valeur (%)", defaultValue: "70", range: "1 à 100", description: "v : part des marques couvertes par la zone de valeur.", tab: "Entrées" },
      { label: "Étiquettes", defaultValue: "Lettres", description: "Lettres ou chiffres pour nommer les blocs.", tab: "Entrées" },
      { label: "Séparer les blocs", defaultValue: "Oui", description: "Un léger espace entre les cellules de deux blocs voisins, pour distinguer chaque bloc.", tab: "Style" },
      { label: "Opacité (%)", defaultValue: "100", description: "Transparence du profil.", tab: "Style" },
    ],
    related: ["vwap", "pivotPoints", "supportResistance"],
  },
  freeCashFlow: fundamental(["FCF = flux de trésorerie d'exploitation − dépenses d'investissement"], "freeCashFlow"),
  netIncome: fundamental(["Bénéfice net = chiffre d'affaires − toutes les charges, intérêts et impôts"], "netIncome"),
  totalRevenue: fundamental(["Chiffre d'affaires = total des ventes facturées sur la période"], "totalRevenue"),
  netMargin: fundamental(["Marge nette (%) = 100 × bénéfice net / chiffre d'affaires"], "netMargin"),
  grossMargin: fundamental(["Marge brute (%) = 100 × (chiffre d'affaires − coût des ventes) / chiffre d'affaires"], "grossMargin"),
  peRatio: fundamental(["PER = cours de l'action / bénéfice par action"], "peRatio"),
  eps: fundamental(["BPA = bénéfice net / nombre d'actions en circulation"], "eps"),
  debtToEquity: fundamental(["Dette / capitaux propres = dette totale / capitaux propres"], "debtToEquity"),
};

/** Les indicateurs qui ont une page d'aide, dans l'ordre du catalogue. */
export const INDICATOR_HELP_KINDS: IndicatorKind[] = INDICATOR_CATALOG.map((entry) => entry.kind).filter(
  (kind) => INDICATOR_HELP_DETAILS[kind] !== undefined && INDICATOR_DESCRIPTIONS[kind] !== undefined
);

export function hasIndicatorHelp(kind: string): kind is IndicatorKind {
  return (INDICATOR_HELP_KINDS as string[]).includes(kind);
}

/** Découpe une description (`INDICATOR_DESCRIPTIONS`) à ses titres `## ` : l'introduction, puis
 *  chaque partie. */
function splitDescription(text: string): { intro: string; sections: { title: string; body: string }[] } {
  const parts = text.split(/^## /m);
  const intro = parts[0].trim();
  const sections = parts.slice(1).map((part) => {
    const newline = part.indexOf("\n");
    return newline < 0 ? { title: part.trim(), body: "" } : { title: part.slice(0, newline).trim(), body: part.slice(newline + 1).trim() };
  });
  return { intro, sections };
}

const isLimits = (title: string): boolean => /^ce qu'(il|elle|ils|elles) ne di/i.test(title);
const isSettings = (title: string): boolean => /^(réglages|affichage)$/i.test(title);

/** La page d'aide d'un indicateur intégré, ou null s'il n'en a pas (indicateur personnalisé). */
export function indicatorHelpPage(kind: string): IndicatorHelpPage | null {
  if (!hasIndicatorHelp(kind)) return null;
  const entry = INDICATOR_CATALOG.find((e) => e.kind === kind)!;
  const details = INDICATOR_HELP_DETAILS[kind]!;
  const { intro, sections } = splitDescription(INDICATOR_DESCRIPTIONS[kind]!);
  return {
    kind,
    label: entry.label,
    shortLabel: entry.shortLabel,
    category: entry.category,
    pane: entry.pane,
    definition: intro,
    reading: sections.filter((s) => !isLimits(s.title) && !isSettings(s.title)),
    limits: sections.find((s) => isLimits(s.title))?.body ?? null,
    settingsNotes: sections.find((s) => isSettings(s.title))?.body ?? null,
    script: INDICATOR_SCRIPT_SOURCES[kind] ?? null,
    ...details,
    related: details.related.filter((k) => k !== kind && hasIndicatorHelp(k)),
  };
}
