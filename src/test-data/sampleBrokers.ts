import type {
  BrokerAccount,
  BrokerAdapter,
  BrokerMarket,
  BrokerOrderResult,
  BrokerPosition,
  BrokerSession,
} from "../components/charts/candlestick/broker/interfaces/Broker.interface";

/** A stand-in list of brokers, for stories and for anyone trying the workspace out.
 *
 *  Invented, and deliberately so — the names are plausible rather than real, because a list of real
 *  brokers shipped inside a component library is a list that goes stale and an endorsement nobody
 *  asked it to make. What is real is the *shape*: each one asks for a different set of credentials
 *  and exposes a different mix of accounts, which is the whole reason both are declared per broker
 *  rather than fixed.
 *
 *  **None of these talks to anything.** Every call below waits and then answers from the data in
 *  this file — see `BrokerAdapter`, and the reasoning there for why the library ships no broker of
 *  its own and cannot place an order behind anyone's back. A real adapter lives in the host
 *  application, holds the credentials (ideally by not holding them, and letting its own backend do
 *  it), and is the only thing that ever reaches the broker. */
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The instruments the fakes will admit to knowing, keyed by the chart symbol that resolves to
 *  them. A symbol absent from here resolves to `null`, which is the case worth being able to
 *  demonstrate: the order ticket stops rather than preparing an order on a guessed instrument. */
const DEMO_MARKETS: Record<string, Omit<BrokerMarket, "currency">> = {
  MSFT: { epic: "EQ.MSFT", label: "Microsoft", minSize: 1, sizeStep: 1, tickSize: 0.01, tickValue: 1, tradable: true },
  AAPL: { epic: "EQ.AAPL", label: "Apple", minSize: 1, sizeStep: 1, tickSize: 0.01, tickValue: 1, tradable: true },
  NVDA: { epic: "EQ.NVDA", label: "NVIDIA", minSize: 1, sizeStep: 1, tickSize: 0.01, tickValue: 1, tradable: true },
  BTCUSD: { epic: "CX.BTCUSD", label: "Bitcoin / USD", minSize: 0.01, sizeStep: 0.01, tickSize: 0.5, tickValue: 0.01, tradable: true },
  EURUSD: { epic: "FX.EURUSD", label: "EUR / USD", minSize: 0.1, sizeStep: 0.1, tickSize: 0.0001, tickValue: 1, tradable: true },
};

/** Everything that differs between two of these fakes, so the seven methods below are written once.
 *
 *  Writing each adapter out in full would be four copies of the same waiting-and-answering, and the
 *  differences — what the form asks for, what accounts exist, which currency — would be buried in
 *  it. They are the only part worth reading. */
interface FakeBrokerSpec {
  id: string;
  label: string;
  notice: string;
  environments: BrokerAdapter["environments"];
  credentialFields: BrokerAdapter["credentialFields"];
  currency: string;
  accounts: BrokerAccount[];
}

