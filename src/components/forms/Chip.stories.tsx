import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Chip, ChipGroup } from "./Chip";

/** Des puces de filtre : légères, arrondies, allumées à l'accent. Tab y mène, Espace les bascule,
 *  les flèches passent de l'une à l'autre dans un groupe. */
const meta: Meta<typeof ChipGroup> = {
  title: "Forms/Chip",
  component: ChipGroup,
};
export default meta;
type Story = StoryObj<typeof ChipGroup>;

const CATS = ["Stockage", "Énergie", "Transport", "Clients", "Personnel"];

export const Unique: Story = {
  name: "Une catégorie à la fois",
  render: function Render() {
    const [value, setValue] = useState<string | null>(null);
    return <ChipGroup label="Catégories" allLabel="Tout" value={value} onChange={setValue} options={CATS.map((c, i) => ({ value: c, label: c, count: 3 + i * 2 }))} />;
  },
};

export const Plusieurs: Story = {
  name: "Plusieurs à la fois",
  render: function Render() {
    const [value, setValue] = useState<string[]>(["Énergie"]);
    return <ChipGroup multiple label="Filtres" value={value} onChange={setValue} options={CATS.map((c) => ({ value: c, label: c, disabled: c === "Personnel" }))} />;
  },
};

export const Seule: Story = {
  name: "Une puce seule",
  render: function Render() {
    const [on, setOn] = useState(false);
    return (
      <Chip selected={on} onClick={() => setOn((v) => !v)} count={12}>
        En retard
      </Chip>
    );
  },
};
