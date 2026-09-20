import type { SankeyLinkDatum, SankeyNodeDatum } from "../components/charts/SankeyChart";

/** A month of a household budget: five sources into one pot, the pot into four envelopes, each
 *  envelope into what it actually pays for. Every level balances exactly (4 362 € in, 4 362 € out),
 *  which is what makes it useful as a fixture — a Sankey that does not balance hides layout bugs
 *  behind data that was never going to line up anyway. */
export const SANKEY_BUDGET_NODES: SankeyNodeDatum[] = [
  { id: "salaire", label: "Salaire après impôts" },
  { id: "interessement", label: "Intéressement" },
  { id: "primes", label: "Primes" },
  { id: "loyer-lmnp", label: "Loyer LMNP" },
  { id: "tickets", label: "Tickets restaurant" },

  { id: "budget", label: "Budget" },

  { id: "invest", label: "Investissements" },
  { id: "logement", label: "Logement" },
  { id: "quotidien", label: "Vie quotidienne" },
  { id: "abonnements", label: "Abonnements" },
  { id: "reste", label: "Reste disponible" },

  { id: "epargne-interessement", label: "Épargne intéressement" },
  { id: "assurance-vie", label: "Assurance vie" },
  { id: "av-enfant", label: "Assurance vie enfant" },
  { id: "pea", label: "PEA" },
  { id: "credit-lmnp", label: "Remboursement crédit LMNP" },

  { id: "credit-rp", label: "Crédit résidence principale" },
  { id: "charges-rp", label: "Charges copro RP" },
  { id: "autres-rp", label: "Eau, élec, assurances" },
  { id: "charges-lmnp", label: "Charges copro LMNP" },
  { id: "comptable", label: "Comptable LMNP" },
  { id: "pno", label: "Assurance PNO" },
  { id: "tf-lmnp", label: "Taxe foncière LMNP" },
  { id: "tf-rp", label: "Taxe foncière RP" },
  { id: "gestion", label: "Gestion locative" },

  { id: "courses", label: "Courses" },
  { id: "restaurants", label: "Restaurants" },
  { id: "carburant", label: "Carburant" },
  { id: "vie-courante", label: "Vie courante" },
  { id: "coiffeur", label: "Coiffeur" },

  { id: "internet", label: "Internet / Téléphone" },
  { id: "apple", label: "Apple Famille" },
  { id: "amazon", label: "Amazon Prime" },
  { id: "playstation", label: "PlayStation Plus" },
];

export const SANKEY_BUDGET_LINKS: SankeyLinkDatum[] = [
  { source: "salaire", target: "budget", value: 2400 },
  { source: "interessement", target: "budget", value: 666 },
  { source: "primes", target: "budget", value: 166 },
  { source: "loyer-lmnp", target: "budget", value: 959 },
  { source: "tickets", target: "budget", value: 171 },

  { source: "budget", target: "invest", value: 1756 },
  { source: "budget", target: "logement", value: 1554 },
  { source: "budget", target: "quotidien", value: 850 },
  { source: "budget", target: "abonnements", value: 55 },
  { source: "budget", target: "reste", value: 147 },

  { source: "invest", target: "epargne-interessement", value: 666 },
  { source: "invest", target: "assurance-vie", value: 100 },
  { source: "invest", target: "av-enfant", value: 25 },
  { source: "invest", target: "pea", value: 100 },
  { source: "invest", target: "credit-lmnp", value: 865 },

  { source: "logement", target: "credit-rp", value: 925 },
  { source: "logement", target: "charges-rp", value: 120 },
  { source: "logement", target: "autres-rp", value: 215 },
  { source: "logement", target: "charges-lmnp", value: 108 },
  { source: "logement", target: "comptable", value: 18 },
  { source: "logement", target: "pno", value: 7 },
  { source: "logement", target: "tf-lmnp", value: 73 },
  { source: "logement", target: "tf-rp", value: 40 },
  { source: "logement", target: "gestion", value: 48 },

  { source: "quotidien", target: "courses", value: 250 },
  { source: "quotidien", target: "restaurants", value: 300 },
  { source: "quotidien", target: "carburant", value: 80 },
  { source: "quotidien", target: "vie-courante", value: 200 },
  { source: "quotidien", target: "coiffeur", value: 20 },

  { source: "abonnements", target: "internet", value: 18 },
  { source: "abonnements", target: "apple", value: 23 },
  { source: "abonnements", target: "amazon", value: 6 },
  { source: "abonnements", target: "playstation", value: 8 },
];

/** Three columns and nine nodes — the shape a Sankey has when it is one figure in a report rather
 *  than a thing to explore. */
export const SANKEY_REVENUE_NODES: SankeyNodeDatum[] = [
  { id: "abonnements", label: "Abonnements" },
  { id: "licences", label: "Licences" },
  { id: "services", label: "Services" },
  { id: "ca", label: "Chiffre d'affaires" },
  { id: "cout", label: "Coût des ventes" },
  { id: "brut", label: "Marge brute" },
  { id: "rd", label: "R&D" },
  { id: "commercial", label: "Commercial" },
  { id: "resultat", label: "Résultat opérationnel" },
];

export const SANKEY_REVENUE_LINKS: SankeyLinkDatum[] = [
  { source: "abonnements", target: "ca", value: 48200 },
  { source: "licences", target: "ca", value: 16400 },
  { source: "services", target: "ca", value: 9100 },
  { source: "ca", target: "cout", value: 21900 },
  { source: "ca", target: "brut", value: 51800 },
  { source: "brut", target: "rd", value: 19300 },
  { source: "brut", target: "commercial", value: 17600 },
  { source: "brut", target: "resultat", value: 14900 },
];
