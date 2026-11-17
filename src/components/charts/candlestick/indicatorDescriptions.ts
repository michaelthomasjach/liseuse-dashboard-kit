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
  sma: `**La moyenne mobile simple (SMA, pour *Simple Moving Average*) est la moyenne des N dernières clôtures, recalculée à chaque bougie.** Chaque bougie de la fenêtre pèse exactement pareil ; à chaque nouvelle bougie, la plus récente entre dans le calcul et la plus ancienne en sort.

Le résultat est une ligne lissée, posée sur les prix, qui suit la tendance de fond en gommant les à-coups d'une séance à l'autre. Elle sert à **identifier le sens de la tendance**, à repérer des **supports et résistances dynamiques**, et à construire des **signaux de croisement**, avec le prix ou avec une autre moyenne. C'est aussi la brique de base de nombreux autres indicateurs, à commencer par les bandes de Bollinger.

## Histoire

La moyenne mobile n'a pas d'inventeur attitré : c'est un outil ancien de la statistique, qui sert à lisser une série chiffrée pour en faire ressortir la tendance. Les analystes de marché l'ont adoptée dans la première moitié du XXe siècle, à une époque où elle se calculait encore à la main, cours après cours.

Elle s'est imposée avec les premiers systèmes de suivi de tendance des années 1950 et 1960, dont ceux de Richard Donchian, bâtis sur des croisements de moyennes, et avec les règles de lecture du prix face à la moyenne de 200 jours popularisées par Joseph Granville. Les moyennes de 50 et de 200 séances sont depuis devenues des repères que tout le marché regarde.

## Les bases

On choisit une période, 20 bougies par défaut. À chaque bougie, la moyenne des 20 dernières clôtures donne un point ; reliés entre eux, ces points forment la ligne. Comme toutes les bougies de la fenêtre comptent autant, la moyenne représente le prix « typique » de la période, avec un retard d'environ la moitié de celle-ci : une SMA 20 décrit en gros où se trouvait le marché il y a dix bougies.

La lecture tient en trois éléments :

- **la pente** : elle monte, descend ou s'aplatit, et donne le sens de la tendance sur l'horizon choisi ;
- **la position du prix** : au-dessus de la ligne, les clôtures récentes dépassent la moyenne de la période et le marché est porteur ; en dessous, c'est l'inverse ;
- **l'écart entre le prix et la ligne** : un prix très éloigné de sa moyenne signale un mouvement étiré, qui revient souvent vers elle.

La période fixe l'horizon. Une moyenne courte (10 à 20) colle au prix et réagit vite ; une moyenne longue (100 ou 200) ne retient que la tendance de fond. On combine souvent deux ou trois moyennes de périodes différentes sur le même graphique.

Particularité de la moyenne simple : quand une clôture très éloignée sort de la fenêtre, la ligne peut bouger alors que le prix du jour n'a presque pas varié. C'est l'*effet de sortie*, que la moyenne exponentielle n'a pas.

La moyenne se pose aussi sur un panneau : clic droit sur le RSI, le volume ou un autre indicateur, puis « Ajouter un indicateur sur… ». Elle se calcule alors sur la série de ce panneau (14 bougies par défaut), par exemple pour lisser le RSI ou repérer un volume supérieur à sa moyenne.

## Ce qu'il faut rechercher

### Confirmation d'une tendance haussière

Dans une hausse saine, le prix reste au-dessus de la moyenne, la pente monte, et les replis viennent s'appuyer sur la ligne avant de repartir : elle joue le rôle de **support dynamique**. Tant que ces appuis tiennent, la tendance est intacte ; une clôture nette sous la moyenne, suivie d'une pente qui s'aplatit, est le premier signe d'essoufflement. En tendance baissière, c'est symétrique : la moyenne sert de résistance aux rebonds.

[[illustration:example-sma-uptrend|Tendance haussière : le prix reste au-dessus de la SMA 20, et les consolidations viennent s'appuyer dessus.]]

### Croisement de deux moyennes

Une moyenne courte qui passe sous une moyenne longue signale que les prix récents sont désormais inférieurs à ceux de la période plus large : la tendance s'est retournée à la baisse. Le croisement inverse, la courte qui repasse au-dessus de la longue, signale une reprise haussière. Avec les moyennes de 50 et 200 séances, on parle de **croix dorée** à la hausse et de **croix de la mort** à la baisse.

Ce signal arrive toujours après le sommet ou le creux : il confirme un retournement plus qu'il ne l'annonce.

[[illustration:example-sma-crossover|Retournement : la SMA 20 passe sous la SMA 50 près de vingt bougies après le sommet.]]

### Franchissement par le prix

Le signal le plus simple est une clôture qui franchit la moyenne. Une clôture au-dessus d'une moyenne descendante attire l'attention sur une possible fin de baisse ; elle gagne en crédibilité si la pente se retourne ensuite. Sur une moyenne longue, ces franchissements sont rares et significatifs ; sur une moyenne courte, ils sont fréquents et beaucoup moins fiables.

### Marché sans tendance

Quand la moyenne s'aplatit et que le prix la traverse dans un sens puis dans l'autre, le marché est en range. Les croisements se succèdent, chacun arrivant après le mouvement qu'il prétend signaler : c'est le terrain où la moyenne mobile fait perdre de l'argent. Mieux vaut alors la mettre de côté et lire plutôt les bornes du range.

[[illustration:example-sma-range|Range : les SMA 20 et 50 ondulent sans direction et se croisent à répétition, chaque signal arrivant trop tard.]]

## Résumé

La SMA est l'outil de tendance le plus simple et le plus universel : sa pente donne le sens, la position du prix le biais, ses croisements les changements de régime. Son lissage régulier en fait une référence stable, partagée par tout le marché, au prix d'un retard important. Elle se complète bien d'une EMA, plus réactive, d'un indicateur qui dit s'il y a vraiment une tendance (ADX, Choppiness Index), et des bandes de Bollinger, qui ajoutent la dispersion autour de cette même moyenne.

## Ce qu'elle ne dit pas

Elle est **en retard par construction** : elle ne réagit qu'une fois le mouvement entamé, d'autant plus tard que la période est longue. Elle ne prévoit rien, elle résume le passé.

Dans un marché sans direction, elle se fait traverser en permanence et ses signaux se contredisent. Enfin, seules les clôtures comptent : elle ignore les volumes et les extrêmes atteints en cours de séance.`,

  ema: `**La moyenne mobile exponentielle (EMA, pour *Exponential Moving Average*) est une moyenne des clôtures qui donne plus de poids aux plus récentes.** Chaque nouvelle clôture entre dans le calcul avec un poids fixe, qui dépend de la période ; le poids des clôtures plus anciennes décroît ensuite de façon exponentielle, sans jamais tomber tout à fait à zéro.

Elle se lit exactement comme une moyenne simple (sens de la pente, position du prix, croisements), mais elle colle davantage au prix et signale un retournement plus tôt. On la privilégie quand la réactivité compte : unités de temps courtes, signaux de croisement, et comme brique d'autres indicateurs, à commencer par le *MACD*.

## Histoire

Le lissage exponentiel vient de la statistique appliquée et de la prévision : il a été formalisé dans les années 1950, notamment par Robert G. Brown pour prévoir la demande et gérer des stocks, puis par Charles Holt, qui l'a étendu aux séries en tendance. Son intérêt pratique était décisif avant l'informatique : il suffit de connaître la valeur précédente et la nouvelle donnée, sans garder toute la fenêtre en mémoire.

Les analystes techniques l'ont adopté à mesure que les calculs se sont automatisés. Le MACD de Gerald Appel, construit à la fin des années 1970 sur la différence de deux moyennes exponentielles, a largement contribué à le diffuser.

## Les bases

On choisit une période, 20 par défaut. Le calcul démarre sur la moyenne simple des N premières clôtures ; ensuite, à chaque bougie, la moyenne fait un pas vers la nouvelle clôture, un pas d'autant plus grand que la période est courte. Une EMA 20 donne environ 9,5 % du poids à la dernière clôture, une EMA 50 environ 4 %.

Le lien entre ce poids et la période n'est pas arbitraire : il donne à l'EMA le même âge moyen des données qu'une moyenne simple de même période. Les deux se comparent donc à horizon égal, l'exponentielle restant plus sensible aux dernières bougies.

Contrairement à la moyenne simple, **aucune donnée ne sort brutalement de la fenêtre** : il n'y a pas d'effet de sortie, la ligne ne bouge que sous l'effet des nouvelles clôtures.

La lecture est celle de toute moyenne mobile : la pente donne le sens de la tendance, la position du prix le biais, l'écart entre les deux l'étirement du mouvement. Les périodes les plus suivies sont 9, 12 et 26 (ces deux-là sont celles du MACD), 20, 50 et 200. Comme la SMA, l'EMA se pose aussi sur un panneau (clic droit, « Ajouter un indicateur sur… »), par exemple pour lisser un RSI.

## Ce qu'il faut rechercher

### Une réaction plus rapide que la moyenne simple

Au sommet ou au creux d'un mouvement, l'EMA s'infléchit avant la SMA de même période et se fait franchir par le prix plus tôt. Cette avance de quelques bougies fait tout son intérêt : elle confirme un retournement plus vite, au prix d'une sensibilité accrue aux simples respirations du marché.

[[illustration:example-ema-reversal|Retournement : l'EMA 20 se retourne avant la SMA 20 et accompagne la baisse de plus près.]]

### Croisement de deux EMA

Un couple d'EMA courte et longue (9 et 21, 12 et 26, 20 et 50…) sert de signal de tendance : la courte qui passe au-dessus de la longue indique une accélération haussière, l'inverse une accélération baissière. Le signal arrive plus tôt qu'avec deux moyennes simples : un avantage en tendance, un inconvénient en range, où les faux croisements se multiplient. Le MACD n'est rien d'autre que l'écart entre deux EMA, tracé dans un panneau.

[[illustration:example-ema-crossover|Retournement : l'EMA 9 passe sous l'EMA 21 une dizaine de bougies après le sommet, en un seul croisement net.]]

### Support dynamique en tendance

Dans une tendance installée, l'EMA 20 ou 21 sert souvent de zone d'appui : les replis viennent la toucher, puis le mouvement reprend. Une clôture franche de l'autre côté, suivie d'un retournement de la pente, signale que la tendance perd sa structure.

### Écart au prix

Plus le prix s'éloigne de son EMA, plus le mouvement est étiré. Un écart exceptionnel par rapport à ce que le titre fait d'habitude précède souvent une pause ou un retour vers la moyenne, sans dire quand.

## Résumé

L'EMA est la moyenne mobile de qui veut de la réactivité : même lecture que la SMA, mais un signal plus précoce et pas d'effet de sortie. Elle est la base du MACD et de nombreux systèmes de croisement. Elle se complète d'une SMA plus lente pour la tendance de fond, d'un filtre de régime (ADX, Choppiness Index) pour écarter les faux signaux, et d'un oscillateur comme le RSI pour juger de l'élan.

## Ce qu'elle ne dit pas

Le revers est mécanique : **ce qui la rend plus réactive la rend aussi plus bruyante**. Davantage de faux croisements en phase de consolidation, pour exactement la même raison qu'elle est plus rapide en tendance.

Elle reste une moyenne : en retard sur le prix, descriptive et non prédictive. Et ses premières valeurs dépendent du point de départ de l'historique chargé : deux historiques de longueurs différentes donnent des valeurs très légèrement différentes au début, l'écart s'effaçant au fil des bougies.`,

  wma: `**La moyenne mobile pondérée (WMA, pour *Weighted Moving Average*) donne à chaque clôture un poids proportionnel à sa fraîcheur** : 1 pour la plus ancienne de la fenêtre, 2 pour la suivante, et ainsi de suite jusqu'à N pour la plus récente.

Comme l'exponentielle, elle privilégie le passé proche, mais avec une **coupure nette** : au-delà de N bougies, une donnée ne compte plus du tout, là où l'exponentielle en garde toujours une trace. Elle sert, comme toute moyenne mobile, à lire le sens de la tendance, à situer le prix par rapport à elle et à produire des signaux de croisement, avec une ligne qui reste plus proche du prix que celle d'une moyenne simple.

## Histoire

La moyenne pondérée n'a pas d'inventeur attitré : donner un poids décroissant aux données anciennes est l'une des façons les plus simples de privilégier l'information récente, et elle fait partie des moyennes de base décrites par les manuels d'analyse technique.

Sa notoriété récente tient surtout aux indicateurs qui l'utilisent comme brique, en particulier la *Hull Moving Average*, proposée par l'Australien Alan Hull au milieu des années 2000, qui combine plusieurs moyennes pondérées pour réduire le retard.

## Les bases

On choisit une période, 20 par défaut. Pour une WMA 20, la dernière clôture pèse 20 fois plus que la plus ancienne de la fenêtre, et les poids décroissent régulièrement entre les deux. La somme pondérée est divisée par le total des poids, si bien que la moyenne reste à l'échelle des prix.

Comparée aux deux autres moyennes, à période égale :

- la **simple** donne le même poids à toutes les clôtures : c'est la plus lente ;
- l'**exponentielle** privilégie les dernières, mais garde une trace de tout l'historique ;
- la **pondérée** privilégie aussi les dernières et oublie tout ce qui précède la fenêtre. L'âge moyen de ses données est d'environ un tiers de la période, contre la moitié pour les deux autres : à période égale, c'est la plus réactive des trois.

Elle ne connaît qu'en atténué l'effet de sortie de la moyenne simple : la clôture qui quitte la fenêtre n'avait que le poids le plus faible, son départ fait donc peu bouger la ligne.

La lecture est celle de toute moyenne mobile : l'orientation de la pente, les franchissements du prix, les croisements entre deux périodes. Elle se pose aussi sur un panneau (clic droit, « Ajouter un indicateur sur… »), par exemple sur le RSI ou le volume.

## Ce qu'il faut rechercher

### Un retournement repéré tôt

Au sommet d'une tendance, la WMA s'infléchit et se fait traverser par le prix plus tôt qu'une SMA de même période, puis accompagne la baisse de plus près. C'est ce qui justifie son choix : réduire le retard sans passer à une période plus courte, qui serait plus bruyante encore.

[[illustration:example-wma-reversal|Retournement : la WMA 20 se retourne et suit la baisse nettement avant la SMA 20.]]

### Pente et position du prix

Pente montante et prix au-dessus : tendance haussière. Pente descendante et prix en dessous : tendance baissière. Un prix qui repasse de l'autre côté d'une WMA dont la pente s'est déjà retournée est un signal plus solide qu'un franchissement isolé, qui n'est souvent qu'une respiration.

### Croisements

Une WMA courte qui croise une WMA longue, ou une WMA qui croise une SMA de même période, sert de signal de changement de tendance. Comme la WMA est rapide, ces croisements arrivent tôt, mais ils sont aussi plus nombreux en marché hésitant.

## Résumé

La WMA est une moyenne mobile réactive, qui privilégie linéairement les clôtures récentes et oublie tout le reste. Elle se lit comme ses deux sœurs et convient à qui veut une ligne proche du prix sans le bruit d'une période très courte. Elle se complète d'une moyenne plus lente pour la tendance de fond, et d'un filtre de régime (ADX, Choppiness Index) pour écarter les signaux pris en range.

## Ce qu'elle ne dit pas

La même chose que ses deux sœurs : elle **décrit ce qui vient de se passer**, elle n'anticipe rien, et elle perd toute utilité en marché sans direction.

Sa réactivité a le même revers que celle de l'exponentielle : davantage de faux signaux dès que le marché hésite.`,

  vwap: `**Le VWAP (*Volume Weighted Average Price*, prix moyen pondéré par les volumes) est le prix moyen réellement payé pour un titre sur la période**, chaque bougie comptant à hauteur du nombre de titres qui y ont été échangés.

Une séance très active pèse donc beaucoup plus qu'une séance creuse : ce n'est pas une moyenne de cotations, c'est une moyenne de *transactions*. Il sert de **référence de prix équitable** : il dit si le prix actuel est au-dessus ou en dessous de ce que les acheteurs ont payé en moyenne, et donc qui, des acheteurs ou des vendeurs de la période, est en position de force.

## Histoire

Le VWAP est né dans les salles de marché institutionnelles des années 1980, comme étalon de la qualité d'exécution : un gérant qui achète un gros bloc d'actions en plusieurs fois compare son prix moyen au VWAP de la journée. Des travaux universitaires sur le coût des transactions l'ont ensuite adopté comme mesure de référence, et les ordres exécutés « au VWAP » sont devenus un service standard des courtiers.

Les traders particuliers l'ont repris plus tard comme niveau de lecture du graphique, surtout en intraday.

## Les bases

Pour chaque bougie, on prend un prix représentatif (la moyenne du plus haut, du plus bas et de la clôture) multiplié par le volume échangé. On additionne ces montants depuis le début du calcul et on divise par le volume total : on obtient le prix moyen auquel les titres ont changé de mains.

Dans cette implémentation, le calcul est **cumulatif depuis la première bougie de l'historique chargé** : il n'est pas remis à zéro à chaque séance, comme le fait le VWAP de séance des plateformes intraday. Conséquence directe : plus l'historique est long, moins chaque nouvelle bougie pèse, et plus la ligne devient inerte. Il est donc bien plus parlant sur une fenêtre courte ou en intraday que sur plusieurs années de bougies quotidiennes. C'est aussi pourquoi il n'a pas de période à régler.

La lecture :

- **prix au-dessus du VWAP** : en moyenne, ceux qui ont acheté sur la période sont gagnants, la pression est acheteuse ;
- **prix en dessous** : les acheteurs de la période sont perdants, la pression est vendeuse ;
- **prix qui revient sur le VWAP** : le marché teste le prix « équitable » de la période, un niveau surveillé à la fois comme support et comme résistance.

## Ce qu'il faut rechercher

### Un prix durablement au-dessus

Une tendance haussière installée maintient le prix au-dessus du VWAP : les replis s'arrêtent avant de le toucher, ou rebondissent dessus. Tant que c'est le cas, les acheteurs gardent la main. Un prix durablement en dessous caractérise, symétriquement, une tendance baissière.

[[illustration:example-vwap-uptrend|Tendance haussière : le prix reste au-dessus du VWAP, qui monte lentement sous les cours.]]

### Le retour vers le VWAP

Après un mouvement rapide qui éloigne le prix du VWAP, un retour vers lui est fréquent : c'est le niveau autour duquel s'est fait l'essentiel des échanges. Les intervenants le surveillent comme zone d'achat sur repli en tendance haussière, ou de vente sur rebond en tendance baissière. Un franchissement franc, sur des volumes en hausse, signale au contraire que le rapport de force change.

### Un marché en équilibre

Quand le prix oscille de part et d'autre d'un VWAP presque plat, personne ne domine : le VWAP marque le centre de gravité du range, et ses franchissements n'ont guère de valeur de signal.

[[illustration:example-vwap-range|Range : le VWAP s'aplatit au centre de la zone et le prix le traverse dans les deux sens.]]

### Une référence d'exécution

Pour qui doit acheter ou vendre une position, le VWAP est un étalon : acheter sous le VWAP ou vendre au-dessus, c'est avoir fait mieux que le prix moyen du marché sur la période.

## Résumé

Le VWAP résume en une ligne le prix moyen réellement payé, en tenant compte de l'activité. Il sert de niveau d'équilibre, de support ou de résistance dynamique, et d'étalon d'exécution. Cumulatif ici, il est surtout utile sur des historiques courts. Il se complète du volume lui-même, d'un profil de marché (TPO) pour voir où le prix a passé son temps, et d'une moyenne mobile pour la tendance.

## Ce qu'il ne dit pas

Deux points propres à cette implémentation, et le premier compte beaucoup :

- le calcul est **cumulatif depuis la première bougie de l'historique chargé**, sans remise à zéro par séance : sur un long historique, il ne bouge presque plus et ne reflète plus le marché récent ;
- comme il s'appuie sur les volumes, il **n'a aucun sens** sur un instrument dont les données n'en comportent pas (indices, certaines devises) : sans volume, rien n'est tracé.

Il ne donne enfin aucune direction à lui seul : c'est un niveau de référence, pas un signal.`,

  bollinger: `**Les bandes de Bollinger encadrent le prix entre deux enveloppes qui s'écartent ou se resserrent selon sa volatilité.** Au centre, une moyenne mobile simple, la **médiane** ; de part et d'autre, une **bande haute** et une **bande basse**, placées à un nombre choisi d'écarts-types de cette moyenne, calculés sur la même fenêtre.

Comme l'écart-type mesure la dispersion des clôtures, **les bandes se resserrent quand le marché se calme et s'écartent quand il s'agite**. L'indicateur sert à mesurer la volatilité, à situer le prix dans sa plage habituelle (haut ou bas *relatif* à son histoire récente) et à repérer les phases de compression qui précèdent souvent un mouvement ample.

## Histoire

Les bandes ont été mises au point par l'analyste américain **John Bollinger** au début des années 1980. Elles prolongent l'idée plus ancienne des enveloppes placées à un pourcentage fixe autour d'une moyenne, avec une différence décisive : la largeur n'est plus fixée à l'avance, elle s'adapte à la volatilité mesurée par l'écart-type.

Bollinger en a détaillé l'usage dans son livre *Bollinger on Bollinger Bands* (2001), où il présente aussi deux indicateurs dérivés : le *%b*, la position du prix entre les bandes, et la *BandWidth*, leur largeur relative. Il y recommande de ne pas utiliser les bandes seules, mais avec des indicateurs d'une autre famille.

## Les bases

Par défaut, 20 bougies et 2 écarts-types : la médiane est la SMA 20 des clôtures, et les bandes s'en écartent de deux fois l'écart-type de ces mêmes 20 clôtures. Avec ces réglages, la grande majorité des clôtures reste à l'intérieur des bandes ; un contact signale donc un prix *relativement* haut ou bas par rapport à sa propre histoire récente, pas un prix « trop » haut ou « trop » bas dans l'absolu.

Trois choses se lisent :

- **la largeur** : son resserrement ou son élargissement dit si la volatilité baisse ou monte ;
- **la position du prix** : près de la bande haute, il est haut pour la période ; près de la basse, il est bas ; autour de la médiane, il est dans sa moyenne ;
- **la médiane** elle-même, qui se lit comme une moyenne mobile : sa pente donne la tendance, et elle sert souvent d'appui lors des replis.

Les bandes se posent aussi sur la série d'un panneau : clic droit sur le RSI, le volume ou un autre indicateur, puis « Ajouter un indicateur sur… ». **Bollinger(20, 2) sur le RSI** montre quand l'élan sort de sa plage habituelle ; **sur le volume**, elles repèrent les séances anormalement actives. Mêmes réglages, mêmes trois lignes et même fond qu'en prix ; la valeur suivie par les alertes est la médiane.

## Ce qu'il faut rechercher

### Le squeeze

Un resserrement marqué des bandes, le *squeeze*, signale une compression de la volatilité. Ces phases calmes ne durent pas : elles précèdent fréquemment une sortie vive, que l'écartement brutal des bandes accompagne. Le squeeze **ne dit pas dans quel sens** : c'est la première clôture franche hors des bandes, ou un autre indicateur, qui tranche.

[[illustration:example-bollinger-squeeze|Tendance baissière : les bandes se resserrent pendant chaque consolidation, puis s'écartent quand la baisse reprend.]]

### Le prix qui longe une bande

En tendance forte, le prix peut **longer la bande haute pendant des dizaines de bougies**, la touchant ou la dépassant à répétition sans se retourner. Chaque contact est alors un signe de force, pas un signal de vente. La tendance reste intacte tant que les replis s'arrêtent vers la médiane ; un repli qui traverse la médiane et file jusqu'à la bande opposée signale un changement de régime. En baisse, le prix longe symétriquement la bande basse.

[[illustration:example-bollinger-uptrend|Tendance haussière : le prix longe la bande haute pendant les phases de hausse, et les replis s'arrêtent vers la médiane.]]

### Le retour vers la médiane en range

Sans tendance, la médiane ondule sans direction et le prix va d'une bande à l'autre : un contact de la bande haute est suivi d'un retour vers la médiane, puis souvent vers la bande basse. C'est le seul contexte où vendre la bande haute et acheter la bande basse a un sens, et il faut savoir s'arrêter dès que les bandes se mettent à s'écarter.

[[illustration:example-bollinger-range|Range : le prix touche alternativement les deux bandes et revient à chaque fois vers la médiane.]]

### Les doubles creux et doubles sommets

Un premier creux qui perce la bande basse, puis un second creux au même niveau de prix, voire plus bas, qui reste cette fois à l'intérieur des bandes : la pression vendeuse faiblit, même si le prix ne le montre pas encore. La figure symétrique, au sommet, signale un essoufflement de la hausse. Ces lectures, que John Bollinger décrit en W et en M, gagnent à être confirmées par un oscillateur comme le RSI.

## Résumé

Les bandes de Bollinger résument d'un coup d'œil la tendance (la médiane), la volatilité (la largeur) et la position relative du prix (sa place entre les bandes). Elles se lisent différemment selon le contexte : en tendance, un prix qui longe une bande confirme le mouvement ; en range, les bandes servent de bornes ; dans tous les cas, un squeeze annonce un réveil de la volatilité. Elles se complètent d'un oscillateur d'élan (RSI, MACD) pour juger de la force d'un mouvement, de l'ATR pour la volatilité en valeur absolue, et du Choppiness Index pour savoir si le marché est directionnel.

## Ce qu'elles ne disent pas

L'erreur classique consiste à traiter un contact de la bande haute comme un signal de vente. En tendance forte, le contact indique un mouvement statistiquement extrême, pas un retournement.

Le squeeze annonce un mouvement sans en donner ni le sens ni le moment. Et l'écart-type suppose des prix sagement répartis autour de leur moyenne : les marchés produisent plus d'extrêmes que ce modèle, si bien que les sorties de bandes sont plus fréquentes que la statistique ne le laisserait croire.`,

  donchian: `**Les canaux de Donchian encadrent le prix entre le plus haut et le plus bas des N dernières bougies.** Trois lignes : la **bande supérieure**, le plus haut atteint sur la fenêtre ; la **bande inférieure**, le plus bas ; et la **base**, à mi-chemin entre les deux.

C'est un indicateur à bandes, comme les bandes de Bollinger, mais bâti sur les extrêmes du prix plutôt que sur un écart-type : il montre où se situe le prix dans le couloir qu'il a parcouru récemment. Il sert à **mesurer la volatilité** (la largeur du canal) et surtout à **repérer les cassures** : un prix qui touche la bande supérieure inscrit un nouveau plus haut sur la période, un prix qui touche la bande inférieure un nouveau plus bas. Ce sont ces contacts que les traders lisent comme des signaux possibles.

## Histoire

L'indicateur porte le nom de **Richard Donchian** (1905-1993), gérant américain de fonds sur les matières premières, souvent présenté comme le père du suivi de tendance. Dès les années 1950, il formalise des règles d'achat et de vente entièrement mécaniques, fondées sur la cassure des plus hauts et des plus bas récents — la plus connue, la règle des « quatre semaines », achète la cassure du plus haut des 20 dernières séances et vend celle du plus bas.

Ces règles ont nourri des générations de systèmes de suivi de tendance, dont celui des *Turtle Traders* de Richard Dennis dans les années 1980 : entrée sur la cassure du canal de 20 jours (ou de 55 jours), sortie sur celle d'un canal plus court.

## Les bases

C'est l'un des indicateurs les plus simples à calculer et à comprendre. On choisit un nombre de bougies (20 par défaut) ; la bande supérieure est le prix le plus haut atteint sur cette fenêtre, la bande inférieure le prix le plus bas, et la base la moyenne des deux.

Les bandes avancent **en escalier** : une bande ne bouge que lorsqu'un nouvel extrême entre dans la fenêtre, ou lorsque l'ancien en sort. Un palier horizontal veut donc dire que le record de la période tient toujours.

La **largeur du canal mesure la volatilité** : il s'élargit quand le prix a beaucoup varié sur la période, il se resserre quand le marché se calme. Quand le prix atteint ou franchit une bande, il est en situation de surachat (bande haute) ou de survente (bande basse) au sens de Donchian. Deux suites sont possibles :

- la cassure **confirme la tendance**, et le prix poursuit nettement dans la même direction ;
- la tendance est déjà installée, et la cassure annonce un **léger repli** avant que le mouvement ne reprenne.

## Ce qu'il faut rechercher

### Confirmation d'une tendance haussière

Dans une tendance haussière nette, le prix revient régulièrement toucher la bande supérieure. Chaque contact est un nouveau plus haut sur la période : **un signe de force, pas d'excès**. Plus ces contacts sont fréquents, plus la tendance se renforce. La base et la bande inférieure montent en escalier sous les cours.

[[illustration:example-donchian-uptrend|Tendance haussière : le prix touche la bande supérieure à répétition, la base et la bande inférieure montent en escalier sous les cours.]]

### Confirmation d'une tendance baissière

Le cas symétrique : dans une baisse installée, le prix vient s'appuyer à plusieurs reprises sur la bande inférieure. Chaque contact est un nouveau plus bas sur la période, et la répétition de ces contacts traduit une tendance baissière qui se renforce.

[[illustration:example-donchian-downtrend|Tendance baissière : le prix revient sans cesse sur la bande inférieure, les bandes descendent en escalier.]]

### Surachat et survente de court terme

Une tendance respire. Pendant une hausse, le prix peut redescendre vers la base, voire toucher brièvement la bande inférieure : c'est une **survente de court terme**, qui ne remet pas la tendance en cause tant que la bande inférieure et la base continuent de monter. Ces replis précèdent souvent la reprise du mouvement.

De même, pendant une baisse, un rebond jusqu'à la base ou la bande supérieure est un **surachat temporaire** : la tendance baissière reprend souvent ensuite.

### Range et resserrement

Sans tendance, les bandes deviennent horizontales et le prix touche alternativement l'une puis l'autre : les cassures échouent et reviennent dans le canal. Un canal qui se resserre sur la durée signale une volatilité qui baisse ; c'est la sortie d'un tel canal étroit que guettent les systèmes de cassure.

[[illustration:example-donchian-range|Range : bandes horizontales, le prix va d'une bande à l'autre sans cassure durable.]]

## Résumé

Les canaux de Donchian mesurent la volatilité et situent le prix entre ses extrêmes récents, pour juger d'un marché suracheté ou survendu. Ils fonctionnent surtout **dans une tendance clairement établie** : en hausse, des passages fréquents en surachat (bande supérieure) renforcent la tendance ; en baisse, des passages fréquents en survente (bande inférieure) font de même. À l'inverse, un passage en survente pendant une hausse, ou en surachat pendant une baisse, est souvent temporaire.

Identifier correctement la tendance de fond est donc la clé. Les canaux se complètent bien d'outils qui la qualifient : lignes de tendance, ADX (+DI / −DI) ou une moyenne mobile longue.

## Ce qu'il ne dit pas

Une bande touchée est un fait passé : le canal ne fait que constater un nouvel extrême, il ne prévoit pas la suite. En range, les fausses cassures sont la règle plutôt que l'exception. Et l'indicateur ignore le volume : une cassure sur faibles échanges pèse moins qu'il n'y paraît.`,

  rsi: `**Le RSI (*Relative Strength Index*, indice de force relative) est un oscillateur qui compare l'ampleur des hausses récentes à celle des baisses, sur une échelle bornée de 0 à 100.**

Il mesure la vitesse et la force des variations de prix, autrement dit l'*élan* du marché. Un RSI à 70 signifie que les hausses ont largement dominé les baisses sur la fenêtre, **pas** que le prix est « trop haut » dans l'absolu. Il sert à repérer les excès (surachat, survente), à détecter les essoufflements grâce aux divergences, et à qualifier le biais du marché autour de sa ligne médiane de 50. Il s'affiche dans son propre panneau : son échelle n'a rien à voir avec celle des cours.

## Histoire

Le RSI a été créé par l'ingénieur américain **J. Welles Wilder Jr.** et publié en 1978 dans son livre *New Concepts in Technical Trading Systems*, le même ouvrage qui a introduit l'ATR, le Parabolic SAR et le système directionnel (ADX). Wilder y proposait la période de 14 et les seuils de 70 et 30, toujours utilisés par défaut.

Malgré son nom, il ne compare pas un titre au marché, comme la « force relative » au sens classique : il compare un titre à lui-même. Des praticiens ultérieurs, notamment Andrew Cardwell et Constance Brown, ont montré que sa plage de fluctuation se déplace selon la tendance, ce qui a beaucoup enrichi sa lecture.

## Les bases

À chaque bougie, la variation de clôture est classée en gain ou en perte. Gains et pertes sont lissés séparément sur la période (14 par défaut), avec la méthode de lissage propre à Wilder, puis comparés : quand les gains dominent, le RSI monte vers 100 ; quand les pertes dominent, il descend vers 0 ; quand ils s'équilibrent, il se tient autour de 50.

Les repères :

- **au-dessus de 70**, la zone de surachat : les hausses ont nettement dominé ;
- **sous 30**, la zone de survente : les baisses ont nettement dominé ;
- **50**, la ligne médiane, qui sépare biais haussier et biais baissier.

Ces seuils se lisent selon le contexte. Dans une tendance haussière solide, le RSI évolue plutôt entre 40 et 80 et peut rester au-dessus de 70 pendant des semaines ; dans une tendance baissière, plutôt entre 20 et 60. Vendre au premier franchissement de 70 dans une hausse revient souvent à sortir au début du mouvement.

La période règle la sensibilité : plus courte, le RSI devient nerveux et touche souvent les extrêmes ; plus longue, il se lisse et ne les atteint presque plus.

## Ce qu'il faut rechercher

### Surachat et survente en range

Dans un marché sans tendance, le RSI va et vient entre ses deux seuils : les passages au-dessus de 70 accompagnent les hauts du range, les passages sous 30 les bas. Le signal classique n'est pas l'entrée dans la zone mais la **sortie** : un RSI qui repasse sous 70, ou au-dessus de 30, indique que l'excès se résorbe.

[[illustration:example-rsi-range|Range : le RSI oscille d'un seuil à l'autre au rythme des hauts et des bas du prix.]]

### Une plage de tendance

En tendance haussière, le RSI se maintient au-dessus de 40 à 50 et visite souvent la zone de surachat ; ses replis s'arrêtent avant 30. L'inverse en tendance baissière. Un RSI qui ne parvient plus à tenir sa plage habituelle, qui tombe sous 40 en pleine hausse par exemple, est un premier signe de changement de régime.

[[illustration:example-rsi-uptrend|Tendance haussière : le RSI ne descend jamais sous 50 et passe souvent au-dessus de 70.]]

### Les divergences

Le prix inscrit un nouveau plus haut alors que le RSI fait un sommet plus bas : c'est une **divergence baissière**, un essoufflement de l'élan visible avant que le prix ne se retourne. La divergence haussière est symétrique : nouveau plus bas du prix, creux plus haut du RSI.

Une divergence n'est pas un signal d'entrée à elle seule : elle peut se répéter plusieurs fois avant le retournement, et se confirme par une cassure dans la structure du prix (un creux précédent enfoncé, une ligne de tendance rompue).

[[illustration:example-rsi-divergence|Retournement : le prix monte jusqu'au sommet par des plus hauts successifs, tandis que les sommets du RSI baissent ; la chute suit.]]

### Le franchissement de 50

Un RSI qui repasse au-dessus de 50 indique que les hausses dominent de nouveau sur la période ; en dessous, que les baisses ont repris la main. Plus lent que les seuils, ce repère sert de filtre de tendance : on privilégie les achats tant que le RSI tient au-dessus de 50. La ligne médiane s'affiche depuis l'onglet Style.

## Résumé

Le RSI mesure l'élan sur une échelle fixe de 0 à 100. Ses seuils de 70 et 30 signalent des excès, à lire selon le contexte : signal de retournement en range, signe de force en tendance. Ses divergences avec le prix et sa position face à 50 sont souvent plus instructives que les seuils bruts. Il se complète d'un outil de tendance (moyennes mobiles, ADX), du Choppiness Index pour savoir si le marché est en range, et du MACD pour une autre lecture de l'élan. La variante « RSI : zones de survente et de surachat » adapte les seuils au comportement propre du titre.

## Ce qu'il ne dit pas

Un extrême n'est pas une échéance : le RSI dit qu'un mouvement est inhabituel, jamais qu'il va s'arrêter, ni quand.

Il ne mesure ni l'ampleur du mouvement en prix, ni les volumes. Et ses seuils sont les mêmes pour tous les titres, alors que certains vivent en permanence près des extrêmes et que d'autres n'y vont presque jamais.`,

  rsiZones: `**Cet indicateur est un RSI qui garde la mémoire de ses propres extrêmes.** En plus de la courbe du RSI et de ses deux seuils, il trace quatre lignes horizontales, relevées sur les **30 derniers passages** en zone : la **moyenne** et le **plus haut** des pics atteints en surachat, puis la **moyenne** et le **plus bas** des creux atteints en survente. Les mêmes lignes s'ajoutent au RSI classique en cochant « Lignes de surachat et de survente calculées ».

Ces lignes répondent à une question que le RSI seul laisse ouverte : *sur ce titre, et ces derniers temps, jusqu'où va habituellement un excès ?* Un RSI à 25 n'a pas le même sens sur une valeur qui descend rarement sous 30 que sur une valeur qui touche régulièrement 15.

## Histoire

Le RSI a été publié par **J. Welles Wilder** en 1978, dans *New Concepts in Technical Trading Systems*, avec les seuils de 70 et 30. Ces seuils sont fixes et identiques pour tous les marchés ; très tôt, les praticiens ont cherché à les adapter au comportement propre de chaque titre (seuils 80 / 20 pour les valeurs nerveuses, seuils dynamiques…). Cet indicateur suit cette idée : il mesure les excès réels de l'instrument plutôt que de lui appliquer une norme.

## Les bases

Le calcul du RSI est inchangé (lissage de Wilder sur N clôtures). Ensuite :

- chaque **passage au-dessus du seuil de surachat** (bougies consécutives) donne un **pic** : le plus haut du RSI pendant ce passage ;
- chaque **passage sous le seuil de survente** donne un **creux** : le plus bas pendant ce passage ;
- sur les 30 derniers pics, la **moyenne** et le **plus haut** deviennent deux lignes horizontales ; sur les 30 derniers creux, la **moyenne** et le **plus bas**, deux autres. Leur valeur est écrite à droite du panneau.

Compter des pics plutôt que des bougies évite qu'un long passage en zone pèse plus qu'un bref : chaque excès compte une fois, à sa hauteur.

Les lignes sont relevées jusqu'à la dernière bougie de l'historique (ou jusqu'à la coupure du replay) : elles ne bougent pas quand on fait défiler le graphique. Une zone dans laquelle le RSI n'est jamais entré n'a pas de ligne ; un passage encore en cours compte avec son pic du moment.

## Ce qu'il faut rechercher

### Un excès « normal » ou inhabituel

Un RSI qui atteint la ligne de **moyenne** de sa zone est dans un excès ordinaire pour ce titre. Un RSI qui dépasse la ligne de **maximum** dépasse tous ses derniers pics : un excès rare, qui mérite l'attention — essoufflement possible, ou au contraire début d'un mouvement d'une autre ampleur.

[[illustration:example-rsiZones-range|Range : le RSI oscille entre ses zones, les lignes de moyenne marquent l'excès habituel du titre.]]

### Des zones asymétriques

Comparez les deux zones. Dans une tendance haussière, le RSI passe souvent en surachat et rarement en survente : la ligne de surachat est haute et fournie, celle de survente absente ou proche de 30. L'asymétrie des lignes résume ainsi le biais du marché sur la période.

[[illustration:example-rsiZones-uptrend|Tendance haussière : passages fréquents en surachat, peu ou pas de survente.]]

### Des seuils sur mesure

Les lignes de moyenne font de bons seuils personnalisés : un signal « RSI sous sa survente moyenne » s'adapte au titre là où « RSI sous 30 » ne s'adapte à rien. Elles se règlent comme des niveaux à part entière (couleur, style, opacité) pour rester lisibles sans écraser la courbe.

## Résumé

Le RSI à zones replace chaque excès dans l'histoire récente du titre : la moyenne dit ce qui est habituel, le maximum ce qui est exceptionnel, pour la survente comme pour le surachat. Plus le nombre de pics est grand, plus ces repères sont stables ; plus il est petit, plus ils collent au régime de marché du moment.

## Ce qu'il ne dit pas

Un maximum passé n'est pas un plancher ni un plafond : le RSI peut toujours aller plus loin. Et comme pour le RSI, un excès n'est pas une échéance — il dit qu'un mouvement est inhabituel, jamais qu'il va s'arrêter.`,

  chop: `**Le Choppiness Index (CHOP) mesure si le marché avance ou tourne en rond**, sur une échelle d'environ 0 à 100.

Il ne dit rien du sens du mouvement : il en mesure la *nature*. Une valeur élevée décrit un marché agité, sans direction, qui fait des allers-retours ; une valeur basse, un marché directionnel, qui avance franchement. Il sert surtout de **filtre** : choisir entre une méthode de suivi de tendance et une méthode de range, et écarter les faux signaux des outils de tendance quand le marché hésite. Il occupe son propre panneau.

## Histoire

Le Choppiness Index est attribué au trader australien de matières premières **E. W. Dreiss**, qui s'est inspiré de la théorie du chaos et de la géométrie fractale. L'indice compare en effet la longueur du chemin parcouru par le prix à l'étendue qu'il a réellement couverte, une idée proche de la dimension fractale d'une courbe : une ligne droite est « simple », une ligne qui zigzague remplit davantage l'espace.

Ses seuils usuels, 61,8 et 38,2, sont empruntés aux rapports de Fibonacci, très présents en analyse technique.

## Les bases

Sur la fenêtre (14 bougies par défaut), l'indicateur fait deux mesures :

- la somme des amplitudes de chaque bougie, gaps compris : le **chemin** parcouru bougie après bougie ;
- l'écart entre le plus haut et le plus bas de toute la fenêtre : l'**étendue** réellement couverte.

Il compare ensuite les deux sur une échelle logarithmique, ramenée à 0-100. L'intuition tient en une phrase : *si le prix a parcouru beaucoup de chemin bougie après bougie mais termine dans le même couloir qu'au départ, c'est qu'il a fait des allers-retours.* La valeur monte. En ligne droite, chemin et étendue se rapprochent, et elle descend.

Les repères :

- au-dessus d'environ **61,8** : marché indécis, en consolidation ou en range ;
- en dessous d'environ **38,2** : marché directionnel, en tendance ;
- entre les deux : zone de transition, sans verdict net.

Les valeurs extrêmes ne durent pas : après une tendance très nette (CHOP très bas), le marché finit par se reposer ; après une longue consolidation (CHOP très haut), une tendance finit par repartir.

## Ce qu'il faut rechercher

### Une tendance en cours

Un CHOP qui descend sous 38,2 confirme que le marché avance : c'est le contexte où les outils de suivi de tendance (moyennes mobiles, cassures, stops suiveurs) fonctionnent le mieux. Plus il descend, plus le mouvement est rectiligne, et plus il est étiré.

[[illustration:example-chop-uptrend|Hausse par paliers : le CHOP plonge sous 38,2 pendant chaque jambe de hausse et remonte au-dessus de 61,8 pendant les consolidations.]]

### Une consolidation

Un CHOP qui monte au-dessus de 61,8 signale un marché qui hésite : les croisements de moyennes et les cassures y échouent souvent. C'est le moment d'alléger les positions de tendance, ou de passer à des méthodes de range (oscillateurs, achat près du plancher et vente près du plafond).

### La sortie de consolidation

Le signal le plus utile est la **baisse du CHOP depuis des niveaux élevés** : après une période d'hésitation, un indice qui redescend franchement signale qu'une direction se dégage. Il ne dit pas laquelle : c'est le prix, ou un indicateur de direction, qui la donne.

[[illustration:example-chop-reversal|Retournement : la pause qui précède le sommet fait monter le CHOP au-dessus de 61,8 ; pendant la chute qui suit, il reste sous 30.]]

### Un filtre pour une autre méthode

Le CHOP s'utilise rarement seul. Couplé à un signal de tendance, il sert de garde-fou : on ne prend un croisement de moyennes que si le CHOP est sous un seuil, et on ne prend le signal d'un oscillateur de range que s'il est au-dessus.

## Résumé

Le Choppiness Index répond à une question préalable à toute décision : le marché est-il en tendance ou en range ? Bas, il valide les méthodes de tendance ; haut, il les met en garde. Il ne donne jamais de direction : il se complète donc d'un indicateur qui en donne une (moyennes mobiles, MACD, ADX avec ses +DI et −DI) et, en range, d'un oscillateur comme le RSI. La « Détection de range (précoce) » de cette bibliothèque s'appuie d'ailleurs sur lui.

## Ce qu'il ne dit pas

**Rien du sens du mouvement**, seulement de sa nature.

Il est descriptif, pas prédictif : il constate un régime déjà installé et met du temps à acter son changement. Ses seuils de 61,8 et 38,2 sont des conventions, pas des lois : selon l'instrument et l'unité de temps, d'autres niveaux séparent parfois mieux les régimes. Enfin, il dépend fortement de la période : une oscillation lente et ample peut paraître directionnelle sur 14 bougies, alors qu'elle forme un range sur un horizon plus long.`,

  macd: `**Le MACD (*Moving Average Convergence Divergence*) mesure l'écart entre deux moyennes mobiles exponentielles du prix, une rapide et une lente, pour suivre à la fois la tendance et son élan.** Il se lit sur trois éléments, tracés dans son propre panneau :

- **la ligne MACD**, la différence entre l'EMA rapide et l'EMA lente des clôtures (12 et 26 bougies par défaut) ;
- **la ligne de signal**, une EMA de la ligne MACD elle-même (9 bougies), qui la lisse pour servir de référence ;
- **l'histogramme**, l'écart entre les deux, qui rend visible d'un coup d'œil l'accélération ou le ralentissement du mouvement.

C'est à la fois un indicateur de tendance (le signe de la ligne MACD dit laquelle des deux moyennes est au-dessus de l'autre) et un indicateur d'élan (sa pente et l'histogramme disent si l'écart se creuse ou se résorbe).

## Histoire

Le MACD a été créé à la fin des années 1970 par **Gerald Appel**, gérant de fonds et auteur américain. Ses réglages de 12, 26 et 9 périodes sont devenus le standard universel. L'histogramme a été ajouté en 1986 par **Thomas Aspray**, pour anticiper les croisements entre la ligne MACD et sa ligne de signal.

Appel a présenté l'ensemble de sa méthode dans *Technical Analysis: Power Tools for Active Investors* (2005). Le nom résume le principe : les deux moyennes *convergent* quand la tendance ralentit et *divergent* quand elle accélère.

## Les bases

La ligne MACD est positive quand l'EMA rapide est au-dessus de la lente, c'est-à-dire quand les prix récents dépassent les prix plus anciens : la tendance est haussière. Elle est négative dans le cas inverse, et passe par zéro exactement quand les deux moyennes se croisent. Plus elle s'éloigne de zéro, plus les moyennes s'écartent : la tendance accélère. Quand elle revient vers zéro, elles se rapprochent : la tendance ralentit.

La ligne de signal suit la ligne MACD avec un temps de retard. L'histogramme mesure l'écart entre les deux : des barres qui grandissent montrent un élan qui s'accentue, des barres qui raccourcissent un élan qui faiblit, souvent avant que la ligne MACD elle-même ne se retourne. Ici, une barre prend la couleur de hausse quand la ligne MACD est au-dessus de son signal, la couleur de baisse sinon.

Le MACD n'est pas borné : ses valeurs s'expriment dans l'unité du prix. Elles ne se comparent donc pas d'un titre à l'autre, ni même entre deux époques très différentes d'un même titre.

## Ce qu'il faut rechercher

### Le croisement avec la ligne de signal

La ligne MACD qui **repasse au-dessus de sa ligne de signal**, l'histogramme passant de négatif à positif, signale une reprise de l'élan haussier ; le croisement inverse, une reprise de l'élan baissier. C'est le signal le plus fréquent et le plus rapide du MACD, donc aussi le plus exposé aux faux départs.

### Le franchissement de la ligne zéro

La ligne MACD qui passe au-dessus de zéro signifie que l'EMA rapide a croisé la lente par le haut : la tendance de fond a changé. C'est un signal plus lourd et plus tardif que le croisement avec le signal, souvent utilisé pour le confirmer. Le passage sous zéro se lit symétriquement.

### Les divergences

Le prix inscrit un nouveau plus haut, mais la ligne MACD fait un sommet plus bas : l'écart entre les moyennes se réduit, l'élan s'essouffle. C'est une **divergence baissière**, à lire comme celles du *RSI* ; la divergence haussière est symétrique. Elle prévient souvent plusieurs bougies avant le croisement des lignes, et ne vaut signal qu'une fois confirmée par le prix.

[[illustration:example-macd-reversal|Retournement : le MACD fait un sommet plus bas alors que le prix monte encore, passe sous son signal, puis sous zéro pendant la chute.]]

### Les faux signaux en range

Sans tendance, le MACD oscille autour de zéro et croise son signal à chaque vague : chaque croisement arrive alors que le mouvement est déjà bien avancé, et le croisement inverse suit peu après. Une ligne MACD collée à zéro et un histogramme minuscule décrivent un marché sans élan, où mieux vaut ignorer ses croisements.

[[illustration:example-macd-range|Range : la ligne MACD croise son signal et la ligne zéro à chaque vague, toujours avec retard.]]

## Résumé

Le MACD condense en un panneau la tendance (le signe de la ligne MACD), l'élan (sa pente et l'histogramme) et des signaux de changement (croisements avec le signal et avec zéro, divergences). Il est très utile en tendance et trompeur en range. Il se complète d'un filtre de régime (Choppiness Index, ADX), d'un oscillateur borné comme le RSI pour juger des excès, et des moyennes mobiles sur le prix, dont il n'est qu'une autre lecture.

## Ce qu'il ne dit pas

C'est un indicateur de **suivi**, donc en retard par construction : bâti sur des moyennes, il confirme les retournements plus qu'il ne les annonce, et il est particulièrement sujet aux faux croisements dans un marché sans direction.

N'étant pas borné, il ne définit pas de niveaux de surachat ou de survente valables partout. Et un histogramme qui rétrécit annonce un ralentissement, pas forcément un retournement.`,

  zigzag: `**Le Zig Zag réduit la courbe des prix à ses sommets et ses creux significatifs**, reliés par une ligne brisée. Tout mouvement plus petit qu'un seuil de déviation, exprimé en pourcentage, est ignoré : il ne reste que les oscillations qui comptent.

Ce n'est pas un indicateur de signal mais un **outil de lecture de la structure du marché**. Il montre d'un coup d'œil la succession des sommets et des creux, mesure l'ampleur de chaque jambe de hausse ou de baisse, et fait apparaître le moment où cette succession change de nature — c'est-à-dire où une tendance se dégrade.

## Histoire

L'idée de filtrer les petites oscillations pour ne garder que les mouvements d'une certaine ampleur est ancienne : elle est au cœur de la **théorie de Dow**, formulée à la fin du XIXᵉ siècle, qui définit une tendance haussière par des sommets et des creux de plus en plus hauts, et une tendance baissière par l'inverse.

On rattache souvent la forme moderne de l'indicateur aux travaux d'**Arthur A. Merrill** sur les *vagues filtrées* (*Filtered Waves*, 1977), qui étudiait les mouvements de marché dépassant un pourcentage minimal. Le Zig Zag est depuis devenu un outil de base des logiciels d'analyse, utilisé pour compter les vagues d'Elliott, ancrer des retracements de Fibonacci ou repérer des figures chartistes.

## Les bases

On choisit un seuil de déviation (5 % par défaut). Le calcul suit le prix et garde en mémoire l'extrême en cours : le plus haut atteint depuis le dernier creux, ou le plus bas depuis le dernier sommet. Tant que le prix n'a pas reculé d'au moins le seuil depuis cet extrême, **aucun pivot n'est validé** : l'extrême peut encore être dépassé. Dès que le recul atteint le seuil, l'extrême devient un **pivot confirmé**, et la recherche repart dans l'autre sens.

Deux choix d'implémentation à connaître :

- le calcul s'appuie sur **les clôtures, pas sur les mèches** : un pic en séance qui n'a pas tenu jusqu'à la clôture ne compte pas ;
- la dernière jambe, celle qui est encore en formation, **n'est délibérément pas tracée**. La ligne s'arrête toujours au dernier pivot confirmé, ce qui évite qu'un segment déjà dessiné se redessine quand le marché change d'avis.

Chaque pivot confirmé peut porter une étiquette qui le compare au pivot précédent de même nature :

- **HH** (*higher high*) — sommet plus haut que le précédent ;
- **LH** (*lower high*) — sommet plus bas ;
- **HL** (*higher low*) — creux plus haut ;
- **LL** (*lower low*) — creux plus bas.

Le tout premier sommet et le tout premier creux n'ont pas d'étiquette : ils n'ont rien à quoi se comparer. La longueur d'un segment donne l'ampleur d'une jambe, sa pente la vitesse du mouvement.

## Ce qu'il faut rechercher

### Une tendance saine

Une tendance haussière se lit comme une succession de **HH et de HL** : chaque sommet dépasse le précédent, chaque creux reste au-dessus du précédent. La tendance baissière en est le miroir, avec des **LH et des LL**. Tant que la séquence se poursuit, la structure de la tendance est intacte, même si certains replis paraissent brutaux bougie par bougie.

Comparer la longueur des jambes affine la lecture : des jambes de hausse qui raccourcissent pendant que les replis s'allongent trahissent une tendance qui s'essouffle avant même que la séquence ne casse.

### La rupture de structure

Dans une hausse, **le premier LH ou le premier LL** est le signal à guetter : le marché n'arrive plus à dépasser son sommet précédent, ou il casse son dernier creux. C'est souvent la première trace objective d'un retournement, et le dernier creux confirmé devient le niveau dont la cassure le valide. Le raisonnement est symétrique en baisse, avec le premier HL ou HH.

### Un marché sans direction

En range, les étiquettes alternent sans logique : un HH suivi d'un LL, puis d'un HL, puis d'un LH. Les sommets reviennent à peu près au même niveau, les creux aussi. Le Zig Zag dessine alors les bornes du range, et l'ampleur régulière de ses jambes en donne la hauteur.

[[illustration:example-zigzag-range|Range : sommets et creux reviennent aux mêmes niveaux, les étiquettes alternent sans former de séquence.]]

### La jambe qui n'est pas encore tracée

Ce qui manque compte autant que ce qui est dessiné. Quand la ligne s'arrête loin de la dernière bougie, c'est que le mouvement en cours n'a pas encore été contredit par un retour d'au moins le seuil : il peut encore s'étendre, et son extrême n'est pas connu. Un retournement franc, sans rebond suffisant, peut ainsi rester longtemps sans nouveau pivot.

[[illustration:example-zigzag-reversal|Retournement : la ligne monte jusqu'au sommet confirmé puis s'arrête ; la baisse qui suit n'est pas tracée, aucun rebond de 5 % n'ayant encore validé de creux.]]

## Résumé

Le Zig Zag ramène le graphique à sa structure : une suite de sommets et de creux validés par un seuil de déviation. Il sert à qualifier la tendance (HH et HL, ou LH et LL), à repérer la première rupture de cette séquence et à mesurer l'ampleur des mouvements. Il se combine naturellement avec les outils qui ont besoin de points d'ancrage — retracements de Fibonacci, supports et résistances, figures chartistes — et avec un indicateur de tendance (moyenne mobile, ADX) pour confirmer ce que la structure suggère.

## Ce qu'il ne dit pas

Il est rétrospectif par nature : un pivot ne se connaît qu'après un retour d'au moins le seuil, et la ligne n'atteint jamais la dernière bougie. Il ne fournit donc **aucun signal en temps réel** et ne dit rien de la jambe en cours.

Le résultat dépend entièrement du seuil : le même graphique peut montrer une tendance intacte à 5 % et une rupture à 2 %. Et calculé sur les clôtures, il ignore les mèches, qui marquent parfois les vrais extrêmes d'un mouvement.`,

  atr: `**L'ATR (Average True Range) mesure l'amplitude moyenne des mouvements du prix, gaps compris.** Il répond à une question simple : *de combien ce titre bouge-t-il, d'ordinaire, en une bougie ?*

C'est un indicateur de **volatilité**, pas de tendance : il ne dit jamais dans quel sens va le prix, seulement avec quelle ampleur il se déplace. Il sert surtout au **calibrage** — placer un stop hors du bruit habituel, dimensionner une position, juger si un mouvement sort de l'ordinaire — et il sert de brique à de nombreux autres outils, dont le Supertrend et le Chandelier Exit. Il s'affiche dans son propre panneau, en unités de prix.

## Histoire

L'ATR a été présenté par **J. Welles Wilder Jr.** en 1978, dans *New Concepts in Technical Trading Systems*, le même livre que le RSI, le Parabolic SAR et l'ADX. Wilder travaillait sur les marchés de matières premières, où les écarts d'ouverture et les séances bloquées à la limite de variation autorisée sont fréquents : une simple amplitude entre plus haut et plus bas y sous-estimait la volatilité réelle. Le *range vrai* a été conçu pour la mesurer malgré ces trous.

L'ATR est depuis devenu la mesure de volatilité de référence des praticiens. Les systèmes de suivi de tendance l'utilisent pour fixer la taille des positions et la distance des stops, à l'image de la volatilité « N » des *Turtle Traders* dans les années 1980.

## Les bases

Le calcul part du *range vrai* de chaque bougie, la plus grande de trois valeurs :

- son amplitude entre plus haut et plus bas ;
- l'écart entre son plus haut et la clôture précédente ;
- l'écart entre son plus bas et la clôture précédente.

Cette construction est ce qui permet de **comptabiliser les gaps d'ouverture**, qu'une simple amplitude haut-bas ignorerait. Les ranges vrais sont ensuite lissés sur la période (14 bougies par défaut) avec la moyenne de Wilder, une moyenne lente qui donne à chaque nouvelle bougie un poids de 1/14.

La lecture est directe : **un ATR qui monte** signale des bougies plus amples, donc un marché plus agité ; **un ATR qui baisse** signale un marché qui se calme. Le niveau absolu s'exprime en unités de prix — un ATR de 2 sur un titre à 100 veut dire que le prix parcourt en moyenne 2 unités par bougie, soit 2 %.

## Ce qu'il faut rechercher

### Un stop hors du bruit

Un stop placé à une ou deux fois l'amplitude normale d'une bougie sera touché par le simple bruit du marché. Le placer à **deux ou trois ATR** du prix d'entrée l'éloigne de ces oscillations ordinaires, et l'adapte automatiquement au titre : plus large sur un titre nerveux, plus serré sur un titre calme. C'est le principe des stops suiveurs construits sur l'ATR, comme le Supertrend ou le Chandelier Exit.

### Une taille de position à risque constant

En divisant le montant qu'on accepte de perdre par la distance du stop exprimée en ATR, on obtient une taille de position qui **risque le même montant** sur un titre volatil et sur un titre calme. On achète moins d'un titre qui bouge beaucoup, plus d'un titre qui bouge peu.

### Expansion et contraction

La volatilité alterne entre phases calmes et phases agitées. Un ATR qui se contracte longuement accompagne souvent une consolidation ; une **sortie de range accompagnée d'une expansion de l'ATR** est plus crédible qu'une sortie molle. À l'inverse, un pic brutal de l'ATR après une longue baisse accompagne fréquemment une phase de panique, parfois proche d'un point bas.

### Comparer dans le temps : l'ATR en % du prix

En unités de prix, l'ATR suit le niveau du cours : un titre qui double voit son ATR doubler sans être plus agité pour autant. Rapporté au prix, il redevient comparable dans le temps et d'un titre à l'autre.

[[illustration:example-atr-up|Tendance haussière, ATR en unités de prix : il monte avec le cours, alors que les bougies ne sont pas plus agitées en proportion.]]

[[illustration:example-atr-up-percent|La même série en % du prix : l'ATR reste à peu près plat, entre 1,5 et 2,1 %, sans dérive d'un bout à l'autre.]]

## Résumé

L'ATR mesure l'ampleur habituelle des mouvements d'un titre, gaps compris. C'est un outil de calibrage plutôt que de décision : il dit où placer un stop, quelle taille donner à une position et si un mouvement sort de l'ordinaire. Il se combine avec un outil qui donne la direction — moyenne mobile, ADX, structure des sommets et des creux — et sert de base aux stops suiveurs (Supertrend, Chandelier Exit) et à la volatilité attendue du jour.

## Ce qu'il ne dit pas

**Aucune direction.** Il monte dans une chute violente comme dans une envolée, et il baisse dans toute phase de calme, à la hausse comme à la baisse.

Sa valeur est en unités de prix : elle **n'est pas comparable d'un instrument à l'autre**, ni sur une longue période, sans être rapportée au cours. Et le lissage de Wilder est lent : un choc isolé, comme un gap de publication de résultats, gonfle l'ATR pendant de nombreuses bougies après coup.`,

  supertrend: `**Le Supertrend est un stop suiveur qui ne recule jamais : une seule ligne qui donne à la fois le sens de la tendance et le niveau où elle serait invalidée.** Sous les bougies, dans la couleur de hausse, tant que la tendance est haussière ; au-dessus, dans la couleur de baisse, dès qu'elle devient baissière.

C'est un indicateur de **suivi de tendance** fondé sur la volatilité : la distance entre la ligne et le prix est un multiple de l'ATR, donc elle s'élargit quand le marché s'agite et se resserre quand il se calme. Il sert à rester dans une tendance tant qu'elle tient, à placer un stop qui la suit, et à signaler son retournement.

## Histoire

Le Supertrend est généralement attribué au trader français **Olivier Seban**, qui l'a popularisé auprès des particuliers. Il repose sur l'*Average True Range* publié par **J. Welles Wilder Jr.** en 1978, et prolonge une idée ancienne des suiveurs de tendance : un stop placé à quelques fois la volatilité du prix, qu'on ne remonte que dans le sens de la position. Sa lisibilité — une ligne, deux couleurs — en a fait l'un des indicateurs les plus répandus des plateformes de trading.

## Les bases

Pour chaque bougie, on part de son prix médian (le milieu entre plus haut et plus bas) et l'on construit deux bandes, l'une au-dessus et l'autre en dessous, à une distance égale au **multiplicateur × ATR** (3 × l'ATR sur 10 bougies par défaut).

Sa particularité est une règle de mémoire : tant que la tendance garde le même sens, **la bande active ne peut que se rapprocher du prix**. En tendance haussière, la bande basse monte ou reste à plat, jamais elle ne redescend ; elle se resserre comme un cliquet. Il faut une **clôture de l'autre côté** de la bande pour que la tendance bascule : la ligne saute alors de l'autre côté du prix et change de couleur.

Seule la bande active est tracée. La lecture est donc immédiate : **la position de la ligne donne le régime**, son basculement est le signal de retournement, et la distance entre le prix et la ligne mesure la marge qui reste avant ce basculement.

## Ce qu'il faut rechercher

### Le régime de tendance

Une ligne qui reste sous les cours, dans la couleur de hausse, et qui monte en escalier décrit une tendance haussière installée. Les replis viennent s'approcher de la ligne sans clôturer en dessous : tant que c'est le cas, la tendance est intacte, quelle que soit l'ampleur apparente des replis.

[[illustration:example-supertrend-up|Tendance haussière : la ligne reste sous les cours d'un bout à l'autre et monte en escalier, sans aucun basculement.]]

### Le basculement

Quand une clôture franchit la ligne, celle-ci passe de l'autre côté et change de couleur : c'est le **signal de retournement**. Il arrive toujours après le sommet ou le creux, puisqu'il faut que le prix ait déjà parcouru plusieurs ATR à contre-sens. Le Supertrend ne cherche pas à acheter au plus bas ni à vendre au plus haut, mais à capter le corps du mouvement.

[[illustration:example-supertrend-reversal|Retournement : la ligne suit la hausse sous les cours, puis bascule au-dessus peu après le sommet et accompagne la baisse.]]

### Un stop qui suit la tendance

Comme la ligne ne recule jamais, elle fait un excellent **niveau d'invalidation** : on la garde comme stop, remonté bougie après bougie, tant que la tendance tient. Une ligne qui reste plate signale un marché qui hésite ; une ligne qui monte vite, une tendance qui accélère.

### Les allers-retours en range

Sans tendance, le prix traverse la ligne à chaque oscillation et le Supertrend **bascule à répétition**, chaque signal arrivant près de l'extrême opposé. Une succession de basculements rapprochés est en soi une information : le marché n'a pas de direction, et les signaux de l'indicateur ne sont alors plus fiables.

[[illustration:example-supertrend-range|Range : la ligne change de côté à chaque oscillation, une suite de faux signaux.]]

## Résumé

Le Supertrend résume la tendance en une ligne : sa position donne le sens, son basculement le retournement, son niveau le stop. Très efficace dans une tendance franche, il perd pied dans un marché sans direction. Il gagne à être filtré par un outil qui mesure l'existence d'une tendance — ADX, Choppiness Index — et complété par une lecture de structure (sommets et creux) ou de volume pour juger de la qualité d'un basculement.

## Ce qu'il ne dit pas

La faiblesse de tous les suiveurs : **en marché latéral, il bascule à répétition** et enchaîne les faux signaux. Ses basculements sont tardifs par construction, et un gap peut faire sauter le prix bien au-delà de la ligne, si bien que la sortie réelle se fait plus loin que le niveau affiché. Il ne mesure pas non plus la force de la tendance : une ligne sous les cours ne dit rien de la vigueur de la hausse.`,

  parabolicSar: `**Le Parabolic SAR est un stop suiveur qui se rapproche du prix de plus en plus vite à mesure que la tendance dure.** Il se présente comme une série de points : sous les bougies tant que la tendance est haussière, au-dessus dès qu'elle devient baissière.

SAR signifie *Stop And Reverse*, « stop et retournement » : chaque point est le niveau de sortie de la position en cours, et quand le prix l'atteint, l'indicateur sort et se retourne dans l'autre sens du même geste. C'est avant tout un outil de **sortie et de gestion du stop**, bien plus que d'entrée, conçu pour les marchés en tendance.

## Histoire

Le Parabolic SAR a été présenté par **J. Welles Wilder Jr.** en 1978, dans *New Concepts in Technical Trading Systems*, le livre qui a aussi introduit le RSI, l'ATR et l'ADX. Wilder y cherchait un stop qui tienne compte non seulement du prix mais aussi du **temps** : plus une position est ancienne et plus la tendance a progressé, plus le stop doit se rapprocher. Les réglages qu'il proposait — un pas de 0,02 et un plafond de 0,20 — sont restés les valeurs de référence.

## Les bases

À chaque bougie, le point avance d'une fraction de la distance qui le sépare de l'**extrême de la tendance** (le plus haut atteint en hausse, le plus bas en baisse). Cette fraction, le **facteur d'accélération**, part du pas (0,02) et augmente d'un pas chaque fois qu'un nouvel extrême est atteint, jusqu'au plafond (0,2).

C'est ce qui donne à la série sa forme parabolique : au début d'une tendance, les points avancent lentement et laissent de la marge ; *plus la tendance dure et inscrit de nouveaux records, plus le stop se resserre vite*. Le point ne peut toutefois jamais entrer dans la plage des deux bougies précédentes.

Quand le prix touche les points, la série **bascule de l'autre côté** : le nouveau point repart de l'extrême de la tendance précédente et le facteur d'accélération revient au pas. Les points sous la clôture prennent la couleur de hausse, ceux au-dessus la couleur de baisse.

## Ce qu'il faut rechercher

### Une tendance qui accélère

En tendance haussière, les points montent sous les bougies et s'en rapprochent de plus en plus vite. Tant que le prix ne les touche pas, la tendance est en place et le dernier point sert de stop. Un écart qui se réduit rapidement entre les points et le prix signale que la tendance a vieilli : le moindre repli suffira à déclencher la sortie.

### Le retournement

Le basculement des points de l'autre côté du prix est le signal du SAR. Après une tendance longue, il arrive peu après l'extrême, car le stop s'est beaucoup resserré ; il marque alors souvent la fin du mouvement et l'entrée dans une phase de correction ou de retournement.

[[illustration:example-parabolicSar-reversal|Retournement : les points accompagnent la hausse sous les bougies, à deux brèves inversions près, puis passent au-dessus peu après le sommet et y restent pendant toute la baisse.]]

### Les retournements à répétition

Sans tendance, chaque oscillation suffit à toucher les points, et le SAR se retourne sans cesse, souvent près de l'extrême opposé de l'oscillation. C'est le cas où il est franchement **contre-productif** : une suite de basculements rapprochés est avant tout un signe que le marché n'a pas de direction.

[[illustration:example-parabolicSar-range|Range : les points changent de côté à chaque oscillation, chaque signal arrivant près de l'extrême opposé.]]

### Un filtre de tendance

Parce qu'il est toujours « en position », le SAR gagne à être combiné avec un outil qui dit s'il existe une tendance : ne retenir ses signaux que dans le sens d'une moyenne mobile longue, ou seulement quand l'ADX indique une tendance marquée. Il sert alors de stop suiveur, et non de générateur de signaux.

## Résumé

Le Parabolic SAR est un stop suiveur qui accélère avec la tendance : il laisse de la marge au début d'un mouvement et se resserre à mesure que celui-ci s'étend, puis se retourne quand le prix le touche. Il excelle dans les tendances franches et perd pied dans les marchés sans direction. On le complète avec un filtre de tendance (ADX, moyenne mobile longue) et, pour les entrées, avec d'autres outils ; un Supertrend ou un Chandelier Exit offrent une alternative plus lente, fondée sur la volatilité.

## Ce qu'il ne dit pas

Il a été conçu pour des marchés en tendance et devient franchement **contre-productif en range**, où il se retourne à chaque oscillation. Il est toujours dans le marché, à l'achat ou à la vente, et ne sait pas dire « pas de tendance ». Son resserrement dépend du temps et des records, pas de la volatilité : dans une tendance lente mais régulière, il peut sortir sur un repli tout à fait ordinaire.`,

  gaps: `**Un gap est un vide de prix entre deux bougies consécutives : une zone où aucun échange n'a eu lieu.** Ici, deux bougies forment un gap quand elles ne se chevauchent à aucun niveau de prix. La détection ne compare pas une clôture à l'ouverture suivante, mais les plages complètes des deux bougies :

- **gap haussier** — le plus bas d'une bougie reste au-dessus du plus haut de la précédente ;
- **gap baissier** — son plus haut reste sous le plus bas de la précédente.

L'indicateur trace chaque gap sur le graphique et suit ce qu'il devient : comblé par un retour du prix, ou toujours ouvert. Un gap trahit un **déséquilibre brutal entre acheteurs et vendeurs**, le plus souvent provoqué par une nouvelle tombée hors séance, et la zone laissée vide reste ensuite un repère que le marché a tendance à revisiter.

## Histoire

Les gaps font partie des figures de l'analyse chartiste classique depuis ses débuts. **Robert D. Edwards et John Magee**, dans *Technical Analysis of Stock Trends* (1948), en ont fixé la classification encore utilisée aujourd'hui : gap commun, gap de rupture, gap de continuation (ou de mesure) et gap d'épuisement, chacun lu selon l'endroit de la tendance où il apparaît.

La tradition japonaise des chandeliers les connaît aussi, sous le nom de **fenêtres** : une fenêtre ouverte dans le sens de la tendance la confirme, et sa zone sert ensuite de support ou de résistance. Cette terminologie a été popularisée en Occident par **Steve Nison** au début des années 1990.

## Les bases

Un seuil minimal en pourcentage (0,1 % par défaut) filtre les écarts insignifiants, pour qu'une série intraday bruitée ne signale pas un gap à chaque fraction de centime.

Chaque gap est matérialisé par un **rectangle couvrant la zone de prix laissée vide**, dans la couleur de hausse pour un gap haussier et de baisse pour un gap baissier. L'indicateur balaie ensuite les bougies suivantes à la recherche de la première dont l'amplitude revient dans cette zone, ne serait-ce qu'en partie : c'est là que le rectangle s'arrête et que le gap est marqué comme **comblé**, en couleur plus pâle. Sinon il court jusqu'au bord des données.

Cette distinction est tout l'intérêt de l'outil. **Un gap non comblé reste une zone de déséquilibre**, souvent surveillée comme aimant, ou comme support et résistance potentiels lors d'un retour du prix.

## Ce qu'il faut rechercher

### Le gap de rupture

Il apparaît à la **sortie d'une zone de consolidation** ou à la cassure d'un niveau important : le prix quitte son range en laissant un vide derrière lui. Accompagné d'un volume nettement supérieur à la moyenne, c'est le signe d'un changement d'opinion du marché, et il n'est souvent pas comblé avant longtemps. Un gap de rupture qui reste ouvert confirme la cassure.

### Le gap de continuation

En pleine tendance, après un premier mouvement déjà engagé, un nouveau gap dans le même sens témoigne d'une tendance qui accélère. Les chartistes l'appellent aussi *gap de mesure*, parce qu'il se situe souvent vers le milieu du mouvement : la distance parcourue avant lui donne un ordre de grandeur de ce qui peut rester à parcourir.

### Le gap d'épuisement

Il survient **à la fin d'un mouvement long et rapide**, souvent sur un volume record : un dernier élan, après lequel le prix cale et revient rapidement combler le vide. Un gap comblé dans les quelques bougies qui suivent est le signe distinctif de l'épuisement. Quand un gap d'épuisement est suivi d'un gap en sens inverse, la petite zone isolée entre les deux forme une *île de retournement*.

### Le gap ouvert comme repère

Un gap resté ouvert balise une zone que le prix n'a jamais traitée. Lors d'un retour, sa borne la plus proche agit souvent comme **support** (gap haussier) ou **résistance** (gap baissier) ; à l'inverse, beaucoup de praticiens s'attendent à ce que le prix revienne tôt ou tard le combler. Les gaps communs, petits et sans contexte particulier, sont en général comblés rapidement et n'ont pas cette valeur de repère.

## Résumé

Les gaps signalent les déséquilibres brutaux du marché, et l'indicateur suit leur sort : comblés ou toujours ouverts. Leur sens dépend entièrement du contexte — sortie de range, milieu de tendance, fin de mouvement — et se confirme souvent après coup, selon qu'ils sont comblés vite ou non. On les lit avec le volume, la structure de la tendance (Zig Zag, supports et résistances) et les figures de chandeliers qui les entourent.

## Ce qu'il ne dit pas

Sur des bougies quotidiennes, l'essentiel des gaps correspond simplement à l'écart entre deux séances : leur nombre n'indique rien en soi. Le type d'un gap (rupture, continuation, épuisement) ne se connaît souvent qu'avec la suite, et l'indicateur ne le classe pas. Enfin, un gap est déclaré comblé dès qu'une bougie revient dans la zone, même partiellement : un comblement complet peut demander davantage.`,

  patternRecognition: `**Cet indicateur repère automatiquement les figures chartistes classiques qui se forment sur les dernières bougies** : doubles sommets et doubles creux, épaule-tête-épaule, triangles, drapeaux, tasse avec anse, diamant, vague de Wolfe, ainsi que les supports et résistances de court terme.

Il travaille sur une fenêtre récente — au maximum 20 bougies se terminant à la date limite choisie dans les paramètres, par défaut la dernière disponible, qui avance donc toute seule. Il ne dresse pas l'inventaire de tout l'historique : il dit **ce qui est en train de se dessiner maintenant**. Chaque figure trouvée est tracée sur le graphique, avec son nom, dans la couleur de son biais.

## Histoire

L'analyse chartiste est née avec l'observation des cours de bourse à la fin du XIXᵉ siècle, dans le sillage de **Charles Dow**. Dans les années 1930, **Richard W. Schabacker** en a fait le premier catalogue systématique (*Technical Analysis and Stock Market Profits*, 1932) ; son beau-frère **Robert D. Edwards**, avec **John Magee**, l'a prolongé dans *Technical Analysis of Stock Trends* (1948), qui reste la référence des figures de retournement et de continuation : têtes et épaules, doubles sommets, triangles, drapeaux, diamants.

D'autres figures sont venues plus tard : la **tasse avec anse** a été décrite par **William O'Neil** dans *How to Make Money in Stocks* (1988), et la **vague de Wolfe** porte le nom de son auteur, **Bill Wolfe**.

## Les bases

L'indicateur identifie d'abord les **points pivots** de la fenêtre : une bougie dont le plus haut dépasse strictement celui de ses deux voisines immédiates est un sommet, une bougie dont le plus bas est strictement inférieur à celui de ses voisines est un creux. Il teste ensuite chaque famille de figure sur ces pivots, avec des critères chiffrés :

- **Double sommet** (ou **double creux**) — les deux derniers sommets à moins de 1,5 % l'un de l'autre, séparés par un creux d'au moins 2 %.
- **Épaule-tête-épaule** (ou **inversée**) — sur les trois derniers sommets, une tête dépassant les deux épaules d'au moins 1 %, avec des épaules alignées à 3 % près.
- **Triangles** — les pentes de la ligne des sommets et de celle des creux sont comparées : plafond plat et creux montants pour l'ascendant, sommets descendants et plancher plat pour le descendant, deux lignes qui convergent pour le symétrique.
- **Drapeau** — un mouvement directionnel valant au moins trois fois l'amplitude moyenne des bougies (le mât), puis une consolidation deux fois plus étroite que ce mouvement.
- **Tasse avec anse** — un rebord revenant à moins de 5 % du point de départ, suivi d'un repli qui reprend au plus la moitié de la profondeur de la tasse.
- **Diamant** — des oscillations qui s'élargissent, puis se resserrent.
- **Vague de Wolfe** — cinq pivots alternés, chaque extrême dépassant le précédent de même nature.
- **Supports et résistances** — les pivots proches en prix, regroupés en un niveau.

Chaque figure est tracée comme une ligne brisée passant par ses points, avec son nom au dernier point ; le drapeau est en pointillés, les supports et résistances en lignes horizontales pointillées qui courent jusqu'au bord droit. Les figures haussières prennent la couleur de hausse, les baissières celle de baisse, les neutres (triangle symétrique, diamant) la couleur de l'indicateur. Si deux figures se terminent sur la même bougie, seule la première dans l'ordre de la liste est affichée.

## Ce qu'il faut rechercher

### Les figures de retournement

Le double sommet, l'épaule-tête-épaule et leurs versions inversées annoncent la fin possible d'une tendance. Elles n'ont de sens qu'**après une tendance à retourner** : un double sommet au milieu d'un range n'est qu'une oscillation de plus. La figure n'est classiquement validée que par la cassure de sa *ligne de cou* — le creux entre les deux sommets, ou la ligne qui relie les creux de part et d'autre de la tête — ce que l'indicateur ne vérifie pas : c'est à vous de la guetter.

### Les figures de continuation

Les triangles et les drapeaux décrivent une pause dans une tendance. Le drapeau suit un mouvement rapide et se résout le plus souvent dans le sens de ce mouvement. Le triangle ascendant porte un biais haussier, le descendant un biais baissier ; le symétrique est neutre et se lit dans le sens de la tendance qui le précède. Le signal, là encore, est la sortie de la figure, de préférence sur un volume en hausse.

### Le contexte : tendance, niveaux et volume

Une figure pèse d'autant plus qu'elle s'appuie sur un niveau déjà connu (un support ou une résistance de plus long terme, un gap ouvert) et que le volume la confirme : volume qui décroît pendant la formation, puis qui gonfle à la cassure. Les supports et résistances que l'indicateur trace lui-même aident à situer la figure dans son environnement immédiat.

### Revenir dans le passé avec la date limite

En fixant une date limite passée, on voit ce que l'indicateur détectait ce jour-là, sans les bougies suivantes. C'est le bon moyen de juger, sur un titre donné, ce que ces figures ont réellement annoncé, plutôt que de se fier à leur réputation.

## Résumé

Cet indicateur balaie les 20 dernières bougies à la recherche des grandes figures de l'analyse chartiste et les dessine avec leur biais. Il fait gagner du temps et attire l'œil sur une structure en formation, mais une figure n'est qu'une hypothèse tant qu'elle n'est pas validée par une cassure. On le lit avec la tendance de fond (moyennes mobiles, ADX), le volume, les supports et résistances de plus long terme et les figures de chandeliers qui marquent les points de retournement.

## Ce qu'il ne dit pas

Chaque famille est testée indépendamment, donc **plusieurs figures peuvent coexister** sur la même fenêtre — y compris des figures qui se contredisent. Et une figure reconnue est une **ressemblance géométrique**, pas une prévision : les critères ci-dessus décrivent une forme, jamais ce qui va suivre.

La fenêtre de 20 bougies ne laisse voir que des figures de court terme ; une épaule-tête-épaule qui s'étend sur six mois lui échappe. Le diamant et la vague de Wolfe n'ont pas de définition rigoureuse et ne sont qu'approchés. Enfin, comme la fenêtre avance avec les données, une figure affichée aujourd'hui peut disparaître demain.`,

  candleRecognition: `**Cet indicateur identifie la figure de chandelier japonais formée par la bougie du moment.** Il répond à une seule question : *que raconte la dernière bougie, lue avec celles qui la précèdent ?*

Il ne parcourt pas l'historique : il examine la bougie de la date limite choisie, par défaut la dernière disponible, et nomme la figure qu'elle achève — étoile du matin ou du soir, *three inside*, avalante, marteau, pendu, marteau inversé, étoile filante ou doji. L'étiquette se pose sous la bougie pour une figure haussière, au-dessus pour une figure baissière. Ces figures servent à repérer les **hésitations et les retournements de court terme**, là où l'équilibre entre acheteurs et vendeurs bascule.

## Histoire

Les chandeliers japonais viennent des marchés à terme du riz du Japon, au XVIIIᵉ siècle, en particulier de la bourse de Dojima, à Osaka. La tradition en attribue les principes au négociant **Munehisa Homma**, qui aurait étudié la psychologie des marchés à partir des prix de chaque séance ; les noms imagés des figures — marteau, étoile du soir, doji — viennent de cette tradition.

La méthode est restée propre au Japon jusqu'à ce que **Steve Nison** la fasse connaître en Occident avec *Japanese Candlestick Charting Techniques* (1991). La représentation en chandeliers est depuis devenue la norme des graphiques boursiers.

## Les bases

Une bougie se décompose en un **corps** (de l'ouverture à la clôture) et deux **mèches** (jusqu'au plus haut et au plus bas). Un grand corps traduit une séance décidée, un petit corps une séance indécise ; une longue mèche montre un prix rejeté, poussé loin puis ramené.

Les figures reconnues, et ce qui les distingue :

- **Étoile du matin ou du soir** — une première bougie franche (corps de plus de la moitié de son amplitude), une deuxième au corps minuscule, une troisième de couleur opposée à la première qui clôture au-delà du milieu de son corps.
- **Three inside up / down** — le corps de la deuxième tient entièrement dans celui de la première, puis une troisième, de couleur opposée à la première, clôture au-delà de son ouverture.
- **Avalante** — un corps plus grand, de couleur opposée, qui englobe entièrement celui de la bougie précédente.
- **Marteau, pendu, marteau inversé, étoile filante** — un petit corps collé à une extrémité de la bougie et une longue mèche de l'autre côté, au moins deux fois plus longue que le corps. Le marteau et le pendu ont *exactement la même silhouette* (longue mèche basse), tout comme le marteau inversé et l'étoile filante (longue mèche haute) : seule **la tendance des cinq bougies précédentes** les distingue. La même forme est haussière après une baisse et baissière après une hausse ; sans tendance, elle n'est pas signalée.
- **Doji** — un corps quasi inexistant (au plus 10 % de l'amplitude), signe d'indécision.

Les figures sont testées de la plus spécifique à la plus générale — étoiles, *three inside*, avalantes, marteaux, doji — et **une seule est retenue par date**. Une figure de plusieurs bougies est soulignée par un trait pointillé qui les relie. Couleur de hausse pour une figure haussière, de baisse pour une baissière, neutre pour le doji.

## Ce qu'il faut rechercher

### Les retournements en trois bougies

L'**étoile du matin** raconte un retournement en trois temps : une forte baisse, une séance d'hésitation au corps minuscule, puis une forte hausse qui efface une bonne partie de la baisse. L'**étoile du soir** est son miroir au sommet. Le *three inside* suit le même schéma avec une bougie centrale contenue dans la première : l'hésitation, puis la confirmation. Ce sont les figures les plus abouties de la liste, parce que la troisième bougie apporte déjà la confirmation.

### L'avalante

Une bougie dont le corps englobe entièrement celui de la précédente, en sens inverse, montre un camp qui reprend la main en une séance. Elle pèse d'autant plus qu'elle survient **après un mouvement net**, sur un niveau de support ou de résistance, et que son corps est grand par rapport aux bougies récentes.

### Une silhouette, deux sens : marteau et pendu

Le marteau, au terme d'une baisse, montre des vendeurs qui ont poussé le prix très bas avant d'être repoussés : la longue mèche basse est un rejet. Le pendu, même bougie au terme d'une hausse, montre au contraire qu'une pression vendeuse est apparue dans la séance. Le marteau inversé et l'étoile filante forment la même paire avec une longue mèche haute. Dans les deux cas, on attend généralement **la bougie suivante** pour confirmer : une clôture au-delà du corps dans le sens annoncé.

### Le doji, l'indécision

Un doji isolé dans un range ne dit presque rien. Après une longue tendance, en revanche, il marque un équilibre soudain entre acheteurs et vendeurs, parfois le premier signe d'essoufflement. Il se lit toujours avec la bougie qui suit.

## Résumé

Cet indicateur nomme la figure de chandelier formée par la bougie du moment, en tenant compte de la tendance qui la précède. Il aide à repérer les hésitations et les retournements de court terme, mais une figure ne vaut que par son contexte : la tendance qu'elle interrompt, le niveau où elle apparaît, le volume qui l'accompagne et la bougie qui la confirme. On le combine avec les supports et résistances, les figures chartistes, les gaps et un indicateur de momentum comme le RSI.

## Ce qu'il ne dit pas

Une figure de chandelier est un **contexte**, pas un signal. Le marteau et le pendu le montrent bien : la même bougie, lue dans deux tendances, dit deux choses opposées.

L'indicateur n'examine qu'une bougie, et la tendance qui sert de contexte ne couvre que les cinq bougies précédentes. Il ignore les niveaux de prix, le volume et la confirmation par la bougie suivante. Prises isolément, les figures de chandeliers ont un pouvoir prédictif modeste et discuté.`,

  ichimoku: `**L'Ichimoku Kinko Hyo — « équilibre en un coup d'œil » — est un système complet d'analyse de tendance qui superpose cinq composantes au graphique des prix.** Toutes sont construites sur des *milieux d'amplitude* (la moyenne entre le plus haut et le plus bas d'une période), et non sur des moyennes de clôtures.

D'un seul regard, il donne le sens de la tendance, sa dynamique, les niveaux de support et de résistance et la confirmation par l'historique. Sa pièce maîtresse est le **nuage** (*kumo*), une bande colorée qui sépare le régime haussier du régime baissier et sert de zone de support ou de résistance.

## Histoire

L'Ichimoku a été mis au point par le journaliste japonais **Goichi Hosoda**, qui signait sous le pseudonyme *Ichimoku Sanjin*. Il y a travaillé à partir de la fin des années 1930, avant de publier sa méthode à la fin des années 1960.

Les réglages d'origine — 9, 26 et 52 — reflètent le calendrier boursier japonais de l'époque, qui comptait six séances par semaine : une semaine et demie, un mois et deux mois de séances. Longtemps cantonné au Japon, l'indicateur s'est répandu dans le reste du monde avec les logiciels d'analyse ; certains praticiens adaptent ces valeurs à la semaine de cinq jours, sans qu'aucun jeu de réglages ait remplacé l'original.

## Les bases

Cinq composantes, avec les réglages par défaut :

- **Tenkan** (ligne de conversion), milieu d'amplitude des 9 dernières bougies : l'équilibre de court terme ;
- **Kijun** (ligne de base), milieu d'amplitude des 26 dernières bougies : l'équilibre de moyen terme ;
- **Senkou A**, moyenne de la Tenkan et de la Kijun, décalée de 26 bougies vers l'avant ;
- **Senkou B**, milieu d'amplitude des 52 dernières bougies, décalé lui aussi de 26 bougies vers l'avant ;
- **Chikou** (ligne retardée), la clôture reportée 26 bougies en arrière.

La zone entre les deux Senkou forme le **nuage**. Il prend la couleur de hausse quand Senkou A est au-dessus de Senkou B, la couleur de baisse dans le cas contraire. Les lignes ont des couleurs fixes : Tenkan orange, Kijun bleue, Senkou A dans la couleur de hausse, Senkou B dans celle de baisse, Chikou grise en tirets.

Parce qu'elles reposent sur des milieux d'amplitude, la Tenkan et la Kijun **restent plates** tant que le plus haut et le plus bas de leur période ne changent pas : une Kijun horizontale marque un niveau d'équilibre, vers lequel le prix revient souvent. Avec les réglages par défaut, il faut 78 bougies d'historique (52 + 26) avant que le nuage n'apparaisse.

## Ce qu'il faut rechercher

### Le prix face au nuage

C'est la lecture de base : **le prix au-dessus du nuage** indique un régime haussier, en dessous un régime baissier, à l'intérieur une absence de tendance. Un nuage dans la couleur de hausse, sous un prix qui le surplombe nettement, décrit une tendance haussière installée ; le nuage sert alors de zone de support lors des replis.

[[illustration:example-ichimoku-up|Tendance haussière : dès qu'il apparaît, le nuage est dans la couleur de hausse et le prix reste au-dessus ; la Tenkan se tient presque toujours au-dessus de la Kijun.]]

### Le croisement Tenkan / Kijun

Quand la Tenkan passe au-dessus de la Kijun, la dynamique de court terme devient haussière ; en dessous, baissière. Le signal pèse d'autant plus qu'il va **dans le sens du nuage** : un croisement haussier au-dessus du nuage est fort, le même croisement sous le nuage est faible. Dans un retournement, ce croisement arrive en premier, puis le prix traverse le nuage, puis le nuage lui-même change de couleur, bien plus tard.

[[illustration:example-ichimoku-reversal|Retournement : après le sommet, la Tenkan croise la Kijun à la baisse, le prix traverse le nuage puis passe dessous ; le nuage ne change de couleur que bien après.]]

### Le nuage comme support et résistance

**L'épaisseur du nuage** indique la résistance qu'il opposera : un nuage épais se traverse difficilement, un nuage fin se franchit facilement. Une Senkou B plate, qui tient le même niveau pendant longtemps, forme un support ou une résistance particulièrement solide. Enfin, **la ligne retardée** vérifie que le prix actuel domine bien celui d'il y a 26 bougies : une Chikou au-dessus des prix passés confirme une tendance haussière.

### Un marché sans tendance

Quand le prix entre et sort du nuage sans cesse, que le nuage est fin et change souvent de couleur et que la Tenkan et la Kijun se croisent à répétition, l'Ichimoku dit clairement qu'il n'y a pas de tendance. Ses signaux sont alors à ignorer : c'est un outil de tendance.

[[illustration:example-ichimoku-range|Range : le prix traverse le nuage dans les deux sens, le nuage change de couleur à chaque oscillation, Tenkan et Kijun se croisent à répétition.]]

## Résumé

L'Ichimoku réunit en un seul tracé la tendance (le prix face au nuage), la dynamique (la Tenkan face à la Kijun), les supports et résistances (le nuage et les lignes plates) et la confirmation (la Chikou). Sa force est de croiser ces plans : un signal est solide quand ils vont tous dans le même sens. Il se complète d'un outil qui mesure la force de la tendance (ADX) et d'un oscillateur (RSI) pour juger des excès à l'intérieur d'une tendance.

## Ce qu'il ne dit pas

C'est un système complet, donc **lent**. Ses signaux arrivent confirmés et tardifs, ce qui est le compromis assumé de l'outil, et il est sans valeur dans un marché sans direction.

Ici, le nuage n'est pas dessiné au-delà de la dernière bougie : la partie « future » du nuage, que beaucoup de plateformes projettent 26 bougies en avant, n'est pas tracée. Et ses réglages d'origine, pensés pour des semaines de six séances, ne sont qu'une convention sur les marchés d'aujourd'hui.`,

  pivotPoints: `**Les points pivots sont une grille de niveaux horizontaux calculée à l'avance pour toute une période**, à partir du plus haut, du plus bas et de la clôture de la période précédente. Chaque période en compte sept : le **pivot central** (PP), trois **résistances** au-dessus (R1, R2, R3) et trois **supports** en dessous (S1, S2, S3).

La grille reste fixe jusqu'à la fin de la période — jour, semaine ou mois —, puis une nouvelle est calculée : d'où l'aspect en escalier. Ces niveaux servent de **repères objectifs, connus de tous dès l'ouverture** : situer le prix dans sa période, fixer un objectif ou un stop, juger la force d'un mouvement d'après les niveaux qu'il franchit.

## Histoire

Les points pivots viennent des **parquets des bourses de Chicago**, bien avant l'informatique. Chaque matin, les opérateurs du parquet (les *floor traders*) calculaient à la main, à partir du plus haut, du plus bas et de la clôture de la veille, un prix d'équilibre et quelques niveaux de part et d'autre : de quoi se repérer toute la séance sans graphique, avec un crayon et un bout de papier. D'où leur nom anglais de *floor pivots*.

La formule d'origine — le pivot comme moyenne du plus haut, du plus bas et de la clôture — a ensuite donné des variantes. La formule **Camarilla** est généralement attribuée au trader Nick Scott, à la fin des années 1980 ; la formule **Woodie** porte le surnom de son auteur, le trader américain Ken Wood ; la formule **Fibonacci** espace les niveaux selon les ratios tirés de la suite du même nom. Les plateformes de trading en ont fait l'un des outils intraday les plus répandus.

## Les bases

Tout part de trois prix de la période précédente : son plus haut, son plus bas et sa dernière clôture. Leur moyenne donne le **pivot central**, le prix d'équilibre de la veille (ou de la semaine, ou du mois). Les résistances et les supports s'en déduisent en ajoutant ou en retranchant tout ou partie de l'**amplitude** de cette période, l'écart entre son plus haut et son plus bas : plus la période précédente a été agitée, plus la grille est large.

Quatre formules sont proposées :

- **Classic** — le pivot est la moyenne haut-bas-clôture ; R1 et S1 sont le reflet du plus bas et du plus haut de part et d'autre du pivot, R2 et S2 à une amplitude du pivot, R3 et S3 plus loin encore ;
- **Fibonacci** — même pivot, mais les niveaux sont espacés de 38,2 %, 61,8 % et 100 % de l'amplitude ;
- **Woodie** — la clôture compte double dans le pivot, ce qui **rapproche la grille du dernier prix** ;
- **Camarilla** — les niveaux ne partent pas du pivot mais de la clôture, par fractions étroites de l'amplitude : une grille **beaucoup plus resserrée**, pensée pour le très court terme.

Sur le graphique, chaque niveau est un trait pointillé qui couvre sa période, avec son nom (PP, R1, S1…) à gauche. Le pivot central prend la couleur de l'indicateur, les supports et les résistances une teinte neutre. La première période de l'historique n'a pas de période précédente : rien n'y est tracé.

## Ce qu'il faut rechercher

### Le prix face au pivot central

Le pivot central partage la période en deux camps. Un prix qui s'installe au-dessus traduit un **biais acheteur** ; en dessous, un **biais vendeur**. Un marché qui le traverse sans cesse dans un sens puis dans l'autre n'a pas de direction : la grille y sert de bornes plutôt que de cibles.

[[illustration:example-pivotPoints-uptrend|Tendance haussière : le prix se tient au-dessus du pivot central semaine après semaine et dépasse souvent R1.]]

### Des objectifs et des stops tout faits

Dans un biais acheteur, R1 puis R2 sont les objectifs naturels, et un retour sous le pivot invalide le scénario ; dans un biais vendeur, c'est l'inverse avec S1 et S2. Comme ces niveaux sont connus de tous à l'avance, les ordres s'y accumulent : le prix y ralentit souvent, ou y rebondit.

[[illustration:example-pivotPoints-downtrend|Tendance baissière : sous le pivot central, le prix atteint régulièrement S1, l'objectif naturel d'un biais vendeur.]]

### Cassure ou rejet d'un niveau

Un niveau franchi nettement et tenu change de rôle : une résistance cassée sert ensuite de support, et inversement. À l'opposé, un prix qui perce un niveau en cours de bougie mais clôture de l'autre côté signe un **rejet**, souvent suivi d'un retour vers le pivot. Atteindre R3 ou S3 signale un mouvement exceptionnel au regard de la période précédente.

### La bonne période de référence

La période de référence doit correspondre à l'horizon de travail : une grille journalière pour l'intraday, hebdomadaire pour des positions de quelques jours, mensuelle pour des positions de plusieurs semaines. Sur des bougies quotidiennes, une grille journalière change à chaque bougie et n'apporte presque rien ; la grille hebdomadaire, réglage par défaut, y est bien plus lisible.

## Résumé

Les points pivots transforment la période précédente en une grille de repères connus de tous : un pivot central qui sépare les camps acheteur et vendeur, des résistances et des supports qui servent d'objectifs, de stops et de seuils de cassure. Ils valent surtout par le consensus qu'ils créent, d'où l'intérêt de choisir la formule et la période que regardent les intervenants de votre marché. Ils se complètent bien des niveaux tirés de l'historique (supports et résistances automatiques, profil TPO) et d'un indicateur de tendance, qui dit s'il faut viser les niveaux suivants ou s'attendre à des rebonds.

## Ce qu'il ne dit pas

Leur seule autorité vient du fait que beaucoup de monde les regarde : c'est une prophétie en partie autoréalisatrice, **pas une propriété du marché**. Ils ignorent tout ce qui s'est passé avant la période précédente, et un gap d'ouverture peut rendre une grille caduque dès la première bougie.

Les périodes sont découpées en heure UTC (la semaine commence le lundi, le mois le 1er) : pour une place qui ne vit pas à l'heure UTC, une période peut ne pas coïncider exactement avec les séances.`,

  supportResistance: `**Cet indicateur trace automatiquement les niveaux de prix qui ont le plus souvent arrêté le marché** : les **supports**, où les baisses se sont arrêtées, et les **résistances**, où les hausses ont calé.

Il fait le travail de l'œil qui cherche, sur un graphique, les prix où les sommets et les creux se répètent. Chaque niveau est tracé en pointillés depuis son premier contact jusqu'au bord droit du graphique, avec son prix et son **nombre de touches** (« ×3 » : trois sommets ou creux sur ce niveau). Il sert à repérer les zones où le prix risque de ralentir, de rebondir ou de casser, et à y placer objectifs et stops.

## Histoire

Les notions de support et de résistance sont au cœur de l'analyse technique depuis ses débuts. Elles ont été codifiées en 1948 par **Robert Edwards et John Magee** dans *Technical Analysis of Stock Trends*, qui décrivent notamment l'**inversion des rôles** : un support cassé devient une résistance, et une résistance franchie devient un support.

La détection automatique repose sur une idée plus récente, les **extrêmes locaux** : une bougie dont le plus haut (ou le plus bas) dépasse celui de ses voisines. Les *fractales* popularisées par Bill Williams dans les années 1990 en sont la forme la plus connue. La combinaison utilisée ici — extrêmes locaux sur trois bougies de chaque côté, regroupement par proximité, classement par nombre de touches — est **propre à ce graphique**.

## Les bases

Le calcul porte sur les N dernières bougies de l'historique (100 par défaut) et se fait en trois temps :

- il repère les **extrêmes locaux** : une bougie dont le plus haut dépasse strictement celui des trois bougies de chaque côté (un sommet), ou dont le plus bas est strictement sous le leur (un creux) ;
- il **regroupe** ces extrêmes par proximité : deux points séparés de moins de 1 % de l'amplitude de la fenêtre forment un même niveau. Sans ce regroupement, on obtiendrait un niveau par sommet ;
- chaque groupe donne un niveau, au **prix moyen** de ses membres, avec son nombre de touches. Un groupe d'un seul point est écarté — *un extrême isolé n'est pas un niveau* —, et seuls les niveaux les plus touchés sont gardés (6 au maximum par défaut).

La couleur dit le **rôle actuel** du niveau : couleur de hausse (vert) quand la dernière clôture est au-dessus, c'est un support ; couleur de baisse (rouge) quand elle est en dessous, c'est une résistance. Un niveau franchi change donc de couleur.

Les trois dernières bougies ne peuvent pas encore être des extrêmes : il leur manque des voisines à droite.

## Ce qu'il faut rechercher

### Les niveaux les plus touchés

Plus un niveau a été touché, plus il est **structurant** : beaucoup d'intervenants s'en souviennent et y placent des ordres. Un niveau « ×4 » mérite plus d'attention qu'un niveau « ×2 », et sa cassure, quand elle survient, a davantage de portée.

### L'inversion des rôles

Un support cassé devient souvent une résistance, et une résistance franchie un support : ceux qui ont acheté sur l'ancien plancher cherchent à sortir sans perte quand le prix y revient. Le changement de couleur du niveau marque ce basculement ; le retour du prix sur le niveau par l'autre côté (le *pullback*) est le test classique d'une cassure.

[[illustration:example-supportResistance-downtrend|Tendance baissière : les niveaux laissés par la descente sont tous au-dessus des cours, tracés en résistances.]]

### Les paliers d'une tendance

Dans une tendance, les niveaux se forment surtout pendant les pauses : une consolidation laisse plusieurs sommets et creux au même prix. En hausse, ces paliers restent sous les cours et servent d'appui lors des replis ; en baisse, ils restent au-dessus et freinent les rebonds.

[[illustration:example-supportResistance-uptrend|Tendance haussière : les paliers de consolidation laissent des supports sous les cours.]]

### Le prix entre deux niveaux

Le niveau le plus proche au-dessus du prix et le plus proche en dessous délimitent le terrain de jeu immédiat : un objectif d'un côté, un stop de l'autre. Un prix coincé entre deux niveaux rapprochés annonce souvent un range, dont la sortie sera la cassure de l'un des deux.

## Résumé

Cet indicateur relève, sur une fenêtre récente, les prix où le marché a fait demi-tour plusieurs fois, et les classe par nombre de touches ; leur couleur dit s'ils jouent aujourd'hui le rôle de support ou de résistance. Ils servent à placer objectifs et stops, et à juger une cassure : plus le niveau franchi était touché, plus elle compte. Ils se complètent bien des points pivots (des niveaux calculés à l'avance plutôt que relevés), du Zig Zag (qui montre les sommets et les creux eux-mêmes) et du volume, pour juger si une cassure est portée par les échanges.

## Ce qu'il ne dit pas

L'analyse est **purement rétrospective**, et un niveau est un prix, pas une zone : le marché respecte rarement un niveau au centime près. La fenêtre glisse avec les nouvelles données : un niveau ancien finit par en sortir et **disparaît de l'affichage**, sans que le marché l'ait oublié pour autant.

La tolérance de regroupement est fixe (1 % de l'amplitude de la fenêtre) : sur une fenêtre très étendue, des niveaux voisins peuvent fusionner ; sur un marché bruité, des sommets proches mais pas assez peuvent ne former aucun niveau. Et un nombre de touches ne dit rien du volume échangé à ce prix.`,

  adx: `**L'ADX (Average Directional Index) mesure la force d'une tendance, jamais son sens.** Il est accompagné de deux lignes directionnelles : **+DI**, la pression acheteuse, et **−DI**, la pression vendeuse.

Un ADX élevé signale une tendance marquée, qu'elle soit haussière ou baissière ; un ADX bas, un marché sans direction. Les deux DI donnent le sens : celle qui domine l'autre indique quel camp mène. On s'en sert avant tout comme d'un **filtre** : savoir si le marché se prête à une stratégie de suivi de tendance (moyennes mobiles, cassures) ou plutôt à une stratégie de range (oscillateurs, achat près du support et vente près de la résistance).

## Histoire

**J. Welles Wilder Jr.**, ingénieur en mécanique devenu trader, présente le *Directional Movement System* en 1978 dans *New Concepts in Technical Trading Systems*, le livre où il publie aussi le RSI, l'ATR et le Parabolic SAR. Il cherchait à répondre à la question que se pose tout suiveur de tendance : *le marché est-il en tendance, ou non ?* Une méthode de suivi de tendance appliquée à un marché sans direction perd de l'argent la plupart du temps.

L'ADX et ses deux lignes directionnelles sont restés depuis l'un des indicateurs de tendance les plus utilisés. La période de 14 proposée par Wilder est toujours la norme, et le seuil de 25 s'est imposé comme repère usuel d'une tendance établie.

## Les bases

Pour chaque bougie, on compare son plus haut et son plus bas à ceux de la bougie précédente. Si elle est allée plus haut que la précédente, davantage qu'elle n'est allée plus bas, c'est un **mouvement directionnel positif** ; dans le cas inverse, un mouvement directionnel négatif. Ces mouvements sont lissés puis rapportés à l'amplitude moyenne des bougies (le *range vrai*, celui de l'ATR) : on obtient +DI et −DI, deux pourcentages entre 0 et 100.

L'ADX vient ensuite : il mesure l'**écart entre les deux DI**, rapporté à leur somme, et le lisse une seconde fois. Quand un camp domine nettement, l'écart est grand et l'ADX monte ; quand les deux camps se neutralisent, l'écart se réduit et l'ADX baisse. C'est pourquoi l'ADX monte aussi bien dans une forte baisse que dans une forte hausse.

Le panneau affiche l'ADX en trait plus épais, les deux DI dans les couleurs de hausse et de baisse, et une ligne pointillée au seuil de tendance forte (25 par défaut). Les repères usuels :

- **au-dessus de 25** — une tendance établie ;
- **sous 20** — un marché sans direction ;
- **entre les deux** — une zone d'incertitude, où la pente de l'ADX compte plus que son niveau.

## Ce qu'il faut rechercher

### Une tendance forte qui se renforce

Un ADX au-dessus du seuil et orienté à la hausse confirme une tendance qui gagne en force. Le sens se lit sur les DI : +DI au-dessus de −DI pour une hausse, l'inverse pour une baisse. Dans cette configuration, les replis sont plutôt des occasions de suivre la tendance que des signaux de retournement.

[[illustration:example-adx-uptrend|Tendance haussière : l'ADX reste largement au-dessus du seuil, et +DI domine −DI du début à la fin.]]

### Le croisement des DI

Le passage de +DI au-dessus de −DI est le signal d'achat du système de Wilder, le croisement inverse le signal de vente. Pris seuls, ces croisements sont nombreux et souvent trompeurs ; ils gagnent en valeur quand l'ADX confirme qu'une tendance existe, ou qu'il se redresse juste après le croisement.

[[illustration:example-adx-reversal|Retournement : les DI se croisent après le sommet, l'ADX fléchit pendant la bascule puis remonte avec la baisse. Il mesure la force, pas le sens.]]

### Un ADX qui retombe

Un ADX qui redescend depuis un niveau élevé signale un **essoufflement** : la tendance perd de sa vigueur, et le marché entre souvent dans une phase de consolidation. Ce n'est **pas** un signal de retournement : la tendance peut reprendre après la pause. C'est en revanche un bon moment pour resserrer ses stops ou alléger sa position.

### Un marché sans tendance

Un ADX bas et plat, sous 20, décrit un marché qui hésite : les croisements de DI s'y multiplient sans suite. Ce sont les phases où les stratégies de range fonctionnent le mieux. Une remontée de l'ADX depuis ces niveaux bas annonce souvent le début d'une nouvelle tendance, dans le sens de la DI dominante.

## Résumé

L'ADX dit si une tendance existe et quelle est sa force ; les DI disent dans quel sens elle va. Ensemble, ils servent à choisir sa stratégie (suivre la tendance au-dessus de 25, jouer le range sous 20) et à filtrer les signaux d'autres outils : ne garder un croisement de moyennes mobiles, une cassure ou un croisement de DI que lorsque l'ADX confirme. Il se complète bien du Choppiness Index (une autre mesure du caractère directionnel), de l'ATR (l'amplitude des mouvements) et d'un stop suiveur comme le Parabolic SAR, conçu par Wilder pour les phases de tendance que l'ADX signale.

## Ce qu'il ne dit pas

Son **double lissage** le rend tardif : l'ADX confirme une tendance déjà bien engagée, rarement son début, et met du temps à retomber après un retournement. Il ne dit ni le sens (c'est le rôle des DI), ni jusqu'où ira le mouvement, et un ADX très élevé précède parfois l'épuisement de la tendance plutôt que sa poursuite.

Les seuils de 20 et 25 sont des conventions : selon l'instrument et l'unité de temps, l'ADX peut vivre durablement au-dessus ou en dessous.`,

  chandelierExit: `**Le Chandelier Exit est un stop suiveur suspendu au plus haut récent**, à une distance mesurée en ATR — comme un lustre accroché au plafond, d'où son nom. En position acheteuse, le stop se place sous le plus haut des N dernières bougies ; en position vendeuse, symétriquement, au-dessus du plus bas.

Il sert à **sortir d'une position** au bon moment : rester dans la tendance tant qu'elle tient, et en sortir quand le prix recule plus que ce que la volatilité du moment justifie. La version proposée ici en fait aussi un indicateur de régime : un seul stop est tracé à la fois, celui du sens en cours, et chaque bascule porte une étiquette **Achat** ou **Vente**.

## Histoire

Le Chandelier Exit est attribué au trader américain **Chuck LeBeau**, spécialiste des systèmes de trading sur contrats à terme, connu pour l'importance qu'il accordait aux stratégies de sortie. Il a été popularisé au début des années 2000 par **Alexander Elder**, dans *Come Into My Trading Room* (2002). Il mesure la volatilité avec l'ATR, publié par **J. Welles Wilder** en 1978.

Les réglages classiques — 22 bougies, soit à peu près un mois de séances, et 3 ATR — viennent de cette tradition. La version de ce graphique, avec ses deux stops qui ne reculent pas et ses signaux d'achat et de vente, est adaptée d'un script Pine répandu.

## Les bases

Deux stops sont calculés à chaque bougie :

- le **stop long** : le plus haut des N dernières bougies, moins un multiple de l'ATR (3 × ATR sur 22 bougies par défaut) ;
- le **stop court** : le plus bas des N dernières bougies, plus le même multiple.

Par défaut, les extrêmes sont pris sur les **clôtures** plutôt que sur les mèches, ce qui rend le stop moins sensible à un pic isolé.

Chaque stop **ne recule jamais** tant que le prix reste du bon côté : le stop long ne peut que monter, le stop court que descendre. Si la clôture précédente est passée de l'autre côté, le stop repart de sa valeur brute au lieu de rester accroché à un niveau devenu caduc.

Le sens bascule à l'achat quand une clôture passe au-dessus du stop court, à la vente quand une clôture passe sous le stop long. Un seul stop est alors tracé : sous les cours dans la couleur de hausse, au-dessus dans la couleur de baisse. La zone entre le prix et le stop actif est légèrement teintée, et un point marque chaque bascule, avec son étiquette.

## Ce qu'il faut rechercher

### Un stop qui accompagne la tendance

Dans une tendance solide, le stop monte sous les cours sans être touché : chaque nouveau plus haut le remonte d'autant. C'est l'usage pour lequel il a été conçu : garder la position tant que la tendance tient, sans fixer d'objectif à l'avance.

[[illustration:example-chandelierExit-uptrend|Tendance haussière : le stop long monte sous les cours et n'est jamais touché, malgré les replis.]]

### Le signal de sortie

Une clôture sous le stop long met fin à la position acheteuse : l'étiquette **Vente** apparaît et le stop passe au-dessus des cours. Au sommet d'une tendance, ce signal arrive forcément après le plus haut, à quelque 3 ATR de distance par construction : c'est le prix à payer pour ne pas sortir à chaque repli.

[[illustration:example-chandelierExit-reversal|Retournement : un seul signal Vente, quelques bougies après le sommet, puis le stop court accompagne la baisse.]]

### Un multiplicateur à la mesure du marché

Le multiplicateur règle le compromis entre protection et respiration. À 3 ATR, le stop tolère les replis ordinaires ; plus serré (2 ATR ou moins), il protège mieux le gain acquis mais sort plus souvent pour rien ; plus large (4 ATR et plus), il convient aux positions de fond sur des marchés nerveux.

### Les allers-retours en range

Sans tendance, le prix traverse sans cesse les stops : les signaux Achat et Vente s'enchaînent à quelques bougies d'intervalle, et chacun coûte une petite perte. Des bascules rapprochées sont le signe qu'il vaut mieux laisser l'indicateur de côté, ou attendre qu'un ADX ou un Choppiness Index confirme le retour d'une tendance.

[[illustration:example-chandelierExit-range|Range : les signaux Achat et Vente s'enchaînent, souvent à contretemps.]]

## Résumé

Le Chandelier Exit place un stop à quelques ATR sous le plus haut récent (ou au-dessus du plus bas récent) et ne le laisse jamais reculer : il garde la position tant que la tendance tient et la clôt quand le recul dépasse la volatilité habituelle. C'est un outil de **gestion de position** plus que d'entrée, qui donne le meilleur de lui-même dans une tendance établie. Il se complète bien de l'ADX ou du Choppiness Index (pour savoir si une tendance existe), du Supertrend (une logique voisine, bâtie autour du prix médian plutôt que des extrêmes) et de l'ATR lui-même.

## Ce qu'il ne dit pas

Ce n'est pas un signal d'entrée : une bascule arrive par construction après le retournement, et en range les signaux sont nombreux et perdants. Comme tout stop suiveur, il sort aussi dans les replis profonds d'une tendance qui, elle, tient toujours.

Le changement de sens se décide sur les clôtures : en cours de bougie, le prix peut passer sous le stop puis remonter sans déclencher de signal. Et un gap peut faire passer le prix bien au-delà du stop, qui ne garantit donc aucun prix de sortie.`,

  expectedVolatility: `**Cet indicateur trace, pour chaque période, jusqu'où le prix peut raisonnablement aller depuis son ouverture**, d'après l'amplitude moyenne des périodes précédentes, l'ATR.

Au début de chaque période — un jour, une heure, une bougie de 4 heures, ou chaque bougie de l'échelle courante — il pose des niveaux horizontaux qui tiennent toute la période : l'**ouverture** (la médiane), l'**ouverture plus et moins un ATR**, et l'**ouverture plus et moins la moyenne de l'ATR**. Ces bandes donnent l'ordre de grandeur du déplacement « normal » sur la période : de quoi fixer un objectif réaliste, placer un stop hors du bruit, ou reconnaître une séance qui sort de l'ordinaire.

## Histoire

L'ATR (*Average True Range*) a été publié par **J. Welles Wilder** en 1978, dans *New Concepts in Technical Trading Systems*. Il mesure l'amplitude moyenne des bougies en tenant compte des gaps, et sert depuis de mesure de volatilité de référence pour dimensionner stops et positions.

Projeter cette amplitude autour de l'ouverture est une pratique répandue chez les traders intraday, qui y lisent la portée probable d'une séance : une version simple du *mouvement attendu* que les traders d'options déduisent, eux, de la volatilité implicite. L'indicateur de ce graphique est porté d'un script Pine (« Volatilité attendue du jour (ATR) ») ; la combinaison de deux bandes, l'une sur l'ATR et l'autre sur sa moyenne, figées à l'ouverture de chaque période, est **propre à cet indicateur**.

## Les bases

L'ATR est calculé sur les bougies de l'**échelle choisie** : des bougies quotidiennes avec l'échelle « 1 jour », des bougies d'une heure avec « 1 heure », et ainsi de suite. Si l'échelle choisie n'est pas plus large que celle du graphique, l'indicateur prend l'échelle courante : chaque bougie a alors ses propres niveaux.

À l'ouverture de chaque période, il prend l'ATR et sa moyenne de la **dernière période clôturée** — jamais celle en cours, qui n'est pas encore connue — et pose :

- la **médiane**, l'ouverture de la période, en pointillés gris ;
- **ouverture ± ATR**, en trait plein orange : l'amplitude récente, lissée sur 9 périodes par défaut ;
- **ouverture ± moyenne de l'ATR**, en tirets cyan : l'amplitude habituelle sur un horizon plus long (la moyenne des 14 derniers ATR).

Les niveaux sont **figés** pour toute la période : ils ne bougent plus, quoi que fasse le prix. La période en cours est prolongée jusqu'à sa fin prévue. Seules les dernières périodes sont tracées (5 par défaut) ; chaque ligne porte une étiquette « Volatilité attendue - … » avec son niveau, et la légende donne l'ATR et sa moyenne pour la période survolée.

## Ce qu'il faut rechercher

### Une période qui a déjà fait son chemin

Quand le prix atteint la bande ouverture + ATR, ou ouverture − ATR, la période a déjà parcouru son amplitude habituelle. Le mouvement peut se prolonger, mais c'est moins probable qu'en début de période : un endroit logique pour prendre une partie de ses gains, et un mauvais endroit pour entrer dans le sens du mouvement.

### Des objectifs et des stops à la mesure du marché

Les bandes donnent des distances réalistes. Un objectif au-delà de la bande ATR suppose une séance exceptionnelle ; un stop placé tout près de l'ouverture, loin à l'intérieur des bandes, sera souvent touché par le simple bruit. Comme les niveaux sont connus dès l'ouverture, ils se prêtent bien à un plan de séance écrit à l'avance.

### Une volatilité au-dessus ou en dessous de la normale

Comparez les deux bandes. Une bande ATR **plus large** que celle de la moyenne signale une volatilité récente supérieure à son habitude : des séances plus agitées, des stops à élargir. **Plus étroite**, le marché est plus calme que d'ordinaire ; ces phases de compression précèdent souvent un regain d'activité.

### Une séance qui sort du cadre

Un prix qui dépasse franchement la bande ATR, jusqu'à deux ATR ou plus, signale une séance hors norme : une annonce, une publication, un choc de marché. Ce n'est pas le moment de parier sur un retour dans les bandes : le cadre habituel ne s'applique plus.

## Résumé

La volatilité attendue fixe, dès l'ouverture de chaque période, l'amplitude que le prix parcourt d'habitude, à partir de l'ATR et de sa moyenne. Elle aide à placer des objectifs et des stops réalistes, à ne pas courir après un mouvement qui a déjà fait sa période, et à repérer les phases où la volatilité s'écarte de sa normale. Pensée pour l'intraday, elle se complète bien de l'ATR lui-même, des points pivots (des niveaux eux aussi fixés à l'ouverture, mais tirés des prix de la période précédente) et des bandes de Bollinger, qui mesurent la dispersion autour d'une moyenne plutôt qu'autour de l'ouverture.

## Ce qu'il ne dit pas

**Aucune direction**, et aucune limite : un jour d'annonce peut dépasser deux ou trois ATR. Les niveaux décrivent l'amplitude passée, pas un objectif que le marché devrait atteindre.

Ils sont calculés sur l'historique chargé : l'ATR d'une échelle plus large demande assez de bougies pour s'amorcer (9 jours en « 1 jour » avec les réglages par défaut), et rien n'est tracé avant.`,

  rangeDetection: `**Cet indicateur repère tôt un marché qui entre en range** — une phase sans direction, entre un plafond et un plancher — et dessine la zone en rectangle sur les prix.

Il croise trois signes qui accompagnent presque toujours une consolidation : des **volumes qui baissent**, une **volatilité qui se contracte** et un **Choppiness Index (CHOP) qui monte**. Son but est d'annoncer le range dès ses premières bougies, sans attendre que le rectangle saute aux yeux, pour adapter sa conduite : cesser de suivre une tendance qui s'éteint, jouer les bornes du range, ou guetter la cassure qui le terminera.

## Histoire

Chacune des trois notions a son origine. Le **range**, ou *rectangle*, est l'une des figures de consolidation décrites en 1948 par **Robert Edwards et John Magee** dans *Technical Analysis of Stock Trends*, qui notaient déjà que les volumes tendent à s'y tarir. L'**ATR** a été publié par **J. Welles Wilder** en 1978 pour mesurer la volatilité. Le **Choppiness Index** a été conçu par le trader australien **E. W. Dreiss** pour distinguer un marché qui avance d'un marché qui tourne en rond, avec des seuils tirés des ratios de Fibonacci (38,2 et 61,8).

La combinaison des trois, avec ses deux degrés de détection (probable et confirmé) et ses rectangles, est **propre à ce graphique** : c'est un indicateur de la bibliothèque, rangé dans l'onglet « Communauté ».

## Les bases

Trois conditions sont surveillées à chaque bougie :

- **le volume** — la moyenne courte du volume (10 bougies) passe nettement sous la moyenne longue (30 bougies) ;
- **la volatilité** — l'ATR, rapporté au cours, tombe dans le quart le plus bas de ses valeurs des 100 dernières bougies ;
- **le CHOP** — le Choppiness Index monte au-dessus de 50, puis de 61,8.

**Pourquoi le CHOP qui monte, et pas qui baisse ?** Un CHOP élevé signifie un marché haché, sans tendance : c'est le signal de range. Un CHOP qui baisse annonce au contraire une tendance qui démarre. Sous 38,2, s'il ne remonte pas, le marché est jugé franchement directionnel et aucun range n'est annoncé, quoi que disent le volume et la volatilité.

Chaque condition a deux degrés. Elle **commence** quand sa pente va dans le sens d'un range : moyenne courte du volume en baisse et sous la longue, ATR qui baisse de plus en plus vite ou déjà sous sa médiane, CHOP au-dessus de 50 et en hausse. Elle est **établie** quand son seuil est franchi. Il en découle deux états :

- **range probable** — deux conditions sur trois lancées, sans attendre qu'elles soient établies (si aucune ne l'est encore, le signal doit tenir deux bougies de suite) ;
- **range confirmé** — les trois conditions lancées, dont au moins deux établies.

La légende donne l'état et un **score** de 0 à 100 % : une condition établie compte pour 1, une condition qui commence pour ½.

Le **rectangle** part de la première bougie détectée et s'étend tant que le range tient, entre le plus haut et le plus bas de ses bougies. Il s'arrête sur une **cassure** — une clôture au-delà du rectangle de plus d'un ATR — ou après quelques bougies sans signal. Tirets orange : range probable ; trait plein bleu : range confirmé. Sur un symbole sans volume (indice, devise), seules la volatilité et le CHOP comptent, et les deux doivent alors concorder.

## Ce qu'il faut rechercher

### Une pause dans la tendance

Une tendance ne progresse pas en ligne droite : elle alterne poussées et paliers. L'indicateur repère ces paliers dès leur formation — volumes en retrait, bougies plus courtes, CHOP qui grimpe. Tant que le rectangle tient, la tendance est en suspens ; une cassure dans son sens la relance.

[[illustration:example-rangeDetection-uptrend|Tendance haussière : un palier est détecté, puis confirmé, et se termine par une cassure vers le haut.]]

### Probable, puis confirmé

Un range probable, en tirets orange, est une alerte : deux des trois signes sont là, mais le marché peut encore repartir en tendance. Quand le rectangle passe en trait plein bleu, les trois signes concordent et le marché est réellement entré en consolidation. Le score de la légende permet de suivre cette montée en puissance d'une bougie à l'autre.

### Un range au sommet

Après une longue hausse, un range qui se forme près des plus hauts traduit un équilibre retrouvé entre acheteurs et vendeurs. C'est souvent une simple pause, mais c'est aussi la forme que prennent beaucoup de sommets : une sortie par le bas d'un tel range est un signal de retournement à prendre au sérieux.

[[illustration:example-rangeDetection-reversal|Retournement : un range probable se forme autour du sommet, avant que la baisse ne s'installe.]]

### La cassure

Le rectangle se termine sur une clôture qui en sort de plus d'un ATR, libellée « cassure ↑ » ou « cassure ↓ ». C'est la suite logique d'un range : une compression de la volatilité est souvent suivie d'une expansion. La direction de cette cassure, elle, n'est pas annoncée par l'indicateur.

## Résumé

La détection de range précoce combine trois signes de consolidation — volumes en baisse, volatilité contractée, CHOP en hausse — pour annoncer un range dès ses débuts, d'abord comme probable, puis comme confirmé, et le délimite en rectangle jusqu'à sa cassure. Elle aide à cesser de suivre une tendance qui s'essouffle et à préparer la suite. Elle se complète bien du Choppiness Index et de l'ATR seuls (pour lire chaque condition en détail), des bandes de Bollinger (dont le resserrement dit la même compression) et des supports et résistances automatiques, qui donnent les bornes que le range respecte.

## Ce qu'il ne dit pas

Ni la **sortie** du range, ni sa direction. Une détection précoce se trompe plus souvent : un range « probable » peut repartir en tendance quelques bougies plus tard, et un rectangle en cours peut encore s'élargir ou s'éteindre avec les bougies suivantes.

Une zone terminée plus courte que la durée minimale est écartée : les tout petits ranges ne sont pas montrés. Et sur un symbole sans volume, la détection repose sur deux signes au lieu de trois.`,

  srBounce: `**Cet indicateur détecte les zones de support et de résistance, et estime pour chacune le pourcentage de chance que le prix y rebondisse au prochain contact.** Chaque zone est tracée en rectangle — en vert sous le prix (support), en rouge au-dessus (résistance) — avec son prix et sa probabilité de rebond.

L'estimation cumule cinq indicateurs classiques — **ATR, moyennes mobiles simple et exponentielle, ADX et bandes de Bollinger** — et l'historique propre de la zone : combien de fois le prix y a déjà rebondi, combien de fois il l'a cassée. L'option « Détail du calcul » écrit sous chaque zone les facteurs qui pèsent le plus, avec leur effet en points.

## Histoire

Les notions de support et de résistance sont aussi anciennes que l'analyse technique elle-même : Charles Dow, à la fin du XIXᵉ siècle, et après lui Robert Edwards et John Magee (*Technical Analysis of Stock Trends*, 1948) décrivent déjà ces niveaux où les acheteurs ou les vendeurs reprennent la main. Les outils utilisés ici sont plus récents : l'ATR et l'ADX de **J. Welles Wilder** (1978), les bandes de **John Bollinger** (années 1980).

La combinaison est propre à ce graphique : elle reprend des règles de lecture largement partagées — un niveau souvent respecté est solide, une tendance forte casse les niveaux, une volatilité qui se contracte annonce une cassure — et les chiffre pour chaque zone.

## Les bases

**Les zones.** Le calcul repère les sommets et les creux locaux des dernières bougies (une bougie plus haute, ou plus basse, que ses voisines de chaque côté), puis regroupe ceux qui tombent au même prix, à une demi-ATR près. Chaque groupe d'au moins deux pivots forme une zone, de son pivot le plus bas à son plus haut. Une zone sous le prix actuel est un support ; au-dessus, une résistance.

**L'historique.** Chaque contact passé de la zone est suivi : il a *tenu* si le prix s'en est ensuite éloigné d'au moins 1 ATR du côté d'où il venait, il a *cédé* si le prix a clôturé à plus d'une demi-ATR de l'autre côté. Le taux de tenue, lissé pour ne pas conclure sur un seul contact, est le point de départ de l'estimation.

**Les facteurs de marché**, ajoutés ou retirés à ce point de départ :

- **Pivots** : plus de sommets ou de creux au même prix, niveau plus reconnu ;
- **ADX et ±DI** : une tendance forte (ADX au-dessus de 25) qui va vers la zone la casse plus souvent ; un marché sans tendance (ADX sous 20) respecte mieux ses niveaux ;
- **ATR** : une volatilité qui s'emballe (ATR à plus de 130 % de sa moyenne) affaiblit les niveaux, une volatilité calme les renforce ;
- **Moyennes mobiles dans la zone** : une EMA 20, une SMA 50 ou une SMA 200 qui passe dans la zone la renforce (support ou résistance « dynamique ») ;
- **Tendance des moyennes** : un support tient mieux quand le prix est au-dessus de la SMA 200 et que l'EMA 20 est au-dessus de la SMA 50 ; une résistance, dans le cas inverse ;
- **Bandes de Bollinger** : la bande inférieure dans un support (ou la supérieure dans une résistance) signale un prix étiré, favorable au rebond ; des bandes très resserrées annoncent au contraire une cassure.

Le tout est ramené à une probabilité entre 5 et 95 %. Une zone sous 50 % est tracée en tirets.

## Ce qu'il faut rechercher

### Un range bien défini

Dans un marché sans tendance, les mêmes zones arrêtent le prix à chaque passage : l'historique de tenue est excellent et l'ADX faible ajoute encore des points. Ce sont les situations où les probabilités sont les plus hautes, et où acheter près du support ou vendre près de la résistance a le plus de sens.

[[illustration:example-srBounce-range|Range : support et résistance testés à plusieurs reprises, probabilités de rebond au-dessus de 80 %, détail du calcul sous chaque zone.]]

### Des supports en escalier dans une tendance

En tendance haussière, chaque palier de consolidation laisse un support sous les cours. Les supports récents, alignés avec la tendance des moyennes, obtiennent les probabilités les plus élevées ; les plus anciens, souvent cassés au passage, moins.

[[illustration:example-srBounce-uptrend|Tendance haussière : les paliers de consolidation deviennent des supports, les plus récents sont les plus solides.]]

### Une zone qui a déjà cédé

Une zone cassée plusieurs fois perd sa crédibilité : son historique la pénalise, et elle tombe autour de 50 % ou en dessous — tracée en tirets. Après un retournement, les anciens supports devenus résistances sont à surveiller avec prudence.

[[illustration:example-srBounce-reversal|Retournement : les anciennes zones, cassées plusieurs fois, tombent autour de 50 % de rebond.]]

### Le détail qui change la lecture

Lisez le détail du calcul avant de vous fier au chiffre : un 70 % porté par l'historique de la zone n'a pas la même valeur qu'un 70 % porté par une moyenne mobile qui passe par là. Un ADX fortement négatif (tendance qui fonce vers la zone) ou des bandes de Bollinger resserrées sont des signaux d'alerte, même sur une zone réputée solide.

## Résumé

L'indicateur donne, pour chaque support et chaque résistance détectés, une estimation chiffrée de la probabilité de rebond, en croisant l'historique de la zone avec la tendance (ADX, moyennes), la volatilité (ATR, Bollinger) et la confluence des moyennes mobiles. Il est le plus fiable sur les zones testées plusieurs fois, et en marché sans tendance. Confirmez un rebond par le comportement du prix au contact (mèches, chandeliers de retournement) et par le volume.

## Ce qu'il ne dit pas

Ce pourcentage est une **estimation construite à partir de règles d'analyse technique et de l'historique du titre**, pas une probabilité calibrée statistiquement : il classe les zones entre elles et dit lesquelles ont le plus d'arguments, il ne garantit rien. Les zones et les probabilités sont recalculées à chaque nouvelle bougie ; une nouvelle publication, une annonce ou un gap peuvent effacer un niveau d'un coup.`,

  correlation: `**Le coefficient de corrélation mesure à quel point deux instruments évoluent ensemble**, sur une échelle de −1 à +1.

- **+1** — ils évoluent parfaitement en phase : quand l'un monte, l'autre monte aussi, dans une proportion constante ;
- **0** — aucun lien lisible sur la fenêtre ;
- **−1** — ils évoluent en parfaite opposition : quand l'un monte, l'autre descend.

Il compare le cours du graphique à celui d'un second symbole, choisi à l'ajout de l'indicateur, sur une fenêtre glissante (20 bougies par défaut), et trace le résultat dans son propre panneau. Il sert à vérifier une **diversification**, à repérer un **instrument qui se décroche** de ceux qui l'accompagnent d'habitude, et à suivre les liens entre marchés : une action et son indice, une devise et une matière première, des actions et des taux.

## Histoire

Le coefficient utilisé ici est celui de **Karl Pearson**, statisticien britannique, qui le formalise dans les années 1890 en prolongeant les travaux de **Francis Galton** sur la corrélation, menés quelques années plus tôt à propos de l'hérédité. C'est encore aujourd'hui la mesure de liaison la plus utilisée en statistique.

En finance, la corrélation prend toute son importance en 1952 avec **Harry Markowitz** et sa théorie du portefeuille : le risque d'un portefeuille ne dépend pas seulement du risque de chaque titre, mais aussi de la façon dont les titres évoluent ensemble. La corrélation glissante, recalculée bougie après bougie, est devenue l'outil courant pour suivre ces liens dans le temps.

## Les bases

Sur chaque fenêtre de N bougies, l'indicateur compare les écarts des deux séries à leur propre moyenne. Quand les deux sont au-dessus de leur moyenne en même temps, ou en dessous en même temps, la corrélation se renforce ; quand l'une est au-dessus pendant que l'autre est en dessous, elle s'affaiblit, puis devient négative. Le résultat est ramené entre −1 et +1, quelle que soit l'échelle des deux prix : un titre à 10 et un indice à 7 000 se comparent sans difficulté.

Le calcul porte sur les **niveaux de clôture**, pas sur les variations d'une bougie à l'autre. La clôture du second symbole est reportée sur chaque bougie du graphique (dernière valeur connue), ce qui aligne deux marchés aux horaires différents. Le panneau trace la courbe, une ligne à zéro et deux lignes pointillées à plus et moins le seuil de corrélation forte (0,7 par défaut).

## Ce qu'il faut rechercher

### Une corrélation forte et stable

Au-dessus du seuil de +0,7, les deux instruments racontent la même histoire. Deux positions dans le même sens sur des instruments corrélés à 0,9 ne sont pas deux paris : c'est **le même pari pris deux fois**, avec le double du risque. À l'inverse, l'un peut servir d'indicateur avancé ou de confirmation pour l'autre.

### Une corrélation négative

Sous −0,7, les deux instruments se compensent : ce que l'un perd, l'autre tend à le gagner. C'est la propriété recherchée d'une **couverture**. Elle n'est jamais garantie : une corrélation négative peut s'effacer, voire s'inverser, au moment précis où l'on comptait sur elle.

### Une rupture de corrélation

Deux instruments habituellement solidaires qui cessent de l'être signalent souvent qu'il se passe quelque chose sur l'un des deux : une nouvelle propre à l'entreprise, un changement de régime, une rotation entre secteurs. La chute brutale d'une corrélation longtemps élevée mérite qu'on cherche ce qui l'explique avant de s'appuyer sur l'ancien lien.

### Une corrélation qui flotte autour de zéro

Une courbe qui oscille autour de zéro sans jamais s'en écarter durablement décrit deux marchés qui obéissent à des moteurs différents : une vraie source de diversification. Si elle passe sans cesse d'un extrême à l'autre, la fenêtre est probablement trop courte pour en tirer une conclusion.

## Résumé

Le coefficient de corrélation dit, sur une fenêtre glissante, si deux instruments évoluent ensemble (près de +1), en opposition (près de −1) ou indépendamment (près de 0). Il sert à juger la diversification réelle d'un ensemble de positions, à choisir une couverture et à repérer les ruptures de lien qui signalent un changement. Il se complète bien d'une mesure de volatilité comme l'ATR : deux instruments très corrélés mais de volatilités différentes ne portent pas le même risque.

## Ce qu'il ne dit pas

**Une corrélation n'est pas une causalité**, et elle n'est pas stable : elle se calcule sur une fenêtre et change avec elle. Deux actifs peu corrélés en temps calme peuvent le devenir bien davantage dans une panique, exactement au moment où la diversification comptait.

Calculée sur les niveaux de prix, elle peut aussi être trompeuse : deux instruments sans aucun lien mais tous deux en tendance haussière afficheront une corrélation élevée. Et une fenêtre courte réagit vite mais donne des valeurs instables, quand une fenêtre longue lisse au point de masquer une rupture récente.`,

  tpo: `**Le TPO (Time Price Opportunity) mesure le temps que le marché a passé à chaque niveau de prix**, et non le volume qui s'y est échangé.

Chaque séance est découpée en blocs de temps (30 minutes par défaut) ; chaque bloc dépose une marque, une lettre ou un chiffre, sur tous les niveaux de prix qu'il a visités. Empilées ligne par ligne, ces marques dessinent un **profil** couché à côté des bougies : large là où le marché a stationné, étroit là où il n'a fait que passer. Il sert à repérer les prix *acceptés*, où acheteurs et vendeurs se sont longuement trouvés, et les prix *rejetés*, traversés en vitesse.

## Histoire

Le TPO est la brique de base du **Market Profile**, conçu par **J. Peter Steidlmayer**, opérateur sur le parquet du Chicago Board of Trade, et mis à la disposition des intervenants par cette bourse au milieu des années 1980. Steidlmayer voulait rendre visible ce que les opérateurs du parquet sentaient d'instinct : le marché cherche en permanence le prix qui permet le plus d'échanges, et le temps passé à un prix mesure son acceptation.

Le découpage en périodes de 30 minutes, notées chacune par une lettre, vient de cette origine. Le profil de volume (*volume profile*), qui compte des volumes plutôt que du temps, en est un cousin plus récent.

## Les bases

Pour chaque séance, ici un jour calendaire, l'indicateur découpe l'étendue de prix — du plus bas au plus haut de la séance — en lignes égales (24 par défaut). Il parcourt ensuite la séance bloc par bloc : chaque bloc marque toutes les lignes que ses bougies ont touchées, avec sa lettre (A pour le premier bloc, B pour le suivant…) ou son numéro. Les marques de chaque ligne s'alignent de gauche à droite dans l'ordre chronologique, et leur couleur évolue du premier au dernier bloc de la séance.

Trois repères en ressortent, tracés en pointillés :

- le **POC** (*point of control*), la ligne la plus marquée : le prix où le marché a passé le plus de temps ;
- le **VAH** et le **VAL**, le haut et le bas de la **zone de valeur** : les lignes autour du POC qui regroupent 70 % des marques ;
- hors de la zone de valeur, les marques sont plus pâles.

Sur des bougies plus longues qu'un bloc — un graphique quotidien, par exemple —, le chemin suivi par le prix à l'intérieur de chaque bougie n'est pas connu. L'indicateur le reconstitue en supposant un trajet ouverture, plus bas, plus haut, clôture pour une bougie haussière (ouverture, plus haut, plus bas, clôture pour une baissière). Le profil est alors une **approximation** : il n'est exact qu'avec des bougies plus courtes que les blocs.

## Ce qu'il faut rechercher

### Le point de contrôle

Le POC est le prix que le marché a jugé le plus juste pendant la séance. Il agit comme un aimant : dans une séance calme, le prix qui s'en éloigne tend à y revenir. Le POC de la séance précédente reste une référence pour la suivante, souvent testée dès l'ouverture.

### La zone de valeur

La zone de valeur concentre l'essentiel de l'activité. Une ouverture à l'intérieur de la zone de la veille annonce plutôt une séance d'équilibre, où le prix circule entre VAH et VAL. Une ouverture au-dehors pose une question : soit le prix est rejeté et revient dans l'ancienne zone, soit il est accepté et le marché cherche une nouvelle valeur, souvent dans le sens de l'ouverture.

### La forme du profil

Un profil en cloche, large au milieu et étroit aux extrémités, décrit une séance équilibrée. Un profil long et maigre, avec peu de marques à chaque prix, décrit une séance de tendance, où le marché n'a stationné nulle part. Un profil renflé en haut (en forme de « P ») ou en bas (en forme de « b ») montre un mouvement suivi d'une acceptation au nouveau niveau.

### Les zones étroites

Les lignes qui n'ont reçu qu'une ou deux marques sont des prix que le marché a traversés vite, sans s'y attarder. Situées aux extrémités, elles marquent souvent un rejet net ; au milieu du profil, elles séparent deux zones d'acceptation. Le prix a tendance à les retraverser vite, lui aussi.

## Résumé

Le TPO montre où le marché a passé son temps pendant chaque séance : le POC pour le prix le plus accepté, la zone de valeur pour l'essentiel de l'activité, les zones étroites pour les prix rejetés. Il aide à lire l'équilibre ou le déséquilibre d'une séance et à fixer des références pour la suivante. Il se complète bien du VWAP (le prix moyen pondéré par les volumes), des points pivots et des supports et résistances automatiques, qui donnent d'autres niveaux à confronter aux siens.

## Ce qu'il ne dit pas

Il décrit **où le marché s'est tenu**, pas où il va. Et il compte du temps, pas des transactions : un palier longuement visité dans le calme peut peser moins qu'un passage bref sur un volume massif.

Les séances sont des jours calendaires, pas les horaires d'une place précise ; et sur des bougies plus longues que les blocs, le profil repose sur un trajet supposé à l'intérieur de chaque bougie, pas sur les échanges réels.`,

  freeCashFlow: `**Le flux de trésorerie disponible (en anglais *free cash flow*, FCF) est l'argent qui reste à l'entreprise une fois payées ses dépenses d'exploitation et ses investissements.** On l'obtient en retranchant les dépenses d'investissement (machines, usines, bâtiments, logiciels…) de la trésorerie produite par l'activité.

C'est l'argent réellement disponible pour rembourser une dette, verser un dividende, racheter des actions, financer une acquisition ou renforcer la trésorerie. Là où le bénéfice net dit ce que l'entreprise a gagné *sur le papier*, le flux de trésorerie disponible dit ce qu'elle a effectivement encaissé, une fois son outil de production entretenu et développé. C'est l'une des mesures préférées des investisseurs pour juger de la qualité d'un résultat et de la capacité d'une entreprise à se financer seule.

## Histoire

Des trois grands états financiers, le tableau des flux de trésorerie est le plus récent. Le bilan et le compte de résultat sont aussi anciens que la comptabilité moderne ; le tableau des flux de trésorerie n'est devenu obligatoire aux États-Unis qu'à la fin des années 1980 (norme FAS 95, 1987), puis s'est imposé à l'international avec la norme IAS 7. Il répond à un constat simple : une entreprise peut afficher des bénéfices et manquer d'argent, parce que ses ventes ne sont pas encore encaissées, que ses stocks gonflent ou que ses investissements absorbent tout.

La notion de *free cash flow* s'est répandue chez les analystes à la même époque. L'économiste **Michael Jensen** lui a donné une place centrale en 1986, dans un article sur les coûts d'agence : une entreprise qui dégage beaucoup de trésorerie sans projets rentables où l'investir est tentée de la gaspiller, d'où l'intérêt de la rendre aux actionnaires. Le flux de trésorerie disponible est aussi la matière première des évaluations par actualisation des flux futurs (la méthode dite DCF).

Ce n'est pas pour autant un agrégat normalisé : aucune norme comptable n'en fixe la définition, et chaque source peut le calculer un peu différemment.

## Les bases

Le calcul tient en une soustraction :

- on part du **flux de trésorerie d'exploitation** : le bénéfice, corrigé de ce qui ne se traduit par aucun mouvement d'argent (amortissements, provisions) et de la variation du besoin en fonds de roulement (stocks, créances clients, dettes fournisseurs) ;
- on retranche les **dépenses d'investissement** (en anglais *capital expenditures*, ou *capex*).

Le chiffre n'est **pas calculé par le graphique** : il est fourni par l'application, à chaque date de publication, à la fréquence où elle le fournit — souvent trimestrielle. Entre deux publications, la dernière valeur connue est reportée sur chaque bougie : la courbe avance **en paliers** et ne change qu'aux dates de publication, quel que soit le mouvement du cours entre-temps. Le type de tracé « Palier » rend cette réalité visible ; « Aire » remplit la surface jusqu'à zéro, ce qui fait bien ressortir les périodes où le flux passe en négatif.

En mode **« Variation sur 1 an »**, la courbe montre l'évolution en pourcentage par rapport à la publication d'au moins un an plus tôt, ce qui neutralise la saisonnalité de certaines activités. Une publication dont la référence d'un an plus tôt était nulle ou négative n'a pas de variation (un pourcentage calculé depuis une base négative n'aurait pas de sens) : pour une mesure qui passe souvent sous zéro comme celle-ci, la variation précédente reste alors affichée plus longtemps.

## Ce qu'il faut rechercher

### Une trajectoire régulière sur plusieurs années

Ce qui compte est moins le niveau d'un trimestre que **la trajectoire sur plusieurs années**, et sa régularité. Un flux de trésorerie disponible qui progresse régulièrement signale une entreprise dont l'activité finance d'elle-même sa croissance, ses dividendes et ses rachats d'actions.

Un flux très heurté, qui alterne trimestres positifs et négatifs, se lit mieux en embrassant plusieurs années d'un coup d'œil, ou en mode « Variation sur 1 an », qui compare chaque trimestre au même trimestre de l'année précédente.

### L'écart avec le bénéfice net

Comparez-le au bénéfice net de la même période. Sur la durée, les deux devraient évoluer dans le même sens et rester du même ordre de grandeur. On préfère souvent le flux de trésorerie au bénéfice parce qu'il est **plus difficile à habiller** : le résultat comptable dépend de choix d'amortissement et de provisions, la trésorerie beaucoup moins.

Un bénéfice qui monte pendant que le flux de trésorerie stagne ou baisse est donc un signal à creuser : créances clients qui gonflent, stocks qui s'accumulent, ou résultat porté par des éléments sans contrepartie en argent. À l'inverse, un flux durablement supérieur au bénéfice traduit souvent de lourds amortissements sur des investissements passés.

### Un flux négatif : croissance ou difficulté ?

Un flux négatif n'est pas un mauvais signe en soi : une entreprise en forte croissance investit plus qu'elle n'encaisse, **par construction**. Regardez le chiffre d'affaires en parallèle : s'il progresse vivement, le flux négatif finance probablement cette croissance.

C'est le flux négatif *sans* croissance qui pose question, surtout s'il dure et que l'entreprise doit s'endetter ou émettre des actions pour le combler. Le ratio dette / capitaux propres le montre alors en hausse.

### Le flux face au cours

Les investisseurs rapportent souvent le flux de trésorerie disponible à la valeur boursière de l'entreprise : c'est le *rendement du flux de trésorerie disponible*. Sur le graphique, la comparaison se fait à l'œil : un cours qui monte bien plus vite que le flux signifie que l'action se paie de plus en plus cher pour chaque unité d'argent réellement encaissée ; un cours qui baisse alors que le flux progresse peut au contraire signaler une décote.

## Résumé

Le flux de trésorerie disponible mesure l'argent que l'entreprise dégage réellement, une fois son outil de production financé. Il complète le bénéfice net, plus sensible aux choix comptables, et se lit sur plusieurs années plutôt que trimestre par trimestre. Il se rapproche utilement du **bénéfice net** (la qualité du résultat), du **chiffre d'affaires** (un flux négatif finance-t-il de la croissance ?) et du **ratio dette / capitaux propres** (l'entreprise s'endette-t-elle pour combler un flux négatif ?).

## Ce qu'il ne dit pas

Ce n'est **pas une mesure normalisée** : selon la source, les intérêts versés, les loyers des contrats de location ou les acquisitions sont traités différemment. Pour comparer deux entreprises, il faut des chiffres venant de la même source.

Les dépenses d'investissement dépendent en partie de la direction : les couper fait bondir le flux d'un trimestre, au détriment de l'avenir. Et un trimestre isolé peut tromper, déformé par un gros encaissement client, un impôt payé en décalé ou une variation de stocks.

Enfin, il ne dit rien du prix : un excellent flux de trésorerie peut être déjà largement payé dans le cours.`,

  netIncome: `**Le bénéfice net est ce qui reste à l'entreprise après toutes ses charges, tous ses intérêts et tous ses impôts.** C'est la dernière ligne du compte de résultat, d'où son surnom anglais de *bottom line*. Quand il est négatif, on parle de perte nette.

Il mesure la rentabilité finale de l'entreprise sur la période : ce qui revient à ses actionnaires, et qui peut leur être distribué en dividendes ou conservé pour financer l'avenir. C'est aussi le point de départ des mesures les plus suivies par le marché — le bénéfice par action, et à travers lui le PER.

## Histoire

La notion de résultat est aussi ancienne que la comptabilité en partie double, décrite par le moine italien **Luca Pacioli** en 1494 : solder les comptes de produits et de charges fait apparaître le gain ou la perte de la période. Ce qui a changé depuis, c'est la normalisation.

Au XXe siècle, l'obligation de publier des comptes audités pour les sociétés cotées (aux États-Unis avec les lois boursières de 1933 et 1934), puis les normes comptables nationales et enfin internationales — les normes IFRS, obligatoires pour les comptes consolidés des sociétés cotées européennes depuis 2005 — ont fixé la manière de calculer et de présenter ce chiffre. Elles n'ont pas pour autant effacé toutes les différences : normes américaines et internationales divergent encore sur plusieurs points.

## Les bases

Le compte de résultat se lit de haut en bas : on part du chiffre d'affaires, on retire le coût des ventes (on obtient la marge brute), puis les frais commerciaux, administratifs et de recherche (le résultat d'exploitation), puis le coût de la dette et les autres éléments financiers, enfin l'impôt sur les sociétés. Ce qui reste est le bénéfice net. Dans les comptes d'un groupe, le chiffre suivi est en général la part qui revient aux actionnaires de la société mère, sans celle des actionnaires minoritaires des filiales.

Le chiffre n'est **pas calculé par le graphique** : il est fourni par l'application, à chaque date de publication, souvent chaque trimestre. Entre deux publications, la dernière valeur connue est reportée sur chaque bougie : la courbe avance **en paliers**. Comme il couvre une période (un trimestre, par exemple), il se compare au même trimestre de l'année précédente plutôt qu'au précédent, à cause de la saisonnalité de nombreuses activités.

Le mode **« Variation sur 1 an »** fait justement cette comparaison : chaque publication est rapportée à celle d'au moins un an plus tôt, en pourcentage. Une publication dont la référence d'un an plus tôt était une perte, ou un bénéfice nul, n'a pas de variation : un retour aux bénéfices n'a pas de taux de croissance qui ait un sens.

## Ce qu'il faut rechercher

### Une progression régulière

La trajectoire prime sur le niveau absolu : une entreprise dont le bénéfice progresse régulièrement, année après année, raconte quelque chose qu'un trimestre isolé ne dit pas. La régularité compte autant que la pente : un bénéfice qui monte par à-coups est plus difficile à prévoir, et le marché le paie en général moins cher.

### Bénéfice et chiffre d'affaires

Il se compare utilement au **chiffre d'affaires** de la même période — c'est la marge nette, qui dit si la croissance se traduit en profit. Un bénéfice qui croît plus vite que les ventes signale un effet de levier : les coûts fixes sont déjà couverts, et chaque vente supplémentaire rapporte davantage.

À l'inverse, des ventes qui progressent pendant que le bénéfice stagne décrivent une croissance qui coûte cher : baisse des prix, hausse des coûts, ou investissements commerciaux lourds.

### Un saut isolé

Un bond ou un effondrement sur un seul trimestre, sans mouvement comparable du chiffre d'affaires, vient souvent d'un **élément exceptionnel** : plus-value de cession, dépréciation d'actifs, litige, changement fiscal. Le trimestre suivant dit en général s'il s'agissait d'un accident : si la courbe revient sur sa tendance, l'activité n'a probablement pas changé.

### Bénéfice et cours

Sur longue période, le cours d'une action suit ses bénéfices. Un cours qui grimpe pendant que le bénéfice stagne signifie que le marché paie plus cher chaque unité de bénéfice : le PER s'élargit, sur l'espoir d'une croissance à venir. Un cours qui baisse pendant que le bénéfice progresse traduit le mouvement inverse, une compression du PER, qui peut annoncer une décote ou des doutes sur la suite.

## Résumé

Le bénéfice net est la mesure finale de la rentabilité : ce qui reste aux actionnaires une fois tout payé. Il se lit dans la durée et en comparaison, au même trimestre de l'année précédente. On le rapproche du **chiffre d'affaires** et de la **marge nette** (la croissance est-elle rentable ?), du **flux de trésorerie disponible** (le bénéfice se traduit-il en argent ?) et du **bénéfice par action** (que revient-il à chaque action ?).

## Ce qu'il ne dit pas

C'est un **agrégat comptable**, sensible aux éléments exceptionnels : une cession d'actif, une dépréciation, un changement de régime fiscal peuvent le faire bondir ou s'effondrer sans que l'activité ait changé. Il dépend aussi de choix comptables (durées d'amortissement, provisions) et ne dit rien de l'argent réellement encaissé. C'est précisément pourquoi on le regarde à côté du *flux de trésorerie disponible*.

Son montant brut ne dit rien de la rentabilité relative : il faut le rapporter au chiffre d'affaires (la marge nette) ou au nombre d'actions (le bénéfice par action). Et deux entreprises qui suivent des normes comptables différentes ne sont pas parfaitement comparables.`,

  totalRevenue: `**Le chiffre d'affaires est le montant total que l'entreprise a facturé à ses clients sur la période, avant toute charge.** C'est la première ligne du compte de résultat (la *top line* des Anglo-Saxons), et la mesure la plus directe de la taille de l'activité.

Il dit combien l'entreprise vend, pas combien elle gagne. Sa croissance est pourtant le premier moteur des bénéfices à long terme : on peut améliorer une marge un temps en réduisant les coûts, mais pas indéfiniment, alors qu'une activité qui grandit élargit la base sur laquelle se calculent tous les profits futurs. C'est la mesure qu'on regarde en premier pour une entreprise jeune, qui ne gagne pas encore d'argent.

## Histoire

Compter les ventes est la plus ancienne des pratiques comptables. La difficulté moderne est de savoir **quand** une vente compte : à la commande, à la livraison, à la facture, à l'encaissement ? Pour un abonnement de trois ans, un chantier qui dure, ou un logiciel vendu avec sa maintenance, la réponse change tout.

Parce que le chiffre d'affaires est l'une des lignes les plus souvent corrigées, et parfois manipulées, les normalisateurs américain et international ont élaboré ensemble une norme commune de reconnaissance du revenu (IFRS 15 et son équivalent américain ASC 606), publiée en 2014 et appliquée depuis 2018 : le chiffre d'affaires est reconnu au fur et à mesure que l'entreprise remplit ses engagements envers son client.

## Les bases

Le chiffre d'affaires additionne les ventes de biens et de services de la période, déduction faite des remises, rabais et retours, et hors taxes collectées pour le compte de l'État, comme la TVA.

Le chiffre n'est **pas calculé par le graphique** : il est fourni par l'application, à chaque date de publication, souvent chaque trimestre. Entre deux publications, la dernière valeur connue est reportée sur chaque bougie : la courbe avance **en paliers**. Le type de tracé « Aire », qui remplit la surface jusqu'à zéro, se prête bien à ce montant.

Beaucoup d'activités sont saisonnières (le commerce et ses fêtes de fin d'année, le tourisme et son été) : un trimestre se compare donc au même trimestre de l'année précédente, pas au précédent. C'est exactement ce que fait le mode **« Variation sur 1 an »**, qui trace la croissance en pourcentage par rapport à la publication d'au moins un an plus tôt. Pour cette mesure, c'est souvent le mode le plus parlant.

## Ce qu'il faut rechercher

### Le rythme de croissance

Sa **croissance** est ce qu'on regarde : en pourcentage, d'une période à la même période de l'année précédente. Au-delà du niveau, c'est l'**accélération** ou le **ralentissement** qui compte. Pour une valeur de croissance, un chiffre d'affaires qui progresse encore mais de moins en moins vite pèse souvent sur le cours, parce que le prix payé reposait sur le rythme passé.

### Croissance et rentabilité

Comparé au *bénéfice net*, il dit si l'entreprise grandit **en gagnant de l'argent** ou en en perdant. Des ventes et des bénéfices qui montent ensemble décrivent une croissance saine ; des ventes en forte hausse avec une marge qui s'effondre décrivent une entreprise qui achète sa croissance, par des prix cassés ou des dépenses commerciales massives.

### Une rupture de série

Un palier brutal, à la hausse comme à la baisse, vient souvent d'un changement de périmètre : une **acquisition** ajoute d'un coup le chiffre d'affaires de la société achetée, une cession le retire. Les variations de change jouent aussi pour une entreprise qui vend à l'étranger. Les entreprises publient pour cela une croissance « organique » ou « à périmètre et change constants », que ce chiffre brut ne montre pas.

### Le cours face aux ventes

Pour une entreprise qui ne fait pas encore de bénéfice, les investisseurs rapportent la valeur boursière au chiffre d'affaires (le ratio cours / ventes). Sur le graphique, un cours qui monte bien plus vite que les ventes signifie que le marché paie de plus en plus cher chaque unité de chiffre d'affaires ; il anticipe alors des marges futures que les chiffres ne montrent pas encore.

## Résumé

Le chiffre d'affaires mesure la taille de l'activité et, surtout par sa croissance, sa dynamique. Il se lit en variation sur un an, pour écarter la saisonnalité, et en distinguant la croissance propre de celle achetée par acquisition. Il ne prend son sens qu'avec une mesure de rentabilité : la **marge brute** et la **marge nette**, le **bénéfice net** et le **flux de trésorerie disponible**.

## Ce qu'il ne dit pas

Rien de la rentabilité : un chiffre d'affaires en forte hausse avec une marge qui s'effondre décrit une entreprise qui achète sa croissance. Son niveau ne se compare pas d'un secteur à l'autre : un distributeur affiche un chiffre d'affaires énorme pour des marges minces, un éditeur de logiciels l'inverse.

La manière de le compter varie aussi : une place de marché peut enregistrer le montant total des ventes réalisées sur sa plateforme, ou seulement sa commission, selon qu'elle est considérée comme le vendeur ou comme un simple intermédiaire. Et le chiffre brut mêle croissance propre, acquisitions et effets de change.`,

  netMargin: `**La marge nette est la part du chiffre d'affaires qui finit en bénéfice net.** Elle s'exprime en pourcentage : bénéfice net divisé par chiffre d'affaires, multiplié par 100. Une marge nette de 12 % signifie que sur 100 euros de ventes, 12 restent à l'entreprise une fois toutes ses charges, ses intérêts et ses impôts payés.

Elle dit **combien l'entreprise garde de ce qu'elle facture**, ce qu'aucun des deux nombres ne dit seul. Parce que c'est un rapport, elle ne dépend pas de la taille de l'entreprise : elle permet de comparer une petite société à un géant du même secteur, ou une entreprise à elle-même dix ans plus tôt. C'est la mesure la plus synthétique de la rentabilité de l'activité.

## Histoire

L'analyse par ratios s'est développée au début du XXe siècle, chez les banquiers qui évaluaient leurs emprunteurs et chez les dirigeants des grandes entreprises industrielles. La marge nette y tient une place centrale depuis la **formule DuPont**, mise au point dans les années 1910 par **Donaldson Brown** au sein du groupe chimique DuPont : elle décompose la rentabilité des capitaux investis en deux leviers, la marge réalisée sur chaque vente et la rotation des actifs (le chiffre d'affaires produit par chaque unité de capital). Étendue plus tard à la rentabilité des capitaux propres avec un troisième levier, l'endettement, cette décomposition reste un classique de l'analyse financière.

## Les bases

La marge nette se calcule sur une même période, à partir du bénéfice net et du chiffre d'affaires de cette période. Elle est négative quand l'entreprise perd de l'argent.

Le chiffre n'est **pas calculé par le graphique** : il est fourni par l'application, à chaque date de publication, souvent chaque trimestre. Entre deux publications, la dernière valeur connue est reportée sur chaque bougie : la courbe avance **en paliers**. En format automatique, elle s'écrit en pourcentage à une décimale.

En mode **« Variation sur 1 an »**, attention à la lecture : la courbe montre la variation **relative** de la marge, pas un écart en points. Une marge passée de 10 % à 12 % en un an s'affiche à +20 %, et non à +2 points. Une publication dont la marge d'un an plus tôt était nulle ou négative n'a pas de variation.

## Ce qu'il faut rechercher

### Le niveau, comparé au secteur

Elle n'a de sens que comparée : à l'historique de la même entreprise, et aux concurrents du même secteur. Une marge nette de 5 % est excellente dans la grande distribution, qui vit de volumes énormes et de marges minces, et décevante pour un éditeur de logiciels, dont chaque licence supplémentaire ne coûte presque rien à produire.

### Expansion ou érosion

La tendance dit souvent plus que le niveau. Une marge qui s'élargit année après année signale un pouvoir de fixation des prix, des économies d'échelle ou une meilleure maîtrise des coûts. Une marge qui s'érode trahit une concurrence plus vive, des coûts qui montent plus vite que les prix, ou une activité qui se banalise. Ces mouvements se voient souvent dans la marge avant de se voir dans le chiffre d'affaires.

### Marge et chiffre d'affaires ensemble

Les deux se lisent ensemble. Des ventes et une marge qui progressent en même temps décrivent le meilleur des cas : l'entreprise grandit et gagne davantage sur chaque vente. Des ventes en hausse avec une marge en baisse décrivent une croissance achetée. Et **une marge qui s'améliore pendant que le chiffre d'affaires recule** vient le plus souvent de coupes dans les coûts : un effet réel, mais qui a une limite.

### L'écart avec la marge brute

La différence entre la marge brute et la marge nette mesure tout ce qui pèse entre le produit et le résultat final : frais de structure, recherche, dépenses commerciales, intérêts et impôts. Une marge brute stable avec une marge nette qui baisse situe le problème en aval du produit : frais généraux qui dérivent, dette plus coûteuse, fiscalité moins favorable.

## Résumé

La marge nette dit quelle part de chaque vente devient du bénéfice. Elle se compare à l'historique de l'entreprise et à son secteur, jamais d'un secteur à l'autre, et sa tendance compte souvent plus que son niveau. On la lit avec le **chiffre d'affaires** (la croissance est-elle rentable ?), la **marge brute** (où se perd la rentabilité ?) et le **bénéfice net**, dont elle hérite les forces et les faiblesses.

## Ce qu'il ne dit pas

Elle hérite de toutes les fragilités du bénéfice net : un élément exceptionnel ou un changement fiscal la déforme sur un trimestre. Elle dépend aussi du financement : deux entreprises aux activités identiques, l'une très endettée et l'autre non, n'ont pas la même marge nette, à cause des intérêts.

Elle ne dit rien du capital nécessaire pour la dégager : une marge élevée obtenue avec des usines très coûteuses peut rapporter moins, au regard des sommes investies, qu'une marge modeste dans une activité légère. Et elle ne dit rien de la taille : une marge de 30 % sur un petit chiffre d'affaires reste un petit bénéfice.`,

  grossMargin: `**La marge brute est la part du chiffre d'affaires qui reste une fois payé le seul coût de ce qui a été vendu.** Elle s'exprime en pourcentage : chiffre d'affaires moins coût des ventes, divisé par le chiffre d'affaires, multiplié par 100. Elle se mesure avant les frais de structure, la recherche, le commercial, les intérêts et l'impôt.

C'est le premier étage de la rentabilité : l'argent que dégage le produit lui-même, et qui doit ensuite financer tout le reste. C'est aussi la mesure du **pouvoir de fixation des prix** : une marge brute élevée et stable signale une entreprise qui peut facturer bien au-dessus de son coût de revient sans perdre ses clients — grâce à une marque, une technologie ou une position difficile à concurrencer.

## Histoire

Distinguer le coût de production des autres dépenses vient de la comptabilité de coûts (la comptabilité analytique), qui s'est développée avec l'industrialisation au XIXe et au début du XXe siècle, quand les industriels ont voulu connaître le coût de revient de chaque produit pour fixer leurs prix. Dans le commerce, raisonner sur l'écart entre prix d'achat et prix de vente est bien plus ancien encore.

La marge brute n'apparaît pas dans tous les comptes de résultat. Les normes internationales autorisent deux présentations : **par fonction**, courante chez les entreprises américaines, qui isole le coût des ventes et fait donc apparaître la marge brute ; **par nature** (achats, salaires, amortissements…), traditionnelle dans le plan comptable français, qui ne la montre pas directement.

## Les bases

Le coût des ventes regroupe ce qu'il a fallu dépenser pour produire ou acheter ce qui a été vendu : matières premières, main-d'œuvre de production, énergie, et souvent l'amortissement des machines pour un industriel ; le prix d'achat des marchandises pour un distributeur ; l'hébergement et le support pour un éditeur de logiciels. Le détail varie d'une entreprise à l'autre.

Le chiffre n'est **pas calculé par le graphique** : il est fourni par l'application, à chaque date de publication, souvent chaque trimestre. Entre deux publications, la dernière valeur connue est reportée sur chaque bougie : la courbe avance **en paliers**. En format automatique, elle s'écrit en pourcentage à une décimale.

En mode **« Variation sur 1 an »**, la courbe montre la variation **relative** de la marge, pas un écart en points : une marge passée de 40 % à 44 % s'affiche à +10 %, et non à +4 points. Une publication dont la marge d'un an plus tôt était nulle ou négative n'a pas de variation.

## Ce qu'il faut rechercher

### Le niveau, signature du modèle économique

Le niveau de marge brute dit beaucoup du métier. Un éditeur de logiciels dépasse souvent 70 %, parce qu'une copie de plus ne coûte presque rien ; un distributeur ou un industriel de produits courants se situe bien plus bas. La comparaison n'a donc de sens qu'entre entreprises du même secteur, et avec l'historique de l'entreprise elle-même.

### La stabilité, signe d'un pouvoir de prix

Observez la marge brute quand les coûts montent (matières premières, énergie, salaires). Une marge qui tient signale une entreprise capable de répercuter ses hausses de coûts sur ses clients. Une marge qui plonge à chaque hausse des coûts trahit l'inverse : l'entreprise subit ses prix plus qu'elle ne les fixe.

### Une érosion progressive

Une marge brute qui recule lentement, trimestre après trimestre, est souvent un signal précoce : concurrence plus vive, guerre des prix, produits phares qui vieillissent, ou ventes qui glissent vers des produits moins rentables. Elle annonce fréquemment une baisse de la marge nette à venir.

### L'écart avec la marge nette

Elle est **plus stable et plus comparable** que la marge nette, parce qu'elle échappe aux choix de financement et de fiscalité. L'écart entre les deux mesure le poids de la structure : une marge brute élevée avec une marge nette faible signale des frais de recherche, de marketing ou d'administration très lourds. Reste à savoir s'il s'agit d'investissements qui seront amortis par la croissance, ou d'un fardeau durable.

## Résumé

La marge brute mesure ce que rapporte le produit lui-même, avant les frais de l'entreprise. Élevée et stable, elle signale un pouvoir de prix ; en érosion, elle annonce souvent des difficultés avant les autres mesures. Elle se compare à l'historique de l'entreprise et à son secteur, et se lit avec la **marge nette** (ce qui reste au bout du compte), le **chiffre d'affaires** et le **bénéfice net**.

## Ce qu'il ne dit pas

Une marge brute confortable peut coexister avec une perte nette, si la structure de coûts en aval est trop lourde : elle décrit le produit, pas l'entreprise entière.

Sa comparabilité est limitée, même dans un secteur : selon les entreprises, l'amortissement des équipements, la logistique ou les frais d'expédition sont comptés dans le coût des ventes, ou non. Elle n'est pas publiée telle quelle par une entreprise qui présente ses comptes par nature (le chiffre fourni est alors reconstitué, ou absent), et n'a guère de sens pour une banque ou un assureur, qui n'ont pas de coût des ventes au sens habituel.`,

  peRatio: `**Le PER (price earnings ratio, ou ratio cours / bénéfice) est le cours d'une action divisé par le bénéfice par action.** Il répond à une question simple : *combien d'années de bénéfices actuels le marché est-il prêt à payer ?* Un PER de 20 signifie qu'on paie l'action 20 fois ce qu'elle a rapporté sur un an. Le calcul revient au même à l'échelle de l'entreprise : sa valeur en Bourse divisée par son bénéfice net.

C'est le multiple de valorisation le plus utilisé. Son inverse, le **rendement bénéficiaire** (5 % pour un PER de 20), se compare au rendement d'une obligation : c'est ce que rapporterait l'action si le bénéfice restait stable et revenait entièrement à l'actionnaire.

## Histoire

L'idée d'évaluer une affaire en multiple de ses bénéfices est ancienne, mais c'est **Benjamin Graham et David Dodd** qui l'ont installée au cœur de l'analyse financière, dans *Security Analysis* (1934). Ils mettaient en garde contre le fait de payer un multiple d'une seule bonne année, et recommandaient de raisonner sur un bénéfice moyen de plusieurs années pour lisser les cycles. Dans *The Intelligent Investor*, Graham fixe à l'investisseur prudent un plafond de l'ordre de 15 fois le bénéfice moyen des dernières années.

L'économiste **Robert Shiller** a repris cette idée avec son PER corrigé du cycle (le CAPE), calculé sur dix ans de bénéfices corrigés de l'inflation et devenu une mesure classique de la cherté d'un marché entier.

## Les bases

Le numérateur est le cours de l'action, le dénominateur le bénéfice par action. Deux variantes coexistent : le **PER historique**, calculé sur le bénéfice des douze derniers mois publiés, et le **PER prospectif**, calculé sur le bénéfice que les analystes attendent pour les douze mois à venir. Les deux ne se mélangent pas.

Le chiffre n'est **pas calculé par le graphique** : il est fourni par l'application, à chaque date de publication. Entre deux publications, la dernière valeur connue est reportée sur chaque bougie : la courbe avance **en paliers**. C'est une différence importante avec le PER des sites boursiers, qui bouge chaque jour avec le cours : ici, la courbe ne change qu'aux dates fournies, même si le cours a beaucoup varié entre-temps. En format automatique, il s'écrit avec deux décimales.

En mode **« Variation sur 1 an »**, la courbe montre l'évolution du multiple lui-même : +25 % signifie que le marché paie chaque unité de bénéfice 25 % plus cher qu'un an plus tôt. Une publication sans PER positif un an plus tôt n'a pas de variation.

## Ce qu'il faut rechercher

### Le PER face à son propre historique

Il ne se lit que par comparaison, et d'abord à l'historique du titre lui-même. Un PER au plus haut de sa fourchette des dix dernières années signale des attentes élevées, qui laissent peu de place à la déception ; un PER au plus bas peut signaler une décote, ou une dégradation des perspectives que le marché a déjà intégrée.

### Le PER face au secteur

Un PER élevé signale des **attentes de croissance** ; un PER bas, soit une décote, soit des doutes. Les niveaux « normaux » diffèrent fortement d'un secteur à l'autre : une entreprise technologique en forte croissance se paie couramment bien plus cher qu'une banque ou un fournisseur d'électricité. La comparaison n'a de sens qu'entre entreprises comparables.

### Le cours monte : bénéfices ou multiple ?

Le cours est le produit du PER et du bénéfice par action. Quand le cours monte, deux histoires sont possibles. Si le bénéfice par action monte au même rythme, le PER reste stable : la hausse est portée par les résultats. Si c'est le PER qui monte, le marché paie plus cher les mêmes bénéfices : il anticipe une accélération, ou s'emballe. Ajouter le bénéfice par action au graphique permet de faire la part des deux.

### Le PER et la croissance

Un PER élevé ne se justifie que par une croissance future des bénéfices. Pour relier les deux, les investisseurs utilisent le ratio **PEG** (le PER divisé par le taux de croissance attendu du bénéfice), popularisé par **Peter Lynch** : un PEG proche de 1 désigne un prix en ligne avec la croissance, un PEG nettement supérieur une croissance chèrement payée.

## Résumé

Le PER dit combien le marché paie chaque unité de bénéfice. Il se compare à l'historique du titre et à son secteur, jamais dans l'absolu, et se lit toujours avec le **bénéfice par action**, qui dit si la variation du cours vient des résultats ou du multiple. Le **bénéfice net**, la **marge nette** et le **flux de trésorerie disponible** disent si les bénéfices qui servent de base au calcul sont solides.

## Ce qu'il ne dit pas

Quatre pièges classiques :

- **le bénéfice peut être proche de zéro**, et le ratio explose sans que cela signifie quoi que ce soit ;
- **un bénéfice négatif** ne donne pas de PER du tout ;
- un PER bas est souvent bas **pour une raison** — c'est le piège dit de la *value trap* ;
- pour une entreprise **cyclique**, le PER est au plus bas au sommet du cycle, quand les bénéfices sont exceptionnels, et au plus haut au creux : le lire naïvement fait acheter au pire moment.

Il hérite aussi des fragilités du bénéfice net (un élément exceptionnel suffit à le déformer) et ignore la dette : deux entreprises au même PER, l'une sans dette et l'autre lourdement endettée, ne sont pas aussi chères l'une que l'autre.`,

  eps: `**Le bénéfice par action (BPA, en anglais EPS pour *earnings per share*) est le bénéfice net divisé par le nombre d'actions en circulation.** C'est la part du résultat qui revient à une action.

Il ramène le bénéfice de l'entreprise à l'échelle de l'actionnaire : ce que « gagne » chacune de ses actions. C'est la mesure que les analystes prévoient et que le marché sanctionne, et le pont entre les résultats et le cours, puisque le cours est le produit du bénéfice par action et du PER.

## Histoire

Les analystes raisonnent par action depuis longtemps — Graham et Dodd le faisaient déjà dans *Security Analysis* (1934). La publication du bénéfice par action est devenue obligatoire aux États-Unis en 1969 (avis APB n° 15), qui imposait de le faire figurer au compte de résultat. La norme américaine FAS 128 (1997) puis la norme internationale IAS 33 ont fixé la règle actuelle : publier deux chiffres, le **BPA de base** et le **BPA dilué**.

## Les bases

Au numérateur, le bénéfice net qui revient aux actionnaires ordinaires (après les dividendes dus aux actions de préférence, s'il y en a). Au dénominateur, le **nombre moyen** d'actions en circulation sur la période, pas le nombre à la date de clôture : une augmentation de capital en cours d'année ne compte que pour la durée où les nouvelles actions ont existé.

Le **BPA dilué** ajoute au dénominateur les actions qui pourraient être créées : options de souscription des salariés, actions gratuites, obligations convertibles. Il est donc inférieur ou égal au BPA de base, et c'est en général celui que le marché suit. Lequel des deux est tracé dépend de la source des données.

Le chiffre n'est **pas calculé par le graphique** : il est fourni par l'application, à chaque date de publication, souvent chaque trimestre. Entre deux publications, la dernière valeur connue est reportée sur chaque bougie : la courbe avance **en paliers**. En format automatique, il s'écrit en dollars, avec deux décimales. Le mode **« Variation sur 1 an »** trace son taux de croissance par rapport à la publication d'au moins un an plus tôt, ce qui écarte la saisonnalité ; une publication dont la référence était une perte ou un bénéfice nul n'a pas de variation.

## Ce qu'il faut rechercher

### Une progression régulière

Sa **progression** dans le temps est ce qui compte. Un bénéfice par action qui croît régulièrement, année après année, est ce que recherchent la plupart des investisseurs de long terme : sur la durée, le cours finit en général par suivre. Les entreprises qui y parviennent dans tous les contextes sont rares, et le marché les paie cher.

### La publication face au consensus

Avant chaque publication, les analystes publient leurs prévisions ; leur moyenne forme le *consensus*. Un résultat publié au-dessus ou en dessous du consensus déplace souvent le cours bien plus que le chiffre lui-même ne le justifierait. Le graphique ne montre pas le consensus, mais il montre la réaction : regardez les bougies autour de la marche du palier, le jour de la publication.

### Bénéfice par action et bénéfice net

Comparez sa croissance à celle du bénéfice net. S'il progresse plus vite, le nombre d'actions diminue : l'entreprise rachète ses actions. S'il progresse moins vite, le nombre d'actions augmente : l'entreprise émet des actions (augmentation de capital, rémunération des salariés en actions, acquisition payée en titres) et chaque actionnaire voit sa part du bénéfice se diluer.

### Bénéfice par action et cours

Puisque le cours est le produit du bénéfice par action et du PER, superposer les deux courbes montre d'où vient un mouvement du cours. Un cours qui suit le bénéfice par action est porté par les résultats ; un cours qui s'en écarte durablement traduit un changement du PER, donc de l'opinion du marché.

## Résumé

Le bénéfice par action ramène le résultat à l'échelle d'une action ; sa progression régulière est ce que le marché récompense, et l'écart avec le consensus ce qu'il sanctionne le jour de la publication. On le lit avec le **PER** (le prix payé pour ce bénéfice), le **bénéfice net** (la croissance vient-elle de l'activité ou des rachats d'actions ?) et le **flux de trésorerie disponible** (le bénéfice est-il encaissé ?).

## Ce qu'il ne dit pas

Il peut progresser **sans que l'entreprise gagne davantage** : un rachat d'actions réduit le dénominateur, et le bénéfice par action monte mécaniquement. Il hérite aussi de toutes les fragilités du bénéfice net, éléments exceptionnels compris. Beaucoup d'entreprises mettent en avant un bénéfice par action « ajusté », hors éléments qu'elles jugent non récurrents, qui peut différer sensiblement du chiffre comptable.

Son niveau absolu ne se compare pas d'une entreprise à l'autre : il dépend du nombre d'actions, donc d'un choix sans rapport avec la rentabilité. Une division de l'action (une action remplacée par plusieurs) le divise d'autant ; les sources retraitent en général l'historique, mais une marche brutale à cette date mérite vérification.`,

  debtToEquity: `**Le ratio dette / capitaux propres (ou ratio d'endettement, en anglais *debt to equity*) compare ce que l'entreprise doit à ses créanciers à ce qui appartient à ses actionnaires.** Il dit combien l'entreprise a emprunté pour chaque euro de fonds propres : à 1, elle a autant de dette que de capitaux propres ; à 0,5, cinquante centimes de dette par euro de capitaux propres.

C'est une mesure de **levier** et de **fragilité**. La dette amplifie : dans les bonnes années, elle augmente la rentabilité des capitaux propres, parce que l'entreprise investit plus que ce que ses actionnaires ont apporté ; dans les mauvaises, elle amplifie les pertes, et les intérêts restent dus quoi qu'il arrive. Plus le ratio est élevé, plus l'entreprise dépend de ses créanciers, et plus une hausse des taux ou un trou d'air pèse lourd.

## Histoire

Les ratios d'endettement font partie des plus anciens outils de l'analyse de crédit : les banquiers examinaient le bilan de leurs emprunteurs bien avant que l'analyse financière ne devienne une discipline, et l'analyse par ratios s'est structurée au début du XXe siècle autour de ce besoin.

La théorie est venue plus tard. En 1958, **Franco Modigliani et Merton Miller** ont montré que, dans un monde idéal sans impôts ni coûts de faillite, la valeur d'une entreprise ne dépend pas de la répartition de son financement entre dette et capitaux propres. Les travaux qui ont suivi ont réintroduit ce que ce cadre écartait : les intérêts sont déductibles de l'impôt, ce qui favorise la dette, tandis que le risque de faillite en limite l'usage. Le bon niveau d'endettement est un arbitrage entre les deux.

## Les bases

Au numérateur, la dette : le plus souvent les dettes financières, à court et à long terme (emprunts bancaires, obligations), parfois avec les dettes locatives ; certaines sources prennent la totalité des dettes du bilan. Au dénominateur, les capitaux propres comptables. Depuis la norme IFRS 16 (2019), la plupart des contrats de location figurent au bilan comme des dettes, ce qui a relevé le ratio des entreprises qui louent beaucoup (distributeurs, compagnies aériennes…).

C'est une mesure **de bilan** : une photographie à la date de clôture, pas un flux sur la période. Le chiffre n'est **pas calculé par le graphique** : il est fourni par l'application, à chaque date de publication. Entre deux publications, la dernière valeur connue est reportée sur chaque bougie : la courbe avance **en paliers**. En format automatique, il s'écrit avec deux décimales. Certaines sources l'expriment en pourcentage (150 pour une dette égale à 1,5 fois les capitaux propres) : vérifiez l'échelle avant de comparer.

En mode **« Variation sur 1 an »**, la courbe montre la variation relative du ratio par rapport à la publication d'au moins un an plus tôt ; une publication dont la référence était nulle ou négative (capitaux propres négatifs) n'a pas de variation.

## Ce qu'il faut rechercher

### Le niveau, comparé au secteur

Comme toutes les mesures de bilan, il se compare **au secteur** : une entreprise d'infrastructure, un réseau d'électricité ou une foncière vivent normalement avec un endettement qui serait alarmant chez un éditeur de logiciels, parce que leurs revenus sont réguliers et leurs actifs durables. Pour les banques et les assureurs, dont la dette est la matière première, le ratio n'a guère de sens : on les juge sur leurs ratios réglementaires.

### La tendance

Un ratio qui monte se lit selon sa cause : une acquisition financée par emprunt, des rachats d'actions financés par la dette, ou des pertes qui rongent les capitaux propres. Les deux premières sont des choix, la troisième une dégradation. Un ratio qui baisse régulièrement décrit une entreprise qui se désendette, ce qui la rend plus résistante mais peut aussi signaler qu'elle manque de projets où investir.

### La dette face à la capacité de remboursement

Le ratio dit combien l'entreprise doit, pas si elle peut rembourser. Rapprochez-le du **flux de trésorerie disponible** : un endettement élevé couvert par une trésorerie abondante et régulière se supporte bien ; le même endettement avec un flux négatif est fragile, surtout quand les taux montent. Les banquiers complètent d'ailleurs ce ratio par la dette nette rapportée au résultat d'exploitation avant amortissements.

### Des capitaux propres minuscules ou négatifs

Quand les capitaux propres approchent de zéro, le ratio s'envole ; quand ils deviennent négatifs, il change de signe et perd son sens. Cela arrive après des pertes lourdes, mais aussi chez des entreprises très rentables qui ont racheté massivement leurs propres actions : un ratio extrême n'est donc pas toujours un signe de détresse, et se juge alors avec le flux de trésorerie et le bénéfice.

## Résumé

Le ratio dette / capitaux propres mesure le levier financier : l'ampleur de la dette au regard de ce qui appartient aux actionnaires. Il se compare au secteur et à l'historique de l'entreprise, et se lit avec sa cause. On le rapproche du **flux de trésorerie disponible** (capacité à rembourser), du **bénéfice net** (la dette dope-t-elle la rentabilité ou creuse-t-elle les pertes ?) et de la **marge nette**, qui porte le poids des intérêts.

## Ce qu'il ne dit pas

La dette n'est pas mauvaise en soi : empruntée à taux bas pour financer un investissement rentable, elle crée de la valeur. Le ratio dit **l'ampleur**, jamais la qualité : il ne montre ni l'échéance de la dette, ni son taux, ni sa devise, ni les engagements hors bilan.

Il ignore la trésorerie : une entreprise qui a beaucoup de dette mais encore plus de liquidités est moins endettée qu'il n'y paraît, d'où l'usage de la dette nette. Les capitaux propres sont une valeur comptable, souvent très éloignée de la valeur de marché, qui ignore une bonne part des actifs immatériels et baisse à chaque dépréciation. Enfin, la définition de la dette varie d'une source à l'autre.`,
};
