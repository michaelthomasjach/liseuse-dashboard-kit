import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { NotificationMenu, type NotificationMenuItem } from "./NotificationMenu";
import { AlertTriangleIcon, CheckIcon, PinIcon, UploadCloudIcon } from "../icons";

const meta: Meta<typeof NotificationMenu> = {
  title: "Feedback/NotificationMenu",
  component: NotificationMenu,
};
export default meta;
type Story = StoryObj<typeof NotificationMenu>;

const ITEMS: NotificationMenuItem[] = [
  {
    id: "1",
    icon: <PinIcon size={20} />,
    title: "Atelier Nord",
    meta: "Claire Martin",
    text: "« La motivation fait la différence entre un meneur et un suiveur. » — a commenté le tableau de l'équipe.",
    time: "à l'instant",
    unread: true,
    tone: "accent",
  },
  { id: "2", icon: <AlertTriangleIcon size={20} />, title: "Charge serveur à 98 %", meta: "Agir", time: "il y a 2 min", tone: "danger" },
  { id: "3", icon: <AlertTriangleIcon size={20} />, title: "Licence bientôt expirée", meta: "Renouveler", time: "hier", tone: "warning" },
  { id: "4", avatar: { name: "Studio Bélier" }, title: "Studio Bélier", meta: "Propriétaires", time: "23 h 00", unread: true, tone: "accent" },
  { id: "5", icon: <CheckIcon size={20} />, title: "Sauvegarde terminée", text: "1 284 fichiers, 3,2 Go.", time: "lun.", tone: "success" },
  { id: "6", icon: <UploadCloudIcon size={20} />, title: "Import des relevés", text: "Le fichier de septembre est en cours de traitement.", time: "12 oct.", tone: "info" },
];

/** Une barre haute minimale, pour voir le déclencheur à sa place. */
function TopBar({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        height: 60,
        padding: "0 20px",
        backgroundColor: "var(--lq-color-panel)",
        borderBottom: "1px solid var(--lq-color-border-subtle)",
      }}
    >
      <strong>Tableau de bord</strong>
      {children}
    </div>
  );
}

/** L'état lu / non lu est tenu par l'application : le point de chaque ligne le bascule, le pied les
 *  marque tous. Ouvert d'emblée. */
export const Interactive: Story = {
  name: "Compteur, en-tête et pied",
  render: function Render() {
    const [items, setItems] = useState(ITEMS);
    const [last, setLast] = useState<string>("—");
    return (
      <div style={{ minHeight: 560 }}>
        <TopBar>
          <NotificationMenu
            defaultOpen
            items={items}
            onItemClick={(item) => setLast(String(item.title))}
            onToggleRead={(item) => setItems((all) => all.map((i) => (i.id === item.id ? { ...i, unread: !i.unread } : i)))}
            onMarkAllRead={() => setItems((all) => all.map((i) => ({ ...i, unread: false })))}
            footer={<a href="#toutes">Toutes les notifications</a>}
          />
        </TopBar>
        <p style={{ padding: 20 }}>Dernier clic : {last}</p>
      </div>
    );
  },
};

/** La pastille réduite à un point et le panneau sans en-tête : la liste, puis le pied. */
export const DotBadge: Story = {
  name: "badge=\"dot\", sans en-tête",
  render: () => (
    <div style={{ minHeight: 480 }}>
      <TopBar>
        <NotificationMenu defaultOpen badge="dot" title={null} items={ITEMS.slice(0, 4)} onItemClick={() => {}} footer={<a href="#toutes">Lire toutes les notifications</a>} />
      </TopBar>
    </div>
  ),
};

/** Aucune notification : l'état vide, et pas de pastille. */
export const Empty: Story = {
  name: "État vide",
  render: () => (
    <div style={{ minHeight: 320 }}>
      <TopBar>
        <NotificationMenu defaultOpen items={[]} onMarkAllRead={() => {}} />
      </TopBar>
    </div>
  ),
};

/** Les déclencheurs fermés : compteur, point, plus de 99, rien à lire. */
export const Triggers: Story = {
  name: "Déclencheurs",
  render: () => (
    <TopBar>
      <NotificationMenu items={ITEMS} />
      <NotificationMenu items={ITEMS} badge="dot" />
      <NotificationMenu items={ITEMS} unreadCount={128} />
      <NotificationMenu items={ITEMS.map((i) => ({ ...i, unread: false }))} />
    </TopBar>
  ),
};
