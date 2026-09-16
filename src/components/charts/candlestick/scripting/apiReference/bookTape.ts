import { fns, t, type ScriptReferenceSection } from "./blocks";

export const BOOK_SECTION: ScriptReferenceSection = {
  id: "book",
  title: "book.*",
  group: "API du script",
  blocks: [
    t(
      "Le carnet d'ordres au repos, lu à la barre en cours d'exécution. Ce que le prix ne dit pas : non pas ce qui s'est échangé, mais ce qui attend — et à quel prix."
    ),
    t(
      "Cette bibliothèque n'a aucune source de données et n'en invente aucune. Le carnet vient de l'application (prop depth du graphique). Sans lui, book.available() répond false et toutes les autres méthodes renvoient vide : un script écrit pour le carnet tourne alors sans rien dessiner, ce qui est le comportement voulu. Une carte de liquidité déduite des bougies serait un dessin de la barre de volume dont elle vient, et rien ne permettrait à l'œil de s'en apercevoir."
    ),
    t(
      "Le flux est rangé par barre avant qu'un script ne le voie : la résolution temporelle de tout ce qui suit est celle du graphique, pas celle du flux. Un flux qui publie dix instantanés dans une bougie donne dix observations à cette colonne, pas dix colonnes."
    ),
    t(
      "Une distinction porte toute la détection d'icebergs et mérite d'être dite une fois : book.sizeAt donne la taille AFFICHÉE, tape.volumeAt le volume EXÉCUTÉ. Ce sont deux nombres différents au même prix, et c'est leur écart qui trahit un ordre caché. Un flux qui les confondrait ne rendrait pas la détection fausse : il la rendrait vide de sens."
    ),
    ...fns([
      {
        signature: "book.available()",
        keywords: ["book.available"],
        purpose:
          "Si l'application a fourni un carnet. À interroger avant tout le reste : c'est ce qui permet au même script de tourner sur un graphique qui en a un et sur un graphique qui n'en a pas.",
        params: [],
        returns: "true ou false.",
        example: `if (!book.available()) return;`,
      },
      {
        signature: "book.bids() / book.asks()",
        keywords: ["book.bids", "book.asks"],
        purpose:
          "Les niveaux au repos de chaque côté, tels qu'ils étaient au dernier instantané de la bougie — le carnet à sa clôture. Triés meilleur d'abord.",
        params: [],
        returns: "un tableau de { price, size }, vide si aucun instantané n'est tombé dans cette barre.",
        example: `const meilleurs = book.bids().slice(0, 5);`,
      },
      {
        signature: "book.levels()",
        keywords: ["book.levels"],
        purpose:
          "Les deux côtés en une seule liste. Ce à partir de quoi une colonne de carte de liquidité se dessine : une carte ne distingue pas l'achat de la vente, elle montre où la taille est.",
        params: [],
        returns: "un tableau de { price, size }.",
        example: `const cellules = book.levels().map((n) => ({ price: n.price, value: n.size }));`,
      },
      {
        signature: "book.best()",
        keywords: ["book.best"],
        purpose: "Le meilleur achat, la meilleure vente, et l'écart entre les deux.",
        params: [],
        returns: "{ bid, ask, spread } — chacun null si ce côté du carnet est vide.",
        example: `const centre = (book.best().bid + book.best().ask) / 2;`,
      },
      {
        signature: "book.sizeAt(price, tolerance?)",
        keywords: ["book.sizeAt"],
        purpose:
          "La plus grande taille AFFICHÉE vue à ce prix pendant la bougie, tous instantanés confondus. Le maximum et non la dernière valeur : c'est le dénominateur de la détection d'icebergs, et lire le dernier instantané ferait passer un niveau mangé et pas encore réapprovisionné pour un niveau qui n'a rien montré.",
        params: [
          "price — le prix exact.",
          "tolerance — élargit la recherche à une bande autour du prix, pour un flux dont les pas ne tombent pas sur la grille du script. 0 par défaut.",
        ],
        returns: "un nombre, 0 si rien n'a été vu à ce prix.",
        example: `const affiche = book.sizeAt(niveau.price, pas / 2);`,
      },
      {
        signature: "book.pressure(depth)",
        keywords: ["book.pressure"],
        purpose:
          "La taille cumulée dans les depth unités de prix sous le meilleur achat et au-dessus de la meilleure vente. Les deux nombres dont un déséquilibre est le rapport.",
        params: [],
        returns: "{ bid, ask }.",
        example: `const p = book.pressure(0.5);
const desequilibre = (p.bid - p.ask) / (p.bid + p.ask);`,
      },
    ]),
  ],
};

export const TAPE_SECTION: ScriptReferenceSection = {
  id: "tape",
  title: "tape.*",
  group: "API du script",
  blocks: [
    t(
      "Les exécutions qui ont imprimé sur la barre en cours : où, combien, et qui a traversé le spread. Fourni par l'application (prop tape du graphique), comme le carnet."
    ),
    t(
      "L'agressseur est la moitié qu'une impression brute ne porte pas et que le flux doit dire. Une impression dont il n'est pas nommé ne compte dans aucun sens du delta : un delta qui devinerait serait un delta que personne ne peut vérifier."
    ),
    ...fns([
      {
        signature: "tape.available()",
        keywords: ["tape.available"],
        purpose: "Si l'application a fourni le tape.",
        params: [],
        returns: "true ou false.",
        example: `if (tape.available()) plot.pane("Delta").histogram("Delta", tape.delta());`,
      },
      {
        signature: "tape.volumeAt(price, tolerance?)",
        keywords: ["tape.volumeAt"],
        purpose:
          "Le volume EXÉCUTÉ à ce prix sur la bougie. Le numérateur de la détection d'icebergs — à comparer à ce que le niveau a jamais affiché, jamais à sa taille actuelle.",
        params: ["price — le prix exact.", "tolerance — bande autour du prix, 0 par défaut."],
        returns: "un nombre.",
        example: `const execute = tape.volumeAt(niveau.price, pas / 2);
if (execute > affiche * 8) plot.signal("point", { price: niveau.price, text: "Iceberg" });`,
      },
      {
        signature: "tape.delta()",
        keywords: ["tape.delta"],
        purpose: "Taille initiée à l'achat moins taille initiée à la vente, sur cette bougie.",
        params: [],
        returns: "un nombre, 0 si aucune impression n'a d'agresseur nommé.",
        example: `plot.pane("Delta").histogram("Delta", tape.delta());`,
      },
      {
        signature: "tape.prints() / tape.volume()",
        keywords: ["tape.prints", "tape.volume"],
        purpose:
          "Les impressions brutes de la bougie, et leur taille totale. tape.volume() peut différer du volume de la bougie : ce sont deux sources, et les faire coïncider serait une supposition.",
        params: [],
        returns: "un tableau de { time, price, size, aggressor }, et un nombre.",
        example: `for (const p of tape.prints()) if (p.size > 1000) console.log(p.price);`,
      },
    ]),
  ],
};
