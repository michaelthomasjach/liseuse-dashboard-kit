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
}
