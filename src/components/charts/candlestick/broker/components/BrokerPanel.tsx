import { useEffect, useState } from "react";
import { AlertTriangleIcon, HelpIcon, LockIcon, RefreshIcon, SettingsIcon } from "../../../../icons";
import { ENVIRONMENT_LABEL, type BrokerMode } from "../brokerSafety";
import type { BrokerState } from "../useBrokerState";
import "./Broker.css";

export interface BrokerPanelProps {
  broker: BrokerState;
  /** Opens the connection modal. */
  onConnect: () => void;
  onHelp: () => void;
  /** Opens a blank ticket. */
  onNewOrder: () => void;
  /** Confirms the order a strategy raised in `confirm` mode. */
  onConfirmPending: () => void;
  currency: string;
}

const MODES: { mode: BrokerMode; label: string; what: string }[] = [
  { mode: "manual", label: "Manuel", what: "Un signal prépare un ticket. Rien ne part sans un clic de votre part." },
  {
    mode: "confirm",
    label: "Confirmation",
    what: "Un signal ouvre un ordre en attente avec un compte à rebours. Non confirmé à temps, il est abandonné — jamais envoyé en retard.",
  },
  {
    mode: "auto",
    label: "Automatique",
    what: "Un signal envoie l'ordre, tant que l'automatisation est armée. Le seul mode qui peut engager de l'argent sans personne devant l'écran.",
  },
];

/** The countdown on an order waiting for a decision. Its own component so the rest of the panel is
 *  not re-rendered every second. */
function PendingCountdown({ expiresAt, onExpire }: { expiresAt: number; onExpire: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, expiresAt - Date.now()));
  useEffect(() => {
    const id = window.setInterval(() => {
      const remaining = Math.max(0, expiresAt - Date.now());
      setLeft(remaining);
      // Dropped rather than sent. The market it was computed on is gone, and a late order is a
      // different trade wearing the same numbers.
      if (remaining === 0) onExpire();
    }, 200);
    return () => window.clearInterval(id);
  }, [expiresAt, onExpire]);
  return <span className="lq-broker__countdown">{Math.ceil(left / 1000)} s</span>;
}

/** The trading side of the workspace, in one column: which connection is live, how signals reach
 *  it, what is open, and what has been sent.
 *
 *  The armed banner is the loudest thing in the component on purpose. Automation stays armed across
 *  reloads here (a deliberate choice), which means the only thing standing between a page being
 *  opened and orders being placed is that the reader notices it is on. */
