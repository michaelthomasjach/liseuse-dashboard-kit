import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { NotificationProvider, NotificationSource, useNotification, type NotificationOptions } from "./Notification";
import { Button } from "../primitives/Button";
import { FileIcon } from "../icons/icons";

/** Les boutons de commande d'une story, au centre du cadre : les coins restent aux notifications. */
function Stage({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: 300, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "center", alignContent: "center" }}>
      {children}
    </div>
  );
}

/** Le provider rend la story ; ses enfants appellent `useNotification()`. */
type ProviderArgs = ComponentProps<typeof NotificationProvider> & NotificationOptions;

/** Range une option de `notify()` dans sa propre catégorie de la table, avec la valeur par défaut que `notify` lui donne. */
const option = (defaultValue?: string) => ({ category: "Options de notify()", ...(defaultValue ? { defaultValue: { summary: defaultValue } } : {}) });

/** Un bouton par ton : coin bas-droit et délai par défaut de `notify` (4 s). */
const EACH_TONE: [string, NotificationOptions][] = [
  ["Neutre", { tone: "neutral", title: "Feedback/NotificationProvider", description: "La facture F-2026-0413 attend sa validation." }],
  ["Succès", { tone: "success", title: "Virement reçu", description: "14 400,00 € de Lemoine SAS." }],
  ["Information", { tone: "info", title: "Relevé d'octobre disponible", description: "Il couvre la période du 1er au 31." }],
  ["Avertissement", { tone: "warning", title: "Rapprochement en retard", description: "Trois relevés n'ont pas été importés depuis lundi." }],
  ["Erreur", { tone: "error", title: "Prélèvement rejeté", description: "La banque de Studio Bélier a refusé 2 880,00 €." }],
];

/** Un bouton par variante. Une modale qui disparaît seule n'a pas de sens : elle reste (`autoDismissMs: 0`). */
const EACH_VARIANT: [string, NotificationOptions][] = [
  ["Popin de coin", { tone: "success", title: "Facture envoyée", description: "F-2026-0412 à Lemoine SAS." }],
  ["Barre en haut", { variant: "bar", barPosition: "top", tone: "warning", title: "Maintenance dimanche de 2 h à 4 h", autoDismissMs: 6000 }],
  ["Barre en bas", { variant: "bar", barPosition: "bottom", tone: "info", title: "Nouvelle version disponible", description: "Rechargez la page pour en profiter.", autoDismissMs: 6000 }],
  ["Modale", { variant: "modal", tone: "error", title: "Session expirée", description: "Reconnectez-vous pour continuer.", autoDismissMs: 0 }],
];

