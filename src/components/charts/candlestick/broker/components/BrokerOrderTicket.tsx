import { useMemo, useState } from "react";
import { Modal } from "../../../../primitives/Modal";
import { AlertTriangleIcon } from "../../../../icons";
import { ENVIRONMENT_LABEL, checkOrder, newClientOrderId, type BrokerDayState, type BrokerLimits, type BrokerMode } from "../brokerSafety";
import type {
  BrokerEnvironment,
  BrokerMarket,
  BrokerOrderRequest,
  BrokerOrderSide,
  BrokerOrderType,
} from "../interfaces/Broker.interface";
import "./Broker.css";

export interface BrokerOrderTicketProps {
  open: boolean;
  onClose: () => void;
  market: BrokerMarket | null;
  environment: BrokerEnvironment;
  /** The last price, for the risk figure and for checking which side of the entry a stop is on.
   *  Null when unknown — the ticket then says what it cannot work out instead of guessing. */
  referencePrice: number | null;
  limits: BrokerLimits;
  day: BrokerDayState;
  mode: BrokerMode;
  currency: string;
  /** Pre-filled by whatever raised the ticket — a strategy signal, or nothing.
   *
   *  Read once, when the ticket mounts. A caller reusing one ticket for a second signal must give
   *  it a new `key`: keeping the mounted instance would leave the first signal's size and stop in
   *  the fields under the second signal's name, which is the quietest way this screen could lie. */
  initial?: Partial<Pick<BrokerOrderRequest, "side" | "type" | "size" | "limitPrice" | "stopLoss" | "takeProfit" | "origin">>;
  onSubmit: (order: BrokerOrderRequest) => void;
  onHelp: () => void;
}

function NumberInput({
  label,
  value,
  onChange,
  step,
  placeholder,
  what,
}: {
  label: string;
  value: number | "";
  onChange: (value: number | "") => void;
  step?: number;
  placeholder?: string;
  what?: string;
}) {
  return (
    <label className="lq-broker__field">
      <span className="lq-broker__limit-label">
        {label}
        {what && (
          <abbr className="lq-broker__what" title={what}>
            ?
          </abbr>
        )}
      </span>
      <input
        className="lq-broker__input"
        type="number"
        step={step}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") return onChange("");
          const next = Number(raw);
          if (Number.isFinite(next)) onChange(next);
        }}
      />
    </label>
  );
}

/** One order, assembled and then confirmed.
 *
 *  Two steps rather than one, and not as ceremony: the confirmation screen shows the *assembled*
 *  order — the instrument as the broker names it, the side, the size, the two exit prices and the
 *  money at risk — because that is the only moment where what is about to be sent can be read in
 *  one place. A ticket that submits on its own first click can only be checked afterwards.
 *
 *  Every refusal comes from `checkOrder`, the same function the automatic path uses, so a ticket
 *  can never be more permissive than a strategy. */
