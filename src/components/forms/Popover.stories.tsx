import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { Button } from "../primitives/Button";
import { Checkbox } from "./Checkbox";
import { Popover } from "./Popover";
import { Text } from "../primitives/Text";
import { ChevronDownIcon } from "../icons/icons";

/** Un panneau ouvert pousse son contenu dans `document.body` : dans la page de documentation, chaque
 *  story est donc rendue dans son propre cadre, pour que le panneau n'aille pas flotter sur la page. */
const IN_FRAME = { docs: { story: { inline: false, iframeHeight: 300 } } };

const ACTIONS = ["Dupliquer la facture", "Envoyer un rappel", "Exporter en PDF", "Archiver"];

/**
 * Le panneau flottant ancré sur lequel reposent `Select`, `InputDropdown` et les calendriers.
 */
const meta = {
  title: "Forms/Popover",
  component: Popover,
  parameters: {
    ...IN_FRAME,
    docs: {
      ...IN_FRAME.docs,
      description: {
        component: [
          "Le panneau flottant de bas niveau du kit : un cadre à ombre portée, accroché à un élément d'ancrage, qui porte ce qu'on y met. `Select`, `InputDropdown`, `TagInput` et les sélecteurs de dates l'utilisent tous ; il sert directement à construire un menu ou un panneau de filtres maison.",
          "",
          "**Quand l'utiliser** — un contenu court et interactif qui doit apparaître contre un bouton et disparaître dès qu'on en sort : filtres, menu d'actions, petit formulaire. Pour une information au survol, une infobulle ; pour une tâche qui demande l'attention, une modale ; pour choisir dans une liste, `Select` ou `InputDropdown` plutôt qu'un menu refait à la main.",
          "",
          "**Contrôlé, sans déclencheur** — le composant n'a pas de bouton à lui : l'appelant tient `open`, pose une ref sur l'ancre (`anchorRef`) et bascule `open` depuis son propre bouton. `onClose` est appelé au clic **hors** du panneau et de l'ancre, et à Échap : l'appelant y repasse `open` à `false`. Un clic sur l'ancre ne ferme donc rien d'office — c'est le bouton qui bascule.",
          "",
          "**Placement** — le panneau est rendu dans un **portail** sous `document.body` (il échappe aux `overflow: hidden` et aux piles de z-index), en position fixe. Il s'ouvre sous l'ancre, ou au-dessus avec `placement=\"top\"`, se retourne quand la place manque et se décale horizontalement pour rester dans la fenêtre. Il se remesure au défilement et au redimensionnement ; pour une ancre qui bouge sans que rien de tout cela n'arrive (un élément déplacé sur un canevas), changez `trackKey`. `matchAnchorWidth` lui donne la largeur exacte de l'ancre, comme une liste de `Select`.",
          "",
          "**Thème** — le portail reprend le thème de l'arbre d'où il part, surface et classe comprises : `--lq-color-panel` pour le fond, `--lq-color-border`, `--lq-radius-md` et `--lq-shadow-modal`. Il n'a pas de marge intérieure : le contenu pose la sienne.",
        ].join("\n"),
      },
    },
  },
  args: { open: true, placement: "bottom", onClose: fn(), anchorRef: { current: null }, children: null },
  argTypes: {
    open: { control: false },
    onClose: { control: false },
    anchorRef: { control: false },
    children: { control: false },
    trackKey: { control: false },
  },
  render: function Render(args) {
    const [open, setOpen] = useState(args.open);
    const [archives, setArchives] = useState(false);
    const [brouillons, setBrouillons] = useState(true);
    const anchor = useRef<HTMLSpanElement>(null);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span ref={anchor} style={{ display: "inline-flex" }}>
          <Button onClick={() => setOpen((o) => !o)} icon={<ChevronDownIcon size={16} />} iconPosition="trailing">
            Filtres avancés
          </Button>
        </span>
        <Text size="sm" muted>
          {[archives && "archives", brouillons && "brouillons"].filter(Boolean).join(" · ") || "aucun filtre"}
        </Text>
        <Popover
          {...args}
          open={open}
          anchorRef={anchor}
          onClose={() => {
            setOpen(false);
            args.onClose();
          }}
        >
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, minWidth: 260 }}>
            <Checkbox checked={archives} onChange={setArchives} label="Inclure les clients archivés" />
            <Checkbox checked={brouillons} onChange={setBrouillons} label="Inclure les devis en brouillon" />
            <Button selected onClick={() => setOpen(false)}>
              Appliquer
            </Button>
          </div>
        </Popover>
      </div>
    );
  },
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Défaut",
  parameters: { docs: { description: { story: "Un panneau de filtres : le bouton bascule `open`, un clic au-dehors ou Échap appelle `onClose`." } } },
};

export const MatchAnchorWidth: Story = {
  name: "Largeur de l'ancre",
  args: { matchAnchorWidth: true },
  parameters: { docs: { description: { story: "Un menu d'actions taillé à la largeur du bouton qui l'ouvre, comme la liste d'un `Select`." } } },
  render: function Render(args) {
    const [open, setOpen] = useState(args.open);
    const [last, setLast] = useState<string | null>(null);
    const anchor = useRef<HTMLDivElement>(null);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 260 }}>
        <div ref={anchor}>
          <Button block onClick={() => setOpen((o) => !o)} icon={<ChevronDownIcon size={16} />} iconPosition="trailing">
            Actions sur C-4823
          </Button>
        </div>
        <Text size="sm" muted>
          {last ? `Dernière action : ${last}` : "Aucune action lancée"}
        </Text>
        <Popover
          {...args}
          open={open}
          anchorRef={anchor}
          onClose={() => {
            setOpen(false);
            args.onClose();
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", padding: 4 }}>
            {ACTIONS.map((a) => (
              <Button
                key={a}
                block
                onClick={() => {
                  setLast(a);
                  setOpen(false);
                }}
              >
                {a}
              </Button>
            ))}
          </div>
        </Popover>
      </div>
    );
  },
};

export const Top: Story = {
  name: "Au-dessus de l'ancre",
  args: { placement: "top" },
  parameters: { docs: { description: { story: "`placement=\"top\"` : pour une ancre posée en bas d'un panneau. Faute de place au-dessus, le panneau se retournerait vers le bas." } } },
  render: function Render(args) {
    const [open, setOpen] = useState(args.open);
    const anchor = useRef<HTMLSpanElement>(null);
    return (
      <div style={{ paddingTop: 150 }}>
        <span ref={anchor} style={{ display: "inline-flex" }}>
          <Button onClick={() => setOpen((o) => !o)}>Aide sur ce total</Button>
        </span>
        <Popover
          {...args}
          open={open}
          anchorRef={anchor}
          onClose={() => {
            setOpen(false);
            args.onClose();
          }}
        >
          <div style={{ padding: 12, maxWidth: 280 }}>
            <Text size="sm">Le total inclut les commandes payées et en attente, hors annulations. Il est recalculé chaque nuit à 03:00.</Text>
          </div>
        </Popover>
      </div>
    );
  },
};

export const Closed: Story = {
  name: "Fermé au départ",
  args: { open: false },
  parameters: { docs: { description: { story: "Fermé, le composant ne rend rien du tout — pas même un nœud caché." } } },
};
