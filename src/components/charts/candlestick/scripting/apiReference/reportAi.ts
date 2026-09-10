import { fns, t, c, type ScriptReferenceSection } from "./blocks";

export const REPORT_SECTION: ScriptReferenceSection = {
  id: "report",
  title: "report.*",
  group: "API du script",
  blocks: [
    t(
      "Disponible uniquement dans un script ayant déclaré @report. Un rapport ne dessine rien et ne renvoie rien : il ÉCRIT UN DOCUMENT, section après section, dans l'ordre où elles seront lues. Il s'exécute une seule fois, positionné sur la dernière barre — market.* et company.* voient donc tout l'historique d'un coup."
    ),
    t(
      "Sept blocs, et pas davantage. C'est ce qu'un rapport contient : un titre, des intertitres, du texte, une grille de chiffres clés, un tableau, une petite série dessinée, et un encart pour conclure. Tout le reste s'écrit en toutes lettres — chaque forme supplémentaire serait une chose de plus que le panneau, la page imprimée et le modèle devraient tous comprendre de la même façon."
    ),
    t(
      "Le document s'affiche à côté du code et s'exporte en PDF. C'est le navigateur qui imprime : le texte reste sélectionnable et la pagination est la vraie, pas une image."
    ),
    ...fns([
      {
        signature: "report.title(title, options?)",
        keywords: ["report.title"],
        purpose:
          "Nomme le rapport. Appelée plusieurs fois, la dernière gagne — un script qui calcule son titre d'après les données qu'il vient de lire n'a donc pas à le connaître d'avance.",
        params: [
          "title — le titre du document.",
          "options.subtitle — une ligne sous le titre : la période couverte, la nature de l'analyse.",
          "options.symbol — le symbole dont il est question, affiché à côté de la date de génération.",
        ],
        returns: "rien.",
        example: `report.title("Analyse fondamentale", { subtitle: "Quatre exercices", symbol: market.symbol() });`,
      },
      {
        signature: "report.heading(text, options?)",
        keywords: ["report.heading"],
        purpose: "Ouvre une section. C'est ce qui donne au document sa structure, et à la lecture ses points d'accroche.",
        params: ["text — l'intertitre.", "options.level — 2 (défaut) pour une section, 3 pour une sous-section."],
        returns: "rien.",
      },
      {
        signature: "report.text(text)",
        keywords: ["report.text"],
        purpose:
          "Un paragraphe. C'est là que se dit ce que les chiffres ne disent pas : pourquoi une évolution compte, ce qui manque, ce dont on n'est pas sûr.",
        params: ["text — le paragraphe."],
        returns: "rien.",
      },
      {
        signature: "report.metrics(metrics)",
        keywords: ["report.metrics"],
        purpose:
          "Une grille de chiffres clés — ce qu'un lecteur regarde avant de lire quoi que ce soit. À placer en tête plutôt qu'au fil du texte.",
        params: [
          "metrics — un tableau d'objets { label, value, note?, tone? }.",
          "label — le nom de la mesure.",
          "value — sa valeur, DÉJÀ FORMATÉE : c'est le script qui décide des unités et des décimales, le rapport n'arrondit rien dans votre dos.",
          "note — une précision sous la valeur : une comparaison, une date de référence.",
          'tone — "up", "down" ou "neutral" (défaut) : colore la valeur.',
        ],
        returns: "rien. Au-delà de 24 entrées, les suivantes sont ignorées — ce n'est plus une grille de chiffres clés.",
        example: `report.metrics([
  { label: "Chiffre d'affaires", value: "138 Md", tone: "up" },
  { label: "ROIC", value: "27,3 %", note: "vs 21,4 % il y a quatre ans" },
]);`,
      },
      {
        signature: "report.table(columns, rows, options?)",
        keywords: ["report.table"],
        purpose: "Un tableau de chiffres. La forme à préférer dès qu'on compare plusieurs périodes ou plusieurs postes.",
        params: [
          "columns — les en-têtes, dans l'ordre.",
          "rows — un tableau de lignes, chaque ligne étant un tableau de cellules alignées sur columns. Une cellule peut être une chaîne, un nombre, ou null pour une donnée absente (affichée « — »).",
          "options.title — un titre au-dessus du tableau : l'unité, le périmètre.",
        ],
        returns: "rien. Au-delà de 400 lignes, les suivantes sont ignorées.",
        example: `report.table(
  ["Exercice", "CA", "Résultat net"],
  [["N-1", 121, 27], ["N", 138, 32]],
  { title: "En milliards" }
);`,
      },
      {
        signature: "report.series(title, labels, values, options?)",
        keywords: ["report.series"],
        purpose:
          "Une petite série dessinée — un chiffre d'affaires sur huit ans, un CAPEX sur quatre. Ce n'est pas un graphique complet : un rapport se lit, et le lecteur qui veut interroger une série a la chart pour ça.",
        params: [
          "title — ce que la série représente.",
          "labels — les étiquettes de l'axe, dans l'ordre.",
          "values — les valeurs, alignées sur labels. null pour un point manquant.",
          "options.unit — l'unité, affichée à côté de la dernière valeur.",
        ],
        returns: "rien. Au-delà de 400 points, les suivants sont ignorés.",
        example: `report.series("CAPEX", ["N-3", "N-2", "N-1", "N"], [7.0, 8.2, 9.1, 10.4], { unit: "Md" });`,
      },
      {
        signature: "report.callout(tone, title, text)",
        keywords: ["report.callout"],
        purpose:
          "Un encart mis à part : le seul endroit où un rapport a le droit de CONCLURE plutôt que de rapporter. À réserver au jugement, pas à un fait de plus.",
        params: [
          'tone — "positive", "negative" ou "neutral" : colore le liseré.',
          "title — la conclusion en quelques mots.",
          "text — ce qui la justifie.",
        ],
        returns: "rien.",
        example: `report.callout("positive", "Rentabilité durablement élevée",
  "Un ROIC au-dessus de 20 % pendant quatre ans sans dilution est le signe d'une barrière à l'entrée.");`,
      },
    ]),
  ],
};

