import { fns, t, c, d, type ScriptReferenceSection } from "./blocks";

const SERIES_OPTIONS = [
  "options.color — couleur CSS de la courbe.",
  "options.lineWidth — épaisseur du trait, en pixels.",
  'options.lineStyle — "solid" (défaut), "dashed" ou "dotted".',
];

export const PLOT_SECTION: ScriptReferenceSection = {
  id: "plot",
  title: "plot.*",
  group: "API du script",
  blocks: [
    t(
      "Tout ce qu'un script dessine passe par ici. Deux familles à ne pas confondre : les SÉRIES, qui accumulent un point par barre et forment une courbe, et les MARQUEURS, qui posent un élément unique à l'endroit où on est. Un appel à line() sur cinq cents barres donne une courbe de cinq cents points ; un appel à signal() sur cinq cents barres donne cinq cents marqueurs."
    ),
    t(
      "Une série vit dans un panneau. plot.pane() en crée un sous les bougies, avec sa propre échelle — c'est ce qu'il faut à un RSI, qui n'a rien à voir avec l'échelle des prix. plot.overlay() dessine sur les bougies elles-mêmes, à l'échelle des prix — c'est ce qu'il faut à une moyenne mobile."
    ),
    t(
      "Ni l'un ni l'autre n'existe dans un @quant ni dans un @report : ces deux-là ne dessinent rien, et y appeler plot.* échoue en nommant ce qu'il faut faire à la place."
    ),
    d("plotOwnPane"),
    ...fns([
      {
        signature: "plot.pane(name, options?)",
        keywords: ["plot.pane"],
        purpose:
          "Crée — ou retrouve — un panneau sous les bougies, avec son échelle propre. Rappelée avec le même nom, y compris à une autre barre, elle rend le même panneau : c'est ce qui permet d'écrire plot.pane(\"RSI\").line(...) à chaque barre sans créer cinq cents panneaux.",
        params: [
          "name — le nom du panneau, affiché dans son en-tête. C'est aussi son identité : même nom, même panneau.",
          'options.dock — où l\'accrocher : "bottom" (défaut) l\'empile sous les prix ; "left" ou "right" le place dans une colonne verticale à côté du graphique, ce qu\'il faut pour un profil.',
        ],
        returns: "une poignée exposant line, area, histogram, dots, band, label et profile.",
        example: `plot.pane("RSI").line("RSI", ta.rsi(market.series("close", 60), 14));`,
      },
      {
        signature: "plot.overlay(name)",
        keywords: ["plot.overlay"],
        purpose:
          "La même poignée, mais dessinée SUR les bougies, à l'échelle des prix. À utiliser pour tout ce qui se compare directement au prix : moyennes, bandes, niveaux.",
        params: ["name — le nom du groupe, affiché dans la légende en haut à gauche."],
        returns: "la même poignée que plot.pane.",
        example: `plot.overlay("Moyennes").line("SMA 20", ta.sma(market.series("close", 60), 20));`,
      },
      {
        signature: "…​.line(name, value, options?)",
        keywords: [".line"],
        purpose: "Ajoute un point à une courbe continue. L'appel le plus courant de toute l'API de dessin.",
        params: [
          "name — le nom de la courbe dans ce panneau. Même nom = même courbe, un point de plus.",
          "value — la valeur à cette barre, ou null pour un TROU : la courbe n'est pas tracée là et les deux côtés ne sont pas reliés.",
          ...SERIES_OPTIONS,
        ],
        returns: "rien.",
        caveat:
          "null n'est pas zéro. Passer 0 quand la valeur est indisponible dessine une courbe qui plonge à zéro ; passer null laisse le trou honnête que c'est.",
      },
      {
        signature: "…​.area(name, value, options?)",
        keywords: [".area"],
        purpose:
          "Comme line, mais remplie jusqu'à la base du panneau. À utiliser quand la grandeur se lit comme une quantité accumulée plutôt que comme un niveau.",
        params: ["name — le nom de la série.", "value — la valeur, ou null pour un trou.", ...SERIES_OPTIONS],
        returns: "rien.",
      },
      {
        signature: "…​.histogram(name, value, options?)",
        keywords: [".histogram"],
        purpose:
          "Une barre par chandelier, depuis zéro. La forme juste pour une grandeur qui change de signe — un histogramme MACD, un delta de volume : le passage par zéro se voit, ce qu'une courbe ne montre pas.",
        params: ["name — le nom de la série.", "value — la valeur, ou null pour un trou.", ...SERIES_OPTIONS],
        returns: "rien.",
      },
      {
        signature: "…​.dots(name, value, options?)",
        keywords: [".dots"],
        purpose:
          "Un point isolé par barre, sans les relier. C'est la forme honnête pour une valeur qui n'existe pas à toutes les barres — un stop suiveur, un niveau détecté : une courbe relierait deux points entre lesquels il n'y a rien.",
        params: ["name — le nom de la série.", "value — la valeur à cette barre.", ...SERIES_OPTIONS],
        returns: "rien.",
      },
      {
        signature: "…​.band(name, upper, lower, options?)",
        keywords: [".band"],
        purpose:
          "Une zone remplie entre deux courbes, avec ses deux bords tracés et une médiane calculée. C'est une seule série, pas deux : elle se lit, se masque et se supprime d'un bloc.",
        params: [
          "name — le nom de la bande.",
          "upper — le bord supérieur à cette barre.",
          "lower — le bord inférieur.",
          "options.color — couleur du remplissage et des bords.",
          "options.lineWidth — épaisseur des bords.",
        ],
        returns: "rien. null pour les DEUX bords laisse un trou ; l'un seulement ne suffit pas à dessiner quoi que ce soit.",
        example: `const b = ta.bollinger(market.series("close", 60), 20, 2);
if (b !== null) plot.overlay("Bollinger").band("BB", b.upper, b.lower);`,
      },
      {
        signature: "…​.label(name, text, options)",
        keywords: [".label"],
        purpose:
          "Un texte placé précisément dans le panneau : un titre, une lecture chiffrée, une annotation. Contrairement aux séries, ce n'est pas un point par barre — le dernier appel portant un nom donné remplace le précédent.",
        params: [
          "name — l'identité de l'étiquette. Même nom = même étiquette, remplacée.",
          "text — ce qui est écrit.",
          "options.x / options.y — la position dans le panneau.",
          'options.unit — "px" pour des pixels depuis le coin haut-gauche, "%" pour une fraction de la taille du panneau.',
          "options.bar / options.price — ancrage à une barre et à un prix plutôt qu'à une position fixe : l'étiquette suit alors le graphique quand on le déplace.",
          "options.rotation — rotation en degrés.",
          "options.color / options.fontSize — couleur et taille du texte.",
          'options.align — "left", "center" ou "right".',
        ],
        returns: "rien.",
      },
      {
        signature: "…​.profile(name, values, prices, options?)",
        keywords: [".profile"],
        purpose:
          "Un profil horizontal — profil de marché, profil de volume : combien s'est passé à chaque NIVEAU DE PRIX, indépendamment du temps. Ce n'est pas une série temporelle : elle se calcule une fois sur une plage de prix, elle n'a aucune barre à laquelle s'attacher.",
        params: [
          "name — le nom du profil.",
          "values — l'importance de chaque niveau (volume, temps passé…).",
          "prices — les niveaux de prix, alignés sur values.",
          "options.color / options.lineWidth — apparence des barres.",
          "options.headroom — la fraction de la largeur du panneau que le profil laisse libre, pour ne pas coller au bord.",
        ],
        returns: "rien.",
        caveat: "values et prices doivent avoir la même longueur. À utiliser dans un panneau accroché à gauche ou à droite (dock).",
      },
      {
        signature: "plot.signal(arg)",
        keywords: ["plot.signal"],
        purpose:
          "Un marqueur à la barre en cours : c'est ainsi qu'un indicateur dit « ici ». La forme la plus courante d'annotation ponctuelle.",
        params: [
          'arg — soit une chaîne courte ("BUY", "SELL", "achat"…), soit un objet { type, price, color, shape, text } pour choisir le prix d\'ancrage, la couleur, la forme et le libellé.',
        ],
        returns: "rien.",
        example: `if (croisement) plot.signal("achat");
plot.signal({ type: "SELL", price: market.high(0), text: "divergence" });`,
      },
      {
        signature: "plot.point(value, options?)",
        keywords: ["plot.point"],
        purpose: "Un point à un prix choisi, à la barre en cours. Comme signal, mais quand c'est le NIVEAU qui compte plutôt que l'évènement.",
        params: ["value — le prix auquel poser le point.", "options.color / options.shape / options.text — apparence et libellé."],
        returns: "rien.",
      },
      {
        signature: "plot.horizontal(price, options?)",
        keywords: ["plot.horizontal"],
        purpose: "Une ligne horizontale sur toute la largeur, à un prix donné : un support, une résistance, un objectif.",
        params: ["price — le prix.", "options.color — couleur CSS."],
        returns: "rien.",
      },
      {
        signature: "plot.vertical(options?)",
        keywords: ["plot.vertical"],
        purpose: "Une ligne verticale à la barre en cours : marque un instant plutôt qu'un niveau — une annonce, un changement de régime.",
        params: ["options.color — couleur CSS."],
        returns: "rien.",
      },
      {
        signature: "plot.table(rows, options?)",
        keywords: ["plot.table"],
        purpose:
          "Un tableau posé dans un coin du graphique. Ni une série ni un marqueur : un affichage de synthèse, remplacé à chaque exécution plutôt qu'accumulé.",
        params: [
          "rows — les lignes du tableau, chacune avec ses cellules et éventuellement une couleur.",
          "options.title — un titre.",
          "options.columns — les en-têtes de colonnes.",
          "options.position — dans quel coin l'ancrer.",
        ],
        returns: "rien.",
      },
      {
        signature: "plot.xy(name, x, y, options?)",
        keywords: ["plot.xy"],
        purpose:
          "Un graphique X/Y indépendant du rejeu barre par barre : on lui passe deux tableaux entiers. C'est la forme pour un nuage de points ou une relation entre deux grandeurs, que l'axe du temps ne sait pas montrer.",
        params: [
          "name — le nom du graphique.",
          "x — les abscisses.",
          "y — les ordonnées, alignées sur x.",
          'options.draw — "line" ou "scatter".',
          "options.color / options.title / options.xLabel / options.yLabel — apparence et légendes.",
        ],
        returns: "rien.",
        example: `plot.xy("Rendement vs volume", volumes, rendements, { draw: "scatter" });`,
      },
    ]),
    d("plotOverlay"),
    d("plotSignal"),
    c(`// Un panneau, une bande, un marqueur — le trio le plus fréquent.
const closes = market.series("close", 60);
const b = ta.bollinger(closes, 20, 2);
if (b !== null) {
  plot.overlay("Bollinger").band("BB", b.upper, b.lower, { color: "#3b7dd8" });
  if (market.close(0) > b.upper) plot.signal({ type: "SELL", text: "au-dessus de la bande" });
}
plot.pane("RSI").line("RSI", ta.rsi(closes, 14));`),
  ],
};
