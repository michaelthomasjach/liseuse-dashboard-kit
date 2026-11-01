import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ChipGroup } from "../forms/Chip";
import { SegmentedControl } from "../primitives/SegmentedControl";
import { Lightbox, type LightboxImage, type LightboxLabels } from "./Lightbox";
import "./Gallery.css";

export interface GalleryImage extends LightboxImage {
  /** Identifiant stable : la clé React, et ce que reçoit `onImageClick`. */
  id: string;
  /** Titre court : sur l'image au survol, et en gras dans la visionneuse. */
  title?: string;
  /** Sous-titre, sous le titre au survol. */
  subtitle?: ReactNode;
  /** Une donnée courte poussée à droite du titre : un prix, une date, un compteur. */
  meta?: ReactNode;
  /** Catégorie, pour le filtre. */
  category?: string;
  /** En grille seulement : la case occupe deux colonnes (`wide`), deux rangées (`tall`) ou les deux
   *  (`large`). Ramené à une colonne quand la grille n'en a qu'une. */
  span?: "wide" | "tall" | "large";
}

export interface GalleryProps {
  images: GalleryImage[];
  /** `"grid"` (défaut) : des cases de même proportion (`aspectRatio`), recadrées, avec les `span`.
   *  `"masonry"` : chaque image garde sa proportion, empilée en colonnes. */
  layout?: "grid" | "masonry";
  /** Un nombre de colonnes fixe, ou `"auto"` (défaut) : autant que la largeur en permet, à
   *  `minColumnWidth` au moins chacune. */
  columns?: number | "auto";
  /** Largeur minimale d'une colonne en mode `"auto"`, en pixels. Défaut 220. */
  minColumnWidth?: number;
  /** Espace entre les images, en pixels. Défaut : `--lq-gallery-gap`, sinon `--lq-space-3`. */
  gap?: number;
  /** Proportion d'une case en grille, au format CSS (`"4 / 3"`, `"1"`, `"16 / 9"`). Défaut `"4 / 3"`. */
  aspectRatio?: string;
  /** Le titre, le sous-titre et `meta` sur l'image : au survol (défaut, et toujours au doigt),
   *  toujours, ou jamais. */
  overlay?: "hover" | "always" | "none";
  /** Afficher le filtre par catégorie. Défaut : dès que deux catégories au moins existent. */
  filterable?: boolean;
  /** `"chips"` (défaut) : des puces, avec le nombre d'images de chacune. `"segmented"` : un
   *  sélecteur compact, pour trois ou quatre catégories. */
  filterStyle?: "chips" | "segmented";
  /** Ordre des catégories ; à défaut, celui de leur première apparition dans `images`. */
  categories?: string[];
  /** Catégorie filtrée, `null` pour toutes. Fournie : le filtre est contrôlé. */
  category?: string | null;
  defaultCategory?: string | null;
  onCategoryChange?: (category: string | null) => void;
  /** Ouvrir la `Lightbox` au clic. Défaut `true`. Elle parcourt les images filtrées. */
  lightbox?: boolean;
  /** Bande de vignettes dans la visionneuse. Défaut `true`. */
  lightboxThumbnails?: boolean;
  lightboxLabels?: LightboxLabels;
  /** Appelé au clic sur une image, avec sa position dans la liste affichée — que la visionneuse
   *  s'ouvre ou non. Sans lui et sans visionneuse, les images ne sont pas cliquables. */
  onImageClick?: (image: GalleryImage, index: number) => void;
  /** Libellé de « toutes les catégories ». Défaut « Tout ». */
  allLabel?: string;
  /** Message quand le filtre ne laisse rien. */
  emptyText?: ReactNode;
  /** Nom de la galerie pour les lecteurs d'écran. Défaut « Galerie ». */
  ariaLabel?: string;
  className?: string;
}

const ALL = "__lq-all__";

