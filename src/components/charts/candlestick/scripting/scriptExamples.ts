import type { Indicator } from "../interfaces/Indicator.interface";

export interface ScriptExample {
  id: string;
  title: string;
  description: string;
  code: string;
  /** Indicators the live preview chart carries so `chart.indicator(id)` inside `code` resolves to
   *  something real instead of the all-`null` "unknown id" handle — see `useScriptEngine`'s own
   *  `indicators` argument doc. Only the "Quant Score" example needs this (it reads an existing
   *  RSI/MACD off the chart rather than computing them itself via `ta.*`); every other example
   *  computes everything on demand and needs none. */
  indicators?: Indicator[];
}

/** The "Exemples" section's own six complete, runnable scripts — migrated out of
 *  `scriptApiReference.ts`'s former static `h()`/`t()`/`c()` blocks (same "plain data, no JSX"
 *  convention as `scriptTutorialSteps.ts`) so `ScriptExampleRunner.tsx` can give each one a real
 *  "Exécuter" button and a live chart underneath instead of just syntax-highlighted text — exigence
 *  : « je veux pouvoir exécuter les scripts d'exemples... et avoir la chart qui apparaît sous les
 *  scripts respectifs ». Every example's own code is unchanged from the original static text. */
export const SCRIPT_EXAMPLES: ScriptExample[] = [
  {
    id: "quant-score",
    title: "Quant Score — RSI + MACD + moyenne mobile",
    description:
      "Combine RSI, MACD et une moyenne mobile en un score de 0 à 3, tracé dans son propre panneau, avec un signal d'achat quand les trois conditions sont réunies :",
    indicators: [
      { id: "example-rsi", kind: "rsi", period: 14 },
      { id: "example-macd", kind: "macd", period: 0, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    ],
    code: `// Lit un RSI et un MACD déjà présents sur la chart plutôt que de les recalculer ici —
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
    code: `const shortMA = math.sma(market.series("close", 50), 50);
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
    code: `// Calculé "à la volée" via ta.* — pas besoin d'avoir ajouté de Bollinger à la chart.
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
    code: `const volumes = market.series("volume", 20);
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
    code: `const closes = market.series("close", 60);
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
    code: `const period = 20;
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
    id: "kde-support-resistance",
    title: "Niveaux de support/résistance (KDE gaussienne)",
    description:
      "Un portage fidèle de computeMarketProfile du projet market-profile-levels (lui-même un portage de find_levels() de son notebook Python) : KDE gaussienne en espace log-prix, largeur de noyau à la manière de scipy.gaussian_kde(bw_method=scalaire) — h = ATR-log moyen × ATR_MULT × écart-type pondéré des log-clôtures — grille de GRID points couvrant exactement l'amplitude observée, et détection de pics par proéminence. Le profil est affiché dans une pane ancrée à droite (plot.pane(..., { dock: \"right\" })), recalculé tous les RECALC_EVERY bougies pour rester sous le budget d'exécution, avec un signal au moment exact où le prix franchit un niveau. Les quatorze constantes de la cellule 1 sont déclarées avec new Variable(type, défaut) : elles apparaissent dans la fenêtre de réglages (celle de l'éditeur comme celle de la pane), se règlent sans toucher au code, et toute tentative de les réaffecter ailleurs dans le script est signalée comme une erreur. Le tutoriel « Niveaux de support/résistance (KDE) » plus haut construit la même idée pas à pas, en prix bruts plutôt qu'en log — c'est la version pédagogique, celle-ci est la version de production :",
    code: `@description "///Niveaux de support/résistance///
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

// %% Cellule 1 — paramètres réglables et outils de calcul
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

// %% Cellule 2 — ne recalculer que tous les RECALC_EVERY bougies
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

// %% Cellule 3 — afficher le profil, tourné, dans une pane ancrée à droite
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

// %% Cellule 4 — détecter un franchissement et signaler
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

// %% Cellule 5 — tracer les niveaux en points sur le graphique des prix
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
];
