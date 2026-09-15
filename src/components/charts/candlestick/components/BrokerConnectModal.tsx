import { useEffect, useState } from "react";
import { Modal } from "../../../primitives/Modal";
import { Button } from "../../../primitives/Button";
import { TextField } from "../../../forms/TextField";
import { ChevronLeftIcon } from "../../../icons";
import type { BrokerAccount, BrokerConnection, BrokerDef } from "../interfaces/Broker.interface";
import "./BrokerConnectModal.css";

export interface BrokerConnectModalProps {
  open: boolean;
  onClose: () => void;
  brokers: BrokerDef[];
  connections: BrokerConnection[];
  /** Runs the caller's own connection. Resolving means connected; throwing means it failed, and
   *  whatever the error says is what the form shows. Omit it and the modal simulates a connection
   *  instead — see `simulateConnect`. */
  onConnect?: (broker: BrokerDef, credentials: Record<string, string>) => Promise<BrokerConnection | void> | BrokerConnection | void;
  onConnected: (connection: BrokerConnection) => void;
  onDisconnect: (brokerId: string) => void;
  /** Which account of a connected broker orders should go to. */
  onSelectAccount?: (brokerId: string, accountId: string) => void;
}

/** How long the stand-in pretends to be talking to the broker. Long enough that the pending state
 *  is visibly a state and not a flicker, short enough not to be a wait. */
const SIMULATED_DELAY = 900;

/** The account a fresh connection starts on: a demo one whenever the broker has one, and only
 *  otherwise the first account at all.
 *
 *  Never a real-money account by default. Picking one is a decision with a cost attached, and a
 *  default is not a decision — it is what happens when nobody made one. Switching to real is one
 *  click away in the broker's own view, which is where that choice belongs. */
function defaultAccountId(accounts: BrokerAccount[]): string | undefined {
  const usable = accounts.filter((a) => a.disabled !== true);
  return (usable.find((a) => a.kind === "demo") ?? usable[0])?.id;
}

/** Stands in for a real connection when no `onConnect` is given.
 *
 *  It exists so the whole flow — pending, connected, the accounts, disconnecting — can be seen and
 *  demonstrated without an account anywhere. It never contacts anything: it waits, then reports the
 *  account as the last four characters of whichever credential was given first, which is the same
 *  masking a broker's own console shows and keeps the secret itself out of the connection object
 *  (see `BrokerConnection`). A broker declaring no credentials at all connects as "Compte de
 *  démonstration". */
function simulateConnect(broker: BrokerDef, credentials: Record<string, string>): Promise<BrokerConnection> {
  const first = broker.credentials[0];
  const value = first === undefined ? "" : (credentials[first.id] ?? "");
  const account = value.length >= 4 ? `••••${value.slice(-4)}` : "Compte de démonstration";
  const accounts = broker.accounts ?? [];
  return new Promise((resolve) => {
    setTimeout(
      () =>
        resolve({
          brokerId: broker.id,
          account,
          connectedAt: Date.now(),
          accounts: accounts.length > 0 ? accounts : undefined,
          activeAccountId: defaultAccountId(accounts),
        }),
      SIMULATED_DELAY,
    );
  });
}

