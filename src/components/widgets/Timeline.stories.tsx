import type { Meta, StoryObj } from "@storybook/react";
import { Timeline, type TimelineEntry } from "./Timeline";
import { AlertTriangleIcon, CheckIcon, CommentIcon, LockIcon, RefreshIcon, UploadCloudIcon, UserIcon } from "../icons";

/**
 * Une frise chronologique d'activité : ce qui s'est passé, dans l'ordre, jalonné. À ne pas confondre
 * avec `DayTimelineWidget`, une rangée horizontale de scénarios à déclencher.
 */
const meta: Meta<typeof Timeline> = {
  title: "Widgets/Timeline",
  component: Timeline,
};
export default meta;
type Story = StoryObj<typeof Timeline>;

const ENTRIES: TimelineEntry[] = [
  {
    id: "deploy",
    day: "Aujourd'hui",
    date: "14:32",
    dateTime: "2026-11-01T14:32",
    title: "Mise en production de la v2.4",
    content: "Le déploiement progressif est à 40 % des serveurs. Aucune alerte pour l'instant.",
    icon: <UploadCloudIcon />,
    tone: "info",
    author: { name: "Claire Moreau" },
    current: true,
  },
  {
    id: "review",
    day: "Aujourd'hui",
    date: "11:05",
    dateTime: "2026-11-01T11:05",
    title: "Revue de code approuvée",
    content: "« Pagination côté serveur » — 3 approbations, 12 commentaires résolus.",
    icon: <CheckIcon />,
    tone: "success",
    author: { name: "Julien Petit" },
  },
  {
    id: "comment",
    day: "Aujourd'hui",
    date: "09:48",
    dateTime: "2026-11-01T09:48",
    title: "Nouveau commentaire sur le ticket #482",
    author: { name: "Inès Garnier" },
  },
  {
    id: "incident",
    day: "Hier",
    date: "22:17",
    dateTime: "2026-10-31T22:17",
    title: "Incident : latence de l'API de paiement",
    content: "Temps de réponse médian à 1,8 s pendant 14 minutes. Résolu par un redémarrage du pool de connexions.",
    icon: <AlertTriangleIcon />,
    tone: "danger",
  },
  {
    id: "rotate",
    day: "Hier",
    date: "16:40",
    dateTime: "2026-10-31T16:40",
    title: "Rotation des clés d'accès",
    icon: <LockIcon />,
    author: { name: "Paul Lefèvre" },
  },
  {
    id: "member",
    day: "29 octobre",
    date: "10:12",
    dateTime: "2026-10-29T10:12",
    title: "Sophie Laurent a rejoint l'équipe Produit",
    icon: <UserIcon />,
    tone: "accent",
  },
  {
    id: "sync",
    day: "29 octobre",
    date: "08:00",
    dateTime: "2026-10-29T08:00",
    title: "Synchronisation nocturne terminée",
    content: "18 432 enregistrements, 0 rejet.",
    tone: "success",
  },
];

/** Alignée à gauche, regroupée par jour : jalons à icône colorés par ton, points pour les entrées
 *  mineures, l'entrée en cours en tête. */
export const Default: Story = {
  args: { entries: ENTRIES },
  render: (args) => (
    <div style={{ maxWidth: 560 }}>
      <Timeline {...args} />
    </div>
  ),
};

/** Le fil au milieu, les entrées de part et d'autre, la date en face. */
export const Alternate: Story = {
  args: { entries: ENTRIES, variant: "alternate" },
};

/** Chaque entrée sur une surface de carte — l'allure d'un fil d'activité de gabarit d'administration. */
export const Boxed: Story = {
  args: { entries: ENTRIES, variant: "alternate", boxed: true },
};

/** Petits points, date et titre sur une ligne : une colonne latérale, un historique long. */
export const Compact: Story = {
  args: { entries: ENTRIES, variant: "compact" },
  render: (args) => (
    <div style={{ maxWidth: 360 }}>
      <Timeline {...args} />
    </div>
  ),
};

/** La variante alternée dans un conteneur de 420 px : elle se replie d'elle-même en une colonne. */
export const AlternateNarrow: Story = {
  args: { entries: ENTRIES.slice(0, 4), variant: "alternate", boxed: true },
  render: (args) => (
    <div style={{ maxWidth: 420 }}>
      <Timeline {...args} />
    </div>
  ),
};

/** Sans regroupement, chaque entrée porte sa date complète. */
export const Ungrouped: Story = {
  args: {
    groupByDay: false,
    entries: [
      { id: "a", date: "1 nov., 14:32", title: "Sauvegarde restaurée", icon: <RefreshIcon />, tone: "warning" },
      { id: "b", date: "31 oct., 18:10", title: "Commentaire ajouté", content: "« Peut-on décaler la livraison à jeudi ? »", icon: <CommentIcon /> },
      { id: "c", date: "30 oct., 09:00", title: "Commande créée" },
    ],
  },
  render: (args) => (
    <div style={{ maxWidth: 480 }}>
      <Timeline {...args} />
    </div>
  ),
};

/** Sans entrée, le message `emptyMessage`. */
export const Empty: Story = {
  args: { entries: [], emptyMessage: "Aucune activité cette semaine" },
};
