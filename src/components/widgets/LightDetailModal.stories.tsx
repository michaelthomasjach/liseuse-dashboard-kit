import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { Button } from "../primitives/Button";
import { LightDetailModal } from "./LightDetailModal";
import { LIGHT_COLORS, WHITE_BALANCES } from "../../test-data/storyDemoData";

/**
 * La fiche de réglage d'une lampe : allumage, température de blanc, couleur. C'est la modale que
 * `LightsWidget` ouvre quand on touche une rangée.
 */
const meta = {
  title: "Widgets/LightDetailModal",
  component: LightDetailModal,
  parameters: {
    docs: {
      // Une modale se pose sur toute la page : dans la documentation, chaque exemple vit dans son
      // propre cadre pour qu'elle n'en recouvre pas le reste.
      story: { inline: false, iframeHeight: 520 },
      description: {
        component: [
          "Une **modale de réglage** pour une lampe : un groupe « Allumage » (Allumer / Éteindre), un groupe « Température » (préréglages de blanc) et un groupe « Couleur » (pastilles de teinte). Le nom de la pièce sert de titre.",
          "",
          "**Quand l'utiliser** — en complément de `LightsWidget` : la liste dit ce qui est allumé, la fiche règle une lampe en particulier. Pour une fiche d'un autre équipement, composez une `Modal` avec des `FieldGroup` : celle-ci est taillée pour l'éclairage.",
          "",
          "**Anatomie** — `Modal` du kit (titre déplaçable, croix, bouton « Fermer », fermeture par Échap ou clic sur le voile), puis jusqu'à trois `FieldGroup`. Allumage : deux `Button`, celui de l'état courant en sélectionné. Température : un `Button` par entrée de `whiteBalanceOptions`. Couleur : un `ColorSwatchButton` par entrée de `colorOptions`, dont la teinte (`color`) est une donnée de l'ampoule et non du thème. Les deux derniers groupes n'apparaissent que si leur liste est fournie et non vide.",
          "",
          "**Entièrement contrôlée** — `open`, `on`, `whiteBalance` et `color` viennent de l'application ; la fiche appelle `onPowerChange`, `onWhiteBalanceChange`, `onColorChange` et `onClose` sans rien retenir. Chaque choix s'applique tout de suite : il n'y a pas de bouton « Enregistrer ».",
          "",
          "**Portail** — la modale est rendue dans `document.body`, hors de l'arbre du thème ; le kit y repose le fournisseur de thème avec la même palette, la même surface et la même classe, si bien que les variables du thème englobant s'appliquent aussi dedans.",
          "",
          "**Thème** — celles de `Modal` (`--lq-color-panel`, `--lq-color-overlay`, `--lq-shadow-modal`, `--lq-radius-lg`, `--lq-space-2` à `--lq-space-5`), de `FieldGroup` (`--lq-label-*`), de `Button` et de `ColorSwatchButton` (`--lq-radius-md`, `--lq-control-border-width`, `--lq-color-fill`).",
        ].join("\n"),
      },
    },
  },
  args: {
    open: true,
    roomName: "Cuisine",
    on: true,
    whiteBalanceOptions: WHITE_BALANCES,
    whiteBalance: "chaud",
    colorOptions: LIGHT_COLORS,
    color: undefined,
    onClose: fn(),
    onPowerChange: fn(),
    onWhiteBalanceChange: fn(),
    onColorChange: fn(),
  },
  argTypes: {
    whiteBalance: { control: "select", options: WHITE_BALANCES.map((w) => w.id) },
    color: { control: "select", options: [undefined, ...LIGHT_COLORS.map((c) => c.id)] },
    whiteBalanceOptions: { control: false },
    colorOptions: { control: false },
    onClose: { control: false },
    onPowerChange: { control: false },
    onWhiteBalanceChange: { control: false },
    onColorChange: { control: false },
  },
  // La story tient l'ouverture et les trois réglages ; les contrôles les remettent à la valeur voulue.
  render: function Render(args) {
    const [open, setOpen] = useState(args.open);
    const [on, setOn] = useState(args.on);
    const [whiteBalance, setWhiteBalance] = useState(args.whiteBalance);
    const [color, setColor] = useState(args.color);
    useEffect(() => setOpen(args.open), [args.open]);
    useEffect(() => setOn(args.on), [args.on]);
    useEffect(() => setWhiteBalance(args.whiteBalance), [args.whiteBalance]);
    useEffect(() => setColor(args.color), [args.color]);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Régler la lampe « {args.roomName} »</Button>
        <LightDetailModal
          {...args}
          open={open}
          onClose={() => {
            setOpen(false);
            args.onClose();
          }}
          on={on}
          onPowerChange={(next) => {
            setOn(next);
            args.onPowerChange(next);
          }}
          whiteBalance={whiteBalance}
          onWhiteBalanceChange={(id) => {
            setWhiteBalance(id);
            args.onWhiteBalanceChange?.(id);
          }}
          color={color}
          onColorChange={(id) => {
            setColor(id);
            args.onColorChange?.(id);
          }}
        />
      </>
    );
  },
} satisfies Meta<typeof LightDetailModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Défaut" };

export const WithColor: Story = {
  name: "Couleur choisie",
  args: { roomName: "Séjour", color: "bleu" },
  parameters: { docs: { description: { story: "Une teinte choisie : sa pastille est marquée sélectionnée." } } },
};

export const WhiteOnly: Story = {
  name: "Blancs seulement",
  args: { roomName: "Bureau", colorOptions: undefined, whiteBalance: "neutre" },
  parameters: { docs: { description: { story: "Une ampoule blanche à température réglable : sans `colorOptions`, le groupe « Couleur » disparaît." } } },
};

export const PowerOnly: Story = {
  name: "Allumage seul",
  args: { roomName: "Entrée", on: false, whiteBalanceOptions: undefined, colorOptions: undefined },
  parameters: { docs: { description: { story: "Une lampe sans réglage : il ne reste que Allumer / Éteindre." } } },
};
