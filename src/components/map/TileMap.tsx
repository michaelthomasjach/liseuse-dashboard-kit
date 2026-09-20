import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  TILE_SIZE,
  clampLatitude,
  formatTileUrl,
  latToTileY,
  lonToTileX,
  tileYToLat,
  wrapLongitude,
} from "./tileMath";
import "./TileMap.css";

/**
 * A navigable world map: drag to pan, wheel or buttons to zoom, raster tiles from an
 * OpenStreetMap-compatible provider.
 *
 * Drawn on a canvas by hand rather than by pulling in Leaflet or MapLibre. Two reasons, and the
 * second is the one that decided it. A map library is 40 kB at its smallest and 800 kB for the
 * vector ones, which is a lot of weight in a component kit where `d3` is already a peer dependency
 * precisely so that consumers who want no charts carry none. And this library already hand-rolls
 * its heavy renderers — the globe is raw WebGL, the network is Canvas 2D — so a map that arrives
 * with its own DOM tree, its own event model and its own CSS would be the one component that does
 * not behave like the rest.
 *
 * What that costs is real and worth stating: no vector styling, no rotation, no tilt, no geocoding,
 * no GeoJSON layers. This pans, zooms and puts markers on a raster basemap. When a consumer needs
 * more than that, a map library is the right answer and this component is not.
 *
 * ## Attribution is not decoration
 *
 * OpenStreetMap data is ODbL: displaying it *requires* crediting the contributors, which is why the
 * credit is rendered by the component rather than left to the consumer to remember. `attribution`
 * can be changed to match a different provider; it cannot be emptied away, because the one thing
 * this component must not do is make it easy to publish someone's data without saying whose it is.
 *
 * ## Choosing a provider
 *
 * The default points at openstreetmap.org's own tiles, which answer without a key and are fine for
 * development and for the low volumes a dashboard produces. Their usage policy forbids heavy or
 * commercial use, so a production deployment should pass its own `tileUrl` — any
 * `{z}/{x}/{y}` raster endpoint works, including a self-hosted one.
 */

export interface TileMapMarker {
  id: string;
  lon: number;
  lat: number;
  label?: string;
  /** Any CSS colour. Falls back to the accent token. */
  color?: string;
}

export interface TileMapProps {
  width: number;
  height: number;
  /** Starting centre. The map owns its camera afterwards — see the note on `center`. */
  center?: { lon: number; lat: number };
  /** Starting zoom, 0 (whole world) to `maxZoom`. */
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  /**
   * Tile template with `{z}`, `{x}`, `{y}`, and optionally `{s}` for a subdomain.
   *
   * Read once per render rather than memoised: changing it swaps the basemap, which is exactly the
   * case a consumer switching between a light and a dark style needs to work.
   */
  tileUrl?: string;
  subdomains?: string[];
  /** Shown bottom-right. Required by the ODbL for OpenStreetMap data — see the component's doc. */
  attribution?: string;
  /**
   * CSS filter applied to the tiles, overriding the one the palette would choose.
   *
   * The annotations are drawn after it and are never filtered: a marker whose colour a consumer
   * chose must arrive on screen as that colour, whatever is being done to the basemap underneath.
   */
  tileFilter?: string;
  markers?: TileMapMarker[];
  onMarkerClick?: (marker: TileMapMarker) => void;
  /** Fires after every pan and zoom, coarsely — not on every animation frame. */
  onViewChange?: (view: { lon: number; lat: number; zoom: number }) => void;
  className?: string;
  ariaLabel?: string;
}

const DEFAULT_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_ATTRIBUTION = "© OpenStreetMap";

/** How much one wheel notch changes the zoom. Chosen to feel like a map rather than a chart. */
const WHEEL_ZOOM_RATE = 0.0025;

/**
 * What the e-ink palette does to a basemap.
 *
 * Colour is removed outright rather than desaturated: the palette has no hues to be faithful to,
 * and a map left at 20 % saturation reads as a printing fault rather than as a choice. Contrast is
 * raised because a road network flattened to grey loses the separation its colours were carrying,
 * and brightness with it so the result sits on the light side of the page like the rest of the
 * surface does.
 */
const EINK_TILE_FILTER = "grayscale(1) contrast(1.22) brightness(1.06)";

