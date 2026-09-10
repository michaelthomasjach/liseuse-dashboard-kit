import type { Meta, StoryObj } from "@storybook/react";
import { WorldExposureMap, type WorldExposureDatum } from "./WorldExposureMap";

const meta: Meta<typeof WorldExposureMap> = {
  title: "Charts/WorldExposureMap",
  component: WorldExposureMap,
};
export default meta;
type Story = StoryObj<typeof WorldExposureMap>;

/** Region labels, not country ones: the component resolves a label to one of its eight regions
 *  itself (see `matchContinent` in `worldGeo.ts`), and "US", "Europe" or "Asie" all land. */
const PORTFOLIO: WorldExposureDatum[] = [
  { id: "na", label: "Amérique du Nord", value: 54 },
  { id: "eu", label: "Europe", value: 24 },
  { id: "asia", label: "Asie", value: 12 },
  { id: "latam", label: "Amérique du Sud", value: 5 },
  { id: "me", label: "Moyen-Orient", value: 3 },
  { id: "africa", label: "Afrique", value: 2 },
];

export const Portfolio: Story = {
  name: "Exposition d'un portefeuille",
  render: () => (
    <div style={{ maxWidth: 720 }}>
      <WorldExposureMap data={PORTFOLIO} width={720} height={340} formatValue={(v) => `${v} %`} />
    </div>
  ),
};

export const Concentrated: Story = {
  name: "Deux régions seulement",
  render: () => (
    <div style={{ maxWidth: 720 }}>
      <WorldExposureMap
        data={[
          { id: "na", label: "US", value: 82 },
          { id: "eu", label: "Europe", value: 18 },
        ]}
        width={720}
        height={340}
        formatValue={(v) => `${v} %`}
      />
    </div>
  ),
};

/** What an unresolvable label does. "Global" and "Autre" match no region, so they are added up
 *  into the "Non localisable" note under the legend rather than dropped without a word. */
export const Unlocatable: Story = {
  name: "Libellés non localisables",
  render: () => (
    <div style={{ maxWidth: 720 }}>
      <WorldExposureMap
        data={[
          { id: "na", label: "Amérique du Nord", value: 40 },
          { id: "eu", label: "Europe", value: 25 },
          { id: "global", label: "Global", value: 20 },
          { id: "other", label: "Autre", value: 15 },
        ]}
        width={720}
        height={340}
        formatValue={(v) => `${v} %`}
      />
    </div>
  ),
};
