import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../../../primitives/Modal";
import { AlertTriangleIcon } from "../../../../icons";
import { DEFAULT_BROKER_LIMITS, ENVIRONMENT_LABEL, type BrokerLimits } from "../brokerSafety";
import type { BrokerAdapter, BrokerEnvironment } from "../interfaces/Broker.interface";
import "./Broker.css";

export interface BrokerConnectModalProps {
  open: boolean;
  onClose: () => void;
  /** Every broker the host offers. Empty is the normal state — this library ships none. */
  adapters: BrokerAdapter[];
  connecting: boolean;
  connectionError: string | null;
  connect: (adapterId: string, values: Record<string, string>, environment: BrokerEnvironment) => void;
  limits: BrokerLimits;
  onLimitsChange: (limits: BrokerLimits) => void;
  /** Opens the explanatory window. */
  onHelp: () => void;
}

/** One number the user sets before trading, with the sentence that says what it stops. */
function LimitField({
  label,
  value,
  min,
  step = 1,
  what,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  step?: number;
  what: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="lq-broker__limit">
      <span className="lq-broker__limit-label">
        {label}
        <abbr className="lq-broker__what" title={what}>
          ?
        </abbr>
      </span>
      <input
        type="number"
        className="lq-broker__number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(Math.max(min, next));
        }}
      />
      <span className="lq-broker__limit-what">{what}</span>
    </label>
  );
}

/** Connecting to a broker, and the ceilings that connection will be held to.
 *
 *  The limits are on this screen rather than in a settings panel somewhere, and that is deliberate:
 *  they are the terms of the connection, and asking for them afterwards would mean the first order
 *  is placed under no terms at all.
 *
 *  Nothing typed here is kept by this library. The values go straight to the adapter's own
 *  `connect` and the form's state dies with the modal — see `BrokerCredentialField`. */