export function BrokerOrderTicket({
  open,
  onClose,
  market,
  environment,
  referencePrice,
  limits,
  day,
  mode,
  currency,
  initial,
  onSubmit,
  onHelp,
}: BrokerOrderTicketProps) {
  const [side, setSide] = useState<BrokerOrderSide>(initial?.side ?? "buy");
  const [type, setType] = useState<BrokerOrderType>(initial?.type ?? "market");
  const [size, setSize] = useState<number | "">(initial?.size ?? market?.minSize ?? 1);
  const [limitPrice, setLimitPrice] = useState<number | "">(initial?.limitPrice ?? "");
  const [stopLoss, setStopLoss] = useState<number | "">(initial?.stopLoss ?? "");
  const [takeProfit, setTakeProfit] = useState<number | "">(initial?.takeProfit ?? "");
  const [confirming, setConfirming] = useState(false);
  /** Generated once per ticket, not per attempt: a second click after a timeout must carry the
   *  same id, or a broker honouring it cannot tell a retry from a new order. */
  const [clientOrderId] = useState(newClientOrderId);

  const order: BrokerOrderRequest | null = useMemo(() => {
    if (!market || size === "") return null;
    return {
      clientOrderId,
      epic: market.epic,
      side,
      type,
      size,
      limitPrice: type === "limit" && limitPrice !== "" ? limitPrice : undefined,
      stopLoss: stopLoss === "" ? undefined : stopLoss,
      takeProfit: takeProfit === "" ? undefined : takeProfit,
      origin: initial?.origin,
    };
  }, [market, clientOrderId, side, type, size, limitPrice, stopLoss, takeProfit, initial?.origin]);

  const verdict = useMemo(
    () => (order && market ? checkOrder({ order, market, limits, day, mode, referencePrice }) : null),
    [order, market, limits, day, mode, referencePrice],
  );

  if (!open) return null;

  const fmt = (value: number) => value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Modal
      open
      onClose={onClose}
      title={confirming ? "Confirmer l'ordre" : "Nouvel ordre"}
      headerActions={
        <button type="button" className="lq-broker__header-help" onPointerDown={(e) => e.stopPropagation()} onClick={onHelp}>
          Comment ça marche ?
        </button>
      }
      footer={
        <div className="lq-chart__edit-drawing-footer">
          <button type="button" className="lq-chart__reset-button" onClick={() => (confirming ? setConfirming(false) : onClose())}>
            {confirming ? "Revenir" : "Annuler"}
          </button>
          <button
            type="button"
            className={["lq-chart__confirm-button", environment === "live" && "lq-broker__send--live"].filter(Boolean).join(" ")}
            disabled={!verdict?.ok}
            onClick={() => {
              if (!order) return;
              if (!confirming) return setConfirming(true);
              onSubmit(order);
            }}
          >
            {confirming ? `Envoyer — ${ENVIRONMENT_LABEL[environment]}` : "Vérifier"}
          </button>
        </div>
      }
    >
      <div className="lq-broker">
        {market === null ? (
          <p className="lq-broker__error">
            <AlertTriangleIcon size={13} /> Ce symbole n&apos;a pas d&apos;instrument correspondant chez ce courtier. Aucun ordre ne
            peut être préparé — un ordre sur un instrument deviné serait pire que pas d&apos;ordre du tout.
          </p>
        ) : confirming ? (
          // Everything that will be sent, in the order someone checks it: what, which way, how
          // much, where it stops, what that costs.
          <dl className="lq-broker__confirm">
            <div>
              <dt>Instrument</dt>
              <dd>
                {market.label} <span className="lq-broker__epic">{market.epic}</span>
              </dd>
            </div>
            <div>
              <dt>Sens</dt>
              <dd className={side === "buy" ? "lq-broker__buy" : "lq-broker__sell"}>{side === "buy" ? "Achat" : "Vente"}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{type === "market" ? "Au marché" : `À cours limité ${limitPrice === "" ? "" : fmt(limitPrice)}`}</dd>
            </div>
            <div>
              <dt>Taille</dt>
              <dd>{size === "" ? "—" : size}</dd>
            </div>
            <div>
              <dt>Stop</dt>
              <dd>{stopLoss === "" ? <span className="lq-broker__missing">aucun</span> : fmt(stopLoss)}</dd>
            </div>
            <div>
              <dt>Objectif</dt>
              <dd>{takeProfit === "" ? <span className="lq-broker__missing">aucun</span> : fmt(takeProfit)}</dd>
            </div>
            <div>
              <dt>
                Risque au stop
                <abbr className="lq-broker__what" title="Taille × distance au stop. C'est ce que coûte cet ordre s'il est stoppé.">
                  ?
                </abbr>
              </dt>
              <dd className="lq-broker__risk">
                {verdict?.risk === null || verdict?.risk === undefined ? (
                  <span className="lq-broker__missing">inconnu — ce courtier ne donne pas la valeur du tick</span>
                ) : (
                  `${fmt(verdict.risk)} ${currency}`
                )}
              </dd>
            </div>
            <div>
              <dt>Environnement</dt>
              <dd className={environment === "live" ? "lq-broker__live-word" : undefined}>{ENVIRONMENT_LABEL[environment]}</dd>
            </div>
          </dl>
        ) : (
          <>
            <div className="lq-broker__sides">
              <button
                type="button"
                className={["lq-broker__side", side === "buy" && "lq-broker__side--buy"].filter(Boolean).join(" ")}
                onClick={() => setSide("buy")}
                aria-pressed={side === "buy"}
              >
                Achat
              </button>
              <button
                type="button"
                className={["lq-broker__side", side === "sell" && "lq-broker__side--sell"].filter(Boolean).join(" ")}
                onClick={() => setSide("sell")}
                aria-pressed={side === "sell"}
              >
                Vente
              </button>
            </div>

            <div className="lq-broker__fields">
              <label className="lq-broker__field">
                <span className="lq-broker__limit-label">Type</span>
                <select className="lq-broker__select" value={type} onChange={(e) => setType(e.target.value as BrokerOrderType)}>
                  <option value="market">Au marché</option>
                  <option value="limit">À cours limité</option>
                </select>
              </label>
              <NumberInput
                label="Taille"
                value={size}
                step={market.sizeStep}
                what={`Minimum ${market.minSize}, par pas de ${market.sizeStep}.`}
                onChange={setSize}
              />
              {type === "limit" && <NumberInput label="Prix limite" value={limitPrice} step={market.tickSize} onChange={setLimitPrice} />}
              <NumberInput
                label="Stop"
                value={stopLoss}
                step={market.tickSize}
                what="Le prix auquel la position est coupée. Obligatoire en mode automatique."
                onChange={setStopLoss}
              />
              <NumberInput label="Objectif" value={takeProfit} step={market.tickSize} onChange={setTakeProfit} />
            </div>

            <p className="lq-broker__reference">
              {referencePrice === null ? (
                <span className="lq-broker__missing">Prix de référence inconnu — le risque ne peut pas être chiffré.</span>
              ) : (
                <>
                  Dernier prix <strong>{fmt(referencePrice)}</strong> · risque au stop{" "}
                  <strong>
                    {verdict?.risk === null || verdict?.risk === undefined ? "inconnu" : `${fmt(verdict.risk)} ${currency}`}
                  </strong>
                </>
              )}
            </p>
          </>
        )}

        {verdict && verdict.problems.length > 0 && (
          <ul className="lq-broker__problems">
            {verdict.problems.map((problem) => (
              <li key={problem}>
                <AlertTriangleIcon size={12} /> {problem}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
