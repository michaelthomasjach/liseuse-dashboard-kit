import { fns, t, c, d, type ScriptReferenceSection } from "./blocks";

const OFFSET = "offset — de combien de barres remonter. 0 (défaut) = la barre en cours d'exécution, 1 = la précédente, et ainsi de suite.";
const NULL_OFFSET =
  "un nombre, ou null si l'offset sort de l'historique disponible. Un offset négatif renvoie toujours null : un script ne peut pas lire l'avenir, et cette limite est structurelle, pas une vérification qu'on aurait pu oublier.";

export const MARKET_SECTION: ScriptReferenceSection = {
  id: "market",
  title: "market.*",
  group: "API du script",
  blocks: [
    t(
      "Les prix, lus depuis la barre en cours d'exécution. Le script est rejoué barre par barre depuis le début de l'historique : à chaque passage, « la barre en cours » avance d'un cran, et tous les accesseurs ci-dessous se déplacent avec elle."
    ),
    t(
      "C'est ce qui rend l'absence de fuite vers le futur structurelle : l'indice courant ne peut pas être avancé depuis un script. Un décalage négatif ne renvoie pas une erreur, il renvoie null — il n'y a rien à cet endroit."
    ),
    d("marketOffset"),
    ...fns([
      {
        signature: "market.open(offset?)",
        keywords: ["market.open"],
        purpose: "Le prix d'ouverture d'une barre.",
        params: [OFFSET],
        returns: NULL_OFFSET,
      },
      {
        signature: "market.high(offset?)",
        keywords: ["market.high"],
        purpose: "Le plus haut atteint pendant la barre.",
        params: [OFFSET],
        returns: NULL_OFFSET,
      },
      {
        signature: "market.low(offset?)",
        keywords: ["market.low"],
        purpose: "Le plus bas atteint pendant la barre.",
        params: [OFFSET],
        returns: NULL_OFFSET,
      },
      {
        signature: "market.close(offset?)",
        keywords: ["market.close"],
        purpose:
          "Le prix de clôture. C'est l'accesseur le plus utilisé : sauf raison contraire, un calcul se fait sur les clôtures, qui sont le seul prix sur lequel le marché s'est réellement mis d'accord.",
        params: [OFFSET],
        returns: NULL_OFFSET,
        example: `const variation = market.close(0) - market.close(1);`,
      },
      {
        signature: "market.volume(offset?)",
        keywords: ["market.volume"],
        purpose: "Le volume échangé pendant la barre.",
        params: [OFFSET],
        returns:
          "un nombre, null si l'offset sort de l'historique, et null aussi si l'application n'a pas fourni de volume — tous les instruments n'en ont pas.",
      },
      {
        signature: "market.time(offset?)",
        keywords: ["market.time"],
        purpose:
          "L'horodatage d'une barre, en objet Date. Sert à borner un calcul dans le temps, ou à étiqueter une sortie avec la date à laquelle elle correspond.",
        params: [OFFSET],
        returns: "un objet Date, ou null si l'offset sort de l'historique.",
        example: `const jour = market.time(0);
if (jour !== null && jour.getUTCDay() === 1) plot.signal("lundi");`,
      },
      {
        signature: "market.series(field, count?)",
        keywords: ["market.series"],
        purpose:
          "Une fenêtre de valeurs d'un coup, plutôt qu'un accès barre par barre. C'est ce qu'attendent toutes les fonctions ta.* et math.*, et c'est bien plus rapide qu'une boucle d'appels individuels.",
        params: [
          'field — quelle grandeur : "open", "high", "low", "close" ou "volume".',
          "count — combien de barres, en remontant depuis la barre en cours. Le tableau renvoyé est ordonné de la PLUS ANCIENNE à la PLUS RÉCENTE.",
        ],
        returns:
          "un tableau de nombres, éventuellement plus court que count si l'historique ne suffit pas, éventuellement vide. Jamais null.",
        example: `const closes = market.series("close", 60);
const dernier = closes[closes.length - 1]; // équivaut à market.close(0)`,
        caveat:
          "Le nombre de points est plafonné par le moteur (voir « Sécurité et limites ») : demander cent mille barres n'en renvoie pas cent mille. Et vérifiez la longueur réelle avant d'indexer : en début d'historique, le tableau est plus court que demandé.",
      },
      {
        signature: "market.heikinAshi(count?)",
        keywords: ["market.heikinAshi"],
        purpose:
          "Les chandeliers Heikin-Ashi calculés sur les mêmes barres : un lissage qui atténue le bruit et rend la tendance plus lisible. C'est un accesseur et non un calcul à refaire soi-même, parce que l'ouverture Heikin-Ashi dépend de la précédente, donc de toutes les barres antérieures — un script lisant une fenêtre fixe ne peut pas la reproduire.",
        params: ["count — combien de barres renvoyer, en remontant depuis la barre en cours."],
        returns:
          "un objet { open, high, low, close } de quatre tableaux alignés barre par barre, ordonnés du plus ancien au plus récent.",
        example: `const ha = market.heikinAshi(60);
const corpsHaussier = ha.close[ha.close.length - 1] > ha.open[ha.open.length - 1];`,
      },
      {
        signature: "market.symbol()",
        keywords: ["market.symbol"],
        purpose:
          "Le symbole affiché, tel que l'application l'a nommé. Un @report s'en sert pour se titrer ; une analyse @quant, qui s'exécute une fois par symbole, s'en sert pour savoir lequel elle est en train de traiter.",
        params: [],
        returns: "une chaîne, ou null si l'application n'a nommé aucun symbole.",
        example: `report.title("Analyse", { symbol: market.symbol() });`,
        caveat: "Lecture seule : connaître un nom de symbole ne donne aucun accès à ses données.",
      },
      {
        signature: "market.availableTimeframes()",
        keywords: ["market.availableTimeframes"],
        purpose:
          "Les unités de temps que le sélecteur du graphique propose. Permet à un script de s'adapter à ce que l'application offre plutôt que de supposer.",
        params: [],
        returns: 'un tableau de chaînes au format "<n><unité>", par exemple ["5m", "1h", "1d"]. Vide si aucune n\'a été configurée.',
      },
      {
        signature: "market.resample(interval)",
        keywords: ["market.resample"],
        purpose:
          "Agrège les barres du graphique en une unité de temps plus large, et renvoie un accesseur qui se lit exactement comme market.* lui-même. C'est ainsi qu'on regarde la tendance en journalier tout en travaillant en horaire, sans jamais quitter les données affichées.",
        params: [
          'interval — l\'unité voulue, au format "<n><unité>" avec l\'unité parmi "m", "h" ou "d" : "15m", "4h", "1d".',
        ],
        returns:
          "un objet exposant open, high, low, close, volume, time, series et heikinAshi, avec la même signature que market.* — mais sur les barres agrégées.",
        example: `const journalier = market.resample("1d");
const tendance = ta.ema(journalier.series("close", 100), 50);`,
        caveat:
          "Deux cas renvoient un accesseur qui répond « aucune donnée » (null et tableaux vides) plutôt que de lever une erreur : un intervalle illisible, et un intervalle PLUS FIN que celui du graphique — il n'y a rien de réel en quoi subdiviser une barre, et fabriquer de la précision serait pire que de dire non. Les barres agrégées ne sont construites que jusqu'à la barre en cours : là encore, aucune fuite vers le futur possible.",
      },
    ]),
    d("resample"),
    c(`// Le motif complet : lire large, calculer, tracer.
const closes = market.series("close", 100);
const rapide = ta.ema(closes, 12);
const lente = ta.ema(closes, 26);
if (rapide !== null && lente !== null) {
  plot.overlay("Moyennes").line("Rapide", rapide);
  plot.overlay("Moyennes").line("Lente", lente);
}`),
  ],
};
