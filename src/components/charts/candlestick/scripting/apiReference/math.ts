import { fns, t, type ScriptReferenceSection } from "./blocks";

/** `math.*` — les statistiques, une entrée par fonction. */
export const MATH_SECTION: ScriptReferenceSection = {
  id: "math",
  title: "math.*",
  group: "Fonctions utilitaires",
  blocks: [
    t(
      "Des statistiques sur des tableaux de nombres, plus les fonctions numériques de base. À la différence de ta.*, rien ici ne suppose qu'il s'agit de prix : ce sont des outils généraux, qu'on applique aussi bien à des rendements, à des volumes ou à des écarts."
    ),
    t(
      "Toutes les fonctions statistiques renvoient null sur un tableau vide, ou trop court pour ce qu'elles calculent. Aucune ne modifie le tableau qu'on lui passe."
    ),
    ...fns([
      {
        signature: "math.mean(values)",
        keywords: ["math.mean"],
        purpose: "La moyenne arithmétique : la somme divisée par le nombre de valeurs. Le centre de gravité de la série.",
        params: ["values — tableau de nombres."],
        returns: "un nombre, ou null si le tableau est vide.",
        example: `const moyenne = math.mean(market.series("close", 20));`,
      },
      {
        signature: "math.median(values)",
        keywords: ["math.median"],
        purpose:
          "La médiane : la valeur qui coupe la série en deux. Contrairement à la moyenne, une seule valeur aberrante ne la déplace pas — c'est le centre à préférer quand la série contient des pics.",
        params: ["values — tableau de nombres."],
        returns: "un nombre, ou null si le tableau est vide. Sur un nombre pair de valeurs, la moyenne des deux valeurs centrales.",
        example: `const volumeTypique = math.median(market.series("volume", 60));`,
      },
      {
        signature: "math.std(values)",
        keywords: ["math.std"],
        purpose:
          "L'écart-type : de combien les valeurs s'écartent en moyenne de leur moyenne. C'est la mesure de dispersion la plus courante, et la brique de toute mesure de volatilité.",
        params: ["values — tableau de nombres."],
        returns: "un nombre positif, ou null si le tableau est vide.",
        example: `// Volatilité annualisée à partir des rendements quotidiens :
const closes = market.series("close", 260);
const rendements = closes.slice(1).map((c, i) => c / closes[i] - 1);
const vol = math.std(rendements) * Math.sqrt(252) * 100;`,
      },
      {
        signature: "math.variance(values)",
        keywords: ["math.variance"],
        purpose:
          "La variance : l'écart-type au carré. Même information, dans une unité qui s'additionne — c'est la forme à utiliser pour combiner les dispersions de plusieurs séries.",
        params: ["values — tableau de nombres."],
        returns: "un nombre positif, ou null si le tableau est vide.",
      },
      {
        signature: "math.percentile(values, p)",
        keywords: ["math.percentile"],
        purpose:
          "La valeur en dessous de laquelle se trouve p % de la série. Sert à situer une lecture dans son propre historique : « le volume d'aujourd'hui est-il élevé pour ce titre ? » se répond en le comparant à son 90e centile, pas à une constante.",
        params: ["values — tableau de nombres.", "p — le centile voulu, entre 0 et 100."],
        returns: "un nombre, ou null si le tableau est vide.",
        example: `const vols = market.series("volume", 250);
const seuil = math.percentile(vols, 90);
if (seuil !== null && market.volume(0) > seuil) alert("volume dans le décile supérieur");`,
      },
      {
        signature: "math.zscore(values, value?)",
        keywords: ["math.zscore"],
        purpose:
          "À combien d'écarts-types de la moyenne se trouve une valeur. C'est la façon de comparer des grandeurs qui n'ont pas la même unité : un z-score de 2 sur le volume et un z-score de 2 sur la volatilité veulent dire la même chose, « inhabituellement haut ».",
        params: [
          "values — tableau de nombres servant de référence.",
          "value — la valeur à situer. Omise, c'est la dernière valeur du tableau qui est utilisée.",
        ],
        returns: "un nombre (négatif en dessous de la moyenne), ou null si le tableau est vide ou son écart-type nul.",
        example: `const z = math.zscore(market.series("volume", 200));`,
      },
      {
        signature: "math.correlation(a, b)",
        keywords: ["math.correlation"],
        purpose:
          "Le coefficient de corrélation entre deux séries : dans quelle mesure elles montent et descendent ensemble. Sert à mesurer une diversification réelle, ou à repérer que deux positions supposées indépendantes ne le sont pas.",
        params: ["a — première série.", "b — seconde série, alignée sur la première, de même longueur."],
        returns: "un nombre entre −1 et 1, ou null si les tableaux sont vides, de longueurs différentes, ou si l'un est constant.",
        example: `const r = math.correlation(market.series("close", 120), autreSerie);`,
        caveat:
          "Une corrélation forte ne dit rien d'une cause. Et elle se calcule ici sur les valeurs telles quelles : sur des prix, deux séries qui montent toutes deux donneront une corrélation élevée même sans lien — comparez plutôt les rendements.",
      },
      {
        signature: "math.covariance(a, b)",
        keywords: ["math.covariance"],
        purpose:
          "La covariance : la corrélation avant normalisation, donc exprimée dans le produit des unités des deux séries. Utile comme brique de calcul (un bêta, une variance de portefeuille) ; illisible telle quelle.",
        params: ["a — première série.", "b — seconde série, de même longueur."],
        returns: "un nombre, ou null si les tableaux sont vides ou de longueurs différentes.",
      },
      {
        signature: "math.min(values) / math.max(values)",
        keywords: ["math.min", "math.max"],
        purpose: "Le plus petit et le plus grand élément d'un tableau. Prennent le tableau lui-même, pas une liste d'arguments.",
        params: ["values — tableau de nombres."],
        returns: "un nombre, ou null si le tableau est vide.",
        example: `const plusHaut = math.max(market.series("high", 252)); // plus haut de l'année`,
        caveat:
          "À ne pas confondre avec Math.max(...) du langage, qui prend des arguments séparés : math.max(tableau) fonctionne, Math.max(tableau) renvoie NaN.",
      },
      {
        signature: "math.sma(values, period) / math.ema(values, period)",
        keywords: ["math.sma", "math.ema"],
        purpose:
          "Les deux mêmes moyennes que ta.sma et ta.ema. Elles existent ici parce qu'une moyenne mobile n'est pas seulement un indicateur : on lisse aussi un volume, une largeur de bande, un score composite. Le calcul est identique.",
        params: ["values — tableau de nombres.", "period — longueur de la fenêtre."],
        returns: "un nombre, ou null si le tableau est plus court que la fenêtre.",
      },
      {
        signature: "math.abs / sqrt / pow / exp / log",
        keywords: ["math.abs", "math.sqrt", "math.pow", "math.exp", "math.log"],
        purpose:
          "Les fonctions numériques du langage, exposées sous le même préfixe pour éviter d'avoir à mélanger math.* et Math.* dans une même expression. Comportement strictement identique à Math.abs, Math.sqrt, Math.pow, Math.exp et Math.log.",
        params: ["Les mêmes que leurs équivalents Math.* : un nombre, sauf pow qui en prend deux."],
        returns: "un nombre.",
      },
    ]),
  ],
};
