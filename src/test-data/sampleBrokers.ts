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
  },
  {
    id: "atlas-paper",
    name: "Atlas Paper Trading",
    description: "Simulateur · aucun argent réel, aucune clé",
    color: "#8b7bc9",
    credentials: [],
    docsHint: "Le simulateur rejoue les données du graphique. Rien n'est envoyé nulle part.",
  },
];
