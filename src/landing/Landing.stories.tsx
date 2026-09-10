import type { Meta, StoryObj } from "@storybook/react";
import { version } from "../../package.json";
import { LandingPage } from "./LandingPage";

/** The sidebar's first entry: what someone lands on before they know what any of the other
 *  entries are. Everything it shows is a live component pulled from the library itself, so it
 *  can't drift out of date the way a page of screenshots would. */
const meta: Meta<typeof LandingPage> = {
  title: "Accueil",
  component: LandingPage,
  // No Docs page for this one. `autodocs` is on globally (see .storybook/preview.tsx), and here it
  // would add a second sidebar entry under a title that is meant to be a single leaf — plus a
  // props table for a component nobody imports.
  tags: ["!autodocs"],
  parameters: {
    layout: "fullscreen",
    // No addons panel and no props table on the way in. This is the first thing a visitor sees,
    // and a `version: string` control docked across the bottom third of the screen is noise for a
    // component nobody is meant to import.
    options: { showPanel: false },
    controls: { disable: true },
  },
};
export default meta;
type Story = StoryObj<typeof LandingPage>;

export const Accueil: Story = {
  name: "Accueil",
  render: () => (
    // The global decorator pads every story by 32px so components don't sit against the canvas
    // edge. A landing page wants the full bleed — same negative margin the full-screen chart
    // story uses to cancel it back out.
    <div style={{ margin: -32 }}>
      <LandingPage version={version} />
    </div>
  ),
};
