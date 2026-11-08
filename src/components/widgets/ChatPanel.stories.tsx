import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ChatPanel, type ChatContact, type ChatMessage } from "./ChatPanel";

/**
 * L'équipe d'un entrepôt qui se parle entre deux livraisons. L'heure de référence est fixée au samedi
 * 31 octobre 2026, 14 h 30 : « Aujourd'hui » et « Hier » tombent toujours au même endroit.
 */
const meta: Meta<typeof ChatPanel> = {
  title: "Widgets/ChatPanel",
  component: ChatPanel,
};
export default meta;
type Story = StoryObj<typeof ChatPanel>;

const NOW = "2026-10-31T14:30:00";

const CONTACTS: ChatContact[] = [
  { id: "lea", name: "Léa Moreau", status: "online" },
  { id: "karim", name: "Karim Benali", status: "online", unread: 2 },
  { id: "sophie", name: "Sophie Laurent", status: "away" },
  { id: "quai", name: "Quai 3 — réception", status: "offline", unread: 5 },
  { id: "marc", name: "Marc Dubois", status: "offline" },
];

const MESSAGES: ChatMessage[] = [
  { id: "l1", contactId: "lea", from: "them", text: "Salut ! Le camion de Lyon est annoncé pour quelle heure ?", sentAt: "2026-10-30T16:02:00" },
  { id: "l2", contactId: "lea", from: "me", text: "Demain matin, vers 9 h.", sentAt: "2026-10-30T16:05:00", status: "read" },
  { id: "l3", contactId: "lea", from: "me", text: "Je te préviens dès qu'il passe le portail.", sentAt: "2026-10-30T16:05:40", status: "read" },
  { id: "l4", contactId: "lea", from: "them", text: "Parfait, merci.", sentAt: "2026-10-30T16:06:00" },
  { id: "l5", contactId: "lea", from: "them", text: "Il est là ? Le quai 3 est libre.", sentAt: "2026-10-31T09:12:00" },
  { id: "l6", contactId: "lea", from: "me", text: "Oui, il se met à quai.\nDéchargement prévu en quarante minutes.", sentAt: "2026-10-31T09:14:00", status: "read" },
  { id: "l7", contactId: "lea", from: "them", text: "Super. Pense à scanner les palettes de surgelés en premier.", sentAt: "2026-10-31T09:15:00" },
  { id: "l8", contactId: "lea", from: "them", text: "La chambre froide est à −18 °C, c'est bon.", sentAt: "2026-10-31T09:15:30" },
  { id: "l9", contactId: "lea", from: "me", text: "Bien noté 👍", sentAt: "2026-10-31T14:21:00", status: "delivered" },
  { id: "k1", contactId: "karim", from: "me", text: "Tu as le bon de livraison de la commande 4471 ?", sentAt: "2026-10-31T11:40:00", status: "read" },
  { id: "k2", contactId: "karim", from: "them", text: "Je le cherche.", sentAt: "2026-10-31T13:58:00" },
  { id: "k3", contactId: "karim", from: "them", text: "Trouvé, je te l'envoie.", sentAt: "2026-10-31T14:02:00" },
  { id: "s1", contactId: "sophie", from: "them", text: "Je suis en réunion jusqu'à 16 h.", sentAt: "2026-10-28T10:00:00" },
  { id: "q1", contactId: "quai", from: "them", text: "Trois palettes refusées : emballage abîmé.", sentAt: "2026-10-31T08:01:00" },
];

export const Default: Story = {
  name: "Messagerie",
  render: () => (
    <div style={{ height: 560 }}>
      <ChatPanel contacts={CONTACTS} messages={MESSAGES} now={NOW} />
    </div>
  ),
};

/** L'application tient les messages et la conversation ouverte ; une réponse arrive une seconde après
 *  chaque envoi, l'indicateur « écrit… » l'annonce. */
export const Controlled: Story = {
  name: "Pilotée par l'application",
  render: function Render() {
    const [messages, setMessages] = useState(MESSAGES);
    const [contacts, setContacts] = useState(CONTACTS);
    const [active, setActive] = useState<string | null>("karim");
    const [count, setCount] = useState(0);
    return (
      <div style={{ height: 560 }}>
        <ChatPanel
          contacts={contacts}
          messages={messages}
          activeContactId={active}
          now={NOW}
          onSelectContact={(id) => {
            setActive(id);
            setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
          }}
          onSend={(text, contactId) => {
            const n = count + 1;
            setCount(n);
            setMessages((ms) => [...ms, { id: `m${n}`, contactId, from: "me", text, sentAt: `2026-10-31T14:${String(30 + n).padStart(2, "0")}:00`, status: "sent" }]);
            setContacts((cs) => cs.map((c) => (c.id === contactId ? { ...c, typing: true } : c)));
            window.setTimeout(() => {
              setContacts((cs) => cs.map((c) => (c.id === contactId ? { ...c, typing: false } : c)));
              setMessages((ms) => [
                ...ms.map((m) => (m.id === `m${n}` ? { ...m, status: "read" as const } : m)),
                { id: `r${n}`, contactId, from: "them", text: "Bien reçu, merci !", sentAt: `2026-10-31T14:${String(30 + n).padStart(2, "0")}:30` },
              ]);
            }, 1200);
          }}
        />
      </div>
    );
  },
};

/** Le contact est en train d'écrire : trois points au bas du fil, « écrit… » dans la liste. */
export const Typing: Story = {
  name: "En train d'écrire",
  render: () => (
    <div style={{ height: 480 }}>
      <ChatPanel contacts={CONTACTS.map((c) => (c.id === "karim" ? { ...c, typing: true } : c))} messages={MESSAGES} defaultActiveContactId="karim" now={NOW} />
    </div>
  ),
};

/** Une conversation sans message, et une recherche qui ne trouve personne. */
export const Empty: Story = {
  name: "Conversation vide",
  render: () => (
    <div style={{ height: 420 }}>
      <ChatPanel contacts={[...CONTACTS, { id: "new", name: "Nadia Petit", status: "online" }]} messages={MESSAGES} defaultActiveContactId="new" now={NOW} />
    </div>
  ),
};

/** Dans 380 px, une colonne à la fois : la liste, puis la conversation touchée avec « Retour ». */
export const Narrow: Story = {
  name: "Cadre étroit",
  render: () => (
    <div style={{ width: 380, height: 560 }}>
      <ChatPanel contacts={CONTACTS} messages={MESSAGES} now={NOW} />
    </div>
  ),
};

/** Panneau latéral étroit : zone de texte de plusieurs lignes, micro dans son coin, « Envoyer » sur toute la largeur. */
export const StackedComposer: Story = {
  name: "Saisie empilée (composerLayout=\"stacked\")",
  render: () => (
    <div style={{ width: 320, height: 560 }}>
      <ChatPanel contacts={CONTACTS.slice(0, 1)} messages={MESSAGES} now={NOW} composerLayout="stacked" />
    </div>
  ),
};