/** Combien de colonnes, et de quelle hauteur une rangée, pour une largeur donnée. */
function measure(width: number, gap: number, columns: number | "auto", min: number, ratio: number) {
  const n = columns === "auto" ? Math.max(1, Math.floor((width + gap) / (min + gap))) : Math.max(1, Math.round(columns));
  const col = (width - gap * (n - 1)) / n;
  return { n, row: col / ratio };
}

/** `"4 / 3"` → 1,333… ; une valeur illisible retombe sur 4/3. */
function parseRatio(value: string): number {
  const [a, b] = value.split("/").map((p) => Number.parseFloat(p.trim()));
  const r = b ? a / b : a;
  return Number.isFinite(r) && r > 0 ? r : 4 / 3;
}

/**
 * Une galerie d'images : grille régulière ou maçonnerie, filtre par catégorie, titre au survol, et
 * visionneuse plein écran au clic.
 *
 * En grille, la taille des rangées se calcule d'après la largeur réelle du composant (un
 * `ResizeObserver`), pas celle de l'écran : c'est ce qui permet aux cases `wide`, `tall` et `large`
 * de tomber pile sur les autres, avec `grid-auto-flow: dense` pour boucher les trous qu'elles
 * laissent. La maçonnerie est en colonnes CSS : l'ordre de lecture (et de tabulation) descend chaque
 * colonne avant de passer à la suivante.
 */
