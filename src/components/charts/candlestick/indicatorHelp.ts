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
  /** « Histoire » : d'où vient l'indicateur, qui l'a créé et pourquoi. */
  history: string | null;
  /** « Les bases » : ce qu'il mesure et comment il se construit, en mots. */
  basics: string | null;
  /** « Ce qu'il faut rechercher » : une introduction, puis un cas par sous-titre `### ` (chacun peut porter une
   *  illustration `[[illustration:example-…|Légende]]`). */
  lookFor: { intro: string; cases: { title: string; body: string }[] } | null;
  /** « Résumé ». */
  summary: string | null;
  /** Les autres parties de lecture (« Comment il se lit », « Les critères, chiffrés »…), dans l'ordre. */
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
    label: "Valeur affichée",
    defaultValue: "Valeur",
    description:
      "« Valeur » trace le chiffre tel que l'application le fournit, dans son unité (montant, pourcentage ou ratio). « Variation sur 1 an (%) » trace à la place sa variation en pourcentage par rapport à la publication d'au moins un an plus tôt : à choisir pour juger un rythme de croissance, écarter la saisonnalité ou comparer des mesures d'échelles très différentes.",
    tab: "Entrées",
  },
  {
    label: "Courbe (couleur et épaisseur)",
    defaultValue: "Affichée, couleur de la palette, 1,5 px",
    range: "Épaisseur 1 à 4 px",
    description:
      "La ligne de la section « Tracé », au nom de l'indicateur. La case reprend l'œil de la légende (afficher ou masquer) ; le sélecteur règle la couleur de la courbe, et de l'aire avec ce type de tracé, ainsi que son épaisseur. Sans réglage, la couleur dépend de la place de l'indicateur parmi ceux du graphique.",
    tab: "Style",
  },
  {
    label: "Type de tracé",
    defaultValue: "Ligne",
    description:
      "« Ligne » relie les valeurs de bougie en bougie, avec une courte pente à chaque publication. « Palier » trace un plateau puis une marche verticale, fidèle à un chiffre qui ne change qu'aux dates de publication. « Aire » ajoute sous la ligne un remplissage léger jusqu'à zéro : utile pour lire un montant (chiffre d'affaires, bénéfice, flux de trésorerie) ou repérer les passages sous zéro.",
    tab: "Style",
  },
  {
    label: "Format des valeurs",
    defaultValue: "Automatique (k / M / B)",
    description:
      "Comment l'axe du panneau, les badges de survol et la légende écrivent les valeurs, avec un aperçu à droite. « Automatique » garde l'unité de la mesure : montant compact en dollars pour les flux, bénéfices et chiffre d'affaires, pourcentage à une décimale pour les marges, dollars à deux décimales pour le BPA, deux décimales pour les ratios, pourcentage signé en variation sur 1 an. « Nombre entier », « Décimales fixes », « Pourcentage » et « Brut » remplacent ce format.",
    tab: "Style",
  },
  {
    label: "Précision",
    defaultValue: "2",
    range: "0 à 10 décimales",
    description: "Nombre de décimales écrites. Proposé seulement avec le format « Décimales fixes ».",
    tab: "Style",
  },
  {
    label: "Afficher dans la légende",
    defaultValue: "Oui",
    description: "Décochée, l'en-tête du panneau se réduit à une poignée qui permet de le réafficher. Utile pour gagner de la place quand plusieurs panneaux sont empilés.",
    tab: "Style",
  },
  {
    label: "Filigrane du panneau",
    defaultValue: "Non",
    description:
      "Écrit un texte en fond du panneau, comme le nom du symbole derrière les bougies : pratique pour reconnaître d'un coup d'œil plusieurs panneaux de fondamentaux empilés. Cochée, elle fait apparaître le texte, l'opacité et la taille.",
    tab: "Style",
  },
  {
    label: "Filigrane : texte",
    defaultValue: "Nom de l'indicateur",
    range: "80 caractères au plus",
    description: "Le texte écrit en fond. Laissé vide, c'est le nom de l'indicateur.",
    tab: "Style",
  },
  { label: "Filigrane : opacité", defaultValue: "8 %", range: "2 à 40 %", description: "Plus elle est haute, plus le texte ressort ; trop haute, elle gêne la lecture de la courbe.", tab: "Style" },
  { label: "Filigrane : taille", defaultValue: "100 %", range: "30 à 150 %", description: "Taille du texte, relative à la taille normale du filigrane.", tab: "Style" },
  {
    label: "Style conditionnel",
    defaultValue: "Aucune règle",
    description:
      "Des règles qui colorent la courbe, la zone entre elle et un niveau ou le fond du panneau, ou qui posent une icône, quand une condition est vraie : par exemple marquer le passage sous zéro du flux de trésorerie disponible, ou colorer la marge nette sous un seuil. Chaque règle se lit comme une phrase ; elles se peignent dans l'ordre, la dernière par-dessus.",
    tab: "Style",
  },
];

const FUNDAMENTAL_NOTES = `Ce chiffre n'est **pas calculé par le graphique** : il est fourni par l'application, à chaque date de publication. La formule ci-dessus en donne la définition comptable ; la source des données peut l'appliquer avec ses propres conventions.

Entre deux publications, la dernière valeur connue est **reportée sur chaque bougie**, d'où le tracé en escalier ; rien n'est tracé avant la première publication.

En **variation sur 1 an** : 100 × (valeur − dernière valeur publiée au moins 365 jours plus tôt) / cette valeur antérieure. Pas de variation quand la valeur antérieure est nulle ou négative (le pourcentage n'aurait pas de sens) : la variation précédente reste alors affichée. Pour une marge, c'est une variation **relative**, pas un écart en points (de 10 % à 12 %, +20 %).`;

const FUNDAMENTAL_RELATED: IndicatorKind[] = ["totalRevenue", "netIncome", "netMargin", "grossMargin", "freeCashFlow", "eps", "peRatio", "debtToEquity"];

function fundamental(formula: string[], self: IndicatorKind): IndicatorHelpDetails {
  return { formula, formulaNotes: FUNDAMENTAL_NOTES, params: FUNDAMENTAL_PARAMS, related: FUNDAMENTAL_RELATED.filter((k) => k !== self).slice(0, 4) };
}

const PERIOD = (def: number, description: string): IndicatorHelpParam => ({ label: "Période", defaultValue: String(def), range: "1 à 500", description, tab: "Entrées" });

/** Section « Projection » de l'onglet Entrées, commune aux indicateurs dont les valeurs sont un niveau qui se prolonge
 *  (`supportsProjection`, indicatorProjection.ts). Les réglages après la case n'apparaissent qu'une fois cochée. */
const PROJECTION_HELP_PARAMS: IndicatorHelpParam[] = [
  { label: "Prolonger l'indicateur en pointillés", defaultValue: "Non", description: "Section « Projection » : prolonge les lignes de l'indicateur au-delà de la dernière bougie, en pointillés. C'est une extrapolation de ses propres valeurs passées, pas une prévision de marché ; les réglages suivants n'apparaissent qu'une fois la case cochée.", tab: "Entrées" },
  { label: "Méthode", defaultValue: "Régression linéaire", description: "Régression linéaire (droite ajustée sur l'historique retenu, qui suit bien une pente régulière), dérive (dernière valeur plus le pas moyen, plus calme), lissage de Holt (niveau et tendance remis à jour, le passé récent pèse plus : utile après un changement de régime) ou dernière valeur tenue (souvent la meilleure référence pour une série qui revient vers sa moyenne, comme un oscillateur).", tab: "Entrées" },
  { label: "Bougies projetées", defaultValue: "12", range: "1 à 200", description: "Longueur du prolongement. Plus il est long, plus l'extrapolation s'éloigne de ce qui est réellement mesurable.", tab: "Entrées" },
  { label: "Historique utilisé", defaultValue: "30", range: "2 à 500 bougies", description: "Nombre de dernières valeurs sur lesquelles s'appuie la méthode. Court, la projection suit la pente toute récente ; long, elle retient la tendance de fond.", tab: "Entrées" },
  { label: "Amortissement", defaultValue: "0,85", range: "0 à 1", description: "Part de la pente gardée à chaque bougie projetée : 1 la garde entière, 0 l'abandonne aussitôt ; entre les deux, la projection s'aplatit peu à peu. Absent avec « Dernière valeur tenue ».", tab: "Entrées" },
];

/** Onglet Style, section « Affichage » : la case de légende, commune à tous les indicateurs. */
const LEGEND_HELP_PARAM: IndicatorHelpParam = { label: "Afficher dans la légende", defaultValue: "Oui", description: "Section « Affichage » : la case montre ou retire l'indicateur de la légende du graphique, sans toucher à son tracé.", tab: "Style" };

/** Onglet Style, rubrique repliable « Style conditionnel » (IndicatorStyleRulesEditor), commune à tous les indicateurs. */
const STYLE_RULES_HELP_PARAM: IndicatorHelpParam = { label: "Style conditionnel", defaultValue: "Aucune règle", description: "Rubrique repliable en bas de l'onglet : des règles qui colorent une courbe, l'espace entre deux courbes ou le fond, ou posent une icône, là où une condition est vraie (un croisement, un franchissement de seuil). Les règles se peignent dans l'ordre, la dernière par-dessus ; « Partir d'un modèle » en propose de toutes faites.", tab: "Style" };

/** Onglet Style, section « Valeurs » : le format des nombres, pour les indicateurs en panneau séparé. */
const VALUE_FORMAT_HELP_PARAM: IndicatorHelpParam = { label: "Format", defaultValue: "Automatique (k / M / B)", description: "Section « Valeurs » : comment l'axe du panneau, les badges de survol et la légende écrivent les valeurs. Automatique, nombre entier, décimales fixes (avec une précision de 0 à 10 décimales, 2 par défaut), pourcentage ou brut ; un aperçu s'affiche à droite.", tab: "Style" };

/** Onglet Style, section « Affichage » : le filigrane d'un panneau séparé (IndicatorWatermarkField). */
const PANE_WATERMARK_HELP_PARAM: IndicatorHelpParam = { label: "Filigrane du panneau", defaultValue: "Non", description: "Section « Affichage » : un texte en fond du panneau, comme le symbole derrière les bougies. Une fois la case cochée, se règlent le texte (le nom de l'indicateur si on le laisse vide), l'opacité (2 à 40 %, 8 % par défaut) et la taille (30 à 150 %, 100 % par défaut).", tab: "Style" };

