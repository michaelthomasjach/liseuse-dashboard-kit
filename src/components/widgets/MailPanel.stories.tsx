import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { MailPanel, type MailMessage } from "./MailPanel";
import { Text } from "../primitives/Text";
import { MAIL_FOLDERS, MAIL_MESSAGES, MAIL_NOW } from "../../test-data/mailPanelData";

/**
 * Boîte mail en trois colonnes : dossiers, liste, lecture. Chaque état est contrôlable ou libre ;
 * `defaultMessages` laisse le composant appliquer lui-même étoile, lu / non lu et suppression.
 * Remplit son conteneur ; sous 860 px de large, une colonne à la fois.
 */
const meta: Meta<typeof MailPanel> = {
  title: "Widgets/MailPanel",
  component: MailPanel,
};
export default meta;
type Story = StoryObj<typeof MailPanel>;

/** Le cadre des stories : le composant prend toute sa hauteur. */
function Frame({ width, height = 620, children }: { width?: number; height?: number; children: ReactNode }) {
  return <div style={{ height, width, maxWidth: "100%", border: "1px solid var(--lq-color-border-subtle)" }}>{children}</div>;
}

const noop = () => undefined;

/** Mode libre : on ouvre, coche, suit, supprime (vers la corbeille), cherche — tout s'applique. */
export const Default: Story = {
  name: "Mode libre",
  render: () => (
    <Frame>
      <MailPanel
        folders={MAIL_FOLDERS}
        defaultMessages={MAIL_MESSAGES}
        defaultSelectedId="m1"
        now={MAIL_NOW}
        onCompose={noop}
        onReply={noop}
        onForward={noop}
      />
    </Frame>
  ),
};

/** Tout est tenu par l'appelant : messages, dossier, message ouvert, cases, recherche. */
export const Controlled: Story = {
  name: "Contrôlé",
  render: function Render() {
    const [messages, setMessages] = useState<MailMessage[]>(MAIL_MESSAGES);
    const [folderId, setFolderId] = useState("inbox");
    const [selectedId, setSelectedId] = useState<string | null>("m4");
    const [checkedIds, setCheckedIds] = useState<string[]>(["m2", "m3"]);
    const [query, setQuery] = useState("");
    const [log, setLog] = useState("Les actions s'affichent ici.");
    const update = (ids: string[], change: (m: MailMessage) => MailMessage | null) =>
      setMessages((list) => list.flatMap((m) => (ids.includes(m.id) ? [change(m)].filter((x): x is MailMessage => x !== null) : [m])));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Frame>
          <MailPanel
            folders={MAIL_FOLDERS}
            messages={messages}
            folderId={folderId}
            onFolderChange={setFolderId}
            selectedId={selectedId}
            onSelect={setSelectedId}
            checkedIds={checkedIds}
            onCheckedChange={setCheckedIds}
            query={query}
            onQueryChange={setQuery}
            now={MAIL_NOW}
            onMarkRead={(ids, read) => {
              update(ids, (m) => ({ ...m, unread: !read }));
              setLog(`${ids.length} message(s) marqué(s) ${read ? "lu(s)" : "non lu(s)"}`);
            }}
            onToggleStar={(id, starred) => {
              update([id], (m) => ({ ...m, starred }));
              setLog(starred ? `Suivi : ${id}` : `Plus suivi : ${id}`);
            }}
            onDelete={(ids) => {
              update(ids, (m) => (m.folderId === "trash" ? null : { ...m, folderId: "trash" }));
              setLog(`${ids.length} message(s) supprimé(s)`);
            }}
            onCompose={() => setLog("Nouveau message")}
            onReply={(m) => setLog(`Répondre à « ${m.subject} »`)}
            onForward={(m) => setLog(`Transférer « ${m.subject} »`)}
          />
        </Frame>
        <Text size="sm" muted>
          {log}
        </Text>
      </div>
    );
  },
};

/** Dans un conteneur étroit : une colonne à la fois, « Retour » depuis le message, « Dossiers » depuis la liste. */
export const Narrow: Story = {
  name: "Étroit",
  render: () => (
    <Frame width={400}>
      <MailPanel folders={MAIL_FOLDERS} defaultMessages={MAIL_MESSAGES} defaultSelectedId="m1" now={MAIL_NOW} onReply={noop} onForward={noop} onCompose={noop} />
    </Frame>
  ),
};

/** Messages contrôlés sans rappel d'action : ni étoile cliquable, ni suppression, ni lu / non lu. */
export const ReadOnly: Story = {
  name: "Lecture seule",
  render: () => (
    <Frame>
      <MailPanel folders={MAIL_FOLDERS} messages={MAIL_MESSAGES} defaultSelectedId="m4" now={MAIL_NOW} />
    </Frame>
  ),
};

/** Un dossier vide, puis une recherche sans résultat. */
export const Empty: Story = {
  name: "Vide",
  render: () => (
    <Frame height={420}>
      <MailPanel folders={MAIL_FOLDERS} defaultMessages={[]} now={MAIL_NOW} onCompose={noop} />
    </Frame>
  ),
};
