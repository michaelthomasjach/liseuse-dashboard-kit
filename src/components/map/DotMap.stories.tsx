import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { DotMap, type DotMapMarker, type DotMapProjection } from "./DotMap";
import { Card } from "../primitives/Card";

const meta: Meta<typeof DotMap> = {
  title: "Map/Dot Map",
  component: DotMap,
};
export default meta;
type Story = StoryObj<typeof DotMap>;

const CITIES: DotMapMarker[] = [
  { id: "paris", lat: 48.86, lon: 2.35, label: "Paris", details: "Siège — 120 personnes" },
  { id: "nyc", lat: 40.71, lon: -74.0, label: "New York", details: "Bureau commercial" },
  { id: "lagos", lat: 6.52, lon: 3.38, label: "Lagos", details: "Entrepôt régional" },
  { id: "tokyo", lat: 35.68, lon: 139.69, label: "Tokyo", details: "Partenaire" },
  { id: "sydney", lat: -33.87, lon: 151.21, label: "Sydney", details: "Support Asie-Pacifique" },
];

/** Le monde entier, sans ton : des points discrets sur le fond du panneau. Cliquez un repère. */
export const World: Story = {
  name: "Monde entier",
  render: () => (
    <div style={{ maxWidth: 860 }}>
      <DotMap markers={CITIES} height={420} label="Implantations" />
    </div>
  ),
};

/** Le bloc « géolocalisation » d'un tableau de bord : ton plein, Mercator cadré sur l'Amérique du
 *  Nord, infobulle ouverte d'emblée. */
export const NorthAmerica: Story = {
  name: "Amérique du Nord — ton plein",
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "260px 584px", maxWidth: 844 }}>
      <Card title="Géolocalisation" bare>
        <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>États-Unis</div>
        <div style={{ color: "var(--lq-color-text-muted)", fontSize: "0.85rem" }}>3 sites actifs</div>
      </Card>
      <DotMap
        tone="success"
        projection="mercator"
        bounds={[
          [-165, 12],
          [-52, 72],
        ]}
        height={465}
        defaultSelectedId="usa"
        markers={[
          { id: "usa", lat: 39, lon: -98, label: "Localisation", details: "Amérique du Nord" },
          { id: "mex", lat: 19.43, lon: -99.13, label: "Mexico", details: "Amérique centrale" },
        ]}
        label="Géolocalisation"
      />
    </div>
  ),
};

/** Points carrés, plus serrés et plus petits ; projection équirectangulaire, Antarctique comprise. */
export const SquareDots: Story = {
  name: "dotShape=\"square\", pas serré",
  render: () => (
    <div style={{ maxWidth: 860 }}>
      <DotMap dotShape="square" dotSpacing={4} dotSize={2} height={380} projection="equirectangular" antarctica markers={CITIES.slice(0, 2)} />
    </div>
  ),
};

/** Couleurs libres par `background` et `dotColor` — n'importe quelle couleur CSS, variables du thème
 *  comprises. */
export const CustomColors: Story = {
  name: "background et dotColor",
  render: () => (
    <div style={{ maxWidth: 860 }}>
      <DotMap
        background="var(--lq-color-text)"
        dotColor="color-mix(in srgb, var(--lq-color-panel) 55%, transparent)"
        height={380}
        dotSpacing={7}
        dotSize={4}
        markers={CITIES.map((c) => ({ ...c, color: "var(--lq-color-danger)" }))}
      />
    </div>
  ),
};

const PROJECTIONS: DotMapProjection[] = ["naturalEarth", "equalEarth", "equirectangular", "mercator"];

/** Les quatre projections nommées, sur le même cadrage : le monde. */
export const Projections: Story = {
  name: "Projections",
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, maxWidth: 900 }}>
      {PROJECTIONS.map((p) => (
        <figure key={p} style={{ margin: 0 }}>
          <DotMap projection={p} tone="accent" height={220} dotSpacing={5} dotSize={2.5} />
          <figcaption style={{ fontSize: "0.8rem", marginTop: 4 }}>{p}</figcaption>
        </figure>
      ))}
    </div>
  ),
};

/** `center` et `zoom` à la place de `bounds` ; sélection contrôlée par l'application. */
export const CenterZoom: Story = {
  name: "center et zoom — sélection contrôlée",
  render: function Render() {
    const [selected, setSelected] = useState<string | null>("paris");
    return (
      <div style={{ maxWidth: 720 }}>
        <DotMap
          projection="mercator"
          center={[10, 50]}
          zoom={4}
          tone="dark"
          height={360}
          markers={[
            { id: "paris", lat: 48.86, lon: 2.35, label: "Paris", details: "Siège" },
            { id: "berlin", lat: 52.52, lon: 13.4, label: "Berlin", details: "Bureau" },
            { id: "madrid", lat: 40.42, lon: -3.7, label: "Madrid", details: "Bureau" },
          ]}
          selectedId={selected}
          onSelect={setSelected}
        />
        <p>Repère choisi : {selected ?? "aucun"}</p>
      </div>
    );
  },
};
