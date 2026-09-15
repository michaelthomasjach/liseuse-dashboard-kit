import type { BrokerDef } from "../components/charts/candlestick/interfaces/Broker.interface";

/** A stand-in list of brokers, for stories and for anyone trying the dialog out.
 *
 *  Invented, and deliberately so — the names are plausible rather than real, because a list of real
 *  brokers shipped inside a component library is a list that goes stale and an endorsement nobody
 *  asked it to make. What is real is the *shape*: each one asks for a different set of credentials,
 *  which is the whole reason `BrokerDef.credentials` is declared per broker instead of fixed. */
export const SAMPLE_BROKERS: BrokerDef[] = [
  {
    id: "northwind",
    name: "Northwind Markets",
    description: "Actions et ETF américains · exécution et données",
    color: "#4f7cc9",
    credentials: [
      { id: "key", label: "Clé d'API", placeholder: "nw_live_…", hint: "Console Northwind → Développeurs → Clés." },
      { id: "secret", label: "Secret" },
    ],
    docsHint: "Une clé « live » passe des ordres réels ; une clé « paper » ne touche qu'au simulateur.",
    accounts: [
      { id: "nw-demo-cash", kind: "demo", type: "Compte au comptant", label: "NW-DEMO-4417", currency: "USD", balance: 100000 },
      { id: "nw-real-cash", kind: "real", type: "Compte au comptant", label: "NW-8821", currency: "USD", balance: 18420.55 },
      { id: "nw-real-margin", kind: "real", type: "Compte sur marge", label: "NW-8822", currency: "USD", balance: 42980.1 },
    ],
  },
  {
    id: "meridian",
    name: "Meridian Futures",
    description: "Futures et options · compte à marge",
    color: "#c98a3d",
    credentials: [
      { id: "account", label: "Numéro de compte", type: "text", placeholder: "MF-000000" },
      { id: "token", label: "Jeton d'accès" },
      { id: "passphrase", label: "Phrase secrète", hint: "Celle définie à la création du jeton, pas le mot de passe du compte." },
    ],
    accounts: [
      { id: "mf-demo", kind: "demo", type: "Compte sur marge", label: "MF-DEMO-013", currency: "EUR", balance: 50000 },
      { id: "mf-real", kind: "real", type: "Compte sur marge", label: "MF-204118", currency: "EUR", balance: 76310.4 },
      {
        id: "mf-options",
        kind: "real",
        type: "Barrières & Options",
        label: "MF-204119",
        currency: "EUR",
        disabled: true,
        disabledReason: "En attente de la validation du questionnaire produits dérivés",
      },
    ],
  },
  {
    id: "kestrel",
    name: "Kestrel FX",
    description: "Forex et métaux · 28 paires",
    color: "#6faf82",
    credentials: [
      { id: "login", label: "Identifiant", type: "text" },
      { id: "password", label: "Mot de passe" },
      { id: "server", label: "Serveur", type: "text", placeholder: "kestrel-live-03", required: false },
    ],
    accounts: [
      { id: "kx-demo-cfd", kind: "demo", type: "CFD", label: "KX-DEMO-77", currency: "EUR", balance: 25000 },
      { id: "kx-real-cfd", kind: "real", type: "CFD", label: "KX-51902", currency: "EUR", balance: 9840.22 },
    ],
  },
  {
    id: "atlas-paper",
    name: "Atlas Paper Trading",
    description: "Simulateur · aucun argent réel, aucune clé",
    color: "#8b7bc9",
    credentials: [],
    docsHint: "Le simulateur rejoue les données du graphique. Rien n'est envoyé nulle part.",
    // Demo-only, and several products under it: the case where the account picker carries the whole
    // choice, since "real or demo" is already settled and what is left to pick is *what* is traded.
    accounts: [
      { id: "atlas-margin", kind: "demo", type: "Compte sur marge", label: "Marge · levier 1:5", currency: "EUR", balance: 100000 },
      { id: "atlas-cfd", kind: "demo", type: "CFD", label: "Indices et actions", currency: "EUR", balance: 50000 },
      { id: "atlas-barriers", kind: "demo", type: "Barrières & Options", label: "Barrières, vanilles", currency: "EUR", balance: 25000 },
      { id: "atlas-cash", kind: "demo", type: "Compte au comptant", label: "Sans levier", currency: "EUR", balance: 10000 },
    ],
  },
];
