import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Lightbox, type LightboxProps } from "./Lightbox";
import { Button } from "../primitives/Button";
import { GALLERY_IMAGES_PLAIN } from "../../test-data/galleryData";

/**
 * La visionneuse plein écran de `Gallery`, utilisable seule. Contrôlée : l'histoire tient `open` et
 * `index`. Chaque story s'ouvre dans son propre cadre, visionneuse ouverte ; « Ouvrir » la rouvre.
 */
const meta: Meta<typeof Lightbox> = {
  title: "Widgets/Lightbox",
  component: Lightbox,
  parameters: { layout: "fullscreen", docs: { story: { inline: false, iframeHeight: 560 } } },
  args: { images: GALLERY_IMAGES_PLAIN.slice(0, 12) },
  render: function Render(args: LightboxProps) {
    const [open, setOpen] = useState(true);
    const [index, setIndex] = useState(args.index ?? 0);
    return (
      <div style={{ padding: 16 }}>
        <Button onClick={() => setOpen(true)}>Ouvrir la visionneuse</Button>
        <Lightbox {...args} open={open} index={index} onIndexChange={setIndex} onClose={() => setOpen(false)} />
      </div>
    );
  },
};
export default meta;
type Story = StoryObj<typeof Lightbox>;

export const Default: Story = {
  name: "Défaut",
  args: { index: 2 },
};

export const WithoutThumbnails: Story = {
  name: "Sans vignettes",
  args: { thumbnails: false },
};

/** Sans boucle : « précédente » est éteint sur la première image, « suivante » sur la dernière. */
export const NoLoop: Story = {
  name: "Sans boucle",
  args: { loop: false, images: GALLERY_IMAGES_PLAIN.slice(0, 4) },
};

/** La surface de l'application au lieu du fond sombre. */
export const InheritSurface: Story = {
  name: "Surface de l'application",
  args: { surface: "inherit", index: 5 },
};

/** Une seule image : ni flèches, ni compteur, ni vignettes. */
export const SingleImage: Story = {
  name: "Une seule image",
  args: { images: GALLERY_IMAGES_PLAIN.slice(4, 5) },
};
