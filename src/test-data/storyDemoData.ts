import type { BarDatum } from "../components/charts/BarChart";
import type { Candle } from "../components/charts/candlestick/interfaces/Candle.interface";
import type { ChartAlert } from "../components/charts/candlestick/interfaces/ChartAlertDraft.interface";
import type { ChartEvent } from "../components/charts/candlestick/interfaces/ChartEvent.interface";
import type { EqualizerBand } from "../components/audio/Equalizer";
import type { SchedulerResource, SchedulerTask } from "../components/scheduler/schedulerModel";
import { HOUR, MINUTE } from "../components/scheduler/schedulerModel";

/**
 * Données de démonstration partagées par les stories des composants (commandes, tendances, maison,
 * planning, graphiques de marché). Mêmes valeurs que la vitrine de `minimal-dashboard-kit`, pour que
 * les deux Storybook montrent les mêmes exemples.
 *
 * Tout est fixe ou tiré d'un générateur à graine fixe et daté par rapport à un jour fixe : une story
 * doit rendre exactement la même image à chaque chargement. Les sociétés et montants sont fictifs.
 */

/* ---------------------------------------------------------------- commandes et tendances */

export interface DemoOrder {
  id: string;
  client: string;
  produit: string;
  quantite: number;
  montant: number;
  statut: "payée" | "en attente" | "annulée";
  date: string;
}

export const ORDERS: DemoOrder[] = [
  { id: "C-4821", client: "Lemoine SAS", produit: "Abonnement annuel", quantite: 12, montant: 14400, statut: "payée", date: "2026-10-28" },
  { id: "C-4822", client: "Atelier Nord", produit: "Licence poste", quantite: 3, montant: 1080, statut: "payée", date: "2026-10-28" },
  { id: "C-4823", client: "Groupe Vallée", produit: "Abonnement annuel", quantite: 40, montant: 48000, statut: "en attente", date: "2026-10-27" },
  { id: "C-4824", client: "Mercier & Fils", produit: "Module analytique", quantite: 1, montant: 2400, statut: "payée", date: "2026-10-27" },
  { id: "C-4825", client: "Studio Bélier", produit: "Licence poste", quantite: 8, montant: 2880, statut: "annulée", date: "2026-10-26" },
  { id: "C-4826", client: "Cabinet Roux", produit: "Abonnement annuel", quantite: 5, montant: 6000, statut: "payée", date: "2026-10-26" },
  { id: "C-4827", client: "Transports Hary", produit: "Module analytique", quantite: 2, montant: 4800, statut: "en attente", date: "2026-10-25" },
  { id: "C-4828", client: "Ferme du Pré", produit: "Licence poste", quantite: 2, montant: 720, statut: "payée", date: "2026-10-25" },
];

/** Le ton de `Badge` qui dit un statut de commande. */
export function statutTone(statut: DemoOrder["statut"]): "up" | "down" | "warning" {
  return statut === "payée" ? "up" : statut === "annulée" ? "down" : "warning";
}

/** Douze points, un par mois — de quoi nourrir des sparklines. */
export const REVENUE_TREND = [38, 41, 39, 46, 52, 49, 58, 61, 57, 66, 71, 80];
export const SIGNUPS_TREND = [12, 15, 14, 19, 17, 22, 21, 26, 24, 29, 33, 31];
export const CHURN_TREND = [6, 5, 7, 6, 8, 7, 6, 5, 6, 4, 5, 4];

/* ---------------------------------------------------------------- maison */

export const WHITE_BALANCES = [
  { id: "chaud", label: "Blanc chaud" },
  { id: "doux", label: "Blanc doux" },
  { id: "neutre", label: "Blanc neutre" },
  { id: "froid", label: "Blanc froid" },
  { id: "jour", label: "Lumière du jour" },
];