/** La story par défaut : la notification réglée par les contrôles, puis un bouton par ton et par variante. */
function Playground({ options }: { options: NotificationOptions }) {
  const { notify } = useNotification();
  const row = (caption: string, demos: [string, NotificationOptions][]) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: "var(--lq-text-sm)", color: "var(--lq-color-text-muted)" }}>{caption}</span>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
        {demos.map(([label, demo]) => (
          <Button key={label} onClick={() => notify(demo)}>
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
  return (
    <div style={{ minHeight: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <Button selected onClick={() => notify(options)}>
        Envoyer la notification des contrôles
      </Button>
      {row("Un bouton par ton", EACH_TONE)}
      {row("Un bouton par variante", EACH_VARIANT)}
    </div>
  );
}

/**
 * La file de notifications du kit : un provider posé une fois, et `notify()` partout dessous.
 */
const meta = {
  title: "Feedback/NotificationProvider",
  component: NotificationProvider,
  parameters: {
    layout: "fullscreen",
    // Les notifications sont en position fixe : chaque story a son propre cadre.
    docs: {
      story: { inline: false, iframeHeight: "420px" },
      description: {
        component: [
          "Le **gestionnaire de file** des notifications. On le pose **une fois**, haut dans l'arbre (autour de l'application ou d'une mise en page), et n'importe quel composant en dessous envoie un message avec `useNotification().notify(options)`.",
          "",
          "**Quand l'utiliser** — pour tous les messages **passagers** déclenchés par une action ou un événement : enregistrement réussi, export terminé, erreur réseau, nouvelle alerte. Pour **un** message persistant dont vous tenez vous-même l'état (bandeau de maintenance), la `Notification` autonome suffit — même apparence, mêmes options, sans file.",
          "",
          "### L'API",
          "",
          "```tsx",
          "<NotificationProvider>",
          "  <App />",
          "</NotificationProvider>",
          "",
          "function Export() {",
          "  const { notify, dismiss } = useNotification();",
          "  const id = notify({ tone: \"success\", title: \"Export terminé\" });",
          "  // dismiss(id) la ferme avant son délai",
          "}",
          "```",
          "",
          "- `notify(options)` ajoute une notification et **renvoie son identifiant**. Les options sont celles de `Notification` sans `open` ni `onClose` : `variant`, `corner`, `barPosition`, `tone`, `icon`, `title`, `description`, `actions`, `meta`, `dismissible`, `autoDismissMs`, `showProgress`, `onClick`.",
          "- `dismiss(id)` retire une notification avant la fin de son délai — par exemple un « Import en cours… » quand l'import aboutit.",
          "- `useNotification()` appelé hors d'un provider **lève une erreur**.",
          "",
          "### Valeurs par défaut de `notify`",
          "",
          "`variant: \"corner\"`, `corner: \"bottom-right\"`, `barPosition: \"top\"`, `tone: \"neutral\"`, **`autoDismissMs: 4000`** — contrairement à la notification autonome, un message de la file se ferme seul au bout de 4 s. Passez `autoDismissMs: 0` pour qu'il reste jusqu'à ce qu'on le ferme.",
          "",
          "### File et positions",
          "",
          "- Chaque coin a **sa propre pile** ; les deux bords (barres `top` et `bottom`) aussi. Une notification s'ajoute à la pile de sa position, et le message **le plus récent est toujours contre le bord de l'écran** : en bas dans les coins bas, en haut dans les coins hauts.",
          "- Chaque carte a son propre compte à rebours ; elles se ferment indépendamment. Survoler une carte suspend le sien.",
          "- Les modales ne s'empilent pas en pile : chacune pose son voile, la dernière par-dessus.",
          "- Aucune limite de nombre : une boucle qui notifie à chaque ligne remplit l'écran. Regroupez (« 12 factures envoyées »).",
          "",
          "### Rendu",
          "",
          "Les piles sont rendues dans un **portail** sur `document.body`, ré-enveloppées dans un `LqThemeProvider` qui reprend la palette, la surface, la police **et la classe** du thème englobant — c'est ce qui garde le thème (e-ink ou couleur, clair ou sombre) sur des cartes rendues hors de l'arbre.",
          "",
          "### À savoir",
          "",
          "- `autoDismissMs: 0` fait apparaître un « 0 » parasite dans la carte (la condition d'affichage de la barre de progression rend la valeur) : défaut du kit, visible dans les stories à notifications persistantes ci-dessous.",
          "- Dans la file, une **barre** n'est pas centrée : elle s'aligne à gauche sur 720 px, alors que la barre d'une `Notification` autonome est centrée (défaut du kit).",
          "- Une barre et le coin du même bord se **chevauchent** : rien ne décale les piles de coin quand une barre est affichée.",
          "",
          "**Thème** — celui de `Notification` : `--lq-color-panel`, `--lq-shadow-modal`, `--lq-radius-md`, les couleurs de ton, `--lq-color-accent` (progression), `--lq-color-overlay`, `--lq-space-5` (distance aux bords), `--lq-space-2` (écart entre deux cartes d'une pile).",
        ].join("\n"),
      },
    },
  },
  args: {
    children: null,
    variant: "corner",
    corner: "bottom-right",
    barPosition: "top",
    tone: "success",
    title: "Virement reçu",
    description: "14 400,00 € de Lemoine SAS.",
    meta: "",
    dismissible: true,
    autoDismissMs: 4000,
    showProgress: true,
  },
  argTypes: {
    children: { control: false },
    variant: { control: "inline-radio", options: ["corner", "bar", "modal"], description: "Popin de coin, barre pleine largeur ou modale.", table: option('"corner"') },
    corner: {
      control: "select",
      options: ["top-left", "top-right", "bottom-left", "bottom-right"],
      description: "Coin d'ancrage, pour `variant=\"corner\"`.",
      table: option('"bottom-right"'),
      if: { arg: "variant", eq: "corner" },
    },
    barPosition: { control: "inline-radio", options: ["top", "bottom"], description: "Bord d'ancrage, pour `variant=\"bar\"`.", table: option('"top"'), if: { arg: "variant", eq: "bar" } },
    tone: { control: "inline-radio", options: ["neutral", "success", "info", "warning", "error"], description: "Icône et couleur du liseré.", table: option('"neutral"') },
    title: { control: "text", description: "Titre, en gras.", table: option() },
    description: { control: "text", description: "Texte sous le titre (`ReactNode`).", table: option() },
    meta: { control: "text", description: "Texte court au pied de la carte, à l'opposé des actions (une heure).", table: option() },
    dismissible: { control: "boolean", description: "Affiche la croix de fermeture.", table: option("true") },
    autoDismissMs: { control: { type: "number", min: 0, step: 1000 }, description: "Délai de fermeture automatique, en ms ; 0 pour garder la carte.", table: option("4000") },
    showProgress: { control: "boolean", description: "Barre de progression pendant le délai.", table: option("true") },
    icon: { control: false, description: "Remplace l'icône du ton.", table: option() },
    actions: { control: false, description: "Rangée de boutons ou de liens au pied de la carte.", table: option() },
    onClick: { control: false, description: "Rend toute la carte cliquable ; elle se ferme ensuite.", table: option() },
  },
  render: function Render(args) {
    const { children, ...options } = args;
    return (
      <NotificationProvider>
        {children}
        <Playground options={{ ...options, meta: options.meta || undefined }} />
      </NotificationProvider>
    );
  },
} satisfies Meta<ProviderArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Défaut",
  parameters: {
    docs: {
      description: {
        story:
          "Le bouton plein envoie la notification réglée dans les contrôles. Dessous, un bouton par ton — dans le coin bas-droit, fermeture au bout de 4 s, le délai par défaut de `notify` — et un par variante. La modale part avec `autoDismissMs: 0` (une modale qui disparaît seule n'a pas de sens) et se ferme par sa croix ou un clic sur le voile, pas par Échap. Cliquez plusieurs boutons : chaque clic ajoute une carte à la pile de sa position.",
      },
    },
  },
};

/** Pousse une série de notifications au montage, une seule fois — pour montrer un état sans clic. */
function NotifyOnMount({ items }: { items: NotificationOptions[] }) {
  const { notify } = useNotification();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    items.forEach((item) => notify(item));
  }, [items, notify]);
  return null;
}

const SIX_POSITIONS: NotificationOptions[] = [
  { corner: "top-left", tone: "info", title: "Coin haut gauche", autoDismissMs: 0 },
  { corner: "top-right", tone: "success", title: "Coin haut droite", autoDismissMs: 0 },
  { corner: "bottom-left", tone: "warning", title: "Coin bas gauche", autoDismissMs: 0 },
  { corner: "bottom-right", tone: "error", title: "Coin bas droite", autoDismissMs: 0 },
  { variant: "bar", barPosition: "top", tone: "neutral", title: "Barre en haut", autoDismissMs: 0 },
  { variant: "bar", barPosition: "bottom", tone: "neutral", title: "Barre en bas", autoDismissMs: 0 },
];

function Replay({ items }: { items: NotificationOptions[] }) {
  const { notify } = useNotification();
  return (
    <Stage>
      <Button onClick={() => items.forEach((item) => notify(item))}>Rejouer</Button>
    </Stage>
  );
}

export const SixPositions: Story = {
  name: "Les six positions",
  render: () => (
    <NotificationProvider>
      <NotifyOnMount items={SIX_POSITIONS} />
      <Replay items={SIX_POSITIONS} />
    </NotificationProvider>
  ),
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: "460px" },
      description: {
        story: "Les quatre coins et les deux bords, chacun avec sa pile. On y voit les trois défauts décrits plus haut : le « 0 » parasite des cartes persistantes (`autoDismissMs: 0`), les barres alignées à gauche au lieu d'être centrées, et les barres qui recouvrent les coins gauches.",
      },
    },
  },
};

