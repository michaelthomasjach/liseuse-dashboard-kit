import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { LiveTile, type LiveTileFace } from "./LiveTile";
import { Card } from "../primitives/Card";
import { Button } from "../primitives/Button";
import { IconButton } from "../primitives/IconButton";
import { ArrowDownIcon, ArrowUpIcon, CommentIcon, StarIcon } from "../icons";
import type { SurfaceTone } from "../primitives/tone";

const meta: Meta<typeof LiveTile> = {
  title: "Widgets/LiveTile",
  component: LiveTile,
};
export default meta;
type Story = StoryObj<typeof LiveTile>;

/**
 * Visuels de démonstration, générés ici : des facettes triangulaires tirées d'un petit générateur
 * déterministe, dans trois teintes. Aucune image téléchargée.
 */
function artwork(seed: number, colors: [string, string, string], width = 640, height = 480): string {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  const cols = 7;
  const rows = 5;
  const pts: [number, number][][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: [number, number][] = [];
    for (let c = 0; c <= cols; c++) {
      const jitter = r === 0 || r === rows || c === 0 || c === cols ? 0 : 0.35;
      row.push([((c + (rand() - 0.5) * jitter) / cols) * width, ((r + (rand() - 0.5) * jitter) / rows) * height]);
    }
    pts.push(row);
  }
  const polys: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const [a, b, cc, d] = [pts[r][c], pts[r][c + 1], pts[r + 1][c + 1], pts[r + 1][c]];
      for (const tri of [
        [a, b, cc],
        [a, cc, d],
      ]) {
        const fill = colors[Math.floor(rand() * 3)];
        const opacity = (0.55 + rand() * 0.45).toFixed(2);
        polys.push(`<polygon points="${tri.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="${fill}" fill-opacity="${opacity}"/>`);
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice"><rect width="100%" height="100%" fill="${colors[0]}"/>${polys.join("")}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const BLUE_ART = artwork(7, ["#2c5fa8", "#5b8fd6", "#a9c6ee"]);
const BLUE_ART_2 = artwork(31, ["#1f4c8f", "#4f86d0", "#cfe0f6"]);
const ROSE_ART = artwork(19, ["#8e8fc4", "#c2245e", "#e6487f"]);

function Quote({ symbol, change, price }: { symbol: string; change: number; price: string }) {
  const up = change >= 0;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "1rem" }}>
        {up ? <ArrowUpIcon size={16} /> : <ArrowDownIcon size={16} />}
        {up ? "+" : "−"}
        {Math.abs(change).toFixed(2)} %<span style={{ fontSize: "0.75rem", opacity: 0.76, marginLeft: 4 }}>{price}</span>
      </div>
      <div style={{ fontSize: "0.66rem", fontWeight: 600, letterSpacing: "0.04em" }}>{symbol}</div>
    </div>
  );
}

const QUOTES = (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
    <Quote symbol="AAPL" change={0.95} price="546,45" />
    <Quote symbol="YAHW" change={-0.34} price="345,34" />
    <Quote symbol="PAGES" change={0.95} price="278,87" />
  </div>
);

const EXPLORE_FACES: LiveTileFace[] = [
  {
    image: BLUE_ART,
    tag: "Explorer",
    title: "Tapez n'importe où pour lancer la recherche",
    subtitle: "En savoir plus sur le projet",
    footer: QUOTES,
  },
  {
    image: BLUE_ART_2,
    tag: "Nouveau",
    title: "Des tuiles qui se relaient toutes seules",
    subtitle: "Survolez la tuile pour la mettre en pause",
    footer: QUOTES,
  },
];

/** La grande tuile à image : étiquette, titre, sous-titre et une rangée de cours en pied. */
export const ImageTile: Story = {
  name: "Image — étiquette, titre et pied",
  render: () => (
    <div style={{ maxWidth: 650 }}>
      <LiveTile faces={EXPLORE_FACES} height={480} label="À la une" />
    </div>
  ),
};

/** Étiquette pleine (`tagVariant: "solid"`) sur une image : l'actualité. */
export const News: Story = {
  name: "Actualité — étiquette pleine",
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <LiveTile
        tone="accent"
        label="Actualités"
        interval={3500}
        faces={[
          { image: ROSE_ART, tag: "Actualité", tagVariant: "solid", title: "Bien plus à voir d'un coup d'œil.", subtitle: "En savoir plus sur le projet" },
          { image: BLUE_ART, tag: "Actualité", tagVariant: "solid", title: "Un tableau de bord qui respire.", subtitle: "Trois nouveautés cette semaine" },
        ]}
      />
    </div>
  ),
};

/** Faces sans image, sur le ton de la tuile, avec un surtitre ; les contrôles du coin ne glissent
 *  pas avec elles. */
export const DateTile: Story = {
  name: "Date — surtitre et contrôles fixes",
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <LiveTile
        tone="info"
        label="Agenda"
        controls={
          <>
            <IconButton size="sm" icon={<CommentIcon size={16} />} ariaLabel="Commenter" />
            <IconButton size="sm" icon={<StarIcon size={16} />} ariaLabel="Favori" />
          </>
        }
        faces={[
          { eyebrow: "21 janv.", title: "Une toute nouvelle page" },
          { eyebrow: "21 janv.", title: "Pensée pour une belle expérience" },
        ]}
      />
    </div>
  ),
};

