import type { DrawingToolType } from "./interfaces/DrawingToolType.interface";

/** Plain-language "how this works" text for each drawing tool's own info icon (see ToolsRail.tsx)
 *  — same role `INDICATOR_DESCRIPTIONS` already plays for indicators, just for the tool-picker
 *  menus instead. "zoomIn" has no entry — it never reaches a menu at all (see
 *  DRAWING_DIAGRAMS' own doc for why), so nothing here ever needs to explain it to anyone.
 *
 *  Written in the same dialect as `INDICATOR_DESCRIPTIONS` and rendered by the same `InfoText`:
 *  a blank line between paragraphs, `## ` for a heading, `- ` for list items, `**bold**` for
 *  emphasis and `*italic*` for a term being named.
 *
 *  The beats differ slightly from an indicator's, because the question differs. Nobody asks what a
 *  rectangle *means*; they ask how many clicks it takes and what it is for. So each entry opens
 *  with a bold sentence naming the gesture, then says what it is for, then what stays adjustable
 *  afterwards — and, where there is one, the trap. A tool that quietly does something surprising
 *  (a Fibonacci level that holds only because everyone watches it; a table that reshuffles its
 *  cells when a column is added) is worth one honest paragraph. */
export const DRAWING_TOOL_DESCRIPTIONS: Partial<Record<DrawingToolType, string>> = {
  trendline: `**Deux clics : le premier fixe le départ, le second l'extrémité.** Le segment s'arrête exactement sur ces deux points.

C'est l'outil de base de l'analyse graphique — celui qui matérialise un support en reliant des creux successifs, une résistance en reliant des sommets, ou l'axe d'une tendance.

## La règle des trois points

Il faut **deux points de contact pour tracer** la ligne, et **un troisième pour la valider**.

La raison est arithmétique : deux points suffisent toujours à faire une droite, n'importe lesquels. *C'est le troisième qui prouve que le marché la respecte.*

## Ce qu'on surveille ensuite

- **La cassure** — une clôture franche de l'autre côté.
- **Le retest** — le prix qui revient toucher la ligne par en dessous après l'avoir franchie.

## Réglages

Les deux extrémités restent déplaçables. La fenêtre d'édition permet ensuite de prolonger la ligne d'un côté ou des deux, ou de lui ajouter une pointe de flèche, sans la retracer.

L'aimant, s'il est actif, accroche chaque point au prix d'ouverture, de plus haut, de plus bas ou de clôture le plus proche.`,

  extended: `**Une ligne de tendance qui ne s'arrête pas à ses deux points**, mais poursuit jusqu'aux bords gauche et droit de la zone de prix.

Les deux points cliqués définissent toujours la pente et restent les seules poignées déplaçables. **Seul l'affichage change.**

## À quoi ça sert

Projeter dans le futur une droite construite sur le passé.

Une oblique de support tracée sur trois creux anciens indique alors **à quel prix elle passera dans deux semaines** — un niveau à surveiller à l'avance, plutôt qu'une observation après coup.

Le prolongement vers la gauche répond à l'autre question : *la droite avait-elle déjà un sens avant la zone qui a servi à la tracer ?*

## Ce qu'elle ne dit pas

L'erreur grandit avec la distance. **Une imprécision d'un pixel sur la pente devient un écart de plusieurs pour cent** quelques mois plus à droite — et le prolongement ne le signale pas : il trace une droite aussi nette près des points d'ancrage qu'à cent bougies de là.

Plus la projection est lointaine, plus elle vaut comme zone, pas comme niveau.

## Réglages

La direction du prolongement — gauche, droite ou les deux — se modifie dans la fenêtre d'édition. N'importe quelle ligne de tendance ordinaire peut y être convertie.`,

  channel: `**Trois clics.** Les deux premiers tracent la ligne principale, exactement comme une ligne de tendance. Le troisième fixe l'écart de la seconde ligne.

Cet écart est mesuré comme la **distance verticale en prix** entre le point cliqué et la ligne principale à cette même date, puis appliqué tel quel sur toute la longueur. La seconde ligne est donc rigoureusement parallèle — c'est une distance en prix, pas une distance perpendiculaire, la simplification qu'utilisent la plupart des plateformes.

## À quoi ça sert

Encadrer une tendance qui progresse en oscillant : la ligne basse regroupe les creux, la ligne haute les sommets.

L'espace entre les deux devient une **zone de travail** — on achète près du bas, on allège près du haut, tant que le canal tient.

## Ce qu'on surveille

- **La sortie par le haut** — une accélération.
- **La sortie par le bas** — l'invalidation de la structure.

Un canal correctement tracé demande idéalement **deux points de contact sur chaque bord**.

## Ce qu'il ne dit pas

Le troisième clic est libre, et c'est sa faiblesse : **on peut faire entrer à peu près n'importe quelle hausse dans un canal** en choisissant bien l'écart.

Le test honnête est de le tracer sur les oscillations passées et de vérifier que le prix a réellement touché les deux bords — pas de l'élargir jusqu'à ce qu'il contienne tout.`,

  disjointChannel: `**Trois clics, comme le canal parallèle — mais la seconde ligne n'est pas une copie décalée.** L'écart demandé sert à construire une ligne dont la pente est *inversée* par rapport à la première.

Concrètement : son extrémité éloignée est placée à l'écart demandé, son extrémité proche est reflétée de l'autre côté. Les deux lignes **convergent ou divergent** au lieu de rester parallèles.

Le tracé compte donc bien quatre points, mais **le quatrième est calculé, pas cliqué**. Les deux points obtenus deviennent ensuite des poignées ordinaires, librement déplaçables — de quoi rectifier l'angle à la main jusqu'à faire épouser aux deux bords la structure réelle.

## À quoi ça sert

C'est l'outil des figures **en biseau et en élargissement** — triangle, coin ascendant ou descendant, mégaphone — que le canal parallèle est incapable de représenter.

## Ce qu'il ne dit pas

Deux pentes indépendantes, c'est **un degré de liberté de plus** que le canal parallèle.

Autrement dit : il épouse mieux, mais il prouve moins. *Plus une forme demande d'ajustements pour coller au passé, moins elle dit du futur.*`,

  horizontal: `**Un seul clic pose un niveau de prix traversant tout le graphique**, passé comme futur.

Le tracé le plus simple, et souvent le plus utile : anciens sommets, anciens creux, seuils psychologiques ronds, prix d'entrée, niveau de stop.

## Pourquoi il est plus fiable qu'une oblique

Un niveau horizontal **ne dépend d'aucun choix de pente**, donc de bien moins d'interprétation.

Il est par conséquent plus consensuel entre intervenants — *et donc plus susceptible d'être réellement respecté*.

## Comment il se lit

On observe le nombre de fois où le prix y a réagi, et le fait qu'un **ancien support se comporte souvent en résistance une fois cassé**, et réciproquement.

## Bon à savoir

Le niveau est posé **dans le panneau où le clic a eu lieu**. Il peut donc tout aussi bien marquer un seuil dans le panneau des volumes ou dans celui d'un oscillateur comme le RSI, et pas seulement sur les prix.`,

  ray: `**Un niveau horizontal qui commence à la date cliquée** et se poursuit uniquement vers la droite, jusqu'au bord du graphique.

## À quoi ça sert

Exactement ce qu'il faut lorsque le niveau **n'a de sens qu'à partir d'un événement précis** : le sommet d'où part une résistance, le point de cassure d'une figure, le prix d'entrée d'une position, l'annonce à partir de laquelle un plancher s'est installé.

Faire courir la ligne sur toute la période antérieure suggérerait à tort que *le niveau existait déjà*, et encombre la lecture.

## Réglages

Contrairement à la ligne horizontale, elle se déplace **dans les deux dimensions** : son prix comme sa date de départ.

Elle peut elle aussi être posée dans le panneau des volumes ou d'un oscillateur, selon l'endroit du clic.`,

  vertical: `**Un seul clic pose un trait vertical sur toute la hauteur du graphique, à une date précise.**

Il ne dit **rien des prix**. C'est un repère purement temporel : une publication de résultats, une annonce de banque centrale, une décision d'entreprise, le début d'une session — ou simplement la date d'une décision qu'on souhaite retrouver plus tard.

## À quoi ça sert

À la **mise en relation**. En alignant visuellement l'événement avec ce qui s'est produit sur les prix, les volumes et les indicateurs situés dessous, il permet de vérifier *si une réaction a effectivement eu lieu*, et combien de temps elle a mis à se dissiper.

## Réglages

Le trait ne se déplace qu'horizontalement — sa date change, jamais son étendue verticale.

Une étiquette de texte peut lui être ajoutée depuis la fenêtre d'édition, pour nommer l'événement.`,

  pitchfork: `**Trois clics — A, B et C — placés sur trois pivots successifs** : un creux majeur, le sommet qui suit, puis le creux suivant.

La construction est mécanique :

- **la médiane**, en pointillés, part de A et passe par le milieu du segment B-C ;
- **les deux dents** sont parallèles à cette médiane et passent respectivement par B et par C.

Les segments A-B et B-C restent visibles pour montrer la construction.

## L'idée sous-jacente

Après une correction, le prix a tendance à **revenir vers la médiane**, et l'ensemble du mouvement s'inscrit dans le couloir dessiné par les deux dents.

## Comment ça se lit

- Tant que le prix évolue **dans** la fourche, la structure est valide.
- La **médiane** sert d'aimant et de ligne d'équilibre.
- Les **dents** servent de zones de retournement.
- Une **sortie durable** — en particulier au-delà de la dent inférieure en tendance haussière — signale la fin de la structure.

## Le point faible

Tout dépend du choix des trois pivots : *trois points mal choisis produisent une fourche qui ne décrit rien.*

Chaque ligne peut être masquée individuellement dans la fenêtre d'édition.`,

  schiffPitchfork: `**Une fourche d'Andrews dont la médiane ne part plus de A**, mais de la mi-hauteur entre A et B — à la date de A. Le déplacement est donc **vertical seulement**.

Les deux dents restent ancrées sur B et C, parallèles à cette nouvelle médiane.

## Pourquoi cette modification

Elle est purement pratique. Quand le segment A-B est très vertical — autrement dit quand **le premier mouvement a été brutal** — la fourche classique produit un couloir trop incliné, qui décroche rapidement du prix.

En relevant l'origine de la médiane, la variante *Schiff* **aplatit la fourche** et la maintient collée à la structure réelle.

## Comment ça se lit

Comme une fourche classique : retour vers la médiane, couloir borné par les dents, sortie durable comme invalidation.

En pratique, on trace souvent les deux et **on garde celle qui épouse le mieux les réactions passées du prix**.`,

  modifiedSchiffPitchfork: `**La logique du Schiff poussée d'un cran : la médiane part du milieu exact du segment A-B** — décalé de moitié **à la fois en prix et en date**, là où le Schiff classique ne décale qu'en prix.

Elle vise toujours le milieu du segment B-C, et les deux dents restent ancrées sur B et C.

## Ce que change le décalage en date

Il fait **pivoter légèrement toute la fourche** et l'aplatit davantage encore que le Schiff.

C'est la variante adaptée aux cas où le mouvement initial A-B a été **à la fois violent et rapide**.

## Comment choisir entre les trois fourches

Le choix est **empirique**, et autant le dire : on retient celle dont le couloir contient le mieux les oscillations *déjà observées*, puisque c'est ce qui donne le plus de crédit à sa projection vers la droite.`,

  insidePitchfork: `**La seule variante dont la géométrie change vraiment**, et pas seulement l'origine de la médiane.

Toujours trois clics A, B et C, mais **les dents ne passent plus par B et C** : l'une passe par le milieu du segment A-B, l'autre par B. La médiane vient se placer exactement entre les deux, ancrée au milieu du segment B-C.

Il en résulte une fourche **plus étroite, située à l'intérieur** du couloir qu'aurait dessiné la fourche classique sur les mêmes points — d'où son nom.

## Quand l'utiliser

Lorsque le prix évolue dans un **canal serré au sein d'un mouvement plus vaste**, et que la fourche standard produit un couloir trop large pour être exploitable.

L'*Inside Pitchfork* suit alors la structure fine plutôt que l'enveloppe générale.

## Comment ça se lit

Comme les autres : médiane comme ligne d'équilibre, dents comme bornes, sortie franche comme invalidation. Chaque ligne peut être masquée séparément.

## Ce qu'elle ne dit pas

Un couloir plus étroit est un couloir **dont on sort plus souvent**.

Une sortie de l'*Inside Pitchfork* est donc un signal bien plus faible qu'une sortie de la fourche classique tracée sur les mêmes pivots : elle dit que la structure fine a cédé, pas la structure d'ensemble.`,

  rectangle: `**Deux clics posent deux coins opposés**, avec un contour et un remplissage léger de la même couleur.

Il ne calcule rien. C'est un outil de délimitation, qui répond à un seul besoin : *dire « voilà la zone qui compte ».*

## À quoi ça sert

- **Marquer un range de consolidation**, dont les bords deviennent des niveaux à surveiller.
- **Matérialiser une zone de prix** plutôt qu'un niveau unique — souvent plus honnête qu'une ligne au pixel près, puisqu'un support est en pratique une zone.
- **Mettre en évidence une période**, par exemple les quelques séances entourant une publication.

## Un usage moins évident

Un rectangle tracé sur une consolidation passée sert de **gabarit** : on le duplique pour comparer l'amplitude et la durée d'une consolidation en cours à celles d'un épisode antérieur.

## Réglages

Les deux coins restent déplaçables individuellement ; l'ensemble se déplace d'un bloc.`,

  zones: `**Deux clics posent deux coins, mais le résultat n'est pas une boîte : c'est un découpage en trois bandes horizontales.**

- **Au-dessus** de la plus haute des deux limites — une bande positive.
- **En dessous** de la plus basse — une bande négative.
- **Entre les deux** — une bande neutre.

Chacune a son propre remplissage : couleur de hausse, couleur de baisse, teinte neutre, toutes modifiables séparément.

## Pourquoi les côtés sont masqués

Les deux traits horizontaux sont toujours visibles ; **les côtés gauche et droit ne le sont pas, par défaut**.

C'est délibéré : les bandes positive et négative se lisent comme des **régions ouvertes**, pas comme une boîte fermée. On peut les réafficher dans la fenêtre d'édition.

## À quoi ça sert

Poser un **cadre de décision** plutôt qu'un repère : au-dessus de tel prix le scénario est validé, en dessous de tel autre il est invalidé, *entre les deux il n'y a rien à faire*.

C'est aussi le tracé adapté à une zone de neutralité autour d'un prix d'entrée, ou à un couloir toléré autour d'un objectif.`,

  elbowArrow: `**Flèche brisée à segments multiples, construite clic par clic.** Chaque clic ajoute un sommet, et l'outil **reste actif indéfiniment** — contrairement à tous les autres tracés, qui se referment après un nombre de points fixé d'avance.

C'est la touche **Échap** qui valide et dessine la flèche avec les points posés jusque-là.

Les sommets sont reliés par des segments droits, et **une seule pointe est ajoutée au tout dernier point** : le sens de lecture est celui du tracé, du premier clic vers le dernier.

Rien n'oblige les segments à former des angles droits. La forme dépend uniquement de l'endroit où l'on clique — coude à angle droit ou flèche libre en plusieurs tronçons, au choix.

## À quoi ça sert

À l'**annotation** : désigner un élément précis en partant d'une zone dégagée, contourner des bougies ou d'autres tracés au lieu de passer par-dessus, relier deux événements distants sans masquer ce qui se trouve entre eux.

## Réglages

Chaque sommet reste déplaçable individuellement après validation.`,

  brush: `**Tracé à main levée : on maintient le bouton enfoncé et l'on dessine**, le trait suivant le curseur en échantillonnant sa trajectoire.

C'est le seul outil qui ne se pose pas par clics successifs, mais **par un geste continu** — du point où le bouton est enfoncé à celui où il est relâché.

## À quoi ça sert

À l'annotation libre : entourer une zone, souligner une portion de courbe, barrer un scénario abandonné, esquisser une forme qu'aucun tracé géométrique ne rendrait.

Typiquement lorsqu'on prépare une capture d'écran à commenter, ou qu'on annote un graphique pour soi-même.

## La contrepartie

Le trait peut comporter des dizaines de points, aussi **n'est-il pas modifiable point par point**. Il se déplace d'un seul bloc, et se supprime pour être refait s'il ne convient pas.

Sa couleur et son épaisseur restent réglables comme celles de n'importe quel autre tracé.`,

  arrowUp: `**Un seul clic pose un petit triangle pointant vers le haut**, juste sous l'endroit désigné.

Un repère purement visuel, sans texte ni calcul. Il marque un **point d'intérêt haussier** : un signal d'achat, un creux identifié, une bougie de retournement, l'endroit où une position a été prise.

## Pourquoi il est utile

Il reste lisible **même sur un graphique chargé**, là où une ligne supplémentaire ajouterait du bruit.

On l'utilise souvent **en série**, pour repérer plusieurs occurrences d'une même configuration et vérifier d'un coup d'œil si elle a effectivement été suivie d'effet.

## Réglages

Il se déplace librement et sa couleur se change comme celle de n'importe quel tracé. Une étiquette de texte peut lui être ajoutée depuis la fenêtre d'édition, si le symbole seul ne suffit pas.`,

  arrowDown: `**Un seul clic pose un petit triangle pointant vers le bas**, juste au-dessus de l'endroit désigné — l'exact symétrique de la flèche haut.

Il marque un **point d'intérêt baissier** : signal de vente, sommet identifié, bougie de retournement, sortie de position, ou simplement un endroit à ne pas oublier lors d'une relecture.

## Avec la flèche haut

Employées ensemble, les deux permettent de **reconstituer visuellement une série d'entrées et de sorties** sur l'historique, et d'en juger la cohérence — sans passer par un outil de position complet.

## Réglages

Comme son homologue : déplaçable, couleur modifiable, étiquette de texte possible depuis la fenêtre d'édition.`,

  arrowLine: `**Deux clics tracent un segment droit terminé par une pointe de flèche.** Le sens compte : le premier clic est l'origine, le second la cible désignée.

## À quoi ça sert

Ce n'est **pas un outil d'analyse mais d'explication**.

Il sert à montrer un mouvement (*« de là à là »*), à pointer une bougie ou un niveau depuis une zone dégagée, ou à relier une annotation à ce qu'elle commente.

Il est particulièrement utile lorsqu'un graphique est destiné à être **partagé ou commenté** : une ligne sans direction laisserait le lecteur deviner ce qui est désigné.

## Réglages

La position de la pointe suit le sens du tracé. La fenêtre d'édition permet d'ajouter ou de retirer une pointe **à chaque extrémité**, et d'associer un texte au segment.`,

  fibonacci: `**Deux clics définissent le mouvement à analyser : le premier point vaut 0 %, le second 100 %.**

L'écart de prix est ensuite découpé selon les ratios standard — **0, 23,6 %, 38,2 %, 50 %, 61,8 %, 78,6 % et 100 %** — chaque niveau étant tracé comme un segment horizontal étiqueté de son ratio et du prix correspondant.

## Comment on l'applique

Classiquement à une **jambe de tendance nette** : du creux vers le sommet pour une hausse. Les niveaux indiquent alors jusqu'où le prix pourrait retracer avant de repartir.

- **38,2 %** — une correction superficielle, dans une tendance forte.
- **50 % et 61,8 %** — une correction ordinaire. Les deux zones les plus surveillées.
- **Au-delà de 61,8 %, et a fortiori de 78,6 %** — l'idée d'une simple correction devient difficile à tenir.

## Ce qu'il faut garder en tête

Ces niveaux **n'ont aucune propriété mécanique**. Ils fonctionnent d'abord parce que beaucoup d'intervenants les regardent.

Et leur pertinence dépend **entièrement du choix des deux points de départ**. Ceux-ci restent déplaçables : tous les niveaux se recalculent aussitôt.`,

  fibonacciExtension: `**Trois clics — A, B puis C — pour projeter un objectif au-delà d'un mouvement déjà accompli.**

A et B délimitent la jambe de référence ; C marque la fin de la correction qui l'a suivie. Les niveaux sont projetés **à partir de C**, chacun valant une fraction de l'amplitude de la jambe A-B : 0, 38,2 %, 61,8 %, 100 %, 138,2 %, 161,8 %, 200 % et 261,8 %.

## Ce que les niveaux veulent dire

- **100 %** — une seconde jambe de même ampleur que la première, partant de C.
- **161,8 %** — une jambe une fois et demie plus longue.

Ce sont les deux objectifs les plus couramment retenus pour des **prises de bénéfice partielles**.

## Son rapport au retracement

Les deux outils sont complémentaires : le *retracement* indique où la correction pourrait s'arrêter, l'*extension* où le mouvement suivant pourrait aller.

## Ce qu'il ne dit pas

Comme pour le retracement, tout dépend du choix des trois points, et **ces niveaux sont des zones à surveiller, pas des cibles garanties**. Les trois points restent déplaçables.`,

  elliottImpulse: `**Six clics posent les points 0 à 5**, formant les cinq segments d'une vague impulsive au sens de la théorie d'Elliott : trois vagues dans le sens de la tendance (1, 3 et 5), entrecoupées de deux corrections (2 et 4).

Chaque sommet est numéroté sur le graphique. C'est un **outil de comptage, pas de calcul** : il ne vérifie pas la validité de la structure, il la matérialise.

## Les trois règles, à votre charge

- La **vague 2** ne doit jamais retracer entièrement la vague 1.
- La **vague 3** ne doit jamais être la plus courte des trois vagues d'impulsion.
- La **vague 4** ne doit pas empiéter sur le territoire de prix de la vague 1.

Un comptage qui viole l'une de ces règles **doit être refait**.

## À quoi ça sert

À situer le mouvement en cours dans une structure d'ensemble : se savoir en **vague 4** conduit à anticiper une dernière poussée, tandis qu'une **vague 5 achevée** signale l'approche d'une correction de plus grande ampleur.

## La subjectivité

Elle est réelle et assumée — *deux analystes comptent rarement de la même manière*. Chaque point reste déplaçable pour ajuster une lecture.`,

  elliottCorrection: `**Quatre clics posent les points 0, A, B et C**, formant les trois segments d'une vague correctrice — le contre-mouvement qui suit une impulsion. Chaque sommet porte sa lettre.

## Les formes possibles

La structure typique est le **zigzag** : une première jambe A contre la tendance, un rebond partiel B, puis une jambe C qui prolonge le mouvement de A, souvent jusqu'à une amplitude comparable.

D'autres formes existent — le **plat**, où B revient presque au point de départ, et le **triangle**, où les oscillations se resserrent. Le tracé les représente aussi bien, puisqu'il se contente de relier les points posés.

## À quoi ça sert

À **identifier la fin de la correction** pour se repositionner dans le sens de la tendance principale : l'achèvement du point C est le moment qu'on cherche à situer.

Il se combine naturellement avec la vague impulsive — cinq vagues suivies d'une correction en trois forment le **cycle de base** de la théorie.

## La subjectivité

La même que pour l'impulsion. Les quatre points restent déplaçables.`,

  headShoulders: `**Sept clics posent la figure complète**, dans l'ordre du tracé :

- un creux de départ ;
- l'**épaule gauche** ;
- le creux intermédiaire ;
- la **tête** ;
- le second creux ;
- l'**épaule droite** ;
- un dernier point de confirmation.

Les sept sommets sont numérotés, et les trois principaux reçoivent en plus leur propre étiquette.

## La ligne de cou, qui ne se clique pas

Elle est **déduite automatiquement** des deux creux situés de part et d'autre de la tête, et tracée en pointillés.

Elle se prolonge vers la droite tant que le dernier point ne l'a pas franchie par le bas ; **dès que la cassure est actée, elle cesse de se projeter** — la figure est résolue. Une ligne horizontale marque en outre le niveau de la tête, et la zone entre la figure et la ligne de cou est remplie.

## Comment ça se lit

C'est un **retournement de tendance haussière** : la tête marque le dernier excès, l'épaule droite l'échec à le dépasser.

Et c'est **la cassure de la ligne de cou qui valide la figure** — pas l'épaule droite seule. L'erreur est fréquente et coûteuse.

## L'objectif

Il se mesure en reportant **sous** la ligne de cou la hauteur qui la sépare de la tête. Les sept points restent déplaçables.`,

  cupHandle: `**Cinq clics posent la figure**, chacun étiqueté sur le graphique :

- **A** — le début de la tasse ;
- **B** — son fond ;
- **C** — la fin de la tasse et le début de l'anse ;
- **D** — le fond de l'anse ;
- **E** — sa fin.

## Ce que la forme doit respecter

La figure décrit une longue consolidation **en arrondi — pas en V** : la lenteur de la formation fait partie de sa définition. Puis un repli court et peu profond, juste sous le sommet retrouvé.

Les proportions comptent :

- **C doit revenir approximativement au niveau de A** ;
- **l'anse doit rester nettement moins profonde que la tasse**. Un repli aussi marqué que celle-ci n'est plus une anse, c'est une nouvelle jambe de baisse.

## Comment ça se lit

La lecture est haussière : la tasse traduit l'**absorption progressive des vendeurs**, l'anse une dernière prise de bénéfices, et c'est **le franchissement du niveau de C** qui déclenche la figure.

## L'objectif

Reporter la **profondeur de la tasse** au-dessus du point de cassure. Les cinq points restent déplaçables, de quoi faire épouser la forme à la structure réelle.`,

  forecast: `**Deux clics — un départ, une arrivée — tracent non pas une droite mais une courbe bombée**, terminée par une pointe.

Les deux extrémités sont annotées de leur prix et de leur date, et l'arrivée affiche en plus **la variation de prix et le temps écoulé** depuis le départ.

## Pourquoi une courbe

C'est délibéré. La forme bombée distingue immédiatement cet outil d'une ligne de tendance, et **évite qu'un scénario projeté ne soit confondu avec un support ou une résistance**.

## À quoi ça sert

C'est un outil de **narration, pas de calcul**. Il sert à esquisser une hypothèse de trajectoire — *« si le prix tient ce niveau, je le vois rejoindre celui-ci d'ici la fin du mois »*.

Et surtout à la **conserver**, pour la confronter plus tard à ce qui s'est réellement produit. C'est l'usage le plus utile qu'on puisse en faire : accumuler ses propres projections passées et vérifier honnêtement lesquelles se sont réalisées.

## Réglages

Les deux points restent déplaçables, les étiquettes se recalculant aussitôt.`,

  rangeForecast: `**Deux clics : le premier fixe le départ, le second donne la direction et l'horizon.**

À partir de ce second clic, l'outil calcule **deux objectifs encadrant symétriquement le prix visé**, à cinq pour cent au-dessus et en dessous. D'où trois branches partant du même point — vers le **Max**, vers le **Min**, et vers leur moyenne, en pointillés.

La zone triangulaire entre Max et Min est remplie, et chaque extrémité est annotée de son prix et de son écart en pourcentage.

## À quoi ça sert

C'est l'outil de la **projection honnête**.

Au lieu d'un objectif unique, qui suggère une précision illusoire, il exprime un scénario sous forme de **fourchette** — ce qui correspond bien mieux à la nature d'une anticipation de marché.

Il convient particulièrement pour formuler une hypothèse **avant une publication de résultats** ou une échéance connue.

## Réglages

Le Max et le Min sont ensuite **librement déplaçables et indépendants** : la fourchette n'a aucune obligation de rester symétrique. La branche moyenne se replace toute seule entre les deux.`,

  longPosition: `**Un seul clic pose une position longue complète.** Le point cliqué devient le prix d'entrée ; l'objectif et le stop sont calculés immédiatement de part et d'autre.

Par défaut : **dix pour cent de gain visé contre cinq pour cent de risque**, soit un rapport de deux pour un.

## Ce qui est affiché

Deux bandes horizontales partent de l'entrée — celle de l'objectif **toujours dans la couleur de hausse**, celle du stop **toujours dans la couleur de baisse**, quelle que soit leur position réelle à l'écran.

C'est volontaire : *c'est le rôle de chaque niveau qui compte, pas sa valeur.*

Chaque bande affiche son prix et son écart en pourcentage par rapport à l'entrée, et l'entrée elle-même affiche le **rapport gain/risque effectif**.

## Tout l'intérêt de l'outil

En déplaçant l'objectif et le stop pour les caler sur des **niveaux techniques réels** — une résistance au-dessus, un support sous lequel le scénario serait invalidé — on voit le rapport gain/risque **se recalculer en direct**.

C'est ce qui permet d'écarter une opération *avant même de la prendre*, lorsque le rapport devient défavorable.

## Ce qu'il ne dit pas

Le rapport affiché suppose que **le stop sera exécuté à son prix**. Un gap d'ouverture ou un décrochage violent passe au travers, et la perte réelle dépasse alors celle qui est affichée.

C'est une mesure du scénario, pas une garantie de son pire cas.

## Réglages

Les deux niveaux se déplacent en prix comme en date, la date fixant l'horizon envisagé.`,

  shortPosition: `**Un seul clic pose une position courte complète**, symétrique de la position longue : l'objectif en dessous de l'entrée, le stop au-dessus — puisqu'une vente à découvert gagne quand le prix baisse.

Les proportions par défaut sont les mêmes : **dix pour cent de gain visé contre cinq pour cent de risque**.

## Ce qui est affiché

La bande de l'objectif conserve la **couleur de gain** et celle du stop la **couleur de perte**, quelle que soit leur position à l'écran — la lecture reste donc immédiate.

Chaque bande affiche son prix et son écart en pourcentage ; l'entrée indique le rapport gain/risque courant, recalculé à chaque déplacement.

## La démarche

La même que pour une position longue : caler le **stop juste au-dessus d'une résistance** qui invaliderait le scénario, l'**objectif sur un support crédible**, et juger le rapport obtenu avant de décider.

Les deux niveaux restent déplaçables en prix comme en date.

## Ce qu'il ne dit pas

La même réserve que pour une position longue — un stop peut être franchi par un gap — **avec une asymétrie de plus** : le gain d'une vente à découvert est plafonné par le zéro, alors que la perte, elle, ne l'est par rien.`,

  text: `**Un clic ouvre une zone de saisie directement sur le graphique** : on tape, et le texte est posé. Sans fenêtre intermédiaire.

C'est l'annotation la plus dépouillée qui soit — **pas de cadre, pas de flèche, pas de connecteur**, juste des caractères posés sur le graphique.

## À quoi ça sert

À tout ce qui doit être **écrit plutôt que dessiné** : nommer une figure identifiée, noter le raisonnement derrière une décision, inscrire un objectif chiffré, dater un contexte.

Sur un graphique destiné à être relu des semaines plus tard, ou partagé, c'est souvent le tracé le plus utile de tous — *parce que c'est le seul qui explique le pourquoi*.

## Réglages

La taille, la graisse, l'italique, la couleur et un fond éventuel se règlent dans la fenêtre d'édition. Le texte se déplace ensuite librement.`,

  comment: `**Un clic ouvre une saisie, et le résultat s'affiche dans une bulle arrondie dont la pointe désigne précisément le point cliqué.**

C'est toute la différence avec le texte simple, qui repose nu sur le graphique.

## Ce que la bulle apporte

- **Le fond** garantit que le commentaire reste lisible par-dessus des bougies ou des indicateurs, là où un texte nu se confond avec ce qui se trouve derrière.
- **La pointe** lève toute ambiguïté sur *ce qui est commenté* — ce qui compte dès que plusieurs annotations cohabitent.

Le fond est coloré par défaut avec la teinte d'accentuation et reste modifiable, la couleur du texte s'ajustant pour rester lisible.

## Quand le préférer

Quand le graphique est destiné à être **partagé ou relu par quelqu'un d'autre** : il ressemble à une note collée et se lit comme telle, sans risque d'être pris pour un élément d'analyse.`,

  note: `**Deux clics : le premier place l'ancre** — un petit repère creux posé sur l'élément à commenter — **le second détermine où s'ouvre la saisie**, donc où le texte viendra se placer. Un trait droit relie les deux.

## À quoi ça sert

À **écarter le texte de la zone dense du graphique tout en gardant un lien visuel explicite** avec ce qu'il désigne.

On ancre sur la bougie ou le niveau concerné, puis on installe la note dans une marge dégagée.

C'est le tracé adapté aux annotations **un peu longues**, qui recouvriraient les prix si elles étaient posées dessus.

## Réglages

L'ancre et le texte se déplacent **indépendamment**, le trait de liaison suivant automatiquement — de quoi réorganiser plusieurs notes sans perdre leurs rattachements.`,

  priceNote: `**Une note dont l'étiquette affiche systématiquement le prix de l'ancre**, avant le texte saisi.

Le fonctionnement est celui de la note : un premier clic pour l'ancre, un second pour l'emplacement du texte, un trait reliant les deux.

## Le détail qui change tout

Ce prix **n'est pas figé au moment du tracé**. Il est relu à chaque affichage à partir de la position réelle de l'ancre : *déplacer celle-ci met la valeur à jour toute seule.*

C'est ce qui distingue l'outil d'une note ordinaire dans laquelle on aurait tapé un prix à la main — **qui deviendrait fausse au premier ajustement**.

## À quoi ça sert

À tout ce qui doit rester **chiffré et exact** : marquer un niveau de résistance en le nommant, noter un prix d'entrée envisagé, documenter un point de cassure avec sa valeur.

Ancre et texte restent déplaçables séparément.`,

  pin: `**Un seul clic plante une épingle dont la pointe touche exactement l'endroit désigné.**

Le repère le plus dépouillé de tous : pas de texte, pas de trait, pas de valeur affichée. **Juste une marque.**

## À quoi ça sert

À faire office de **signet** : retrouver rapidement un endroit sur lequel on souhaite revenir, marquer une bougie repérée au fil d'une exploration de l'historique, baliser une série de points comparables pour les retrouver d'un coup d'œil en dézoomant.

## Pourquoi son dépouillement est un avantage

Il **ne prétend rien démontrer**.

Sur un graphique déjà chargé de tracés d'analyse, c'est précisément ce qui compte : il n'ajoute aucune information susceptible d'être confondue avec un niveau ou une projection.

## Réglages

Sa taille est fixe, indépendante de l'épaisseur de trait. Seule sa couleur se règle ; l'épingle se déplace librement.`,

  flagMark: `**Un seul clic plante un petit drapeau dont le pied repose sur l'endroit désigné.** Comme l'épingle, un repère purement visuel, sans texte ni valeur.

## Sa différence avec l'épingle

Elle est d'**usage plus que de fonction**.

Là où l'épingle sert plutôt de signet personnel, le drapeau évoque un **jalon ou un événement** — le début d'une campagne, une publication, la prise d'une décision.

L'intérêt réel de disposer de deux symboles est ailleurs : **séparer deux catégories de repères** sur un même graphique, et les distinguer sans avoir à lire quoi que ce soit.

## Réglages

Taille fixe, couleur réglable — ce qui permet aussi de **coder plusieurs types d'événements par la teinte**. Le repère se déplace ensuite librement.`,

  signpost: `**Un clic ouvre une saisie, et l'étiquette obtenue est reliée par un trait vertical en pointillés jusqu'à la clôture de la bougie située à cette date**, où un petit point marque le rattachement.

## Le rattachement n'est pas figé

La bougie concernée est **déterminée à chaque affichage**. Déplacer l'étiquette le long de l'axe des dates fait suivre le connecteur, qui reste toujours accroché à la bougie effectivement située dessous.

C'est ce qui distingue le panneau du texte simple ou de la note : **le lien est temporel et automatique**, là où une note pointe vers un point fixé une fois pour toutes.

## À quoi ça sert

À **horodater un événement en le nommant** — une publication de résultats, une annonce, un changement de dirigeant — en plaçant l'étiquette au-dessus des bougies, dans une zone dégagée, *sans perdre le lien avec la date exacte*.

## Réglages

La mise en forme du texte se règle dans la fenêtre d'édition.`,

  priceLabel: `**Un seul clic pose une bulle affichant le prix du point désigné.**

Il n'y a **rien à saisir** : le contenu de la bulle est le prix lui-même, relu à chaque affichage à partir de la position réelle du repère. Déplacer la bulle met donc la valeur à jour instantanément.

## À quoi ça sert

C'est l'outil le plus direct pour **lire et conserver une valeur précise ailleurs que sur l'axe**.

On la pose sur un sommet, un creux, une clôture ou un niveau projeté, et le chiffre reste affiché sur le graphique.

Il rend service dès qu'il faut **comparer plusieurs niveaux sans passer par le survol du curseur**, ou préparer une capture d'écran où les valeurs clés doivent apparaître.

## Sa parenté avec le commentaire

La bulle reprend exactement la même forme, à ceci près que **son contenu est calculé et non écrit**.`,

  table: `**Deux clics posent les deux coins opposés d'un tableau**, découpé en cellules d'égale taille — trois lignes et trois colonnes par défaut.

Chaque cellule s'édite **directement sur le graphique par un double-clic**, sans passer par une fenêtre : on tape le contenu et on valide, cellule par cellule.

## À quoi ça sert

Aux informations structurées qu'aucun tracé ne sait porter :

- un **récapitulatif de scénario**, avec ses niveaux d'entrée, d'objectif et de stop ;
- une **liste de dates** à surveiller ;
- une **comparaison** entre plusieurs hypothèses ;
- un rappel de **règles personnelles**.

Sur un graphique destiné à être partagé ou relu plus tard, il tient lieu de légende.

## Le piège

Les cellules sont repérées par **leur position dans la grille**. Modifier le nombre de colonnes après coup **redistribue les contenus existants** — mieux vaut fixer les dimensions avant de remplir.

## Réglages

Le nombre de lignes et de colonnes, dans la fenêtre d'édition. Le tableau se déplace d'un bloc et se redimensionne par ses deux coins.`,

  measure: `**Deux clics délimitent la mesure — un départ, une arrivée — après quoi l'outil se désactive tout seul**, contrairement aux autres, qui restent actifs jusqu'à ce qu'on en sorte.

Le résultat est un rectangle translucide entre les deux points : **vert si le prix a monté**, rouge s'il a baissé, accompagné d'un encart chiffré donnant quatre valeurs :

- la **variation en pourcentage** ;
- le **nombre de bougies** écoulées ;
- le **nombre de jours calendaires** ;
- l'**écart de prix absolu** en points.

## Pourquoi deux façons de compter le temps

La distinction entre bougies et jours calendaires a son importance : **week-ends et jours fériés créent un décalage systématique** entre les deux.

## À quoi ça sert

À **comparer objectivement deux mouvements** — le rebond en cours est-il comparable au précédent, en amplitude comme en durée ? — ou à évaluer rapidement ce que représenterait un objectif en pourcentage.

## Bon à savoir

**La mesure n'est pas enregistrée parmi les dessins.** Elle reste affichée à l'écran, avec ses deux poignées déplaçables et son rectangle déplaçable d'un bloc, jusqu'à ce qu'**Échap** l'efface ou qu'une nouvelle mesure la remplace.`,
};

/** The first paragraph of a tool's own explanation, with the formatting markers taken out.
 *
 *  Derived rather than written again, and that is the point: the long text opens, by the
 *  convention above, with a bold sentence naming the gesture and what the tool is for — which is
 *  exactly the summary a hover is allowed to show. A second, hand-kept copy of the same sentence
 *  would drift from the modal it summarises, and the drift would be invisible because nobody reads
 *  both at once.
 *
 *  `null` for a tool with no explanation at all, which is how the caller knows to show nothing
 *  rather than an empty box. */
export function drawingToolSummary(tool: DrawingToolType): string | null {
  const full = DRAWING_TOOL_DESCRIPTIONS[tool];
  if (full === undefined) return null;
  const firstParagraph = full.split("\n\n")[0]?.trim() ?? "";
  if (firstParagraph === "") return null;
  // `**bold**` and `*italic*` are markers for the renderer the modal uses; in a plain-text tooltip
  // they are punctuation the reader has to look past.
  return firstParagraph.replace(/\*\*/g, "").replace(/\*/g, "").replace(/\s+/g, " ");
}
