import type { Meta, StoryObj } from "@storybook/react";
import { CandlestickChart } from "../../CandlestickChart";
import { PROP_SHOT_DATA } from "./propShotData";
import { PROP_SHOT_BASE, PROP_SHOT_VARIANTS, type PropShotVariantId } from "./propShotVariants";

/** The rendering harness behind the illustrations in the props reference (see
 *  `ChartPropsModal`). It exists to be driven by `scripts/captureChartPropShots.cjs`, which
 *  navigates to this story once per prop with `?args=variant:<propName>` and screenshots the
 *  `[data-prop-shot]` box — but it is a perfectly ordinary story too, so the variant table stays
 *  reviewable by hand in Storybook rather than only through the capture script's output.
 *
 *  Everything here is deliberately fixed: one dataset, one seed, one frame size. A screenshot
 *  that shifted with the wind would produce a diff on every capture run and teach the reader
 *  nothing about the prop it is supposed to illustrate. */
const meta: Meta = {
  title: "Charts/CandlestickChart/Captures de props",
  parameters: { layout: "fullscreen" },
  // No docs page: this is a tool, and its "documentation" is the reference modal it feeds.
  tags: ["!autodocs"],
};
export default meta;

/** The capture frame. Wide enough that the header's own buttons don't collapse into an overflow
 *  menu, tall enough that an indicator pane and the volume panel both fit under the price plot. */
const SHOT_WIDTH = 1100;
const SHOT_HEIGHT = 620;

type ShotArgs = { variant: PropShotVariantId };

export const Shot: StoryObj<ShotArgs> = {
  name: "Capture (outil)",
  args: { variant: "showVolume" },
  argTypes: {
    variant: { control: "select", options: Object.keys(PROP_SHOT_VARIANTS) },
  },
  render: ({ variant }) => {
    const entry = PROP_SHOT_VARIANTS[variant] ?? PROP_SHOT_VARIANTS.showVolume;
    return (
      // Width is fixed, height is not: `height` below sizes the *plot*, and a variant that also
      // renders the header bar or the drawing toolbar is genuinely taller than the plot alone. A
      // fixed-height frame would clip whichever of those fell outside it — exactly the part the
      // shot is meant to show — so the frame grows to whatever the chart actually occupies.
      <div data-prop-shot={variant} style={{ width: SHOT_WIDTH }}>
        <CandlestickChart
          // Remounts on every variant change: several of these props are uncontrolled seeds
          // (`defaultDrawings`, `defaultIndicators`, `defaultChartDisplayMode`), which a live
          // component reads once and then owns. Without the key, switching variants in Storybook
          // would silently keep the previous variant's drawings on screen.
          key={variant}
          data={PROP_SHOT_DATA}
          symbol="ACME"
          height={SHOT_HEIGHT}
          {...PROP_SHOT_BASE}
          {...entry.props}
        />
      </div>
    );
  },
};