function MarketFace({ align }: { align: "pre" | "detail" }) {
  if (align === "pre") {
    return (
      <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontWeight: 600 }}>Pré-ouverture : 116,85 (0,43 %)</div>
        <div style={{ marginTop: 20, fontSize: "1rem", color: "var(--lq-color-text-muted)" }}>AAPL — Apple Inc.</div>
        <div>+0,42 % · 217,51</div>
        <div style={{ marginTop: 12, fontSize: "1rem", color: "var(--lq-color-text-muted)" }}>GOOG — Alphabet Inc.</div>
        <div>+0,22 % · −2,28</div>
      </div>
    );
  }
  return (
    <div style={{ position: "absolute", inset: 0, padding: 24, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>Apple Inc.</div>
      <div style={{ fontSize: "0.85rem", color: "var(--lq-color-text-muted)" }}>NASDAQ : AAPL — 8 h 40 ET</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 600, margin: "8px 0" }}>0,15 (0,13 %)</div>
      <div>Ouverture 117,52</div>
    </div>
  );
}

/** Des nœuds React libres à la place des faces composées, sur le ton « success ». */
export const FreeFaces: Story = {
  name: "Faces libres (nœuds React)",
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <LiveTile tone="success" label="Marchés" interval={3500} faces={[<MarketFace key="pre" align="pre" />, <MarketFace key="detail" align="detail" />]} />
    </div>
  ),
};

const TONES: SurfaceTone[] = ["default", "accent", "success", "info", "danger", "warning", "dark"];

/** Le fond d'une face sans image ni couleur propre vient du ton de la tuile. */
export const Tones: Story = {
  name: "Tons",
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, maxWidth: 900 }}>
      {TONES.map((tone, i) => (
        <LiveTile
          key={tone}
          tone={tone}
          height={200}
          defaultIndex={i % 2}
          faces={[
            { tag: tone, title: "Première face", subtitle: "Sous-titre atténué" },
            { tag: tone, title: "Seconde face", subtitle: "Elle monte par le bas" },
          ]}
        />
      ))}
    </div>
  ),
};

/** `paused` contrôlé, derrière un bouton : le défilement s'arrête là où il en est. */
export const Paused: Story = {
  name: "paused — arrêt contrôlé",
  render: function Render() {
    const [paused, setPaused] = useState(true);
    const [index, setIndex] = useState(0);
    return (
      <div style={{ maxWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}>
        <LiveTile
          paused={paused}
          onIndexChange={setIndex}
          interval={1500}
          faces={[
            { eyebrow: "Face 1", title: "Le défilement est à l'arrêt" },
            { eyebrow: "Face 2", title: "Il reprend avec le bouton" },
            { eyebrow: "Face 3", title: "Et s'arrête où il en est" },
          ]}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button onClick={() => setPaused((p) => !p)}>{paused ? "Reprendre" : "Pause"}</Button>
          <span>Face affichée : {index + 1}</span>
        </div>
      </div>
    );
  },
};

/** La rangée de tuiles d'un tableau de bord : grande tuile à image, actualité, date, une carte
 *  pleine immobile et une tuile de cours. */
export const DashboardRow: Story = {
  name: "Rangée de tableau de bord",
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gridTemplateRows: "320px 320px", gap: 10, maxWidth: 1320 }}>
      <div style={{ gridRow: "span 2", display: "flex", flexDirection: "column", gap: 10 }}>
        <LiveTile faces={EXPLORE_FACES} height={480} label="À la une" />
        <Card title="Chiffre d'affaires" onRefresh={() => new Promise((r) => setTimeout(r, 1200))}>
          <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>9 534,58 €</div>
        </Card>
      </div>
      <LiveTile
        tone="accent"
        interval={3500}
        label="Actualités"
        faces={[
          { image: ROSE_ART, tag: "Actualité", tagVariant: "solid", title: "Bien plus à voir d'un coup d'œil.", subtitle: "En savoir plus sur le projet" },
          { image: BLUE_ART, tag: "Actualité", tagVariant: "solid", title: "Un tableau de bord qui respire.", subtitle: "Trois nouveautés cette semaine" },
        ]}
      />
      <LiveTile
        tone="info"
        label="Agenda"
        faces={[
          { eyebrow: "21 janv.", title: "Une toute nouvelle page" },
          { eyebrow: "21 janv.", title: "Pensée pour une belle expérience" },
        ]}
      />
      <Card tone="dark" onRefresh={() => {}}>
        <div style={{ height: 230, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div style={{ fontSize: "2.75rem", fontWeight: 500, lineHeight: 1.1 }}>30°</div>
          <div style={{ marginTop: 16 }}>Ressenti pluvieux</div>
          <div style={{ marginTop: 8, color: "var(--lq-color-text-muted)" }}>Jeudi 5 janvier</div>
        </div>
      </Card>
      <LiveTile tone="success" label="Marchés" interval={3500} faces={[<MarketFace key="pre" align="pre" />, <MarketFace key="detail" align="detail" />]} />
    </div>
  ),
};
