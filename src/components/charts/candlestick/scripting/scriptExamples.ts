import type { Indicator } from "../interfaces/Indicator.interface";

export interface ScriptExample {
  id: string;
  title: string;
  description: string;
  code: string;
  /** A multi-file example's own extra files (see `ScriptDef.files`) — the entry `code` above
   *  imports them. Only the "plusieurs fichiers" example sets this; every other one is a single
   *  file and leaves it undefined. */
  files?: { name: string; code: string }[];
  /** Indicators the live preview chart carries so `chart.indicator(id)` inside `code` resolves to
   *  something real instead of the all-`null` "unknown id" handle — see `useScriptEngine`'s own
   *  `indicators` argument doc. Only the "Quant Score" example needs this (it reads an existing
   *  RSI/MACD off the chart rather than computing them itself via `ta.*`); every other example
   *  computes everything on demand and needs none. */
  indicators?: Indicator[];
}

/** The "Exemples" section's own seven complete, runnable scripts — migrated out of
 *  `scriptApiReference.ts`'s former static `h()`/`t()`/`c()` blocks (same "plain data, no JSX"
 *  convention as `scriptTutorialSteps.ts`) so `ScriptExampleRunner.tsx` can give each one a real
 *  "Exécuter" button and a live chart underneath instead of just syntax-highlighted text — exigence
 *  : « je veux pouvoir exécuter les scripts d'exemples... et avoir la chart qui apparaît sous les
 *  scripts respectifs ». Every example's own code is unchanged from the original static text. */
