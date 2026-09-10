import { fns, t, type ScriptReferenceSection } from "./blocks";

export const COMPANY_SECTION: ScriptReferenceSection = {
  id: "company",
  title: "company.*",
  group: "API du script",
  blocks: [
    t(
      "Ce que l'entreprise a publié, lu à la barre en cours d'exécution. C'est le pendant fondamental de market.* : mêmes bornes, mêmes décalages, même garantie de ne jamais voir l'avenir."
    ),
    t(
      "Cette bibliothèque n'a aucune source de données : tout ce qui est lisible ici a été fourni par l'application (prop fundamentals du graphique). Un champ qu'elle n'a pas transmis n'existe pas — d'où company.fields(), à interroger avant de supposer."
    ),
    t(
      "Chaque publication est projetée en escalier sur les barres : la valeur reste celle du dernier rapport jusqu'au suivant, et vaut null avant le premier. C'est exactement ce que montrent les panneaux fondamentaux de la chart, si bien qu'un script et un panneau ne peuvent pas afficher deux chiffres différents pour la même barre."
    ),
    ...fns([
      {
        signature: "company.value(field, offset?)",
        keywords: ["company.value"],
        purpose:
          "Une métrique publiée, à la barre courante ou en arrière. C'est par là que passent le chiffre d'affaires, le résultat, les marges, le CAPEX, les impôts, la dette, le ROIC — tout ce que l'application a transmis.",
        params: [
          "field — le nom de la métrique, tel que company.fields() le renvoie : \"totalRevenue\", \"netIncome\", \"capex\", \"taxExpense\", \"returnOnInvestedCapital\"…",
          "offset — de combien de barres remonter. 0 (défaut) = la barre en cours. Un offset négatif renvoie null : on ne lit pas l'avenir.",
        ],
        returns:
          "un nombre, ou null — si le champ n'a jamais été fourni, si la barre visée précède la première publication, ou si l'offset sort de l'historique.",
        example: `const ca = company.value("totalRevenue");
const caIlYAUnAn = company.value("totalRevenue", 252);
const croissance = ca !== null && caIlYAUnAn ? (ca / caIlYAUnAn - 1) * 100 : null;`,
        caveat:
          "Le décalage se compte en BARRES, pas en exercices. « Il y a un an » dépend de l'unité de temps et de la longueur de l'historique : déduisez vos décalages de market.series(\"close\").length plutôt que de supposer 252 séances.",
      },
      {
        signature: "company.fields()",
        keywords: ["company.fields"],
        purpose:
          "Les métriques réellement disponibles pour ce symbole. Un rapport honnête commence par les regarder : c'est la différence entre dire « le CAPEX n'a pas été communiqué » et afficher un tiret sans explication.",
        params: [],
        returns: "un tableau de noms de champs. Vide si l'application n'a transmis aucune donnée fondamentale.",
        example: `const dispo = company.fields();
if (!dispo.includes("capex")) report.text("CAPEX non communiqué par la source de données.");`,
      },
    ]),
  ],
};

export const STATE_SECTION: ScriptReferenceSection = {
  id: "state",
  title: "state.*",
  group: "API du script",
  blocks: [
    t(
      "La mémoire d'un script d'une barre à l'autre. Le script est ré-exécuté à chaque barre, dans une portée neuve : une variable ordinaire ne survit pas d'un appel au suivant. state.* est le seul endroit où poser ce qui doit persister — un compteur, le prix d'entrée d'une position, l'état d'une machine."
    ),
    t(
      "Cette mémoire vit le temps d'une exécution complète, du premier au dernier chandelier. Elle repart de zéro à chaque nouvelle exécution : ce n'est pas une sauvegarde, c'est un accumulateur de rejeu."
    ),
    ...fns([
      {
        signature: "state.get(key, defaultValue?)",
        keywords: ["state.get"],
        purpose: "Relit ce qui a été posé aux barres précédentes.",
        params: [
          "key — un nom de votre choix, unique dans ce script.",
          "defaultValue — ce qui est renvoyé si la clé n'a jamais été écrite. Évite d'avoir à tester l'absence à chaque barre.",
        ],
        returns: "la valeur telle qu'elle a été écrite, ou defaultValue, ou undefined si aucun défaut n'a été donné.",
        example: `const barresDepuisSignal = state.get("depuis", 0);
state.set("depuis", barresDepuisSignal + 1);`,
      },
      {
        signature: "state.set(key, value)",
        keywords: ["state.set"],
        purpose: "Écrit une valeur que les barres suivantes reliront.",
        params: [
          "key — le nom sous lequel relire.",
          "value — n'importe quelle valeur : nombre, chaîne, booléen, objet, tableau. Elle est conservée telle quelle, sans copie.",
        ],
        returns: "rien.",
        caveat:
          "La valeur n'est pas copiée : si vous y rangez un objet et le modifiez ensuite, les barres suivantes verront la modification. C'est pratique pour un accumulateur, surprenant pour un instantané — rangez une copie si vous vouliez figer.",
      },
    ]),
  ],
};

