import type { Meta, StoryObj } from "@storybook/react";
import { LegendRow } from "./LegendRow";

const meta: Meta<typeof LegendRow> = {
  title: "Primitives/LegendRow",
  component: LegendRow,
};
export default meta;
type Story = StoryObj<typeof LegendRow>;

export const SectorAllocation: Story = {
  name: "Répartition sectorielle",
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <LegendRow color="#e8391c" label="Semiconductors" value="62.7 %" />
      <LegendRow color="#2f6fed" label="Software" value="21.4 %" />
      <LegendRow color="#1ba672" label="Hardware" value="10.1 %" />
      <LegendRow color="#a3a3a3" label="Autres" value="5.8 %" />
    </div>
  ),
};
