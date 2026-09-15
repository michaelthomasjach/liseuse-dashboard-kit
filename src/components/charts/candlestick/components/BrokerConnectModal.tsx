import { useEffect, useState } from "react";
import { Modal } from "../../../primitives/Modal";
import { Button } from "../../../primitives/Button";
import { TextField } from "../../../forms/TextField";
import { ChevronLeftIcon } from "../../../icons";
import type { BrokerConnection, BrokerDef } from "../interfaces/Broker.interface";
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
}

/** How long the stand-in pretends to be talking to the broker. Long enough that the pending state
 *  is visibly a state and not a flicker, short enough not to be a wait. */
const SIMULATED_DELAY = 900;

/** Stands in for a real connection when no `onConnect` is given.
 *
 *  It exists so the whole flow — pending, connected, the account line, disconnecting — can be seen
 *  and demonstrated without an account anywhere. It never contacts anything: it waits, then reports
 *  the account as the last four characters of whichever credential was given first, which is the
 *  same masking a broker's own console shows and keeps the secret itself out of the connection
 *  object (see `BrokerConnection`). A broker declaring no credentials at all connects as
 *  "Compte de démonstration". */
function simulateConnect(broker: BrokerDef, credentials: Record<string, string>): Promise<BrokerConnection> {
  const first = broker.credentials[0];
  const value = first === undefined ? "" : (credentials[first.id] ?? "");
  const account = value.length >= 4 ? `••••${value.slice(-4)}` : "Compte de démonstration";
  return new Promise((resolve) => {
    setTimeout(() => resolve({ brokerId: broker.id, account, connectedAt: Date.now() }), SIMULATED_DELAY);
  });
}

function formatConnectedAt(at: number): string {
  return new Date(at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Picking a broker, handing it credentials, and seeing which ones are connected.
 *
 *  Three states in one dialog rather than three dialogs, because they are one errand: the list of
 *  brokers, one broker's own form, and what is already connected. Which one shows follows from
 *  whether a broker is selected and whether anything is connected yet — there is no separate
 *  "screen" state to get out of step with it.
 *
 *  Several connections at once are the normal case, not an edge one: a data feed and an execution
 *  venue are usually different companies. So the connected view always offers to add another rather
 *  than treating the first as the answer. */
export function BrokerConnectModal({ open, onClose, brokers, connections, onConnect, onConnected, onDisconnect }: BrokerConnectModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = brokers.find((b) => b.id === selectedId) ?? null;
  const connectedIds = new Set(connections.map((c) => c.brokerId));

  // Reopening starts from the top. A form left half-filled from last time is a form nobody asked
  // for, and the credentials in it have no business outliving the dialog.
  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setValues({});
      setError(null);
      setPending(false);
    }
  }, [open]);

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
      const connection: BrokerConnection =
        result != null && typeof result === "object" ? result : { brokerId: selected.id, connectedAt: Date.now() };
      onConnected(connection);
      setSelectedId(null);
      setValues({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "La connexion a échoué.");
    } finally {
      setPending(false);
    }
  }

  const title = selected !== null ? `Se connecter à ${selected.name}` : "Brokers";

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
      ) : (
        <div className="lq-broker">
          {connections.length > 0 && (
            <section className="lq-broker__section">
              <h3 className="lq-broker__section-title">Connectés</h3>
              {connections.map((connection) => {
                const broker = brokers.find((b) => b.id === connection.brokerId);
                return (
                  <div key={connection.brokerId} className="lq-broker__row lq-broker__row--connected">
                    {/* The dot is the connected state, so it takes the "up" colour from the
                        stylesheet and carries no inline brand colour of its own — an inline style
                        would win over that rule. A "Connecté" label beside it repeated the section
                        heading directly above and cost the row the width it needed, so the account
                        and its date wrapped onto a second line. */}
                    <span className="lq-broker__dot" aria-hidden="true" />
                    <span className="lq-broker__identity">
                      <span className="lq-broker__name">{broker?.name ?? connection.brokerId}</span>
                      <span className="lq-broker__meta">
                        {connection.account ? `${connection.account} · ` : ""}
                        depuis le {formatConnectedAt(connection.connectedAt)}
                      </span>
                    </span>
                    <button type="button" className="lq-broker__disconnect" onClick={() => onDisconnect(connection.brokerId)}>
                      Déconnecter
                    </button>
                  </div>
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
