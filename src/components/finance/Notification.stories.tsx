import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Notification, NotificationProvider, useNotification, NotificationSource, type NotificationCorner } from "./Notification";
import { Button } from "../primitives/Button";
import { FileIcon } from "../icons";

const meta: Meta = {
  title: "Feedback/Notification",
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj;

export const CornerStandalone: Story = {
  name: "Popin de coin (autonome, sans provider)",
  render: () => {
    const [open, setOpen] = useState(true);
    const [corner, setCorner] = useState<NotificationCorner>("bottom-right");
    return (
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["top-left", "top-right", "bottom-left", "bottom-right"] as NotificationCorner[]).map((c) => (
            <Button key={c} selected={c === corner} onClick={() => setCorner(c)}>
              {c}
            </Button>
          ))}
          <Button onClick={() => setOpen(true)}>Réafficher</Button>
        </div>
        <Notification
          open={open}
          onClose={() => setOpen(false)}
          variant="corner"
          corner={corner}
          tone="success"
          title="Virement reçu"
          description="1 200,00 € crédités sur votre compte courant."
          autoDismissMs={6000}
        />
      </div>
    );
  },
};

export const StickyBar: Story = {
  name: "Barre sticky (haut/bas), sans auto-dismiss",
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <div style={{ padding: 24 }}>
        <Button onClick={() => setOpen(true)}>Réafficher la barre</Button>
        <Notification
          open={open}
          onClose={() => setOpen(false)}
          variant="bar"
          barPosition="top"
          tone="warning"
          title="Maintenance planifiée"
          description="Les marchés seront indisponibles dimanche de 2h à 4h."
          dismissible
        />
      </div>
    );
  },
};

export const ModalVariant: Story = {
  name: "Modale, fermeture manuelle uniquement",
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ padding: 24 }}>
        <Button onClick={() => setOpen(true)}>Ouvrir la notification modale</Button>
        <Notification
          open={open}
          onClose={() => setOpen(false)}
          variant="modal"
          tone="error"
          title="Échec de l'ordre"
          description="Solde insuffisant pour exécuter cet ordre au marché."
          dismissible
          actions={
            <>
              <Button selected onClick={() => setOpen(false)}>
                Compris
              </Button>
            </>
          }
        />
      </div>
    );
  },
};

function ProviderDemo() {
  const { notify } = useNotification();
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Button
        onClick={() =>
          notify({ tone: "success", title: "Ordre exécuté", description: "12 AAPL @ 226,34 €", corner: "bottom-right" })
        }
      >
        Coin bas-droit
      </Button>
      <Button
        onClick={() =>
          notify({ tone: "info", title: "Nouveau relevé disponible", corner: "top-left", autoDismissMs: 5000 })
        }
      >
        Coin haut-gauche
      </Button>
      <Button
        onClick={() =>
          notify({
            variant: "bar",
            barPosition: "top",
            tone: "warning",
            title: "Marché fermé",
            description: "Les NYSE rouvrent lundi 9h30.",
            autoDismissMs: 0,
          })
        }
      >
        Barre sticky
      </Button>
      <Button
        onClick={() =>
          notify({
            variant: "modal",
            tone: "error",
            title: "Session expirée",
            description: "Reconnectez-vous pour continuer.",
            autoDismissMs: 0,
          })
        }
      >
        Modale
      </Button>
    </div>
  );
}

export const QueuedViaProvider: Story = {
  name: "File d'attente (NotificationProvider + useNotification)",
  render: () => (
    <NotificationProvider>
      <div style={{ padding: 24 }}>
        <ProviderDemo />
      </div>
    </NotificationProvider>
  ),
};

// Sample newsfeed for the story below — three items, fired one after another so they visibly
// stack (see `NotificationProvider`'s own doc: newest at the bottom of a bottom-anchored corner).
const SAMPLE_NEWS = [
  {
    badges: ["F", "●"],
    source: "Mace News",
    headline: "⚡ US TSY JUNE TICS RPT: ADJUSTED FGN ACQUISITIONS OF L-T US SECURITIES, US STOCKS +$172.7 BLN VS +$231.2 BLN/MAY",
    time: "22:03",
  },
  {
    badges: ["R"],
    source: "Reuters",
    headline: "🛢️ OPEC+ confirme le maintien de ses quotas de production pour le mois prochain",
    time: "22:05",
  },
  {
    badges: ["B", "★"],
    source: "Bloomberg",
    headline: "📈 La Fed signale une pause probable lors de sa prochaine réunion, selon plusieurs responsables",
    time: "22:11",
  },
];

function NewsAlertsDemo() {
  const { notify } = useNotification();
  return (
    <Button
      onClick={() => SAMPLE_NEWS.forEach((news, i) => setTimeout(() => notify({
        corner: "bottom-left",
        icon: <FileIcon size={16} />,
        title: "News on AAPL",
        description: (
          <>
            <NotificationSource badges={news.badges} name={news.source} />
            <p style={{ margin: 0 }}>{news.headline}</p>
          </>
        ),
        actions: <a href="#">Lire la suite</a>,
        meta: news.time,
        // 15s (vs. the 4s a plain toast defaults to, see notify's own default) — a news headline
        // takes longer to read than "Ordre exécuté", so it stays up longer before auto-dismissing;
        // still fully overridable per call like any other `autoDismissMs`.
        autoDismissMs: 15000,
      }), i * 500))}
    >
      Simuler 3 alertes d'actualité
    </Button>
  );
}

export const NewsAlerts: Story = {
  name: "Alertes d'actualité (empilées, 15s)",
  render: () => (
    <NotificationProvider>
      <div style={{ padding: 24 }}>
        <NewsAlertsDemo />
      </div>
    </NotificationProvider>
  ),
};

/** Carte cliquable : un clic n'importe où (sauf la croix et les actions) mène à l'élément concerné puis ferme la carte.
 *  Survoler la carte met le compte à rebours en pause ; il reprend là où il s'était arrêté. */
export const Clickable: StoryObj = {
  render: () => {
    function Demo() {
      const { notify } = useNotification();
      return (
        <button
          type="button"
          onClick={() =>
            notify({
              tone: "warning",
              title: "Alerte : Brent ±1 %",
              description: "Brent à 106,28 $ : +1,5 % sur la séance. Cliquer pour ouvrir l'alerte.",
              autoDismissMs: 8000,
              onClick: () => window.alert("Ouverture de l'alerte"),
            })
          }
        >
          Notification cliquable
        </button>
      );
    }
    return (
      <NotificationProvider>
        <Demo />
      </NotificationProvider>
    );
  },
};
