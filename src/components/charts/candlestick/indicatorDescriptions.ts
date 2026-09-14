import type { IndicatorKind } from "./interfaces/IndicatorKind.interface";

/** Plain-language "how this works" text for the info icon next to each row in the "Ajouter un
 *  indicateur" picker (see IndicatorModals.tsx) — deliberately separate from indicatorCatalog.ts's
 *  own `label` (a short name) and the doc comments throughout indicators.ts (for maintainers, not
 *  end users). "custom" has no entry here — a caller's own CustomIndicatorDef is something this
 *  library knows nothing about, so its row gets no info icon at all rather than a guess.
 *
 *  ## The shape these are written in
 *
 *  Rendered by `InfoText`, which reads a small dialect: a blank line separates paragraphs, a line
 *  starting with `## ` is a heading, consecutive `- ` lines are one list, and `**bold**` / `*italic*`
 *  work inside any of them. That replaced a single block of `white-space: pre-line`, which could
 *  show line breaks and nothing else.
 *
 *  Every entry follows the same four beats, because the reader is always asking the same four
 *  questions in the same order:
 *
 *  1. an opening sentence that says what the thing **is** — in bold, because a reader who reads
 *     one line reads that one;
 *  2. *Comment ça se lit* — what to actually look at;
 *  3. *Ce qu'il ne dit pas* — the limit, stated as plainly as the promise. An explanation that only
 *     sells is an explanation that will be believed past the point where it is true;
 *  4. *Réglages* — what is adjustable, and what changing it costs.
 *
 *  Bold carries emphasis, italic names a term (*range vrai*, *squeeze*). Keeping those two apart is
 *  what stops either of them meaning nothing. */
export const VOLUME_DESCRIPTION = `**Le volume est la quantité de titres échangés durant chaque bougie**, en histogramme dans son propre panneau sous les prix.

Chaque barre reprend la couleur de la bougie correspondante — teinte de hausse quand la clôture est supérieure ou égale à l'ouverture, teinte de baisse sinon. On voit ainsi d'un coup d'œil si l'activité s'est concentrée sur des séances de progression ou de repli.

## Pourquoi il compte

C'est **la seule donnée du graphique qui ne se déduit pas des prix**.

Il mesure la participation réelle des intervenants, et sert donc à **valider ou invalider ce que les prix racontent**.

## Les lectures classiques

- **Une cassure sur volume élevé** — nettement supérieur à la moyenne récente — est bien plus crédible qu'une cassure dans l'indifférence.
- **Une hausse sur volumes déclinants** trahit un mouvement porté par de moins en moins de monde. Souvent une fin de course.
- **Un pic isolé après une longue baisse** marque fréquemment une *capitulation*, c'est-à-dire un point de bascule.

## Ce qu'il ne dit pas

Les volumes gonflent naturellement autour des **publications de résultats et des échéances de marché**, sans qu'aucun signal technique soit en cause.

Et il se lit **toujours en relatif**, comparé à sa propre moyenne récente sur le même instrument : les niveaux absolus ne sont comparables ni d'un titre à l'autre, ni d'une place à l'autre.

Certains instruments — indices, devises — n'ont **pas de volume réellement exploitable**.

## Réglages

Le panneau peut être replié pour libérer de la place sans perdre le réglage.`;