/** La teinte réelle d'une ampoule : une donnée, pas un choix de thème — d'où les valeurs en dur. */
export const LIGHT_COLORS = [
  { id: "rouge", label: "Rouge", color: "#e5484d" },
  { id: "ambre", label: "Ambre", color: "#f5a524" },
  { id: "vert", label: "Vert", color: "#30a46c" },
  { id: "bleu", label: "Bleu", color: "#3e63dd" },
  { id: "violet", label: "Violet", color: "#8e4ec6" },
];

export const INDOOR_TEMPERATURES = [
  { id: "salon", label: "Salon", value: "20,5 °C" },
  { id: "cuisine", label: "Cuisine", value: "21,2 °C" },
  { id: "bureau", label: "Bureau", value: "19,8 °C" },
  { id: "chambre", label: "Chambre parentale", value: "18,6 °C" },
  { id: "sdb", label: "Salle de bain", value: "22,4 °C" },
];

export const SERVICES = [
  { id: "api", label: "API publique", value: "99,98 %" },
  { id: "web", label: "Application web", value: "99,95 %" },
  { id: "paiement", label: "Paiements", value: "100 %" },
  { id: "mail", label: "Envoi d'e-mails", value: "99,41 %" },
  { id: "recherche", label: "Recherche", value: "99,87 %" },
];

/* ---------------------------------------------------------------- audio et planning */

export const EQ_BANDS: EqualizerBand[] = [
  { id: "31", label: "31", gain: 1 },
  { id: "62", label: "62", gain: 3 },
  { id: "125", label: "125", gain: 4 },
  { id: "250", label: "250", gain: 1.5 },
  { id: "500", label: "500", gain: -1 },
  { id: "1k", label: "1 k", gain: -2.5 },
  { id: "2k", label: "2 k", gain: 0 },
  { id: "4k", label: "4 k", gain: 2 },
  { id: "8k", label: "8 k", gain: 3.5 },
  { id: "16k", label: "16 k", gain: 2 },
];

/** Une journée d'atelier ancrée à une date fixe. */
export const SCHEDULE_DAY = new Date("2026-10-30T06:00:00").getTime();
const at = (hours: number) => SCHEDULE_DAY + hours * HOUR;
export const SCHEDULE_NOW = at(5) + 20 * MINUTE;

export const SCHEDULE_RESOURCES: SchedulerResource[] = [
  { id: "l1", label: "Ligne 1", meta: "Assemblage" },
  { id: "l2", label: "Ligne 2", meta: "Assemblage" },
  { id: "cnc", label: "CNC-04", meta: "Usinage" },
  { id: "peinture", label: "Cabine peinture", meta: "Finition" },
  { id: "qualite", label: "Contrôle qualité", meta: "2 opérateurs" },
  { id: "quai", label: "Expédition", meta: "Quai A" },
];

export const SCHEDULE_TASKS: SchedulerTask[] = [
  { id: "t1", resourceId: "l1", label: "Série A — 400 pièces", start: at(0), end: at(3.5), status: "done" },
  { id: "t2", resourceId: "l1", label: "Changement d'outil", start: at(3.5), end: at(4), status: "done", locked: true },
  {
    id: "t3",
    resourceId: "l1",
    label: "Série B — 250 pièces",
    start: at(4),
    end: at(8),
    status: "running",
    description: "Lot client Martin & fils. Contrôle dimensionnel toutes les 50 pièces.",
    subtasks: [
      { id: "t3-s1", label: "Réglage", minutes: 45, status: "done" },
      { id: "t3-s2", label: "Production", minutes: 150, status: "running" },
      { id: "t3-s3", label: "Contrôle", minutes: 45, status: "planned" },
    ],
  },
  { id: "t4", resourceId: "l2", label: "Série C", start: at(1), end: at(5), status: "running" },
  { id: "t5", resourceId: "l2", label: "Reprise urgente", start: at(4), end: at(6.5), status: "late" },
  { id: "t6", resourceId: "l2", label: "Série D", start: at(7), end: at(11), status: "planned", pattern: "striped" },
  { id: "t7", resourceId: "cnc", label: "Lot 118", start: at(0.5), end: at(2), status: "done" },
  { id: "t8", resourceId: "cnc", label: "Lot 119", start: at(2.25), end: at(5.75), status: "running" },
  { id: "t9", resourceId: "cnc", label: "Maintenance préventive", start: at(6), end: at(7.5), status: "blocked", locked: true },
  { id: "t10", resourceId: "peinture", label: "Apprêt série A", start: at(3.5), end: at(5), status: "done" },
  { id: "t11", resourceId: "peinture", label: "Laque série A", start: at(5.25), end: at(7.25), status: "running" },
  { id: "t12", resourceId: "qualite", label: "Contrôle série A", start: at(7.5), end: at(9), status: "planned" },
  { id: "t13", resourceId: "qualite", label: "Audit client", start: at(9.5), end: at(11), status: "planned", pattern: "hatched" },
  { id: "t14", resourceId: "quai", label: "Chargement camion 1", start: at(9), end: at(10.5), status: "planned" },
  { id: "t15", resourceId: "quai", label: "Chargement camion 2", start: at(11), end: at(12), status: "planned" },
];