function formatConnectedAt(at: number): string {
  return new Date(at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatBalance(account: BrokerAccount): string | null {
  if (account.balance === undefined) return null;
  return `${account.balance.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${account.currency ? ` ${account.currency}` : ""}`;
}

/** The one-line summary of a connection, for its row in the list: which account is live, and on
 *  what. The account *kind* leads, because it is the part that decides whether a mistake costs
 *  money, and a row that says "CFD ••••4821" without saying "réel" says the wrong half. */
function connectionSummary(connection: BrokerConnection): string {
  const active = connection.accounts?.find((a) => a.id === connection.activeAccountId);
  if (active === undefined) return connection.account ?? "Connecté";
  return [active.kind === "real" ? "Réel" : "Démo", active.type, active.label].filter(Boolean).join(" · ");
}

/** Picking a broker, handing it credentials, choosing which of its accounts is live, and seeing
 *  what is already connected.
 *
 *  States in one dialog rather than several dialogs, because they are one errand: the list of
 *  brokers, one broker's own form, one broker's own accounts, and what is already connected. Which
 *  one shows follows from whether a broker is selected, whether one is opened, and whether anything
 *  is connected — there is no separate "screen" state to get out of step with it.
 *
 *  Several connections at once are the normal case, not an edge one: a data feed and an execution
 *  venue are usually different companies. So the connected view always offers to add another rather
 *  than treating the first as the answer. */
export function BrokerConnectModal({ open, onClose, brokers, connections, onConnect, onConnected, onDisconnect, onSelectAccount }: BrokerConnectModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // A connected broker whose own view is open — its accounts, and the button to disconnect it.
  // Distinct from `selectedId`, which is a broker being *connected to*: one is a form, the other is
  // a connection's details, and folding them into one id would make "which view is this" depend on
  // a second piece of state saying what the id meant.
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = brokers.find((b) => b.id === selectedId) ?? null;
  const openedConnection = connections.find((c) => c.brokerId === openedId) ?? null;
  const openedBroker = brokers.find((b) => b.id === openedId) ?? null;
  const connectedIds = new Set(connections.map((c) => c.brokerId));

  // Reopening starts from the top. A form left half-filled from last time is a form nobody asked
  // for, and the credentials in it have no business outliving the dialog.
  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setOpenedId(null);
      setValues({});
      setError(null);
      setPending(false);
    }
  }, [open]);

  // A broker disconnected from its own view leaves nothing to show there. Closing back to the list
  // rather than leaving an empty panel headed by a broker that is no longer connected.
  // Watching `connections` rather than the `connectedIds` set built above: that set is rebuilt on
  // every render, so depending on it would run this effect on every render too.
  useEffect(() => {
    if (openedId !== null && !connections.some((c) => c.brokerId === openedId)) setOpenedId(null);
  }, [openedId, connections]);

  const missing =
    selected === null
      ? []
      : selected.credentials.filter((f) => f.required !== false && (values[f.id] ?? "").trim() === "");

  async function connect() {
    if (selected === null) return;
    setPending(true);
    setError(null);
    try {
      const result = onConnect === undefined ? await simulateConnect(selected, values) : await onConnect(selected, values);
      const base: BrokerConnection =
        result != null && typeof result === "object" ? result : { brokerId: selected.id, connectedAt: Date.now() };
      // A caller's own `onConnect` may report the accounts itself; when it does not, the broker's
      // declared list stands in, so the picker exists either way rather than only in the simulated
      // path. Same for which one starts active.
      const accounts = base.accounts ?? selected.accounts;
      const connection: BrokerConnection = {
        ...base,
        accounts,
        activeAccountId: base.activeAccountId ?? (accounts === undefined ? undefined : defaultAccountId(accounts)),
      };
      onConnected(connection);
      setSelectedId(null);
      setValues({});
      // Straight into the new connection's own view when there is a choice of account to make.
      // Connecting and then having to find the broker again to say which account is live would be
      // two errands where the user was doing one.
      if (accounts !== undefined && accounts.length > 1) setOpenedId(connection.brokerId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "La connexion a échoué.");
    } finally {
      setPending(false);
    }
  }

  const title =
    selected !== null ? `Se connecter à ${selected.name}` : openedBroker !== null ? openedBroker.name : "Brokers";

  return (
    <Modal open={open} onClose={onClose} title={title} footer={null}>
      {selected !== null ? (
        <div className="lq-broker">
          <button type="button" className="lq-broker__back" onClick={() => setSelectedId(null)} disabled={pending}>
            <ChevronLeftIcon size={12} /> Tous les brokers
          </button>

          {selected.credentials.length === 0 ? (
            <p className="lq-broker__note">Ce broker ne demande aucune information : la connexion est immédiate.</p>
          ) : (
            selected.credentials.map((field) => (
              <TextField
                key={field.id}
                label={field.label}
                type={field.type ?? "password"}
                placeholder={field.placeholder}
                helperText={field.hint}
                autoComplete="off"
                spellCheck={false}
                disabled={pending}
                value={values[field.id] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
              />
            ))
          )}

          {selected.docsHint && <p className="lq-broker__note">{selected.docsHint}</p>}
          {error !== null && <p className="lq-broker__error">{error}</p>}

          <Button onClick={connect} disabled={pending || missing.length > 0}>
            {pending ? "Connexion…" : "Se connecter"}
          </Button>
        </div>
      ) : openedConnection !== null ? (
        <BrokerAccountsView
          broker={openedBroker}
          connection={openedConnection}
          onBack={() => setOpenedId(null)}
          onSelectAccount={onSelectAccount}
          onDisconnect={onDisconnect}
        />
      ) : (
        <div className="lq-broker">
          {connections.length > 0 && (
            <section className="lq-broker__section">
              <h3 className="lq-broker__section-title">Connectés</h3>
              {connections.map((connection) => {
                const broker = brokers.find((b) => b.id === connection.brokerId);
                return (
                  // The whole row opens the broker, rather than a separate "details" affordance:
                  // a connected broker has exactly one thing behind it — its accounts — and the row
                  // is already the thing on screen that names it. The disconnect button moved in
                  // there with them, since a button inside a button is not valid markup and the
                  // row's job here is to be that one target.
                  <button
                    key={connection.brokerId}
                    type="button"
                    className="lq-broker__row lq-broker__row--connected lq-broker__row--pick"
                    onClick={() => setOpenedId(connection.brokerId)}
                  >
                    {/* The dot is the connected state, so it takes the "up" colour from the
                        stylesheet and carries no inline brand colour of its own — an inline style
                        would win over that rule. */}
                    <span className="lq-broker__dot" aria-hidden="true" />
                    <span className="lq-broker__identity">
                      <span className="lq-broker__name">{broker?.name ?? connection.brokerId}</span>
                      <span className="lq-broker__meta">
                        {connectionSummary(connection)} · depuis le {formatConnectedAt(connection.connectedAt)}
                      </span>
                    </span>
                    {/* Marks the row that can cost money, in the list where several brokers sit
                        side by side and only the meta line would otherwise say so. */}
                    {connection.accounts?.find((a) => a.id === connection.activeAccountId)?.kind === "real" && (
                      <span className="lq-broker__badge lq-broker__badge--real">Réel</span>
                    )}
                    <span className="lq-broker__chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                );
              })}
            </section>
          )}

          <section className="lq-broker__section">
            <h3 className="lq-broker__section-title">{connections.length > 0 ? "Ajouter un broker" : "Choisir un broker"}</h3>
            {brokers.filter((b) => !connectedIds.has(b.id)).length === 0 ? (
              <p className="lq-broker__note">Tous les brokers de la liste sont connectés.</p>
            ) : (
              brokers
                .filter((b) => !connectedIds.has(b.id))
                .map((broker) => (
                  <button key={broker.id} type="button" className="lq-broker__row lq-broker__row--pick" onClick={() => setSelectedId(broker.id)}>
                    <span className="lq-broker__dot" style={{ backgroundColor: broker.color }} aria-hidden="true" />
                    <span className="lq-broker__identity">
                      <span className="lq-broker__name">{broker.name}</span>
                      {broker.description && <span className="lq-broker__meta">{broker.description}</span>}
                    </span>
                  </button>
                ))
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

/** One connected broker: which account orders go to, and the way out.
 *
 *  Accounts are grouped by `kind` rather than listed flat, and demo comes first. The grouping is the
 *  point: "real or demo" is the only distinction here that can cost someone money, and a flat list
 *  sorted by product name puts a real margin account directly above a demo one with nothing but a
 *  word between them. */
function BrokerAccountsView({
  broker,
  connection,
  onBack,
  onSelectAccount,
  onDisconnect,
}: {
  broker: BrokerDef | null;
  connection: BrokerConnection;
  onBack: () => void;
  onSelectAccount?: (brokerId: string, accountId: string) => void;
  onDisconnect: (brokerId: string) => void;
}) {
  const accounts = connection.accounts ?? [];
  const groups: { kind: "demo" | "real"; title: string; note: string; accounts: BrokerAccount[] }[] = [
    {
      kind: "demo",
      title: "Comptes de démonstration",
      note: "Argent fictif. Les ordres sont simulés, rien n'est transmis au marché.",
      accounts: accounts.filter((a) => a.kind === "demo"),
    },
    {
      kind: "real",
      title: "Comptes réels",
      note: "Argent réel. Les ordres passés depuis le graphique partent au marché.",
      accounts: accounts.filter((a) => a.kind === "real"),
    },
  ];

  return (
    <div className="lq-broker">
      <button type="button" className="lq-broker__back" onClick={onBack}>
        <ChevronLeftIcon size={12} /> Tous les brokers
      </button>

      <p className="lq-broker__note">
        {broker?.description ? `${broker.description} · ` : ""}connecté depuis le {formatConnectedAt(connection.connectedAt)}
        {connection.account ? ` · ${connection.account}` : ""}
      </p>

      {accounts.length === 0 ? (
        <p className="lq-broker__note">Ce broker n&apos;expose qu&apos;un seul compte : il n&apos;y a rien à choisir.</p>
      ) : (
        groups
          .filter((group) => group.accounts.length > 0)
          .map((group) => (
            <section key={group.kind} className="lq-broker__section">
              <h3 className="lq-broker__section-title">{group.title}</h3>
              <p className="lq-broker__note">{group.note}</p>
              {group.accounts.map((account) => {
                const active = account.id === connection.activeAccountId;
                const balance = formatBalance(account);
                return (
                  <button
                    key={account.id}
                    type="button"
                    className={[
                      "lq-broker__row",
                      "lq-broker__account",
                      account.disabled === true ? "lq-broker__account--disabled" : "lq-broker__row--pick",
                      active && "lq-broker__account--active",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    disabled={account.disabled === true}
                    aria-pressed={active}
                    onClick={() => onSelectAccount?.(connection.brokerId, account.id)}
                  >
                    {/* A filled disc on the live account and an empty ring on the others: the same
                        shape either way, so the rows keep one grid and only the fill changes. */}
                    <span className={`lq-broker__radio${active ? " lq-broker__radio--on" : ""}`} aria-hidden="true" />
                    <span className="lq-broker__identity">
                      <span className="lq-broker__name">{account.type}</span>
                      <span className="lq-broker__meta">
                        {[account.label, balance, account.disabled === true ? account.disabledReason : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    {active && <span className="lq-broker__badge lq-broker__badge--active">Actif</span>}
                  </button>
                );
              })}
            </section>
          ))
      )}

      <button type="button" className="lq-broker__disconnect lq-broker__disconnect--block" onClick={() => onDisconnect(connection.brokerId)}>
        Déconnecter {broker?.name ?? connection.brokerId}
      </button>
    </div>
  );
}
