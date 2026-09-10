/** L'ordre de lecture de la documentation du scripting.
 *
 *  Le contenu lui-même vit dans `apiReference/`, un fichier par famille : chaque outil y a sa
 *  propre sous-section (titre, ce à quoi il sert, paramètres, ce qu'il renvoie, exemple, pièges),
 *  ce qui fait plusieurs milliers de lignes qu'un fichier unique ne pourrait plus porter. Ce
 *  fichier n'est plus que l'assemblage, et reste la porte d'entrée que tout le reste importe.
 *
 *  Ce qui est écrit là-bas doit correspondre à l'implémentation réelle (`worker/build*Api.ts`,
 *  `worker/mathLib.ts`, `worker/taLib.ts`) : si l'une change, l'autre aussi. */
export type { ScriptReferenceBlock, ScriptReferenceSection } from "./apiReference/blocks";
import { t, c, l, d, h, type ScriptReferenceSection } from "./apiReference/blocks";
import { MARKET_SECTION } from "./apiReference/market";
import { CHART_SECTION, STRATEGY_SECTION } from "./apiReference/chartStrategy";
import { PLOT_SECTION } from "./apiReference/plot";
import { COMPANY_SECTION, STATE_SECTION, BAR_SECTION, ALERT_SECTION } from "./apiReference/companyStateBarAlert";
import { REPORT_SECTION, AI_SECTION } from "./apiReference/reportAi";
import { MATH_SECTION } from "./apiReference/math";
import { TA_SECTION } from "./apiReference/ta";

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
        "Cinq mots-clés ne font pas partie de l'API exécutée : ils se lisent dans le texte du script lui-même, avant que quoi que ce soit ne tourne. @indicator, @strategy ou @quant dit ce qu'est le script, @description le documente, new Variable(...) en expose les réglages, et @block le découpe en cellules (voir « L'éditeur » plus haut). Tous sont retirés du code avant compilation — aucun n'existe à l'exécution."
      ),
      h("@indicator / @strategy / @quant — ce qu'est le script", ["@indicator", "@strategy"]),
      t(
        "Un script est l'un des trois, déclaré sur sa propre ligne, en général tout en haut. @indicator dessine sur la chart : des courbes, des bandes, des marqueurs. @strategy fait la même chose et prend en plus des positions, qui sont rejouées sur un compte simulé et lues dans un panneau dédié ancré sous les bougies. @quant ne dessine rien du tout."
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
        "Ce n'est pas une étiquette : c'est ce décorateur qui donne — ou refuse — l'accès à strategy.*. Un script @indicator n'a tout simplement pas cet objet, et l'appeler échoue en nommant ce qui manque, plutôt que d'ouvrir silencieusement une position que personne n'a demandée. Un script qui ne déclare rien est un indicateur : c'est ce qu'était tout script écrit avant l'existence de ces décorateurs, et ce que reste l'immense majorité d'entre eux. En déclarer plusieurs est une contradiction, signalée comme telle dans l'éditeur."
      ),
      h("@quant — une analyse qui ne dessine pas", ["@quant"]),
      t(
        "Une analyse @quant n'a ni pane ni overlay : elle ne produit rien sur la chart, et plot.* n'y est pas disponible — l'éditeur le signale avant l'exécution, et l'appeler échoue en nommant ce qu'il faut faire à la place. Ce qu'elle renvoie avec return est la totalité de son résultat."
      ),
      t(
        "Elle ne tourne pas non plus une fois par bougie mais une fois par symbole, positionnée sur la dernière bougie de chacun — market.* voit donc tout l'historique d'un coup. Les symboles se déclarent entre parenthèses ; sans liste, l'analyse tourne sur le symbole de la chart. Les bougies des autres symboles viennent de l'application (prop quantData) : cette bibliothèque n'a pas de source de données, et un symbole sans données revient avec sa propre ligne « aucune donnée » au lieu de faire échouer toute l'analyse."
      ),
      c(
        `@quant(AAPL, MSFT, NVDA)
const closes = market.series("close", 260);
const last = closes[closes.length - 1];
return { cours: last, "plus haut": Math.max(...closes) };`
      ),
      t(
        "Le résultat s'affiche dans l'éditeur, à côté du code, une section par symbole. Une analyse peut être longue et sa réponse est un constat daté, pas une lecture en direct : chaque calcul peut donc être enregistré et relu plus tard sans être refait, depuis la même section."
      ),
      h("@report — écrire un document", ["@report"]),
      t(
        "Un @report ne dessine rien non plus, et ne renvoie rien : il écrit un document. Il s'exécute une fois, positionné sur la dernière bougie — market.* et company.* voient donc tout l'historique — et chaque appel à report.* ajoute une section, dans l'ordre où elle sera lue."
      ),
      t(
        "Sept blocs, et pas davantage : un titre, des sous-titres, du texte, une grille de chiffres clés, un tableau, une petite série dessinée, et un encart pour conclure. C'est ce qu'un rapport contient ; tout le reste s'écrit en toutes lettres. Le document s'affiche à côté du code et s'exporte en PDF — c'est le navigateur qui imprime, donc le texte reste sélectionnable et la pagination est la vraie."
      ),
      c(
        `@report
report.title("Analyse fondamentale", { symbol: market.symbol() });
report.metrics([{ label: "Chiffre d'affaires", value: company.value("totalRevenue") }]);
report.table(["Exercice", "CA"], [["N", company.value("totalRevenue")]]);
report.callout("positive", "Rentabilité élevée", "Le ROIC dépasse 20 % depuis quatre ans.");`
      ),
      h("ai.* — dans un script", []),
      t(
        "Un @quant et un @report peuvent interroger un modèle et attendre sa réponse — c'est le seul appel du bac à sable qui sort du worker. Voir la section ai.* pour les trois fonctions, leurs paramètres et leurs pièges."
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
  MARKET_SECTION,
  CHART_SECTION,
  PLOT_SECTION,
  STRATEGY_SECTION,
  COMPANY_SECTION,
  REPORT_SECTION,
  AI_SECTION,
  STATE_SECTION,
  ALERT_SECTION,
  BAR_SECTION,
  MATH_SECTION,
  TA_SECTION,
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
