/** The script editor's own exhaustive reference — every API surface the sandbox exposes, its
 *  exact signature and semantics, and worked examples. Kept as plain data (not JSX) so
 *  `ScriptDocumentationModal.tsx` stays a thin renderer and this content can grow without ever
 *  threatening either file's own 1000-line cap. Written to double as this feature's own source of
 *  truth: every entry here should match its real implementation (`buildScriptApi.ts`/
 *  `buildPlotApi.ts`/`buildStateApi.ts`/`buildAlertApi.ts`/`buildBarApi.ts`/`mathLib.ts`/
 *  `taLib.ts`) exactly — if one of those changes, this should too. */
export interface ScriptReferenceBlock {
  kind: "text" | "code" | "list" | "heading" | "diagram";
  text?: string;
  items?: string[];
  code?: string;
  /** Only for `kind: "diagram"` — a key into `SCRIPT_DIAGRAM_REGISTRY` (`scriptDiagramRegistry.ts`),
   *  resolved to a real component only at render time. Kept as a plain string here (not a JSX
   *  reference) so this file stays plain data — see its own top-of-file doc on why. */
  diagramKey?: string;
}
export interface ScriptReferenceSection {
  id: string;
  title: string;
  blocks: ScriptReferenceBlock[];
}

function t(text: string): ScriptReferenceBlock {
  return { kind: "text", text };
}
function c(code: string): ScriptReferenceBlock {
  return { kind: "code", code };
}
function l(items: string[]): ScriptReferenceBlock {
  return { kind: "list", items };
}
// A sub-heading *within* a section — the "Exemples" section is the one place this reference has
// several distinct, self-contained worked scripts under one roof, and a plain run of paragraphs
// would make it hard to tell where one ends and the next begins. Doesn't create a new scroll-spy
// nav entry of its own (ScriptDocumentationModal.tsx tracks sections, not blocks) — purely visual
// structure inside a section that's already long enough to need it.
function d(diagramKey: string): ScriptReferenceBlock {
  return { kind: "diagram", diagramKey };
}
function h(text: string): ScriptReferenceBlock {
  return { kind: "heading", text };
}

