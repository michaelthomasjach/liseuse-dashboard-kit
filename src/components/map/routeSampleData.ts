import type { TileMapRoute } from "./TileMap";

/**
 * Three ways from Paris to Lyon, as a routing service would hand them over: an ordered list of
 * coordinates per route, plus the figures that go in the badge.
 *
 * Coarse on purpose — a few dozen points where a real service returns thousands. They are enough
 * to show three lines that separate, run apart and rejoin, which is the thing the overlay has to
 * draw well; shipping a real polyline would be forty kilobytes of fixture for no extra pixel of
 * behaviour. The distances and durations are the real ones for each corridor, rounded.
 */
export const PARIS_LYON_ROUTES: TileMapRoute[] = [
  {
    id: "a6",
    label: "4 h 35",
    via: "465 km · A6",
    path: [
      { lon: 2.3522, lat: 48.8566 },
      { lon: 2.4405, lat: 48.7264 },
      { lon: 2.6987, lat: 48.5271 },
      { lon: 2.9004, lat: 48.3861 },
      { lon: 3.1712, lat: 48.1951 },
      { lon: 3.2874, lat: 47.9972 },
      { lon: 3.5673, lat: 47.7982 },
      { lon: 3.7729, lat: 47.6338 },
      { lon: 3.9884, lat: 47.3216 },
      { lon: 4.3271, lat: 47.0526 },
      { lon: 4.7754, lat: 46.7803 },
      { lon: 4.8357, lat: 46.3111 },
      { lon: 4.8462, lat: 46.0512 },
      { lon: 4.8546, lat: 45.9,    },
      { lon: 4.8357, lat: 45.7578 },
    ],
  },
  {
    id: "a10-a71",
    label: "5 h 10",
    via: "520 km · A10 puis A71",
    path: [
      { lon: 2.3522, lat: 48.8566 },
      { lon: 2.2137, lat: 48.7016 },
      { lon: 1.9268, lat: 48.4469 },
      { lon: 1.7311, lat: 48.1113 },
      { lon: 1.9039, lat: 47.9029 },
      { lon: 2.1734, lat: 47.6221 },
      { lon: 2.4009, lat: 47.3, },
      { lon: 2.3968, lat: 47.0844 },
      { lon: 2.8767, lat: 46.9, },
      { lon: 3.0863, lat: 46.5629 },
      { lon: 3.4372, lat: 46.2, },
      { lon: 3.9214, lat: 45.9, },
      { lon: 4.3872, lat: 45.7797 },
      { lon: 4.8357, lat: 45.7578 },
    ],
  },
  {
    id: "n7",
    label: "6 h 50",
    via: "489 km · N7, sans péage",
    path: [
      { lon: 2.3522, lat: 48.8566 },
      { lon: 2.4699, lat: 48.6875 },
      { lon: 2.6996, lat: 48.4048 },
      { lon: 2.9463, lat: 48.1667 },
      { lon: 3.0448, lat: 47.9667 },
      { lon: 3.1215, lat: 47.6667 },
      { lon: 3.2834, lat: 47.3, },
      { lon: 3.5236, lat: 46.9895 },
      { lon: 3.9214, lat: 46.6, },
      { lon: 4.0975, lat: 46.2, },
      { lon: 4.2635, lat: 45.9875 },
      { lon: 4.5713, lat: 45.8408 },
      { lon: 4.8357, lat: 45.7578 },
    ],
  },
];

/** The two ends of the itinerary above, for a start/finish pair of markers. */
export const PARIS_LYON_ENDPOINTS = [
  { id: "start", lon: 2.3522, lat: 48.8566, label: "Paris" },
  { id: "end", lon: 4.8357, lat: 45.7578, label: "Lyon" },
];