interface Camera {
  lon: number;
  lat: number;
  zoom: number;
}

function TileMapImpl({
  width,
  height,
  center = { lon: 6, lat: 42 },
  zoom = 3,
  minZoom = 0,
  maxZoom = 18,
  tileUrl = DEFAULT_TILE_URL,
  subdomains = ["a", "b", "c"],
  attribution = DEFAULT_ATTRIBUTION,
  tileFilter,
  markers = [],
  onMarkerClick,
  onViewChange,
  className,
  ariaLabel = "Carte du monde navigable",
}: TileMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /**
   * The camera lives in a ref, not in state.
   *
   * A drag produces a camera change per pointer event; putting that in state would re-render the
   * component tree sixty times a second to move pixels the canvas draws itself. The camera is read
   * by the draw loop and only *reported* outward, coarsely, through `onViewChange`.
   */
  const cameraRef = useRef<Camera>({ lon: center.lon, lat: clampLatitude(center.lat), zoom });
  const tilesRef = useRef(new Map<string, HTMLImageElement>());
  const frameRef = useRef(0);
  const dragRef = useRef({ active: false, x: 0, y: 0, moved: 0, pointerId: -1 });
  const lastReported = useRef<Camera | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  /**
   * The palette in force, read from the nearest `.lq-root` like every other themed component here.
   *
   * Observed rather than read once: the kit lets a palette be switched at runtime, and a map that
   * kept its colours after the rest of the page went to ink would be the one element betraying
   * that the theme is a coat of paint.
   */
  const [palette, setPalette] = useState<"eink" | "color">("color");

  const dpr = typeof window === "undefined" ? 1 : Math.min(2, window.devicePixelRatio || 1);

  /** Screen position of a coordinate, in CSS pixels relative to the canvas. */
  const project = useCallback(
    (lon: number, lat: number): { x: number; y: number } => {
      const { zoom: z, lon: cLon, lat: cLat } = cameraRef.current;
      const scale = TILE_SIZE * 2 ** z;
      // Longitude difference is wrapped so a marker just past the antimeridian draws on the near
      // side of the screen instead of a world away.
      const dx = wrapLongitude(lon - cLon) / 360;
      const y = latToTileY(lat, z) - latToTileY(cLat, z);
      return { x: width / 2 + dx * scale, y: height / 2 + y * TILE_SIZE };
    },
    [width, height]
  );

  /**
   * The latest `draw`, reachable from a callback that must not be rebuilt.
   *
   * `requestDraw` is memoised with no dependencies so that the tile loader's `load` listeners stay
   * stable, which means its scheduled frame would otherwise call the `draw` captured on the very
   * first render — and that one has the first render's props and palette baked in for ever. It made
   * the map ignore the theme, and it would equally have ignored new markers or a changed tile URL.
   * The indirection keeps the callback stable and the work current.
   */
  const drawRef = useRef<() => void>(() => {});
  drawRef.current = draw;

  const requestDraw = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      drawRef.current();
    });
  }, []);

  const loadTile = useCallback(
    (key: string, url: string) => {
      const cache = tilesRef.current;
      if (cache.has(key)) return cache.get(key)!;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.src = url;
      img.addEventListener("load", requestDraw, { once: true });
      // A tile that 404s stays in the cache as a broken image on purpose: without that, every
      // frame would queue the same failing request again.
      img.addEventListener("error", () => cache.set(key, img), { once: true });
      cache.set(key, img);
      return img;
    },
    [requestDraw]
  );

  function draw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { lon, lat, zoom: z } = cameraRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const filter = tileFilter ?? (palette === "eink" ? EINK_TILE_FILTER : "none");
    ctx.filter = filter;

    // Tiles only exist at whole zoom levels, so the nearest level is fetched and scaled. Rounding
    // rather than flooring keeps the drawn resolution closest to the screen's.
    const zInt = Math.max(0, Math.min(maxZoom, Math.round(z)));
    const scale = 2 ** (z - zInt);
    const size = TILE_SIZE * scale;
    const count = 2 ** zInt;

    const centreX = lonToTileX(lon, zInt);
    const centreY = latToTileY(lat, zInt);
    const originX = centreX * size - width / 2;
    const originY = centreY * size - height / 2;

    const firstX = Math.floor(originX / size);
    const firstY = Math.max(0, Math.floor(originY / size));
    const lastX = Math.floor((originX + width) / size);
    const lastY = Math.min(count - 1, Math.floor((originY + height) / size));

    for (let ty = firstY; ty <= lastY; ty++) {
      for (let tx = firstX; tx <= lastX; tx++) {
        // Horizontal wrap: the world repeats east and west, so a tile index outside [0, count)
        // maps back into range rather than being skipped, and panning never hits a void.
        const wrappedX = ((tx % count) + count) % count;
        const subdomain = subdomains[Math.abs(wrappedX + ty) % subdomains.length];
        const key = `${zInt}/${wrappedX}/${ty}`;
        const img = loadTile(key, formatTileUrl(tileUrl, zInt, wrappedX, ty, subdomain));
        if (!img.complete || img.naturalWidth === 0) continue;
        const dx = tx * size - originX;
        const dy = ty * size - originY;
        // Rounded out by a pixel: adjacent tiles drawn at fractional positions leave hairline seams
        // that read as a grid over the map.
        ctx.drawImage(img, Math.floor(dx), Math.floor(dy), Math.ceil(size) + 1, Math.ceil(size) + 1);
      }
    }

    // Back to normal before anything is written on top: markers and their labels carry meaning a
    // consumer chose, and must not be put through whatever the basemap needed.
    ctx.filter = "none";

    if (palette === "eink" && !tileFilter) {
      // Multiplying the page colour through the greys is what turns a black-and-white map into an
      // ink-on-cream one: white becomes the paper, black stays ink, and the mid-tones warm up.
      // A tint drawn *over* the tiles would instead veil them and cost the contrast just gained.
      const paper = getComputedStyle(canvas).getPropertyValue("--lq-color-bg").trim() || "#f1eee6";
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
    }

    for (const marker of markers) {
      const { x, y } = project(marker.lon, marker.lat);
      if (x < -40 || x > width + 40 || y < -40 || y > height + 40) continue;
      const isHovered = hovered === marker.id;
      ctx.beginPath();
      ctx.arc(x, y, isHovered ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = marker.color ?? "#2f5d86";
      ctx.fill();
      // A ring in the page colour, so a marker keeps an edge whatever it lands on.
      ctx.lineWidth = 2;
      ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue("--lq-color-panel").trim() || "#ffffff";
      ctx.stroke();

      if (marker.label && (isHovered || markers.length <= 12)) {
        ctx.font = "600 11px system-ui, sans-serif";
        ctx.textBaseline = "middle";
        const text = marker.label;
        const w = ctx.measureText(text).width;
        const style = getComputedStyle(canvas);
        ctx.fillStyle = style.getPropertyValue("--lq-color-panel").trim() || "#ffffff";
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x + 9, y - 9, w + 8, 18);
        ctx.globalAlpha = 1;
        ctx.fillStyle = style.getPropertyValue("--lq-color-text").trim() || "#1b1a17";
        ctx.fillText(text, x + 13, y);
      }
    }
  }

  const report = useCallback(() => {
    if (!onViewChange) return;
    const { lon, lat, zoom: z } = cameraRef.current;
    const last = lastReported.current;
    // Coarse on purpose: a consumer mirroring this into state should not receive sixty updates a
    // second describing a tenth of a degree.
    if (last && Math.abs(last.lon - lon) < 0.05 && Math.abs(last.lat - lat) < 0.05 && Math.abs(last.zoom - z) < 0.01) {
      return;
    }
    lastReported.current = { lon, lat, zoom: z };
    onViewChange({ lon, lat, zoom: z });
  }, [onViewChange]);

  const zoomBy = useCallback(
    (delta: number, anchor?: { x: number; y: number }) => {
      const camera = cameraRef.current;
      const next = Math.max(minZoom, Math.min(maxZoom, camera.zoom + delta));
      if (next === camera.zoom) return;

      if (anchor) {
        // Keep whatever is under the pointer under the pointer: convert the anchor to coordinates
        // at the old zoom, then move the centre so it lands back on the same screen position.
        const before = unproject(anchor.x, anchor.y, camera, width, height);
        camera.zoom = next;
        const after = unproject(anchor.x, anchor.y, camera, width, height);
        camera.lon = wrapLongitude(camera.lon + (before.lon - after.lon));
        camera.lat = clampLatitude(camera.lat + (before.lat - after.lat));
      } else {
        camera.zoom = next;
      }
      requestDraw();
      report();
    },
    [maxZoom, minZoom, width, height, requestDraw, report]
  );

  // ---------------------------------------------------------------- pointer
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    dragRef.current = { active: true, x: e.clientX, y: e.clientY, moved: 0, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const rect = e.currentTarget.getBoundingClientRect();

    if (!drag.active) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const hit = markers.find((m) => {
        const p = project(m.lon, m.lat);
        return Math.hypot(p.x - x, p.y - y) < 10;
      });
      const id = hit?.id ?? null;
      if (id !== hovered) {
        setHovered(id);
        requestDraw();
      }
      return;
    }

    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);

    const camera = cameraRef.current;
    const scale = TILE_SIZE * 2 ** camera.zoom;
    camera.lon = wrapLongitude(camera.lon - (dx / scale) * 360);
    // Latitude has to go through the projection rather than a linear offset: a degree of latitude
    // is a different number of pixels at the equator and at 60°, and treating it as constant makes
    // the map slide under the pointer as you drag north.
    const y = latToTileY(camera.lat, camera.zoom) - dy / TILE_SIZE;
    camera.lat = clampLatitude(tileYToLat(y, camera.zoom));
    requestDraw();
    report();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const wasDragging = drag.active;
    if (drag.pointerId >= 0) e.currentTarget.releasePointerCapture?.(drag.pointerId);
    dragRef.current = { active: false, x: 0, y: 0, moved: 0, pointerId: -1 };
    // Four pixels of slop, like the globe: a hand on a mouse drifts while clicking, and treating
    // that as a drag swallows the click.
    if (!wasDragging || drag.moved > 4 || !onMarkerClick) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = markers.find((m) => {
      const p = project(m.lon, m.lat);
      return Math.hypot(p.x - x, p.y - y) < 10;
    });
    if (hit) onMarkerClick(hit);
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    // deltaMode 1 is "lines" (Firefox); treating those as pixels makes one notch do almost nothing.
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomBy(-delta * WHEEL_ZOOM_RATE, { x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  useEffect(() => {
    const root = rootRef.current?.closest<HTMLElement>(".lq-root");
    const read = () => setPalette(root?.dataset.lqPalette === "eink" ? "eink" : "color");
    read();
    if (!root) return;
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-lq-palette"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    requestDraw();
    return () => {
      // The id has to be cleared, not just cancelled. This effect has no dependency array, so its
      // cleanup runs before every re-render; leaving a stale non-zero id behind made `requestDraw`
      // believe a frame was already pending and return early, for ever. One extra render — the one
      // reading the palette on mount — was enough to leave the canvas permanently blank.
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  });

  return (
    <div
      ref={rootRef}
      className={["lq-tilemap", className].filter(Boolean).join(" ")}
      style={{ width, height }}
      role="application"
      aria-label={ariaLabel}
    >
      <canvas
        ref={canvasRef}
        className="lq-tilemap__canvas"
        width={Math.round(width * dpr)}
        height={Math.round(height * dpr)}
        style={{ width, height, cursor: hovered ? "pointer" : "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      />

      <div className="lq-tilemap__controls">
        <button type="button" onClick={() => zoomBy(1)} aria-label="Zoomer">
          +
        </button>
        <button type="button" onClick={() => zoomBy(-1)} aria-label="Dézoomer">
          −
        </button>
      </div>

      {/* Rendered by the component, not left to the consumer: OpenStreetMap data is ODbL and
          crediting it is a condition of showing it, not a nicety. */}
      <p className="lq-tilemap__attribution">{attribution}</p>
    </div>
  );
}

/** Screen position back to coordinates. Used by the zoom anchor. */
function unproject(x: number, y: number, camera: Camera, width: number, height: number) {
  const scale = TILE_SIZE * 2 ** camera.zoom;
  const lon = wrapLongitude(camera.lon + ((x - width / 2) / scale) * 360);
  const tileY = latToTileY(camera.lat, camera.zoom) + (y - height / 2) / TILE_SIZE;
  return { lon, lat: clampLatitude(tileYToLat(tileY, camera.zoom)) };
}

export const TileMap = memo(TileMapImpl);