/** Option « Divergences » du RSI et du MACD (divergences.ts) : ses réglages, dans les deux onglets. `series` : la courbe
 *  comparée au prix (« le RSI », « la ligne MACD »). */
const DIVERGENCE_HELP_PARAMS = (series: string): IndicatorHelpParam[] => [
  {
    label: "Afficher les divergences haussières et baissières",
    defaultValue: "Non",
    description: `Section « Divergences ». Cochée, cherche les **pivots** de ${series} (un sommet dépasse les bougies qui l'entourent, un creux est sous elles) et compare chacun au pivot du même type qui le précède. **Baissière** : le prix fait un plus haut plus haut (plus haut des deux bougies) quand ${series} fait un sommet plus bas. **Haussière** : le prix fait un plus bas plus bas (plus bas des deux bougies) quand ${series} fait un creux plus haut. Chaque divergence est un segment entre les deux pivots, dans le panneau et sur le graphique des prix, terminé par une étiquette « B » (baissière, au-dessus) ou « H » (haussière, en dessous) ; sur les prix, elle porte aussi le nom de l'indicateur (« B RSI », « H MACD »).`,
    tab: "Entrées",
  },
  {
    label: "Divergences cachées aussi",
    defaultValue: "Non",
    description: `Ajoute les divergences de continuation, en pointillés, étiquetées « H c » et « B c » : haussière cachée quand le prix fait un creux plus haut et ${series} un creux plus bas (la tendance haussière reprend), baissière cachée quand le prix fait un sommet plus bas et ${series} un sommet plus haut.`,
    tab: "Entrées",
  },
  {
    label: "Pivot : bougies à gauche / à droite",
    defaultValue: "5 / 5",
    range: "1 à 50 bougies",
    description: "Combien de bougies avant et après un pivot doivent lui être inférieures (sommet) ou supérieures (creux). Plus grand, seuls les pivots marquants comptent. Un pivot n'est connu qu'une fois passées les bougies de droite : une divergence apparaît avec ce retard, puis ne bouge plus.",
    tab: "Entrées",
  },
  {
    label: "Écart minimal / maximal entre deux pivots",
    defaultValue: "5 / 60 bougies",
    range: "1 à 500 bougies",
    description: "Deux pivots trop proches (bruit) ou trop éloignés (deux épisodes sans rapport) ne sont pas comparés. 5 et 60 sont les bornes usuelles, celles du RSI de TradingView.",
    tab: "Entrées",
  },
  {
    label: "Divergences",
    defaultValue: "Haussière verte, baissière rouge, 1,5 px",
    description: "Section « Tracé » : un sélecteur par sens règle la couleur, l'opacité et l'épaisseur des segments et des étiquettes. En thème liseuse, elles prennent la couleur du texte (les étiquettes H et B les distinguent).",
    tab: "Style",
  },
  {
    label: "Divergences aussi sur le graphique des prix",
    defaultValue: "Oui",
    description: "Section « Affichage » : décochée, les divergences ne se tracent que dans le panneau de l'indicateur.",
    tab: "Style",
  },
  {
    label: "Étiquettes des divergences",
    defaultValue: "Oui",
    description: "Section « Affichage » : l'étiquette « H » ou « B » au bout de chaque segment.",
    tab: "Style",
  },
];

