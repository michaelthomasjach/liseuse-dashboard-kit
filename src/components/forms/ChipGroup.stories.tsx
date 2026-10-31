import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { ChipGroup, type ChipGroupOption } from "./Chip";
import { Text } from "../primitives/Text";
import { ORDERS } from "../../test-data/storyDemoData";

type Statut = "payée" | "en attente" | "annulée";
type Canal = "web" | "mobile" | "revendeur" | "api";

/** Les statuts de la démo, comptés sur les commandes réelles de `demoData`. */
const STATUTS: ChipGroupOption<Statut>[] = (["payée", "en attente", "annulée"] as const).map((s) => ({
  value: s,
  label: s.charAt(0).toUpperCase() + s.slice(1),
  count: ORDERS.filter((o) => o.statut === s).length,
}));

const CANAUX: ChipGroupOption<Canal>[] = [
  { value: "web", label: "Site" },
  { value: "mobile", label: "Application" },
  { value: "revendeur", label: "Revendeur" },
  { value: "api", label: "API", disabled: true },
];

const PERIODES: ChipGroupOption[] = [
  { value: "7j", label: "7 jours" },
  { value: "30j", label: "30 jours" },
  { value: "trimestre", label: "Trimestre" },
  { value: "annee", label: "Année" },
];

/**
 * Une rangée de puces qui gère elle-même le choix : unique ou multiple.
 */
const meta = {
  title: "Forms/ChipGroup",
  component: ChipGroup,
  parameters: {
    docs: {
      description: {
        component: [
          "Une rangée de `Chip` qui tient la logique du choix. Par défaut, **une seule** puce allumée à la fois, et cliquer celle qui l'est l'éteint (`value` revient à `null`). Avec `multiple`, chaque puce se bascule indépendamment et `value` est un tableau.",
          "",
          "**Quand l'utiliser** — filtrer une liste par une dimension aux valeurs peu nombreuses (statut, canal, période), en laissant toutes les options en vue. Pour une liste longue, `Select` ou `TagInput` ; pour un choix exclusif **obligatoire** (on ne peut pas tout éteindre), `SegmentedControl`.",
          "",
          "**Anatomie** — chaque option porte son `label`, et au besoin un `count`, une `icon`, un `disabled`. `allLabel` ajoute en tête une puce de remise à zéro (« Tout ») : allumée quand rien d'autre ne l'est, elle vide le choix au clic. `label` nomme le groupe pour les lecteurs d'écran (`role=\"group\"`) ; il n'est pas affiché.",
          "",
          "**Valeur** — composant **contrôlé**. Les props forment deux variantes : `value: T | null` et `onChange(T | null)` en choix unique ; `multiple`, `value: T[]` et `onChange(T[])` en choix multiple. Le type des valeurs se fixe par le paramètre générique (`ChipGroup<Statut>`).",
          "",
          "**Clavier** — Tab entre dans la rangée, ← / → (ou ↑ / ↓) passent d'une puce à la voisine en sautant les désactivées, Début et Fin vont aux bouts, Espace ou Entrée bascule.",
          "",
          "**Thème** — celui de `Chip` : `--lq-color-accent`, `--lq-color-border-subtle`, `--lq-color-panel`, `--lq-text-xs`, `--lq-color-focus-ring`.",
        ].join("\n"),
      },
    },
  },
  args: { label: "Période", options: PERIODES, value: "30j", onChange: fn() },
  argTypes: {
    options: { control: false },
    value: { control: false },
    onChange: { control: false },
    allLabel: { control: "text" },
    multiple: { control: false },
  },
  render: function Render(args) {
    const [value, setValue] = useState<string | null>(args.multiple ? null : (args.value as string | null));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ChipGroup
          label={args.label}
          options={args.options}
          allLabel={args.allLabel}
          className={args.className}
          value={value}
          onChange={(v) => {
            setValue(v);
            (args.onChange as (v: string | null) => void)(v);
          }}
        />
        <Text size="sm" muted>
          Valeur : {value === null ? "null" : `"${value}"`}
        </Text>
      </div>
    );
  },
} satisfies Meta<typeof ChipGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Défaut",
  parameters: { docs: { description: { story: "Choix unique : cliquez la puce allumée, elle s'éteint et la valeur passe à `null`." } } },
};

export const WithAll: Story = {
  name: "Avec « Tout » et comptes",
  args: { label: "Statut", options: STATUTS, value: "en attente", allLabel: "Tout" },
  parameters: { docs: { description: { story: "La puce « Tout » est allumée quand aucun statut ne l'est, et remet la valeur à `null` au clic. Les comptes viennent des commandes de démonstration." } } },
};

export const Multiple: Story = {
  name: "Choix multiple",
  args: { label: "Canal" },
  parameters: { docs: { description: { story: "`multiple` : la valeur est un tableau, chaque puce se bascule seule. « API » est désactivée et sautée par les flèches." } } },
  render: function Render(args) {
    const [canaux, setCanaux] = useState<Canal[]>(["web", "mobile"]);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <ChipGroup<Canal>
          multiple
          label={args.label}
          options={CANAUX}
          allLabel="Tous les canaux"
          value={canaux}
          onChange={(v) => {
            setCanaux(v);
            (args.onChange as unknown as (v: Canal[]) => void)(v);
          }}
        />
        <Text size="sm" muted>
          Valeur : [{canaux.map((c) => `"${c}"`).join(", ")}]
        </Text>
      </div>
    );
  },
};

export const Empty: Story = {
  name: "Rien d'allumé",
  args: { value: null, allLabel: "Toute la période" },
};
