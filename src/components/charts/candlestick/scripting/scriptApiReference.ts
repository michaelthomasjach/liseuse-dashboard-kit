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
  /** Only for `kind: "heading"` — which `SCRIPT_API_COMPLETIONS` labels (`scriptApiCompletions.ts`)
   *  this specific heading is the primary explanation for, e.g. `["plot.band", "plot.bandOverlay"]`
   *  on the "Remplir entre deux courbes" heading. Read by `scriptDocsNav.ts` to send a click on that
   *  keyword in the documentation's own keyword index straight to this heading rather than just its
   *  parent section — omitted where no heading is specific enough (most of `market.*`'s own plain
   *  functions, for instance), in which case the keyword index falls back to that keyword's own
   *  section. Each keyword should appear in at most one heading's own list — see `scriptDocsNav.ts`'s
   *  own doc for what happens on a genuine gap instead of a duplicate. */
  keywords?: string[];
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
// A sub-heading *within* a section — originally just visual structure for the "Exemples" section's
// several distinct worked scripts, now also a real nav sub-item (see scriptDocsNav.ts) and,
// optionally, the keyword index's own scroll target for whichever `keywords` it names.
function d(diagramKey: string): ScriptReferenceBlock {
  return { kind: "diagram", diagramKey };
}
function h(text: string, keywords?: string[]): ScriptReferenceBlock {
  return { kind: "heading", text, keywords };
}

