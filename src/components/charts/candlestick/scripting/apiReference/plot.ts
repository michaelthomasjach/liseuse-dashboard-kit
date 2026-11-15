import { fns, t, c, d, type ScriptReferenceSection } from "./blocks";

const SERIES_OPTIONS = [
  "options.color — couleur CSS de la courbe.",
  "options.lineWidth — épaisseur du trait, en pixels.",
  'options.lineStyle — "solid" (défaut), "dashed" ou "dotted".',
  "options.format — le format des valeurs du panneau, comme options.format de plot.pane (les séries d'un panneau partagent son axe : le dernier format donné vaut pour tout le panneau).",
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
          "options.priceOverlay — true : le panneau s'affiche d'emblée sur le graphique des prix (overlay), sur sa propre échelle cachée (ses unités ne sont pas celles du cours), au lieu d'un panneau à lui ; sa série rejoint la légende des indicateurs en haut à gauche. L'utilisateur peut la renvoyer dans son panneau (paramètres du panneau, « Afficher sur le graphique des prix »). Panneaux du bas seulement (sans dock gauche / droite), lu au premier appel.",
          'options.format — comment l\'axe du panneau, ses badges de survol et la valeur dans sa légende écrivent les nombres. "auto" (défaut) : le nombre tel quel sous 10 000, puis k / M / B / T à trois chiffres au plus (100 → 100, 1000 → 1000, 10000 → 10k, 100000 → 100k, 1e9 → 1B, 10.1e9 → 10.1B). "integer" : pareil sans décimales. "percent" : la valeur est déjà un pourcentage, écrite 21.46%. "raw" : le nombre complet, sans abréviation. Ou un objet { decimals, compact, prefix, suffix } : { decimals: 4 } pour un MACD, { prefix: "$" } pour des montants, { compact: false, decimals: 0 } pour tout écrire en entier.',
        ],
        returns: "une poignée exposant line, area, histogram, dots, band, label et profile.",
        caveat:
          "Le format choisi par le script n'est qu'un défaut : l'utilisateur peut le remplacer dans les réglages de l'indicateur (onglet Style, « Format des valeurs »). Pour écrire un nombre de la même façon dans un label, un tableau ou une alerte, voir format.*.",
        example: `plot.pane("RSI").line("RSI", ta.rsi(market.series("close", 60), 14));
plot.pane("Volume", { format: "integer" }).histogram("Volume", market.volume(0));
plot.pane("Rendement", { format: "percent" }).line("Rendement", (market.close(0) / market.close(1) - 1) * 100);`,
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
        signature: "…​.watermark(text?, options?)",
        keywords: [".watermark", "filigrane"],
        purpose:
          "Un filigrane en fond du panneau : un grand texte pâle derrière les courbes, comme le nom du symbole derrière les bougies. Pratique pour reconnaître un panneau d'un coup d'œil, ou y écrire la source des données.",
        params: [
          "text — le texte écrit. Absent ou vide : le nom du panneau.",
          "options.opacity — de 0.02 à 0.6 ; 0.08 par défaut, la même discrétion que le filigrane des prix.",
          "options.size — la taille en % de la taille par défaut (100), de 20 à 200. Un texte trop long pour la largeur du panneau est réduit jusqu'à tenir.",
          "options.visible — false retire le filigrane.",
        ],
        returns: "rien.",
        caveat:
          "Panneaux plot.pane() seulement : sur plot.overlay() l'appel ne fait rien, le filigrane des prix est celui du symbole (Paramètres du graphique). Le dernier appel l'emporte (l'appeler à chaque barre ne coûte rien). L'utilisateur peut le changer ou le masquer dans les paramètres de l'indicateur (onglet Style, « Filigrane »).",
        example: `plot.pane("RSI").line("RSI", ta.rsi(market.series("close", 60), 14));
plot.pane("RSI").watermark("RSI 14", { opacity: 0.1, size: 80 });`,
      },
      {
        signature: "…​.fillBetween(a, b, options?)",
        keywords: [".fillBetween", "fill between", "zone remplie", "remplir entre", "aire"],
        purpose:
          "Une zone remplie entre deux courbes du même panneau, ou entre une courbe et un niveau (0 : la base du panneau) — le « fill between » des plateformes de marché. Une couleur quand la courbe a est au-dessus de l'autre bord, une autre quand elle est en dessous, découpée au point exact des croisements, dessinée derrière les lignes.",
        params: [
          "a — le nom d'une série de ce panneau (line, area, histogram, dots).",
          "b — le nom d'une autre série de ce panneau, ou un nombre : un niveau sur l'échelle du panneau (0 pour remplir sous la courbe jusqu'à la base).",
          "options.above — la couleur quand a est au-dessus de b. null : rien de ce côté. Défaut : vert.",
          "options.below — la couleur quand a est en dessous de b. null : rien de ce côté. Défaut : rouge.",
          "options.color — une seule couleur pour les deux côtés (quand above / below ne sont pas donnés).",
          "options.opacity — de 0 à 1, 0.25 par défaut ; appliquée aux couleurs qui n'ont pas déjà leur propre opacité (#rrggbbaa, rgba()).",
        ],
        returns: "rien.",
        caveat:
          "Le même couple (a, b) désigne la même zone : le dernier appel l'emporte (l'appeler à chaque barre ne coûte rien). Plusieurs zones par panneau sont possibles ; elles se peignent dans l'ordre des appels. Une série band ne peut pas être citée. L'utilisateur peut modifier, ajouter ou supprimer ces zones dans les paramètres du panneau (onglet de l'indicateur, rubrique Style, « Zones remplies ») : ses réglages remplacent alors ceux du script.",
        example: `const close = market.series("close", 120);
const rapide = plot.pane("Moyennes");
rapide.line("SMA 14", ta.sma(close, 14), { color: "#2962ff" });
rapide.line("SMA 50", ta.sma(close, 50), { color: "#ff9800" });
rapide.fillBetween("SMA 14", "SMA 50", { above: "#26a69a", below: "#ef5350", opacity: 0.2 });`,
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
        signature: "…​.heatmap(name, cells, options)",
        keywords: [".heatmap"],
        purpose:
          "Un champ temps × prix : une colonne par barre, une cellule par niveau, la couleur donnant l'intensité. C'est la forme d'une carte de liquidité — le carnet d'ordres dessiné dans le temps — et plus généralement de tout ce qui a une valeur à un prix ET à une barre. Contrairement à toutes les autres méthodes de tracé, une cellule n'est pas une valeur À une barre mais une valeur à un couple (barre, prix) : on passe donc une colonne entière à chaque appel, pas un nombre.",
        params: [
          "name — le nom du champ.",
          "cells — la colonne de cette barre : un tableau de { price, value }. Une cellule de valeur nulle ou négative est ignorée, ce n'est pas une cellule mais son absence.",
          "options.bucket — la hauteur d'une cellule en unités de prix. OBLIGATOIRE et volontairement non déduit : seul le script sait ce qu'est un niveau pour cet instrument, et une grille tirée des données changerait de hauteur dès que le flux saute un prix.",
          "options.max — la valeur peinte de la couleur la plus chaude. Sans elle, la cellule la plus forte de tout le parcours donne l'échelle — ce qui est juste pour lire un symbole et faux dès qu'on en compare deux.",
          "options.colors — la rampe, du plus froid au plus chaud. Sans elle, la rampe de profondeur : presque noir, bleu, cyan, jaune, rouge.",
          "options.opacity — 0 à 1, 0,85 par défaut. En dessous de 1, les bougies restent lisibles au travers, ce qui est toute la raison pour laquelle la carte est SOUS le prix et non à sa place.",
        ],
        returns: "rien.",
        caveat:
          "Appeler à chaque barre, comme une ligne : les colonnes s'accumulent dans l'ordre d'arrivée. Le champ est dessiné avant les bougies — c'est un fond, pas un rideau — et il est tramé une seule fois en image puis redimensionné, si bien que déplacer ou zoomer le graphique ne le recalcule jamais.",
        example: `const cellules = book.levels().map((n) => ({ price: n.price, value: n.size }));
plot.overlay("BOOKMAP").heatmap("Liquidité", cellules, { bucket: 0.05 });`,
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
      {
        signature: "plot.candleColor(color, options?)",
        keywords: ["plot.candleColor", "candleColor", "barcolor", "couleur des bougies", "colorer les bougies"],
        purpose:
          "Colore la bougie EN COURS — l'équivalent de barcolor en Pine Script. C'est ainsi qu'un indicateur applique une règle métier aux bougies elles-mêmes : « une bougie qui a fait plus de 0,3 % en vert vif », « les bougies à fort volume en bleu ». Le script tourne une fois par bougie : un appel colore la bougie de ce passage, et une bougie qu'on ne colore pas garde ses couleurs habituelles. Le dernier appel sur une même bougie l'emporte, donc inutile de le protéger par bar.isNew() : la bougie en cours change de couleur en direct quand sa condition change.",
        params: [
          "color — la couleur CSS du corps (\"#00c853\", \"orange\", \"rgba(…)\"). null efface la couleur posée plus tôt sur cette bougie par ce même script.",
          "options.wick — la couleur de la mèche ; absente : celle du corps.",
          "options.border — la couleur de la bordure du corps ; absente : celle du corps.",
        ],
        returns: "rien.",
        caveat:
          "Priorité : les règles « Couleurs conditionnelles » des paramètres du graphique (onglet Bougies) passent devant le script — une bougie qu'une règle active colore garde la couleur de la règle. Entre deux scripts, le dernier ajouté l'emporte. S'applique aux modes Bougies, Heikin Ashi et Barres ; en mode Ligne, la bougie colorée devient un point de cette couleur sur la ligne ; Renko et Line Break ne sont pas concernés. Fermer le panneau du script (ou le désactiver) rend aux bougies leurs couleurs.",
        example: `const variation = (market.close(0) - market.open(0)) / market.open(0) * 100;
if (variation > 0.3) plot.candleColor("#00c853");
else if (variation < -0.3) plot.candleColor("#d50000", { wick: "#7f0000" });`,
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
