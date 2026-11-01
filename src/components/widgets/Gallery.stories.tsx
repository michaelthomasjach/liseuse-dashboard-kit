import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Gallery, type GalleryImage } from "./Gallery";
import { Badge } from "../finance/Badge";
import { GALLERY_IMAGES, GALLERY_IMAGES_PLAIN } from "../../test-data/galleryData";

/**
 * Seize illustrations générées en SVG — paysages, formes, vagues, dégradés —, dans tous les formats.
 * Un clic ouvre la visionneuse plein écran ; ← → pour passer de l'une à l'autre, Échap pour fermer.
 */
const meta: Meta<typeof Gallery> = {
  title: "Widgets/Gallery",
  component: Gallery,
  args: { images: GALLERY_IMAGES_PLAIN },
};
export default meta;
type Story = StoryObj<typeof Gallery>;

export const Grid: Story = {
  name: "Grille",
};

/** Trois cases qui prennent plus de place — `large` (2 × 2), `wide` et `tall` — comme la vitrine
 *  d'une boutique. La grille comble les trous avec les petites qui suivent. */
export const Featured: Story = {
  name: "Mise en avant",
  args: { images: GALLERY_IMAGES, overlay: "always", minColumnWidth: 200, gap: 10 },
};

/** Chaque image garde sa proportion — portraits, panoramas — empilées en colonnes. */
export const Masonry: Story = {
  name: "Maçonnerie",
  args: { layout: "masonry" },
};

/** Trois colonnes quelle que soit la largeur, en cases carrées. */
export const FixedColumns: Story = {
  name: "Colonnes fixes",
  args: { columns: 3, aspectRatio: "1", images: GALLERY_IMAGES_PLAIN.slice(0, 9), filterable: false },
};

export const SegmentedFilter: Story = {
  name: "Filtre segmenté",
  args: { filterStyle: "segmented", defaultCategory: "Vagues" },
};

/** Titres toujours visibles ; sans `overlay`, ils n'apparaissent qu'au survol. */
export const AlwaysCaptions: Story = {
  name: "Titres toujours visibles",
  args: { overlay: "always", columns: 4 },
};

/** Sans visionneuse : le clic remonte à l'application, qui en fait ce qu'elle veut. */
export const CustomClick: Story = {
  name: "Clic personnalisé",
  render: function Render() {
    const [picked, setPicked] = useState<GalleryImage | null>(null);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Badge>{picked ? `Choisie : ${picked.title}` : "Cliquez une image"}</Badge>
        <Gallery images={GALLERY_IMAGES_PLAIN.slice(0, 8)} lightbox={false} onImageClick={setPicked} overlay="always" filterable={false} />
      </div>
    );
  },
};

/** L'application tient la catégorie : ici, un compteur lu à côté de la galerie. */
export const ControlledFilter: Story = {
  name: "Filtre contrôlé",
  render: function Render() {
    const [category, setCategory] = useState<string | null>("Paysages");
    const n = GALLERY_IMAGES_PLAIN.filter((i) => !category || i.category === category).length;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Badge>
          {category ?? "Toutes"} · {n} image{n > 1 ? "s" : ""}
        </Badge>
        <Gallery images={GALLERY_IMAGES_PLAIN} category={category} onCategoryChange={setCategory} layout="masonry" />
      </div>
    );
  },
};
