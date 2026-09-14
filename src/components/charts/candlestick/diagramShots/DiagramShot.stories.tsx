import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { CandlestickChart } from "../../CandlestickChart";
import { PROP_SHOT_DATA } from "../propShots/propShotData";
import { DIAGRAM_SHOT_BASE, DIAGRAM_SHOT_IDS, diagramShotVariant, type DiagramShotVariant } from "./diagramShotVariants";

/** The rendering harness behind the illustrations in the indicator and drawing-tool info modals.
 *
 *  It exists to be driven by `scripts/captureDiagramShots.cjs`, which navigates here once per
 *  indicator and once per drawing tool with `?args=variant:<id>` and screenshots the
 *  `[data-diagram-shot]` box — but it stays an ordinary story, so the whole set is reviewable by
 *  hand in Storybook rather than only through the capture script's output.
 *
 *  Everything is fixed on purpose: one dataset, one seed, one frame size. These captures are
 *  committed files compared across runs, and anything that moved with the wind would produce a
 *  diff every time while teaching the reader nothing. */
const meta: Meta = {
  title: "Charts/CandlestickChart/Captures de diagrammes",
  parameters: { layout: "fullscreen" },
  // No docs page: this is a tool, and its "documentation" is the modals it feeds.
  tags: ["!autodocs"],
};
export default meta;

/** The capture frame. Wider and shorter than the props reference's own, because these pictures
 *  sit full-bleed across a wide modal rather than on a card: a squarer frame would letterbox. */
const SHOT_WIDTH = 1180;
const SHOT_HEIGHT = 560;

type ShotArgs = { variant: string };

export const Shot: StoryObj<ShotArgs> = {
  name: "Capture (outil)",
  args: { variant: DIAGRAM_SHOT_IDS[0] },
  argTypes: {
    variant: { control: "select", options: DIAGRAM_SHOT_IDS },
  },
  render: ({ variant }) => {
    const entry = diagramShotVariant(variant);

    // The capture script asks the page for the id list and the crops rather than parsing this
    // file, so a variant added to the table cannot be captured-and-forgotten, and a crop cannot
    // drift out of sync with the table that declares it.
    useEffect(() => {
      const w = window as unknown as {
        __DIAGRAM_SHOT_IDS__?: string[];
        __DIAGRAM_SHOT_CROPS__?: Record<string, DiagramShotVariant["crop"]>;
      };
      w.__DIAGRAM_SHOT_IDS__ = DIAGRAM_SHOT_IDS;
      w.__DIAGRAM_SHOT_CROPS__ = Object.fromEntries(
        DIAGRAM_SHOT_IDS.map((id) => [id, diagramShotVariant(id)?.crop]),
      );
    }, []);

    if (!entry) return <div style={{ padding: 24 }}>Variante inconnue : {variant}</div>;

    return (
      // Width fixed, height free: `height` below sizes the *plot*, and a variant that also renders
      // an indicator pane or the drawing rail is genuinely taller than the plot alone. A fixed
      // frame would clip whichever of those fell outside it — often the subject itself.
      <div data-diagram-shot={variant} style={{ width: SHOT_WIDTH }}>
        <CandlestickChart
          // Remounts per variant: `defaultDrawings` and `defaultIndicators` are uncontrolled
          // seeds, read once and then owned by the component. Without the key, switching variants
          // in Storybook would keep the previous one's drawings on screen.
          key={variant}
          data={PROP_SHOT_DATA}
          symbol="ACME"
          height={SHOT_HEIGHT}
          {...DIAGRAM_SHOT_BASE}
          {...entry.props}
        />
      </div>
    );
  },
};
