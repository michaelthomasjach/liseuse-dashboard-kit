import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { Button } from "../primitives/Button";
import { Equalizer, type EqualizerBand } from "./Equalizer";
import { EQ_BANDS } from "../../test-data/storyDemoData";

const FLAT: EqualizerBand[] = EQ_BANDS.map((b) => ({ ...b, gain: 0 }));

const FIVE: EqualizerBand[] = [
  { id: "graves", label: "60", gain: 3 },
  { id: "bas-medium", label: "250", gain: 1 },
  { id: "medium", label: "1 k", gain: -2 },
  { id: "haut-medium", label: "4 k", gain: 1.5 },
  { id: "aigus", label: "12 k", gain: 4 },
];

/**
 * Un égaliseur graphique : un curseur par bande de fréquence sur une grille en dB, et la courbe de
 * réponse tracée à travers les poignées.
 */
const meta = {
  title: "Audio/Equalizer",
  component: Equalizer,
  parameters: {
    docs: {
      description: {
        component: [
          "Un **égaliseur graphique** : un curseur vertical par bande de fréquence, sur une grille en dB, et la **courbe de réponse** tracée à travers les poignées — la somme des réglages, ce qu'un égaliseur sert vraiment à montrer et qu'une rangée de curseurs indépendants ne dit pas.",
          "",
          "**Quand l'utiliser** — pour régler ou montrer un gain par bande : l'égalisation d'une sortie audio, mais aussi toute série de réglages positifs ou négatifs autour d'un zéro qu'on lit comme une courbe. Pour un seul réglage symétrique, `BalanceControl` ; pour lire des niveaux qui bougent, `LevelMeter`.",
          "",
          "**Données** — chaque bande (`EqualizerBand`) a un `id`, un `label` sous le curseur (« 60 », « 1 k », « 16 k » — l'unité va dans `unit`, imprimée une seule fois) et un `gain` en dB, 0 étant plat.",
          "",
          "**Contrôlé** — `onChange` reçoit **tout le tableau** suivant : un `useState` suffit à le brancher. **Sans `onChange`, l'égaliseur est en lecture seule** : il affiche une réponse. Double-clic sur un curseur (ou la touche Début) remet sa bande à plat ; le bouton « Réinitialiser » est laissé à l'application, puisque « plat » n'est pas toujours le préréglage auquel on veut revenir.",
          "",
          "**Réglages** — `range` (± 12 dB par défaut), `step`, `height` (150 px pour les colonnes), `showCurve` et `showScale` (vrais par défaut), `showValues` (faux par défaut : avec dix bandes, c'est un mur de chiffres, et la courbe dit déjà la forme), `disabled`.",
          "",
          "**Thème** — `--lq-color-accent` (courbe et poignées, cerclées de `--lq-color-panel`), `--lq-color-border` (pistes, grille), `--lq-color-focus-ring`, `--lq-color-bg`, `--lq-color-text`, `--lq-color-text-muted` (valeurs, fréquences), `--lq-radius-pill`, `--lq-radius-sm`.",
        ].join("\n"),
      },
    },
  },
  args: {
    bands: EQ_BANDS,
    onChange: fn(),
    range: 12,
    step: 0.5,
    unit: "Hz",
    height: 150,
    showCurve: true,
    showScale: true,
    showValues: false,
    disabled: false,
  },
  argTypes: {
    bands: { control: false },
    onChange: { control: false },
    range: { control: { type: "range", min: 3, max: 24, step: 1 } },
    height: { control: { type: "range", min: 80, max: 300, step: 10 } },
  },
  // Les bandes sont tenues par la story ; deux boutons montrent le préréglage laissé à l'application.
  render: function Render(args) {
    const [bands, setBands] = useState(args.bands);
    useEffect(() => setBands(args.bands), [args.bands]);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
        <Equalizer
          {...args}
          bands={bands}
          onChange={
            args.onChange &&
            ((next) => {
              setBands(next);
              args.onChange?.(next);
            })
          }
        />
        {args.onChange ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={() => setBands(args.bands.map((b) => ({ ...b, gain: 0 })))}>Plat</Button>
            <Button onClick={() => setBands(args.bands)}>Rétablir</Button>
          </div>
        ) : null}
      </div>
    );
  },
} satisfies Meta<typeof Equalizer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Défaut",
  parameters: { docs: { description: { story: "Dix bandes ; double-cliquez un curseur pour remettre sa bande à plat." } } },
};

export const WithValues: Story = {
  name: "Avec les valeurs",
  args: { showValues: true },
};

export const FiveBands: Story = {
  name: "Cinq bandes, ± 6 dB",
  args: { bands: FIVE, range: 6, step: 0.5, height: 120 },
  parameters: { docs: { description: { story: "Moins de bandes, une plage plus courte : l'égaliseur d'une enceinte plutôt que d'une console." } } },
};

export const ReadOnly: Story = {
  name: "Lecture seule",
  args: { onChange: undefined, showScale: false },
  parameters: { docs: { description: { story: "Sans `onChange`, rien ne se saisit : la courbe d'une égalisation déjà appliquée." } } },
};

export const Flat: Story = {
  name: "À plat, désactivé",
  args: { bands: FLAT, disabled: true },
};
