import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { BalanceControl } from "./BalanceControl";

/**
 * La balance gauche / droite : une poignée sur une piste, un cran au centre, un remplissage qui part
 * du milieu.
 */
const meta = {
  title: "Audio/BalanceControl",
  component: BalanceControl,
  parameters: {
    docs: {
      description: {
        component: [
          "Une **balance** : une poignée sur une piste de −100 (tout à gauche) à +100 (tout à droite), avec un **cran au centre** et un remplissage qui part **du milieu** plutôt que du bord gauche — l'image dit « de combien on s'écarte du centre », la seule chose qu'une balance dit.",
          "",
          "**Quand l'utiliser** — pour un réglage symétrique autour d'un point neutre : balance stéréo, répartition avant / arrière, préférence entre deux options, écart à une consigne. Pour une valeur qui part de zéro, un curseur simple ; pour répartir un tout entre plus de deux postes, `AllocationSlider`.",
          "",
          "**Le cran** — `detent` (4 par défaut) : à moins de tant d'unités du centre, la poignée s'y accroche. Sans lui, une poignée tirée à la main finit sur −1 ou +2 et y reste ; `detent={0}` le retire. **Double-clic** ou la touche **Début** recentrent.",
          "",
          "**Lecture** — par défaut, le côté vers lequel on penche plutôt qu'un nombre signé (« −34 » ne dit pas « gauche » à qui n'a pas lu la documentation). `formatValue` la remplace — « 40 / 60 » pour une répartition ; `hideValue` la masque. `leftLabel` et `rightLabel` nomment les deux bouts (« L » et « R » par défaut : en français, passez « G » et « D »).",
          "",
          "**Contrôlé** — `value` et `onChange`. Au clavier, c'est un curseur : flèches de `step` en `step`, Début pour recentrer.",
          "",
          "**Thème** — `--lq-color-fill-track` (piste), `--lq-color-border` (cran central), `--lq-color-fill` (remplissage), `--lq-color-accent` (poignée, cerclée de `--lq-color-panel`, ombrée de `--lq-color-overlay`), `--lq-color-text` et `--lq-color-text-muted` (libellé, bouts, lecture), `--lq-color-focus-ring`, `--lq-radius-pill`, `--lq-space-2`, `--lq-space-3`.",
        ].join("\n"),
      },
    },
  },
  args: { value: -20, onChange: fn(), label: "Balance", leftLabel: "G", rightLabel: "D", detent: 4, step: 1, hideValue: false, disabled: false },
  argTypes: {
    value: { control: { type: "range", min: -100, max: 100, step: 1 } },
    onChange: { control: false },
    formatValue: { control: false },
  },
  // Une valeur contrôlée : la story la tient, le contrôle `value` la remet où on veut.
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    useEffect(() => setValue(args.value), [args.value]);
    return (
      <div style={{ maxWidth: 360 }}>
        <BalanceControl
          {...args}
          value={value}
          onChange={(next) => {
            setValue(next);
            args.onChange(next);
          }}
        />
      </div>
    );
  },
} satisfies Meta<typeof BalanceControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Défaut",
  parameters: { docs: { description: { story: "Tirez la poignée près du centre : elle s'y accroche. Double-cliquez pour recentrer." } } },
};

export const Split: Story = {
  name: "Répartition avant / arrière",
  args: {
    label: "Répartition",
    leftLabel: "Avant",
    rightLabel: "Arrière",
    value: -20,
    detent: 0,
    step: 2,
    formatValue: (v: number) => (v === 0 ? "50 / 50" : `${50 - v / 2} / ${50 + v / 2}`),
  },
  parameters: { docs: { description: { story: "`formatValue` dit la part de chaque côté ; `detent={0}` retire le cran." } } },
};

export const NoReadout: Story = {
  name: "Sans lecture",
  args: { value: 35, hideValue: true, label: "Mixage voix / musique", leftLabel: "Voix", rightLabel: "Musique" },
};

export const Disabled: Story = {
  name: "Désactivée",
  args: { value: 20, disabled: true },
};