export const SCRIPT_API_REFERENCE: ScriptReferenceSection[] = [
  // No `blocks` of its own — ScriptDocumentationModal.tsx special-cases `id === "keywords"` to
  // render <ScriptKeywordsIndex/> instead (a searchable, optionally-pinned index over
  // SCRIPT_API_COMPLETIONS), the same "whole-section override" pattern already used for
  // `id === "tutorial"`. Exists here mainly so it gets a real nav entry/section anchor for free,
  // and so its position in the reading order (first) is declared in one obvious place.
  {
    id: "keywords",
    title: "Mots-clés disponibles",
    blocks: [],
  },
  {
    id: "tutorial",
    title: "Tutoriel — créer un indicateur de A à Z",
    blocks: [
      t(
        "Ce tutoriel construit deux indicateurs complets, de zéro — pas à pas, comme si quelqu'un l'expliquait à côté de vous. Chaque étape ci-dessous est directement éditable et exécutable : le code s'exécute automatiquement dès que vous arrivez sur une étape, contre un petit jeu de données de démonstration, et la chart juste à côté se met à jour en direct — modifiez-le, cliquez sur « Exécuter », observez le résultat, puis passez à l'étape suivante. Chaque fonction utilisée ici est réexpliquée en détail, avec son propre schéma, dans sa section dédiée plus bas — ce tutoriel est le fil conducteur, pas la référence exhaustive. Commencez ici : c'est la manière la plus rapide de comprendre comment tout s'articule."
      ),
    ],
  },
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
    title: "L'éditeur : Exécuter / Exécuter la cellule / Arrêter / Enregistrer / Réinitialiser / Format",
    blocks: [
      t(
        "Le code affiché dans l'éditeur est un brouillon, distinct du code réellement enregistré sur le script tant que vous n'avez pas cliqué sur « Enregistrer »."
      ),
      l([
        "Exécuter — lance le brouillon actuel tel quel, même non enregistré. C'est ce qui permet de tester une modification avant de la valider.",
        "Exécuter la cellule (Maj+Entrée) — n'exécute qu'une portion du script à la fois, voir « Mode cellules » ci-dessous.",
        "Arrêter — interrompt immédiatement une exécution en cours (utile en cas de boucle infinie) en terminant le Worker sous-jacent, plutôt que d'attendre qu'il se termine de lui-même.",
        "Enregistrer — valide le brouillon comme code officiel du script (répercuté vers l'application hôte).",
        "Réinitialiser — abandonne le brouillon et revient au dernier code enregistré.",
        "Format — ré-indente légèrement le code (pas une mise en forme complète à la Prettier).",
      ]),
      t(
        "Si l'exécution dépasse un certain délai (8 secondes pour un rejeu complet, 1,5 seconde pour une simple ré-évaluation en direct), elle est automatiquement interrompue et une erreur de délai dépassé s'affiche — c'est le filet de sécurité contre une boucle infinie qu'un script maladroit pourrait contenir."
      ),
      t("Toute erreur (de syntaxe ou d'exécution) s'affiche sous l'éditeur avec son message et, quand le moteur JavaScript le permet, le numéro de ligne exact."),
      h("Mode cellules — exécuter un bloc à la fois (façon Jupyter)"),
      t(
        "Un commentaire // %% en début de ligne délimite une « cellule ». Une fine bordure marque chaque cellule, et celle où se trouve le curseur est légèrement teintée — repérage visuel immédiat, sans rien avoir à cliquer."
      ),
      c(
        `// %% Étape 1 — les données de base
const closes = market.series("close", 20);
const sma = math.sma(closes, 20);

// %% Étape 2 — le tracé
plot.overlay("SMA 20", sma ?? market.close(0));`
      ),
      t(
        "Maj+Entrée (ou le bouton « Exécuter la cellule ») exécute le code depuis le tout début du fichier jusqu'à la fin de la cellule où se trouve le curseur — pas cette seule cellule isolée. C'est une différence volontaire avec un vrai notebook Jupyter : ce moteur n'a pas de mémoire de variables entre deux exécutions (state.* lui-même repart de zéro à chaque exécution complète, voir state.* plus bas), donc une cellule isolée qui lirait une variable définie plus haut échouerait aussitôt. « Depuis le début jusqu'ici » reproduit exactement l'usage réel d'un notebook (on exécute ses cellules dans l'ordre, du haut vers le bas) sans dépendre d'un mécanisme que ce moteur n'a pas — écrivez votre script cellule par cellule, en appuyant sur Maj+Entrée à chaque étape pour voir immédiatement son effet sur la chart, exactement comme dans Jupyter."
      ),
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
      t("market.availableTimeframes() retourne la liste des intervalles proposés par la chart hôte (ex. [\"1m\",\"5m\",\"1h\",\"1d\"]) — à titre indicatif uniquement, ne donne accès aux données d'aucun autre intervalle (voir market.resample ci-dessous pour ça)."),
      h("market.resample(interval) — lire un autre timeframe", ["market.resample"]),
      t(
        "market.resample(interval) regroupe les bougies déjà affichées sur la chart (celles-là mêmes que market.* lit) en bougies plus larges — 15 minutes en 1 heure, 1 heure en 4 heures, etc. — et retourne un objet avec exactement les mêmes fonctions que market.* (open/high/low/close/volume/time/series), mais lues sur ce timeframe agrégé. Ce n'est pas une nouvelle source de données : cette bibliothèque n'en fournit jamais elle-même (voir availableTimeframes ci-dessus) — resample recalcule simplement des bougies plus larges à partir de celles déjà là, exactement comme changerait le sélecteur d'intervalle de la chart elle-même."
      ),
      d("resample"),
      c(
        `market.resample(interval) // "5m" | "15m" | "1h" | "4h" | "1d" | ... → objet market-like

const h4 = market.resample("4h");
h4.close(0);              // number | null — clôture de la bougie 4H courante
h4.series("close", 60);   // number[] — 60 dernières clôtures 4H

// Composable avec ta.*/math.* exactement comme market.* lui-même :
const rsiH4 = ta.rsi(h4.series("close", 60), 14);`
      ),
      t(
        "interval doit être plus large que le timeframe déjà affiché sur la chart (on ne peut pas fabriquer du 5 minutes à partir de bougies journalières) — un intervalle invalide ou trop fin retourne un objet dont toutes les méthodes renvoient null/[] plutôt que de lever une erreur, même convention que chart.indicator() sur un identifiant introuvable. Aucune fuite de données futures n'est possible ici non plus : les bougies agrégées ne sont jamais construites au-delà de la bougie courante."
      ),
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
      h("Les séries continues — line / area / histogram / overlay / panel", [
        "plot.line",
        "plot.area",
        "plot.histogram",
        "plot.overlay",
        "plot.panel",
      ]),
      t("Les cinq premières fonctions tracent une série continue (un point ajouté à chaque bougie traitée) ; appeler plusieurs fois la même série avec le même nom sur des bougies différentes prolonge la même courbe, pas une nouvelle à chaque fois."),
      c(
        `plot.line(name, value, options?)       // courbe, panneau dédié
plot.area(name, value, options?)       // aire remplie, panneau dédié
plot.histogram(name, value, options?)  // histogramme, panneau dédié
plot.overlay(name, value, options?)    // courbe superposée au prix (panneau principal)
plot.panel(name, value, options?)      // identique à line — alias

// options: { color?, lineWidth?, lineStyle? }`
      ),
      t(
        "line/area/histogram/panel ouvrent tous les quatre un nouveau panneau à part, sous le prix (exactement comme RSI ou MACD) — le bon choix pour une valeur qui n'est pas sur la même échelle que le prix (un score de 0 à 3, un pourcentage, un oscillateur…)."
      ),
      d("plotOwnPane"),
      t("overlay, à l'inverse, dessine directement par-dessus les bougies, dans le panneau principal — réservé à une valeur qui *est* un prix (une moyenne mobile, une bande, un niveau) et qui a donc du sens sur la même échelle."),
      d("plotOverlay"),
      t(
        "lineWidth (nombre, défaut 1,5) épaissit le trait ; lineStyle (\"solid\" par défaut, ou \"dashed\"/\"dotted\") change son style. Les deux s'appliquent à line/area/overlay/panel (sans effet sur histogram, qui trace des barres, pas un trait) :"
      ),
      c(`plot.overlay("SMA 20 (épaisse)", sma20, { lineWidth: 3, lineStyle: "dashed" });`),
      h("Remplir entre deux courbes — band / bandOverlay", ["plot.band", "plot.bandOverlay"]),
      t(
        "plot.band(name, upper, lower, options?) trace deux courbes et colore la surface entre elles — le rendu exact des bandes de Bollinger intégrées (remplissage translucide, ligne haute/basse fine, ligne médiane calculée automatiquement). own pane par défaut ; bandOverlay force le panneau principal, même paire que overlay/line :"
      ),
      c(
        `plot.band(name, upper, lower, options?)        // panneau dédié
plot.bandOverlay(name, upper, lower, options?) // superposé au prix

// options: { color?, lineWidth? } — lineWidth s'applique aux lignes haute/basse (la ligne
// médiane est légèrement plus épaisse, même rapport que les bandes de Bollinger intégrées)

// Exemple : une enveloppe de volatilité maison (moyenne ± 2 écarts-types)
const closes = market.series("close", 20);
const sma = math.sma(closes, 20);
const std = math.std(closes);
if (sma !== null && std !== null) {
  plot.bandOverlay("Enveloppe maison", sma + 2 * std, sma - 2 * std, { color: "#3ea377" });
}`
      ),
      h("Les marqueurs ponctuels — signal / point / horizontal / vertical", [
        "plot.signal",
        "plot.point",
        "plot.horizontal",
        "plot.vertical",
      ]),
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
      h("plot.table — un tableau en overlay sur la chart", ["plot.table"]),
      t(
        "plot.table(rows, options?) affiche un petit tableau ancré dans un coin de la chart (« RSI sur cinq timeframes », un score détaillé…) — ni série continue ni marqueur ponctuel : contrairement à plot.line, seul le dernier appel compte (pas d'historique accumulé), donc appelez-le sans condition à chaque bougie plutôt que de le protéger avec bar.isNew() — la chart affichera toujours la version la plus récente."
      ),
      d("plotTable"),
      c(
        `plot.table(rows, options?)
// rows: { cells: string[]; color?: string }[] — color teinte tout le texte de la ligne
// options?: {
//   title?: string;
//   columns?: string[];                                       // en-tête, une entrée par colonne
//   position?: "topRight"|"topLeft"|"bottomRight"|"bottomLeft"; // défaut "topRight"
// }

plot.table(
  [
    { cells: ["4H", "61.2", "BUY"], color: "#3ea377" },
    { cells: ["1H", "48.4", "WAIT"] },
  ],
  { title: "RSI multi-timeframe", columns: ["Timeframe", "RSI", "Signal"] }
);`
      ),
      t("Voir le tutoriel plus haut pour un exemple complet et commenté (corrélation du RSI sur cinq timeframes, avec une colonne de suggestion BUY/WAIT/SELL par ligne)."),
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
        "plot.table() est plafonné à 50 lignes et 200 caractères par cellule — au-delà, tronqué silencieusement plutôt que rejeté.",
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
        `// Lit un RSI et un MACD déjà présents sur la chart plutôt que de les recalculer ici —
// voir "Indicateurs disponibles" dans l'éditeur pour les identifiants réels de votre chart.
const rsi = chart.indicator("rsi_14").value(0);
const macdHist = chart.indicator("macd_12_26_9").histogram(0);
const price = market.close(0);
const sma20 = math.sma(market.series("close", 20), 20);

// Un point par condition remplie : 0 à 3, jamais négatif.
let score = 0;
if (rsi !== null && rsi > 50) score += 1;          // momentum haussier
if (macdHist !== null && macdHist > 0) score += 1; // MACD au-dessus de son signal
if (sma20 !== null && price > sma20) score += 1;   // prix au-dessus de sa moyenne 20

// Le score dans son propre panneau, la moyenne mobile superposée au prix.
plot.line("Quant Score", score);
plot.overlay("SMA 20", sma20 ?? price);

// Un seul signal par bougie (bar.isNew()), uniquement quand les trois conditions sont réunies.
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
// La valeur des deux moyennes à la bougie PRÉCÉDENTE — nécessaire pour détecter le moment exact
// du croisement (avant/après), pas juste "laquelle est au-dessus en ce moment".
const prevShort = state.get("prevShort", null);
const prevLong = state.get("prevLong", null);

plot.overlay("SMA 50", shortMA ?? market.close(0));
plot.overlay("SMA 200", longMA ?? market.close(0));

// Croisement = la courte était en dessous (ou égale) avant, et est au-dessus maintenant (ou l'inverse).
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

// Mémorise la valeur de cette bougie pour que la PROCHAINE puisse à son tour la lire comme "prev*".
state.set("prevShort", shortMA);
state.set("prevLong", longMA);`
      ),

      h("Rupture des bandes de Bollinger"),
      t("Bandes tracées en superposition ; signal quand le prix clôture au-delà de l'une des deux bandes :"),
      c(
        `// Calculé "à la volée" via ta.* — pas besoin d'avoir ajouté de Bollinger à la chart.
const bb = ta.bollinger(market.series("close", 60), 20, 2);
const price = market.close(0);

// null tant qu'il n'y a pas encore 20 clôtures d'historique (période de chauffe) — on ne trace
// et ne signale rien avant que le calcul ait un sens.
if (bb) {
  plot.overlay("BB Haute", bb.upper);
  plot.overlay("BB Basse", bb.lower);

  // Rupture = clôture strictement au-delà d'une des deux bandes.
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

// Seuil statistique plutôt qu'un chiffre fixe : "anormalement haut" dépend de l'instrument
// (un volume de 1M peut être énorme pour l'un, minuscule pour un autre).
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

// Même principe de score que le Quant Score plus haut, mais avec deux indicateurs différents —
// preuve que le score composite n'est pas lié à une combinaison précise d'indicateurs.
let score = 0;
if (rsi !== null && rsi > 55) score += 1;                  // RSI franchement au-dessus du milieu
if (stoch !== null && stoch.k > stoch.d) score += 1;        // %K au-dessus de sa ligne de signal
if (stoch !== null && stoch.k < 80) score += 1;             // évite la zone de surachat extrême

plot.line("Momentum Score", score);

if (bar.isNew() && score === 3) {
  alert("Score de momentum au maximum (3/3)");
}`
      ),

      h("Canal de rupture (plus haut / plus bas sur 20 bougies)"),
      t("Un canal de type Donchian — plus haut et plus bas glissants — avec un signal quand le prix clôture hors du canal :"),
      c(
        `const period = 20;
// Le plus haut plus haut et le plus bas plus bas des 20 dernières bougies — le canal lui-même.
const upperChannel = math.max(market.series("high", period));
const lowerChannel = math.min(market.series("low", period));
const price = market.close(0);

plot.overlay("Canal haut", upperChannel ?? price);
plot.overlay("Canal bas", lowerChannel ?? price);

// Rupture = clôture qui égale ou dépasse une borne du canal (>= / <=, pas > / < : toucher la
// borne compte déjà comme une rupture, pas seulement la dépasser).
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
