import { CHART_AI_TOOL_DEFINITIONS } from "./aiTools";
import { firstSentence } from "./toolHelpers";

/**
 * Le catalogue des outils de l'assistant du graphique (et du pont MCP), groupés, en une ligne chacun : la source unique
 * des listes affichées par une application (page MCP, administration, documentation). Tiré des définitions mêmes des
 * outils, il ne peut pas se désynchroniser d'eux ; un outil sans groupe connu tombe dans « Divers ».
 */

export interface ChartAiToolCatalogEntry {
  group: string;
  name: string;
  /** La première phrase de la description de l'outil. */
  summary: string;
  description: string;
}

/** L'ordre et le nom des groupes, et les outils de chacun. */
export const CHART_AI_TOOL_GROUPS: { group: string; tools: string[] }[] = [
  { group: "Lecture", tools: ["decrire_le_graphique", "lire_les_prix", "lire_les_donnees_fondamentales", "capturer_le_graphique"] },
  { group: "Navigation", tools: ["naviguer_dans_le_temps"] },
  { group: "Zones", tools: ["selectionner_une_zone", "lire_une_zone"] },
  { group: "Axes", tools: ["regler_l_axe_vertical", "regler_les_axes"] },
  { group: "Symboles et type de graphique", tools: ["changer_de_symbole", "changer_l_unite_de_temps", "changer_le_type_de_graphique", "gerer_les_comparaisons"] },
  {
    group: "Indicateurs et panneaux",
    tools: [
      "lister_les_indicateurs_disponibles",
      "lister_les_indicateurs_existants",
      "ajouter_un_indicateur",
      "retirer_un_indicateur",
      "regler_indicateur",
      "regler_panneau",
      "afficher_le_volume",
      "regler_le_style_conditionnel",
      "appliquer_un_modele",
    ],
  },
  { group: "Apparence et affichage", tools: ["regler_apparence", "regler_l_affichage", "regler_le_filigrane"] },
  { group: "Dessins", tools: ["dessiner", "gerer_les_dessins", "tracer_un_canal", "marquer_des_seances"] },
  { group: "Paramètres, interface et clic droit", tools: ["ouvrir_les_parametres", "interagir_avec_l_interface", "menu_contextuel", "lister_les_boutons_de_l_interface", "montrer_un_bouton"] },
  { group: "Fenêtres et comparaisons", tools: ["gerer_les_fenetres", "synchroniser_les_fenetres", "comparer_cote_a_cote", "mesurer_la_performance", "creer_un_indice_ratio"] },
  { group: "Alertes, replay, historique", tools: ["gerer_les_alertes_du_graphique", "lancer_le_replay", "quitter_le_replay", "annuler_ou_retablir"] },
  {
    group: "Scripts",
    tools: [
      "coder_un_indicateur",
      "ecrire_un_script",
      "modifier_un_script",
      "lire_un_script",
      "ouvrir_un_script",
      "lire_le_resultat_d_un_script",
      "lire_la_documentation_du_scripting",
      "chercher_dans_la_doc_des_scripts",
    ],
  },
];

/** Le groupe d'un outil. */
export function chartAiToolGroup(name: string): string {
  return CHART_AI_TOOL_GROUPS.find((g) => g.tools.includes(name))?.group ?? "Divers";
}

/** Le catalogue complet (ou celui des définitions données, par exemple celles annoncées par le pont), groupé dans
 *  l'ordre de `CHART_AI_TOOL_GROUPS`. */
export function chartAiToolCatalog(definitions: { name: string; description: string }[] = CHART_AI_TOOL_DEFINITIONS): ChartAiToolCatalogEntry[] {
  const order = (name: string) => {
    const gi = CHART_AI_TOOL_GROUPS.findIndex((g) => g.tools.includes(name));
    const ti = gi === -1 ? 0 : CHART_AI_TOOL_GROUPS[gi].tools.indexOf(name);
    return (gi === -1 ? CHART_AI_TOOL_GROUPS.length : gi) * 100 + ti;
  };
  return [...definitions]
    .sort((a, b) => order(a.name) - order(b.name))
    .map((d) => ({ group: chartAiToolGroup(d.name), name: d.name, summary: firstSentence(d.description), description: d.description }));
}
