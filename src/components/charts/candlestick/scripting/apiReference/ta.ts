import { fns, t, c, type ScriptReferenceSection } from "./blocks";

/** `ta.*` — les indicateurs techniques, calculés à la volée.
 *
 *  Une entrée par fonction : c'est ce qui permet de chercher « hma » et de tomber sur ce que hma
 *  fait, ce qu'elle prend et ce qu'elle rend, sans lire la famille entière. */
export const TA_SECTION: ScriptReferenceSection = {
  id: "ta",
  title: "ta.*",
  group: "Fonctions utilitaires",
  blocks: [
    t(
      "Ces fonctions calculent un indicateur technique sans qu'il soit affiché sur la chart — utile pour composer plusieurs lectures dans un score sans encombrer l'écran de panneaux. Elles ne renvoient jamais une série : toujours la dernière valeur calculable, c'est-à-dire la lecture de la barre en cours."
    ),
    t(
      "Toutes prennent un tableau ordonné de la plus ancienne valeur à la plus récente — exactement l'ordre que market.series renvoie. Passer un tableau à l'envers ne lève aucune erreur : il calcule simplement l'indicateur d'un marché qui remonterait le temps."
    ),
    t(
      "Toutes renvoient null tant que la fenêtre n'est pas remplie. C'est la source d'erreur numéro un : un tableau de 20 valeurs ne donne pas de RSI(14) utilisable dès la première barre, et null + 1 vaut 1 en JavaScript, sans avertissement. Testez la valeur avant de vous en servir."
    ),
    c(`const closes = market.series("close", 60);
const rsi = ta.rsi(closes, 14);
if (rsi !== null && rsi < 30) plot.signal("achat");`),

    ...fns([
      {
        signature: "ta.sma(values, period)",
        keywords: ["ta.sma"],
        purpose:
          "La moyenne arithmétique des « period » dernières valeurs. La référence à laquelle toutes les autres se comparent : chaque barre de la fenêtre compte autant, ce qui la rend lisse et lente. On s'en sert pour situer un niveau moyen, pas pour réagir vite.",
        params: [
          "values — tableau de nombres, du plus ancien au plus récent.",
          "period — nombre de barres de la fenêtre. Doit être ≥ 1.",
        ],
        returns: "un nombre, ou null si values contient moins de « period » valeurs.",
        example: `const moyenne20 = ta.sma(market.series("close", 50), 20);`,
      },
      {
        signature: "ta.ema(values, period)",
        keywords: ["ta.ema"],
        purpose:
          "La moyenne mobile exponentielle : chaque barre pèse un peu moins que la suivante, sans jamais tomber à zéro. Elle réagit plus vite qu'une sma de même longueur et lisse un peu moins. C'est le choix par défaut quand on veut suivre une tendance sans attendre.",
        params: [
          "values — tableau de nombres, du plus ancien au plus récent.",
          "period — longueur de la moyenne ; le facteur de lissage vaut 2 / (period + 1).",
        ],
        returns: "un nombre, ou null si values contient moins de « period » valeurs.",
        example: `const rapide = ta.ema(market.series("close", 100), 12);
const lente = ta.ema(market.series("close", 100), 26);`,
      },
      {
        signature: "ta.wma(values, period)",
        keywords: ["ta.wma"],
        purpose:
          "La moyenne pondérée linéairement : la valeur la plus récente compte « period » fois, la précédente period − 1 fois, et ainsi de suite jusqu'à 1 pour la plus ancienne. Entre la sma et l'ema en réactivité, avec une pondération qu'on peut expliquer à quelqu'un sans parler d'exponentielle. Sert surtout de brique à hma.",
        params: [
          "values — tableau de nombres, du plus ancien au plus récent.",
          "period — longueur de la fenêtre pondérée.",
        ],
        returns: "un nombre, ou null si values contient moins de « period » valeurs.",
        example: `const wma20 = ta.wma(market.series("close", 60), 20);`,
      },
      {
        signature: "ta.hma(values, period)",
        keywords: ["ta.hma"],
        purpose:
          "La moyenne de Hull : wma(2 × wma(period / 2) − wma(period), √period). Cette construction annule l'essentiel du retard d'une moyenne mobile — elle tourne nettement plus tôt qu'une wma de même longueur tout en restant lisse. À utiliser quand le retard coûte cher et qu'un dépassement au retournement est acceptable.",
        params: [
          "values — tableau de nombres, du plus ancien au plus récent.",
          "period — longueur nominale. La fenêtre réelle est plus longue : voir la mise en garde.",
        ],
        returns: "un nombre, ou null tant que la fenêtre interne n'est pas remplie.",
        example: `const hull = ta.hma(market.series("close", 120), 21);`,
        caveat:
          "Elle a besoin d'environ period + √period valeurs avant de renvoyer autre chose que null — demandez donc plus de barres à market.series que la période seule ne le suggère. Et elle dépasse : sur un retournement brutal, elle pointe au-delà du prix avant de revenir. C'est le prix de sa réactivité, pas un défaut de calcul.",
      },
      {
        signature: "ta.alma(values, period, offset?, sigma?)",
        keywords: ["ta.alma"],
        purpose:
          "La moyenne d'Arnaud Legoux : une fenêtre gaussienne dont on choisit où placer le sommet et à quelle vitesse le poids retombe de part et d'autre. C'est la seule des moyennes ici dont on règle explicitement le compromis réactivité / lissage, au lieu de le subir.",
        params: [
          "values — tableau de nombres, du plus ancien au plus récent.",
          "period — longueur de la fenêtre.",
          "offset — où se place le sommet de la cloche dans la fenêtre, de 0 à 1. 1 = sur la barre la plus récente (le plus réactif, le moins lisse), 0 = sur la plus ancienne. Défaut 0,85.",
          "sigma — étroitesse de la cloche. Plus sigma est grand, plus la fenêtre est resserrée autour du sommet et plus la moyenne colle au prix. Défaut 6.",
        ],
        returns: "un nombre, ou null si values contient moins de « period » valeurs.",
        example: `// Presque aussi réactive qu'un prix brut :
const reactive = ta.alma(market.series("close", 80), 20, 0.99, 6);
// Nettement plus lisse :
const lisse = ta.alma(market.series("close", 80), 20, 0.5, 3);`,
      },
      {
        signature: "ta.swma(values)",
        keywords: ["ta.swma"],
        purpose:
          "La moyenne pondérée symétrique sur quatre barres, pondérées 1/6, 2/6, 2/6, 1/6. Sa fenêtre est fixe par définition — c'est un lissage court, standard, utilisé pour adoucir une série bruitée avant de la comparer à autre chose.",
        params: ["values — tableau de nombres, du plus ancien au plus récent. Au moins quatre valeurs."],
        returns: "un nombre, ou null si values contient moins de quatre valeurs.",
        example: `const adouci = ta.swma(market.series("close", 10));`,
        caveat: "Elle ne prend pas de période : la lui passer n'a aucun effet, la fenêtre reste de quatre barres.",
      },
      {
        signature: "ta.vwma(values, volumes, period)",
        keywords: ["ta.vwma"],
        purpose:
          "La moyenne pondérée par le volume : chaque prix compte à proportion de ce qui s'est échangé dessus. Une barre calme la déplace peu, une barre active beaucoup. C'est la moyenne à utiliser quand on veut le prix « où le marché a réellement traité », pas le prix moyen affiché.",
        params: [
          "values — les prix, du plus ancien au plus récent.",
          "volumes — les volumes, alignés barre par barre sur values. Même longueur, même ordre.",
          "period — longueur de la fenêtre.",
        ],
        returns: "un nombre, ou null si l'une des deux séries est trop courte, ou si le volume total de la fenêtre est nul.",
        example: `const prix = market.series("close", 60);
const vol = market.series("volume", 60);
const vwma20 = ta.vwma(prix, vol, 20);`,
        caveat:
          "Les deux tableaux doivent être alignés barre par barre. Deux appels séparés à market.series avec le même count le garantissent ; découper l'un des deux à la main ne le garantit plus.",
      },
      {
        signature: "ta.zlema(values, period)",
        keywords: ["ta.zlema"],
        purpose:
          "L'ema « à retard nul » : elle lisse 2 × prix − prix[il y a (period − 1) / 2 barres] plutôt que le prix lui-même. Cette soustraction compense d'avance le retard qu'une ema introduit, si bien qu'elle tourne plus tôt. Comme hma, elle dépasse au retournement.",
        params: [
          "values — tableau de nombres, du plus ancien au plus récent.",
          "period — longueur de l'ema sous-jacente ; le décalage compensé vaut (period − 1) / 2, arrondi.",
        ],
        returns: "un nombre, ou null tant que la fenêtre, décalage compris, n'est pas remplie.",
        example: `const zl = ta.zlema(market.series("close", 100), 21);`,
      },
      {
        signature: "ta.rsi(values, period)",
        keywords: ["ta.rsi"],
        purpose:
          "L'indice de force relative : compare l'ampleur moyenne des hausses à celle des baisses sur la fenêtre, et la ramène sur une échelle de 0 à 100. Il mesure la vigueur d'un mouvement, pas sa direction — lu classiquement comme « suracheté » au-dessus de 70 et « survendu » en dessous de 30.",
        params: ["values — les prix, du plus ancien au plus récent.", "period — longueur de la fenêtre. 14 est la valeur usuelle."],
        returns: "un nombre entre 0 et 100, ou null si values contient moins de period + 1 valeurs.",
        example: `const rsi = ta.rsi(market.series("close", 60), 14);
if (rsi !== null && rsi > 70) alert("suracheté");`,
        caveat:
          "Un RSI extrême n'est pas un signal de retournement : dans une tendance forte il peut rester au-dessus de 70 pendant des semaines. Il dit qu'un mouvement est vigoureux, pas qu'il est fini.",
      },
      {
        signature: "ta.roc(values, period)",
        keywords: ["ta.roc"],
        purpose:
          "Le taux de variation : de combien de pour cent la valeur a bougé depuis « period » barres. La mesure de momentum la plus directe qui soit, sans lissage et sans échelle bornée.",
        params: ["values — les prix, du plus ancien au plus récent.", "period — l'écart, en barres, avec lequel comparer."],
        returns: "un nombre en pourcentage (5 pour +5 %), ou null si values est trop court.",
        example: `const perf20 = ta.roc(market.series("close", 40), 20);`,
      },
      {
        signature: "ta.atr(high, low, close, period)",
        keywords: ["ta.atr"],
        purpose:
          "L'Average True Range : l'amplitude moyenne réelle d'une barre, gaps compris. Ce n'est pas un indicateur de direction mais de volatilité — c'est l'outil pour dimensionner un stop ou une position en unités de marché plutôt qu'en pourcentage arbitraire.",
        params: [
          "high — les plus hauts, du plus ancien au plus récent.",
          "low — les plus bas, alignés sur high.",
          "close — les clôtures, alignées sur high.",
          "period — longueur du lissage. 14 est la valeur usuelle.",
        ],
        returns: "un nombre exprimé dans l'unité de prix de l'instrument, ou null si les séries sont trop courtes.",
        example: `const n = 60;
const atr = ta.atr(market.series("high", n), market.series("low", n), market.series("close", n), 14);
// Un stop à deux ATR sous le prix, quelle que soit la volatilité du moment :
const stop = atr === null ? null : market.close(0) - 2 * atr;`,
        caveat: "Les trois séries doivent avoir la même longueur et être alignées barre par barre.",
      },
      {
        signature: "ta.macd(values, fastPeriod?, slowPeriod?, signalPeriod?)",
        keywords: ["ta.macd"],
        purpose:
          "La convergence-divergence de moyennes mobiles : la différence entre une ema rapide et une ema lente, sa propre moyenne (la ligne de signal), et l'écart entre les deux (l'histogramme). Il lit un changement de régime de tendance — le croisement des deux lignes est le signal classique, le passage de l'histogramme par zéro en est la même information.",
        params: [
          "values — les prix, du plus ancien au plus récent.",
          "fastPeriod — longueur de l'ema rapide. Défaut 12.",
          "slowPeriod — longueur de l'ema lente. Défaut 26.",
          "signalPeriod — longueur de la moyenne appliquée à la différence. Défaut 9.",
        ],
        returns:
          "un objet { macd, signal, histogram } — macd est un nombre, signal et histogram peuvent être null tant que la moyenne de signal n'a pas assez de valeurs. L'objet entier vaut null si values est trop court.",
        example: `const m = ta.macd(market.series("close", 120));
if (m !== null && m.histogram !== null && m.histogram > 0) plot.signal("haussier");`,
      },
      {
        signature: "ta.bollinger(values, period?, stdDev?)",
        keywords: ["ta.bollinger"],
        purpose:
          "Les bandes de Bollinger : une moyenne mobile et deux bornes placées à N écarts-types de part et d'autre. Elles s'écartent quand le marché s'agite et se resserrent quand il se calme, ce qui en fait autant une mesure de volatilité qu'un repère de niveau.",
        params: [
          "values — les prix, du plus ancien au plus récent.",
          "period — longueur de la moyenne et de l'écart-type. Défaut 20.",
          "stdDev — nombre d'écarts-types entre la moyenne et chaque bande. Défaut 2.",
        ],
        returns: "un objet { upper, middle, lower } de trois nombres, ou null si values contient moins de « period » valeurs.",
        example: `const b = ta.bollinger(market.series("close", 60), 20, 2);
if (b !== null) plot.overlay("Bollinger").band("BB", b.upper, b.lower);`,
        caveat:
          "Toucher une bande n'est pas un signal en soi : en tendance, le prix « marche » le long de la bande supérieure pendant longtemps. C'est le resserrement, puis l'expansion, qui portent l'information.",
      },
      {
        signature: "ta.stochastic(high, low, close, period?, signalPeriod?)",
        keywords: ["ta.stochastic"],
        purpose:
          "L'oscillateur stochastique : où se situe la clôture dans l'amplitude haut-bas de la fenêtre, de 0 à 100, plus une moyenne de cette lecture. Il répond à « clôture-t-on en haut ou en bas de la récente fourchette » — utile en marché sans direction, trompeur en tendance.",
        params: [
          "high — les plus hauts, du plus ancien au plus récent.",
          "low — les plus bas, alignés sur high.",
          "close — les clôtures, alignées sur high.",
          "period — longueur de la fenêtre haut-bas. Défaut 14.",
          "signalPeriod — longueur de la moyenne appliquée à %K pour obtenir %D. Défaut 3.",
        ],
        returns: "un objet { k, d } — k est la lecture brute, d sa moyenne. null si les séries sont trop courtes.",
        example: `const n = 60;
const st = ta.stochastic(market.series("high", n), market.series("low", n), market.series("close", n));
if (st !== null && st.k < 20 && st.k > st.d) plot.signal("achat");`,
      },
      {
        signature: "ta.adx(high, low, close, period?)",
        keywords: ["ta.adx"],
        purpose:
          "L'indice directionnel moyen, avec ses deux composantes. adx mesure la FORCE d'une tendance sans dire son sens (au-dessus de 25, on considère qu'il y a tendance ; en dessous de 20, que le marché va de côté). plusDI et minusDI disent le sens : lequel des deux domine. C'est l'outil pour n'appliquer une stratégie de suivi que quand il y a réellement quelque chose à suivre.",
        params: [
          "high — les plus hauts, du plus ancien au plus récent.",
          "low — les plus bas, alignés sur high.",
          "close — les clôtures, alignées sur high.",
          "period — longueur du lissage. Défaut 14.",
        ],
        returns: "un objet { adx, plusDI, minusDI } de trois nombres, ou null si les séries sont trop courtes.",
        example: `const n = 80;
const a = ta.adx(market.series("high", n), market.series("low", n), market.series("close", n));
// Ne suivre la tendance que lorsqu'il y en a une :
if (a !== null && a.adx > 25 && a.plusDI > a.minusDI) strategy.long("tendance haussière établie");`,
        caveat: "adx a besoin d'environ deux fois la période pour se stabiliser : demandez large à market.series.",
      },
    ]),
  ],
};
