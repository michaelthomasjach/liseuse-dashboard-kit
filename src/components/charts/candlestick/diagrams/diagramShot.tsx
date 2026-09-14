import { useEffect, useState, type ComponentType } from "react";
import { DiagramImage } from "./DiagramPrimitives";

/** The whole set of captures, as one module — ~9 MB of inlined JPEG.
 *
 *  A dynamic import, never a static one, and this is the reason: Vite inlines every asset as a
 *  base64 data URI in library mode (see vite.config.lib.ts's own note on why), so importing the
 *  registry directly put all sixty-nine pictures into the main bundle, which went from 1.5 MB to
 *  11 MB. Same treatment `propShotImages` already gets, for the same reason: this is a reference
 *  most consumers load without ever opening.
 *
 *  Cached at module scope so the second modal opened in a session pays nothing. */
let cache: Record<string, string> | null = null;
let pending: Promise<Record<string, string>> | null = null;

function loadShots(): Promise<Record<string, string>> {
  if (cache) return Promise.resolve(cache);
  pending ??= import("./diagramShotImages").then((m) => {
    cache = m.DIAGRAM_SHOT_IMAGES;
    return cache;
  });
  return pending;
}

/** One captured illustration, as a component the info modals can render.
 *
 *  A component rather than a bare `src` because that is the shape both registries already had, and
 *  because it keeps the alt text next to the id it describes. It renders nothing until the images
 *  land — and nothing at all for an id the capture run never produced, so a missing shot leaves a
 *  gap in the modal rather than a torn picture in it. */
export function diagramShot(id: string, alt: string): ComponentType {
  function Shot() {
    const [src, setSrc] = useState<string | null>(cache?.[id] ?? null);
    useEffect(() => {
      if (src !== null) return;
      let cancelled = false;
      void loadShots().then((shots) => {
        if (!cancelled) setSrc(shots[id] ?? null);
      });
      return () => {
        cancelled = true;
      };
    }, [src]);
    return src === null ? null : <DiagramImage src={src} alt={alt} />;
  }
  Shot.displayName = `DiagramShot(${id})`;
  return Shot;
}
