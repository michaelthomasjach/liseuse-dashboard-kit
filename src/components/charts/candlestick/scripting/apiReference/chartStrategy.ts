import { fns, t, c, d, type ScriptReferenceSection } from "./blocks";

const HANDLE_OFFSET = "offset — de combien de barres remonter. 0 (défaut) = la barre en cours.";
const HANDLE_NULL =
  "un nombre, ou null — si l'indicateur n'a pas cette composante, s'il n'a pas encore de valeur à cette barre (période de chauffe), ou si l'offset sort de l'historique.";

export const CHART_SECTION: ScriptReferenceSection = {
  id: "chart",
  title: "chart.*",
  group: "API du script",
  blocks: [
    t(
      "Lit les indicateurs DÉJÀ affichés sur le graphique, au lieu de les recalculer. La différence avec ta.* est importante : ta.rsi calcule un RSI que personne ne voit, chart.indicator(\"rsi\") lit celui que l'utilisateur a ajouté, avec les réglages qu'il a choisis. Si vous voulez que votre script réagisse à ce qui est à l'écran, c'est par ici."
    ),
    t(
      "Un indicateur produit par un autre script n'apparaît pas ici : seuls les indicateurs intégrés sont lisibles. C'est une limite assumée, pas un oubli — sans elle, deux scripts pourraient se lire l'un l'autre en boucle."
    ),
    d("chartIndicator"),
    ...fns([
      {
        signature: "chart.listIndicators()",
        keywords: ["chart.listIndicators"],
        purpose:
          "Les identifiants des indicateurs actuellement sur la chart. À appeler avant de supposer qu'un indicateur est là : l'utilisateur peut l'avoir retiré.",
        params: [],
        returns: 'un tableau d\'identifiants, par exemple ["sma", "rsi", "macd"]. Vide si le graphique n\'en affiche aucun.',
        example: `if (chart.listIndicators().includes("rsi")) {
  const rsi = chart.indicator("rsi").value();
}`,
      },
      {
        signature: "chart.indicator(id)",
        keywords: ["chart.indicator"],
        purpose:
          "Une poignée de lecture sur un indicateur affiché. Les méthodes qu'elle expose dépendent de la forme de l'indicateur — une simple courbe n'a qu'une valeur, une bande en a trois, un MACD trois autres.",
        params: ["id — l'identifiant renvoyé par chart.listIndicators()."],
        returns:
          "toujours une poignée, jamais null. Un identifiant inconnu renvoie une poignée dont toutes les méthodes valent null : une faute de frappe ne casse pas le script, elle le rend silencieux.",
        example: `const rsi = chart.indicator("rsi");
const maintenant = rsi.value();
const ilYAUneBarre = rsi.value(1);`,
      },
      {
        signature: "…​.value(offset?)",
        keywords: [".value"],
        purpose:
          "La lecture d'un indicateur à courbe unique — sma, ema, rsi, atr… Sur un indicateur en bande, c'est sa ligne médiane, par la même convention que les étiquettes de survol du graphique.",
        params: [HANDLE_OFFSET],
        returns: HANDLE_NULL,
      },
      {
        signature: "…​.upper(offset?) / .middle(offset?) / .lower(offset?)",
        keywords: [".upper", ".middle", ".lower"],
        purpose:
          "Les trois lignes d'un indicateur en bande — bandes de Bollinger, canal de Keltner. upper et lower bornent, middle est la moyenne autour de laquelle elles s'écartent.",
        params: [HANDLE_OFFSET],
        returns: HANDLE_NULL,
        example: `const bb = chart.indicator("bollinger");
const haut = bb.upper();
if (haut !== null && market.close(0) > haut) plot.signal("au-dessus de la bande");`,
      },
      {
        signature: "…​.line(offset?) / .signal(offset?) / .histogram(offset?)",
        keywords: [".signal"],
        purpose:
          "Les trois composantes d'un MACD : la ligne principale, sa moyenne de signal, et l'écart entre les deux. Le passage de l'histogramme par zéro est exactement le croisement des deux lignes.",
        params: [HANDLE_OFFSET],
        returns: HANDLE_NULL,
      },
      {
        signature: "…​.adx(offset?) / .plusDI(offset?) / .minusDI(offset?)",
        keywords: [".adx", ".plusDI", ".minusDI"],
        purpose:
          "Les trois composantes d'un ADX affiché : la force de la tendance, et les deux directionnelles qui en donnent le sens.",
        params: [HANDLE_OFFSET],
        returns: HANDLE_NULL,
      },
    ]),
  ],
};