export const INDICATOR_DESCRIPTIONS: Partial<Record<IndicatorKind, string>> = {
  sma: `**La moyenne mobile simple additionne les N dernières clôtures et divise par N.** Chaque bougie de la fenêtre pèse exactement pareil, et à chaque nouvelle bougie la plus ancienne sort du calcul.

Le résultat est une ligne lissée qui suit la tendance de fond en gommant les à-coups quotidiens.

## Comment ça se lit

- **La pente** — elle monte, elle descend, elle s'aplatit.
- **La position du prix** — au-dessus de la ligne, le marché est en moyenne acheteur sur la période observée.
- **Les croisements** entre deux moyennes de périodes différentes. Une courte qui repasse au-dessus d'une longue est le signal de tendance le plus classique qui soit.

Elle sert aussi de **support ou de résistance dynamique** : sur un titre en tendance, les replis viennent souvent buter sur une moyenne de référence avant de repartir.

## Ce qu'elle ne dit pas

Elle est **en retard par construction**. Elle ne réagit qu'une fois le mouvement entamé, d'autant plus tard que la période est longue.

Et dans un marché sans direction, elle se fait traverser en permanence : les signaux se contredisent les uns les autres.

## Réglages

La période, dans les paramètres de l'indicateur. Il faut N bougies d'historique avant que la première valeur puisse être tracée.`,

  ema: `**La moyenne mobile exponentielle donne plus de poids aux clôtures récentes.** Elle part de la moyenne simple des N premières, puis se met à jour bougie après bougie en appliquant un coefficient de lissage de 2/(N+1) à la nouvelle clôture.

Le poids des anciennes décroît exponentiellement sans jamais s'annuler tout à fait : contrairement à la moyenne simple, **aucune donnée ne sort brutalement de la fenêtre**.

## Comment elle se lit

Exactement comme une moyenne simple — pente, position du prix, croisements — mais elle colle davantage au prix et signale un retournement plus tôt.

C'est pour cela qu'on la privilégie sur les unités de temps courtes, et qu'elle sert de brique de base à d'autres indicateurs, à commencer par le *MACD*.

## Ce qu'elle ne dit pas

Le revers est mécanique : **ce qui la rend plus réactive la rend aussi plus bruyante**. Davantage de faux croisements en phase de consolidation, pour exactement la même raison qu'elle est plus rapide en tendance.

## Réglages

La période, dans les paramètres. Il faut N bougies avant l'amorçage du calcul.`,

  wma: `**La moyenne mobile pondérée fait décroître les poids linéairement** : 1 pour la clôture la plus ancienne, 2 pour la suivante, jusqu'à N pour la plus récente, le tout divisé par N(N+1)/2.

Comme l'exponentielle, elle privilégie le passé proche — mais avec une **coupure nette** : au-delà de N bougies, une donnée ne compte plus du tout, là où l'exponentielle en garde toujours une trace.

## Comment elle se lit

Sa réactivité se situe **entre la simple, la plus lente, et l'exponentielle, la plus rapide**. C'est le compromis de qui trouve l'une trop molle et l'autre trop nerveuse.

La lecture est celle de toute moyenne mobile :

- l'orientation de la pente ;
- les franchissements du prix ;
- les croisements entre deux périodes.

## Ce qu'elle ne dit pas

La même chose que ses deux sœurs : elle **décrit ce qui vient de se passer**, elle n'anticipe rien, et elle perd toute utilité en marché sans direction.

## Réglages

La période, dans les paramètres.`,

  vwap: `**Le VWAP est le prix moyen réellement payé**, pondéré par les volumes : chaque bougie compte à hauteur du nombre de titres qui y ont été échangés.

Une séance très active pèse donc beaucoup plus qu'une séance creuse. Ce n'est pas une moyenne de cotations, c'est une moyenne de *transactions*.

## Comment il se lit

Les bureaux institutionnels s'en servent comme **référence d'exécution** : acheter sous le VWAP ou vendre au-dessus, c'est avoir fait mieux que le marché sur la période.

Pour un particulier, il sert surtout de **niveau pivot**. Un prix qui évolue durablement au-dessus signale une pression acheteuse ; un retour dessus après une hausse est souvent surveillé comme zone de repli.

## Ce qu'il ne dit pas

Deux points propres à cette implémentation, et le premier compte beaucoup :

- le calcul est **cumulatif depuis la première bougie de l'historique chargé** — il n'est pas remis à zéro à chaque séance. Il devient donc de plus en plus inerte à mesure que l'historique s'allonge, et il est bien plus pertinent sur une fenêtre courte ou en intraday que sur plusieurs années de bougies quotidiennes ;
- comme il s'appuie sur les volumes, il **n'a aucun sens** sur un instrument dont les données n'en comportent pas.`,

  bollinger: `**Les bandes de Bollinger mesurent la dispersion des prix autour de leur moyenne.** Une moyenne mobile simple au centre, et deux enveloppes à un nombre choisi d'écarts-types de part et d'autre, calculés sur la même fenêtre.

Comme l'écart-type mesure la dispersion, **les bandes se resserrent quand le marché devient calme et s'écartent quand il s'agite**.

## Comment elles se lisent

La lecture principale porte sur cette respiration, plus que sur les bandes elles-mêmes.

Un resserrement marqué — le *squeeze* — signale une compression de volatilité qui précède fréquemment une sortie violente. **Sans dire dans quel sens.**

On observe aussi les retours vers la bande médiane, qui joue le rôle d'aimant en marché neutre.

## Ce qu'elles ne disent pas

L'erreur classique consiste à traiter un contact de la bande haute comme un signal de vente.

En tendance forte, le prix peut **longer une bande pendant des dizaines de bougies** sans jamais se retourner. Le contact indique un mouvement statistiquement extrême, pas un retournement.

## Réglages

La période et le nombre d'écarts-types, tous deux dans les paramètres. Rien ne s'affiche avant N bougies d'historique.`,

  rsi: `**Le RSI compare la force des hausses à celle des baisses**, sur une échelle bornée de 0 à 100.

Un RSI à 70 signifie que les hausses ont largement dominé les baisses sur la fenêtre — **pas** que le prix est « trop haut » dans l'absolu.

## Comment il se lit

Les deux seuils traditionnels :

- **70**, la zone de surachat ;
- **30**, la zone de survente.

Mais ils se lisent selon le contexte : dans une tendance solide, le RSI peut rester collé au-dessus de 70 pendant des semaines, et vendre au premier franchissement revient à sortir au début du mouvement.

Deux lectures sont souvent plus fiables que les seuils bruts :

- **les divergences** — le prix inscrit un nouveau plus haut alors que le RSI en fait un plus bas. C'est un essoufflement de la dynamique, visible avant que le prix ne se retourne ;
- **la ligne 50**, qui partage biais haussier et biais baissier.

## Ce qu'il ne dit pas

Un extrême n'est pas une échéance. Le RSI dit qu'un mouvement est inhabituel, jamais qu'il va s'arrêter.

## Réglages

La période, dans les paramètres. **La raccourcir rend l'indicateur beaucoup plus nerveux** et multiplie les incursions en zone extrême.

Il s'affiche dans son propre panneau : son échelle n'a rien à voir avec celle des cours.`,

  chop: `**Le Choppiness Index répond à une seule question : le marché avance-t-il, ou tourne-t-il en rond ?**

Il compare la somme des amplitudes de chaque bougie à l'amplitude totale de la fenêtre, et ramène le rapport sur une échelle d'environ 0 à 100.

L'intuition tient en une phrase : *si le prix a parcouru beaucoup de chemin bougie après bougie mais termine dans le même couloir qu'au départ, c'est qu'il a fait des allers-retours.* La valeur monte. En ligne droite, elle descend.

## Comment il se lit

- Au-dessus d'environ **61,8** : marché indécis, en range.
- En dessous d'environ **38,2** : marché directionnel.

Son usage le plus utile est celui d'un **filtre** : couper les stratégies suiveuses de tendance quand la valeur est haute, couper les stratégies de retour à la moyenne quand elle est basse.

## Ce qu'il ne dit pas

**Rien du sens du mouvement** — seulement de sa nature.

Et il est descriptif, pas prédictif : il constate un régime déjà installé et met du temps à acter son changement.

## Réglages

La période, dans les paramètres. Il occupe son propre panneau.`,

  macd: `**Le MACD mesure l'écartement entre deux horizons de tendance.** Il se lit sur trois éléments :

- **la ligne MACD** — la différence entre une moyenne exponentielle rapide et une lente (12 et 26 périodes par défaut) ;
- **la ligne de signal** — une moyenne exponentielle de la ligne MACD elle-même (9 périodes), qui la lisse pour servir de référence ;
- **l'histogramme** — l'écart entre les deux, qui rend son creusement ou son resserrement visible d'un coup d'œil.

## Comment il se lit

- La ligne MACD **repasse au-dessus de sa ligne de signal** : reprise de dynamique haussière. L'inverse pour une reprise baissière.
- La ligne MACD **passe au-dessus de zéro** : la moyenne rapide a croisé la lente. C'est un changement de tendance plus lourd que le précédent.
- **L'histogramme se contracte** alors que le prix continue de progresser : le mouvement perd de sa force.

Les divergences entre le prix et la ligne MACD se lisent comme celles du *RSI*.

## Ce qu'il ne dit pas

C'est un indicateur de **suivi**, donc en retard par construction, et particulièrement sujet aux faux croisements dans un marché sans direction.

## Réglages

Les trois périodes, dans les paramètres — ainsi que l'affichage et les couleurs de l'histogramme.`,

  zigzag: `**Le Zig Zag réduit la courbe à ses sommets et ses creux significatifs**, reliés par une ligne brisée.

Le filtre est un seuil de déviation en pourcentage : tant que le prix n'a pas reculé d'au moins ce pourcentage depuis l'extrême en cours, **aucun pivot n'est validé** et l'oscillation est ignorée.

## Deux choix d'implémentation à connaître

Le calcul s'appuie sur **les clôtures, pas sur les mèches**.

Et la dernière jambe — celle qui est encore en formation — **n'est délibérément pas tracée**. La ligne s'arrête toujours au dernier pivot confirmé, ce qui évite qu'un segment déjà dessiné se redessine quand le marché change d'avis.

## Comment il se lit

Chaque pivot validé peut porter une étiquette qui le compare au précédent pivot de même nature :

- **HH** — sommet plus haut ;
- **LH** — sommet plus bas ;
- **HL** — creux plus haut ;
- **LL** — creux plus bas.

C'est exactement la lecture recherchée : une succession de *HH* et de *HL* décrit une tendance haussière saine, et **le premier LH ou LL signale une rupture de structure**.

## Ce qu'il ne dit pas

Il est rétrospectif par nature — un pivot ne se connaît qu'après coup — et ne fournit donc **aucun signal en temps réel**.

## Réglages

Le seuil de déviation et l'affichage des étiquettes. Un seuil bas multiplie les pivots et réintroduit le bruit ; un seuil élevé ne conserve que la structure majeure.`,

  atr: `**L'ATR mesure l'amplitude moyenne des mouvements**, gaps compris.

Il repose sur le *range vrai*, qui retient pour chaque bougie la plus grande de trois valeurs :

- son amplitude haut-bas ;
- l'écart entre son plus haut et la clôture précédente ;
- l'écart entre son plus bas et la clôture précédente.

Cette construction est ce qui permet de **comptabiliser les gaps d'ouverture**, qu'une simple amplitude haut-bas ignorerait. Les valeurs sont ensuite lissées sur la période.

## Comment il se lit

Il sert au **calibrage**, pas à la décision :

- placer un stop à deux ou trois ATR du prix d'entrée l'éloigne du bruit normal de l'instrument ;
- dimensionner une position à partir de l'ATR permet de **risquer le même montant** sur un titre nerveux et sur un titre calme ;
- une sortie de range accompagnée d'une expansion de l'ATR est plus crédible qu'une sortie molle.

## Ce qu'il ne dit pas

**Aucune direction.** Il monte dans une chute violente comme dans une envolée, et il baisse dans toute phase de calme, à la hausse comme à la baisse.

Sa valeur est en unités de prix : elle **n'est pas comparable d'un instrument à l'autre** sans être rapportée au cours.

## Réglages

La période, dans les paramètres. Il occupe son propre panneau.`,

  supertrend: `**Le Supertrend est un stop suiveur qui ne recule jamais.** Deux bandes sont construites autour du prix médian de chaque bougie, décalées d'un multiple de l'ATR.

Sa particularité est une règle de mémoire : tant que la tendance garde le même sens, **la bande active ne peut que se rapprocher du prix**. Elle se resserre comme un cliquet, et il faut une clôture franche de l'autre côté pour que la tendance bascule.

## Comment il se lit

Seule la bande active est tracée — sous le prix en phase haussière, au-dessus en phase baissière, avec une couleur par sens.

La lecture est immédiate : **la position de la ligne donne le régime**, et son basculement d'un côté à l'autre est le signal de retournement.

Comme elle ne recule jamais, elle fait un excellent **niveau d'invalidation** : on la garde comme stop tant que la tendance tient.

## Ce qu'il ne dit pas

La faiblesse de tous les suiveurs : **en marché latéral, il bascule à répétition** et enchaîne les faux signaux.

## Réglages

La période de l'ATR et le multiplicateur. Plus le multiplicateur est grand, plus la bande est éloignée du prix : **les basculements se font rares, mais tardifs**.`,

  parabolicSar: `**Le Parabolic SAR dépose une série de points qui se rapprochent du prix de plus en plus vite.** Sous les bougies tant que la tendance est haussière, au-dessus dès qu'elle devient baissière.

À chaque bougie, le point avance d'une fraction de la distance qui le sépare du prix. Cette fraction est pilotée par un **facteur d'accélération** qui s'incrémente chaque fois qu'un nouvel extrême est atteint, jusqu'à un plafond.

C'est ce qui donne à la série sa forme parabolique : *plus la tendance dure, plus le stop se resserre vite*.

## Comment il se lit

Quand le prix touche les points, la série **bascule de l'autre côté** et la tendance est considérée comme retournée — d'où le nom, l'outil sortant et se retournant du même geste.

C'est avant tout un outil de **sortie et de stop suiveur**, bien plus que d'entrée.

## Ce qu'il ne dit pas

Il a été conçu pour des marchés en tendance et devient franchement **contre-productif en range**, où il se retourne à chaque oscillation.

## Réglages

Le pas d'accélération et son plafond, ainsi que les couleurs de chaque sens. **Augmenter le pas rend l'outil plus agressif** et déclenche plus tôt.`,

  gaps: `**Un gap, ici, c'est deux bougies qui ne se chevauchent à aucun niveau de prix.** La détection ne compare pas une clôture à l'ouverture suivante, mais les plages complètes des deux bougies :

- **gap haussier** — le plus bas d'une bougie reste au-dessus du plus haut de la précédente ;
- **gap baissier** — son plus haut reste sous le plus bas de la précédente.

Un seuil minimal en pourcentage filtre les écarts insignifiants, pour qu'une série intraday bruitée ne signale pas un gap à chaque fraction de centime.

## Comment il se lit

Chaque gap est matérialisé par un **rectangle couvrant la zone de prix laissée vide**. L'indicateur balaie ensuite les bougies suivantes à la recherche de la première dont l'amplitude revient dans cette zone : c'est là que le rectangle s'arrête et que le gap est marqué comme **comblé**. Sinon il court jusqu'au bord des données.

Cette distinction est tout l'intérêt de l'outil. **Un gap non comblé reste une zone de déséquilibre**, souvent surveillée comme aimant, ou comme support et résistance potentiels lors d'un retour du prix.

## Ce qu'il ne dit pas

Sur des bougies quotidiennes, l'essentiel des gaps correspond simplement à l'écart entre deux séances. Leur nombre n'indique rien en soi.

## Réglages

Le seuil minimal, dans les paramètres.`,

  patternRecognition: `**Cet indicateur cherche les figures chartistes classiques sur une fenêtre récente** — au maximum 20 bougies se terminant à la date limite choisie dans les paramètres, par défaut la dernière disponible, qui avance donc toute seule.

Il identifie d'abord les **points pivots** de la fenêtre (une bougie dont le plus haut ou le plus bas dépasse ses voisines immédiates), puis teste chaque famille de figure sur ces pivots.

## Les critères, chiffrés

- **Double sommet** — deux sommets à moins de 1,5 % l'un de l'autre, séparés par un creux d'au moins 2 %.
- **Épaule-tête-épaule** — une tête dépassant les deux épaules d'au moins 1 %, avec des épaules alignées à 3 % près.
- **Triangles** — les pentes de la ligne des sommets et de celle des creux sont comparées, pour distinguer ascendant, descendant et symétrique.
- **Drapeau** — un mouvement directionnel valant au moins trois fois l'amplitude moyenne des bougies, puis une consolidation deux fois plus étroite.
- **Tasse avec anse** — un rebord revenant à moins de 5 % du point de départ, suivi d'un repli nettement moins profond que la tasse.

Les niveaux de support et de résistance sont obtenus en regroupant les pivots proches en prix.

## Ce qu'il ne dit pas

Chaque famille est testée indépendamment, donc **plusieurs figures peuvent coexister** sur la même fenêtre — y compris des figures qui se contredisent.

Et une figure reconnue est une **ressemblance géométrique**, pas une prévision : les critères ci-dessus décrivent une forme, jamais ce qui va suivre.

## Réglages

La date limite de la fenêtre, dans les paramètres.`,

  candleRecognition: `**Cet indicateur répond à une seule question : que raconte la bougie du moment ?** Il ne parcourt pas l'historique — il identifie la figure de chandelier présente à la date limite choisie, par défaut la dernière bougie disponible.

## Les figures, et ce qui les distingue

- **Étoile du matin ou du soir** — une première bougie franche, une deuxième au corps minuscule, une troisième qui referme au-delà du milieu de la première.
- **Three inside up/down** — le corps de la deuxième tient entièrement dans celui de la première, puis une troisième confirme au-delà de son ouverture.
- **Avalante** — un corps qui englobe entièrement le précédent, de couleur opposée.
- **Marteau, pendu, marteau inversé, étoile filante** — *exactement la même silhouette* : un petit corps collé à une extrémité et une longue mèche de l'autre côté. Elles ne se distinguent que par le côté où se trouve le corps **et par la tendance des cinq bougies précédentes** — la même forme est haussière après une baisse et baissière après une hausse.
- **Doji** — un corps quasi inexistant, signe d'indécision.

Les figures sont testées de la plus spécifique à la plus générale, et **une seule est retenue par date**.

## Ce qu'il ne dit pas

Une figure de chandelier est un **contexte**, pas un signal. Le marteau et le pendu le montrent bien : la même bougie, lue dans deux tendances, dit deux choses opposées.

## Réglages

La date limite, dans les paramètres.`,

  ichimoku: `**L'Ichimoku Kinko Hyo — « équilibre en un coup d'œil » — superpose cinq composantes** construites sur des *milieux d'amplitude* (la moyenne entre le plus haut et le plus bas d'une période), et non sur des moyennes de clôtures.

- **Tenkan**, la ligne de conversion, sur 9 périodes.
- **Kijun**, la ligne de base, sur 26 périodes.
- **Senkou A**, moyenne des deux précédentes, décalée de 26 bougies vers l'avant.
- **Senkou B**, milieu d'amplitude sur 52 périodes, décalé lui aussi de 26 bougies.
- **Chikou**, la ligne retardée, qui reporte la clôture 26 bougies en arrière.

La zone entre les deux Senkou forme le **nuage** (*kumo*).

## Comment il se lit

La lecture combine plusieurs plans, et c'est sa force :

- **le prix au-dessus du nuage** indique un régime haussier, en dessous un régime baissier, à l'intérieur une absence de tendance ;
- **le croisement Tenkan / Kijun** fournit un signal de dynamique ;
- **l'épaisseur du nuage** indique la résistance qu'il opposera : un nuage fin se traverse facilement ;
- **le changement de couleur du nuage devant le prix** annonce un basculement de régime à venir ;
- **la ligne retardée** vérifie que le prix actuel domine bien celui d'il y a 26 bougies.

## Ce qu'il ne dit pas

C'est un système complet, donc **lent**. Ses signaux arrivent confirmés et tardifs, ce qui est le compromis assumé de l'outil.`,

  pivotPoints: `**Les points pivots sont une grille de niveaux calculée une fois par période**, à partir du plus haut, du plus bas et de la clôture de la période précédente — puis **maintenue constante** sur toute la période en cours, d'où l'aspect en escalier.

Chaque période fournit sept niveaux : le pivot central, trois résistances au-dessus, trois supports en dessous.

## Quatre formules, quatre grilles

- **Classic** — la moyenne haut-bas-clôture comme pivot, les autres niveaux par symétrie autour de lui.
- **Fibonacci** — même pivot, mais les niveaux espacés selon les ratios 0,382, 0,618 et 1 de l'amplitude.
- **Woodie** — la clôture compte double dans le pivot, ce qui **rapproche toute la grille du prix de clôture**.
- **Camarilla** — la plus différente : ses niveaux ne dérivent pas du pivot mais sont ancrés directement sur la clôture par des fractions étroites de l'amplitude. Beaucoup plus resserrés, orientés intraday.

## Comment ils se lisent

L'usage est le même dans les quatre cas : des **repères objectifs, calculés à l'avance**, donc connus de tous les intervenants — pour placer un objectif, un stop, ou lire une cassure.

## Ce qu'ils ne disent pas

Leur seule autorité vient du fait que beaucoup de monde les regarde. Ce n'est pas rien, mais **ce n'est pas une propriété du marché**.

## Réglages

La période de référence (quotidienne, hebdomadaire, mensuelle) et la formule, dans les paramètres.`,

  supportResistance: `**Cet indicateur déduit les niveaux qui ont le plus souvent servi de plancher ou de plafond.** Le calcul se fait en trois temps :

- il repère les **extrêmes locaux** — une bougie dont le plus haut, ou le plus bas, dépasse toutes ses voisines sur trois bougies de chaque côté ;
- il **regroupe** ces extrêmes par proximité : deux points distants de moins de 1 % de l'amplitude de la fenêtre sont un seul et même niveau. Sans ce regroupement, on obtiendrait un niveau par bougie ;
- chaque groupe donne un niveau tracé au prix moyen de ses membres, avec **son nombre de touches**.

Un groupe d'un seul point n'est pas retenu : *un extrême isolé n'est pas un niveau*.

## Comment ils se lisent

Directement : **plus un niveau a été touché, plus il est structurant**, et plus sa cassure a de valeur.

## Ce qu'ils ne disent pas

L'analyse est **purement rétrospective**.

Et comme la fenêtre glisse avec les nouvelles données, un niveau ancien finit par en sortir et **disparaître de l'affichage** — sans que le marché l'ait pour autant oublié.

## Réglages

La profondeur de la fenêtre et le nombre maximal de niveaux conservés.`,

  adx: `**L'ADX mesure l'intensité d'une tendance, jamais son sens.** Trois courbes :

- **+DI** et **-DI** mesurent la part des mouvements de hausse et de baisse dans l'amplitude totale des bougies, après lissage — la pression acheteuse et la pression vendeuse ;
- **l'ADX** dérive de l'écart entre ces deux lignes rapporté à leur somme, lissé une seconde fois.

## Comment il se lit

L'intensité, sur l'ADX :

- **au-dessus de 25** — une tendance réellement établie ;
- **en dessous de 20** — un marché sans direction, où les stratégies suiveuses perdent leur intérêt ;
- **qui monte** — la tendance se renforce, à la hausse comme à la baisse ;
- **qui redescend d'un niveau élevé** — un essoufflement. *Pas* un retournement.

La direction, sur les deux DI : +DI au-dessus de -DI pour un marché acheteur, l'inverse sinon, leur croisement servant de signal.

L'usage le plus courant **combine les deux** : ne prendre les croisements de DI que lorsque l'ADX confirme qu'une tendance existe.

## Ce qu'il ne dit pas

Son **double lissage** le rend nettement plus tardif que la plupart des indicateurs. C'est le prix de sa stabilité.

## Réglages

La période, dans les paramètres. Il occupe son propre panneau.`,

  chandelierExit: `**Le Chandelier Exit est un stop suiveur ancré aux extrêmes récents**, pas au prix courant.

Le stop long se place **sous le plus haut** atteint sur la période, à un multiple de l'ATR. Le stop court se place symétriquement au-dessus du plus bas.

Ces deux niveaux ne peuvent que se rapprocher du prix — tant que la bougie précédente est restée du bon côté. Sinon le niveau est **réinitialisé** plutôt que de continuer à progresser depuis un point devenu caduc.

## Comment il se lit

Un seul des deux stops est affiché, celui du sens en cours. Le sens bascule en long dès qu'une clôture repasse au-dessus du stop court, en court dès qu'une clôture passe sous le stop long.

Chaque bascule peut porter une étiquette **Achat** ou **Vente**, et la zone entre le prix et le stop actif peut être remplie pour rendre le régime immédiatement lisible.

## À quoi il sert vraiment

C'est un outil de **gestion de position**, pas d'entrée. Sa raison d'être est de protéger un gain acquis tout en laissant respirer la tendance : le stop s'éloigne quand le marché s'agite, se resserre quand il se calme.

## Ce qu'il ne dit pas

Comme tout suiveur, il **sort prématurément dans les phases de respiration** d'une tendance qui, elle, tient toujours.

## Réglages

La période, le multiplicateur d'ATR, les étiquettes et le remplissage.`,

  correlation: `**Cet indicateur mesure à quel point deux instruments bougent ensemble**, sur une échelle de -1 à +1.

- **+1** — ils montent et descendent exactement en même temps.
- **0** — aucun lien lisible sur la fenêtre.
- **-1** — quand l'un monte, l'autre descend.

## Comment il se lit

Son usage principal est la **diversification** : deux positions sur des instruments corrélés à 0,9 ne sont pas deux paris, c'est le même pari pris deux fois.

Il sert aussi à repérer une **rupture de lien** — deux instruments habituellement solidaires qui cessent de l'être signalent souvent qu'il se passe quelque chose sur l'un des deux.

## Ce qu'il ne dit pas

**Une corrélation n'est pas une causalité**, et elle n'est pas stable : elle se calcule sur une fenêtre, et elle change avec elle. Deux actifs corrélés en temps calme peuvent le devenir bien davantage dans une panique — exactement au moment où la diversification comptait.

## Réglages

Le symbole de comparaison et la période, dans les paramètres.`,

  tpo: `**Le TPO — Time Price Opportunity — compte le temps passé à chaque niveau de prix**, et non le volume échangé.

Chaque bloc de temps durant lequel le prix a visité un palier y ajoute une marque. Le profil qui en résulte est large là où le marché a stationné, étroit là où il n'a fait que passer.

## Comment il se lit

- **Le point de contrôle** — le niveau le plus visité, le prix autour duquel le marché s'est le plus longuement organisé.
- **Les zones larges** — des paliers acceptés, où acheteurs et vendeurs se sont trouvés. Ils servent souvent de support ou de résistance ultérieurs.
- **Les zones étroites** — des paliers rejetés, traversés vite. Le prix a tendance à les retraverser vite aussi.

## Ce qu'il ne dit pas

Il décrit **où le marché s'est tenu**, pas où il va. Et il compte du temps, pas des transactions : un palier longuement visité dans le calme peut peser moins qu'un passage bref sur un volume massif.

## Réglages

La durée d'un bloc, dans les paramètres.`,

  freeCashFlow: `**Le flux de trésorerie disponible est ce qui reste à l'entreprise une fois payées ses dépenses d'exploitation et ses investissements.**

C'est l'argent réellement disponible pour rembourser une dette, verser un dividende ou racheter des actions.

## Comment il se lit

On le préfère souvent au bénéfice net parce qu'il est **plus difficile à habiller** : le résultat comptable dépend de choix d'amortissement et de provisions, la trésorerie beaucoup moins.

Ce qui compte est moins le niveau d'un trimestre que **la trajectoire sur plusieurs années**, et sa régularité.

## Ce qu'il ne dit pas

Un flux négatif n'est pas un mauvais signe en soi : une entreprise en forte croissance investit plus qu'elle n'encaisse, **par construction**. C'est le cas d'un flux négatif *sans* croissance qui pose question.

## Affichage

Les données viennent de l'application hôte, à la fréquence où elle les fournit — souvent trimestrielle. La ligne est prolongée entre deux publications : elle **ne change de valeur qu'aux dates de publication**.`,

  netIncome: `**Le bénéfice net est ce qui reste après toutes les charges, tous les intérêts et tous les impôts.** La dernière ligne du compte de résultat.

## Comment il se lit

La trajectoire prime sur le niveau absolu : une entreprise dont le bénéfice progresse régulièrement raconte quelque chose qu'un trimestre isolé ne dit pas.

Il se compare utilement au **chiffre d'affaires** de la même période — c'est la marge nette, qui dit si la croissance se traduit en profit.

## Ce qu'il ne dit pas

C'est un **agrégat comptable**, sensible aux éléments exceptionnels : une cession d'actif, une dépréciation, un changement de régime fiscal peuvent le faire bondir ou s'effondrer sans que l'activité ait changé.

C'est précisément pourquoi on le regarde à côté du *flux de trésorerie disponible*.

## Affichage

Aux dates de publication fournies par l'application hôte, la valeur étant maintenue entre deux.`,

  totalRevenue: `**Le chiffre d'affaires est ce que l'entreprise a facturé sur la période**, avant toute charge.

C'est la première ligne du compte de résultat, et la mesure la plus directe de la taille de l'activité.

## Comment il se lit

Sa **croissance** est ce qu'on regarde : en pourcentage d'une période à la même période de l'année précédente, pour neutraliser la saisonnalité.

Comparé au *bénéfice net*, il dit si l'entreprise grandit **en gagnant de l'argent** ou en en perdant.

## Ce qu'il ne dit pas

Rien de la rentabilité. Un chiffre d'affaires en forte hausse avec une marge qui s'effondre décrit une entreprise qui achète sa croissance.

## Affichage

Aux dates de publication fournies par l'application hôte.`,

  netMargin: `**La marge nette est la part du chiffre d'affaires qui finit en bénéfice.** Bénéfice net divisé par chiffre d'affaires.

## Comment elle se lit

Elle dit **combien l'entreprise garde de ce qu'elle facture**, ce qu'aucun des deux nombres ne dit seul.

Elle n'a de sens que comparée : à l'historique de la même entreprise, et aux concurrents du même secteur. Une marge nette de 5 % est excellente dans la distribution et catastrophique dans le logiciel.

## Ce qu'elle ne dit pas

Elle hérite de toutes les fragilités du bénéfice net — éléments exceptionnels, fiscalité — et **une marge qui s'améliore parce que le chiffre d'affaires recule** n'est pas une bonne nouvelle.

## Affichage

Aux dates de publication fournies par l'application hôte.`,

  grossMargin: `**La marge brute est ce qui reste après le seul coût de production.** Avant les frais de structure, la recherche, le commercial, les intérêts et l'impôt.

## Comment elle se lit

C'est la mesure du **pouvoir de fixation des prix** : une marge brute élevée et stable signale une entreprise qui peut facturer au-dessus de son coût de revient sans perdre ses clients.

Elle est **plus stable et plus comparable** que la marge nette, parce qu'elle échappe aux choix de financement et de fiscalité.

## Ce qu'elle ne dit pas

Une marge brute confortable peut coexister avec une perte nette, si la structure de coûts en aval est trop lourde. Elle décrit le produit, pas l'entreprise entière.

## Affichage

Aux dates de publication fournies par l'application hôte.`,

  peRatio: `**Le PER est le prix d'une action rapporté au bénéfice par action.** Il répond à : *combien d'années de bénéfices actuels le marché est-il prêt à payer ?*

## Comment il se lit

Un PER élevé signale des **attentes de croissance** ; un PER bas, soit une décote, soit des doutes.

Il ne se lit que par comparaison — au secteur, et à l'historique du titre lui-même.

## Ce qu'il ne dit pas

Trois pièges classiques :

- **le bénéfice peut être proche de zéro**, et le ratio explose sans que cela signifie quoi que ce soit ;
- **un bénéfice négatif** ne donne pas de PER du tout ;
- un PER bas est souvent bas **pour une raison** — c'est le piège dit de la *value trap*.

## Affichage

Aux dates de publication fournies par l'application hôte.`,

  eps: `**Le bénéfice par action est le bénéfice net divisé par le nombre d'actions en circulation.** C'est la part du résultat qui revient à une action.

## Comment il se lit

C'est la mesure que les analystes prévoient et que le marché sanctionne : un résultat publié au-dessus ou en dessous du consensus déplace souvent le cours bien plus que le chiffre lui-même ne le justifierait.

Sa **progression** dans le temps est ce qui compte.

## Ce qu'il ne dit pas

Il peut progresser **sans que l'entreprise gagne davantage** : un rachat d'actions réduit le dénominateur, et le bénéfice par action monte mécaniquement.

## Affichage

Aux dates de publication fournies par l'application hôte.`,

  debtToEquity: `**Le ratio d'endettement compare la dette aux capitaux propres.** Combien l'entreprise a emprunté, pour chaque euro appartenant à ses actionnaires.

## Comment il se lit

C'est une mesure de **fragilité** : plus il est élevé, plus l'entreprise dépend de ses créanciers, et plus une hausse des taux ou un trou d'air pèse lourd.

Comme toutes les mesures de bilan, il se compare **au secteur** : une entreprise d'infrastructure vit normalement avec un endettement qui serait alarmant chez un éditeur de logiciels.

## Ce qu'il ne dit pas

La dette n'est pas mauvaise en soi : empruntée à taux bas pour financer un investissement rentable, elle crée de la valeur. Le ratio dit **l'ampleur**, jamais la qualité.

## Affichage

Aux dates de publication fournies par l'application hôte.`,
};