export const INDICATOR_HELP_DETAILS: Partial<Record<IndicatorKind, IndicatorHelpDetails>> = {
  sma: {
    formula: ["SMA(t) = (C(t) + C(t−1) + … + C(t−N+1)) / N"],
    formulaNotes: "Chaque clôture de la fenêtre pèse 1/N. La première valeur apparaît à la **Nᵉ bougie** de l'historique chargé.",
    params: [
      PERIOD(20, "Nombre de clôtures moyennées. **20** suit la tendance de court terme (environ un mois de séances en données quotidiennes), **50** la tendance intermédiaire, **200** la tendance de fond. Plus la période est longue, plus la ligne est lisse et en retard ; il faut au moins N bougies d'historique pour voir la première valeur. Posée sur un panneau (clic droit, « Ajouter un indicateur sur… »), la moyenne démarre à 14."),
      ...PROJECTION_HELP_PARAMS,
      { label: "SMA(20)", defaultValue: "Affichée, couleur de la palette, 1,5 px", description: "La ligne de la moyenne, sous le nom qu'elle porte à l'écran (il suit la période). La case l'affiche ou la masque sans la retirer du graphique ; le sélecteur règle sa couleur, son opacité et son épaisseur (1 à 4 px). Sans choix, la couleur vient de la palette du graphique, selon le rang de l'indicateur.", tab: "Style" },
      LEGEND_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
    ],
    related: ["ema", "wma", "bollinger", "vwap"],
  },
  ema: {
    formula: ["k = 2 / (N + 1)", "EMA(N) = moyenne simple des N premières clôtures", "EMA(t) = k × C(t) + (1 − k) × EMA(t−1)"],
    formulaNotes:
      "Le calcul part de la **première bougie chargée** : la toute première valeur est une moyenne simple, puis chaque clôture est ajoutée avec le poids k. L'effet de cet amorçage s'efface au fil des bougies, mais deux historiques de longueurs différentes peuvent donner des valeurs très légèrement différentes au début.",
    params: [
      PERIOD(20, "Fixe le coefficient de lissage k = 2 / (N + 1) : le poids de la dernière clôture, environ 9,5 % pour 20 et 4 % pour 50. Courte (9 à 21), l'EMA colle au prix pour les signaux rapides ; longue (50, 200), elle décrit la tendance de fond. Posée sur un panneau (clic droit, « Ajouter un indicateur sur… »), elle démarre à 14."),
      ...PROJECTION_HELP_PARAMS,
      { label: "EMA(20)", defaultValue: "Affichée, couleur de la palette, 1,5 px", description: "La ligne de la moyenne, sous le nom qu'elle porte à l'écran (il suit la période). La case l'affiche ou la masque sans la retirer du graphique ; le sélecteur règle sa couleur, son opacité et son épaisseur (1 à 4 px). Sans choix, la couleur vient de la palette du graphique, selon le rang de l'indicateur.", tab: "Style" },
      LEGEND_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
    ],
    related: ["sma", "wma", "macd"],
  },
  wma: {
    formula: ["WMA(t) = (1 × C(t−N+1) + 2 × C(t−N+2) + … + N × C(t)) / (N × (N + 1) / 2)"],
    formulaNotes: "La clôture la plus récente pèse N fois plus que la plus ancienne. Première valeur à la **Nᵉ bougie**.",
    params: [
      PERIOD(20, "Nombre de clôtures pondérées : la plus récente pèse N fois plus que la plus ancienne. À période égale, la WMA réagit plus vite que la SMA ; pour une ligne plus lisse, allongez la période plutôt que de changer de moyenne. Posée sur un panneau (clic droit, « Ajouter un indicateur sur… »), elle démarre à 14."),
      ...PROJECTION_HELP_PARAMS,
      { label: "WMA(20)", defaultValue: "Affichée, couleur de la palette, 1,5 px", description: "La ligne de la moyenne, sous le nom qu'elle porte à l'écran (il suit la période). La case l'affiche ou la masque sans la retirer du graphique ; le sélecteur règle sa couleur, son opacité et son épaisseur (1 à 4 px). Sans choix, la couleur vient de la palette du graphique, selon le rang de l'indicateur.", tab: "Style" },
      LEGEND_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
    ],
    related: ["sma", "ema"],
  },
  vwap: {
    formula: ["Prix typique TP(i) = (H(i) + L(i) + C(i)) / 3", "VWAP(t) = Σ TP(i) × V(i) / Σ V(i), sommes de la première bougie chargée jusqu'à t"],
    formulaNotes:
      "Le cumul commence à la **première bougie de l'historique chargé** et n'est jamais remis à zéro (ni par séance, ni par jour). Sans volume, le quotient n'est pas défini et rien n'est tracé.",
    params: [
      ...PROJECTION_HELP_PARAMS,
      { label: "VWAP", defaultValue: "Affichée, couleur de la palette, 1,5 px", description: "La ligne du VWAP. Il n'a pas de période : le cumul part toujours de la première bougie chargée, et l'onglet Entrées ne propose que la projection. La case affiche ou masque la ligne ; le sélecteur règle sa couleur, son opacité et son épaisseur (1 à 4 px). Sans choix, la couleur vient de la palette du graphique, selon le rang de l'indicateur.", tab: "Style" },
      LEGEND_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
    ],
    related: ["sma", "tpo"],
  },
  bollinger: {
    formula: [
      "Médiane(t) = SMA(N) des clôtures",
      "σ(t) = √( Σ (C(i) − Médiane(t))² / N ), sur les N dernières clôtures",
      "Bande haute = Médiane + k × σ",
      "Bande basse = Médiane − k × σ",
    ],
    formulaNotes:
      "σ est l'écart-type **de population** (division par N, pas par N − 1). Première valeur à la Nᵉ bougie. Posées sur un panneau (clic droit → « Ajouter un indicateur sur… »), les bandes se calculent de la même façon sur la série de ce panneau — la valeur principale de l'indicateur (RSI, ligne MACD…) ou le volume — au lieu des clôtures.",
    params: [
      PERIOD(20, "Fenêtre de la médiane (une SMA) et de l'écart-type. **20** est le réglage de référence ; une période plus courte (10) colle au prix et resserre les bandes, une plus longue (50) les élargit et les rend plus stables. Rien ne s'affiche avant N bougies d'historique."),
      { label: "Écart-type", defaultValue: "2", range: "0,5 à 5 σ, par pas de 0,1", description: "Le multiplicateur k : distance des bandes à la médiane, en écarts-types. Élargir à 2,5 rend les contacts nettement plus rares ; resserrer à 1,5 les multiplie. Avec une période plus longue, on élargit souvent un peu (2,1 pour 50), avec une plus courte on resserre (1,9 pour 10).", tab: "Entrées" },
      ...PROJECTION_HELP_PARAMS,
      { label: "BB(20,2)", defaultValue: "Affichée, couleur de la palette, 1 px", description: "Les trois lignes et le fond, sous le nom que l'indicateur porte à l'écran (il suit les réglages). La case les affiche ou les masque ; le sélecteur règle la couleur commune, son opacité et l'épaisseur des bandes (1 à 4 px), la médiane étant tracée un demi-pixel plus épaisse. Le fond entre les bandes reprend la même couleur, très transparente (8 %).", tab: "Style" },
      LEGEND_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
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
      PERIOD(14, "Longueur du lissage des gains et des pertes. **14** est la valeur de Wilder et la référence commune. Plus courte (7 à 9), le RSI devient nerveux et touche souvent les zones extrêmes ; plus longue (21, 25), il se lisse et ne les atteint presque plus. Il faut N + 1 clôtures pour la première valeur."),
      { label: "Surachat", defaultValue: "70", range: "50 à 99", description: "Section « Seuils » : niveau de la ligne horizontale haute du panneau. Il n'entre pas dans le calcul : c'est un repère de lecture. On le monte souvent à 80 sur un titre ou en tendance haussière, où le RSI passe beaucoup de temps au-dessus de 70.", tab: "Entrées" },
      { label: "Survente", defaultValue: "30", range: "1 à 50", description: "Section « Seuils » : niveau de la ligne horizontale basse du panneau, sans effet sur le calcul. On le baisse souvent à 20 en tendance baissière, pour ne garder que les excès marqués.", tab: "Entrées" },
      { label: "Lignes de surachat et de survente calculées", defaultValue: "Non", description: "Ajoute au RSI les lignes du « RSI : zones de survente et de surachat » : la moyenne et le plus haut des derniers pics au-dessus du seuil de surachat, la moyenne et le plus bas des derniers creux sous le seuil de survente. Une fois cochée, se règlent le nombre de pics (30 par défaut) et, dans l'onglet Style, l'affichage, la couleur, l'épaisseur, le style et l'opacité de chaque ligne.", tab: "Entrées" },
      ...DIVERGENCE_HELP_PARAMS("le RSI").filter((p) => p.tab === "Entrées"),
      ...PROJECTION_HELP_PARAMS,
      { label: "RSI(14)", defaultValue: "Affichée, couleur de la palette, 1,5 px", description: "La courbe du RSI, sous le nom qu'elle porte à l'écran (il suit la période). La case l'affiche ou la masque ; le sélecteur règle sa couleur, son opacité et son épaisseur (1 à 4 px). Sans choix, la couleur vient de la palette du graphique, selon le rang de l'indicateur.", tab: "Style" },
      { label: "Seuil de surachat (70)", defaultValue: "Gris à 60 %", description: "La ligne pointillée du seuil de surachat (son niveau se règle dans l'onglet Entrées). Le sélecteur règle sa couleur et son opacité, par exemple pour la teinter de rouge ou l'estomper. En thème liseuse, elle prend la couleur de la grille.", tab: "Style" },
      { label: "Seuil de survente (30)", defaultValue: "Gris à 60 %", description: "La ligne pointillée du seuil de survente : couleur et opacité dans le sélecteur, comme pour le seuil de surachat.", tab: "Style" },
      { label: "Ligne médiane (50)", defaultValue: "Masquée, gris à 40 %", description: "La case ajoute une ligne pointillée à 50, la frontière entre biais haussier et biais baissier ; le sélecteur règle sa couleur et son opacité. Utile pour lire le RSI comme filtre de tendance.", tab: "Style" },
      ...DIVERGENCE_HELP_PARAMS("le RSI").filter((p) => p.tab === "Style"),
      VALUE_FORMAT_HELP_PARAM,
      LEGEND_HELP_PARAM,
      PANE_WATERMARK_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
    ],
    related: ["macd", "chop", "adx"],
  },
  donchian: {
    formula: [
      "Bande supérieure(t) = plus haut des H sur les N dernières bougies, t comprise",
      "Bande inférieure(t) = plus bas des L sur les N dernières bougies, t comprise",
      "Base(t) = (Bande supérieure(t) + Bande inférieure(t)) / 2",
      "Avec un décalage d : la valeur tracée sur la bougie t est celle calculée à la bougie t − d",
    ],
    formulaNotes:
      "Première valeur à la **Nᵉ bougie**, quand la fenêtre est pleine. Les extrêmes sont ceux des mèches (plus hauts et plus bas), pas des clôtures. Un décalage positif pousse les canaux vers la droite ; les valeurs qui sortiraient de l'historique ne sont pas tracées.",
    params: [
      PERIOD(20, "Nombre de bougies sur lesquelles sont relevés le plus haut et le plus bas. **20** est la valeur la plus répandue (environ un mois de séances en données quotidiennes) ; **55** donne un canal plus lent, pour un suivi de tendance de fond ; **10** un canal plus nerveux, souvent utilisé pour les sorties."),
      { label: "Décalage", defaultValue: "0", range: "−500 à 500 bougies", description: "Déplace les canaux vers la droite (valeur positive) ou vers la gauche (valeur négative) par rapport aux bougies. Avec un décalage de 1, chaque bougie est comparée au canal de la veille : une clôture au-dessus de la bande supérieure est alors une vraie cassure du plus haut précédent.", tab: "Entrées" },
      { label: "Base", defaultValue: "Affichée, orange", description: "La case affiche ou masque la base (le milieu du canal). Le sélecteur règle sa couleur et son épaisseur ; son style (continue, tirets, pointillés) et son opacité se règlent dans « Lignes et fond ».", tab: "Style" },
      { label: "Bande supérieure", defaultValue: "Affichée, bleue", description: "La case affiche ou masque la bande supérieure (le plus haut de la période). Couleur et épaisseur dans le sélecteur ; style et opacité dans « Lignes et fond ».", tab: "Style" },
      { label: "Bande inférieure", defaultValue: "Affichée, bleue", description: "La case affiche ou masque la bande inférieure (le plus bas de la période). Couleur et épaisseur dans le sélecteur ; style et opacité dans « Lignes et fond ».", tab: "Style" },
      { label: "Fond entre les bandes", defaultValue: "Affiché, bleu à 8 %", description: "La case affiche ou masque la couleur de fond qui remplit le canal. Le sélecteur règle la couleur, « Fond : opacité » sa transparence.", tab: "Style" },
      { label: "Valeurs des indicateurs", defaultValue: "Selon le graphique", description: "Avec le réglage « Valeurs des indicateurs » du graphique, la valeur actuelle de chaque ligne s'affiche sur l'axe des prix, dans sa couleur ; un clic sur l'indicateur montre aussi ses valeurs et sa plage sur les axes.", tab: "Style" },
      LEGEND_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
      ...PROJECTION_HELP_PARAMS,
    ],
    related: ["bollinger", "atr", "supertrend", "adx"],
  },
  rsiZones: {
    formula: [
      "RSI(t) : calcul identique au RSI (lissage de Wilder sur N clôtures)",
      "Pic d'un passage en surachat = plus haut RSI d'une suite de bougies consécutives avec RSI ≥ seuil de surachat",
      "Creux d'un passage en survente = plus bas RSI d'une suite de bougies consécutives avec RSI ≤ seuil de survente",
      "Moyenne surachat = moyenne des P derniers pics ; plus haut surachat = le plus haut de ces P pics",
      "Moyenne survente = moyenne des P derniers creux ; plus bas survente = le plus bas de ces P creux",
    ],
    formulaNotes:
      "Les quatre niveaux sont tracés en **lignes horizontales** sur tout le panneau, avec leur valeur. Une zone où le RSI n'est jamais entré n'a pas de ligne ; un passage encore en cours compte avec son pic du moment. Les niveaux sont relevés jusqu'à la dernière bougie de l'historique (ou jusqu'à la coupure du replay), pas sur la partie affichée : ils ne bougent pas quand on fait défiler le graphique.",
    params: [
      PERIOD(14, "Longueur du lissage des gains et des pertes."),
      { label: "Nombre de pics pris en compte", defaultValue: "30", range: "1 à 500", description: "Les derniers passages en zone retenus : leurs pics (surachat) et leurs creux (survente) donnent la moyenne et l'extrême. Plus grand, des repères plus stables ; plus petit, des repères qui suivent le régime récent.", tab: "Entrées" },
      { label: "Seuil de surachat", defaultValue: "70", range: "50 à 99", description: "Au-dessus, une valeur compte dans la zone de surachat.", tab: "Entrées" },
      { label: "Seuil de survente", defaultValue: "30", range: "1 à 50", description: "En dessous, une valeur compte dans la zone de survente.", tab: "Entrées" },
      ...DIVERGENCE_HELP_PARAMS("le RSI").filter((p) => p.tab === "Entrées"),
      { label: "RSI", defaultValue: "Affiché", description: "La courbe du RSI : couleur et épaisseur dans le sélecteur de la ligne « RSI ».", tab: "Style" },
      { label: "Seuils de surachat et de survente", defaultValue: "Gris à 60 %", description: "Les deux lignes pointillées des seuils : couleur et opacité de chacune. La ligne médiane (50) peut s'y ajouter.", tab: "Style" },
      { label: "Surachat : plus haut des pics", defaultValue: "Affichée, rouge, pointillés, 80 %", description: "La case affiche ou masque la ligne du plus haut des derniers pics en surachat. Couleur et épaisseur dans le sélecteur, puis style (continue, tirets, pointillés) et opacité juste en dessous.", tab: "Style" },
      { label: "Surachat : moyenne des pics", defaultValue: "Affichée, rouge, tirets, 80 %", description: "La moyenne des derniers pics en surachat. Mêmes réglages : affichage, couleur, épaisseur, style, opacité.", tab: "Style" },
      { label: "Survente : moyenne des creux", defaultValue: "Affichée, verte, tirets, 80 %", description: "La moyenne des derniers creux en survente. Mêmes réglages : affichage, couleur, épaisseur, style, opacité.", tab: "Style" },
      { label: "Survente : plus bas des creux", defaultValue: "Affichée, verte, pointillés, 80 %", description: "Le plus bas des derniers creux en survente. Mêmes réglages : affichage, couleur, épaisseur, style, opacité.", tab: "Style" },
      ...DIVERGENCE_HELP_PARAMS("le RSI").filter((p) => p.tab === "Style"),
      VALUE_FORMAT_HELP_PARAM,
      LEGEND_HELP_PARAM,
      PANE_WATERMARK_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
      ...PROJECTION_HELP_PARAMS,
    ],
    related: ["rsi", "chop", "adx"],
  },
  chop: {
    formula: [
      "TR(t) = max(H(t) − L(t), |H(t) − C(t−1)|, |L(t) − C(t−1)|) ; pour la première bougie, H − L",
      "CHOP(t) = 100 × log10( Σ TR sur N / (plus haut des H sur N − plus bas des L sur N) ) / log10(N)",
    ],
    formulaNotes: "Première valeur à la Nᵉ bougie. Pas de valeur quand la fenêtre n'a aucune amplitude (plus haut = plus bas). La période doit valoir au moins 2 (log10(1) = 0).",
    params: [
      PERIOD(14, "Fenêtre sur laquelle sont comparés le chemin parcouru (somme des amplitudes) et l'étendue couverte. Courte, l'indice réagit vite mais ne voit que les petites oscillations ; longue (20 à 50), il juge le régime sur un horizon plus large, au prix d'un retard accru. Gardez au moins 2 : à 1, le calcul n'a pas de sens (log10(1) = 0)."),
      { label: "Haut (marché indécis)", defaultValue: "61,8", range: "50 à 99, par pas de 0,1", description: "Section « Seuils » : niveau de la ligne horizontale au-dessus de laquelle le marché est lu comme indécis. Il n'entre pas dans le calcul. Le monter (65, 70) ne retient que les consolidations les plus nettes.", tab: "Entrées" },
      { label: "Bas (directionnel)", defaultValue: "38,2", range: "1 à 50, par pas de 0,1", description: "Section « Seuils » : niveau de la ligne horizontale sous laquelle le marché est lu comme directionnel, sans effet sur le calcul. Le baisser (30, 35) ne retient que les tendances les plus franches.", tab: "Entrées" },
      ...PROJECTION_HELP_PARAMS,
      { label: "CHOP(14)", defaultValue: "Affichée, couleur de la palette, 1,5 px", description: "La courbe de l'indice, sous le nom qu'elle porte à l'écran (il suit la période). La case l'affiche ou la masque ; le sélecteur règle sa couleur, son opacité et son épaisseur (1 à 4 px). Les deux lignes de seuil, en pointillés, prennent la couleur de la grille et ne se règlent pas.", tab: "Style" },
      VALUE_FORMAT_HELP_PARAM,
      LEGEND_HELP_PARAM,
      PANE_WATERMARK_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
    ],
    related: ["adx", "atr", "bollinger"],
  },
  macd: {
    formula: ["MACD(t) = EMA(rapide)(t) − EMA(lente)(t), sur les clôtures", "Signal(t) = EMA(signal) de la ligne MACD", "Histogramme(t) = MACD(t) − Signal(t)"],
    formulaNotes:
      "Les trois moyennes sont **exponentielles**, amorcées sur une moyenne simple comme l'EMA. La ligne MACD apparaît une fois la moyenne lente amorcée ; le signal et l'histogramme, après la période du signal en plus.",
    params: [
      { label: "Moyenne rapide", defaultValue: "12", range: "1 à 200 bougies", description: "Période de l'EMA rapide des clôtures. La raccourcir rend la ligne MACD plus réactive, et plus bruyante. Elle doit rester nettement plus courte que la moyenne lente, sans quoi l'écart entre les deux n'a plus de sens.", tab: "Entrées" },
      { label: "Moyenne lente", defaultValue: "26", range: "1 à 400 bougies", description: "Période de l'EMA lente, la référence de tendance. L'allonger (par exemple 50) donne un MACD qui ne retient que les mouvements de fond ; la ligne MACD n'apparaît qu'une fois cette moyenne amorcée.", tab: "Entrées" },
      { label: "Signal", defaultValue: "9", range: "1 à 200 bougies", description: "Période de l'EMA de la ligne MACD. Plus courte, la ligne de signal colle à la ligne MACD et les croisements se multiplient ; plus longue, ils se raréfient et arrivent plus tard. Le couple 12, 26, 9 est le réglage de référence ; raccourcir les trois périodes ensemble fait gagner en réactivité, au prix de davantage de faux signaux.", tab: "Entrées" },
      { label: "Lignes des plus hauts, des plus bas et de leur moyenne", defaultValue: "Non", description: "Le pendant des lignes de surachat et de survente calculées du RSI. Le MACD n'a pas de seuils fixes : un **pic** est le plus haut de la ligne MACD sur un passage au-dessus de 0 (d'un croisement de zéro au suivant), un **creux** le plus bas d'un passage sous 0. Quatre lignes horizontales : le plus haut et la moyenne des derniers pics, la moyenne et le plus bas des derniers creux, avec leur valeur à droite. Relevées sur tout l'historique (jusqu'à la coupure du replay), elles ne bougent pas au défilement, et l'échelle du panneau s'élargit pour les garder visibles. Un passage encore en cours compte avec son extrême du moment.", tab: "Entrées" },
      { label: "Nombre de pics pris en compte", defaultValue: "30", range: "1 à 500", description: "Proposé une fois l'option cochée : les derniers pics (et les derniers creux) dont on prend la moyenne et l'extrême. Plus grand, des repères plus stables ; plus petit, des repères qui suivent le régime récent. Le MACD s'exprimant en unités de prix, un historique long où le prix a beaucoup changé de niveau donne des repères moins parlants : réduisez alors ce nombre.", tab: "Entrées" },
      ...DIVERGENCE_HELP_PARAMS("la ligne MACD").filter((p) => p.tab === "Entrées"),
      ...PROJECTION_HELP_PARAMS,
      { label: "MACD", defaultValue: "Affichée, couleur de la palette, 1,5 px", description: "La ligne MACD. La case affiche ou masque l'indicateur ; le sélecteur règle sa couleur, son opacité et son épaisseur (1 à 4 px). La ligne de signal, fine et grise, et la ligne zéro, en pointillés, ne se règlent pas.", tab: "Style" },
      { label: "Histogramme", defaultValue: "Affiché, couleurs de hausse et de baisse du graphique", description: "La case affiche ou masque les barres de l'écart MACD − signal (les lignes restent). Deux sélecteurs : « Hausse » pour les barres positives (MACD au-dessus de son signal), « Baisse » pour les négatives. En thème liseuse, les barres prennent la couleur du texte.", tab: "Style" },
      { label: "MACD selon le signal", defaultValue: "Non", description: "Cochée, la ligne MACD change de couleur à chaque croisement avec sa ligne de signal : « Au-dessus » (couleur de hausse par défaut) et « En dessous » (couleur de baisse) se règlent à droite. Pratique pour voir les croisements sans lire l'histogramme.", tab: "Style" },
      { label: "Pics : plus haut / Pics : moyenne", defaultValue: "Affichées, rouges, pointillés / tirets, 80 %", description: "Section « Lignes des pics et des creux » (avec l'option cochée) : pour chaque ligne, la case l'affiche ou la masque, le sélecteur règle sa couleur et son épaisseur, puis son style (continue, tirets, pointillés) et son opacité juste en dessous.", tab: "Style" },
      { label: "Creux : moyenne / Creux : plus bas", defaultValue: "Affichées, vertes, tirets / pointillés, 80 %", description: "Mêmes réglages pour les deux lignes des creux : affichage, couleur, épaisseur, style, opacité.", tab: "Style" },
      ...DIVERGENCE_HELP_PARAMS("la ligne MACD").filter((p) => p.tab === "Style"),
      VALUE_FORMAT_HELP_PARAM,
      LEGEND_HELP_PARAM,
      PANE_WATERMARK_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
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
      { label: "Déviation", defaultValue: "5 %", range: "0,5 à 50 %", description: "Recul minimal, en pourcentage de l'extrême en cours, pour confirmer un sommet ou un creux. Un seuil bas (1 à 3 %) suit les oscillations de court terme mais réintroduit le bruit qu'on cherchait à filtrer ; un seuil élevé (8 à 10 % et plus) ne garde que la structure majeure. À adapter à la volatilité du titre et à l'unité de temps : 5 % est beaucoup en intraday, peu sur une valeur très volatile en données hebdomadaires.", tab: "Entrées" },
      { label: "Zig Zag", defaultValue: "Affiché, couleur de la palette", description: "La case affiche ou masque l'indicateur. Le sélecteur règle la couleur de la ligne brisée et des étiquettes ; la ligne est tracée à épaisseur fixe.", tab: "Style" },
      { label: "Valeurs des indicateurs", defaultValue: "Selon le graphique", description: "Avec le réglage « Valeurs des indicateurs » du graphique, le prix du dernier pivot confirmé s'affiche sur l'axe des prix, avec son étiquette (HH, LL…).", tab: "Style" },
      LEGEND_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
      { label: "Libellés HH / HL / LH / LL", defaultValue: "Oui", description: "Écrit au-dessus de chaque sommet et sous chaque creux confirmés sa comparaison avec le pivot précédent de même nature. À décocher pour ne garder que la ligne, par exemple quand le Zig Zag sert seulement à ancrer des retracements.", tab: "Style" },
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
      PERIOD(14, "Nombre de bougies du lissage de Wilder. **14** est la valeur de Wilder ; une période courte (5 à 10) réagit vite à un choc de volatilité, une période longue (20 à 50) donne une mesure de fond, plus stable, pour dimensionner des positions ou placer des stops de long terme."),
      ...PROJECTION_HELP_PARAMS,
      { label: "ATR", defaultValue: "Affichée, couleur de la palette", description: "La case affiche ou masque la courbe ; le sélecteur règle sa couleur et son épaisseur.", tab: "Style" },
      VALUE_FORMAT_HELP_PARAM,
      { label: "En % du prix", defaultValue: "Non", description: "Section « Valeurs » : rapporte chaque valeur à la clôture de sa bougie. L'ATR devient alors comparable d'un instrument à l'autre, et sur une longue période pendant laquelle le cours a beaucoup varié.", tab: "Style" },
      { label: "Valeurs des indicateurs", defaultValue: "Selon le graphique", description: "Avec le réglage « Valeurs des indicateurs » du graphique, la dernière valeur de l'ATR s'affiche sur l'axe de son panneau, dans sa couleur.", tab: "Style" },
      LEGEND_HELP_PARAM,
      PANE_WATERMARK_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
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
      PERIOD(10, "Période de l'ATR qui fixe l'écart des bandes. Courte, la distance s'adapte vite à un regain de volatilité ; longue, elle reste stable et la ligne progresse plus régulièrement."),
      { label: "Multiplicateur", defaultValue: "3 × ATR", range: "0,5 à 10 × ATR", description: "Distance des bandes au milieu de la bougie, en nombre d'ATR — l'arbitrage principal de l'outil. Vers 2, la ligne colle au prix et bascule tôt, au prix de nombreux faux signaux ; vers 4 ou 5, elle laisse respirer la tendance et **ne bascule que rarement, mais tard**. 3 est la valeur la plus répandue en données quotidiennes.", tab: "Entrées" },
      { label: "Tendance", defaultValue: "Affichée, couleurs de hausse et de baisse du graphique", description: "La case affiche ou masque la ligne. Deux couleurs : « Hausse » pour la ligne sous les cours (tendance haussière), « Baisse » pour la ligne au-dessus. Sans choix, elles suivent les couleurs de hausse et de baisse des bougies. La ligne est tracée à épaisseur fixe.", tab: "Style" },
      { label: "Valeurs des indicateurs", defaultValue: "Selon le graphique", description: "Avec le réglage « Valeurs des indicateurs » du graphique, le niveau actuel de la ligne — le stop en vigueur — s'affiche sur l'axe des prix.", tab: "Style" },
      LEGEND_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
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
      { label: "Pas", defaultValue: "0,02", range: "0,01 à 1", description: "Valeur de départ du facteur d'accélération, et incrément ajouté à chaque nouvel extrême de la tendance. **Augmenter le pas rend l'outil plus agressif** : les points rattrapent le prix plus vite et les sorties arrivent plus tôt, avec davantage de retournements prématurés. Un pas plus petit (0,01) laisse plus de marge aux tendances lentes.", tab: "Entrées" },
      { label: "Maximum", defaultValue: "0,2", range: "0,05 à 1", description: "Plafond du facteur d'accélération : au-delà, les points ne se rapprochent plus plus vite. Un plafond bas garde le stop à distance dans les tendances longues ; un plafond élevé le colle au prix dans les mouvements rapides. 0,02 et 0,2 sont les valeurs de Wilder.", tab: "Entrées" },
      { label: "Points", defaultValue: "Affichés, couleurs de hausse et de baisse du graphique", description: "La case affiche ou masque les points. « Hausse » colore les points situés sous la clôture, « Baisse » ceux au-dessus. Sans choix, ils suivent les couleurs de hausse et de baisse des bougies.", tab: "Style" },
      { label: "Valeurs des indicateurs", defaultValue: "Selon le graphique", description: "Avec le réglage « Valeurs des indicateurs » du graphique, le niveau du dernier point — le stop en vigueur — s'affiche sur l'axe des prix.", tab: "Style" },
      LEGEND_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
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
    params: [
      { label: "Écart minimum", defaultValue: "0,1 %", range: "0 à 20 %", description: "Taille minimale du vide, en pourcentage du prix de la bougie précédente (son plus haut pour un gap haussier, son plus bas pour un gap baissier). À 0, le moindre écart compte ; le monter filtre les écarts anecdotiques d'une série intraday bruitée. En données quotidiennes, 0,5 à 1 % ne garde que les gaps qui comptent.", tab: "Entrées" },
      { label: "Gaps", defaultValue: "Affichés", description: "La case affiche ou masque les rectangles. Ils prennent toujours la couleur de hausse (gap haussier) ou de baisse (gap baissier) du graphique, plus pâle une fois le gap comblé ; la couleur du sélecteur ne colore que le nom de l'indicateur dans la légende.", tab: "Style" },
      LEGEND_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
    ],
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
    params: [
      { label: "Date limite", defaultValue: "Dernière bougie", description: "Fin de la fenêtre analysée (les 20 bougies qui s'achèvent à cette date). Sans date, elle suit la dernière bougie et avance toute seule à chaque nouvelle bougie. Une date passée montre ce que l'indicateur détectait ce jour-là, pour étudier la suite ; le lien « dernière bougie » rétablit le suivi automatique.", tab: "Entrées" },
      { label: "Pattern Recognition", defaultValue: "Affiché, couleur de la palette", description: "La case affiche ou masque les figures. Les figures haussières prennent la couleur de hausse du graphique, les baissières celle de baisse ; la couleur du sélecteur sert aux figures neutres (triangle symétrique, diamant) et au nom dans la légende. Les tracés ont une épaisseur fixe.", tab: "Style" },
      LEGEND_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
    ],
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
    params: [
      { label: "Date limite", defaultValue: "Dernière bougie", description: "La bougie analysée. Sans date, c'est la dernière bougie, et l'analyse se met à jour à chaque nouvelle bougie. Une date passée montre quelle figure s'était formée ce jour-là, et permet de voir ce qui a suivi ; le lien « dernière bougie » rétablit le suivi automatique.", tab: "Entrées" },
      { label: "Candle Recognition", defaultValue: "Affiché", description: "La case affiche ou masque l'étiquette. Sa couleur suit la figure : couleur de hausse pour une figure haussière, de baisse pour une baissière, neutre pour le doji ; la couleur du sélecteur ne colore que le nom de l'indicateur dans la légende.", tab: "Style" },
      LEGEND_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
    ],
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
      { label: "Conversion", defaultValue: "9", range: "1 à 100 bougies", description: "Période de la Tenkan, la ligne de conversion : milieu entre le plus haut et le plus bas de ces bougies. Plus courte, elle colle au prix et croise la Kijun plus souvent ; plus longue, elle filtre les petites oscillations.", tab: "Entrées" },
      { label: "Base", defaultValue: "26", range: "1 à 200 bougies", description: "Période de la Kijun, la ligne de base et l'équilibre de moyen terme. Elle entre aussi dans le calcul de la Senkou A, donc dans le nuage.", tab: "Entrées" },
      { label: "Span B", defaultValue: "52", range: "1 à 300 bougies", description: "Période de la Senkou B, la frontière lente du nuage. Plus elle est longue, plus le nuage est épais et stable, et plus ses paliers plats font des supports et résistances durables.", tab: "Entrées" },
      { label: "Déplacement", defaultValue: "26", range: "1 à 200 bougies", description: "Décalage du nuage vers l'avant et de la Chikou vers l'arrière. Les valeurs 9, 26, 52 et 26 viennent de l'ancienne semaine boursière japonaise de six séances ; si vous les adaptez, changez-les ensemble pour garder leurs proportions.", tab: "Entrées" },
      { label: "Ichimoku", defaultValue: "Affiché", description: "La case affiche ou masque l'indicateur. Les lignes et le nuage ont des couleurs fixes : Tenkan orange, Kijun bleue, Senkou A dans la couleur de hausse du graphique, Senkou B dans celle de baisse, Chikou grise en tirets ; le nuage prend la couleur de hausse quand Senkou A est au-dessus de Senkou B, de baisse sinon. La couleur du sélecteur ne colore que le nom de l'indicateur dans la légende.", tab: "Style" },
      { label: "Valeurs des indicateurs", defaultValue: "Selon le graphique", description: "Avec le réglage « Valeurs des indicateurs » du graphique, les dernières valeurs de la Tenkan, de la Kijun et de la Senkou A s'affichent sur l'axe des prix.", tab: "Style" },
      LEGEND_HELP_PARAM,
      STYLE_RULES_HELP_PARAM,
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
      { label: "Type", defaultValue: "Classic", description: "La formule de la grille : **Classic** (la référence, la plus regardée), **Fibonacci** (niveaux à 38,2 %, 61,8 % et 100 % de l'amplitude), **Woodie** (clôture comptée double, grille rapprochée du dernier prix) ou **Camarilla** (niveaux serrés autour de la clôture, pour le très court terme). Choisissez celle que suivent les intervenants de votre marché.", tab: "Entrées" },
      { label: "Période de référence", defaultValue: "Hebdomadaire", description: "Journalière, hebdomadaire ou mensuelle : la période dont le plus haut, le plus bas et la clôture servent au calcul, et pendant laquelle la grille reste fixe. Journalière pour l'intraday, hebdomadaire ou mensuelle sur des bougies quotidiennes (une grille journalière y changerait à chaque bougie).", tab: "Entrées" },
      { label: "Pivots (ligne du tracé)", defaultValue: "Affiché, couleur de la palette", description: "La case affiche ou masque l'indicateur. Le sélecteur règle la couleur du pivot central (PP) ; les supports et les résistances gardent une teinte neutre, pour que le pivot ressorte.", tab: "Style" },
      { label: "Afficher dans la légende", defaultValue: "Oui", description: "Montre ou retire l'indicateur de la légende en haut du graphique, sans changer le tracé.", tab: "Style" },
      { label: "Dernier pivot seulement", defaultValue: "Non", description: "Ne garde que la grille de la période en cours et masque celles des périodes passées. Utile pour alléger le graphique quand seuls les niveaux du jour (ou de la semaine) comptent.", tab: "Style" },
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
      PERIOD(100, "Nombre de bougies, à partir de la plus récente, dans lesquelles sont cherchés les sommets et les creux (10 au minimum, même si une valeur plus petite est saisie). Une fenêtre plus longue fait ressortir des niveaux plus anciens et plus éprouvés ; une fenêtre plus courte s'en tient à la structure récente."),
      { label: "Nombre de niveaux", defaultValue: "6", range: "1 à 20", description: "Nombre maximal de niveaux tracés, les plus touchés d'abord. L'augmenter fait apparaître des niveaux moins touchés, donc moins structurants ; le réduire ne garde que l'essentiel.", tab: "Entrées" },
      { label: "S/R (ligne du tracé)", defaultValue: "Affiché", description: "La case affiche ou masque l'indicateur. Les couleurs sont propres à l'indicateur : couleur de hausse pour un niveau sous la dernière clôture (support), couleur de baisse pour un niveau au-dessus (résistance).", tab: "Style" },
      { label: "Afficher dans la légende", defaultValue: "Oui", description: "Montre ou retire l'indicateur de la légende en haut du graphique, sans changer le tracé.", tab: "Style" },
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
      PERIOD(14, "Longueur des lissages de Wilder, pour les deux DI comme pour l'ADX. 14 est la valeur d'origine ; une période plus courte rend l'ADX plus réactif mais plus agité, une période plus longue le rend plus stable et plus tardif."),
      { label: "Tendance forte", defaultValue: "25", range: "5 à 60", description: "Niveau de la ligne pointillée du panneau, au-dessus duquel on considère qu'une tendance est établie. 25 est le repère usuel ; certains préfèrent 20 pour être prévenus plus tôt, ou 30 pour ne garder que les tendances nettes.", tab: "Entrées" },
      { label: "Prolonger l'indicateur en pointillés", defaultValue: "Non", description: "Section « Projection » : prolonge les courbes au-delà de la dernière bougie, en pointillés. C'est une extrapolation des valeurs passées de l'indicateur, pas une prévision de marché.", tab: "Entrées" },
      { label: "Méthode", defaultValue: "Régression linéaire", description: "Projection : régression linéaire, dérive (pas moyen), lissage de Holt ou dernière valeur tenue. Sur une série bornée comme l'ADX, « Dernière valeur tenue » est souvent la référence la plus honnête.", tab: "Entrées" },
      { label: "Bougies projetées", defaultValue: "12", range: "1 à 200", description: "Projection : nombre de bougies sur lesquelles la courbe est prolongée.", tab: "Entrées" },
      { label: "Historique utilisé", defaultValue: "30", range: "2 à 500 bougies", description: "Projection : nombre de valeurs passées sur lesquelles la projection est ajustée.", tab: "Entrées" },
      { label: "Amortissement", defaultValue: "0,85", range: "0 à 1", description: "Projection (sauf « Dernière valeur tenue ») : 1 garde toute la pente, 0 l'abandonne tout de suite ; entre les deux, la projection s'aplatit peu à peu.", tab: "Entrées" },
      { label: "ADX", defaultValue: "Affiché, couleur de la palette", description: "La case affiche ou masque l'indicateur. Le sélecteur règle la couleur de la ligne de l'ADX, tracée plus épaisse que les deux DI.", tab: "Style" },
      { label: "+DI / −DI", defaultValue: "Couleurs de hausse et de baisse du graphique", description: "Couleurs des deux lignes directionnelles : +DI (pression acheteuse) et −DI (pression vendeuse).", tab: "Style" },
      { label: "Format", defaultValue: "Automatique (k / M / B)", description: "Rubrique « Valeurs » : format des nombres de l'axe et de la légende du panneau — automatique, nombre entier, décimales fixes (avec leur précision, 2 par défaut), pourcentage ou brut.", tab: "Style" },
      { label: "Afficher dans la légende", defaultValue: "Oui", description: "Montre ou retire l'indicateur de la légende du panneau, sans changer le tracé.", tab: "Style" },
      { label: "Filigrane du panneau", defaultValue: "Non", description: "Écrit un texte en grand au fond du panneau, par défaut le nom de l'indicateur. Une fois coché, le texte, l'opacité (8 % par défaut) et la taille se règlent.", tab: "Style" },
      { label: "Style conditionnel", defaultValue: "Aucune règle", description: "Colore une courbe, l'espace entre deux courbes ou le fond, ou pose une icône, quand une condition est vraie : par exemple l'ADX au-dessus de 25, ou +DI qui croise −DI.", tab: "Style" },
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
      PERIOD(22, "Nombre de bougies sur lesquelles sont relevés le plus haut et le plus bas, et période de l'ATR. 22 correspond à environ un mois de séances ; plus court, le stop colle davantage au prix et bascule plus souvent."),
      { label: "Multiplicateur", defaultValue: "3", range: "0,5 à 10 × ATR", description: "Distance entre l'extrême et le stop, en ATR. 3 laisse respirer une tendance ordinaire ; un multiplicateur plus petit protège mieux le gain mais sort plus souvent pour rien, un plus grand convient aux marchés nerveux et aux positions de fond.", tab: "Entrées" },
      { label: "Extrêmes sur les clôtures", defaultValue: "Oui", description: "Coché, le plus haut et le plus bas de la fenêtre sont pris sur les clôtures, comme dans le script d'origine : le stop ignore les mèches isolées. Décoché, ils sont pris sur les mèches (plus hauts et plus bas), ce qui place le stop un peu plus loin du prix.", tab: "Entrées" },
      { label: "Stop", defaultValue: "Affiché, couleurs de hausse et de baisse", description: "La case affiche ou masque l'indicateur. Deux couleurs : « Hausse » pour le stop long (sous les cours) et les signaux d'achat, « Baisse » pour le stop court (au-dessus) et les signaux de vente.", tab: "Style" },
      { label: "Afficher dans la légende", defaultValue: "Oui", description: "Montre ou retire l'indicateur de la légende en haut du graphique, sans changer le tracé.", tab: "Style" },
      { label: "Libellés Achat / Vente", defaultValue: "Oui", description: "Une étiquette « Achat » ou « Vente » à chaque changement de sens. Décoché, il ne reste qu'un point sur le stop, plus discret sur un graphique chargé.", tab: "Style" },
      { label: "Surligner l'état (remplissage)", defaultValue: "Oui", description: "Teinte légèrement la zone entre le prix et le stop actif, dans la couleur du sens en cours, pour lire le régime d'un coup d'œil.", tab: "Style" },
    ],
    related: ["supertrend", "atr", "parabolicSar"],
  },
  expectedVolatility: {
    formula: [
      "Période : un jour de 00:00 à 23:59 dans le fuseau choisi (« 1 jour »), une bougie de l'échelle choisie (15 min à 4 h), ou chaque bougie (échelle courante)",
      "Bougies de l'échelle : O = 1ʳᵉ ouverture, H = plus haut, L = plus bas, C = dernière clôture des bougies de la période",
      "TR(k) = H(k) − L(k) sur la 1ʳᵉ bougie, puis max(H(k) − L(k), |H(k) − C(k−1)|, |L(k) − C(k−1)|)",
      "ATR(k) : moyenne simple des N premiers TR, puis ATR(k) = (ATR(k−1) × (N − 1) + TR(k)) / N (Wilder)",
      "SMA(k) = moyenne simple des M derniers ATR",
      "Pour la période k : A = ATR(k−1), S = SMA(k−1) (dernière bougie clôturée de l'échelle) ; O = ouverture de la période",
      "Médiane = O ; haut / bas ATR = O ± A ; haut / bas SMA = O ± S",
    ],
    formulaNotes:
      "Les valeurs sont **figées** pour toute la période. La période en cours est prolongée jusqu'à sa fin prévue (autant de bougies que les périodes complètes en comptent le plus souvent). Seules les N dernières périodes sont tracées ; hors « 1 jour », seule la dernière garde ses étiquettes. Porté du script Pine « Volatilité attendue du jour (ATR) ».",
    params: [
      { label: "Période de l'ATR", defaultValue: "9", range: "1 à 500 bougies", description: "Longueur du lissage de Wilder de l'ATR, sur les bougies de l'échelle choisie. Plus courte, la bande ATR suit de près la volatilité des dernières périodes ; plus longue, elle se rapproche de la bande de la moyenne.", tab: "Entrées" },
      { label: "Période de la SMA de l'ATR", defaultValue: "14", range: "1 à 500 bougies", description: "Nombre d'ATR moyennés pour la seconde bande, l'amplitude habituelle sur un horizon plus long. C'est l'écart entre les deux bandes qui dit si la volatilité récente est au-dessus ou en dessous de sa normale.", tab: "Entrées" },
      { label: "Échelle de temps de l'ATR (et durée des lignes)", defaultValue: "Échelle courante", description: "Échelle courante, 15 minutes, 30 minutes, 1 heure, 4 heures ou 1 jour : l'unité des bougies sur lesquelles l'ATR est calculé, et la durée pendant laquelle chaque jeu de niveaux reste fixe. « 1 jour » sur un graphique intraday donne la volatilité attendue de la journée ; une échelle qui n'est pas plus large que celle du graphique revient à l'échelle courante.", tab: "Entrées" },
      { label: "Fuseau horaire de la journée (00:00 → 23:59)", defaultValue: "Europe/Paris", description: "Fuseau qui découpe les journées avec l'échelle « 1 jour » : une journée va de 00:00 à 23:59 dans ce fuseau. Nom IANA (Europe/Paris, America/New_York…) ; un nom inconnu compte en UTC.", tab: "Entrées" },
      { label: "Nombre de séances affichées", defaultValue: "5", range: "1 à 60", description: "Nombre de périodes, les plus récentes, pour lesquelles les niveaux sont tracés. Augmentez-le pour comparer l'amplitude prévue et l'amplitude réelle sur davantage de séances.", tab: "Entrées" },
      { label: "ATR (ouverture ± ATR)", defaultValue: "Affiché, orange", description: "La case affiche ou masque l'indicateur. Le sélecteur règle la couleur des niveaux ouverture + ATR et ouverture − ATR, en trait plein.", tab: "Style" },
      { label: "SMA de l'ATR", defaultValue: "Affichée, cyan", description: "La case affiche ou masque les niveaux ouverture ± moyenne de l'ATR, en tirets ; le sélecteur règle leur couleur.", tab: "Style" },
      { label: "Ligne médiane (ouverture de la période)", defaultValue: "Affichée, grise", description: "La case affiche ou masque la ligne pointillée de l'ouverture de chaque période ; le sélecteur règle sa couleur.", tab: "Style" },
      { label: "Épaisseur des lignes", defaultValue: "2 px", range: "1 à 5 px", description: "Épaisseur commune à toutes les lignes de l'indicateur.", tab: "Style" },
      { label: "Afficher dans la légende", defaultValue: "Oui", description: "Montre ou retire l'indicateur de la légende en haut du graphique, sans changer le tracé. La légende donne l'ATR et sa moyenne de la période survolée.", tab: "Style" },
      { label: "Afficher aussi le bas attendu (ouverture − ATR)", defaultValue: "Oui", description: "Décoché, seuls les niveaux hauts (ouverture + ATR et ouverture + moyenne) sont tracés : utile quand on ne joue qu'à la hausse, ou pour alléger le graphique.", tab: "Style" },
      { label: "Afficher les étiquettes de valeur", defaultValue: "Oui", description: "Une étiquette « Volatilité attendue - … » avec le niveau, au bout de chaque ligne. Hors échelle « 1 jour », seule la dernière période garde ses étiquettes.", tab: "Style" },
    ],
    related: ["atr", "bollinger", "pivotPoints", "supertrend"],
  },
  rangeDetection: {
    formula: [
      "Volume : Vc = SMA(volume, 10), Vl = SMA(volume, 30) ; établie si Vc < 0,9 × Vl, commence si Vc baisse sur s bougies et Vc < Vl",
      "Volatilité : A = ATR(14) / clôture, R = rang centile de A sur les 100 dernières bougies ; établie si R ≤ 25, commence si A baisse sur s bougies et (sa baisse s'accélère ou R ≤ 50)",
      "CHOP : C = 100 × log10(Σ TR(14) / (plus haut − plus bas sur 14)) / log10(14) ; établie si C ≥ 61,8, commence si C ≥ 50 et C monte sur s bougies",
      "Score = (Σ conditions : 1 si établie, ½ si elle commence) / conditions calculables × 100",
      "Range probable : au moins 2 conditions lancées (qui commencent ou établies), sur 2 bougies de suite si aucune n'est encore établie ; range confirmé : toutes lancées et au moins 2 établies ; aucun range si C < 38,2 (tendance franche)",
      "Zone : de la 1ʳᵉ bougie détectée jusqu'à la fin du range ; haut = plus haut des bougies de la zone, bas = plus bas",
      "Fin de zone : clôture > haut + k × ATR ou < bas − k × ATR (cassure), ou plus de g bougies sans signal",
    ],
    formulaNotes:
      "Un CHOP **élevé** signale un range : l'indicateur s'appuie donc sur sa **montée** au-dessus de 50 puis de 61,8 (la « baisse du CHOP » au sens courant annonce au contraire une tendance). Sans volume pour le symbole, la condition de volume ne compte pas et les deux autres doivent concorder. Une zone terminée plus courte que la durée minimale est écartée ; la zone en cours est toujours tracée.",
    params: [
      { label: "Période du CHOP", defaultValue: "14", range: "2 à 200 bougies", description: "Fenêtre du Choppiness Index. Plus longue, le CHOP réagit moins aux à-coups et ne signale que des ranges plus durables ; plus courte, il repère des pauses plus brèves.", tab: "Entrées" },
      { label: "Période de l'ATR", defaultValue: "14", range: "1 à 200 bougies", description: "Lissage de Wilder de l'ATR, rapporté au cours, qui mesure la volatilité. Il sert aussi à mesurer la distance de cassure.", tab: "Entrées" },
      { label: "Fenêtre de comparaison de la volatilité", defaultValue: "100", range: "20 à 1000 bougies", description: "Nombre de bougies parmi lesquelles l'ATR du moment est classé. Une fenêtre longue compare la volatilité à un historique large ; une fenêtre courte au seul régime récent.", tab: "Entrées" },
      { label: "Moyenne courte du volume", defaultValue: "10", range: "1 à 200 bougies", description: "La moyenne du volume récent, comparée à la moyenne longue : quand elle passe nettement dessous, les volumes se contractent.", tab: "Entrées" },
      { label: "Moyenne longue du volume", defaultValue: "30", range: "2 à 500 bougies", description: "La référence du volume habituel. Elle doit rester nettement plus longue que la moyenne courte.", tab: "Entrées" },
      { label: "Écart des pentes (précocité)", defaultValue: "3", range: "1 à 20 bougies", description: "Nombre de bougies sur lesquelles se lisent les pentes (volume en baisse, ATR en baisse, CHOP en hausse). Plus court, la détection est plus précoce, au prix de fausses alertes ; plus long, elle est plus sûre mais plus tardive.", tab: "Entrées" },
      { label: "CHOP : début de range (s'il monte)", defaultValue: "50", range: "30 à 90", description: "Au-dessus de ce niveau, un CHOP en hausse fait « commencer » la condition. Abaissé, il prévient plus tôt ; relevé, il attend un marché plus nettement haché.", tab: "Entrées" },
      { label: "CHOP : range établi", defaultValue: "61,8", range: "40 à 99", description: "Au-dessus de ce niveau, la condition du CHOP est établie. 61,8 est la borne haute usuelle du Choppiness Index.", tab: "Entrées" },
      { label: "CHOP : tendance franche (aucun range) sous", defaultValue: "38,2", range: "1 à 50", description: "Veto : sous ce niveau, et tant qu'il ne remonte pas, le marché est jugé directionnel et aucun range n'est annoncé, quoi que disent le volume et la volatilité. 38,2 est la borne basse usuelle du CHOP.", tab: "Entrées" },
      { label: "Volatilité contractée sous le centile", defaultValue: "25 %", range: "5 à 60 %", description: "La volatilité est jugée contractée quand l'ATR du moment se classe dans ce pourcentage des valeurs les plus basses de sa fenêtre. Plus bas, seules les compressions marquées comptent.", tab: "Entrées" },
      { label: "Cassure au-delà de", defaultValue: "1 × ATR", range: "0 à 5 × ATR", description: "Distance de clôture hors du rectangle qui termine la zone par une cassure. Vérifiée une fois la zone longue de la durée minimale ; avant, le rectangle s'élargit. Plus grande, la zone tolère des débordements ; à 0, la première clôture dehors suffit.", tab: "Entrées" },
      { label: "Bougies sans signal tolérées", defaultValue: "5", range: "0 à 30", description: "Nombre de bougies sans range que la zone traverse avant d'être close. Plus élevé, les rectangles survivent aux brèves interruptions ; à 0, la zone s'arrête dès la première bougie sans signal.", tab: "Entrées" },
      { label: "Durée minimale d'une zone terminée", defaultValue: "5", range: "1 à 100 bougies", description: "Une zone terminée plus courte est écartée, comme du bruit. La zone en cours est toujours montrée.", tab: "Entrées" },
      { label: "Zones de range confirmé", defaultValue: "Affichées, bleu", description: "La case affiche ou masque l'indicateur. Le sélecteur règle la couleur des zones confirmées, tracées en trait plein.", tab: "Style" },
      { label: "Zones de range probable (détection précoce)", defaultValue: "Affichées, orange", description: "La case affiche ou masque les zones restées au stade probable, tracées en tirets ; le sélecteur règle leur couleur. Masquez-les pour ne garder que les ranges confirmés.", tab: "Style" },
      { label: "Opacité du fond", defaultValue: "12 %", range: "0 à 100 %", description: "Opacité du fond des rectangles. À 0, seuls les contours restent.", tab: "Style" },
      { label: "Afficher dans la légende", defaultValue: "Oui", description: "Montre ou retire l'indicateur de la légende en haut du graphique. La légende donne l'état et le score de la bougie survolée.", tab: "Style" },
      { label: "Libellés des zones (état, score, cassure)", defaultValue: "Oui", description: "Écrit au-dessus de chaque rectangle son état (probable ou confirmé), le score de la zone en cours, et la cassure qui l'a terminée (« cassure ↑ » ou « cassure ↓ »).", tab: "Style" },
      { label: "Ligne médiane des zones", defaultValue: "Oui", description: "Une ligne pointillée au milieu de chaque rectangle, à mi-chemin entre son plus haut et son plus bas : le pivot autour duquel le range oscille.", tab: "Style" },
    ],
    related: ["chop", "atr", "bollinger", "supportResistance"],
  },
  srBounce: {
    formula: [
      "Pivots : bougie dont le plus haut (ou le plus bas) dépasse celui des s bougies de chaque côté, sur les P dernières bougies",
      "Zone : pivots regroupés par prix à 0,5 × ATR près, au moins 2 pivots ; épaisseur minimale 0,25 × ATR",
      "Contact passé tenu : le prix s'éloigne d'au moins 1 ATR du côté d'où il venait, dans les h bougies ; cédé : clôture à plus de 0,5 ATR de l'autre côté",
      "Note = logit((tenus + 1) / (tenus + cédés + 2)) + pivots + ADX + ATR + moyennes dans la zone + tendance des moyennes + Bollinger",
      "Probabilité de rebond = 1 / (1 + e^(−Note)), bornée entre 5 et 95 %",
    ],
    formulaNotes:
      "Facteurs, en logit : **pivots** +0,12 par pivot au-delà de 2 (au plus +0,5) ; **ADX** ≥ 25 vers la zone −0,4 à −0,9, ≥ 25 s'en éloignant +0,2, < 20 +0,3 ; **ATR** à plus de 130 % de sa moyenne sur 50 bougies −0,4, sous 80 % +0,15 ; **moyennes** +0,25 par EMA, SMA ou SMA longue à moins d'une demi-ATR de la zone ; **tendance** ±0,25 (prix face à la SMA longue) et ±0,15 (EMA face à la SMA) selon que la tendance soutient ou non le rôle de la zone ; **Bollinger** +0,3 si la bande du bon côté est dans la zone, −0,3 si la largeur des bandes est dans les 20 % les plus basses des 120 dernières bougies. Les zones gardées sont les plus proches du prix. L'effet affiché de chaque facteur est l'écart, en points, entre la probabilité finale et celle obtenue sans lui.",
    params: [
      { label: "Bougies analysées", defaultValue: "200", range: "30 à 2000", description: "La fenêtre dans laquelle les zones sont cherchées et leurs contacts passés comptés. Plus longue, elle trouve des niveaux anciens et un historique plus fourni ; plus courte, elle colle à la structure récente.", tab: "Entrées" },
      { label: "Nombre de zones", defaultValue: "6", range: "1 à 20", description: "Combien de zones afficher : les plus proches du prix actuel sont gardées, car c'est là que se jouera le prochain contact.", tab: "Entrées" },
      { label: "Largeur des pivots", defaultValue: "3 bougies", range: "1 à 10", description: "Un sommet ou un creux doit dépasser ce nombre de bougies de chaque côté. Plus grand, seuls les pivots marquants comptent et les zones sont moins nombreuses.", tab: "Entrées" },
      { label: "Horizon d'un contact", defaultValue: "10 bougies", range: "2 à 60", description: "Le délai laissé au prix, après un contact passé, pour rebondir d'1 ATR ou casser la zone. Au-delà, le contact n'est compté ni comme rebond ni comme cassure.", tab: "Entrées" },
      { label: "Période de l'ATR", defaultValue: "14", range: "2 à 200", description: "L'ATR sert d'unité partout : regroupement des pivots, épaisseur minimale des zones, rebond (1 ATR) et cassure (0,5 ATR), régime de volatilité.", tab: "Entrées" },
      { label: "Période de l'ADX", defaultValue: "14", range: "2 à 200", description: "Force de la tendance et sens des ±DI : une tendance forte dirigée vers la zone réduit la probabilité de rebond.", tab: "Entrées" },
      { label: "Période de l'EMA", defaultValue: "20", range: "2 à 500", description: "La moyenne exponentielle courte : confluence avec la zone et, face à la SMA, sens de la tendance de court terme.", tab: "Entrées" },
      { label: "Période de la SMA", defaultValue: "50", range: "2 à 500", description: "La moyenne simple intermédiaire : confluence avec la zone et référence de la tendance de court terme.", tab: "Entrées" },
      { label: "Période de la SMA longue", defaultValue: "200", range: "2 à 1000", description: "La tendance de fond : un support tient mieux au-dessus, une résistance au-dessous.", tab: "Entrées" },
      { label: "Période et écart-type de Bollinger", defaultValue: "20 et 2", range: "2 à 500 ; 0,5 à 5", description: "Position des bandes face à la zone (prix étiré) et resserrement des bandes (cassure à venir).", tab: "Entrées" },
      { label: "Supports", defaultValue: "Vert", description: "La case affiche ou masque l'indicateur ; le sélecteur règle la couleur des zones sous le prix.", tab: "Style" },
      { label: "Résistances", defaultValue: "Rouge", description: "La couleur des zones au-dessus du prix.", tab: "Style" },
      { label: "Opacité du fond", defaultValue: "14 %", range: "0 à 100", description: "Transparence du fond des zones, modulée par la probabilité : une zone solide est plus marquée qu'une zone fragile.", tab: "Style" },
      { label: "Libellés des zones", defaultValue: "Oui", description: "Écrit à droite de chaque zone son rôle, son prix et sa probabilité de rebond.", tab: "Style" },
      { label: "Détail du calcul", defaultValue: "Non", description: "Écrit sous chaque libellé les trois facteurs qui pèsent le plus sur la probabilité, avec leur effet en points (par exemple « Historique de la zone +28 · ADX −9 »).", tab: "Style" },
      LEGEND_HELP_PARAM,
    ],
    related: ["supportResistance", "adx", "atr", "bollinger"],
  },
  correlation: {
    formula: [
      "B(t) = clôture du symbole de comparaison, reportée sur chaque bougie (dernière valeur connue)",
      "r(t) = Σ (C(i) − C̄)(B(i) − B̄) / √( Σ (C(i) − C̄)² × Σ (B(i) − B̄)² ), sur les N dernières bougies",
    ],
    formulaNotes:
      "C'est le coefficient de Pearson, calculé sur les **niveaux** de clôture (pas sur les variations). Pas de valeur tant que la série comparée n'a pas commencé, ni quand l'une des deux séries est constante sur la fenêtre.",
    params: [
      { label: "Symbole de comparaison", defaultValue: "À choisir", description: "Le second instrument, demandé à l'ajout de l'indicateur ; il n'apparaît pas dans la fenêtre de paramètres. Pour comparer à un autre symbole, ajoutez un nouvel indicateur de corrélation.", tab: "Entrées" },
      PERIOD(20, "Longueur de la fenêtre glissante. Une fenêtre courte réagit vite mais donne des valeurs instables ; une fenêtre longue lisse au point de masquer une rupture récente. 20 bougies correspondent à environ un mois de séances en données quotidiennes."),
      { label: "Corrélation forte", defaultValue: "0,7", range: "0,1 à 1", description: "Position des deux lignes pointillées, à plus et moins ce seuil. 0,7 est un repère courant ; relevez-le pour ne retenir que des liens très étroits.", tab: "Entrées" },
      { label: "Prolonger l'indicateur en pointillés", defaultValue: "Non", description: "Section « Projection » : prolonge la courbe au-delà de la dernière bougie, en pointillés. C'est une extrapolation des valeurs passées de l'indicateur, pas une prévision de marché.", tab: "Entrées" },
      { label: "Méthode", defaultValue: "Régression linéaire", description: "Projection : régression linéaire, dérive (pas moyen), lissage de Holt ou dernière valeur tenue. Sur une série bornée comme la corrélation, « Dernière valeur tenue » est souvent la référence la plus honnête.", tab: "Entrées" },
      { label: "Bougies projetées", defaultValue: "12", range: "1 à 200", description: "Projection : nombre de bougies sur lesquelles la courbe est prolongée.", tab: "Entrées" },
      { label: "Historique utilisé", defaultValue: "30", range: "2 à 500 bougies", description: "Projection : nombre de valeurs passées sur lesquelles la projection est ajustée.", tab: "Entrées" },
      { label: "Amortissement", defaultValue: "0,85", range: "0 à 1", description: "Projection (sauf « Dernière valeur tenue ») : 1 garde toute la pente, 0 l'abandonne tout de suite ; entre les deux, la projection s'aplatit peu à peu.", tab: "Entrées" },
      { label: "Corr (ligne du tracé)", defaultValue: "Affiché, couleur de la palette", description: "La case affiche ou masque l'indicateur. Le sélecteur règle la couleur et l'épaisseur de la courbe.", tab: "Style" },
      { label: "Format", defaultValue: "Automatique (k / M / B)", description: "Rubrique « Valeurs » : format des nombres de l'axe et de la légende du panneau — automatique, nombre entier, décimales fixes (avec leur précision, 2 par défaut), pourcentage ou brut.", tab: "Style" },
      { label: "Afficher dans la légende", defaultValue: "Oui", description: "Montre ou retire l'indicateur de la légende du panneau, sans changer le tracé.", tab: "Style" },
      { label: "Filigrane du panneau", defaultValue: "Non", description: "Écrit un texte en grand au fond du panneau, par défaut le nom de l'indicateur — pratique pour rappeler le symbole comparé. Une fois coché, le texte, l'opacité (8 % par défaut) et la taille se règlent.", tab: "Style" },
      { label: "Style conditionnel", defaultValue: "Aucune règle", description: "Colore la courbe ou le fond, ou pose une icône, quand une condition est vraie : par exemple une corrélation au-dessus de 0,7 ou sous −0,7.", tab: "Style" },
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
      { label: "Taille du bloc", defaultValue: "30 min", range: "1 à 1440 min", description: "Durée d'un bloc, l'unité de temps qui dépose une marque. 30 minutes est la valeur historique du Market Profile. Des blocs plus courts donnent plus de marques et un profil plus fin ; des blocs plus longs, un profil plus grossier.", tab: "Entrées" },
      { label: "Lignes de prix", defaultValue: "24", range: "5 à 100", description: "Nombre de lignes égales entre le plus bas et le plus haut de chaque séance. Plus de lignes affinent le profil, mais dispersent les marques et rendent le POC moins net.", tab: "Entrées" },
      { label: "Zone de valeur", defaultValue: "70 %", range: "1 à 100 %", description: "Part des marques que la zone de valeur doit regrouper autour du POC. 70 % est la convention du Market Profile ; plus élevée, la zone s'élargit vers les extrémités.", tab: "Entrées" },
      { label: "Étiquettes", defaultValue: "Lettres", description: "Lettres (A, B, C…, qui recommencent après Z) ou chiffres (1, 2, 3…) pour nommer les blocs dans les cellules. Les étiquettes n'apparaissent que si les cellules sont assez grandes.", tab: "Entrées" },
      { label: "TPO (ligne du tracé)", defaultValue: "Affiché", description: "La case affiche ou masque l'indicateur. Les couleurs sont propres à l'indicateur : un dégradé qui évolue du premier au dernier bloc de chaque séance, avec des marques plus pâles hors de la zone de valeur.", tab: "Style" },
      { label: "Opacité", defaultValue: "100 %", range: "10 à 100 %", description: "Transparence de tout le profil ; les marques hors de la zone de valeur restent plus pâles que celles de l'intérieur, quelle que soit l'opacité. Baissez-la pour garder les bougies lisibles sous le profil.", tab: "Style" },
      { label: "Afficher dans la légende", defaultValue: "Oui", description: "Montre ou retire l'indicateur de la légende en haut du graphique, sans changer le tracé.", tab: "Style" },
      { label: "Séparer les blocs", defaultValue: "Oui", description: "Un léger espace entre les cellules de deux blocs voisins, pour distinguer chaque bloc. Décoché, les marques d'une ligne forment une barre continue, plus proche d'un histogramme.", tab: "Style" },
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

const isLimits = (title: string): boolean => /^ce qu['’](il|elle|ils|elles) ne di/i.test(title);
const isSettings = (title: string): boolean => /^(réglages|affichage)$/i.test(title);
const isHistory = (title: string): boolean => /^histoire$/i.test(title);
const isBasics = (title: string): boolean => /^les bases$/i.test(title);
const isLookFor = (title: string): boolean => /^ce qu['’]il faut rechercher$/i.test(title);
const isSummary = (title: string): boolean => /^résumé$/i.test(title);
const isNamed = (title: string): boolean => isLimits(title) || isSettings(title) || isHistory(title) || isBasics(title) || isLookFor(title) || isSummary(title);

/** « Ce qu'il faut rechercher » : le texte avant le premier `### `, puis un cas par sous-titre. */
function splitCases(body: string): { intro: string; cases: { title: string; body: string }[] } {
  const parts = body.split(/^### /m);
  return {
    intro: parts[0].trim(),
    cases: parts.slice(1).map((part) => {
      const newline = part.indexOf("\n");
      return newline < 0 ? { title: part.trim(), body: "" } : { title: part.slice(0, newline).trim(), body: part.slice(newline + 1).trim() };
    }),
  };
}

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
    history: sections.find((s) => isHistory(s.title))?.body ?? null,
    basics: sections.find((s) => isBasics(s.title))?.body ?? null,
    lookFor: (() => {
      const part = sections.find((s) => isLookFor(s.title));
      return part ? splitCases(part.body) : null;
    })(),
    summary: sections.find((s) => isSummary(s.title))?.body ?? null,
    reading: sections.filter((s) => !isNamed(s.title)),
    limits: sections.find((s) => isLimits(s.title))?.body ?? null,
    settingsNotes: sections.find((s) => isSettings(s.title))?.body ?? null,
    script: INDICATOR_SCRIPT_SOURCES[kind] ?? null,
    ...details,
    related: details.related.filter((k) => k !== kind && hasIndicatorHelp(k)),
  };
}