export const STRATEGY_SECTION: ScriptReferenceSection = {
  id: "strategy",
  title: "strategy.*",
  group: "API du script",
  blocks: [
    t(
      "Disponible uniquement dans un script ayant déclaré @strategy. C'est l'API qui prend des positions : le moteur les rejoue sur un compte simulé au fil des barres, et le panneau ancré sous la chart en montre la courbe de P&L, les statistiques et la liste des trades."
    ),
    t(
      "Ce n'est pas une étiquette : un script @indicator n'a tout simplement pas cet objet, et l'appeler échoue en nommant ce qui manque plutôt que d'ouvrir silencieusement une position que personne n'a demandée."
    ),
    t(
      "Les ordres ne se règlent jamais au milieu d'une barre. Tout ce qu'un passage décide est exécuté APRÈS ce passage, au prix de règlement de la barre : un script qui change trois fois d'avis dans la même barre produit une seule opération, pas trois."
    ),
    ...fns([
      {
        signature: "strategy.long(comment?, options?)",
        keywords: ["strategy.long"],
        purpose:
          "Ouvre — ou renforce — une position acheteuse. Si la position en cours est vendeuse, elle est retournée : fermée puis rouverte à l'achat, ce que « passer long » veut dire pour quiconque lit la phrase.",
        params: [
          "comment — le libellé du trade, repris sur le marqueur posé sur la chart et dans la liste des trades. Facultatif mais fortement conseillé : c'est ce qui rend un backtest relisible.",
          "options — la taille de l'entrée. Sans options, la taille par défaut des réglages de la stratégie s'applique.",
        ],
        returns: "rien.",
        example: `if (rapide > lente && strategy.position() === "flat") strategy.long("croisement haussier");`,
      },
      {
        signature: "strategy.short(comment?, options?)",
        keywords: ["strategy.short"],
        purpose: "Le symétrique exact de long : ouvre ou renforce une position vendeuse, et retourne une position acheteuse en cours.",
        params: [
          "comment — le libellé du trade.",
          "options — la taille de l'entrée.",
        ],
        returns: "rien.",
      },
      {
        signature: "strategy.close(comment?)",
        keywords: ["strategy.close"],
        purpose: "Ferme tout ce qui est ouvert, au prix de règlement de la barre. Sans effet si la position est déjà plate.",
        params: ["comment — le libellé de la sortie, repris sur le marqueur et dans la liste des trades."],
        returns: "rien.",
        example: `if (rapide < lente && strategy.position() === "long") strategy.close("croisement inverse");`,
      },
      {
        signature: "strategy.position()",
        keywords: ["strategy.position"],
        purpose:
          "Le sens de la position en cours. C'est la question à poser avant d'agir : sans elle, une condition vraie plusieurs barres de suite rouvre la même position à chaque passage.",
        params: [],
        returns: '"long", "short" ou "flat".',
        example: `if (signal && strategy.position() === "flat") strategy.long("entrée");`,
        caveat: 'Renvoie une CHAÎNE, pas un nombre : comparer à 0 ne fonctionne pas, il faut comparer à "flat".',
      },
      {
        signature: "strategy.positionSize()",
        keywords: ["strategy.positionSize"],
        purpose: "Le nombre d'unités détenues. Toujours positif : c'est position() qui porte le sens.",
        params: [],
        returns: "un nombre, 0 quand la position est plate.",
      },
      {
        signature: "strategy.averagePrice()",
        keywords: ["strategy.averagePrice"],
        purpose:
          "Le prix moyen d'entrée de la position ouverte, entrées multiples comprises. C'est la référence pour un stop ou un objectif calculé depuis l'entrée réelle plutôt que depuis la première.",
        params: [],
        returns: "un nombre, ou null quand la position est plate.",
        example: `const entree = strategy.averagePrice();
if (entree !== null && market.close(0) < entree * 0.95) strategy.close("stop à -5 %");`,
      },
      {
        signature: "strategy.unrealizedProfit()",
        keywords: ["strategy.unrealizedProfit"],
        purpose:
          "Le gain ou la perte latente de la position ouverte, au prix courant. Sert à sortir sur un objectif de gain, ou à couper une perte, sans recalculer soi-même depuis le prix d'entrée.",
        params: [],
        returns: "un nombre dans la devise du compte simulé. 0 quand la position est plate.",
      },
    ]),
    c(`// Une stratégie complète tient en peu de lignes.
@strategy
const closes = market.series("close", 60);
const rapide = ta.ema(closes, 12);
const lente = ta.ema(closes, 26);
if (rapide !== null && lente !== null && bar.isClosed()) {
  if (rapide > lente && strategy.position() === "flat") strategy.long("croisement haussier");
  if (rapide < lente && strategy.position() === "long") strategy.close("croisement baissier");
}`),
  ],
};