/* ---------------------------------------------------------------- graphiques */

/** Le « aujourd'hui » des séries. */
const AUJOURDHUI = Date.UTC(2026, 9, 30);

/** mulberry32 : petit générateur à graine, assez bon pour des données de démonstration. */
function graine(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Une variable à peu près normale centrée réduite (somme de trois uniformes). */
const normale = (rand: () => number) => (rand() + rand() + rand() - 1.5) * 2;

const arrondi = (n: number, pas = 1) => Math.round(n / pas) * pas;

export const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** Ventes par canal, en k€, cette année contre l'an dernier. */
export const VENTES_CANAL: BarDatum[] = [
  { id: "web", label: "Site web", values: { n1: 312, n: 388 } },
  { id: "revendeurs", label: "Revendeurs", values: { n1: 246, n: 231 } },
  { id: "grands-comptes", label: "Grands comptes", values: { n1: 198, n: 264 } },
  { id: "marketplace", label: "Marketplace", values: { n1: 87, n: 129 } },
  { id: "salons", label: "Salons", values: { n1: 64, n: 68 } },
];

/** Montant facturé (k€) et délai moyen de paiement (jours) de seize clients. */
export const DELAIS_CLIENTS: { client: string; montant: number; delai: number }[] = (() => {
  const rand = graine(97);
  const noms = [
    "Groupe Delmas", "Arvel Santé", "Transports Moreau", "Lemoine SAS", "Ville de Rennes", "Céramiques Faure",
    "Brasserie Kervel", "Atelier Ponsard", "Optique Garnier", "Cabinet Royer", "Menuiserie Blanc", "Hôtel des Lices",
    "Studio Vasseur", "Pharmacie Leroux", "Imprimerie Caron", "Domaine Aubert",
  ];
  return noms.map((client, i) => ({
    client,
    montant: arrondi(150 - i * 8.5 + normale(rand) * 6, 1),
    delai: arrondi(Math.max(12, 28 + i * 2.2 + normale(rand) * 9), 1),
  }));
})();

/**
 * Des bougies quotidiennes fictives, jours ouvrés seulement, jusqu'au jour fixe.
 *
 * Une marche géométrique avec une légère saisonnalité (meilleure de novembre à avril, molle l'été) :
 * sans elle, la vue de saisonnalité n'aurait rien à montrer que du bruit.
 */
function bougies(annees: number, depart: number, seed: number): Candle[] {
  const rand = graine(seed);
  const fin = new Date(AUJOURDHUI);
  const debut = Date.UTC(fin.getUTCFullYear() - annees, 0, 2);
  const derive = [0.0011, 0.0008, 0.0006, 0.0005, -0.0004, -0.0006, -0.0002, -0.0007, -0.0009, 0.0003, 0.001, 0.0012];
  const out: Candle[] = [];
  let close = depart;
  for (let t = debut; t <= AUJOURDHUI; t += 86_400_000) {
    const d = new Date(t);
    const jour = d.getUTCDay();
    if (jour === 0 || jour === 6) continue;
    const open = close * (1 + normale(rand) * 0.003);
    close = open * Math.exp(derive[d.getUTCMonth()] + normale(rand) * 0.013);
    const high = Math.max(open, close) * (1 + rand() * 0.008);
    const low = Math.min(open, close) * (1 - rand() * 0.008);
    out.push({
      date: d,
      open: arrondi(open, 0.01),
      high: arrondi(high, 0.01),
      low: arrondi(low, 0.01),
      close: arrondi(close, 0.01),
      volume: Math.round(180_000 + rand() * 420_000 + Math.abs(close - open) * 40_000),
    });
  }
  return out;
}

/** Novaterra SA — fictive — sur sept ans : assez d'années pour une saisonnalité qui se lise. */
export const BOUGIES_NOVA = bougies(7, 42, 2026);
/** Kapalia — fictive — sur trois ans. */
export const BOUGIES_KAPA = bougies(3, 118, 404);

const jourOuvre = (y: number, m: number, d: number) => {
  const date = new Date(Date.UTC(y, m, d));
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 1);
  return date;
};