export const SCRIPT_EXAMPLES: ScriptExample[] = [
  {
    id: "report-company",
    title: "Rapport @report — analyse fondamentale d'une entreprise",
    description:
      "Un `@report` ne dessine rien et ne renvoie rien : il *écrit un document*, section par section, avec `report.*`. Il s'exécute une fois, positionné sur la dernière bougie, donc `market.*` et `company.*` voient tout l'historique. Celui-ci lit les comptes fournis par l'application — chiffre d'affaires, résultat, CAPEX, impôts, ROIC — en construit un compte de résultat, un pont de trésorerie et une discussion de l'avantage concurrentiel, puis conclut. Le résultat s'affiche à côté du code et s'exporte en PDF.",
    code: `@report
@description "Analyse fondamentale : croissance, rentabilité,investissement, avantage concurrentiel."

// Quatre exercices, lus en remontant. company.value(champ, décalage) renvoie ce que l'entreprise
// avait publié il y a N bougies — les décalages se déduisent donc de l'historique réellement
// disponible, jamais d'un « 252 séances = un an » qui tombe dans le vide dès que la chart est plus
// courte que ce qu'on suppose.
const historique = market.series("close").length;
const exercices = [0, 1, 2, 3];
const decalage = (i) => Math.floor((historique - 1) * ((3 - i) / 4));
const lire = (champ, i) => company.value(champ, decalage(i));
const md = (v) => (v === null ? null : +(v / 1e9).toFixed(2));
const pct = (v) => (v === null ? null : v.toFixed(1) + " %");

report.title("Analyse fondamentale", { subtitle: "Quatre exercices", symbol: market.symbol() });

// --- Chiffres clés : ce qu'on regarde avant de lire quoi que ce soit ---
const caN = lire("totalRevenue", 3);
const caDebut = lire("totalRevenue", 0);
const croissance = caDebut ? ((caN / caDebut) ** (1 / 3) - 1) * 100 : null;
report.metrics([
  { label: "Chiffre d'affaires", value: md(caN) + " Md", tone: "up" },
  { label: "Croissance annualisée", value: croissance === null ? "—" : pct(croissance), tone: croissance > 0 ? "up" : "down" },
  { label: "Marge nette", value: pct(lire("netMargin", 3)) },
  { label: "ROIC", value: pct(lire("returnOnInvestedCapital", 3)), note: "vs " + pct(lire("returnOnInvestedCapital", 0)) + " il y a 4 ans" },
]);

// --- Compte de résultat ---
report.heading("Compte de résultat");
report.table(
  ["Exercice", "CA", "Résultat net", "Marge nette", "Impôt", "Taux effectif"],
  exercices.map((i) => [
    "N-" + (3 - i),
    md(lire("totalRevenue", i)),
    md(lire("netIncome", i)),
    pct(lire("netMargin", i)),
    md(lire("taxExpense", i)),
    pct(lire("effectiveTaxRate", i)),
  ]),
  { title: "En milliards, sauf pourcentages" }
);

// --- Investissement et trésorerie ---
report.heading("Investissement et trésorerie");
report.text(
  "Le CAPEX dit ce qu'il en coûte de maintenir la position ; le flux de trésorerie disponible dit ce qu'il en reste."
);
const etiquettes = exercices.map((i) => "N-" + (3 - i));
report.series("CAPEX", etiquettes, exercices.map((i) => md(lire("capex", i))), { unit: "Md" });
report.series(
  "Flux de trésorerie disponible",
  etiquettes,
  exercices.map((i) => {
    const flux = lire("operatingCashFlow", i);
    const capex = lire("capex", i);
    return flux === null || capex === null ? null : md(flux - capex);
  }),
  { unit: "Md" }
);

// --- Avantage concurrentiel ---
report.heading("Avantage concurrentiel");
const roic = lire("returnOnInvestedCapital", 3);
const roicDebut = lire("returnOnInvestedCapital", 0);
report.text(
  roic === null
    ? "L'application n'a pas fourni de ROIC : impossible de conclure sur la rentabilité du capital investi."
    : "Le ROIC s'établit à " + pct(roic) + ", contre " + pct(roicDebut) + " il y a quatre exercices."
);
if (roic !== null && roic > 15) {
  report.callout(
    "positive",
    "Rentabilité durablement élevée",
    "Un ROIC maintenu au-dessus de 15 % sur plusieurs exercices consécutifs s'explique rarement par la conjoncture : c'est le signe d'une barrière à l'entrée. Reste à nommer laquelle."
  );
} else if (roic !== null) {
  report.callout(
    "neutral",
    "Rentabilité ordinaire",
    "Rien ici n'indique un avantage concurrentiel durable : le capital investi rapporte ce que rapporte le capital investi."
  );
}

report.heading("Champs disponibles");
report.text("Données fournies par l'application : " + company.fields().join(", ") + ".");`,
  },
  {
    id: "quant-cross-section",
    title: "Analyse @quant — comparer plusieurs symboles",
    description:
      "Une analyse `@quant` ne dessine rien : elle s'exécute une fois par symbole de la liste qu'elle déclare, et ce qu'elle renvoie *est* son résultat. Celle-ci mesure, pour chaque titre, sa performance sur trois horizons, sa volatilité annualisée et la distance à son plus haut d'un an — de quoi trier une liste de surveillance sans ouvrir un graphique. Les symboles au-delà de celui de la chart ont besoin de leurs propres bougies, fournies par l'application via `quantData` ; un symbole sans données revient avec sa propre ligne « aucune donnée » plutôt que de faire échouer toute l'analyse.",
    code: `@quant(AAPL, MSFT, NVDA)
@description "Comparaison transversale : performance, volatilité, distance au plus haut."

// Une analyse @quant tourne UNE fois par symbole, positionnée sur la dernière bougie — market.*
// voit donc tout l'historique. Aucun plot n'est disponible ici : le résultat, c'est le return.
const closes = market.series("close", 260);
if (closes.length < 30) return { erreur: "Historique trop court" };

const last = closes[closes.length - 1];
const perf = (barres) => {
  const past = closes[closes.length - 1 - barres];
  return past === undefined || past === 0 ? null : +(((last - past) / past) * 100).toFixed(2);
};

// Volatilité annualisée à partir des rendements quotidiens, en supposant 252 séances.
const rendements = [];
for (let i = 1; i < closes.length; i++) {
  if (closes[i - 1] !== 0) rendements.push(closes[i] / closes[i - 1] - 1);
}
const moyenne = rendements.reduce((a, b) => a + b, 0) / rendements.length;
const variance = rendements.reduce((a, r) => a + (r - moyenne) ** 2, 0) / rendements.length;
const volatilite = +(Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2);

const plusHaut = Math.max(...closes);

return {
  cours: +last.toFixed(2),
  "perf 1M": perf(21),
  "perf 3M": perf(63),
  "perf 1A": perf(252),
  "volatilité": volatilite,
  "sous le plus haut": +(((last - plusHaut) / plusHaut) * 100).toFixed(2),
};`,
  },
  {
    id: "quant-score",
    title: "Quant Score — RSI + MACD + moyenne mobile",
    description:
      "Combine RSI, MACD et une moyenne mobile en un score de 0 à 3, tracé dans son propre panneau, avec un signal d'achat quand les trois conditions sont réunies :",
    indicators: [
      { id: "example-rsi", kind: "rsi", period: 14 },
      { id: "example-macd", kind: "macd", period: 0, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    ],
    code: `@indicator
// Lit un RSI et un MACD déjà présents sur la chart plutôt que de les recalculer ici —
// voir "Indicateurs disponibles" dans l'éditeur pour les identifiants réels de votre chart.
const rsi = chart.indicator("rsi").value(0);
const macdHist = chart.indicator("macd").histogram(0);
const price = market.close(0);
const sma20 = math.sma(market.series("close", 20), 20);

// Un point par condition remplie : 0 à 3, jamais négatif.
let score = 0;
if (rsi !== null && rsi > 50) score += 1;          // momentum haussier
if (macdHist !== null && macdHist > 0) score += 1; // MACD au-dessus de son signal
if (sma20 !== null && price > sma20) score += 1;   // prix au-dessus de sa moyenne 20

// Le score dans son propre panneau, la moyenne mobile superposée au prix.
plot.pane("Quant Score").line("Quant Score", score);
plot.overlay("SMA 20").line("SMA 20", sma20 ?? price);

// Un seul signal par bougie (bar.isNew()), uniquement quand les trois conditions sont réunies.
if (bar.isNew() && score === 3) {
  plot.signal("BUY");
  alert("Quant Score au maximum (3/3)");
}`,
  },
  {
    id: "golden-death-cross",
    title: "Croisement de moyennes mobiles (Golden / Death Cross)",
    description:
      "SMA 50 et SMA 200 tracées en superposition, avec un signal et une alerte au moment exact où la courte croise la longue — la valeur précédente de chaque moyenne est mémorisée via state.* pour détecter le croisement, pas recalculée à côté.",
    code: `@indicator
const shortMA = math.sma(market.series("close", 50), 50);
const longMA = math.sma(market.series("close", 200), 200);
// La valeur des deux moyennes à la bougie PRÉCÉDENTE — nécessaire pour détecter le moment exact
// du croisement (avant/après), pas juste "laquelle est au-dessus en ce moment".
const prevShort = state.get("prevShort", null);
const prevLong = state.get("prevLong", null);

plot.overlay("SMA 50").line("SMA 50", shortMA ?? market.close(0));
plot.overlay("SMA 200").line("SMA 200", longMA ?? market.close(0));

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
state.set("prevLong", longMA);`,
  },
  {
    id: "bollinger-breakout",
    title: "Rupture des bandes de Bollinger",
    description: "Bandes tracées en superposition ; signal quand le prix clôture au-delà de l'une des deux bandes :",
    code: `@indicator
// Calculé "à la volée" via ta.* — pas besoin d'avoir ajouté de Bollinger à la chart.
const bb = ta.bollinger(market.series("close", 60), 20, 2);
const price = market.close(0);

// null tant qu'il n'y a pas encore 20 clôtures d'historique (période de chauffe) — on ne trace
// et ne signale rien avant que le calcul ait un sens.
if (bb) {
  plot.overlay("Bollinger").band("Bollinger", bb.upper, bb.lower);

  // Rupture = clôture strictement au-delà d'une des deux bandes.
  if (bar.isNew() && price > bb.upper) {
    plot.signal("SELL");
    alert("Prix au-dessus de la bande de Bollinger supérieure");
  }
  if (bar.isNew() && price < bb.lower) {
    plot.signal("BUY");
    alert("Prix en dessous de la bande de Bollinger inférieure");
  }
}`,
  },
  {
    id: "volume-spike",
    title: "Détecteur de pic de volume",
    description: "Marque la bougie courante quand son volume dépasse la moyenne + 2 écarts-types des 20 dernières bougies :",
    code: `@indicator
const volumes = market.series("volume", 20);
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
}`,
  },
  {
    id: "momentum-score",
    title: "Score de momentum (RSI + Stochastique)",
    description: "Une deuxième variante de score composite, indépendante du Quant Score ci-dessus — combine RSI et l'oscillateur stochastique plutôt que MACD :",
    code: `@indicator
const closes = market.series("close", 60);
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

plot.pane("Momentum Score").line("Momentum Score", score);

if (bar.isNew() && score === 3) {
  alert("Score de momentum au maximum (3/3)");
}`,
  },
  {
    id: "donchian-channel",
    title: "Canal de rupture",
    description: "Un canal de type Donchian — plus haut et plus bas glissants — avec un signal quand le prix clôture hors du canal :",
    code: `@indicator
const period = 20;
// Le plus haut plus haut et le plus bas plus bas des 20 dernières bougies — le canal lui-même.
const upperChannel = math.max(market.series("high", period));
const lowerChannel = math.min(market.series("low", period));
const price = market.close(0);

plot.overlay("Canal").band("Canal", upperChannel ?? price, lowerChannel ?? price);

// Rupture = clôture qui égale ou dépasse une borne du canal (>= / <=, pas > / < : toucher la
// borne compte déjà comme une rupture, pas seulement la dépasser).
if (bar.isNew() && upperChannel !== null && price >= upperChannel) {
  plot.signal("BUY");
  alert("Rupture du canal des " + period + " dernières bougies (plus haut)");
}
if (bar.isNew() && lowerChannel !== null && price <= lowerChannel) {
  plot.signal("SELL");
  alert("Rupture du canal des " + period + " dernières bougies (plus bas)");
}`,
  },
  {
    id: "docked-pane-skeleton",
    title: "Pane ancrée à droite (squelette)",
    description:
      "Le plus petit script qui produise une pane ancrée sur le côté : une pane nommée, `dock: \"right\"`, et une série à tracer dedans. Aucune logique — c'est le point de départ à copier quand on veut sa propre colonne latérale, pas un indicateur. Une pane ancrée occupe sa propre colonne à droite du graphique, redimensionnable par son bord, et s'ouvre repliée sur la mise en page tactile (une colonne de 220 px sur un téléphone ne laisserait rien aux bougies). `dock: \"left\"` fait la même chose de l'autre côté ; sans `dock`, la pane s'empile sous le prix comme n'importe quel indicateur :",
    code: `@indicator
// La pane est créée par son nom au premier appel, puis retrouvée par ce même nom à chaque bougie
// — "le dernier appel gagne" pour chaque série qu'elle contient.
const droite = plot.pane("Ma pane", { dock: "right" });

// Une pane vide ne s'affiche pas : il lui faut au moins une série. Le prix de clôture fait un
// contenu de remplacement honnête, à remplacer par ce que vous voulez vraiment y voir.
droite.line("Clôture", market.close(0) ?? 0);`,
  },
  {
    id: "trend-indicator-a",
    title: "Trend Indicator A (v2.3) — portage Pine Script",
    description:
      "Portage fidèle de l'indicateur « Trend Indicator A (v2.3) » de DZIV (CC BY-NC-SA 4.0), écrit dans le langage de scripting. Il lisse les quatre séries Heikin-Ashi avec la même moyenne mobile — huit types au choix, dont ALMA, HMA, SWMA et ZLEMA — puis lit la bougie moyenne qui en résulte : la clôture lissée en couleur de tendance, un nuage entre ouverture et clôture dont l'épaisseur est la conviction, et deux nuages gris pour les mèches. Deux écarts assumés avec l'original, tous deux commentés dans le code : sa branche « WMA » calcule en fait une VWMA (un copier-coller), corrigée ici ; et la valeur de `trend` gagne son propre panneau, l'original n'en gardant que le signe.",
    code: `@indicator
@description "///Trend Indicator A (v2.3)///
Portage fidèle de l'indicateur de **DZIV** (CC BY-NC-SA 4.0). L'idée tient en une phrase : lisser
les quatre séries **Heikin-Ashi** avec la même moyenne mobile, puis lire la bougie moyenne qui en
résulte.

//Pourquoi Heikin-Ashi//
Une bougie Heikin-Ashi est déjà une moyenne — son ouverture est la moyenne de l'ouverture et de la
clôture précédentes. Lisser ces quatre séries plutôt que les prix bruts enlève le bruit deux fois,
et ce qui reste est la --direction-- du marché plutôt que ses à-coups.

//Ce qui est tracé//
Entre l'ouverture et la clôture lissées, un nuage **vert quand le corps de la bougie moyenne est
haussier**, rouge sinon : son épaisseur est la conviction. Ses deux bords sont tracés, la clôture
et l'ouverture lissées, dans la couleur du nuage. Les mèches (haut et bas lissés) ferment deux
nuages gris très pâles, qui disent jusqu'où le marché est allé sans y rester ; leurs deux lignes
sont dessinées à 0,2 d'opacité, assez pour marquer la limite sans tirer l'œil."

@block Cellule 1 — les réglages
// Tous les réglages de l'original, déclarés en Variable : ils apparaissent dans le panneau
// « Paramètres » et se changent sans toucher au code.
const TYPE_MM = new Variable("string", "EMA", {
  description: "Type de moyenne mobile : ALMA, HMA, SMA, SWMA, VWMA, WMA, ZLEMA ou EMA.",
});
const PERIODE = new Variable("number", 9, { description: "Longueur de la moyenne mobile.", min: 1, max: 200 });
const ALMA_DECALAGE = new Variable("number", 0.85, { description: "ALMA uniquement — position du pic de la fenêtre gaussienne (0 = le plus ancien, 1 = le plus récent).", min: 0, max: 1 });
const ALMA_SIGMA = new Variable("number", 6, { description: "ALMA uniquement — netteté du pic. Plus grand = suit le prix de plus près.", min: 1, max: 20 });
const AFFICHER_MECHES = new Variable("boolean", false, { description: "Trace aussi les lignes du haut et du bas lissés." });
const AFFICHER_NUAGES = new Variable("boolean", true, { description: "Remplit les nuages entre les mèches et le corps." });
const COULEUR_HAUSSE = new Variable("color", "#26a69a", { description: "Couleur quand le corps de la bougie moyenne est haussier." });
const COULEUR_BAISSE = new Variable("color", "#ef5350", { description: "Couleur quand il est baissier." });
const COULEUR_NEUTRE = new Variable("color", "#808080", { description: "Couleur des mèches et de leurs nuages." });

// L'opacité de chaque famille de traits, réglable une par une. 0 masque sans supprimer : la série
// reste listée dans la légende, et il suffit de remonter le curseur pour la revoir.
const OPACITE_CLOTURE = new Variable("number", 1, {
  description: "Opacité de la ligne de clôture lissée, le bord du corps côté clôture.",
  min: 0,
  max: 1,
});
const OPACITE_OUVERTURE = new Variable("number", 1, {
  description: "Opacité de la ligne d'ouverture lissée, l'autre bord du corps.",
  min: 0,
  max: 1,
});
const OPACITE_EXTREMES = new Variable("number", 0.2, {
  description: "Opacité des bordures extrêmes (haut et bas lissés), celles qui ferment les nuages.",
  min: 0,
  max: 1,
});

// Les remplissages, couleur et opacité séparées des lignes : un nuage peut prendre sa propre
// teinte sans que le trait qui le borde change.
const COULEUR_CORPS_HAUSSE = new Variable("color", "#26a69a", { description: "Remplissage du corps quand il est haussier." });
const COULEUR_CORPS_BAISSE = new Variable("color", "#ef5350", { description: "Remplissage du corps quand il est baissier." });
const OPACITE_CORPS = new Variable("number", 1, { description: "Opacité du remplissage du corps.", min: 0, max: 1 });
const COULEUR_MECHES = new Variable("color", "#808080", { description: "Remplissage des deux nuages de mèches." });
const OPACITE_MECHES = new Variable("number", 1, { description: "Opacité des nuages de mèches.", min: 0, max: 1 });

@block Cellule 2 — les quatre séries Heikin-Ashi, lissées
// market.heikinAshi() rend les quatre séries d'un coup, les plus anciennes en premier. Ce n'est
// pas quelque chose qu'un script peut recalculer lui-même : l'ouverture HA dépend de la bougie
// HA précédente, donc de toutes celles d'avant — voir sa doc.
const FENETRE = Math.max(60, PERIODE * 4);
const ha = market.heikinAshi(FENETRE);
const volumes = market.series("volume", FENETRE);

// Le switch de l'original. Une seule fonction appliquée aux quatre séries, exactement comme f(x).
function moyenne(valeurs) {
  switch (TYPE_MM.toUpperCase()) {
    case "ALMA": return ta.alma(valeurs, PERIODE, ALMA_DECALAGE, ALMA_SIGMA);
    case "HMA": return ta.hma(valeurs, PERIODE);
    case "SMA": return ta.sma(valeurs, PERIODE);
    case "SWMA": return ta.swma(valeurs);
    case "VWMA": return ta.vwma(valeurs, volumes, PERIODE);
    // L'original écrit ici \`ta.vwma(x, ma_period)\` — un copier-coller depuis la ligne VWMA
    // juste au-dessus, qui fait que « WMA » calcule en réalité une VWMA. On corrige : une WMA
    // pondère par l'ancienneté, pas par le volume.
    case "WMA": return ta.wma(valeurs, PERIODE);
    case "ZLEMA": return ta.zlema(valeurs, PERIODE);
    default: return ta.ema(valeurs, PERIODE);
  }
}

const mmOuverture = moyenne(ha.open);
const mmCloture = moyenne(ha.close);
const mmHaut = moyenne(ha.high);
const mmBas = moyenne(ha.low);

@block Cellule 3 — la tendance
// trend = 100 × (clôture − ouverture) / (haut − bas) : la part du chemin parcouru sur la bougie
// moyenne qui l'a été dans le sens du corps. Seul son signe sert au tracé, mais la valeur elle-
// même se lit comme une force, d'où le panneau séparé plus bas.
const amplitude = mmHaut !== null && mmBas !== null ? mmHaut - mmBas : null;
const tendance =
  mmCloture !== null && mmOuverture !== null && amplitude !== null && amplitude !== 0
    ? (100 * (mmCloture - mmOuverture)) / amplitude
    : null;
const haussier = tendance !== null && tendance > 0;

@block Cellule 4 — le tracé
// Deux séries pour une seule courbe : la couleur d'une série est fixée à sa première valeur et ne
// change plus ensuite. Une courbe bicolore se fait donc avec deux séries, chacune à null là où
// l'autre s'affiche — sans le null, la série relierait ses points par-dessus le trou.
// Les options de tracé n'ont pas de champ opacity, et le rendu passe par un canvas, dont
// l'analyseur de couleurs ne comprend pas color-mix(). Un suffixe alpha sur un hex à six
// chiffres, lui, est compris partout — et toute autre écriture de couleur ressort inchangée,
// pleine opacité, ce qui se voit tout de suite au lieu de disparaître sans explication.
function avecOpacite(couleur, opacite) {
  const o = Math.max(0, Math.min(1, opacite));
  if (o >= 1 || !/^#[0-9a-fA-F]{6}$/.test(couleur)) return couleur;
  return couleur + Math.round(o * 255).toString(16).padStart(2, "0");
}

const prix = plot.overlay("Trend Indicator A");
prix.line("Clôture lissée (hausse)", haussier ? mmCloture : null, { color: avecOpacite(COULEUR_HAUSSE, OPACITE_CLOTURE), lineWidth: 2 });
prix.line("Clôture lissée (baisse)", haussier ? null : mmCloture, { color: avecOpacite(COULEUR_BAISSE, OPACITE_CLOTURE), lineWidth: 2 });

// L'autre bord du corps. Le nuage ci-dessous va de l'ouverture à la clôture : sans cette
// ligne-là, la zone colorée n'était bordée que d'un côté.
prix.line("Ouverture lissée (hausse)", haussier ? mmOuverture : null, { color: avecOpacite(COULEUR_HAUSSE, OPACITE_OUVERTURE), lineWidth: 2 });
prix.line("Ouverture lissée (baisse)", haussier ? null : mmOuverture, { color: avecOpacite(COULEUR_BAISSE, OPACITE_OUVERTURE), lineWidth: 2 });

// Le nuage entre ouverture et clôture, en deux séries pour la même raison que la courbe.
//
// Et surtout : les deux sont émises à *chaque* bougie, celle qui ne s'applique pas recevant null.
// Ne rien émettre du tout n'est pas la même chose — une série sans valeur sur une bougie prolonge
// sa dernière, ce qui donnait de longs paliers horizontaux là où la couleur changeait. null est
// ce qui perce un trou.
prix.band("Corps (hausse)", haussier ? mmCloture : null, haussier ? mmOuverture : null, { color: avecOpacite(COULEUR_CORPS_HAUSSE, OPACITE_CORPS), lineWidth: 0 });
prix.band("Corps (baisse)", haussier ? null : mmCloture, haussier ? null : mmOuverture, { color: avecOpacite(COULEUR_CORPS_BAISSE, OPACITE_CORPS), lineWidth: 0 });

// Même règle ici : la valeur est null quand l'option est éteinte, jamais l'appel qui disparaît.
// Les deux bordures extrêmes : présentes pour fermer les nuages, à peine visibles pour ne pas
// concurrencer les bords du corps, qui sont la lecture utile.
prix.line("Haut lissé", AFFICHER_MECHES ? mmHaut : null, { color: avecOpacite(COULEUR_NEUTRE, OPACITE_EXTREMES) });
prix.line("Bas lissé", AFFICHER_MECHES ? mmBas : null, { color: avecOpacite(COULEUR_NEUTRE, OPACITE_EXTREMES) });

// Deux nuages très pâles : du haut jusqu'au sommet du corps, et du bas du corps jusqu'au bas.
// Ils disent jusqu'où le marché est allé sans y rester.
const corpsHaut = mmOuverture !== null && mmCloture !== null ? Math.max(mmOuverture, mmCloture) : null;
const corpsBas = mmOuverture !== null && mmCloture !== null ? Math.min(mmOuverture, mmCloture) : null;
prix.band("Mèche haute", AFFICHER_NUAGES ? mmHaut : null, AFFICHER_NUAGES ? corpsHaut : null, { color: avecOpacite(COULEUR_MECHES, OPACITE_MECHES), lineWidth: 0 });
prix.band("Mèche basse", AFFICHER_NUAGES ? corpsBas : null, AFFICHER_NUAGES ? mmBas : null, { color: avecOpacite(COULEUR_MECHES, OPACITE_MECHES), lineWidth: 0 });

@block Cellule 5 — la force, dans son propre panneau
// Absent de l'original, qui n'affiche que la couleur. La valeur de \`trend\` est une échelle de
// -100 à +100 qui se lit bien seule : au-delà de ±50, le corps de la bougie moyenne occupe plus
// de la moitié de son amplitude, ce qui est une tendance franche.
plot.pane("Force de tendance").histogram("Force", tendance, { color: haussier ? COULEUR_HAUSSE : COULEUR_BAISSE });`,
  },
  {
    id: "kde-support-resistance",
    title: "Niveaux de support/résistance (KDE gaussienne)",
    description:
      "Un portage fidèle de computeMarketProfile du projet market-profile-levels (lui-même un portage de find_levels() de son notebook Python) : KDE gaussienne en espace log-prix, largeur de noyau à la manière de scipy.gaussian_kde(bw_method=scalaire) — h = ATR-log moyen × ATR_MULT × écart-type pondéré des log-clôtures — grille de GRID points couvrant exactement l'amplitude observée, et détection de pics par proéminence. Le profil est affiché dans une pane ancrée à droite (plot.pane(..., { dock: \"right\" })), recalculé tous les RECALC_EVERY bougies pour rester sous le budget d'exécution, avec un signal au moment exact où le prix franchit un niveau. Les quatorze constantes de la cellule 1 sont déclarées avec new Variable(type, défaut) : elles apparaissent dans la fenêtre de réglages (celle de l'éditeur comme celle de la pane), se règlent sans toucher au code, et toute tentative de les réaffecter ailleurs dans le script est signalée comme une erreur. Le tutoriel « Niveaux de support/résistance (KDE) » plus haut construit la même idée pas à pas, en prix bruts plutôt qu'en log — c'est la version pédagogique, celle-ci est la version de production :",
    code: `@indicator
@description "///Niveaux de support/résistance///
Un **profil de marché** lissé par un noyau gaussien. Plutôt que de compter combien de fois le prix
a visité chaque palier, chaque clôture est étalée en une petite cloche, et toutes les cloches sont
additionnées : le profil obtenu est *continu* au lieu d'être en escalier.

//Pourquoi en log-prix//
Tout le calcul se fait sur le --logarithme-- des clôtures, pas sur les prix eux-mêmes. Un noyau de
largeur fixe en euros est trop large en bas de l'échelle et trop étroit en haut ; en log, une même
largeur vaut le même **pourcentage** de mouvement partout, ce qui est la bonne façon de comparer
des zones de prix éloignées. La grille est reconvertie en prix (exp) au dernier moment.

//Ce que le script affiche//
Le profil est dessiné dans la pane de droite, **tourné d'un quart de tour** : les prix en vertical,
alignés sur ceux du graphe principal, et la densité qui s'étend horizontalement. Chaque bosse est
donc à la hauteur exacte du prix qu'elle désigne.

Les pics de ce profil sont les niveaux de __support et de résistance__. Chacun est ramené sur les
bougies sous forme d'un **semis de points**, à la hauteur exacte de la bosse qui l'a produit — un
point par bougie, qui s'interrompt dès que le niveau cesse d'être détecté. Une flèche BUY/SELL se
pose en plus dès qu'une clôture en franchit un.

//Les réglages qui comptent//
**ATR_MULT** élargit ou resserre les cloches : plus haut, moins de niveaux, mais plus robustes.

**PROM_THRESH** écarte les pics trop plats.

**RECALC_EVERY** espace les recalculs — le profil complet coûte cher, et les niveaux ne bougent
--pratiquement jamais-- d'une bougie à l'autre.

**AFFICHER_NIVEAUX** masque les points si seul le profil de droite vous intéresse.
"

@block Cellule 1 — paramètres réglables et outils de calcul
// new Variable(type, défaut, { description }) expose la constante dans la fenêtre de réglages :
// on peut la régler sans rouvrir le code, et le script se relance tout seul à chaque changement.
// La description s'affiche sous le champ correspondant.
const WINDOW = new Variable("number", 500, {
  description:
    "Nombre de bougies (les plus récentes) utilisées pour construire le profil. Le projet de référence calcule sur toute la fenêtre visible du graphe ; ici, où le script s'exécute bougie par bougie, c'est cette fenêtre glissante qui en tient lieu — plus elle est large, plus le profil est stable, et plus il coûte cher.",
  min: 10,
});
const GRID = new Variable("number", 200, {
  description:
    "Nombre de niveaux de prix échantillonnés entre le plus bas et le plus haut de la fenêtre (le numPoints de la référence). C'est le réglage qui pèse le plus sur la finesse du profil : bas (quelques dizaines) donne un profil grossier à peu de pics larges, haut (deux cents et plus) un profil fin capable de distinguer des pics rapprochés.",
  min: 5,
});
const FIRST_W = new Variable("number", 0.01, {
  description:
    "Poids de la bougie la plus ancienne de la fenêtre par rapport à la plus récente (qui vaut 1). Plus bas = le profil privilégie les prix récents.",
  min: 0,
  max: 1,
});
const ATR_MULT = new Variable("number", 3, {
  description:
    "Largeur du noyau gaussien, exprimée comme le bw_method scalaire de scipy.gaussian_kde : la largeur finale vaut ATR_MULT × ATR-log moyen × écart-type pondéré des log-clôtures. Bas = noyaux étroits, profil détaillé à beaucoup de pics ; haut = noyaux larges, profil lissé à peu de pics mais plus robustes.",
  min: 0.05,
});
const PROM_THRESH = new Variable("number", 0.25, {
  description:
    "Hauteur minimale qu'un pic doit dépasser au-dessus de ses vallées voisines pour devenir un niveau, en fraction du pic le plus haut du profil. Bas = plus de niveaux détectés, y compris des pics mineurs ; haut = seuls les pics les plus marqués sont gardés.",
  min: 0,
  max: 1,
});
const RECALC_EVERY = new Variable("number", 5, {
  description:
    "Ne recalculer le profil qu'une bougie sur N ; entre deux recalculs, le dernier profil obtenu est réutilisé tel quel. 1 = recalcul à chaque bougie.\\n\\nPourquoi l'éviter : le script est réexécuté une fois par bougie sur tout l'historique, et un recalcul complet visite chacun des GRID niveaux de prix pour chacune des WINDOW clôtures de la fenêtre — 200 × 500 = 100 000 calculs avec les réglages par défaut. Sur un historique de ~3000 bougies, cela fait ~2,7 s à N=1 contre ~0,4 s à N=5, là où le moteur interrompt un rejeu au-delà de 8 s et une mise à jour en direct au-delà de 1,5 s.\\n\\nCe qu'on perd en montant N : presque rien. Les niveaux ne bougent pratiquement pas d'une bougie à l'autre, et le profil affiché est de toute façon le dernier calculé.",
  min: 1,
});
const PROFIL_COULEUR = new Variable("color", "#c47f2a", { description: "Couleur de la courbe du profil affichée dans la pane de droite." });
const PROFIL_MARGE = new Variable("number", 0.08, {
  description:
    "Espace laissé entre le pic le plus haut du profil et la barre de séparation verticale de la pane, en fraction de la largeur de la colonne. 0 = la courbe touche la barre.",
  min: 0,
  max: 0.5,
});
const AFFICHER_FLECHES = new Variable("boolean", false, { description: "Affiche les flèches BUY/SELL sur le graphique quand un niveau est franchi." });
const AFFICHER_NIVEAUX = new Variable("boolean", true, {
  description: "Trace chaque niveau détecté en ligne horizontale sur le graphique des prix, en face de la bosse du profil qui l'a produit.",
});
const COULEUR_NIVEAUX = new Variable("color", "#c47f2a", { description: "Couleur des points de niveau tracés sur les bougies." });
const TAILLE_POINTS = new Variable("number", 1.6, { description: "Taille des points de niveau. 1 donne un pointillé fin, 3 de gros points bien visibles.", min: 0.5, max: 6 });
const NIVEAUX_MAX = new Variable("number", 8, {
  description:
    "Nombre maximum de niveaux tracés sur les bougies, les plus proches du cours d'abord. Le profil de droite continue de tous les montrer ; c'est seulement l'encombrement du graphe des prix (et de sa légende, une entrée par niveau) que ce plafond limite. Baisser PROM_THRESH en produit davantage, ce plafond décide de combien s'affichent.",
  min: 1,
  max: 30,
});
// DEBOUNCE_MS est le seul nom que le moteur lit lui-même plutôt que de se contenter de le
// substituer dans le code compilé (voir la doc de useScriptEngine) : il règle le délai d'anti-
// rafale avant un recalcul déclenché par un tick de marché en direct qui ne fait que mettre à jour
// la bougie encore en formation. Sans effet sur le replay ou l'arrivée d'une nouvelle bougie, qui
// relancent toujours le script immédiatement, quelle que soit cette valeur.
const DEBOUNCE_MS = new Variable("number", 0, {
  description:
    "Délai (ms) avant de relancer le script suite à un tick de marché en direct sur la bougie déjà en formation. 0 = aucun anti-rafale, le script se relance à chaque tick.",
  min: 0,
});

// True Range moyen en espace log — une simple moyenne, pas le lissage de Wilder de ta.atr : ici
// l'ATR ne sert qu'à donner un ordre de grandeur à la largeur de bande, et une moyenne franche est
// plus facile à raisonner qu'une exponentielle qui traîne son propre historique.
function meanLogATR(highs, lows, closes) {
  if (closes.length < 2) return 0.0005;
  let somme = 0;
  for (let i = 1; i < closes.length; i++) {
    const lh = Math.log(highs[i]);
    const ll = Math.log(lows[i]);
    const lpc = Math.log(closes[i - 1]);
    somme += Math.max(lh - ll, Math.abs(lh - lpc), Math.abs(ll - lpc));
  }
  return somme / (closes.length - 1);
}

// Pics par proéminence : on part du sommet et on descend de chaque côté jusqu'à rencontrer un point
// PLUS HAUT que lui — là, ce n'est plus sa vallée mais celle d'un pic voisin plus grand. La plus
// haute des deux vallées ainsi trouvées donne la hauteur réelle du pic, ce qui distingue un vrai
// sommet d'une simple bosse posée sur le flanc d'un autre.
function findPeaks(values, minProminence) {
  const peaks = [];
  for (let i = 1; i < values.length - 1; i++) {
    if (!(values[i] > values[i - 1] && values[i] > values[i + 1])) continue;
    let leftMin = values[i];
    for (let j = i - 1; j >= 0; j--) {
      if (values[j] > values[i]) break;
      if (values[j] < leftMin) leftMin = values[j];
    }
    let rightMin = values[i];
    for (let j = i + 1; j < values.length; j++) {
      if (values[j] > values[i]) break;
      if (values[j] < rightMin) rightMin = values[j];
    }
    if (values[i] - Math.max(leftMin, rightMin) >= minProminence) peaks.push(i);
  }
  return peaks;
}

@block Cellule 2 — ne recalculer que tous les RECALC_EVERY bougies
const barIndex = state.get("barIndex", 0);
state.set("barIndex", barIndex + 1);

if (barIndex >= WINDOW && barIndex % RECALC_EVERY === 0) {
  const closes = market.series("close", WINDOW);
  const highs = market.series("high", WINDOW);
  const lows = market.series("low", WINDOW);
  const n = closes.length;
  const logClose = closes.map(Math.log);

  // Poids linéaires : la plus ancienne bougie pèse FIRST_W, la plus récente 1, puis on normalise
  // pour que la somme fasse 1 — la densité obtenue est alors une vraie densité de probabilité,
  // comparable d'une fenêtre à l'autre quelle que soit la valeur de WINDOW.
  const poids = [];
  for (let i = 0; i < n; i++) poids.push(Math.max(0, FIRST_W + (i * (1 - FIRST_W)) / n));
  const totalPoids = poids.reduce((a, b) => a + b, 0);
  const poidsNorm = poids.map((w) => w / totalPoids);

  // Écart-type pondéré des log-clôtures : l'échelle naturelle des données. La largeur de bande en
  // est un multiple, exactement comme scipy.gaussian_kde(bw_method=scalaire) pose h = scalaire ×
  // std(données) — d'où une largeur qui s'adapte à la fois à la volatilité (par l'ATR) et à
  // l'étalement de la fenêtre (par cet écart-type).
  const moyennePond = logClose.reduce((s, x, i) => s + poids[i] * x, 0) / totalPoids;
  const ecartPond = Math.sqrt(logClose.reduce((s, x, i) => s + poids[i] * (x - moyennePond) ** 2, 0) / totalPoids);
  const h = meanLogATR(highs, lows, closes) * ATR_MULT * ecartPond;

  if (h > 0) {
    // La grille couvre exactement l'amplitude observée, sans marge : la densité aux deux bords est
    // celle des clôtures extrêmes elles-mêmes, et le profil se lit sur la même plage que le prix.
    const minV = Math.min(...logClose);
    const maxV = Math.max(...logClose);
    const step = (maxV - minV) / GRID;
    const logGrid = [];
    for (let v = minV; v <= maxV; v += step) logGrid.push(v);

    // Somme des cloches, normalisée par 1 / (racine(2π) × h) — le facteur qui fait d'une somme de
    // gaussiennes une densité dont l'intégrale vaut 1.
    const norm = 1 / (Math.sqrt(2 * Math.PI) * h);
    const density = logGrid.map((x) => {
      let somme = 0;
      for (let i = 0; i < n; i++) {
        const u = (x - logClose[i]) / h;
        somme += poidsNorm[i] * Math.exp(-0.5 * u * u);
      }
      return somme * norm;
    });

    // Retour en prix (exp) au tout dernier moment : le calcul entier s'est fait en log.
    const priceGrid = logGrid.map(Math.exp);
    const peakIdx = findPeaks(density, Math.max(...density) * PROM_THRESH);
    state.set("levels", peakIdx.map((i) => priceGrid[i]));
    // Le profil complet est mémorisé lui aussi, pas seulement ses pics : c'est lui qu'on affiche.
    state.set("density", density);
    state.set("priceGrid", priceGrid);
  }
}

@block Cellule 3 — afficher le profil, tourné, dans une pane ancrée à droite
// pane.profile(nom, valeurs, prix) prend les deux tableaux d'un coup, comme plot.xy : un profil
// n'est pas une série temporelle. Il est dessiné transposé — prix en vertical, densité en
// horizontal — sur l'échelle de prix du graphe principal, donc chaque bosse est exactement à la
// hauteur du prix qu'elle désigne.
// headroom réserve un peu de largeur au-delà du pic le plus haut, pour que la courbe ne vienne
// jamais coller à la barre de séparation. Ça ne peut pas se faire en divisant les densités avant
// de les passer : l'échelle de la colonne va toujours de 0 au maximum du tableau reçu, donc son
// maximum retombe sur le bord quel que soit le facteur appliqué — c'est l'échelle qu'il faut
// élargir, pas les valeurs.
const profilDensite = state.get("density", []);
const profilPrix = state.get("priceGrid", []);
plot.pane("Niveaux", { dock: "right" }).profile("Densité", profilDensite, profilPrix, {
  color: PROFIL_COULEUR,
  headroom: PROFIL_MARGE,
});

@block Cellule 4 — détecter un franchissement et signaler
// Les niveaux (les pics du profil) sont relus ici : la cellule 3 dessine le profil, celle-ci
// surveille les franchissements.
const levels = state.get("levels", []);
const prevClose = market.close(1);
const currClose = market.close(0);
if (prevClose !== null && currClose !== null) {
  let sig = state.get("sig", 0);
  const prevSig = sig;
  for (const level of levels) {
    if (currClose > level && prevClose <= level) sig = 1;
    else if (currClose < level && prevClose >= level) sig = -1;
  }
  if (sig !== prevSig && AFFICHER_FLECHES) {
    plot.signal({ type: sig > 0 ? "BUY" : "SELL", price: currClose });
  }
  state.set("sig", sig);
}

@block Cellule 5 — tracer les niveaux en points sur le graphique des prix
// Le profil de droite montre OÙ sont les niveaux ; ces points les ramènent sur les bougies, à la
// même hauteur que la bosse qui les a produits.
//
// .dots, et pas .line, pour une raison de fond : les niveaux sont recalculés à intervalle régulier
// et rien ne garantit que le « niveau n° 3 » d'aujourd'hui soit le même objet que le « niveau n° 3 »
// d'hier — un niveau peut apparaître, se décaler, disparaître, et tous ceux du dessus changent
// alors de rang. Une ligne relierait ces valeurs entre elles et inventerait une continuité qui
// n'existe pas ; des points ne relient rien, donc un changement de rang ne se voit tout simplement
// pas. C'est exactement ce que fait le scatter de l'implémentation Python d'origine.
//
// .dots est aussi le seul tracé qui laisse de vrais trous : les autres prolongent leur dernière
// valeur jusqu'au bord droit du graphe, celui-ci ne dessine rien tant que le script n'émet pas.
// C'est ce qui permet à un segment de s'arrêter net quand son niveau cesse d'être détecté, au lieu
// de filer à l'horizontale pour toujours. Appelé à chaque bougie (pas seulement sur la dernière),
// il laisse donc derrière lui la trace de l'historique des niveaux.
if (AFFICHER_NIVEAUX && currClose !== null) {
  // Un profil bruité peut sortir trente pics ; les tracer tous couvrirait les bougies et donnerait
  // trente entrées de légende. On garde les plus proches du cours — ceux contre lesquels le prix
  // est effectivement en train de jouer — puis on les remet dans l'ordre des prix pour que les
  // numéros de série se lisent de bas en haut.
  const affiches = [...levels]
    .sort((a, b) => Math.abs(a - currClose) - Math.abs(b - currClose))
    .slice(0, NIVEAUX_MAX)
    .sort((a, b) => a - b);

  const niveaux = plot.overlay("Niveaux S/R");
  // Une couleur unique pour tous, comme la vidéo de référence : la couleur d'une série est fixée à
  // son premier point, alors qu'un même niveau passe de résistance à support (et inversement) selon
  // de quel côté du cours il se trouve — la teindre par rôle mentirait dès le premier croisement.
  affiches.forEach((level, i) => {
    niveaux.dots("Niveau " + (i + 1), level, { color: COULEUR_NIVEAUX, lineWidth: TAILLE_POINTS });
  });
}`,
  },
  {
    id: "kde-modules",
    title: "Le même, en plusieurs fichiers et avec des classes",
    description:
      "Le script précédent découpé en trois fichiers importés par le principal, et réécrit avec des classes. Le calcul est identique ; ce qui change, c'est l'organisation : noyau porte la KDE gaussienne, pics la détection de pics par proéminence (sur un tableau de nombres quelconque, sans rien savoir des prix), et niveaux importe les deux pour en faire un objet SuiviNiveaux qui garde sa mémoire d'une bougie à l'autre. Le fichier principal ne fait plus que déclarer les réglages et afficher. À retenir sur l'exécution : le fichier principal est rejoué une fois par bougie, les fichiers importés ne sont évalués qu'une seule fois par exécution — une instance créée dans un fichier importé traverse donc tout l'historique. Dans l'éditeur, la barre au-dessus du code donne un onglet par fichier et le bouton + en crée un nouveau :",
    code: `@indicator
@description "///Niveaux S/R en plusieurs fichiers///
Exactement le même calcul que l'exemple précédent, mais **découpé en trois fichiers** et écrit avec
des classes plutôt qu'avec des fonctions et un sac de --state.get/set--.

//Ce que fait chaque fichier//
--noyau-- porte la KDE gaussienne (les poids, la largeur de bande, la grille de densité). --pics--
porte la détection de pics par proéminence, sur un tableau de nombres quelconque. --niveaux--
importe les deux et les assemble en un objet **SuiviNiveaux** qui garde sa mémoire d'une bougie à
l'autre. Le fichier principal ne fait plus que déclarer les réglages et afficher.

//La règle à retenir//
Le fichier principal est réexécuté **une fois par bougie** ; les autres fichiers sont évalués **une
seule fois** par exécution. Une instance créée dans un fichier importé traverse donc tout
l'historique, là où un --new-- écrit dans le fichier principal repartirait de zéro à chaque bougie —
c'est pourquoi l'instance ci-dessous est rangée dans --state-- au premier passage.
"

@block Cellule 1 — les réglages, et les trois fichiers qui font le travail
import { SuiviNiveaux } from "./niveaux";

const WINDOW = new Variable("number", 500, {
  description: "Nombre de bougies passées prises en compte pour construire le profil.",
  min: 20,
});
const GRID = new Variable("number", 200, {
  description: "Nombre de paliers de prix sur lesquels la densité est évaluée. Plus haut = profil plus fin, mais plus lent.",
  min: 20,
});
const FIRST_W = new Variable("number", 0.01, {
  description: "Poids de la bougie la plus ancienne de la fenêtre par rapport à la plus récente (qui vaut 1).",
  min: 0,
  max: 1,
});
const ATR_MULT = new Variable("number", 3, {
  description: "Largeur du noyau gaussien : ATR_MULT × ATR-log moyen × écart-type pondéré des log-clôtures.",
  min: 0.05,
});
const PROM_THRESH = new Variable("number", 0.25, {
  description: "Hauteur minimale qu'un pic doit dépasser au-dessus de ses vallées voisines, en fraction du pic le plus haut.",
  min: 0,
  max: 1,
});
const RECALC_EVERY = new Variable("number", 5, {
  description: "Ne recalculer le profil qu'une bougie sur N. 1 = recalcul à chaque bougie.",
  min: 1,
});
const PROFIL_COULEUR = new Variable("color", "#c47f2a", { description: "Couleur de la courbe du profil affichée dans la pane de droite." });
const AFFICHER_FLECHES = new Variable("boolean", false, { description: "Affiche les flèches BUY/SELL quand un niveau est franchi." });
const NIVEAUX_MAX = new Variable("number", 8, { description: "Nombre maximum de niveaux tracés sur les bougies.", min: 1, max: 30 });

// L'instance vit dans state parce que CE fichier-ci est rejoué à chaque bougie : un \`new\` écrit
// directement ici reconstruirait un objet vide à chaque passage, et le suivi n'aurait aucune
// mémoire. Les fichiers importés, eux, ne sont évalués qu'une fois — une instance créée là-bas
// n'aurait pas eu besoin de ce détour.
let suivi = state.get("suivi");
if (!suivi) {
  suivi = new SuiviNiveaux({
    fenetre: WINDOW,
    grille: GRID,
    premierPoids: FIRST_W,
    multiplicateurATR: ATR_MULT,
    seuilProeminence: PROM_THRESH,
    recalculTous: RECALC_EVERY,
  });
  state.set("suivi", suivi);
}

@block Cellule 2 — une bougie de plus
suivi.observer(market);

@block Cellule 3 — le profil, tourné, dans une pane ancrée à droite
plot.pane("Niveaux", { dock: "right" }).profile("Densité", suivi.profil.densite, suivi.profil.prix, {
  color: PROFIL_COULEUR,
  headroom: 0.08,
});

@block Cellule 4 — franchissement et niveaux tracés sur les bougies
const courante = market.close(0);
const signal = suivi.franchissement(market.close(1), courante);
if (signal && AFFICHER_FLECHES) plot.signal({ type: signal, price: courante });

if (courante !== null) {
  const niveaux = plot.overlay("Niveaux S/R");
  suivi.plusProches(courante, NIVEAUX_MAX).forEach((niveau, i) => {
    niveaux.dots("Niveau " + (i + 1), niveau, { color: PROFIL_COULEUR, lineWidth: 1.6 });
  });
}
`,
    files: [
      { name: "noyau", code: `// Le calcul de densité, isolé du reste : ce fichier ne sait rien des paniques d'affichage, des
// pics ni des franchissements — on lui donne des bougies, il rend un profil.
//
// Un fichier n'est évalué qu'UNE FOIS par exécution, pas une fois par bougie comme le fichier
// principal. C'est ce qui rend une classe utile ici : l'instance construite au premier passage
// traverse tout l'historique.

/** True Range moyen en espace log — une simple moyenne, pas le lissage de Wilder de ta.atr : ici
 *  l'ATR ne sert qu'à donner un ordre de grandeur à la largeur de bande, et une moyenne franche est
 *  plus facile à raisonner qu'une exponentielle qui traîne son propre historique. */
export function moyenneATRLog(highs, lows, closes) {
  if (closes.length < 2) return 0.0005;
  let somme = 0;
  for (let i = 1; i < closes.length; i++) {
    const lh = Math.log(highs[i]);
    const ll = Math.log(lows[i]);
    const lpc = Math.log(closes[i - 1]);
    somme += Math.max(lh - ll, Math.abs(lh - lpc), Math.abs(ll - lpc));
  }
  return somme / (closes.length - 1);
}

/** Une KDE gaussienne en espace log-prix, à la manière de scipy.gaussian_kde(bw_method=scalaire).
 *  Les réglages sont passés une fois au constructeur plutôt qu'à chaque appel : ils ne changent
 *  pas d'une bougie à l'autre, et les garder sur l'instance évite de les faire circuler. */
export class NoyauGaussien {
  constructor({ premierPoids, multiplicateurATR, grille }) {
    this.premierPoids = premierPoids;
    this.multiplicateurATR = multiplicateurATR;
    this.grille = grille;
  }

  /** Poids linéaires : la plus ancienne bougie pèse premierPoids, la plus récente 1. */
  poids(n) {
    const poids = [];
    for (let i = 0; i < n; i++) poids.push(Math.max(0, this.premierPoids + (i * (1 - this.premierPoids)) / n));
    return poids;
  }

  /** Le profil complet, ou null si la fenêtre ne permet pas de largeur de bande exploitable. */
  profil(closes, highs, lows) {
    const n = closes.length;
    if (n === 0) return null;
    const logClose = closes.map(Math.log);
    const poids = this.poids(n);
    const totalPoids = poids.reduce((a, b) => a + b, 0);
    // Normalisés pour que la somme fasse 1 : la densité obtenue est alors une vraie densité de
    // probabilité, comparable d'une fenêtre à l'autre quelle que soit la taille de la fenêtre.
    const poidsNorm = poids.map((w) => w / totalPoids);

    // Écart-type pondéré des log-clôtures : l'échelle naturelle des données. La largeur de bande en
    // est un multiple, exactement comme scipy pose h = scalaire × std(données).
    const moyennePond = logClose.reduce((s, x, i) => s + poids[i] * x, 0) / totalPoids;
    const ecartPond = Math.sqrt(logClose.reduce((s, x, i) => s + poids[i] * (x - moyennePond) ** 2, 0) / totalPoids);
    const h = moyenneATRLog(highs, lows, closes) * this.multiplicateurATR * ecartPond;
    if (!(h > 0)) return null;

    // La grille couvre exactement l'amplitude observée, sans marge : le profil se lit sur la même
    // plage que le prix.
    const minV = Math.min(...logClose);
    const maxV = Math.max(...logClose);
    const pas = (maxV - minV) / this.grille;
    const logGrille = [];
    for (let v = minV; v <= maxV; v += pas) logGrille.push(v);

    // Somme des cloches, normalisée par 1 / (racine(2π) × h) — le facteur qui fait d'une somme de
    // gaussiennes une densité dont l'intégrale vaut 1.
    const norm = 1 / (Math.sqrt(2 * Math.PI) * h);
    const densite = logGrille.map((x) => {
      let somme = 0;
      for (let i = 0; i < n; i++) {
        const u = (x - logClose[i]) / h;
        somme += poidsNorm[i] * Math.exp(-0.5 * u * u);
      }
      return somme * norm;
    });

    // Retour en prix (exp) au tout dernier moment : le calcul entier s'est fait en log.
    return { prix: logGrille.map(Math.exp), densite };
  }
}
` },
      { name: "pics", code: `// La détection de pics, seule. Aucune notion de prix ici : ce fichier prend un tableau de nombres
// et rend des indices — ce qui le rend testable et réutilisable pour n'importe quelle courbe.

/** Pics par proéminence : on part du sommet et on descend de chaque côté jusqu'à rencontrer un
 *  point PLUS HAUT que lui — là, ce n'est plus sa vallée mais celle d'un pic voisin plus grand. La
 *  plus haute des deux vallées ainsi trouvées donne la hauteur réelle du pic, ce qui distingue un
 *  vrai sommet d'une simple bosse posée sur le flanc d'un autre. */
export class DetecteurPics {
  /** @param seuil fraction du pic le plus haut qu'une bosse doit dépasser pour compter. */
  constructor(seuil) {
    this.seuil = seuil;
  }

  indices(valeurs) {
    if (valeurs.length < 3) return [];
    const minProeminence = Math.max(...valeurs) * this.seuil;
    const pics = [];
    for (let i = 1; i < valeurs.length - 1; i++) {
      if (!(valeurs[i] > valeurs[i - 1] && valeurs[i] > valeurs[i + 1])) continue;
      let creuxGauche = valeurs[i];
      for (let j = i - 1; j >= 0; j--) {
        if (valeurs[j] > valeurs[i]) break;
        if (valeurs[j] < creuxGauche) creuxGauche = valeurs[j];
      }
      let creuxDroite = valeurs[i];
      for (let j = i + 1; j < valeurs.length; j++) {
        if (valeurs[j] > valeurs[i]) break;
        if (valeurs[j] < creuxDroite) creuxDroite = valeurs[j];
      }
      if (valeurs[i] - Math.max(creuxGauche, creuxDroite) >= minProeminence) pics.push(i);
    }
    return pics;
  }
}
` },
      { name: "niveaux", code: `// Un fichier peut en importer un autre : celui-ci assemble le noyau et le détecteur de pics en un
// seul objet qui garde sa mémoire d'une bougie à l'autre.
import { NoyauGaussien } from "./noyau";
import { DetecteurPics } from "./pics";

export class SuiviNiveaux {
  constructor(options) {
    this.noyau = new NoyauGaussien(options);
    this.detecteur = new DetecteurPics(options.seuilProeminence);
    this.fenetre = options.fenetre;
    this.recalculTous = options.recalculTous;
    this.compteur = 0;
    this.niveaux = [];
    this.profil = { prix: [], densite: [] };
    this.signal = 0;
  }

  /** Appelé à chaque bougie. Ne recalcule qu'une fois sur recalculTous — entre deux recalculs, le
   *  dernier profil obtenu est réutilisé tel quel, ce qui garde l'exécution sous le budget du
   *  moteur sans rien changer à ce qui est affiché (les niveaux ne bougent pratiquement pas d'une
   *  bougie à l'autre). */
  observer(marche) {
    const index = this.compteur++;
    if (index < this.fenetre || index % this.recalculTous !== 0) return;
    const profil = this.noyau.profil(
      marche.series("close", this.fenetre),
      marche.series("high", this.fenetre),
      marche.series("low", this.fenetre)
    );
    if (!profil) return;
    this.profil = profil;
    this.niveaux = this.detecteur.indices(profil.densite).map((i) => profil.prix[i]);
  }

  /** "BUY" / "SELL" au moment exact où le prix franchit un niveau, null le reste du temps. Le
   *  signal précédent vit sur l'instance : c'est tout l'intérêt d'avoir un objet plutôt qu'une
   *  fonction, il se souvient sans que l'appelant ait à lui repasser son propre état. */
  franchissement(precedente, courante) {
    if (precedente === null || courante === null) return null;
    const avant = this.signal;
    for (const niveau of this.niveaux) {
      if (courante > niveau && precedente <= niveau) this.signal = 1;
      else if (courante < niveau && precedente >= niveau) this.signal = -1;
    }
    if (this.signal === avant) return null;
    return this.signal > 0 ? "BUY" : "SELL";
  }

  /** Les niveaux les plus proches du cours, remis dans l'ordre des prix — un profil bruité peut en
   *  sortir trente, et les tracer tous couvrirait les bougies. */
  plusProches(courante, maximum) {
    return [...this.niveaux]
      .sort((a, b) => Math.abs(a - courante) - Math.abs(b - courante))
      .slice(0, maximum)
      .sort((a, b) => a - b);
  }
}
` },
    ],
  },
  {
    id: "macd-strategy",
    title: "Stratégie — croisement MACD",
    description:
      "Une stratégie complète et volontairement simple : long quand l'histogramme MACD passe au-dessus de zéro, short quand il repasse en dessous, et rien d'autre. Elle sert d'abord à montrer la mécanique — @strategy, strategy.long/short/close, et le testeur qui s'ouvre en bas de la chart — sur une règle assez courte pour être lue d'un coup d'œil. Notez qu'un croisement se détecte en comparant à la valeur de la bougie précédente, mémorisée avec state.* : sans ça on entrerait à chaque bougie où l'histogramme est positif, pas au moment où il le devient.",
    code: `@strategy
@description "///Stratégie MACD///
Long au passage de l'histogramme MACD au-dessus de zéro, short en dessous.

//Ce que ça montre//
La mécanique complète d'une stratégie : le décorateur **@strategy**, les ordres
--strategy.long()-- / --strategy.short()--, et le panneau de test qui s'ouvre sous la chart.

//Ce que ça n'est pas//
Une stratégie à trader. Un croisement de MACD nu perd de l'argent sur la plupart des marchés une
fois les frais payés — c'est précisément ce que le facteur de profit du panneau vous dira.
"

@block Réglages

const RAPIDE = new Variable("number", 12, { description: "Période de l'EMA rapide du MACD.", min: 1, max: 200 });
const LENTE = new Variable("number", 26, { description: "Période de l'EMA lente du MACD.", min: 1, max: 200 });
const SIGNAL = new Variable("number", 9, { description: "Période de la ligne de signal.", min: 1, max: 200 });

@block Le MACD, et son histogramme à la bougie précédente

const macd = ta.macd(market.series("close", LENTE * 5), RAPIDE, LENTE, SIGNAL);
const histo = macd ? macd.histogram : null;
const histoAvant = state.get("histoAvant", null);
state.set("histoAvant", histo);

@block Les règles d'entrée

// Un croisement, pas un état : on compare à la bougie précédente. Sans ce test, la condition
// "histogramme positif" serait vraie sur toute une tendance et déclencherait une entrée par
// bougie, que le pyramiding se contenterait ensuite d'ignorer en silence.
if (histo !== null && histoAvant !== null) {
  if (histoAvant <= 0 && histo > 0) strategy.long("MACD haussier");
  if (histoAvant >= 0 && histo < 0) strategy.short("MACD baissier");
}

@block Le MACD lui-même, pour pouvoir lire la stratégie

// Une stratégie reste un script : elle peut tracer ce qu'elle veut. Voir l'histogramme sous les
// bougies est ce qui permet de comprendre *pourquoi* un trade s'est déclenché là.
if (macd && macd.macd !== null && macd.signal !== null) {
  const pane = plot.pane("MACD");
  pane.line("MACD", macd.macd, { color: "#6c87c9" });
  pane.line("Signal", macd.signal, { color: "#e0a95c" });
  pane.histogram("Histogramme", macd.histogram ?? 0, { color: "#7fb37f" });
}`,
  },
  {
    id: "sma-cross-strategy",
    title: "Stratégie — croisement de moyennes",
    description:
      "La stratégie la plus simple qui tienne debout, et le bon point de départ pour comprendre le testeur : long quand la moyenne courte passe au-dessus de la longue, sortie quand elle repasse en dessous. Rien de plus. Tout l'intérêt est de voir ce que le panneau en dit — un croisement de moyennes gagne rarement en facteur de profit, mais il produit peu de trades, donc peu de frais, ce qui en fait une base honnête à laquelle comparer des règles plus élaborées.",
    code: `@strategy
@description "///Croisement de moyennes///
Long quand la moyenne courte croise la longue à la hausse, sortie au croisement inverse.

//À quoi ça sert//
C'est la stratégie de référence : celle à laquelle comparer les autres. Si une règle compliquée ne
bat pas celle-ci sur le même instrument, elle ne vaut pas sa complexité.

//Ce qu'il faut regarder dans le panneau//
Le **facteur de profit** (au-dessus de 1, elle gagne), le **drawdown max** (ce qu'il a fallu
encaisser pour l'obtenir), et la part des **commissions** dans le profit brut.
"

@block Réglages

const COURTE = new Variable("number", 20, { description: "Période de la moyenne courte.", min: 2, max: 200 });
const LONGUE = new Variable("number", 50, { description: "Période de la moyenne longue.", min: 3, max: 400 });

@block Les deux moyennes, et leur position à la bougie précédente

const courte = math.sma(market.series("close", COURTE), COURTE);
const longue = math.sma(market.series("close", LONGUE), LONGUE);

// Un croisement se détecte par un CHANGEMENT de position relative, pas par la position elle-même.
// Sans cette mémoire, "courte au-dessus de longue" resterait vrai pendant toute une tendance et on
// tenterait une entrée à chaque bougie — que le pyramiding se contenterait d'ignorer en silence.
const auDessusAvant = state.get("auDessus", null);
const auDessus = courte !== null && longue !== null ? courte > longue : null;
state.set("auDessus", auDessus);

@block Les règles

if (auDessus !== null && auDessusAvant !== null && auDessus !== auDessusAvant) {
  if (auDessus) strategy.long("Croisement haussier");
  else strategy.close("Croisement baissier");
}

@block Les moyennes sur la chart, pour pouvoir lire les trades

// Une stratégie reste un script : voir les deux courbes est ce qui permet de comprendre pourquoi
// un trade s'est déclenché à cet endroit-là plutôt qu'un autre.
const overlay = plot.overlay("Croisement de moyennes");
if (courte !== null) overlay.line("SMA " + COURTE, courte, { color: "#e0a95c" });
if (longue !== null) overlay.line("SMA " + LONGUE, longue, { color: "#6c87c9" });`,
  },
  {
    id: "permutation-entropy",
    title: "Entropie de permutation — mesurer le désordre d'une série",
    description:
      "Une mesure issue de la littérature (Bandt & Pompe, affinée par Unakafova & Keller 2013) qui ne regarde pas les niveaux mais l'ORDRE des barres : elle découpe la fenêtre en motifs de d barres consécutives, compte combien de fois chacun des d! ordres possibles apparaît, et résume cette distribution par son entropie de Shannon ramenée entre 0 et 1. Proche de 0, les mêmes enchaînements reviennent sans cesse — la série tend, ou elle est mécanique ; proche de 1, tous les enchaînements sont aussi fréquents les uns que les autres. C'est un indicateur de filtrage : il ne dit pas d'acheter, il dit dans quel régime on se trouve. Le portage suit la définition publiée, pas un transcodage ligne à ligne : la numérotation des motifs y est différente (code de Lehmer), ce qui ne change aucune valeur puisque l'entropie ne lit que la forme de la distribution, jamais les étiquettes. Vérifié contre une seconde implémentation indépendante sur quatre régimes (bruit, tendance stricte, alternance, marche aléatoire) et trois profondeurs : identique à la précision machine, avec 0 exactement sur une tendance strictement croissante et ~0,99 sur du bruit.",
    code: `@indicator
@description "Entropie de permutation : à quel point l'ordre des dernières barres est prévisible. Proche de 0, la série répète toujours les mêmes enchaînements (elle tend, ou elle est mécanique) ; proche de 1, tous les enchaînements sont aussi fréquents les uns que les autres (elle est désordonnée). Sert de filtre : beaucoup de stratégies de suivi de tendance travaillent mieux quand l'entropie est basse, beaucoup de stratégies de retour à la moyenne quand elle est haute."

const SOURCE = new Variable("string", "close", {
  description: 'La série mesurée : "close" pour le prix, "volume" pour les volumes.',
});
const PROFONDEUR = new Variable("number", 3, {
  description: "d — combien de barres consécutives forment un motif. 3 en compare trois de suite.",
  min: 2,
  max: 5,
});
const MULTIPLICATEUR = new Variable("number", 28, {
  description: "La fenêtre observée vaut d! fois ce nombre. Avec d = 3, 28 donne 168 barres.",
  min: 4,
  max: 120,
});
const SEUIL_BAS = new Variable("number", 0.9, { description: "En dessous, la série est jugée ordonnée.", min: 0, max: 1 });
const SEUIL_HAUT = new Variable("number", 0.97, { description: "Au-dessus, elle est jugée désordonnée.", min: 0, max: 1 });

const FACTORIELLES = [1, 1, 2, 6, 24, 120];

const d = Math.min(5, Math.max(2, Math.round(PROFONDEUR)));
const motifsPossibles = FACTORIELLES[d];
const fenetre = motifsPossibles * Math.max(4, Math.round(MULTIPLICATEUR));

const champ = SOURCE === "volume" ? "volume" : "close";
// Une barre de plus que la fenêtre par motif : le premier motif a besoin de d valeurs.
const valeurs = market.series(champ, fenetre + d - 1);

let entropie = null;

if (valeurs.length === fenetre + d - 1) {
  // Un motif ordinal, c'est l'ORDRE de d valeurs consécutives, pas leurs niveaux :
  // [12, 15, 14] et [3, 9, 8] sont le même motif. Il y a d! ordres possibles, et le code
  // de Lehmer ci-dessous en numérote chacun une fois et une seule, de 0 à d!-1 : pour
  // chaque position, on compte combien de valeurs la SUIVENT en lui étant inférieures.
  //
  // Quelle numérotation exactement n'a aucune importance pour la suite, et c'est ce qui
  // permet de l'écrire autrement que l'implémentation de référence sans changer le
  // résultat : l'entropie ne lit que la forme de la distribution, jamais les étiquettes.
  const comptes = new Array(motifsPossibles).fill(0);

  for (let debut = 0; debut + d <= valeurs.length; debut++) {
    let code = 0;
    for (let i = 0; i < d - 1; i++) {
      let inferieuresApres = 0;
      for (let j = i + 1; j < d; j++) {
        if (valeurs[debut + j] < valeurs[debut + i]) inferieuresApres++;
      }
      code = code * (d - i) + inferieuresApres;
    }
    comptes[code]++;
  }

  // Entropie de Shannon de cette distribution, divisée par son maximum log2(d!) pour
  // atterrir entre 0 et 1. Ce maximum est atteint quand les d! motifs sont équiprobables.
  let somme = 0;
  for (const compte of comptes) {
    // Un motif jamais vu ne contribue rien : 0 x log2(0) vaut 0, alors que log2(0) seul
    // vaut -Infini et empoisonnerait toute la somme.
    if (compte === 0) continue;
    const p = compte / fenetre;
    somme += p * Math.log2(p);
  }
  entropie = -somme / Math.log2(motifsPossibles);
}

const panneau = plot.pane("Entropie de permutation");
panneau.line("Entropie", entropie);
panneau.line("Ordonnée", SEUIL_BAS, { color: "var(--lq-color-up)", lineStyle: "dashed", lineWidth: 1 });
panneau.line("Désordonnée", SEUIL_HAUT, { color: "var(--lq-color-down)", lineStyle: "dashed", lineWidth: 1 });`,
  },
  {
    id: "trend-survival-matrix",
    title: "Trend Survival Matrix — combien de temps la tendance peut encore durer",
    description:
      "Portage d'un indicateur Pine Script v6. Trois échelles de temps (8/21, 21/55, 55/200) tournent en parallèle ; chacune tient l'âge de sa tendance en cours et archive la longueur de chaque tendance terminée dans l'un des trois seaux de volatilité où elle est née (percentile d'ATR bas, normal, haut). Ce qui est affiché est une survie EMPIRIQUE et non un modèle : la part des tendances passées du même seau qui ont dépassé l'âge actuel plus k barres, rapportée à celles qui ont au moins atteint l'âge actuel. Trois choses de l'original n'ont pas d'équivalent ici et sont dites plutôt que simulées : la teinte de fond du graphique n'existe pas dans cette API, le tableau colore une ligne entière et non chaque cellule, et les étiquettes d'épuisement sont remplacées par une alerte et un marqueur, la fiabilité faible étant signalée par « (?) » dans la colonne État.",
    code: `@indicator
@description "Trend Survival Matrix : combien de temps la tendance en cours a des chances de durer, d'après ce que les tendances passées de ce marché ont fait. Trois échelles de temps (8/21, 21/55, 55/200) tournent en parallèle ; chacune tient l'âge de sa tendance en cours et archive la longueur de chaque tendance terminée dans un des trois seaux de volatilité où elle est née. La survie affichée est empirique, pas modélisée : P(la tendance dure encore k barres | elle a déjà duré son âge) = la part des tendances passées du même seau qui ont dépassé âge + k."

@block Cellule 1 — les réglages
const COURT_RAPIDE = new Variable("number", 8, { description: "Échelle courte — EMA rapide.", min: 2, max: 400 });
const COURT_LENT = new Variable("number", 21, { description: "Échelle courte — EMA lente.", min: 3, max: 600 });
const MOYEN_RAPIDE = new Variable("number", 21, { description: "Échelle moyenne — EMA rapide.", min: 2, max: 400 });
const MOYEN_LENT = new Variable("number", 55, { description: "Échelle moyenne — EMA lente.", min: 3, max: 600 });
const LONG_RAPIDE = new Variable("number", 55, { description: "Échelle longue — EMA rapide.", min: 2, max: 400 });
const LONG_LENT = new Variable("number", 200, { description: "Échelle longue — EMA lente.", min: 3, max: 600 });

const PRINCIPALE = new Variable("number", 1, { description: "Quelle échelle pilote le ruban et les alertes : 0 courte, 1 moyenne, 2 longue.", min: 0, max: 2 });

const HORIZON_1 = new Variable("number", 5, { description: "Premier horizon de survie, en barres.", min: 1, max: 500 });
const HORIZON_2 = new Variable("number", 10, { description: "Deuxième horizon — c'est lui qui déclenche l'alerte d'épuisement.", min: 1, max: 500 });
const HORIZON_3 = new Variable("number", 20, { description: "Troisième horizon.", min: 1, max: 500 });

const FENETRE_VOL = new Variable("number", 200, { description: "Fenêtre sur laquelle le percentile d'ATR situe la volatilité à la naissance d'une tendance.", min: 20, max: 2000 });
const SEUIL_VOL_BAS = new Variable("number", 33, { description: "Sous ce percentile d'ATR, la tendance naît en seau BASSE volatilité.", min: 5, max: 90 });
const SEUIL_VOL_HAUT = new Variable("number", 66, { description: "Au-dessus, seau HAUTE volatilité. Entre les deux, NORMALE.", min: 10, max: 95 });
const MEMOIRE = new Variable("number", 500, { description: "Nombre de tendances terminées gardées par seau. La plus ancienne saute au-delà.", min: 20, max: 2000 });
const ECHANTILLON_MIN = new Variable("number", 15, { description: "En dessous de ce nombre de tendances comparables, l'estimation est signalée peu fiable.", min: 3, max: 500 });

const ALERTE_SURVIE = new Variable("number", 25, { description: "Alerte d'épuisement quand la survie à l'horizon 2 passe sous ce pourcentage.", min: 1, max: 99 });
const ALERTE_Z = new Variable("number", 2, { description: "…ou quand l'âge dépasse la moyenne des tendances passées de ce nombre d'écarts-types.", min: 0.5, max: 10 });

const AFFICHER_TABLEAU = new Variable("boolean", true, { description: "Affiche la matrice de survie." });
const AFFICHER_RUBAN = new Variable("boolean", true, { description: "Remplit l'espace entre les deux EMA de l'échelle principale, d'autant plus opaque que la tendance est durable." });
const AFFICHER_DEPARTS = new Variable("boolean", true, { description: "Marque les changements de sens de l'échelle principale." });

const COULEUR_HAUSSE = new Variable("color", "#089981", { description: "Couleur des tendances haussières." });
const COULEUR_BAISSE = new Variable("color", "#f23645", { description: "Couleur des tendances baissières." });
const COULEUR_ALERTE = new Variable("color", "#f59e0b", { description: "Couleur des états d'alerte." });

@block Cellule 2 — les outils
// L'opacité s'écrit dans la couleur : les options de tracé n'ont pas de champ opacity et le rendu
// passe par un canvas, qui ne comprend pas color-mix().
function avecOpacite(couleur, opacite) {
  const o = Math.max(0, Math.min(1, opacite));
  if (o >= 1 || !/^#[0-9a-fA-F]{6}$/.test(couleur)) return couleur;
  return couleur + Math.round(o * 255).toString(16).padStart(2, "0");
}

// Le dénominateur et le numérateur de la survie : combien de tendances passées ont atteint v.
function combienOntAtteint(longueurs, v) {
  let n = 0;
  for (const l of longueurs) if (l >= v) n++;
  return n;
}

// La survie conditionnelle empirique, en pourcentage. null quand aucune tendance passée n'a même
// atteint l'âge actuel : il n'y a alors rien sur quoi conditionner, et 0 % serait un mensonge.
function survie(longueurs, age, k) {
  const d = combienOntAtteint(longueurs, age);
  if (d === 0) return null;
  return (100 * combienOntAtteint(longueurs, age + k)) / d;
}

function seauDe(etat, seau) {
  return seau === 0 ? etat.bas : seau === 1 ? etat.normal : etat.haut;
}

@block Cellule 3 — la machine à états
const closes = market.series("close", Math.max(LONG_LENT, MOYEN_LENT, COURT_LENT) * 3);
const highs = market.series("high", 60);
const lows = market.series("low", 60);
const clotures = market.series("close", 60);

const echelles = [
  { nom: "Courte", dir: math.ema(closes, COURT_RAPIDE) > math.ema(closes, COURT_LENT) ? 1 : -1 },
  { nom: "Moyenne", dir: math.ema(closes, MOYEN_RAPIDE) > math.ema(closes, MOYEN_LENT) ? 1 : -1 },
  { nom: "Longue", dir: math.ema(closes, LONG_RAPIDE) > math.ema(closes, LONG_LENT) ? 1 : -1 },
];

// Le percentile d'ATR sur la fenêtre : sa place, en pourcentage, parmi les ATR récents.
const atr = ta.atr(highs, lows, clotures, 14);
const histoAtr = state.get("atr", []);
if (atr !== null) {
  histoAtr.push(atr);
  if (histoAtr.length > FENETRE_VOL) histoAtr.shift();
  state.set("atr", histoAtr);
}
const percentileAtr =
  atr === null || histoAtr.length < 20 ? 50 : (100 * combienOntAtteint(histoAtr.map((v) => -v), -atr)) / histoAtr.length;
const seauCourant = percentileAtr < SEUIL_VOL_BAS ? 0 : percentileAtr < SEUIL_VOL_HAUT ? 1 : 2;

const etats = state.get("etats", [
  { dir: 0, age: 0, seau: 1, bas: [], normal: [], haut: [] },
  { dir: 0, age: 0, seau: 1, bas: [], normal: [], haut: [] },
  { dir: 0, age: 0, seau: 1, bas: [], normal: [], haut: [] },
]);

// Une avance par barre, sans garde. Le réflexe venu de Pine serait d'écrire bar.isNew() ici,
// comme son barstate.isconfirmed — ce serait faux : bar.isNew() n'est vrai que sur la DERNIÈRE
// barre du rejeu, parce que ce moteur reconstruit l'état depuis la barre 0 à chaque exécution
// (voir buildBarApi). Avec ce garde, la machine n'avançait qu'une fois et le tableau restait
// vide. Rejouer tout l'historique à chaque fois est précisément ce qui rend cette boucle sûre.
{
  for (let i = 0; i < 3; i++) {
    const etat = etats[i];
    const sens = echelles[i].dir;
    if (etat.dir === 0) {
      etat.dir = sens;
      etat.age = 1;
      etat.seau = seauCourant;
    } else if (sens === etat.dir) {
      etat.age += 1;
    } else {
      // La tendance vient de se retourner : on archive sa longueur dans le seau où elle est née,
      // puis on repart à un.
      const memoire = seauDe(etat, etat.seau);
      memoire.push(etat.age);
      if (memoire.length > MEMOIRE) memoire.shift();
      etat.dir = sens;
      etat.age = 1;
      etat.seau = seauCourant;
    }
  }
  state.set("etats", etats);
}

@block Cellule 4 — la lecture de chaque échelle
function lire(etat) {
  const longueurs = seauDe(etat, etat.seau);
  const moyenne = longueurs.length > 0 ? math.mean(longueurs) : null;
  const ecartType = longueurs.length > 1 ? math.std(longueurs) : null;
  return {
    dir: etat.dir,
    age: etat.age,
    mediane: longueurs.length > 0 ? math.median(longueurs) : null,
    z: ecartType !== null && ecartType > 0 ? (etat.age - moyenne) / ecartType : null,
    comparables: combienOntAtteint(longueurs, etat.age),
    s1: survie(longueurs, etat.age, HORIZON_1),
    s2: survie(longueurs, etat.age, HORIZON_2),
    s3: survie(longueurs, etat.age, HORIZON_3),
  };
}

// L'état de maturité, dans l'ordre où il est décidé : l'absence de données passe avant tout le
// reste, parce qu'un âge sans rien à quoi le comparer ne dit rien du tout.
function maturite(l) {
  if (l.s2 === null) return "PEU DE DONNÉES";
  if (l.mediane !== null && l.age < 0.5 * l.mediane) return "JEUNE";
  if (l.z !== null && l.z > 2) return "ÉPUISEMENT";
  if (l.z !== null && l.z > 1) return "ÉTIRÉE";
  return l.s2 >= 50 ? "SOLIDE" : "MÛRISSANTE";
}

const lectures = etats.map(lire);
const principale = lectures[Math.min(2, Math.max(0, Math.round(PRINCIPALE)))];
const haussier = principale.dir === 1;
const couleurPrincipale = principale.dir === 0 ? "#808080" : haussier ? COULEUR_HAUSSE : COULEUR_BAISSE;

@block Cellule 5 — le ruban
// L'opacité du remplissage dit la durabilité : plus la survie est haute, plus le ruban est franc.
const survieRuban = principale.s2 === null ? 50 : principale.s2;
const opaciteRuban = 0.12 + 0.45 * (Math.max(0, Math.min(100, survieRuban)) / 100);

const idx = Math.min(2, Math.max(0, Math.round(PRINCIPALE)));
const rapide = math.ema(closes, idx === 0 ? COURT_RAPIDE : idx === 1 ? MOYEN_RAPIDE : LONG_RAPIDE);
const lente = math.ema(closes, idx === 0 ? COURT_LENT : idx === 1 ? MOYEN_LENT : LONG_LENT);

const ruban = plot.overlay("Trend Survival Matrix");
ruban.line("EMA rapide", AFFICHER_RUBAN ? rapide : null, { color: avecOpacite(couleurPrincipale, 0.55) });
ruban.line("EMA lente", AFFICHER_RUBAN ? lente : null, { color: avecOpacite(couleurPrincipale, 0.3) });
ruban.band("Ruban de survie", AFFICHER_RUBAN ? rapide : null, AFFICHER_RUBAN ? lente : null, {
  color: avecOpacite(couleurPrincipale, opaciteRuban),
  lineWidth: 0,
});

@block Cellule 6 — départs et épuisement
const sensPrecedent = state.get("sensPrecedent", 0);
const nouveauSens = principale.dir !== 0 && principale.dir !== sensPrecedent;
state.set("sensPrecedent", principale.dir);

// Le marqueur est posé sur chaque barre de retournement : c'est un point par barre, il doit
// s'accumuler sur tout l'historique. L'alerte, elle, ne sort que sur la dernière barre —
// bar.isNew() est ici à sa vraie place, sinon un rejeu en enverrait des centaines.
if (AFFICHER_DEPARTS && nouveauSens) plot.signal(haussier ? "BUY" : "SELL");
if (nouveauSens && bar.isNew()) {
  alert("Trend Survival Matrix : l'échelle principale passe " + (haussier ? "haussière" : "baissière") + ".");
}

// Une seule alerte d'épuisement par tendance : le drapeau se remet à zéro au retournement suivant.
const epuiseeDejaSignalee = state.get("epuisee", false);
const epuisee =
  principale.dir !== 0 &&
  ((principale.z !== null && principale.z > ALERTE_Z) || (principale.s2 !== null && principale.s2 < ALERTE_SURVIE));
if (nouveauSens) state.set("epuisee", false);
else if (epuisee && !epuiseeDejaSignalee) {
  state.set("epuisee", true);
  if (bar.isNew()) alert("Trend Survival Matrix : la tendance principale montre un risque d'épuisement.");
}

@block Cellule 7 — la matrice
function pct(v) {
  return v === null ? "–" : Math.round(v) + " %";
}
function sensTexte(d) {
  return d === 1 ? "▲ hausse" : d === -1 ? "▼ baisse" : "—";
}

if (AFFICHER_TABLEAU) {
  const lignes = ["Courte", "Moyenne", "Longue"].map((nom, i) => {
    const l = lectures[i];
    const fiable = l.comparables >= ECHANTILLON_MIN;
    return {
      cells: [
        nom,
        sensTexte(l.dir),
        String(l.age),
        l.mediane === null ? "–" : l.mediane.toFixed(1),
        pct(l.s1),
        pct(l.s2),
        pct(l.s3),
        maturite(l) + (fiable ? "" : " (?)"),
      ],
      // La couleur porte le sens de la tendance ; le « (?) » porte la fiabilité, parce que les
      // deux sont des informations différentes et qu'une seule couleur ne peut pas dire les deux.
      color: l.dir === 0 ? undefined : l.dir === 1 ? COULEUR_HAUSSE : COULEUR_BAISSE,
    };
  });

  const seauTexte = seauCourant === 0 ? "basse" : seauCourant === 1 ? "normale" : "haute";
  lignes.push({
    cells: [
      "Volatilité " + seauTexte,
      "",
      "",
      "",
      "",
      "",
      "",
      "n = " + principale.comparables,
    ],
    color: principale.comparables >= ECHANTILLON_MIN * 3 ? COULEUR_HAUSSE : principale.comparables >= ECHANTILLON_MIN ? COULEUR_ALERTE : COULEUR_BAISSE,
  });

  plot.table(lignes, {
    title: "Matrice de survie de tendance",
    columns: ["Échelle", "Sens", "Âge", "Médiane", "S+" + HORIZON_1, "S+" + HORIZON_2, "S+" + HORIZON_3, "État"],
  });
}`,
  },
];