function QueueDemo() {
  const { notify, dismiss } = useNotification();
  const [ids, setIds] = useState<string[]>([]);
  const sendThree = () => {
    [
      { title: "Facture F-2026-0410 envoyée", autoDismissMs: 4000 },
      { title: "Facture F-2026-0411 envoyée", autoDismissMs: 6000 },
      { title: "Facture F-2026-0412 envoyée", autoDismissMs: 8000 },
    ].forEach((options, i) =>
      setTimeout(() => {
        const id = notify({ tone: "success", ...options, meta: `${4 + 2 * i} s` });
        setIds((prev) => [...prev, id]);
      }, i * 600),
    );
  };
  return (
    <Stage>
      <Button selected onClick={sendThree}>
        Envoyer trois notifications
      </Button>
      <Button
        disabled={ids.length === 0}
        onClick={() => {
          dismiss(ids[ids.length - 1]);
          setIds((prev) => prev.slice(0, -1));
        }}
      >
        Retirer la dernière (dismiss)
      </Button>
    </Stage>
  );
}

export const Queue: Story = {
  name: "File d'attente",
  render: () => (
    <NotificationProvider>
      <QueueDemo />
    </NotificationProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Trois notifications à 0,6 s d'écart, avec des délais de 4, 6 et 8 s : la plus récente arrive contre le bord, puis elles se ferment dans l'ordre de leur délai. « Retirer la dernière » appelle `dismiss(id)` avec l'identifiant renvoyé par `notify`.",
      },
    },
  },
};