export function BrokerPanel({ broker, onConnect, onHelp, onNewOrder, onConfirmPending, currency }: BrokerPanelProps) {
  const { session, adapter, accounts, mode, setMode, armed, setArmed, limits, day, dailyLossUnknown, journal, positions, pending } = broker;
  const live = session?.environment === "live";
  const fmt = (value: number) => value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <section className="lq-broker-panel" aria-label="Courtier">
      <header className="lq-broker-panel__head">
        <span className="lq-broker-panel__title">COURTIER</span>
        <button type="button" onClick={onHelp} aria-label="Comprendre le passage d'ordres" title="Comprendre le passage d'ordres">
          <HelpIcon size={11} />
        </button>
        <button type="button" onClick={onConnect} aria-label="Connexion au courtier" title="Connexion au courtier">
          <SettingsIcon size={11} />
        </button>
      </header>

      {/* Armed is a state of the application, not of this panel, so it is said first and said
          plainly — including which book it is armed against. */}
      {armed && mode === "auto" && (
        <div className={["lq-broker-panel__armed", live && "lq-broker-panel__armed--live"].filter(Boolean).join(" ")} role="status">
          <AlertTriangleIcon size={14} animated />
          <span>
            Automatisation <strong>armée</strong> — {ENVIRONMENT_LABEL[session?.environment ?? "demo"]}
          </span>
          <button type="button" className="lq-broker-panel__kill" onClick={broker.killSwitch}>
            <LockIcon size={12} /> Tout couper
          </button>
        </div>
      )}

      {session === null ? (
        <div className="lq-broker-panel__disconnected">
          <p>Aucun courtier connecté.</p>
          <button type="button" className="lq-chart__confirm-button" onClick={onConnect}>
            Se connecter
          </button>
        </div>
      ) : (
        <>
          <div className="lq-broker-panel__session">
            <span className="lq-broker-panel__broker">{adapter?.label}</span>
            <span className={["lq-broker-panel__env", live && "lq-broker-panel__env--live"].filter(Boolean).join(" ")}>
              {ENVIRONMENT_LABEL[session.environment]}
            </span>
            <button type="button" className="lq-broker-panel__disconnect" onClick={() => void broker.disconnect()}>
              Déconnecter
            </button>
          </div>

          {accounts.length > 0 && (
            <div className="lq-broker-panel__account">
              {accounts[0].label}
              {accounts[0].available !== undefined && <span> · {fmt(accounts[0].available)} {accounts[0].currency} disponibles</span>}
            </div>
          )}

          <div className="lq-broker-panel__modes" role="group" aria-label="Mode de passage d'ordres">
            {MODES.map((entry) => (
              <button
                key={entry.mode}
                type="button"
                className={["lq-broker-panel__mode", mode === entry.mode && "lq-broker-panel__mode--current"].filter(Boolean).join(" ")}
                onClick={() => {
                  setMode(entry.mode);
                  // Changing mode always disarms. Arming is a decision about the mode you are in,
                  // and carrying it across would make it a decision about a mode you have left.
                  setArmed(false);
                }}
                title={entry.what}
                aria-pressed={mode === entry.mode}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <p className="lq-broker-panel__mode-what">{MODES.find((entry) => entry.mode === mode)?.what}</p>

          {mode === "auto" && !armed && (
            <button type="button" className="lq-broker-panel__arm" onClick={() => setArmed(true)}>
              Armer l&apos;automatisation
            </button>
          )}

          {pending && (
            <div className="lq-broker-panel__pending">
              <span>
                {pending.order.side === "buy" ? "Achat" : "Vente"} {pending.order.size} {pending.market.label}
              </span>
              <PendingCountdown expiresAt={pending.expiresAt} onExpire={() => broker.setPending(null)} />
              <button type="button" className="lq-chart__confirm-button" onClick={onConfirmPending}>
                Confirmer
              </button>
              <button type="button" className="lq-chart__reset-button" onClick={() => broker.setPending(null)}>
                Abandonner
              </button>
            </div>
          )}

          <div className="lq-broker-panel__counters">
            <span>
              {day.ordersToday}/{limits.maxOrdersPerDay} ordres aujourd&apos;hui
            </span>
            <span>
              {dailyLossUnknown ? (
                <abbr
                  className="lq-broker__missing"
                  title="Votre application ne transmet pas le résultat du jour, donc ce plafond ne peut pas se déclencher."
                >
                  perte du jour inconnue
                </abbr>
              ) : (
                `${fmt(day.pnlToday)} ${currency} aujourd'hui`
              )}
            </span>
          </div>

          <div className="lq-broker-panel__actions">
            <button type="button" className="lq-chart__reset-button" onClick={onNewOrder}>
              Nouvel ordre
            </button>
            <button type="button" className="lq-chart__reset-button" onClick={() => void broker.refreshPositions()}>
              <RefreshIcon size={12} /> Positions
            </button>
          </div>

          {positions.length > 0 && (
            <ul className="lq-broker-panel__positions">
              {positions.map((position) => (
                <li key={position.id}>
                  <span className={position.side === "buy" ? "lq-broker__buy" : "lq-broker__sell"}>
                    {position.side === "buy" ? "▲" : "▼"} {position.size}
                  </span>
                  <span className="lq-broker-panel__position-label">{position.label}</span>
                  <span>{fmt(position.openPrice)}</span>
                  {position.profit !== undefined && (
                    <span className={position.profit >= 0 ? "lq-broker__buy" : "lq-broker__sell"}>{fmt(position.profit)}</span>
                  )}
                  <button type="button" onClick={() => void broker.closePosition(position.id)}>
                    Fermer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {journal.length > 0 && (
        <details className="lq-broker-panel__journal">
          <summary>Journal · {journal.length}</summary>
          <ul>
            {journal.slice(0, 40).map((entry) => (
              <li key={entry.id} className={entry.blocked ? "lq-broker-panel__journal-blocked" : undefined}>
                <span className="lq-broker-panel__journal-time">
                  {new Date(entry.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span>
                  {entry.order.side === "buy" ? "Achat" : "Vente"} {entry.order.size} {entry.order.epic}
                </span>
                {entry.blocked ? (
                  <span className="lq-broker__missing">refusé ici — {entry.blocked[0]}</span>
                ) : entry.result ? (
                  <span className={entry.result.status === "accepted" ? "lq-broker__buy" : "lq-broker__sell"}>
                    {entry.result.status === "accepted" ? "accepté" : `rejeté — ${entry.result.reason ?? "sans motif"}`}
                  </span>
                ) : (
                  <span className="lq-broker__missing">en cours…</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
