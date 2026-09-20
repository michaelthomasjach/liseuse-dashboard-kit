import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { TileMap, type TileMapMarker } from "./TileMap";
import { PARIS_LYON_ENDPOINTS, PARIS_LYON_ROUTES } from "./routeSampleData";

const meta: Meta<typeof TileMap> = {
  title: "Map/Tile Map",
  component: TileMap,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Une carte du monde navigable : glisser pour se déplacer, molette ou boutons pour zoomer. Les tuiles viennent d'un fournisseur compatible OpenStreetMap ; celui par défaut est openstreetmap.org, qui répond sans clé.\n\nOmettre `width` ou `height` fait mesurer son conteneur à la carte, qui remplit alors la place disponible et se re-mesure quand elle change. Remplir demande que le parent ait lui-même une taille : un `height: 100%` dans une boîte aussi haute que son contenu ne vaut rien.\n\nLes tracés (`routes`) se dessinent avec un liseré de la couleur de la surface sous leur propre trait. Ce n'est pas décoratif : une ligne colorée posée telle quelle sur un fond de carte disparaît partout où elle croise une teinte voisine, et un fond de carte n'est fait que de teintes voisines.\n\nLe rendu est fait à la main sur un canvas, comme le globe et le graphe de réseau de cette bibliothèque, plutôt qu'en embarquant Leaflet ou MapLibre. Ce que cela coûte est réel : pas de style vectoriel, pas de rotation, pas de couches GeoJSON. Quand il en faut plus, une vraie bibliothèque de carte est la bonne réponse.\n\nLa mention de source est affichée par le composant et non laissée à l'intégrateur : les données OpenStreetMap sont sous ODbL, et les créditer est une condition de leur affichage.",
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

/** La carte remplit la fenêtre : ni `width` ni `height`, c'est le conteneur qui décide. */
const FULL: React.CSSProperties = { width: "100%", height: "100dvh" };

export const Navigable: Story = {
  name: "Navigation — pleine page",
  render: () => (
    <div style={FULL}>
      <TileMap center={{ lon: 6, lat: 48 }} zoom={5} />
    </div>
  ),
};

export const WithMarkers: Story = {
  name: "Avec des repères",
  render: function WithMarkersStory() {
    const [picked, setPicked] = useState<TileMapMarker | null>(null);
    return (
      <div style={{ ...FULL, position: "relative" }}>
        <TileMap center={{ lon: 4, lat: 49.5 }} zoom={5.4} markers={HUBS} onMarkerClick={setPicked} />
        <p
          style={{
            position: "absolute",
            left: 12,
            bottom: 12,
            margin: 0,
            padding: "6px 10px",
            fontSize: "0.8rem",
            background: "var(--lq-color-panel)",
            border: "1px solid var(--lq-color-border)",
          }}
        >
          {picked ? `Sélectionné : ${picked.label}` : "Cliquez un repère."}
        </p>
      </div>
    );
  },
};

/**
 * Un itinéraire et ses variantes, dans la disposition que tout le monde connaît : la liste des
 * options à gauche, la carte à droite, et la même sélection des deux côtés — cliquer une ligne ou
 * son étiquette sur la carte change la liste, et l'inverse aussi.
 */
export const Itineraire: Story = {
  name: "Itinéraire et options",
  render: function ItineraireStory() {
    const [selected, setSelected] = useState(PARIS_LYON_ROUTES[0].id);

    return (
      <div style={{ display: "grid", gridTemplateColumns: "clamp(220px, 26%, 320px) 1fr", height: "100dvh" }}>
        <aside
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: 12,
            overflowY: "auto",
            borderRight: "1px solid var(--lq-color-border)",
            background: "var(--lq-color-panel)",
          }}
        >
          <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.6 }}>
            Paris → Lyon
          </div>

          {PARIS_LYON_ROUTES.map((route) => {
            const chosen = route.id === selected;
            return (
              <button
                key={route.id}
                type="button"
                onClick={() => setSelected(route.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 2,
                  padding: "10px 12px",
                  textAlign: "left",
                  font: "inherit",
                  cursor: "pointer",
                  color: "var(--lq-color-text)",
                  background: chosen ? "color-mix(in srgb, var(--lq-color-accent) 12%, transparent)" : "transparent",
                  // Le trait à gauche reprend exactement ce que la carte fait du tracé choisi :
                  // c'est le même état, il doit se lire pareil des deux côtés.
                  borderLeft: `3px solid ${chosen ? "var(--lq-color-accent)" : "transparent"}`,
                  borderTop: "none",
                  borderRight: "none",
                  borderBottom: "1px solid var(--lq-color-border-subtle)",
                }}
              >
                <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>{route.label}</span>
                <span style={{ fontSize: "0.78rem", opacity: 0.7 }}>{route.via}</span>
              </button>
            );
          })}

          <p style={{ fontSize: "0.72rem", opacity: 0.6, lineHeight: 1.5, marginTop: "auto" }}>
            Les variantes sont dessinées sous le tracé retenu, plus fines et atténuées — la carte dit donc lequel est
            choisi sans qu'on ait à lire une légende.
          </p>
        </aside>

        <TileMap
          center={{ lon: 3.6, lat: 47.3 }}
          zoom={6.6}
          routes={PARIS_LYON_ROUTES}
          selectedRouteId={selected}
          onRouteSelect={(route) => setSelected(route.id)}
          markers={PARIS_LYON_ENDPOINTS}
          tileUrl="https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap · © CARTO"
        />
      </div>
    );
  },
};

/** Un seul tracé, sans variante : le cas « voici le chemin », pas « choisissez-en un ». */
export const TraceSimple: Story = {
  name: "Un tracé seul",
  render: () => (
    <div style={FULL}>
      <TileMap
        center={{ lon: 3.6, lat: 47.3 }}
        zoom={6.6}
        routes={[PARIS_LYON_ROUTES[0]]}
        selectedRouteId={PARIS_LYON_ROUTES[0].id}
        markers={PARIS_LYON_ENDPOINTS}
      />
    </div>
  ),
};

export const OtherProvider: Story = {
  name: "Un autre fournisseur de tuiles",
  render: () => (
    <div style={FULL}>
      {/* Tuiles CARTO, également bâties sur des données OpenStreetMap. Elles conviennent mieux à une
          interface claire : le fond standard d'OSM est saturé et une donnée posée dessus se noie.
          La mention de source change avec le fournisseur — c'est le seul réglage qui n'est pas
          cosmétique. */}
      <TileMap
        center={{ lon: 2.35, lat: 48.86 }}
        zoom={6}
        tileUrl="https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap · © CARTO"
      />
    </div>
  ),
};

export const FixedSize: Story = {
  name: "Taille fixe (width / height)",
  render: () => (
    <div style={{ padding: 16 }}>
      {/* Les deux props restent disponibles : une carte dans une grille de tableau de bord a
          souvent une taille décidée par la grille, pas par elle-même. */}
      <TileMap width={560} height={320} center={{ lon: 0, lat: 20 }} zoom={1} />
    </div>
  ),
};
