import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { BrokerConnectModal } from "./components/BrokerConnectModal";
import { BrokerHelpModal } from "./components/BrokerHelpModal";
import { BrokerOrderTicket } from "./components/BrokerOrderTicket";
import { BrokerPanel } from "./components/BrokerPanel";
import { useBrokerState } from "./useBrokerState";
import { newClientOrderId } from "./brokerSafety";
import type { BrokerAdapter, BrokerMarket } from "./interfaces/Broker.interface";

const meta: Meta = {
  title: "Charts/Courtier",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

/** A broker that exists only in this story.
 *
 *  It is here rather than in the library on purpose, and it is worth saying why twice: the library
 *  ships no broker at all. Every call below is a fake with a delay in front of it — nothing leaves
 *  this page. Read it as the shape a real adapter has to take, not as one.
 *
 *  A real one lives in *your* application: it holds the credentials (ideally by not holding them,
 *  and letting your own backend do it), it knows the broker's protocol, and it is the only thing
 *  that ever talks to it. */
const DEMO_MARKET: BrokerMarket = {
  epic: "CS.D.MSFT.CFD.IP",
  label: "Microsoft — CFD",
  currency: "EUR",
  minSize: 0.5,
  sizeStep: 0.5,
  tickSize: 0.01,
  tickValue: 0.1,
  tradable: true,
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const demoAdapter: BrokerAdapter = {
  id: "demo-broker",
  label: "Courtier de démonstration",
  environments: ["demo", "live"],
  notice: "Adaptateur factice défini dans cette story. Aucun appel ne quitte cette page.",
  credentialFields: [
    { name: "apiKey", label: "Clé d'API", type: "password", hint: "Console du courtier → Paramètres → Clés d'API." },
    { name: "identifier", label: "Identifiant", type: "text" },
    { name: "password", label: "Mot de passe", type: "password" },
  ],
  async connect(_values, environment) {
    await wait(400);
    return { accountId: "DEMO-1", environment, handle: null };
  },
  async disconnect() {
    await wait(120);
  },
  async accounts() {
    return [{ id: "DEMO-1", label: "Compte de démonstration", currency: "EUR", available: 9_820.44, balance: 10_000 }];
  },
  async resolveMarket(_session, symbol) {
    await wait(120);
    // A real adapter answers null for a symbol the broker does not offer, and the ticket then
    // refuses to prepare anything rather than guessing at an instrument.
    return symbol.toUpperCase() === "MSFT" ? DEMO_MARKET : null;
  },
  async placeOrder(_session, order) {
    await wait(500);
    // Rejects one order in four, so the journal and the disarming can actually be seen.
    if (Math.random() < 0.25) return { status: "rejected", reason: "Marché momentanément indisponible (simulation)." };
    return { status: "accepted", dealId: `DEAL-${order.clientOrderId.slice(-6)}`, price: 412.88 };
  },
  async positions() {
    await wait(150);
    return [
      {
        id: "POS-1",
        epic: DEMO_MARKET.epic,
        label: DEMO_MARKET.label,
        side: "buy",
        size: 1,
        openPrice: 408.2,
        profit: 46.8,
        stopLoss: 399,
      },
    ];
  },
  async closePosition() {
    await wait(300);
    return { status: "accepted" };
  },
};

/** Everything wired together, the way a host would. */
function Playground({ adapters }: { adapters: BrokerAdapter[] }) {
  const broker = useBrokerState({ adapters, pnlToday: -18.4 });
  const [connectOpen, setConnectOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpWindow, setHelpWindow] = useState<Window | null>(null);
  const [ticket, setTicket] = useState<number | null>(null);

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      <div style={{ width: 300, border: "1px solid var(--lq-color-border-subtle)" }}>
        <BrokerPanel
          broker={broker}
          currency="EUR"
          onConnect={() => setConnectOpen(true)}
          onHelp={() => setHelpOpen(true)}
          onNewOrder={() => setTicket(Date.now())}
          onConfirmPending={() => void broker.confirmPending()}
        />
      </div>

      <div style={{ maxWidth: 520, fontSize: 13, lineHeight: 1.6, opacity: 0.8 }}>
        <p>
          Le panneau à gauche est tout ce que la bibliothèque fournit : la connexion, les modes, l&apos;armement, les
          plafonds, le ticket, les positions et le journal. Le courtier de cette story est un faux défini dans le
          fichier de la story — <strong>la bibliothèque n&apos;en embarque aucun</strong>.
        </p>
        <p>
          Un ordre sur quatre est rejeté par ce faux courtier, pour que le journal et le désarmement automatique se
          voient. Essayez : mode Automatique, armer, puis « Nouvel ordre » sans stop — il est refusé avant de partir.
        </p>
      </div>

      <BrokerConnectModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        adapters={broker.adapters}
        connecting={broker.connecting}
        connectionError={broker.connectionError}
        connect={(id, values, environment) => {
          void broker.connect(id, values, environment).then(() => setConnectOpen(false));
        }}
        limits={broker.limits}
        onLimitsChange={broker.setLimits}
        onHelp={() => setHelpOpen(true)}
      />

      {ticket !== null && (
        // Keyed, so a second ticket never inherits the first one's fields — see `initial`.
        <BrokerOrderTicket
          key={ticket}
          open
          onClose={() => setTicket(null)}
          market={DEMO_MARKET}
          environment={broker.session?.environment ?? "demo"}
          referencePrice={412.88}
          limits={broker.limits}
          day={broker.day}
          mode={broker.mode}
          currency="EUR"
          onSubmit={(order) => {
            void broker.submit(order, DEMO_MARKET, 412.88);
            setTicket(null);
          }}
          onHelp={() => setHelpOpen(true)}
        />
      )}

      <BrokerHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        detachedWindow={helpWindow}
        onDetach={() => {
          const child = window.open("", "", "width=760,height=900");
          if (child !== null) {
            setHelpWindow(child);
            setHelpOpen(false);
          }
        }}
        onDetachedClose={() => setHelpWindow(null)}
        themeSource={document.querySelector(".lq-root")}
      />
    </div>
  );
}

export const Connected: Story = {
  name: "Avec un courtier (factice)",
  render: () => <Playground adapters={[demoAdapter]} />,
};

export const NoBroker: Story = {
  name: "Sans aucun courtier",
  render: () => <Playground adapters={[]} />,
};

/** The pieces a real integration has to provide, spelled out beside the fake one above. */
export const Contract: Story = {
  name: "Le contrat",
  render: () => (
    <div style={{ maxWidth: 760, fontSize: 13, lineHeight: 1.7 }}>
      <p>
        Fournir un courtier, c&apos;est fournir un objet <code>BrokerAdapter</code> : ce que son formulaire demande, et
        sept appels — <code>connect</code>, <code>disconnect</code>, <code>accounts</code>, <code>resolveMarket</code>,{" "}
        <code>placeOrder</code>, <code>positions</code>, <code>closePosition</code>.
      </p>
      <p>
        Deux d&apos;entre eux méritent une mention. <code>resolveMarket</code> traduit un symbole de graphique en
        instrument négociable, et doit rendre <code>null</code> quand le courtier ne l&apos;offre pas : le ticket
        s&apos;arrête alors, plutôt que de préparer un ordre sur un instrument deviné. Et <code>placeOrder</code> reçoit
        un <code>clientOrderId</code> qu&apos;il doit transmettre tel quel — c&apos;est la seule protection contre deux
        positions ouvertes à partir d&apos;une intention unique.
      </p>
      <p>
        Aucun de ces appels n&apos;est implémenté par la bibliothèque, et c&apos;est la conception : une bibliothèque
        front qui garderait des identifiants les garderait dans un navigateur.
      </p>
      <p>
        <code>newClientOrderId()</code> est exporté pour les hôtes qui assemblent un ordre eux-mêmes — exemple :{" "}
        <code>{newClientOrderId()}</code>.
      </p>
    </div>
  ),
};
