import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { TileMap, type TileMapMarker } from "./TileMap";

const meta: Meta<typeof TileMap> = {
  title: "Map/Tile Map",
  component: TileMap,
  parameters: {
    docs: {
      description: {
        component:
          "Une carte du monde navigable : glisser pour se déplacer, molette ou boutons pour zoomer. Les tuiles viennent d'un fournisseur compatible OpenStreetMap ; celui par défaut est openstreetmap.org, qui répond sans clé.\n\nLe rendu est fait à la main sur un canvas, comme le globe et le graphe de réseau de cette bibliothèque, plutôt qu'en embarquant Leaflet ou MapLibre — une bibliothèque de carte pèse de 40 ko à 800 ko, et arriverait avec son propre DOM, son propre modèle d'événements et son propre CSS. Ce que cela coûte est réel : pas de style vectoriel, pas de rotation, pas de couches GeoJSON. Quand il en faut plus, une vraie bibliothèque de carte est la bonne réponse.\n\nLa mention de source est affichée par le composant et non laissée à l'intégrateur : les données OpenStreetMap sont sous ODbL, et les créditer est une condition de leur affichage.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof TileMap>;

const HUBS: TileMapMarker[] = [
  { id: "par", lon: 2.35, lat: 48.86, label: "Paris" },
  { id: "ldn", lon: -0.13, lat: 51.51, label: "Londres" },
  { id: "fra", lon: 8.68, lat: 50.11, label: "Francfort" },
  { id: "ams", lon: 4.9, lat: 52.37, label: "Amsterdam" },
  { id: "mil", lon: 9.19, lat: 45.46, label: "Milan" },
];

export const Navigable: Story = {
  name: "Navigation",
  render: () => (
    <div style={{ maxWidth: 760 }}>
      <TileMap width={760} height={420} center={{ lon: 6, lat: 48 }} zoom={4} />
    </div>
  ),
};

export const WithMarkers: Story = {
  name: "Avec des repères",
  render: function WithMarkersStory() {
    const [picked, setPicked] = useState<TileMapMarker | null>(null);
    return (
      <div style={{ maxWidth: 760 }}>
        <TileMap
          width={760}
          height={420}
          center={{ lon: 4, lat: 49.5 }}
          zoom={4.6}
          markers={HUBS}
          onMarkerClick={setPicked}
        />
        <p style={{ fontSize: "0.8rem", marginTop: 8 }}>
          {picked ? `Sélectionné : ${picked.label}` : "Cliquez un repère."}
        </p>
      </div>
    );
  },
};

export const OtherProvider: Story = {
  name: "Un autre fournisseur de tuiles",
  render: () => (
    <div style={{ maxWidth: 760 }}>
      {/* Tuiles CARTO, également bâties sur des données OpenStreetMap. Elles conviennent mieux à une
          interface claire : le fond standard d'OSM est saturé et une donnée posée dessus se noie.
          La mention de source change avec le fournisseur — c'est le seul réglage qui n'est pas
          cosmétique. */}
      <TileMap
        width={760}
        height={420}
        center={{ lon: 2.35, lat: 48.86 }}
        zoom={5}
        tileUrl="https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap · © CARTO"
      />
    </div>
  ),
};

export const WholeWorld: Story = {
  name: "Monde entier",
  render: () => (
    <div style={{ maxWidth: 760 }}>
      {/* Au zoom 1 le monde tient deux fois dans la largeur : la carte se répète d'est en ouest
          plutôt que de laisser du vide, ce qui est la seule façon de faire qu'un panoramique vers
          l'est ne bute jamais. */}
      <TileMap width={760} height={380} center={{ lon: 0, lat: 20 }} zoom={1} />
    </div>
  ),
};
