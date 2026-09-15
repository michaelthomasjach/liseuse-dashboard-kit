/** One field a broker's own connection form asks for.
 *
 *  Declared by the broker rather than fixed by this library, because there is no shape they share:
 *  one wants a key and a secret, the next a token and an account number, a third adds a passphrase.
 *  A form hard-coded to any one of them is wrong for the other two. */
export interface BrokerCredentialField {
  id: string;
  label: string;
  /** `"password"` masks the value and keeps it out of autofill. Default `"password"`, since most
   *  of what a broker asks for is a secret; say `"text"` for the ones that are not, like an
   *  account number. */
  type?: "text" | "password";
  placeholder?: string;
  /** Default true. A field marked optional does not block the connect button. */
  required?: boolean;
  /** One line under the field: where to find this value in the broker's own console. */
  hint?: string;
}

/** One account behind a broker connection.
 *
 *  Two things have to be told apart here and they are not the same question. `kind` is whether real
 *  money moves — the only distinction that can cost someone something, so it is a closed union and
 *  never free text. `type` is the *product* the account trades, and that is free text on purpose:
 *  "Compte sur marge", "CFD", "Barrières & Options", "Compte au comptant" and whatever a given
 *  broker invents next are its own vocabulary, and a union here would either be wrong for somebody
 *  or grow forever. */
export interface BrokerAccount {
  id: string;
  /** Real money, or a simulator. */
  kind: "real" | "demo";
  /** What the account trades, in the broker's own words — "Compte sur marge", "CFD", "Barrières &
   *  Options". Shown as-is. */
  type: string;
  /** The account's own identifier on screen — a number, a nickname. */
  label?: string;
  currency?: string;
  /** Cash available, in `currency`. Shown when given; a broker that does not report one simply
   *  shows nothing rather than a zero it never said. */
  balance?: number;
  /** Not selectable — awaiting approval, closed, out of the trading hours it allows. */
  disabled?: boolean;
  /** Why, in one line. Shown beside the account so a greyed-out row is never a mystery. */
  disabledReason?: string;
}

/** A broker the chart can offer to connect to. The list is a prop — this library knows nothing
 *  about any particular broker, and one that shipped its own list would be out of date the day
 *  after it was written. */
export interface BrokerDef {
  id: string;
  name: string;
  /** One line in the list, saying what connecting actually gets you. */
  description?: string;
  /** Drawn as the disc beside the name. Falls back to the theme's accent. */
  color?: string;
  /** What the connection form asks for. An empty list means the broker connects with no
   *  credentials at all — a paper-trading sandbox, say. */
  credentials: BrokerCredentialField[];
  /** Shown once under the form: where the keys come from. Plain text, never a link this library
   *  invents. */
  docsHint?: string;
  /** The accounts this broker offers, used when the connection is simulated — a real connection
   *  discovers them and hands them back on `BrokerConnection` instead. Declared here so the whole
   *  flow, account picker included, can be demonstrated without an account anywhere. */
  accounts?: BrokerAccount[];
}

/** A broker that is currently connected.
 *
 *  Deliberately carries no secret. The credentials go to the caller's own `onBrokerConnect` and are
 *  never kept here: this object is what the chart *displays*, and a chart that held live API keys
 *  in its own state would put them in every React devtools session and every serialized layout. */
export interface BrokerConnection {
  brokerId: string;
  /** What identifies the account on screen — a masked key, an account number, a label. Whatever
   *  the caller hands back; shown as-is. */
  account?: string;
  /** Epoch milliseconds. */
  connectedAt: number;
  /** What this connection can trade on. A real `onBrokerConnect` fills it from whatever the broker
   *  reported; a simulated connection copies `BrokerDef.accounts`. Absent for a broker that has
   *  only one account and does not name it. */
  accounts?: BrokerAccount[];
  /** Which of `accounts` orders would go to. Defaulted to a *demo* account whenever the broker has
   *  one, never to a real-money account: the safe default is the one where being wrong costs
   *  nothing, and choosing the other is one click away. */
  activeAccountId?: string;
}