export const AI_SECTION: ScriptReferenceSection = {
  id: "ai",
  title: "ai.*",
  group: "API du script",
  blocks: [
    t(
      "Le seul appel de tout le bac à sable qui sort du worker. Le script pose une question, la fenêtre principale la transmet au modèle configuré par l'application (prop ai du graphique), et renvoie la réponse. Le worker ne voit jamais de clé et n'ouvre jamais de connexion : une chaîne sort, une chaîne revient."
    ),
    t(
      "Il faut l'attendre avec await, et c'est pourquoi ai.* n'existe que dans un @quant ou un @report : eux s'exécutent une seule fois. Un @indicator ou un @strategy s'exécute une fois par bougie — attendre une réponse réseau à chaque bougie ne serait plus un rejeu. L'éditeur le signale avant l'exécution."
    ),
    t(
      "Une question qui échoue — aucun moteur configuré, refus du fournisseur — lève une erreur ordinaire, à attraper avec try/catch : un rapport qui interroge le modèle sur un point secondaire ne devrait pas mourir parce que ce point est resté sans réponse. Et le délai d'exécution du script continue de courir pendant l'attente : une réponse lente reste une exécution lente."
    ),
    ...fns([
      {
        signature: "await ai.ask(prompt, options?)",
        keywords: ["ai.ask"],
        purpose: "Pose une question et attend la réponse en texte.",
        params: [
          "prompt — la question.",
          "options.search — à vrai, active la recherche web du fournisseur pour cette question. Faux par défaut : une recherche que l'auteur n'a pas demandée est une dépense qu'il n'a pas prévue.",
          "options.system — remplace les instructions de rôle par défaut, si vous voulez cadrer la réponse autrement.",
        ],
        returns: "une promesse de chaîne. Lève une erreur si aucun moteur n'est configuré ou si le fournisseur refuse.",
        example: `const resume = await ai.ask("Résume l'activité de " + market.symbol() + " en trois phrases.");
report.text(resume);`,
      },
      {
        signature: "await ai.search(query)",
        keywords: ["ai.search"],
        purpose:
          "Une question qui nécessite le web. Raccourci exact de ai.ask(query, { search: true }) — il existe parce que « cherche sur internet » est une intention à part entière et se lit mieux comme un verbe.",
        params: ["query — ce qu'on cherche."],
        returns: "une promesse de chaîne.",
        example: `const actus = await ai.search("résultats trimestriels " + market.symbol());`,
        caveat:
          "N'a d'effet que si l'application a activé les outils du fournisseur (prop ai.serverTools). Sans cela, la question part sans recherche.",
      },
      {
        signature: "await ai.json(prompt, options?)",
        keywords: ["ai.json"],
        purpose:
          "Demande une structure plutôt qu'un texte, et la parse. Utile quand la réponse doit alimenter un calcul ou un tableau plutôt qu'un paragraphe.",
        params: ["prompt — la question, en précisant la forme attendue.", "options.search / options.system — comme pour ask."],
        returns:
          "une promesse de la valeur parsée, ou null si la réponse n'était pas du JSON valide. Le bloc de code dont un modèle entoure souvent le JSON est retiré automatiquement.",
        example: `const note = await ai.json("Note la solidité du bilan sur 10. Réponds au format { note, raison }.");
if (note !== null) report.metrics([{ label: "Solidité", value: String(note.note) + "/10", note: note.raison }]);`,
        caveat: "Renvoie null plutôt que de lever : un modèle qui a répondu en prose a répondu, simplement pas dans la forme demandée.",
      },
    ]),
    c(`@report
// Les trois formes, dans un rapport.
const resume = await ai.ask("Résume l'activité en trois phrases.");
const actus = await ai.search("actualités récentes " + market.symbol());
const note = await ai.json("Note la solidité du bilan sur 10, format { note, raison }.");`),
  ],
};
