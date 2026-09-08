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
   *  this specific heading is the primary explanation for, e.g. `[".band"]` on the "Remplir entre
   *  deux courbes" heading. Read by `scriptDocsNav.ts` to send a click on that
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
  /** Which nav group this section's entry renders under (`ScriptDocumentationModal.tsx` inserts a
   *  label whenever this changes from the previous section) — purely a left-nav readability
   *  grouping, no effect on reading order or section content. */
  group: string;
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
    group: "Démarrage",
    blocks: [],
  },
  {
    id: "tutorial",
    title: "Tutoriel",
    group: "Démarrage",
    blocks: [
      t(
        "Ce tutoriel construit deux indicateurs complets, de zéro — pas à pas, comme si quelqu'un l'expliquait à côté de vous. Chaque étape ci-dessous est directement éditable et exécutable : le code s'exécute automatiquement dès que vous arrivez sur une étape, contre un petit jeu de données de démonstration, et la chart juste à côté se met à jour en direct — modifiez-le, cliquez sur « Exécuter », observez le résultat, puis passez à l'étape suivante. Chaque fonction utilisée ici est réexpliquée en détail, avec son propre schéma, dans sa section dédiée plus bas — ce tutoriel est le fil conducteur, pas la référence exhaustive. Commencez ici : c'est la manière la plus rapide de comprendre comment tout s'articule."
      ),
    ],
  },
  {
    id: "overview",
    title: "Vue d'ensemble",
    group: "Démarrage",
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
        "Synchronisation garantie — market.close(0), chart.indicator(\"rsi\").value(0) et n'importe quel autre accès à \"la bougie courante\" pointent toujours exactement sur la même bougie, quel que soit l'ordre des appels.",
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
    title: "L'éditeur",
    group: "Démarrage",
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
        "@block en début de ligne délimite une « cellule » ; ce qui suit sur la même ligne en est le titre, texte libre. Une fine bordure marque chaque cellule, et celle où se trouve le curseur est légèrement teintée — repérage visuel immédiat, sans rien avoir à cliquer. Comme @description, c'est un mot-clé lu dans le texte du script puis retiré avant compilation, pas du JavaScript."
      ),
      c(
        `@block Étape 1 — les données de base
const closes = market.series("close", 20);
const sma = math.sma(closes, 20);

@block Étape 2 — le tracé
plot.overlay("SMA 20").line("SMA 20", sma ?? market.close(0));`
      ),
      t(
        "Maj+Entrée (ou le bouton « Exécuter la cellule ») exécute le code depuis le tout début du fichier jusqu'à la fin de la cellule où se trouve le curseur — pas cette seule cellule isolée. C'est une différence volontaire avec un vrai notebook Jupyter : ce moteur n'a pas de mémoire de variables entre deux exécutions (state.* lui-même repart de zéro à chaque exécution complète, voir state.* plus bas), donc une cellule isolée qui lirait une variable définie plus haut échouerait aussitôt. « Depuis le début jusqu'ici » reproduit exactement l'usage réel d'un notebook (on exécute ses cellules dans l'ordre, du haut vers le bas) sans dépendre d'un mécanisme que ce moteur n'a pas — écrivez votre script cellule par cellule, en appuyant sur Maj+Entrée à chaque étape pour voir immédiatement son effet sur la chart, exactement comme dans Jupyter."
      ),
      t(
        "Un petit bouton ▶ apparaît directement sur la cellule active — cliquer dessus fait exactement la même chose que Maj+Entrée, sans avoir à viser le bouton « Exécuter la cellule » de la barre d'outils. Juste en dessous de la cellule, son propre résultat s'affiche : le texte de console.log, la valeur de la toute dernière expression de la cellule si elle n'est ni affectée à une variable ni déjà affichée autrement (exactement comme un vrai notebook auto-affiche le résultat d'une cellule qui se termine par une expression seule), et un graphique si la cellule contient un appel à plot.xy (voir plot.* plus bas). Voir le tutoriel « Mode notebook » plus haut pour un exemple pas à pas."
      ),
      h("Mode no-code — le script en blocs reliés"),
      t(
        "Le sélecteur « Code / No-code » en haut de la barre d'outils montre le même script de deux façons. En no-code, chaque cellule @block devient une boîte sur un plan de travail : on tire un bloc depuis la palette de gauche, on relie les boîtes entre elles en glissant du point de sortie de l'une vers le point d'entrée de l'autre, on clique une boîte pour en modifier le code dans l'éditeur du bas, et le ▶ de chaque boîte l'exécute."
      ),
      t(
        "Ce n'est pas un second format : les deux vues lisent et écrivent le même texte, et le basculement se fait à tout moment, y compris en pleine saisie. Ce qui rend cela possible, c'est que tout ce que le schéma sait est écrit sur la ligne @block elle-même — un identifiant, une position at x y, et les blocs dont il dépend avec after. Le mot-clé garde donc exactement sa forme d'origine : @block Titre reste valide, et un script écrit avant l'existence du mode no-code s'y ouvre tel quel, sous la forme d'une chaîne."
      ),
      c(
        `@block(prix at 40 120) Charger les prix
const prix = market.close(0);

@block(moyenne at 340 120) Moyenne mobile
const sma = ta.sma(market.series("close", 60), 20);

// « after » n'est nécessaire que lorsque l'ordre voulu n'est pas celui de l'écriture :
// sans lui, un bloc suit simplement celui écrit juste avant.
@block(signal at 640 120 after moyenne prix) Signal
if (bar.isNew() && prix > sma) plot.signal("BUY");`
      ),
      t(
        "Une flèche veut dire « s'exécute après », pas « envoie ses données à ». Les blocs sont les cellules d'un même script et partagent une seule portée : une flèche de A vers B dit que B peut utiliser ce que A a déclaré, et fixe l'ordre en conséquence. Le ▶ d'un bloc exécute donc ce bloc et tout ce dont il dépend, dans l'ordre — la même règle que Maj+Entrée en mode code, généralisée au graphe."
      ),
      t(
        "La boîte en pointillés « Préambule » regroupe tout ce qui précède le premier @block : @indicator, @description, les imports, les déclarations new Variable(...). Elle s'exécute avant tous les blocs, ne peut pas être supprimée et n'a pas besoin d'être reliée — c'est pourquoi elle reste à sa place au lieu de se déplacer. Supprimer un bloc au milieu d'une chaîne relie ses enfants à ses parents : la chaîne se referme au lieu de se couper."
      ),
      h("Plusieurs fichiers dans un même script"),
      t(
        "Un script n'est pas obligé de tenir dans un seul fichier. La barre juste au-dessus du code donne un onglet par fichier : « Principal » est celui qui s'exécute, le bouton + en crée un nouveau, un double-clic sur un onglet le renomme et la croix le supprime. Les fichiers sont enregistrés avec le script et voyagent avec lui."
      ),
      t(
        "Un fichier s'utilise avec la syntaxe des modules JavaScript : export dans le fichier qui fournit, import dans celui qui consomme. Le nom d'un fichier est ce qui suit ./ dans l'import — ./outils, outils et outils.js désignent tous les trois le fichier nommé outils."
      ),
      c(
        `import { Tracker } from "./outils";

const suivi = state.get("suivi") ?? new Tracker(20);
state.set("suivi", suivi);
plot.overlay("Plus haut").line("max", suivi.pousser(market.close(0)));`
      ),
      c(
        `// ./outils — un onglet à part dans l'éditeur
export class Tracker {
  constructor(taille) {
    this.taille = taille;
    this.max = -Infinity;
  }

  pousser(valeur) {
    this.max = Math.max(this.max, valeur);
    return this.max;
  }
}`
      ),
      t(
        "La règle importante tient en une phrase : le fichier principal est réexécuté une fois par bougie, les fichiers importés ne sont évalués qu'une seule fois par exécution. Une instance créée dans un fichier importé traverse donc tout l'historique, là où un new écrit dans le fichier principal repartirait de zéro à chaque bougie — c'est pourquoi l'exemple ci-dessus range la sienne dans state."
      ),
      l([
        "Formes acceptées — import x from \"./f\", import { a, b as c } from \"./f\", import * as ns from \"./f\", import \"./f\" (pour son seul effet), export const/let/var/function/class, export default, export { a, b as c }.",
        "export * from \"./f\" est refusé : re-exporter tous les noms d’un fichier suppose de savoir ce qu’il exporte, ce qui n’est connu qu’une fois exécuté. Ré-exportez les noms un par un.",
        "Deux fichiers qui s’importent mutuellement sont signalés comme import circulaire plutôt que de rendre des exports à moitié construits.",
        "new Variable(...) fonctionne dans n’importe quel fichier : le réglage apparaît dans la même fenêtre de paramètres, quel que soit le fichier qui le déclare.",
        "Les numéros de ligne d’une erreur restent ceux du fichier où elle s’est produite — la réécriture interne des import/export préserve le découpage en lignes.",
      ]),
    ],
  },
  {
    id: "script-meta",
    title: "Décrire et paramétrer un script",
    group: "Démarrage",
    blocks: [
      t(
        "Cinq mots-clés ne font pas partie de l'API exécutée : ils se lisent dans le texte du script lui-même, avant que quoi que ce soit ne tourne. @indicator ou @strategy dit ce qu'est le script, @description le documente, new Variable(...) en expose les réglages, et @block le découpe en cellules (voir « L'éditeur » plus haut). Tous sont retirés du code avant compilation — aucun n'existe à l'exécution."
      ),
      h("@indicator / @strategy — ce qu'est le script", ["@indicator", "@strategy"]),
      t(
        "Un script est l'un des deux, déclaré sur sa propre ligne, en général tout en haut. @indicator dessine sur la chart : des courbes, des bandes, des marqueurs. @strategy fait la même chose et prend en plus des positions, qui sont rejouées sur un compte simulé et lues dans un panneau dédié ancré sous les bougies."
      ),
      c(
        `@indicator
plot.overlay("SMA").line("SMA", math.sma(market.series("close", 20), 20));`
      ),
      c(
        `@strategy
if (market.close(0) > market.close(1)) strategy.long("Deux hausses");`
      ),
      t(
        "Ce n'est pas une étiquette : c'est ce décorateur qui donne — ou refuse — l'accès à strategy.*. Un script @indicator n'a tout simplement pas cet objet, et l'appeler échoue en nommant ce qui manque, plutôt que d'ouvrir silencieusement une position que personne n'a demandée. Un script qui ne déclare rien est un indicateur : c'est ce qu'était tout script écrit avant l'existence de ces décorateurs, et ce que reste l'immense majorité d'entre eux. Déclarer les deux est une contradiction, signalée comme telle dans l'éditeur."
      ),
      h("@description — documenter le script", ["@description"]),
      t(
        "Écrit tout en haut du script, @description \"…\" donne le texte qui s'affiche quand on clique sur le petit cercle « ? » de l'en-tête d'une pane produite par ce script. Un script n'en déclare qu'une seule."
      ),
      c(
        `@description "///Mon indicateur///
Un paragraphe d'explication. Une ligne seule passe à la ligne,
une ligne vide ouvre un nouveau paragraphe.

//Un sous-titre//
**gras**, *italique*, __souligné__, --rayé--.
"`
      ),
      t("Le balisage accepté, volontairement réduit à six marques :"),
      l([
        "///titre/// — un gros titre.",
        "//sous-titre// — un sous-titre.",
        "**texte** — gras.",
        "*texte* — italique.",
        "__texte__ — souligné.",
        "--texte-- — rayé.",
      ]),
      t(
        "Une ligne vide sépare deux paragraphes ; un simple retour à la ligne reste dans le même paragraphe. Ce n'est pas du Markdown et le texte n'est jamais interprété comme du HTML : seules ces six marques produisent quelque chose, tout le reste s'affiche tel quel."
      ),
      h("new Variable — exposer un réglage", ["Variable"]),
      t(
        "Une constante déclarée avec new Variable(type, valeur par défaut) apparaît comme un champ réglable dans deux endroits : le panneau « Paramètres » de l'éditeur, et l'onglet « Entrées » de la fenêtre de réglages de chaque pane produite par le script. Changer une valeur relance le script tout seul — pas besoin de recliquer sur « Exécuter »."
      ),
      c(
        `const ATR_MULT = new Variable("number", 3.0, { description: "Largeur du noyau, en multiples d'ATR.", min: 0.1, max: 10 });
const PALIERS = new Variable("Array[number]", [0.5, 1, 2]);
const COULEUR = new Variable("color", "#3b82f6");
const AFFICHER_SIGNAUX = new Variable("boolean", true);

// La variable s'utilise comme la constante qu'elle est :
const highs = market.series("high", 14);
const lows = market.series("low", 14);
const closes = market.series("close", 14);
const bandwidth = (ta.atr(highs, lows, closes, 14) ?? 1) * ATR_MULT;
if (AFFICHER_SIGNAUX) plot.signal("BUY");`
      ),
      t("Les six types disponibles, et ce que la valeur par défaut doit être :"),
      l([
        '"number" — un nombre, négatif accepté. Champ numérique.',
        '"string" — un texte entre guillemets. Champ texte.',
        '"boolean" — true ou false, sans guillemets. Case à cocher.',
        '"color" — une couleur hexadécimale, #rrggbb ou #rgb. Sélecteur de couleur.',
        '"Array[number]" — un tableau de nombres, par exemple [1, 2, 3].',
        '"Array[string]" — un tableau de textes, par exemple ["a", "b"].',
      ]),
      t(
        "Le troisième argument est facultatif : { description: \"…\" }, dont le texte s'affiche sous le champ correspondant, et — uniquement pour \"number\" — { min, max }, qui bornent à la fois le champ (ses boutons +/- s'arrêtent à la limite, une valeur tapée hors bornes est ramenée dedans) et la valeur par défaut elle-même. Les trois se combinent librement : { description: \"…\", min: 0, max: 100 }."
      ),
      t("Règles, signalées comme des erreurs directement dans l'éditeur, avant même d'exécuter :"),
      l([
        "La déclaration doit être un const. let et var sont refusés — un réglage ne change pas en cours de route.",
        'La valeur par défaut doit correspondre au type déclaré : new Variable("string", 5) est une erreur, new Variable("string", "5") non.',
        "min/max ne s'appliquent qu'à un \"number\" — les poser sur un autre type est une erreur, tout comme min supérieur à max ou une valeur par défaut hors de cet intervalle.",
        "Une variable déclarée ne peut plus être réaffectée ailleurs dans le script — ni par =, ni par +=, ni par ++ ou --. Sa valeur se change dans les réglages, pas dans le code.",
      ]),
      t(
        "À l'exécution, chaque new Variable(...) est remplacé par la valeur effective — celle des réglages, ou celle écrite dans le code si elle n'a jamais été modifiée. La variable est donc une vraie constante JavaScript ordinaire : elle s'utilise directement dans un calcul, sans .value ni rien à déballer."
      ),
      h("DEBOUNCE_MS — pacer les ticks en direct", ["DEBOUNCE_MS"]),
      t(
        "DEBOUNCE_MS est le seul nom que le moteur lit lui-même, plutôt que de se contenter de le substituer dans le code comme tout le reste : il règle le délai d'anti-rafale avant un recalcul déclenché par un tick de marché en direct sur la bougie encore en formation. Sans déclaration, ce délai est de 300 ms pour tout script."
      ),
      c(`const DEBOUNCE_MS = new Variable("number", 0, { min: 0 });
// Avec 0, le script se relance à chaque tick en direct, sans anti-rafale.`),
      t(
        "Sans effet sur le replay ou l'arrivée d'une nouvelle bougie, qui relancent toujours le script immédiatement quelle que soit cette valeur — seul un vrai tick sans nouvelle bougie ni déplacement de replay passe par ce délai."
      ),
    ],
  },
  {
    id: "market",
    title: "market.*",
    group: "API du script",
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
    id: "market-heikinashi",
    title: "market.heikinAshi",
    group: "API du script",
    blocks: [
      t(
        "Renvoie les quatre séries Heikin-Ashi calculées sur les mêmes barres — l'OHLC lissé que le mode d'affichage « Heikin-Ashi » de la chart dessine, mis à disposition d'un script sous forme de nombres. Les quatre tableaux sont alignés entre eux et ordonnés de la plus ancienne barre à la plus récente, comme market.series."
      ),
      c(
        `const ha = market.heikinAshi(200);
// ha.open, ha.high, ha.low, ha.close — number[], même longueur

// Clôture Heikin-Ashi de la barre courante :
const haClose = ha.close[ha.close.length - 1];`
      ),
      t(
        "Pourquoi un accesseur dédié plutôt qu'un calcul dans le script : la clôture Heikin-Ashi est une simple moyenne des quatre prix de la barre, mais son ouverture est la moyenne de l'ouverture et de la clôture Heikin-Ashi *précédentes*. Elle dépend donc de toutes les barres qui la précèdent, ce qu'un script lisant une fenêtre de taille fixe ne peut pas reproduire."
      ),
      t(
        "En pratique la série est calculée sur la fenêtre demandée plus cent barres d'échauffement, jamais sur tout l'historique : l'influence de l'amorce est divisée par deux à chaque barre, si bien qu'après cent barres le résultat est à un bruit de virgule flottante près celui qu'on obtiendrait depuis la barre zéro — pour une fraction du coût, dans un script qui s'exécute à chaque barre."
      ),
    ],
  },
  {
    id: "chart",
    title: "chart.*",
    group: "API du script",
    blocks: [
      t(
        "chart.indicator(id) retourne un objet (un « handle ») permettant de lire les valeurs d'un indicateur déjà ajouté à la chart (RSI, MACD, Bollinger…), à n'importe quelle bougie passée. L'identifiant n'est pas l'id interne de l'indicateur (qui change à chaque session) mais un identifiant stable dérivé uniquement de son type — \"rsi\", \"macd\", \"bollinger\"… — jamais de ses réglages (période, écart-type…) : un RSI(14) et un RSI(21) partagent le même id de base. Le panneau « Indicateurs disponibles » de l'éditeur liste les identifiants réels de la chart en cours — cliquer dessus copie chart.indicator(\"...\") dans le presse-papiers."
      ),
      d("chartIndicator"),
      t("chart.listIndicators() retourne la liste de tous les identifiants disponibles (string[])."),
      t("Un identifiant introuvable ne fait jamais planter le script — il retourne un objet dont toutes les méthodes renvoient null."),
      t(
        "Le handle retourné expose toujours les 10 mêmes méthodes, quel que soit l'indicateur visé — seules celles qui correspondent à sa forme réelle renvoient une valeur, les autres renvoient systématiquement null, jamais d'exception. Chacune est détaillée individuellement ci-dessous."
      ),
      h(".value — lecture simple", [".value"]),
      t(
        ".value(offset?) lit une valeur \"simple\" : un indicateur à une seule ligne (\"sma\", \"ema\", \"wma\", \"vwap\", \"rsi\", \"chop\", \"atr\", \"parabolicSar\", \"correlation\", et les 8 indicateurs fondamentaux — Free Cash Flow, Résultat net, Chiffre d'affaires, Marge nette, Marge brute, PER, BPA, Dette/Capitaux propres), ou le point milieu d'une bande de Bollinger (strictement identique à .middle()). offset (0 par défaut) compte en bougies en arrière : 0 = bougie courante, 1 = bougie précédente. Sur un MACD ou un ADX, .value() renvoie toujours null — ces formes n'exposent pas de valeur \"simple\" unique, voir plus bas."
      ),
      c(`const rsi = chart.indicator("rsi");
rsi.value(0);   // valeur à la bougie courante
rsi.value(1);   // valeur à la bougie précédente

const sma = chart.indicator("sma");
sma.value(0);   // number | null`),
      h(".upper/.middle/.lower", [".upper", ".middle", ".lower"]),
      t(
        ".upper(offset?), .middle(offset?) et .lower(offset?) lisent respectivement la bande haute, la bande médiane et la bande basse d'un indicateur en forme de bande — aujourd'hui uniquement \"bollinger\". .middle() renvoie exactement la même valeur que .value() sur ce même indicateur, ce sont deux façons équivalentes de la lire. Sur tout autre indicateur, les trois renvoient null."
      ),
      c(`const bb = chart.indicator("bollinger");
bb.upper(0);   // bande haute
bb.middle(0);  // bande médiane — identique à bb.value(0)
bb.lower(0);   // bande basse`),
      h(".line/.signal/.histogram", [".line", ".signal", ".histogram"]),
      t(
        ".line(offset?), .signal(offset?) et .histogram(offset?) lisent respectivement la ligne MACD, la ligne de signal et l'histogramme d'un indicateur \"macd\" — les trois seules valeurs qu'il expose. .value() renvoie toujours null sur un MACD (il n'y a pas de valeur \"simple\" unique à choisir entre les trois). .line et .histogram sont aussi les noms des méthodes de dessin pane.line/overlay.line et pane.histogram/overlay.histogram (voir plus bas, plot.*) — deux usages différents du même mot selon l'objet sur lequel on l'appelle, sans rapport entre les deux."
      ),
      c(`const macd = chart.indicator("macd");
macd.line(0);        // ligne MACD
macd.signal(0);       // ligne de signal
macd.histogram(0);    // histogramme (ligne - signal)`),
      h(".adx/.plusDI/.minusDI", [".adx", ".plusDI", ".minusDI"]),
      t(
        ".adx(offset?), .plusDI(offset?) et .minusDI(offset?) lisent respectivement la valeur ADX, +DI et -DI d'un indicateur \"adx\" — les trois seules valeurs qu'il expose. .value() renvoie toujours null sur un ADX."
      ),
      c(`const adx = chart.indicator("adx");
adx.adx(0);      // force de la tendance (indépendamment de son sens)
adx.plusDI(0);   // pression acheteuse
adx.minusDI(0);  // pression vendeuse`),
      h("Indicateurs illisibles"),
      t(
        "Certains indicateurs intégrés n'ont aucune valeur exploitable par les 10 méthodes ci-dessus : soit leur forme est un objet composite trop spécifique pour l'une des lectures génériques (même .value() y renvoie null — y compris sur \"supertrend\", dont la forme {value, trend} ressemble pourtant à une simple valeur, piège à connaître), soit ils ne sont tout simplement jamais indexés bougie par bougie en interne. Ils restent visibles sur la chart mais ne peuvent pas être lus depuis un script via chart.indicator() :"
      ),
      l([
        "\"supertrend\" — objet {value, trend}, pas un nombre malgré les apparences",
        "\"chandelierExit\" — objet {longStop, shortStop, dir, buySignal, sellSignal}",
        "\"zigzag\", \"ichimoku\", \"gaps\", \"pivotPoints\", \"supportResistance\", \"patternRecognition\", \"candleRecognition\" — chacun a sa propre forme composite",
        "\"tpo\" — un profil de session, jamais indexé bougie par bougie",
        "un indicateur \"custom\" (le résultat plot.pane/plot.overlay d'un autre script) — n'apparaît jamais dans chart.indicator(), volontairement exclu",
      ]),
      h("Réglages par indicateur"),
      t(
        "Les réglages d'un indicateur (période, écart-type, déviation…) influencent uniquement son calcul, jamais son identifiant : un RSI(14) et un RSI(21) partagent le même id de base \"rsi\" (distingués par \"rsi\"/\"rsi_2\" s'ils coexistent tous les deux sur la chart). Utilisez chart.listIndicators() ou le panneau « Indicateurs disponibles » pour retrouver lequel est lequel plutôt que de deviner d'après le nom. Deux exceptions, où le réglage change la nature même de la donnée plutôt que d'affiner un calcul : \"correlation\" garde le symbole comparé dans son id (ex. \"correlation_AAPL\", une corrélation avec un autre symbole est une autre série, pas le même calcul en plus précis), et \"pivotPoints\" garde son type et sa période (ex. \"pivot_points_classic_weekly\") — dans les deux cas, deux réglages différents produisent deux données différentes, pas la même donnée en plus fin."
      ),
      t("Exemple — détecter un croisement RSI au-dessus de 50, à la bougie courante uniquement :"),
      c(
        `const rsi = chart.indicator("rsi");
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
    title: "plot.*",
    group: "API du script",
    blocks: [
      t(
        "C'est la fonction que vous utiliserez le plus souvent : plot.* est ce qui fait réellement apparaître quelque chose sur la chart — sans un appel à plot.* quelque part, un script peut calculer tout ce qu'il veut en coulisses, rien ne s'affichera jamais. Il existe deux familles bien distinctes : les panneaux dessinés (un ou plusieurs traits qui grandissent bougie après bougie) et les marqueurs ponctuels (un seul symbole posé sur une bougie précise)."
      ),
      h("plot.pane / plot.overlay", ["plot.pane", "plot.overlay"]),
      t(
        "plot.pane(nom) et plot.overlay(nom) créent chacun un panneau nommé et renvoient un objet sur lequel dessiner — appeler plusieurs fois la même méthode de dessin, avec le même nom de série, sur des bougies différentes prolonge la même courbe, pas une nouvelle à chaque fois. Le nom passé à plot.pane/plot.overlay peut être rappelé sans souci à chaque bougie (le script entier rejoue en entier à chaque fois) : ça rouvre le même panneau plutôt que d'en créer un nouveau."
      ),
      c(
        `const pane = plot.pane("Mon score");     // nouveau panneau à part, sous le prix
pane.line(name, value, options?)         // courbe
pane.area(name, value, options?)         // aire remplie
pane.histogram(name, value, options?)    // histogramme
pane.dots(name, value, options?)         // points non reliés — voir plus bas
pane.band(name, upper, lower, options?)  // remplissage entre deux courbes — voir plus bas

// options (line/area/histogram/dots): { color?, lineWidth?, lineStyle? }`
      ),
      t(
        "plot.pane ouvre un nouveau panneau à part, sous le prix (exactement comme RSI ou MACD) — le bon choix pour une valeur qui n'est pas sur la même échelle que le prix (un score de 0 à 3, un pourcentage, un oscillateur…)."
      ),
      d("plotOwnPane"),
      t(
        'plot.pane(nom, options?) accepte un second paramètre optionnel : { dock?: "bottom"|"left"|"right" }. Par défaut ("bottom"), le panneau s\'empile sous le prix comme ci-dessus. "left"/"right" l\'ancre plutôt sur le côté de la chart, dans sa propre colonne — la chart principale se partage alors l\'espace horizontal avec elle, redimensionnable indépendamment, mais toujours synchronisée avec les mêmes bougies (même zoom, même déplacement). Une colonne ancrée ne se redimensionne que sur son propre axe : X pour left/right, Y pour bottom (comme n\'importe quel autre panneau) — impossible de la faire grandir dans l\'autre sens.'
      ),
      c(`plot.pane("Score latéral", { dock: "right" }).line("Score", value);`),
      t(
        "options.dock n'est lu qu'au tout premier appel pour un nom de panneau donné (comme le reste des options par panneau) — un appel plus tard sur le même nom ne peut pas déplacer un panneau déjà ouvert vers un autre bord."
      ),
      t(
        "Deux panneaux ancrés du même côté sous le MÊME NOM partagent une seule boîte et se superposent : un profil tracé par un script et un autre tracé par un second script se retrouvent dans la même colonne, à la même hauteur, sur la même échelle de magnitude — c'est la seule façon de les comparer. Des noms différents continuent de s'empiler l'un sous l'autre. Superposer ou empiler est donc un choix de nom, pas une option de plus : nommez-les pareil pour superposer, différemment pour empiler."
      ),
      t(
        "Dans une boîte partagée, chaque panneau garde son propre en-tête (avec ses réglages et sa suppression), placés l'un sous l'autre comme les lignes d'une légende ; la poignée de redimensionnement et l'axe des valeurs appartiennent à la boîte, pas à chacun de ses occupants. Les profils superposés se partagent une seule échelle de magnitude — celle du plus large d'entre eux — pour qu'un petit profil ne soit pas dessiné comme un grand."
      ),
      t(
        "plot.overlay dessine directement par-dessus les bougies, dans le panneau principal — réservé à une valeur qui *est* un prix (une moyenne mobile, une bande, un niveau) et qui a donc du sens sur la même échelle. Même objet, mêmes méthodes que plot.pane, mais jamais ancrable sur le côté (dock n'existe que pour plot.pane) :"
      ),
      c(`const overlay = plot.overlay("SMA 20");
overlay.line("SMA 20", sma20 ?? market.close(0));`),
      d("plotOverlay"),
      h("Plusieurs courbes dans un même panneau", [".area"]),
      t(
        "Un même panneau accepte plusieurs séries — chacune garde son propre nom (sa propre entrée dans l'en-tête du panneau), mais toutes partagent le même panneau et la même échelle verticale. Pratique pour un indicateur composite (une ligne rapide et une ligne lente, une ligne et son histogramme…) sans multiplier les panneaux :"
      ),
      c(
        `const pane = plot.pane("Momentum");
pane.line("Rapide", fast);
pane.line("Lente", slow);
pane.histogram("Écart", fast - slow);`
      ),
      t(
        "lineWidth (nombre, défaut 1,5) épaissit le trait ; lineStyle (\"solid\" par défaut, ou \"dashed\"/\"dotted\") change son style. Les deux s'appliquent à line/area/band (sans effet sur histogram, qui trace des barres, pas un trait) :"
      ),
      c(`overlay.line("SMA 20 (épaisse)", sma20, { lineWidth: 3, lineStyle: "dashed" });`),
      h("Des points plutôt qu'une courbe — .dots", [".dots"]),
      t(
        "pane.dots(nom, valeur, options?) / overlay.dots(...) posent un point par bougie au lieu de relier les valeurs entre elles. À utiliser dès qu'une valeur peut sauter d'un niveau à un autre sans rapport d'une bougie à la suivante — un niveau de support détecté automatiquement, un pivot, un prix cible recalculé : une courbe inventerait entre deux points une continuité que la donnée n'a pas, alors que des points ne relient rien."
      ),
      t(
        "C'est aussi le seul tracé qui laisse de vrais trous. Toutes les autres méthodes prolongent leur dernière valeur connue jusqu'au bord droit du graphe (une série qui s'arrête d'émettre reste tracée à l'horizontale) ; .dots ne dessine rien tant que le script n'émet pas. Une série de points s'arrête donc exactement là où le script cesse de l'alimenter — c'est ce qui permet à un niveau de disparaître quand il n'est plus détecté."
      ),
      c(
        `// Les niveaux détectés, un point par bougie et par niveau — ils s'interrompent d'eux-mêmes
// dès qu'un niveau cesse d'être trouvé.
const niveaux = plot.overlay("Niveaux");
levels.forEach((prix, i) => {
  niveaux.dots("Niveau " + (i + 1), prix, { color: "#c47f2a", lineWidth: 1.6 });
});`
      ),
      t("lineWidth règle ici le rayon du point (1 donne un pointillé fin, 3 de gros points) ; lineStyle n'a pas de sens et est ignoré."),
      h("Remplir entre deux courbes — .band", [".band"]),
      t(
        "pane.band(name, upper, lower, options?) / overlay.band(name, upper, lower, options?) tracent deux courbes et colorent la surface entre elles — le rendu exact des bandes de Bollinger intégrées (remplissage translucide, ligne haute/basse fine, ligne médiane calculée automatiquement) :"
      ),
      c(
        `// options: { color?, lineWidth? } — lineWidth s'applique aux lignes haute/basse (la ligne
// médiane est légèrement plus épaisse, même rapport que les bandes de Bollinger intégrées)

// Exemple : une enveloppe de volatilité maison (moyenne ± 2 écarts-types), sur le prix
const closes = market.series("close", 20);
const sma = math.sma(closes, 20);
const std = math.std(closes);
if (sma !== null && std !== null) {
  plot.overlay("Enveloppe maison").band("Enveloppe", sma + 2 * std, sma - 2 * std, { color: "#3ea377" });
}`
      ),
      h("Un profil tourné à 90° — .profile", [".profile"]),
      d("marketProfile"),
      t(
        "pane.profile(nom, valeurs, prix) dessine un profil de marché : valeurs[i] est la masse présente au prix prix[i]. Comme plot.xy, il prend les tableaux entiers d'un coup au lieu d'une valeur par bougie — un profil n'est pas une série temporelle, il est calculé une fois sur une plage de prix et n'a aucune bougie à laquelle rattacher ses points."
      ),
      t(
        "Il est dessiné transposé, sous forme d'une courbe continue : les prix descendent le long de l'axe vertical, et la valeur se mesure horizontalement depuis le bord extérieur de la colonne en revenant vers le graphe — la ligne de base est donc à l'extérieur, et les bosses pointent vers les bougies. L'échelle verticale est celle du graphe principal, pas une échelle ajustée aux données du panneau : c'est ce qui met chaque bosse exactement à la hauteur du prix qu'elle désigne."
      ),
      c(
        `// densité et grille de prix calculées ailleurs, puis mémorisées avec state.set
const densite = state.get("density", []);
const prix = state.get("priceGrid", []);
plot.pane("Profil", { dock: "right" }).profile("Densité", densite, prix, { color: "#c47f2a", headroom: 0.08 });

// options: { color?, lineWidth?, headroom? }`
      ),
      t(
        "headroom laisse un espace entre le pic le plus haut et la barre de séparation de la colonne, en fraction de la largeur du profil — 0.08 arrête la courbe à 8 % du bord, 0 (par défaut) la laisse le toucher. C'est une option, et pas quelque chose à faire soi-même sur les valeurs avant de les passer : l'échelle de la colonne va toujours de 0 au maximum du tableau reçu, donc diviser toutes les densités par deux ne déplace pas leur maximum, qui retombe exactement au même endroit. Seule l'échelle peut être élargie, et l'axe du bas suit la même, donc ses graduations restent justes."
      ),
      l([
        "Cet alignement n'a de sens que sur un panneau ancré à gauche ou à droite — sur un panneau du bas, un profil n'a rien à aligner et n'est pas dessiné.",
        "Appelé sur plot.overlay(...) plutôt que sur un plot.pane(..., { dock: \"left\"|\"right\" }), .profile ne s'affiche pas non plus — même sort qu'un panneau du bas : overlay n'a jamais de dock.",
        "Le panneau n'occupe verticalement que la section des prix, pas toute la hauteur de la colonne : il n'y a pas de prix en dessous avec quoi s'aligner.",
        "« Le dernier appel gagne », comme plot.table et plot.xy — appelez-le sans condition à chaque bougie, c'est le profil de la dernière bougie qui est conservé.",
        "Un panneau qui contient un profil est un panneau profil : toute autre série dessinée dessus est ignorée.",
        "valeurs et prix doivent avoir la même longueur ; les paires non numériques sont écartées.",
        "Plafonné à 2000 points — au-delà, tronqué silencieusement plutôt que rejeté.",
      ]),
      h("Positionner un élément librement — .label", [".label"]),
      t(
        "pane.label(name, texte, options) / overlay.label(name, texte, options) placent un texte à une position précise, en pixels ou en %, avec une rotation possible — contrairement à .line/.area/.histogram/.band, aucun lien avec une bougie ou une valeur : c'est une annotation libre, pas une série de données."
      ),
      t(
        "Une étiquette peut aussi être ancrée à la donnée plutôt qu'à la boîte du panneau : passez { bar, price } au lieu de { x, y }. bar est un indice de bougie, price une valeur lue sur l'échelle verticale du panneau — celle des prix pour un overlay, celle du sous-panneau pour une pane. L'étiquette suit alors le zoom et le défilement avec la bougie qu'elle désigne, au lieu de rester à un point fixe pendant que les données glissent dessous. C'est ce qu'il faut pour marquer un événement précis : un pivot HH/HL/LH/LL, un franchissement. Une étiquette sortie des bougies visibles n'est simplement pas dessinée."
      ),
      c(
        `// un pivot haut repéré à la bougie 120, au prix 431.2
plot.overlay("Pivots").label("hh-120", "HH", { bar: 120, price: 431.2, align: "center" });`
      ),
      d("plotLabel"),
      t(
        "x/y sont relatifs à cette pane précise, pas à toute la chart : sur overlay, (0, 0) est le coin haut-gauche du panneau prix ; sur pane, celui du panneau qu'elle désigne. Rien à voir avec plot.table, qui s'ancre lui à l'un des 4 coins de toute la chart."
      ),
      c(
        `pane.label(name, texte, options)
// options: {
//   x, y,                                      // obligatoires
//   unit?: "%" | "px",                          // défaut "%" — position relative à cette pane
//   rotation?: number,                          // degrés, sens horaire — défaut 0
//   color?: string;
//   fontSize?: number;
//   align?: "left" | "center" | "right",        // défaut "left"
// }

// Un titre centré en haut d'un panneau
plot.pane("Momentum").label("titre", "Momentum", { x: 50, y: 8, align: "center" });

// Un texte tourné de 90°, collé au bord droit
plot.overlay("Prix").label("cote", "Zone haute", { x: 98, y: 20, rotation: 90, align: "right" });`
      ),
      t("Même règle « le dernier appel gagne » que .line/.area/.histogram/.band pour ce même name — pas besoin de bar.isNew() pour garder un label toujours à jour."),
      h("Marqueurs ponctuels", ["plot.signal", "plot.point", "plot.horizontal", "plot.vertical"]),
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
      h("Texte à côté d'un marqueur"),
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
      h("plot.table", ["plot.table"]),
      t(
        "plot.table(rows, options?) affiche un petit tableau ancré dans un coin de la chart (« RSI sur cinq timeframes », un score détaillé…) — ni série continue ni marqueur ponctuel : contrairement à pane.line, seul le dernier appel compte (pas d'historique accumulé), donc appelez-le sans condition à chaque bougie plutôt que de le protéger avec bar.isNew() — la chart affichera toujours la version la plus récente."
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
      h("plot.xy", ["plot.xy"]),
      t(
        "plot.xy(name, x, y, options?) trace un graphique complètement libre — deux tableaux de nombres, sans aucun lien avec les bougies ni les dates. C'est l'équivalent de matplotlib pour ce moteur : utile pour visualiser une fonction mathématique (une parabole, une gaussienne…) ou un nuage de points, pas pour un indicateur de trading. Contrairement à pane.line/overlay.line, on ne l'appelle pas bougie après bougie pour construire la courbe petit à petit : on passe le tableau complet en un seul appel, comme le ferait ax.scatter(x, y) ou ax.plot(x, y) en Python — seul le dernier appel pour un nom donné compte (même règle que plot.table)."
      ),
      c(
        `plot.xy(name, x, y, options?)
// x, y: number[] — même longueur, un point par indice
// options?: { color?; draw?: "line" | "scatter"; xLabel?; yLabel?; title? }  // draw par défaut : "line"

// Exemple : la parabole y = x²
const x = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
const y = x.map((v) => v * v);
plot.xy("Parabole", x, y, { xLabel: "x", yLabel: "y", title: "y = x²" });`
      ),
      t(
        "plot.xy n'est jamais affiché sur la vraie chart bougies/panneaux — il n'apparaît qu'en sortie d'une cellule (voir le mode notebook ci-dessous, et son propre tutoriel « Mode notebook » plus haut) : le nom passé sert uniquement à retrouver le graphique produit par une cellule donnée, pas à créer un panneau."
      ),
      t("x et y sont plafonnés à 2000 points chacun — au-delà, tronqués silencieusement plutôt que rejetés."),
      t(
        "Une valeur null au lieu d'un nombre marque un trou : la série n'est pas tracée sur cette barre, et n'est pas non plus raccordée par-dessus. C'est ce qui permet de découper une même courbe en plusieurs séries de couleurs différentes — chacune est alimentée à chaque barre, avec null sur celles qui appartiennent à une autre, si bien qu'aucune ne relie ses propres trous par un segment droit."
      ),
      t(
        "Ce découpage est nécessaire parce que la couleur d'une série est fixée par sa première barre : repasser une autre couleur à un appel suivant sur le même nom ne change rien. Pour une courbe qui change de couleur en cours de route — un nuage haussier/baissier, par exemple — il faut donc autant de séries que de couleurs."
      ),
      c(
        `// Une courbe bicolore : deux séries, chacune trouée là où l'autre dessine.
const hausse = cloture > ouverture;
pane.line("Tendance (hausse)", hausse ? cloture : null, { color: "#26a69a" });
pane.line("Tendance (baisse)", hausse ? null : cloture, { color: "#ef5350" });`
      ),
    ],
  },
  {
    id: "strategy",
    title: "strategy.*",
    group: "API du script",
    blocks: [
      t(
        "Disponible uniquement dans un script qui a déclaré @strategy (voir « Décrire et paramétrer un script »). C'est l'API qui prend des positions : le moteur les rejoue sur un compte simulé au fil des bougies, et le panneau ancré sous la chart en montre la courbe de P&L, les statistiques et la liste des trades."
      ),
      h("Passer un ordre", ["strategy.long", "strategy.short", "strategy.close"]),
      c(
        `strategy.long(commentaire?, options?)   // ouvre (ou renforce) une position longue
strategy.short(commentaire?, options?)  // idem à la vente
strategy.close(commentaire?)            // ferme tout ce qui est ouvert

// options : { size?: number, unit?: "contracts" | "currency" | "equityPercent" }`
      ),
      t(
        "Le commentaire nomme le trade : il apparaît sur le marqueur posé sur la bougie et reste attaché au trade dans la liste, ce qui est la seule façon de retrouver quelle règle a ouvert quoi dans une stratégie qui en a plusieurs."
      ),
      t(
        "Un ordre dans le sens opposé à la position en cours la retourne : le moteur ferme d'abord, puis ouvre de l'autre côté. C'est ce que « passer long alors qu'on est short » veut dire, et l'écrire en deux appels ne changerait rien au résultat."
      ),
      t(
        "Un ordre est exécuté une fois, à la fin de la bougie sur laquelle il a été passé, quel que soit le nombre de fois où le script a changé d'avis pendant cette bougie — il n'y a qu'un prix sur cette bougie auquel être exécuté. Aucune fuite de données futures n'est possible ici non plus : l'ordre ne connaît que les bougies déjà rejouées, exactement comme market.*."
      ),
      h("La taille d'un ordre", [".size", ".unit"]),
      t(
        "Sans options, l'ordre prend la taille par défaut définie dans les réglages du panneau. Avec, il la remplace pour ce seul ordre — dans l'unité de son choix :"
      ),
      l([
        '"contracts" — un nombre d\'unités de l\'instrument. Absolu, indépendant du prix.',
        '"currency" — un montant dans la devise du compte, converti en unités au prix d\'exécution. Dimensionne de la même façon des instruments cotés très différemment.',
        '"equityPercent" — un pourcentage de l\'équité courante. La seule des trois qui compose : une stratégie gagnante grossit toute seule, une perdante réduit.',
      ]),
      c(
        `strategy.long("Cassure");                                  // taille par défaut des réglages
strategy.long("Cassure", { size: 3 });                     // 3, dans l'unité par défaut
strategy.long("Cassure", { size: 500, unit: "currency" });  // 500 € de notionnel
strategy.long("Cassure", { size: 25, unit: "equityPercent" }); // un quart du compte`
      ),
      t(
        "La conversion se fait au moment de l'exécution, pas au moment de l'appel : deux des trois unités ont besoin d'un prix, et l'une d'elles de l'équité du compte à cet instant. Une taille qui ne donne rien d'exploitable (prix nul, compte à zéro) ne passe pas d'ordre plutôt que d'en passer un de taille infinie."
      ),
      h("Lire la position", ["strategy.position", "strategy.positionSize", "strategy.averagePrice", "strategy.unrealizedProfit"]),
      c(
        `strategy.position()          // "long" | "short" | "flat"
strategy.positionSize()      // number — unités détenues, toujours positif
strategy.averagePrice()      // number | null — prix moyen d'entrée, null à plat
strategy.unrealizedProfit()  // number — P&L latent au cours de la bougie courante`
      ),
      t(
        "Ces quatre lectures rendent conditionnelle une règle de sortie : « ne fermer que si on est en gain », « ne renforcer que sous le prix moyen ». Elles reflètent l'état *après* les bougies déjà rejouées et avant l'exécution des ordres de la bougie en cours — un ordre passé juste au-dessus n'est donc pas encore visible ici."
      ),
      h("Le panneau de stratégie"),
      t(
        "Il s'ouvre sous les bougies dès qu'un script @strategy est actif, à l'endroit où se placerait un MACD. Trois onglets : la performance (courbe de P&L cumulé, ruban des trades, statistiques), la liste des trades, et les réglages."
      ),
      t(
        "Les réglages sont séparés en deux blocs, et la distinction vaut la peine d'être gardée en tête. « Général » décrit votre compte : capital initial, devise, taille d'ordre par défaut et son unité, pyramiding (combien d'entrées peuvent être ouvertes en même temps), et le moment d'exécution. « Émulateur de broker » décrit le courtier que vous simulez : commission, leviers long et short, slippage et taille du tick. Confondre les deux, c'est lire comme une propriété de la stratégie ce qui n'était que le modèle de frictions."
      ),
      t(
        "Changer un réglage relance le script : la simulation vit à l'intérieur de l'exécution, il n'y a donc pas d'autre sens possible à donner à « recalculer avec une commission différente »."
      ),
      t(
        "Les statistiques ne portent que sur les trades clôturés. Une position encore ouverte à la fin du rejeu est affichée à part, avec son P&L latent : la compter comme un trade flatterait discrètement toutes les autres statistiques."
      ),
      h("D'un indicateur à une stratégie"),
      t(
        "Le bouton « créer une stratégie » d'une ligne « Mes scripts » construit une stratégie à partir de l'indicateur sélectionné — en deux fichiers : l'indicateur devient un module, et le nouveau script l'importe. C'est délibérément un import et non une copie : corriger l'indicateur corrige alors toutes les stratégies bâties dessus, là où une copie diverge en silence jusqu'au jour où un trade se déclenche sur une règle qu'on croyait déjà corrigée."
      ),
      t(
        "Ce que la stratégie générée peut lire dépend de ce que l'indicateur expose. S'il exporte quelque chose, ses exports sont importés et l'un d'eux est câblé dans un exemple. S'il n'exporte rien — le cas courant d'un indicateur qui ne fait que tracer — l'import est conservé pour son tracé, et le script généré explique à l'endroit exact où vous regardez comment rendre sa valeur réutilisable :"
      ),
      c(
        `// dans l'indicateur : extraire le calcul, il continue de tracer exactement pareil
export function signal() {
  return ta.rsi(market.series("close", 70), 14);
}
plot.pane("RSI").line("RSI", signal());

// dans la stratégie
import { signal } from "./mon-rsi";
if (signal() < 30) strategy.long("Survente");`
      ),
      h("Sharpe et Sortino"),
      t(
        "Les deux ratios de rendement ajusté au risque du panneau sont calculés sur la courbe d'équité barre par barre, pas sur la liste des trades : ils mesurent la volatilité du compte, et un compte est tout aussi exposé entre deux trades que pendant l'un d'eux. Le calculer par trade répondrait à une autre question."
      ),
      t(
        "L'annualisation est mesurée, pas supposée. Le moteur ignore si une bougie vaut une minute ou un mois, et un 252 ou un 365 codé en dur serait faux pour la plupart des graphes. Compter combien de bougies tombent réellement dans une année du temps écoulé des données donne le bon facteur dans tous les cas — environ 252 pour du quotidien actions avec ses week-ends, ~35 000 pour du 15 minutes en crypto — parce que les trous sont déjà dans les horodatages. Un taux sans risque de 0 est supposé, la convention par défaut de tous les outils de backtest."
      ),
      t(
        "Sharpe divise par l'écart-type de tous les rendements ; Sortino par la seule déviation des pertes. Sharpe pénalise donc une stratégie pour ses bonnes surprises autant que pour ses mauvaises, l'écart-type ne sachant pas les distinguer."
      ),
      t(
        "Conséquence : sur toute stratégie rentable, Sortino est presque toujours SUPÉRIEUR à Sharpe — avec un rendement moyen positif, une barre perdante est plus loin de la moyenne qu'elle ne l'est de zéro, donc la déviation à la baisse est la plus petite des deux. Ce qu'il faut lire, c'est l'ÉCART entre les deux : large, il dit que la volatilité était surtout haussière, ce qui ne coûte rien ; étroit, il dit que les à-coups étaient surtout des pertes — et que le Sharpe est bas pour la raison qui compte vraiment. Aucun des deux chiffres ne le dit seul, d'où leur présence conjointe."
      ),
      t(
        "Un tiret à la place d'un chiffre veut dire que le ratio n'a pas de sens ici, pas qu'il vaut zéro : moins de deux barres, une courbe d'équité qui n'a jamais bougé, ou — pour Sortino — une stratégie qui n'a jamais eu de barre perdante, donc rien à mettre au dénominateur."
      ),
      h("Marge et levier"),
      t(
        "Une entrée dont le notionnel dépasse ce que le compte peut porter — son équité multipliée par le levier du sens concerné — est refusée. Le compteur « Ordres refusés » du panneau les dénombre : une stratégie qui montre trois trades là où son auteur en attendait trois cents doit pouvoir dire que c'était faute de marge, et non parce que ses règles ne se sont jamais déclenchées."
      ),
      t(
        "Le levier borne donc l'exposition ; il ne multiplie pas le résultat d'une position d'une taille donnée. La taille est déjà celle que le script a demandée, et la multiplier en plus afficherait des gains qu'aucun compte n'aurait pu réaliser."
      ),
      t(
        "C'est aussi pourquoi la taille par défaut est un pourcentage de l'équité et non un nombre de contrats : « 1 contrat » vaut 40 € sur un instrument et 75 000 € sur un autre, donc sur un instrument cher tous les ordres seraient refusés et la stratégie afficherait zéro trade pour des raisons étrangères à ses règles."
      ),
    ],
  },
  {
    id: "company",
    title: "company.*",
    group: "API du script",
    blocks: [
      t(
        "company.* donne accès aux fondamentaux publiés par la société — le pendant de market.* pour les chiffres d'entreprise plutôt que pour le prix."
      ),
      h("company.value(champ, offset?)", ["company.value"]),
      c(
        `const per = company.value("peRatio");
const bpaPrecedent = company.value("eps", 20); // 20 bougies plus tôt
if (per !== null && per < 15) plot.signal("BUY");`
      ),
      t(
        "Un chiffre publié ne change qu'aux dates de publication : entre deux rapports, company.value renvoie la dernière valeur connue, exactement comme un panneau fondamental l'affiche en escalier. Avant le tout premier rapport, ou pour une métrique que l'hôte n'a pas fournie, la réponse est null — jamais une valeur inventée."
      ),
      t("Les champs disponibles, quand l'hôte les fournit :"),
      l([
        "eps — bénéfice par action.",
        "peRatio — ratio cours/bénéfice.",
        "netIncome — résultat net.",
        "totalRevenue — chiffre d'affaires.",
        "netMargin / grossMargin — marges, en pourcentage.",
        "freeCashFlow — flux de trésorerie disponible.",
        "debtToEquity — dette rapportée aux fonds propres.",
      ]),
      h("company.fields()", ["company.fields"]),
      t(
        "La liste des métriques réellement disponibles sur ce graphe. Tous les graphes n'ont pas les mêmes : une action peut avoir un P/E sans marge brute, un indice n'en a aucune. Lire cette liste évite d'écrire un script qui suppose une donnée absente."
      ),
      t(
        "Comme market.*, ces lectures sont bornées à la bougie en cours : un offset négatif, ou qui dépasserait la bougie courante, renvoie null. Aucun script ne peut lire un rapport qui n'était pas encore publié."
      ),
    ],
  },
  {
    id: "state",
    title: "state.*",
    group: "API du script",
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
    group: "API du script",
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
    title: "bar.*",
    group: "API du script",
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
    title: "math.*",
    group: "Fonctions utilitaires",
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
    title: "ta.*",
    group: "Fonctions utilitaires",
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
      t(
        "Les moyennes mobiles ci-dessous complètent sma/ema. Toutes prennent un tableau ordonné de la plus ancienne valeur à la plus récente — l'ordre que market.series renvoie — et retournent la lecture de la barre courante :"
      ),
      c(
        `ta.wma(values, period)                              // number | null
ta.hma(values, period)                              // number | null
ta.alma(values, period, offset?, sigma?)            // number | null — défauts 0.85 / 6
ta.swma(values)                                     // number | null — fenêtre fixe de 4 barres
ta.vwma(values, volumes, period)                    // number | null
ta.zlema(values, period)                            // number | null`
      ),
      t(
        "wma pondère linéairement : la valeur la plus récente compte « période » fois, la plus ancienne une seule. hma (Hull) vaut wma(2·wma(n/2) − wma(n), √n) : elle tourne bien plus vite qu'une wma de même longueur, au prix d'un dépassement sur un retournement brutal, et exige période + √période barres avant de renvoyer autre chose que null. alma applique une fenêtre gaussienne dont le sommet se place à « offset » du parcours — 1 sur la barre la plus récente (la plus réactive, la moins lisse), 0 sur la plus ancienne — « sigma » réglant la vitesse à laquelle le poids retombe de part et d'autre de ce sommet : plus sigma est grand, plus la fenêtre est étroite et plus la moyenne colle au prix. swma pondère les quatre dernières valeurs à 1/6, 2/6, 2/6, 1/6 : sa fenêtre est fixe par définition, elle ne prend donc pas de période. vwma pondère chaque prix par le volume échangé dessus, si bien qu'une barre calme la déplace moins qu'une barre active — passez-lui deux séries alignées barre par barre. zlema lisse 2·prix − prix[décalage] avec un décalage de la moitié de la période : la soustraction compense d'avance le retard qu'introduit une ema, elle tourne donc plus tôt, et dépasse quand le prix se retourne — c'est le marché qui est fait."
      ),
    ],
  },
  {
    id: "console",
    title: "console.log",
    group: "Fonctions utilitaires",
    blocks: [
      t("console.log(...) fonctionne normalement et s'affiche dans la console de l'éditeur, sous le graphique — pratique pour déboguer un script pendant son écriture. Les autres méthodes de console ne sont pas capturées."),
    ],
  },
  {
    id: "security",
    title: "Sécurité et limites",
    group: "Référence",
    blocks: [
      l([
        "Aucun accès réseau — fetch, XMLHttpRequest, WebSocket, importScripts et navigator.sendBeacon sont bloqués et lèvent une erreur explicite si un script tente de les appeler.",
        "Aucun accès au stockage du navigateur — indexedDB et l'API Cache sont bloqués de la même façon.",
        "Aucun sous-Worker — un script ne peut pas créer son propre Worker (ce qui aurait été un moyen de contourner les restrictions ci-dessus).",
        "Ni eval ni Function — les deux autres routes vers du code qui n'apparaît nulle part dans le texte du script sont bloquées elles aussi.",
        "Aucun accès aux variables ou au code de l'application hôte — le script ne reçoit que les API documentées ici, rien d'autre.",
        "Délai d'exécution — 8 secondes pour un rejeu complet, 1,5 seconde pour un tick temps réel ; au-delà, l'exécution est interrompue de force.",
        "market.series() est plafonné à 5000 points, quelle que soit la longueur demandée.",
        "plot.xy() et pane.profile() sont plafonnés à 2000 points chacun — au-delà, tronqués silencieusement plutôt que rejetés.",
        "plot.table() est plafonné à 50 lignes et 200 caractères par cellule — au-delà, tronqué silencieusement plutôt que rejeté.",
        "L'anti-rafale des ticks en direct (DEBOUNCE_MS, voir plus haut) est de 300 ms par défaut pour tout script qui ne le déclare pas.",
      ]),
      t("Math, Date, JSON, Array, Map et Set restent pleinement utilisables — ce sont des briques de calcul pures, sans risque."),
      h("Erreurs courantes"),
      t("Ce que l'éditeur affiche exactement quand quelque chose ne va pas, pour reconnaître chaque cas :"),
      l([
        "« Le script a dépassé le délai d'exécution autorisé et a été arrêté. » — le script est trop lent (une boucle qui tourne trop longtemps, un calcul lourd relancé à chaque bougie), pas une erreur de syntaxe. Voir les délais ci-dessus.",
        '« "fetch" n\'est pas accessible depuis un script. » (ou XMLHttpRequest/WebSocket/importScripts/Worker/indexedDB/caches/Notification/postMessage/Function/eval selon ce qui a été appelé) — une des restrictions de sécurité ci-dessus, pas un bug du script.',
        "Une erreur de syntaxe (avant même la première exécution) n'a jamais de numéro de ligne, sur aucun moteur — seul le message est disponible pour celle-là.",
        "Sous Safari/WebKit, aucune erreur survenant *pendant* l'exécution n'indique de numéro de ligne non plus, quelle que soit l'erreur — seul le message l'est. Chrome et Firefox en fournissent un dans la plupart des cas.",
      ]),
    ],
  },
  {
    id: "examples",
    title: "Exemples",
    group: "Référence",
    // Whole-section override — see ScriptDocumentationModal.tsx's own doc on "tutorial"/
    // "keywords" for the same pattern: plain data (scriptExamples.ts's own SCRIPT_EXAMPLES) drives
    // a dedicated component (ScriptExamplesSection.tsx) instead of these `blocks`, so each of the
    // eight examples gets a real "Exécuter" button and a live chart underneath instead of just
    // syntax-highlighted text (exigence : « je veux pouvoir exécuter les scripts d'exemples »).
    // scriptDocsNav.ts derives this section's own sub-nav from SCRIPT_EXAMPLES directly (not from
    // `blocks`, which is empty here) so the eight example titles still work as nav sub-items.
    blocks: [],
  },
];