export const SCRIPT_API_REFERENCE: ScriptReferenceSection[] = [
  {
    id: "overview",
    title: "Vue d'ensemble",
    blocks: [
      t(
        "Un script est un programme JavaScript qui s'exécute une fois par bougie, du début à la fin de l'historique visible, exactement comme un indicateur intégré (RSI, MACD…) — sauf que vous en écrivez la logique vous-même. Il peut lire le prix et les indicateurs déjà présents sur la chart, dessiner ses propres courbes/signaux, mémoriser un état d'une bougie à l'autre, et déclencher des alertes."
      ),
      d("replay"),
      t(
        "Concrètement, le moteur rejoue tout l'historique visible bougie par bougie, de la plus ancienne à la plus récente : à chaque étape, il ré-exécute votre code en entier avec « la bougie courante » pointée sur cette bougie-là, un peu comme si vous relisiez un journal jour par jour plutôt que de lire directement la dernière page. C'est ce rejeu, pas un calcul global sur tout le tableau d'un coup, qui garantit qu'un script ne peut jamais accidentellement regarder une bougie plus loin que celle en cours."
      ),
      t("Trois garanties structurelles, valables quel que soit le script écrit :"),
      l([
        "Aucune fuite de données futures — à la bougie i, aucune fonction de l'API ne peut jamais retourner une valeur d'une bougie postérieure à i. Ce n'est pas une vérification a posteriori : c'est structurellement impossible, les fonctions n'ont tout simplement pas accès aux données futures.",
        "Synchronisation garantie — market.close(0), chart.indicator(\"rsi_14\").value(0) et n'importe quel autre accès à \"la bougie courante\" pointent toujours exactement sur la même bougie, quel que soit l'ordre des appels.",
        "Bac à sable isolé — le script s'exécute dans un Web Worker séparé, sans accès réseau (fetch, XMLHttpRequest, WebSocket…), sans accès au stockage du navigateur (indexedDB, caches), et sans aucun moyen d'atteindre le code ou les données internes de l'application hôte.",
      ]),
      t(
        "Une fois enregistré, un script se ré-exécute automatiquement à chaque nouvelle bougie (rejeu complet, avec un court délai anti-rafale) — pas besoin de cliquer sur « Exécuter » à chaque tick d'un marché en direct."
      ),
      t(
        "Chaque script activé tourne dans son propre Web Worker, indépendamment des autres : un script en erreur ou lent n'affecte ni les autres scripts actifs, ni le rendu de la chart elle-même. Sur un espace de travail à plusieurs graphiques, un script choisit une seule chart cible (voir « Cible » dans la barre d'outils) — il ne lit et n'affecte jamais que celle-là, jamais les autres panneaux ouverts en même temps."
      ),
    ],
  },
  {
    id: "editor",
    title: "L'éditeur : Exécuter / Arrêter / Enregistrer / Réinitialiser / Format",
    blocks: [
      t(
        "Le code affiché dans l'éditeur est un brouillon, distinct du code réellement enregistré sur le script tant que vous n'avez pas cliqué sur « Enregistrer »."
      ),
      l([
        "Exécuter — lance le brouillon actuel tel quel, même non enregistré. C'est ce qui permet de tester une modification avant de la valider.",
        "Arrêter — interrompt immédiatement une exécution en cours (utile en cas de boucle infinie) en terminant le Worker sous-jacent, plutôt que d'attendre qu'il se termine de lui-même.",
        "Enregistrer — valide le brouillon comme code officiel du script (répercuté vers l'application hôte).",
        "Réinitialiser — abandonne le brouillon et revient au dernier code enregistré.",
        "Format — ré-indente légèrement le code (pas une mise en forme complète à la Prettier).",
      ]),
      t(
        "Si l'exécution dépasse un certain délai (8 secondes pour un rejeu complet, 1,5 seconde pour une simple ré-évaluation en direct), elle est automatiquement interrompue et une erreur de délai dépassé s'affiche — c'est le filet de sécurité contre une boucle infinie qu'un script maladroit pourrait contenir."
      ),
      t("Toute erreur (de syntaxe ou d'exécution) s'affiche sous l'éditeur avec son message et, quand le moteur JavaScript le permet, le numéro de ligne exact."),
    ],
  },
  {
    id: "tutorial",
    title: "Tutoriel — créer un indicateur de A à Z",
    blocks: [
      t(
        "Ce tutoriel construit un indicateur complet, de zéro, en une dizaine de lignes — pas à pas, comme si quelqu'un l'expliquait à côté de vous. Chaque étape ajoute une ou deux lignes au script précédent : copiez-collez le code dans l'éditeur, cliquez sur « Exécuter », regardez ce qui apparaît sur la chart, puis passez à l'étape suivante. Chaque fonction utilisée ici est réexpliquée en détail, avec son propre schéma, dans sa section dédiée plus bas — ce tutoriel est le fil conducteur, pas la référence exhaustive."
      ),

      h("Étape 1 — Ouvrir l'éditeur et créer un script"),
      t(
        "Cliquez sur l'icône « </> » (dans la colonne de droite de l'espace de travail), puis sur le « + » de la barre d'onglets pour créer un nouveau script vide. Un onglet « Script 1 » apparaît, avec un petit code par défaut déjà présent dans l'éditeur — sélectionnez-le tout (Ctrl+A) et remplacez-le par le code de l'étape suivante."
      ),

      h("Étape 2 — Le tout premier tracé"),
      t(
        "Avant même de parler de prix ou d'indicateur, vérifions que le circuit complet fonctionne : écrire du code, l'exécuter, voir un résultat. plot.line trace une courbe — ici une droite plate à la valeur 1, juste pour voir apparaître quelque chose :"
      ),
      c(`plot.line("Test", 1);`),
      t("Cliquez sur « Exécuter ». Un nouveau panneau apparaît sous la chart, avec une ligne plate nommée « Test ». C'est exactement ce que fait plot.line : ouvrir (ou mettre à jour) un panneau dédié, une valeur par bougie."),
      d("plotOwnPane"),

      h("Étape 3 — Remplacer la valeur fixe par un vrai prix"),
      t(
        "1, c'était pour tester — un indicateur digne de ce nom lit le prix réel. market.close(0) retourne le cours de clôture de la bougie courante (le 0 entre parenthèses veut dire « la bougie en cours », voir market.* plus bas pour le détail) :"
      ),
      c(`plot.line("Clôture", market.close(0));`),
      t("Exécutez à nouveau : la ligne plate est remplacée par une courbe qui suit fidèlement le prix de clôture, bougie après bougie — le script vient de rejouer tout l'historique visible, une bougie à la fois."),

      h("Étape 4 — Calculer une moyenne mobile"),
      t(
        "market.series(\"close\", 20) retourne un tableau des 20 dernières clôtures ; math.sma en fait la moyenne mobile simple. Passons aussi en plot.overlay plutôt que plot.line : une moyenne mobile est un prix, elle a donc du sens directement superposée aux bougies plutôt que dans son propre panneau."
      ),
      c(
        `const closes = market.series("close", 20);
const sma20 = math.sma(closes, 20);
plot.overlay("SMA 20", sma20 ?? market.close(0));`
      ),
      t(
        "(sma20 ?? market.close(0) : les 19 toutes premières bougies de l'historique n'ont pas encore 20 clôtures disponibles derrière elles, math.sma renvoie alors null plutôt qu'une valeur fausse — le ?? affiche le prix courant à la place le temps que la moyenne ait assez de recul, plutôt que de laisser un trou dans la courbe.)"
      ),
      d("plotOverlay"),

      h("Étape 5 — Une seconde moyenne, plus rapide"),
      t("Un indicateur à une seule moyenne ne dit pas grand-chose ; ajoutons-en une seconde, plus courte, donc plus réactive — le principe même d'un croisement de moyennes mobiles :"),
      c(
        `const closes = market.series("close", 20);
const sma20 = math.sma(closes, 20);
const sma5 = math.sma(market.series("close", 5), 5);

plot.overlay("SMA 20", sma20 ?? market.close(0));
plot.overlay("SMA 5", sma5 ?? market.close(0));`
      ),
      t("Deux courbes se superposent maintenant au prix. Le signal qui nous intéresse : le moment précis où la courte (SMA 5) croise la longue (SMA 20)."),

      h("Étape 6 — Se souvenir de la bougie précédente"),
      t(
        "Détecter un croisement demande de comparer « où en étaient les deux moyennes à l'instant précédent » à « où elles en sont maintenant » — hors, un script ne voit qu'une bougie à la fois. state.get/state.set servent exactement à ça : faire porter une valeur d'une bougie à la suivante."
      ),
      d("stateMemory"),
      c(
        `const sma20 = math.sma(market.series("close", 20), 20);
const sma5 = math.sma(market.series("close", 5), 5);
const prevSma20 = state.get("prevSma20", null);
const prevSma5 = state.get("prevSma5", null);

plot.overlay("SMA 20", sma20 ?? market.close(0));
plot.overlay("SMA 5", sma5 ?? market.close(0));

state.set("prevSma20", sma20);
state.set("prevSma5", sma5);`
      ),
      t(
        "state.get(\"prevSma20\", null) lit la valeur mémorisée à la bougie précédente (null si elle n'a encore jamais été définie — la toute première bougie du rejeu). state.set écrit la valeur actuelle pour que la bougie *suivante* puisse à son tour la lire comme « prevSma20 »."
      ),

      h("Étape 7 — Détecter le croisement et signaler"),
      t(
        "Tout est en place pour comparer avant/après et agir au bon moment. bar.isNew() garantit qu'on ne déclenche le signal qu'une seule fois — sur la toute dernière bougie du rejeu — plutôt qu'à chaque relecture de tout l'historique (voir bar.* plus bas)."
      ),
      c(
        `const sma20 = math.sma(market.series("close", 20), 20);
const sma5 = math.sma(market.series("close", 5), 5);
const prevSma20 = state.get("prevSma20", null);
const prevSma5 = state.get("prevSma5", null);

plot.overlay("SMA 20", sma20 ?? market.close(0));
plot.overlay("SMA 5", sma5 ?? market.close(0));

if (bar.isNew() && prevSma5 !== null && prevSma20 !== null && sma5 !== null && sma20 !== null) {
  if (prevSma5 <= prevSma20 && sma5 > sma20) {
    plot.signal({ type: "BUY", text: "BUY" });
    alert("Croisement haussier : SMA 5 dépasse SMA 20");
  }
  if (prevSma5 >= prevSma20 && sma5 < sma20) {
    plot.signal({ type: "SELL", text: "SELL" });
    alert("Croisement baissier : SMA 5 repasse sous SMA 20");
  }
}

state.set("prevSma20", sma20);
state.set("prevSma5", sma5);`
      ),
      d("plotSignal"),
      t(
        "Exécutez : une flèche verte apparaît à chaque croisement haussier, une flèche rouge à chaque croisement baissier, chacune avec son propre mot affiché juste à côté (text: \"BUY\"/\"SELL\" — voir « Ajouter du texte à côté d'un marqueur » dans la section plot.* plus bas pour le détail), et une alerte est enregistrée à chaque fois — c'est un indicateur complet, fonctionnel, écrit en une dizaine de lignes."
      ),

      h("Étape 8 — Enregistrer le script"),
      t(
        "Ctrl+S (ou le bouton « Enregistrer ») sauvegarde le code. La toute première fois, ça demande un nom (Script 1, ça manque un peu de panache — appelez-le « Croisement SMA » par exemple) ; les fois suivantes, Ctrl+S enregistre directement sans redemander. « Enregistrer sous » permet de renommer/dupliquer à tout moment. Une fois enregistré, le script apparaît automatiquement dans le sélecteur d'indicateurs, sous « Mes scripts » — comme n'importe quel RSI ou MACD intégré."
      ),

      h("Étape 9 — Pour aller plus loin"),
      l([
        "chart.indicator(id) permet de lire un indicateur déjà présent sur la chart (un RSI, un MACD…) plutôt que de tout recalculer soi-même — voir chart.* plus bas.",
        "ta.* calcule des indicateurs techniques usuels (RSI, MACD, Bollinger, stochastique…) à la demande, sans avoir à les ajouter visuellement à la chart — voir ta.* plus bas.",
        "La section « Exemples » plus bas contient six scripts complets prêts à copier, chacun dans un style différent (score composite, rupture de bande, détecteur de volume…).",
        "Chaque section qui suit détaille exhaustivement une famille de fonctions (market.*, chart.*, plot.*, state.*, bar.*, math.*, ta.*) — c'est la référence complète, à consulter au fur et à mesure des besoins plutôt qu'à lire d'un bloc.",
      ]),
    ],
  },
  {
    id: "market",
    title: "market.* — données de marché (OHLCV)",
    blocks: [
      t(
        "Chaque fonction accepte un décalage optionnel « offset », en nombre de bougies en arrière depuis la bougie courante : 0 (par défaut) = la bougie courante, 1 = la précédente, 2 = l'avant-précédente, etc. Un décalage négatif, ou qui pointerait vers le futur, retourne toujours null plutôt que de lever une erreur."
      ),
      d("marketOffset"),
      c(
        `market.open(offset?)    // number | null — cours d'ouverture
market.high(offset?)    // number | null — plus haut
market.low(offset?)     // number | null — plus bas
market.close(offset?)   // number | null — cours de clôture
market.volume(offset?)  // number | null — volume
market.time(offset?)    // Date | null — horodatage de la bougie`
      ),
      t("market.series(field, count?) retourne un tableau des count dernières valeurs (par défaut jusqu'à 5000), du plus ancien au plus récent, pratique pour l'utiliser avec math.* ou ta.* :"),
      c(
        `const closes = market.series("close", 20); // les 20 dernières clôtures
const sma20 = math.sma(closes, 20);`
      ),
      t("market.availableTimeframes() retourne la liste des intervalles proposés par la chart hôte (ex. [\"1m\",\"5m\",\"1h\",\"1d\"]) — à titre indicatif uniquement, un script ne peut pas lire les données d'un autre intervalle que celui actuellement affiché."),
    ],
  },
  {
    id: "chart",
    title: "chart.* — indicateurs déjà présents sur la chart",
    blocks: [
      t(
        "chart.indicator(id) retourne un objet permettant de lire les valeurs d'un indicateur déjà ajouté à la chart (RSI, MACD, Bollinger…), à n'importe quelle bougie passée. L'identifiant n'est pas l'id interne de l'indicateur (qui change à chaque session) mais un identifiant stable dérivé de son type et de ses réglages, par exemple \"rsi_14\" ou \"macd_12_26_9\". Le panneau « Indicateurs disponibles » de l'éditeur liste les identifiants réels de la chart en cours — cliquer dessus copie chart.indicator(\"...\") dans le presse-papiers."
      ),
      d("chartIndicator"),
      t("chart.listIndicators() retourne la liste de tous les identifiants disponibles (string[])."),
      t("Un identifiant introuvable ne fait jamais planter le script — il retourne un objet dont toutes les méthodes renvoient null."),
      t("L'objet retourné expose toutes les méthodes suivantes ; seules celles correspondant à la forme réelle de l'indicateur renvoient une valeur, les autres renvoient null :"),
      c(
        `const rsi = chart.indicator("rsi_14");
rsi.value(0);       // number | null — lecture "simple" (RSI, CHOP, une bande à son point milieu…)

const macd = chart.indicator("macd_12_26_9");
macd.line(0);        // number | null — ligne MACD
macd.signal(0);       // number | null — ligne de signal
macd.histogram(0);    // number | null — histogramme

const bb = chart.indicator("bollinger_20");
bb.upper(0);   // number | null
bb.middle(0);  // number | null
bb.lower(0);   // number | null

const adx = chart.indicator("adx_14");
adx.adx(0);      // number | null
adx.plusDI(0);   // number | null
adx.minusDI(0);  // number | null`
      ),
      t("Exemple — détecter un croisement RSI au-dessus de 50, à la bougie courante uniquement :"),
      c(
        `const rsi = chart.indicator("rsi_14");
const now = rsi.value(0);
const prev = rsi.value(1);
if (now !== null && prev !== null && prev <= 50 && now > 50) {
  alert("RSI a croisé 50 à la hausse");
}`
      ),
    ],
  },
  {
    id: "plot",
    title: "plot.* — dessiner sur la chart",
    blocks: [
      t(
        "C'est la fonction que vous utiliserez le plus souvent : plot.* est ce qui fait réellement apparaître quelque chose sur la chart — sans un appel à plot.* quelque part, un script peut calculer tout ce qu'il veut en coulisses, rien ne s'affichera jamais. Il existe deux familles bien distinctes : les séries continues (une courbe qui grandit bougie après bougie) et les marqueurs ponctuels (un seul symbole posé sur une bougie précise)."
      ),
      h("Les séries continues — line / area / histogram / overlay / panel"),
      t("Les cinq premières fonctions tracent une série continue (un point ajouté à chaque bougie traitée) ; appeler plusieurs fois la même série avec le même nom sur des bougies différentes prolonge la même courbe, pas une nouvelle à chaque fois."),
      c(
        `plot.line(name, value, options?)       // courbe, panneau dédié
plot.area(name, value, options?)       // aire remplie, panneau dédié
plot.histogram(name, value, options?)  // histogramme, panneau dédié
plot.overlay(name, value, options?)    // courbe superposée au prix (panneau principal)
plot.panel(name, value, options?)      // identique à line — alias

// options: { color?: string }`
      ),
      t(
        "line/area/histogram/panel ouvrent tous les quatre un nouveau panneau à part, sous le prix (exactement comme RSI ou MACD) — le bon choix pour une valeur qui n'est pas sur la même échelle que le prix (un score de 0 à 3, un pourcentage, un oscillateur…)."
      ),
      d("plotOwnPane"),
      t("overlay, à l'inverse, dessine directement par-dessus les bougies, dans le panneau principal — réservé à une valeur qui *est* un prix (une moyenne mobile, une bande, un niveau) et qui a donc du sens sur la même échelle."),
      d("plotOverlay"),
      h("Les marqueurs ponctuels — signal / point / horizontal / vertical"),
      t("Les quatre suivantes posent un marqueur ponctuel sur la bougie courante — un appel = un marqueur, jamais une série continue :"),
      c(
        `plot.signal("BUY" | "SELL")                       // marqueur flèche haut/bas au prix de clôture
plot.signal({ type?, price?, color?, shape?, text? }) // forme complète — price par défaut = clôture courante
plot.point(value, { color?, shape?, text? })          // marqueur libre à un prix donné
plot.horizontal(price, { color? })                    // ligne horizontale ponctuelle
plot.vertical({ color? })                             // ligne verticale sur la bougie courante`
      ),
      d("plotSignal"),
      t("shape accepte l'un de : \"arrowUp\", \"arrowDown\", \"pin\", \"flagMark\", \"priceLabel\"."),
      t("color accepte n'importe quelle couleur CSS valide — un code hexadécimal (\"#e8391c\"), un nom (\"red\"), ou rgb(...)/rgba(...). Omis, chaque série reçoit une couleur par défaut choisie automatiquement."),
      h('Ajouter du texte à côté d\'un marqueur (« BUY », « SELL »…)'),
      t(
        "plot.signal(\"BUY\") tout seul choisit uniquement la *forme* du marqueur (une flèche vers le haut) — ça ne fait apparaître aucun mot sur la chart. Pour afficher un vrai texte (« BUY », « SELL », ou n'importe quelle légende) à côté du marqueur, passez la forme complète avec le champ text :"
      ),
      c(
        `if (bar.isNew() && score === 3) {
  plot.signal({ type: "BUY", text: "BUY" });
}`
      ),
      t(
        "type: \"BUY\" choisit la forme (flèche vers le haut, couleur haussière par défaut) ; text: \"BUY\" est ce qui affiche réellement le mot à côté. Les deux sont indépendants — vous pouvez très bien avoir une flèche « BUY » avec le texte « Entrée forte », ou l'inverse. text fonctionne exactement pareil avec plot.point :"
      ),
      c(`plot.point(market.close(0), { color: "#3ea377", text: "Rupture" });`),
      t(
        "Le texte hérite du même style que celui d'une ligne dessinée à la main (taille, position, couleur de fond…) — rien à configurer côté script, il utilise simplement les réglages par défaut de la bibliothèque."
      ),
      t("Une fois enregistré, le script apparaît automatiquement dans les indicateurs actifs de la chart (section « Mes scripts ») — pas besoin de le rajouter manuellement via le sélecteur d'indicateurs."),
    ],
  },
  {
    id: "state",
    title: "state.* — mémoire entre les bougies",
    blocks: [
      t(
        "Un script s'exécute une bougie à la fois, dans l'ordre — state.get/state.set permettent de faire persister une valeur d'une bougie à la suivante à l'intérieur d'une même exécution (un compteur, un accumulateur, un dernier prix remarquable…)."
      ),
      d("stateMemory"),
      c(
        `const count = state.get("count", 0); // 0 si jamais défini
state.set("count", count + 1);`
      ),
      t(
        "Important : cette mémoire est réinitialisée à zéro à chaque nouvelle exécution complète (clic sur « Exécuter », ou modification du code), pas seulement à chaque tick temps réel — un script modifié repart toujours d'un état vierge plutôt que de traîner l'état d'une version précédente."
      ),
    ],
  },
  {
    id: "alert",
    title: "alert(message)",
    blocks: [
      t("Déclenche une alerte horodatée sur la bougie courante — l'application hôte décide ensuite comment la présenter (notification, son, liste…), le script se contente de la signaler."),
      c(
        `if (bar.isNew() && rsi.value(0) > 70) {
  alert("RSI en zone de surachat");
}`
      ),
      t("Conseil : sans condition sur bar.isNew(), une alerte se redéclenche à chaque bougie du rejeu complet tant que la condition reste vraie (potentiellement des dizaines de fois) — voir bar.* ci-dessous."),
    ],
  },
  {
    id: "bar",
    title: "bar.* — état de la bougie courante",
    blocks: [
      c(
        `bar.isNew()       // true uniquement pour la toute dernière bougie de cette exécution
bar.isClosed()    // false uniquement si c'est la dernière bougie ET qu'elle est encore en formation
bar.isRealtime()  // true uniquement si cette exécution est un tick temps réel (pas un rejeu manuel)`
      ),
      d("barIsNew"),
      t(
        "bar.isNew() est ce qui permet de n'exécuter une action (alert, un log…) qu'une seule fois par bougie plutôt qu'à chaque relecture de l'historique complet — voir l'exemple ci-dessus."
      ),
    ],
  },
  {
    id: "math",
    title: "math.* — statistiques génériques",
    blocks: [
      t("Chaque fonction prend un tableau de nombres (typiquement issu de market.series) et retourne un résumé statistique. Retourne toujours null (jamais NaN, jamais d'exception) quand le calcul n'a pas de sens (tableau vide, période trop grande…)."),
      c(
        `math.sma(values, period)   // number | null — moyenne mobile simple des \`period\` dernières valeurs
math.ema(values, period)   // number | null — moyenne mobile exponentielle
math.std(values)           // number | null — écart-type
math.variance(values)      // number | null
math.mean(values)          // number | null
math.median(values)        // number | null
math.percentile(values, p) // number | null — p entre 0 et 100
math.zscore(values)        // number | null — écart de la dernière valeur en écarts-types
math.correlation(a, b)     // number | null — coefficient entre -1 et 1
math.covariance(a, b)      // number | null
math.min(values)           // number | null
math.max(values)           // number | null
math.abs(x)                // number
math.sqrt(x)                // number
math.pow(x, y)              // number
math.exp(x)                  // number
math.log(x)                  // number`
      ),
    ],
  },
  {
    id: "ta",
    title: "ta.* — indicateurs techniques à la demande",
    blocks: [
      t(
        "Calcule un indicateur technique « à la volée », sans avoir besoin de l'ajouter visuellement à la chart — utile pour composer plusieurs indicateurs dans un score sans encombrer la chart de panneaux supplémentaires. Retourne toujours la dernière valeur calculable (\"la lecture actuelle\"), jamais un tableau."
      ),
      c(
        `ta.sma(values, period)                              // number | null
ta.ema(values, period)                              // number | null
ta.rsi(values, period)                              // number | null
ta.roc(values, period)                              // number | null
ta.atr(high, low, close, period)                    // number | null
ta.macd(values, fastPeriod?, slowPeriod?, signalPeriod?)
  // { macd, signal, histogram } | null — défauts 12/26/9
ta.bollinger(values, period?, stdDev?)
  // { upper, middle, lower } | null — défauts 20/2
ta.stochastic(high, low, close, period?, signalPeriod?)
  // { k, d } | null — défauts 14/3
ta.adx(high, low, close, period?)
  // { adx, plusDI, minusDI } | null — défaut 14`
      ),
      t("Exemple — RSI(14) calculé sur les 60 dernières clôtures, sans jamais avoir ajouté de RSI à la chart :"),
      c(`const rsi14 = ta.rsi(market.series("close", 60), 14);`),
    ],
  },
  {
    id: "console",
    title: "console.log",
    blocks: [
      t("console.log(...) fonctionne normalement et s'affiche dans la console de l'éditeur, sous le graphique — pratique pour déboguer un script pendant son écriture. Les autres méthodes de console ne sont pas capturées."),
    ],
  },
  {
    id: "security",
    title: "Sécurité et limites",
    blocks: [
      l([
        "Aucun accès réseau — fetch, XMLHttpRequest, WebSocket, importScripts et navigator.sendBeacon sont bloqués et lèvent une erreur explicite si un script tente de les appeler.",
        "Aucun accès au stockage du navigateur — indexedDB et l'API Cache sont bloqués de la même façon.",
        "Aucun sous-Worker — un script ne peut pas créer son propre Worker (ce qui aurait été un moyen de contourner les restrictions ci-dessus).",
        "Aucun accès aux variables ou au code de l'application hôte — le script ne reçoit que les API documentées ici, rien d'autre.",
        "Délai d'exécution — 8 secondes pour un rejeu complet, 1,5 seconde pour un tick temps réel ; au-delà, l'exécution est interrompue de force.",
        "market.series() est plafonné à 5000 points, quelle que soit la longueur demandée.",
      ]),
      t("Math, Date, JSON, Array, Map et Set restent pleinement utilisables — ce sont des briques de calcul pures, sans risque."),
    ],
  },
  {
    id: "examples",
    title: "Exemples — indicateurs prêts à l'emploi",
    blocks: [
      t(
        "Six scripts complets, copiables tels quels, chacun illustrant une combinaison différente de l'API ci-dessus — d'un simple croisement de moyennes mobiles à un score composite multi-indicateurs."
      ),

      h("Quant Score — RSI + MACD + moyenne mobile"),
      t("Combine RSI, MACD et une moyenne mobile en un score de 0 à 3, tracé dans son propre panneau, avec un signal d'achat quand les trois conditions sont réunies :"),
      c(
        `const rsi = chart.indicator("rsi_14").value(0);
const macdHist = chart.indicator("macd_12_26_9").histogram(0);
const price = market.close(0);
const sma20 = math.sma(market.series("close", 20), 20);

let score = 0;
if (rsi !== null && rsi > 50) score += 1;
if (macdHist !== null && macdHist > 0) score += 1;
if (sma20 !== null && price > sma20) score += 1;

plot.line("Quant Score", score);
plot.overlay("SMA 20", sma20 ?? price);

if (bar.isNew() && score === 3) {
  plot.signal("BUY");
  alert("Quant Score au maximum (3/3)");
}`
      ),

      h("Croisement de moyennes mobiles (Golden / Death Cross)"),
      t(
        "SMA 50 et SMA 200 tracées en superposition, avec un signal et une alerte au moment exact où la courte croise la longue — la valeur précédente de chaque moyenne est mémorisée via state.* pour détecter le croisement, pas recalculée à côté."
      ),
      c(
        `const shortMA = math.sma(market.series("close", 50), 50);
const longMA = math.sma(market.series("close", 200), 200);
const prevShort = state.get("prevShort", null);
const prevLong = state.get("prevLong", null);

plot.overlay("SMA 50", shortMA ?? market.close(0));
plot.overlay("SMA 200", longMA ?? market.close(0));

if (bar.isNew() && prevShort !== null && prevLong !== null && shortMA !== null && longMA !== null) {
  if (prevShort <= prevLong && shortMA > longMA) {
    plot.signal("BUY");
    alert("Golden Cross : SMA 50 croise SMA 200 à la hausse");
  }
  if (prevShort >= prevLong && shortMA < longMA) {
    plot.signal("SELL");
    alert("Death Cross : SMA 50 croise SMA 200 à la baisse");
  }
}

state.set("prevShort", shortMA);
state.set("prevLong", longMA);`
      ),

      h("Rupture des bandes de Bollinger"),
      t("Bandes tracées en superposition ; signal quand le prix clôture au-delà de l'une des deux bandes :"),
      c(
        `const bb = ta.bollinger(market.series("close", 60), 20, 2);
const price = market.close(0);

if (bb) {
  plot.overlay("BB Haute", bb.upper);
  plot.overlay("BB Basse", bb.lower);

  if (bar.isNew() && price > bb.upper) {
    plot.signal("SELL");
    alert("Prix au-dessus de la bande de Bollinger supérieure");
  }
  if (bar.isNew() && price < bb.lower) {
    plot.signal("BUY");
    alert("Prix en dessous de la bande de Bollinger inférieure");
  }
}`
      ),

      h("Détecteur de pic de volume"),
      t("Marque la bougie courante quand son volume dépasse la moyenne + 2 écarts-types des 20 dernières bougies :"),
      c(
        `const volumes = market.series("volume", 20);
const avgVolume = math.mean(volumes);
const stdVolume = math.std(volumes);
const currentVolume = market.volume(0);

if (bar.isNew() && avgVolume !== null && stdVolume !== null && currentVolume !== null) {
  if (currentVolume > avgVolume + 2 * stdVolume) {
    plot.point(market.close(0), { color: "#e8391c", shape: "pin" });
    alert("Pic de volume détecté (> moyenne + 2 écarts-types)");
  }
}`
      ),

      h("Score de momentum (RSI + Stochastique)"),
      t("Une deuxième variante de score composite, indépendante du Quant Score ci-dessus — combine RSI et l'oscillateur stochastique plutôt que MACD :"),
      c(
        `const closes = market.series("close", 60);
const highs = market.series("high", 60);
const lows = market.series("low", 60);

const rsi = ta.rsi(closes, 14);
const stoch = ta.stochastic(highs, lows, closes, 14, 3);

let score = 0;
if (rsi !== null && rsi > 55) score += 1;
if (stoch !== null && stoch.k > stoch.d) score += 1;
if (stoch !== null && stoch.k < 80) score += 1; // évite la zone de surachat extrême

plot.line("Momentum Score", score);

if (bar.isNew() && score === 3) {
  alert("Score de momentum au maximum (3/3)");
}`
      ),

      h("Canal de rupture (plus haut / plus bas sur 20 bougies)"),
      t("Un canal de type Donchian — plus haut et plus bas glissants — avec un signal quand le prix clôture hors du canal :"),
      c(
        `const period = 20;
const upperChannel = math.max(market.series("high", period));
const lowerChannel = math.min(market.series("low", period));
const price = market.close(0);

plot.overlay("Canal haut", upperChannel ?? price);
plot.overlay("Canal bas", lowerChannel ?? price);

if (bar.isNew() && upperChannel !== null && price >= upperChannel) {
  plot.signal("BUY");
  alert("Rupture du canal des " + period + " dernières bougies (plus haut)");
}
if (bar.isNew() && lowerChannel !== null && price <= lowerChannel) {
  plot.signal("SELL");
  alert("Rupture du canal des " + period + " dernières bougies (plus bas)");
}`
      ),
    ],
  },
];