const SPECS: FakeBrokerSpec[] = [
  {
    id: "northwind",
    label: "Northwind Markets",
    notice: "Actions et ETF américains. Adaptateur factice : aucun appel ne quitte cette page.",
    environments: ["demo", "live"],
    credentialFields: [
      { name: "key", label: "Clé d'API", type: "password", placeholder: "nw_live_…", hint: "Console Northwind → Développeurs → Clés." },
      { name: "secret", label: "Secret", type: "password" },
    ],
    currency: "USD",
    // Demo and live under one login, so each account has to say which it is — the case
    // `BrokerAccount.kind` exists for.
    accounts: [
      { id: "nw-demo-cash", kind: "demo", type: "Compte au comptant", label: "NW-DEMO-4417", currency: "USD", balance: 100000, available: 100000 },
      { id: "nw-real-cash", kind: "real", type: "Compte au comptant", label: "NW-8821", currency: "USD", balance: 18420.55, available: 16110.2 },
      { id: "nw-real-margin", kind: "real", type: "Compte sur marge", label: "NW-8822", currency: "USD", balance: 42980.1, available: 31740.0 },
    ],
  },
  {
    id: "meridian",
    label: "Meridian Futures",
    notice: "Futures et options, compte à marge. Adaptateur factice.",
    environments: ["demo", "live"],
    credentialFields: [
      { name: "account", label: "Numéro de compte", type: "text", placeholder: "MF-000000" },
      { name: "token", label: "Jeton d'accès", type: "password" },
      { name: "passphrase", label: "Phrase secrète", type: "password", hint: "Celle définie à la création du jeton, pas le mot de passe du compte." },
    ],
    currency: "EUR",
    accounts: [
      { id: "mf-demo", kind: "demo", type: "Compte sur marge", label: "MF-DEMO-013", currency: "EUR", balance: 50000, available: 50000 },
      { id: "mf-real", kind: "real", type: "Compte sur marge", label: "MF-204118", currency: "EUR", balance: 76310.4, available: 41220.8 },
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
    label: "Kestrel FX",
    notice: "Forex et métaux, 28 paires. Adaptateur factice.",
    environments: ["demo", "live"],
    credentialFields: [
      { name: "login", label: "Identifiant", type: "text" },
      { name: "password", label: "Mot de passe", type: "password" },
      { name: "server", label: "Serveur", type: "text", placeholder: "kestrel-live-03", required: false },
    ],
    currency: "EUR",
    accounts: [
      { id: "kx-demo-cfd", kind: "demo", type: "CFD", label: "KX-DEMO-77", currency: "EUR", balance: 25000, available: 25000 },
      { id: "kx-real-cfd", kind: "real", type: "CFD", label: "KX-51902", currency: "EUR", balance: 9840.22, available: 7310.5 },
    ],
  },
  {
    id: "atlas-paper",
    label: "Atlas Paper Trading",
    notice: "Simulateur : aucun argent réel, aucune clé. Le compte se choisit après connexion.",
    // Practice only, and honest about it: the connection modal then offers no live environment at
    // all rather than one that does not exist.
    environments: ["demo"],
    credentialFields: [],
    currency: "EUR",
    // Where the whole choice lives in the accounts: nothing to decide about real money, and
    // everything to decide about what is traded.
    accounts: [
      { id: "atlas-margin", type: "Compte sur marge", label: "Marge · levier 1:5", currency: "EUR", balance: 100000, available: 100000 },
      { id: "atlas-cfd", type: "CFD", label: "Indices et actions", currency: "EUR", balance: 50000, available: 50000 },
      { id: "atlas-barriers", type: "Barrières & Options", label: "Barrières, vanilles", currency: "EUR", balance: 25000, available: 25000 },
      { id: "atlas-cash", type: "Compte au comptant", label: "Sans levier", currency: "EUR", balance: 10000, available: 10000 },
    ],
  },
];

function fakeAdapter(spec: FakeBrokerSpec): BrokerAdapter {
  return {
    id: spec.id,
    label: spec.label,
    notice: spec.notice,
    environments: spec.environments,
    credentialFields: spec.credentialFields,
    async connect(_values, environment) {
      await wait(700);
      // The credentials are received and dropped on the floor, which is exactly what a fake should
      // do with them and the one behaviour worth copying from this file.
      return { accountId: spec.accounts[0]?.id ?? spec.id, environment, handle: null };
    },
    async disconnect() {
      await wait(150);
    },
    async accounts(session) {
      await wait(200);
      // A live session sees the live accounts and a practice one the practice accounts, except at a
      // broker that puts both under one login — which is what an account declaring its own `kind`
      // means. Those are returned whole, and the panel lets the user choose.
      const mixed = spec.accounts.some((account) => account.kind !== undefined);
      if (!mixed) return spec.accounts;
      return spec.accounts.filter((account) => account.kind === (session.environment === "live" ? "real" : "demo") || account.disabled === true);
    },
    async resolveMarket(_session, symbol) {
      await wait(150);
      const market = DEMO_MARKETS[symbol.toUpperCase()];
      return market === undefined ? null : { ...market, currency: spec.currency };
    },
    async placeOrder(_session, order): Promise<BrokerOrderResult> {
      await wait(500);
      return { status: "accepted", dealId: `DEAL-${order.clientOrderId.slice(-6)}`, price: undefined };
    },
    async positions(): Promise<BrokerPosition[]> {
      await wait(200);
      return [];
    },
    async closePosition(): Promise<BrokerOrderResult> {
      await wait(300);
      return { status: "accepted" };
    },
  };
}

export const SAMPLE_BROKERS: BrokerAdapter[] = SPECS.map(fakeAdapter);

/** Kept so a host reading the stories can see what a session object is without opening the
 *  interface file. Unused by the adapters themselves, which hand back `handle: null`. */
export type SampleBrokerSession = BrokerSession;