export function BrokerConnectModal({
  open,
  onClose,
  adapters,
  connecting,
  connectionError,
  connect,
  limits,
  onLimitsChange,
  onHelp,
}: BrokerConnectModalProps) {
  const [adapterId, setAdapterId] = useState<string>("");
  const [environment, setEnvironment] = useState<BrokerEnvironment>("demo");
  const [values, setValues] = useState<Record<string, string>>({});
  const [liveAcknowledged, setLiveAcknowledged] = useState(false);

  const adapter = useMemo(() => adapters.find((a) => a.id === adapterId) ?? null, [adapters, adapterId]);

  // Credentials are dropped whenever the broker changes, and whenever the modal closes: a field
  // named the same thing at two brokers is not the same secret, and a form that keeps one is a form
  // that will send it to the wrong place.
  useEffect(() => {
    setValues({});
    setLiveAcknowledged(false);
    // A broker with no practice account cannot default to one.
    if (adapter && !adapter.environments.includes("demo")) setEnvironment("live");
    else setEnvironment("demo");
  }, [adapter]);

  useEffect(() => {
    if (!open) {
      setValues({});
      setLiveAcknowledged(false);
    }
  }, [open]);

  if (!open) return null;

  const missing = (adapter?.credentialFields ?? []).filter((field) => field.required !== false && !(values[field.name] ?? "").trim());
  const needsAcknowledgement = environment === "live" && !liveAcknowledged;
  const canConnect = adapter !== null && missing.length === 0 && !needsAcknowledgement && !connecting;

  return (
    <Modal
      open
      onClose={onClose}
      title="Connexion au courtier"
      size="wide"
      headerActions={
        <button type="button" className="lq-broker__header-help" onPointerDown={(e) => e.stopPropagation()} onClick={onHelp}>
          Comment ça marche ?
        </button>
      }
      footer={
        <div className="lq-chart__edit-drawing-footer">
          <button type="button" className="lq-chart__reset-button" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="lq-chart__confirm-button"
            disabled={!canConnect}
            onClick={() => adapter && connect(adapter.id, values, environment)}
          >
            {connecting ? "Connexion…" : "Se connecter"}
          </button>
        </div>
      }
    >
      <div className="lq-broker">
        {adapters.length === 0 ? (
          // Not an error, and it must not look like one. A library that ships no broker is a
          // library that cannot place an order behind your back, which is the whole design.
          <div className="lq-broker__empty">
            <p>
              <strong>Aucun courtier n&apos;est disponible dans cette application.</strong>
            </p>
            <p>
              Cette bibliothèque n&apos;en fournit aucun et ne se connecte à rien elle-même : elle affiche les
              formulaires, assemble les ordres, applique vos plafonds et tient le journal. Les appels qui sortent du
              navigateur appartiennent à l&apos;application qui l&apos;utilise.
            </p>
            <p className="lq-broker__note">
              Pour en proposer un, fournissez un <code>BrokerAdapter</code> à l&apos;espace de travail. Il décrit ce que
              son formulaire demande et porte les appels — connexion, instruments, ordres, positions.
            </p>
            <button type="button" className="lq-chart__reset-button" onClick={onHelp}>
              Lire l&apos;explication complète
            </button>
          </div>
        ) : (
          <>
            <section className="lq-broker__section">
              <h4 className="lq-broker__title">Courtier</h4>
              <select className="lq-broker__select" value={adapterId} onChange={(e) => setAdapterId(e.target.value)} aria-label="Courtier">
                <option value="">Choisir un courtier…</option>
                {adapters.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
              {adapter?.notice && <p className="lq-broker__note">{adapter.notice}</p>}
            </section>

            {adapter && (
              <>
                <section className="lq-broker__section">
                  <h4 className="lq-broker__title">Environnement</h4>
                  <div className="lq-broker__environments">
                    {adapter.environments.map((value) => (
                      <label
                        key={value}
                        className={[
                          "lq-broker__environment",
                          environment === value && "lq-broker__environment--current",
                          value === "live" && "lq-broker__environment--live",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <input
                          type="radio"
                          name="lq-broker-environment"
                          checked={environment === value}
                          onChange={() => setEnvironment(value)}
                        />
                        <span>{ENVIRONMENT_LABEL[value]}</span>
                      </label>
                    ))}
                  </div>
                  {environment === "live" && (
                    // The one screen where a wrong click costs money. Not a warning banner that can
                    // be read past: a checkbox that has to be ticked, worded as what it actually is.
                    <label className="lq-broker__acknowledge">
                      <input type="checkbox" checked={liveAcknowledged} onChange={(e) => setLiveAcknowledged(e.target.checked)} />
                      <span>
                        <AlertTriangleIcon size={13} /> Je comprends que les ordres passés depuis cette connexion engagent de
                        l&apos;argent réel.
                      </span>
                    </label>
                  )}
                </section>

                <section className="lq-broker__section">
                  <h4 className="lq-broker__title">Identifiants</h4>
                  <p className="lq-broker__note">
                    Ils sont transmis tels quels à l&apos;adaptateur de votre application et ne sont conservés nulle part
                    par cette bibliothèque — ni en mémoire au-delà de cette fenêtre, ni dans le navigateur.
                  </p>
                  <div className="lq-broker__fields">
                    {adapter.credentialFields.map((field) => (
                      <label key={field.name} className="lq-broker__field">
                        <span className="lq-broker__limit-label">
                          {field.label}
                          {field.hint && (
                            <abbr className="lq-broker__what" title={field.hint}>
                              ?
                            </abbr>
                          )}
                        </span>
                        <input
                          className="lq-broker__input"
                          type={field.type}
                          value={values[field.name] ?? ""}
                          placeholder={field.placeholder}
                          autoComplete="off"
                          onChange={(e) => setValues((current) => ({ ...current, [field.name]: e.target.value }))}
                        />
                        {field.hint && <span className="lq-broker__limit-what">{field.hint}</span>}
                      </label>
                    ))}
                  </div>
                </section>
              </>
            )}

            <section className="lq-broker__section">
              <h4 className="lq-broker__title">
                Plafonds
                <abbr
                  className="lq-broker__what"
                  title="Les termes de cette connexion. Un ordre qui en dépasse un est refusé, et en mode automatique le dépassement désarme."
                >
                  ?
                </abbr>
              </h4>
              <p className="lq-broker__note">
                Ils s&apos;appliquent à tout ce qui part d&apos;ici, quel que soit le mode. Ils sont demandés maintenant
                parce que les demander plus tard voudrait dire passer le premier ordre sans aucun plafond.
              </p>
              <div className="lq-broker__limits">
                <LimitField
                  label="Taille max. par ordre"
                  value={limits.maxOrderSize}
                  min={0}
                  step={0.1}
                  what="Un ordre plus gros que cela est refusé, d'où qu'il vienne."
                  onChange={(maxOrderSize) => onLimitsChange({ ...limits, maxOrderSize })}
                />
                <LimitField
                  label="Ordres par jour"
                  value={limits.maxOrdersPerDay}
                  min={1}
                  what="Tentatives comprises : un ordre refusé par le courtier compte aussi."
                  onChange={(maxOrdersPerDay) => onLimitsChange({ ...limits, maxOrdersPerDay })}
                />
                <LimitField
                  label="Perte max. du jour"
                  value={limits.maxDailyLoss}
                  min={0}
                  step={10}
                  what="Au-delà, plus aucun ordre ne part jusqu'au lendemain. Calculée sur le résultat que votre application rapporte."
                  onChange={(maxDailyLoss) => onLimitsChange({ ...limits, maxDailyLoss })}
                />
                <LimitField
                  label="Risque max. par ordre"
                  value={limits.maxRiskPerOrder}
                  min={0}
                  step={10}
                  what="Taille × distance au stop. Un ordre dont le risque dépasse ce montant est refusé."
                  onChange={(maxRiskPerOrder) => onLimitsChange({ ...limits, maxRiskPerOrder })}
                />
              </div>
              <button type="button" className="lq-broker__reset-limits" onClick={() => onLimitsChange(DEFAULT_BROKER_LIMITS)}>
                Revenir aux plafonds par défaut
              </button>
            </section>

            {connectionError && (
              <p className="lq-broker__error">
                <AlertTriangleIcon size={13} /> {connectionError}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