function DurationButtons() {
  const { notify } = useNotification();
  return (
    <Stage>
      <Button onClick={() => notify({ tone: "info", title: "Délai par défaut", description: "Fermeture au bout de 4 s." })}>Par défaut (4 s)</Button>
      <Button onClick={() => notify({ tone: "info", title: "Délai long", description: "Fermeture au bout de 10 s.", autoDismissMs: 10000 })}>Longue (10 s)</Button>
      <Button onClick={() => notify({ tone: "info", title: "Sans barre", description: "Fermeture au bout de 6 s, sans barre.", autoDismissMs: 6000, showProgress: false })}>
        Sans barre de progression
      </Button>
      <Button onClick={() => notify({ tone: "warning", title: "Persistante", description: "Elle reste jusqu'à ce qu'on la ferme.", autoDismissMs: 0 })}>
        Sans fermeture automatique
      </Button>
    </Stage>
  );
}

export const Durations: Story = {
  name: "Durées",
  render: () => (
    <NotificationProvider>
      <DurationButtons />
    </NotificationProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "`autoDismissMs` règle le délai (4 000 ms par défaut avec `notify`), `0` le supprime. Posez le pointeur sur une carte : son compte à rebours et sa barre s'arrêtent, puis reprennent là où ils en étaient. Un message qu'on doit lire en entier (une phrase longue, une dépêche) mérite un délai plus long.",
      },
    },
  },
};

function ImportDemo() {
  const { notify, dismiss } = useNotification();
  const [pending, setPending] = useState<string | null>(null);
  return (
    <Stage>
      <Button
        disabled={pending !== null}
        onClick={() =>
          setPending(
            notify({ tone: "info", title: "Import du relevé en cours…", description: "Crédit Mutuel, octobre 2026.", dismissible: false, autoDismissMs: 0 }),
          )
        }
      >
        Lancer l'import
      </Button>
      <Button
        selected
        disabled={pending === null}
        onClick={() => {
          if (pending) dismiss(pending);
          setPending(null);
          notify({ tone: "success", title: "Relevé importé", description: "214 opérations, dont 3 à rapprocher." });
        }}
      >
        Terminer l'import
      </Button>
    </Stage>
  );
}

export const ProgrammaticDismiss: Story = {
  name: "Fermeture par le code",
  render: () => (
    <NotificationProvider>
      <ImportDemo />
    </NotificationProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Un message d'attente sans croix ni délai (`dismissible: false`, `autoDismissMs: 0`), retiré par `dismiss(id)` quand le travail aboutit, puis remplacé par le résultat.",
      },
    },
  },
};

const NEWS = [
  { badges: ["R"], source: "Reuters", headline: "Airbus relève son objectif de livraisons pour le quatrième trimestre.", time: "10:05" },
  { badges: ["AFP"], source: "AFP", headline: "La BCE laisse ses taux directeurs inchangés.", time: "10:12" },
  { badges: ["E"], source: "Les Échos", headline: "Worldline recule de 7 % après la publication de son chiffre d'affaires.", time: "10:31" },
];

function NewsDemo() {
  const { notify } = useNotification();
  return (
    <Stage>
      <Button
        onClick={() =>
          NEWS.forEach((news, i) =>
            setTimeout(
              () =>
                notify({
                  corner: "bottom-left",
                  icon: <FileIcon size={16} />,
                  title: "Actualité de votre portefeuille",
                  description: (
                    <>
                      <NotificationSource badges={news.badges} name={news.source} />
                      <p style={{ margin: 0 }}>{news.headline}</p>
                    </>
                  ),
                  actions: (
                    <a href="#article" onClick={(e) => e.preventDefault()}>
                      Lire la suite
                    </a>
                  ),
                  meta: news.time,
                  autoDismissMs: 15000,
                }),
              i * 500,
            ),
          )
        }
      >
        Simuler trois dépêches
      </Button>
    </Stage>
  );
}

export const NewsAlerts: Story = {
  name: "Dépêches",
  render: () => (
    <NotificationProvider>
      <NewsDemo />
    </NotificationProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Une notification riche : icône propre, `NotificationSource` en tête de la description, un lien en action et l'heure en `meta`. Délai porté à 15 s, le temps de lire un titre.",
      },
    },
  },
};
