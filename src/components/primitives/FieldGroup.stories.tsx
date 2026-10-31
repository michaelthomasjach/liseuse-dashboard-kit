import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { FieldGroup } from "./FieldGroup";
import { Button } from "./Button";
import { SegmentedControl } from "./SegmentedControl";
import { ColorSwatchButton } from "./ColorSwatchButton";
import { BarChartIcon } from "../icons/icons";

const PERIODS = [
  { value: "7j", label: "7 j" },
  { value: "30j", label: "30 j" },
  { value: "trim", label: "Trimestre" },
];

/**
 * La rangée de contrôles sous un intitulé commun.
 */
const meta = {
  title: "Primitives/FieldGroup",
  component: FieldGroup,
  parameters: {
    docs: {
      description: {
        component: [
          "Un intitulé en petites capitales, et dessous une rangée de contrôles qui passent à la ligne s'ils manquent de place. C'est une mise en page, sans état ni logique : les contrôles restent ceux de l'appelant.",
          "",
          "**Quand l'utiliser** — nommer d'un seul intitulé un groupe de boutons ou de pastilles qui n'ont pas chacun le leur : les formats d'export, les teintes d'une lampe, une série de raccourcis. Pour un champ de saisie, son propre `label` suffit ; pour un choix exclusif, `SegmentedControl` porte déjà son intitulé.",
          "",
          "**Accessibilité** — l'intitulé est du texte, pas un `<legend>` : il ne nomme pas les contrôles pour un lecteur d'écran. Chaque contrôle doit rester compréhensible seul.",
          "",
          "**Thème** — l'intitulé suit `--lq-label-font`, `--lq-label-size`, `--lq-label-weight`, `--lq-label-tracking` en `--lq-color-text-muted` ; l'écart entre intitulé et contrôles, et entre contrôles, `--lq-space-2`.",
        ].join("\n"),
      },
    },
  },
  args: {
    label: "Exporter le rapport",
    children: (
      <>
        <Button icon={<BarChartIcon size={16} />}>CSV</Button>
        <Button>PDF</Button>
        <Button>Excel</Button>
      </>
    ),
  },
  argTypes: { label: { control: "text" }, children: { control: false } },
} satisfies Meta<typeof FieldGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { name: "Défaut" };

export const WithSegmentedControl: Story = {
  name: "Avec un choix exclusif",
  render: function Render() {
    const [period, setPeriod] = useState("30j");
    return (
      <FieldGroup label="Vue par défaut">
        <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} />
      </FieldGroup>
    );
  },
  parameters: { docs: { description: { story: "Un `SegmentedControl` sans son propre `label`, nommé par le groupe." } } },
};

export const WithSwatches: Story = {
  name: "Avec des pastilles",
  render: function Render() {
    const [tint, setTint] = useState("chaude");
    const tints = [
      { id: "froide", label: "Froide", color: "var(--lq-color-sky)" },
      { id: "neutre", label: "Neutre", color: "var(--lq-color-text-muted)" },
      { id: "chaude", label: "Chaude", color: "var(--lq-color-amber)" },
    ];
    return (
      <FieldGroup label="Température de couleur">
        {tints.map((t) => (
          <ColorSwatchButton key={t.id} label={t.label} color={t.color} selected={tint === t.id} onClick={() => setTint(t.id)} />
        ))}
      </FieldGroup>
    );
  },
};

export const Stacked: Story = {
  name: "Plusieurs groupes",
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <FieldGroup label="Exporter">
        <Button>CSV</Button>
        <Button>PDF</Button>
      </FieldGroup>
      <FieldGroup label="Partager">
        <Button>Copier le lien</Button>
        <Button>Envoyer par courriel</Button>
      </FieldGroup>
    </div>
  ),
};