/** Publications, dividendes et assemblée de Novaterra, posés sur les dates de ses bougies. */
export const EVENEMENTS_NOVA: ChartEvent[] = [
  {
    date: jourOuvre(2026, 1, 18),
    kind: "Résultats",
    symbol: "R",
    label: "Résultats annuels 2025",
    details: ["Chiffre d'affaires : 1,08 Md€ (+9 %)", "Marge opérationnelle : 22,2 %", "Réaction du titre : +4,1 %"],
  },
  {
    date: jourOuvre(2026, 4, 12),
    kind: "Dividende",
    symbol: "D",
    label: "Détachement du dividende",
    details: ["0,85 € par action", "Rendement : 2,1 %"],
  },
  {
    date: jourOuvre(2026, 5, 4),
    kind: "Assemblée",
    symbol: "AG",
    label: "Assemblée générale",
    details: ["Toutes les résolutions adoptées", "Programme de rachat d'actions reconduit"],
  },
  {
    date: jourOuvre(2026, 6, 28),
    kind: "Résultats",
    symbol: "R",
    label: "Résultats semestriels",
    details: ["Chiffre d'affaires : 562 M€ (+7 %)", "Prévisions annuelles confirmées", "Réaction du titre : −2,3 %"],
  },
  {
    date: jourOuvre(2026, 9, 22),
    kind: "Résultats",
    symbol: "R",
    label: "Chiffre d'affaires du troisième trimestre",
    details: ["283 M€ (+6 %)", "Carnet de commandes record"],
  },
];

/** Deux évènements tombés sur le même repère — ce qu'une infobulle d'évènement doit savoir lister. */
export const EVENEMENTS_EMPILES: ChartEvent[] = [EVENEMENTS_NOVA[1], EVENEMENTS_NOVA[2]];

const dernierCours = BOUGIES_NOVA[BOUGIES_NOVA.length - 1].close;
const prix = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Les alertes posées sur Novaterra. */
export const ALERTES_NOVA: ChartAlert[] = [
  {
    id: "al-1",
    drawingId: null,
    conditionIndicatorId: "price",
    crossing: { kind: "crossingUp" },
    trigger: "onlyOnce",
    sound: "aucun",
    message: `NOVA franchit ${prix(dernierCours * 1.05)} € à la hausse`,
    expiresAt: null,
  },
  {
    id: "al-2",
    drawingId: null,
    conditionIndicatorId: "price",
    crossing: { kind: "crossingDown" },
    trigger: "oncePerBarClose",
    sound: "aucun",
    message: `NOVA clôture sous ${prix(dernierCours * 0.92)} € (seuil de couverture)`,
    expiresAt: null,
  },
  {
    id: "al-3",
    drawingId: null,
    conditionIndicatorId: "price",
    crossing: { kind: "greaterThan" },
    trigger: "oncePerBar",
    sound: "aucun",
    message: "Volume du jour supérieur à deux fois la moyenne",
    expiresAt: null,
  },
];