export function Gallery({
  images,
  layout = "grid",
  columns = "auto",
  minColumnWidth = 220,
  gap,
  aspectRatio = "4 / 3",
  overlay = "hover",
  filterable,
  filterStyle = "chips",
  categories,
  category: categoryProp,
  defaultCategory = null,
  onCategoryChange,
  lightbox = true,
  lightboxThumbnails = true,
  lightboxLabels,
  onImageClick,
  allLabel = "Tout",
  emptyText = "Aucune image dans cette catégorie.",
  ariaLabel = "Galerie",
  className,
}: GalleryProps) {
  const [categoryState, setCategoryState] = useState<string | null>(defaultCategory);
  const category = categoryProp !== undefined ? categoryProp : categoryState;
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [box, setBox] = useState<{ width: number; gap: number } | null>(null);

  const cats = useMemo(() => {
    if (categories) return categories;
    const seen: string[] = [];
    for (const img of images) if (img.category && !seen.includes(img.category)) seen.push(img.category);
    return seen;
  }, [categories, images]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const img of images) if (img.category) m.set(img.category, (m.get(img.category) ?? 0) + 1);
    return m;
  }, [images]);

  const shown = useMemo(() => (category ? images.filter((img) => img.category === category) : images), [images, category]);
  const empty = shown.length === 0;
  const showFilter = (filterable ?? cats.length > 1) && cats.length > 0;
  const interactive = lightbox || !!onImageClick;

  function setCategory(next: string | null) {
    if (categoryProp === undefined) setCategoryState(next);
    onCategoryChange?.(next);
    setOpenIndex(null);
  }

  // La largeur réelle et l'écart calculé (le thème peut le régler) : de quoi caler les rangées.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || layout !== "grid") return;
    const read = () => {
      const cs = getComputedStyle(el);
      const g = Number.parseFloat(cs.columnGap) || 0;
      const w = el.clientWidth - (Number.parseFloat(cs.paddingLeft) || 0) - (Number.parseFloat(cs.paddingRight) || 0);
      setBox((prev) => (prev && Math.abs(prev.width - w) < 0.5 && prev.gap === g ? prev : { width: w, gap: g }));
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout, gap, empty]);

  const ratio = parseRatio(aspectRatio);
  const grid = layout === "grid" && box && box.width > 0 ? measure(box.width, box.gap, columns, minColumnWidth, ratio) : null;

  const style: CSSProperties = {};
  if (gap !== undefined) (style as Record<string, string>)["--lq-gallery-gap"] = `${gap}px`;
  if (layout === "grid") {
    if (grid) {
      style.gridTemplateColumns = `repeat(${grid.n}, minmax(0, 1fr))`;
      style.gridAutoRows = `${grid.row}px`;
    } else {
      // Avant la première mesure : une grille CSS ordinaire, aux cases proportionnées.
      style.gridTemplateColumns = columns === "auto" ? `repeat(auto-fill, minmax(${minColumnWidth}px, 1fr))` : `repeat(${columns}, minmax(0, 1fr))`;
    }
  } else if (columns === "auto") {
    style.columnWidth = `${minColumnWidth}px`;
  } else {
    style.columnCount = columns;
  }

  const filter = showFilter ? (
    filterStyle === "segmented" ? (
      <SegmentedControl
        label="Catégorie"
        options={[{ value: ALL, label: allLabel }, ...cats.map((c) => ({ value: c, label: c }))]}
        value={category ?? ALL}
        onChange={(v) => setCategory(v === ALL ? null : v)}
      />
    ) : (
      <ChipGroup
        label="Catégories"
        allLabel={allLabel}
        value={category}
        onChange={setCategory}
        options={cats.map((c) => ({ value: c, label: c, count: counts.get(c) ?? 0 }))}
      />
    )
  ) : null;

  return (
    <div
      className={["lq-gallery", `lq-gallery--${layout}`, `lq-gallery--overlay-${overlay}`, className].filter(Boolean).join(" ")}
    >
      {filter && <div className="lq-gallery__filters">{filter}</div>}
      {empty ? (
        <p className="lq-gallery__empty">{emptyText}</p>
      ) : (
        <ul
          ref={listRef}
          className={["lq-gallery__list", grid && "lq-gallery__list--measured"].filter(Boolean).join(" ")}
          style={{ ...style, ...(layout === "grid" && !grid ? { ["--lq-gallery-ratio" as string]: aspectRatio } : null) }}
          aria-label={ariaLabel}
        >
          {shown.map((img, i) => {
            const span = layout === "grid" && img.span ? img.span : undefined;
            const n = grid?.n ?? 2;
            const cols = span === "wide" || span === "large" ? Math.min(2, n) : 1;
            const rows = span === "tall" || span === "large" ? 2 : 1;
            const itemStyle: CSSProperties = {};
            if (cols > 1) itemStyle.gridColumn = `span ${cols}`;
            if (rows > 1) itemStyle.gridRow = `span ${rows}`;
            if (layout === "masonry" && img.width && img.height) itemStyle.aspectRatio = `${img.width} / ${img.height}`;
            const content = (
              <>
                <img
                  className="lq-gallery__image"
                  src={img.thumbnail ?? img.src}
                  alt={img.alt}
                  width={img.width}
                  height={img.height}
                  loading="lazy"
                  draggable={false}
                />
                {overlay !== "none" && (img.title || img.subtitle || img.meta) && (
                  <span className="lq-gallery__overlay" aria-hidden={interactive ? undefined : true}>
                    <span className="lq-gallery__heading">
                      {img.title && <span className="lq-gallery__title">{img.title}</span>}
                      {img.meta && <span className="lq-gallery__meta">{img.meta}</span>}
                    </span>
                    {img.subtitle && <span className="lq-gallery__subtitle">{img.subtitle}</span>}
                  </span>
                )}
              </>
            );
            return (
              <li
                key={img.id}
                className={["lq-gallery__item", span && `lq-gallery__item--${span}`].filter(Boolean).join(" ")}
                style={itemStyle}
              >
                {interactive ? (
                  <button
                    type="button"
                    className="lq-gallery__tile"
                    aria-haspopup={lightbox ? "dialog" : undefined}
                    onClick={() => {
                      onImageClick?.(img, i);
                      if (lightbox) setOpenIndex(i);
                    }}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="lq-gallery__tile">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {lightbox && (
        <Lightbox
          images={shown}
          index={openIndex ?? 0}
          open={openIndex !== null && shown.length > 0}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          thumbnails={lightboxThumbnails}
          labels={lightboxLabels}
        />
      )}
    </div>
  );
}
