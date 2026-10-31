import { MOIS_COURTS } from "./storyDemoData";

/**
 * Ce que partagent les stories de graphiques portées depuis `minimal-dashboard-kit` (`ChartAxis`,
 * `ChartTooltip`, `AlertsPanel`, `ChartEventTooltip`, `SeasonalityView`) : les formats de nombres
 * et de dates, et la mise en forme du code montré sous « Show code ».
 */

export const nombre = (n: number, decimales = 0) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
export const pourcent = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
export const euros = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/**
 * « janv. 26 » — pour un axe de mois. Les points sont datés à minuit UTC ; avancer de douze heures
 * avant de lire ramène toute graduation au bon mois, quel que soit le fuseau.
 */
export const moisAnnee = (x: Date | number) => {
  const d = new Date(+x + 12 * 3_600_000);
  return `${MOIS_COURTS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
};
/** « 18 févr. 2026 » — les bougies et les évènements sont datés à minuit UTC : on les lit en UTC. */
export const dateCourte = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Au-delà de ce nombre de caractères, un tableau ou un objet littéral passé en prop est abrégé. */
const SEUIL_LITTERAL = 240;

/**
 * Remplace, dans le code affiché, chaque tableau ou objet littéral trop long par le nom de sa prop :
 * `series={[ …deux cents lignes… ]}` devient `series={series}`. Sans cela, l'onglet Docs d'un
 * graphique déroulerait des milliers de lignes de points.
 */
function abregerLitteraux(code: string): string {
  // La `key` qui force une story à remonter quand un contrôle change une prop « default… ».
  code = code.replace(/\n\s*key=(?:"[^"]*"|\{[^}\n]*\})/g, "");
  let sortie = "";
  let i = 0;
  const motif = /(\w+)=\{(?=[[{])/g;
  for (;;) {
    motif.lastIndex = i;
    const m = motif.exec(code);
    if (!m) break;
    const debut = m.index + m[0].length - 1; // l'accolade ouvrante de la valeur JSX
    const fin = finDuBloc(code, debut);
    if (fin < 0) break;
    sortie += code.slice(i, m.index);
    sortie += fin - debut > SEUIL_LITTERAL ? `${m[1]}={${m[1]}}` : code.slice(m.index, fin + 1);
    i = fin + 1;
  }
  return sortie + code.slice(i);
}

/** L'indice de l'accolade qui ferme celle ouverte en `debut`, en sautant les chaînes. */
function finDuBloc(code: string, debut: number): number {
  let profondeur = 0;
  let chaine: string | null = null;
  for (let j = debut; j < code.length; j++) {
    const c = code[j];
    if (chaine) {
      if (c === "\\") j++;
      else if (c === chaine) chaine = null;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") chaine = c;
    else if (c === "{" || c === "[" || c === "(") profondeur++;
    else if (c === "}" || c === "]" || c === ")") {
      profondeur--;
      if (profondeur === 0) return j;
    }
  }
  return -1;
}

/** Une fonction s'affiche sous son nom (`formatY={euros}`) plutôt que sous un `() => {}` muet. */
function nomDeFonction(f: unknown): string {
  const nom = typeof f === "function" ? f.name : "";
  return nom && !/^(spy|mockConstructor|bound |anonymous)/.test(nom) ? nom : "() => {}";
}

/** Les paramètres à étaler dans `meta.parameters` d'une story de graphique. */
export const CODE_LISIBLE = {
  jsx: { showFunctions: true, functionValue: nomDeFonction },
} as const;

/** À poser sous `meta.parameters.docs.source`. */
export const SOURCE_ABREGEE = { transform: abregerLitteraux } as const;