export const BAR_SECTION: ScriptReferenceSection = {
  id: "bar",
  title: "bar.*",
  group: "API du script",
  blocks: [
    t(
      "Où en est l'exécution : s'agit-il d'une barre qu'on découvre, d'une barre close, d'un rejeu ou du temps réel. Trois questions qui décident si une action doit être prise maintenant ou attendre."
    ),
    ...fns([
      {
        signature: "bar.isNew()",
        keywords: ["bar.isNew"],
        purpose:
          "Vrai à la première évaluation d'une barre donnée. Sert à n'agir qu'une fois par chandelier, quand un même chandelier peut être ré-évalué plusieurs fois en temps réel.",
        params: [],
        returns: "un booléen.",
        example: `if (bar.isNew()) state.set("compteur", state.get("compteur", 0) + 1);`,
      },
      {
        signature: "bar.isClosed()",
        keywords: ["bar.isClosed"],
        purpose:
          "Vrai quand la barre en cours est terminée. C'est le garde-fou d'une stratégie : agir sur une barre encore en formation, c'est agir sur un prix qui peut encore repasser de l'autre côté du seuil avant la clôture.",
        params: [],
        returns:
          "un booléen. Toujours vrai si l'application n'a pas indiqué que le marché est ouvert (prop lastCandleOpen) — le choix conservateur : un script qui attend la clôture ne doit pas rester bloqué faute d'information.",
        example: `if (bar.isClosed() && market.close(0) > seuil) strategy.long("cassure confirmée");`,
      },
      {
        signature: "bar.isRealtime()",
        keywords: ["bar.isRealtime"],
        purpose:
          "Distingue le rejeu de l'historique d'une ré-exécution déclenchée par une nouvelle barre. Sert à ne déclencher une alerte que sur du direct, sans en émettre des centaines en rejouant deux ans d'archives.",
        params: [],
        returns: "un booléen : faux pendant un rejeu historique ou une exécution manuelle, vrai sur un tick live.",
        example: `if (bar.isRealtime() && croisement) alert("croisement à l'instant");`,
      },
    ]),
  ],
};

export const ALERT_SECTION: ScriptReferenceSection = {
  id: "alert",
  title: "alert(message)",
  group: "API du script",
  blocks: [
    t(
      "Signale un évènement à l'application qui héberge le graphique. Le script produit l'évènement ; ce qu'il devient — une notification, un son, une ligne dans un journal, un e-mail — appartient entièrement à l'application (prop onScriptAlert)."
    ),
    ...fns([
      {
        signature: "alert(message)",
        keywords: ["alert"],
        purpose:
          "Émet un évènement horodaté à la barre en cours. C'est le seul moyen pour un script de dire quelque chose au monde extérieur.",
        params: ["message — le texte à transmettre. Converti en chaîne s'il ne l'est pas."],
        returns: "rien.",
        example: `if (rsi !== null && rsi > 80) alert("RSI au-dessus de 80 sur " + market.symbol());`,
        caveat:
          "La liste des alertes est reconstruite depuis la première barre à chaque exécution : rejouer tout l'historique produit toutes les alertes de cet historique. Bornez avec bar.isRealtime() si vous ne voulez que le direct.",
      },
    ]),
  ],
};
