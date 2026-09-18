import type { GlobeLod, GlobeView } from "../types";
import { clamp, easeInOutCubic, normalizeLon, shortestLonDelta } from "./geo";

export const MIN_ZOOM = 0.75;
export const MAX_ZOOM = 9;

/**
 * Zoom thresholds for the five detail tiers. Chosen so each tier covers a visibly different amount
 * of the sphere rather than being evenly spaced: the jump from "the whole world" to "a continent"
 * happens over a much smaller zoom range than the one from "a country" to "a city".
 */
const LOD_STEPS: { max: number; lod: GlobeLod }[] = [
  { max: 1.45, lod: "world" },
  { max: 2.3, lod: "regional" },
  { max: 3.6, lod: "country" },
  { max: 5.6, lod: "actor" },
  { max: Infinity, lod: "detail" },
];

export function lodForZoom(zoom: number): GlobeLod {
  for (const step of LOD_STEPS) if (zoom <= step.max) return step.lod;
  return "detail";
}

interface Transition {
  fromLon: number;
  fromLat: number;
  fromZoom: number;
  dLon: number;
  toLat: number;
  toZoom: number;
  start: number;
  duration: number;
}

/**
 * Camera state for an orthographic globe: which lon/lat sits at the centre of the disc, and how
 * close the viewer is. Owns drag inertia and scripted transitions so the renderer's frame loop only
 * has to call `step(dt)` and read three numbers.
 */
export class GlobeCamera {
  lon: number;
  lat: number;
  zoom: number;

  autoRotate = false;
  /** Degrees of longitude per second. */
  autoRotateSpeed = 4;

  private velLon = 0;
  private velLat = 0;
  private transition: Transition | null = null;
  private readonly initial: GlobeView;
  /** Auto-rotation resumes this many ms after the last interaction, so a drag does not fight it. */
  private resumeAt = 0;

  constructor(initial: GlobeView) {
    this.initial = { ...initial };
    this.lon = initial.lon;
    this.lat = initial.lat;
    this.zoom = clamp(initial.zoom, MIN_ZOOM, MAX_ZOOM);
  }

  get lod(): GlobeLod {
    return lodForZoom(this.zoom);
  }

  getView(): GlobeView {
    return { lon: this.lon, lat: this.lat, zoom: this.zoom };
  }

  setView(view: Partial<GlobeView>) {
    this.transition = null;
    if (view.lon !== undefined) this.lon = normalizeLon(view.lon);
    if (view.lat !== undefined) this.lat = clamp(view.lat, -89, 89);
    if (view.zoom !== undefined) this.zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM);
    this.velLon = 0;
    this.velLat = 0;
  }

  /** Starts a scripted move. A duration of 0 jumps immediately. */
  flyTo(lon: number, lat: number, zoom = this.zoom, duration = 900) {
    const targetZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    const targetLat = clamp(lat, -89, 89);
    if (duration <= 0) {
      this.setView({ lon, lat: targetLat, zoom: targetZoom });
      return;
    }
    this.velLon = 0;
    this.velLat = 0;
    this.transition = {
      fromLon: this.lon,
      fromLat: this.lat,
      fromZoom: this.zoom,
      // Stored as a delta rather than an absolute target so the interpolation takes the short way
      // round the antimeridian instead of unwinding 340 degrees the other way.
      dLon: shortestLonDelta(this.lon, normalizeLon(lon)),
      toLat: targetLat,
      toZoom: targetZoom,
      start: performance.now(),
      duration,
    };
    this.pauseAutoRotate(duration + 400);
  }

  reset(duration = 900) {
    this.flyTo(this.initial.lon, this.initial.lat, this.initial.zoom, duration);
  }

  zoomBy(factor: number, duration = 260) {
    const target = clamp(this.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (duration <= 0) {
      this.zoom = target;
      return;
    }
    this.flyTo(this.lon, this.lat, target, duration);
  }

  /** Immediate zoom, for wheel input — a transition per wheel tick would feel laggy. */
  nudgeZoom(factor: number) {
    this.zoom = clamp(this.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    this.transition = null;
    this.pauseAutoRotate(2500);
  }

  /**
   * Applies a drag, in pixels. `radiusPx` is the globe's on-screen radius, which is what makes the
   * grabbed point track the cursor at any zoom instead of sliding faster the closer you get.
   */
  drag(dxPx: number, dyPx: number, radiusPx: number) {
    const degPerPx = 90 / Math.max(1, radiusPx);
    // Near the poles a horizontal drag sweeps far more longitude per pixel than near the equator;
    // damping by cos(lat) keeps the apparent speed of the surface under the cursor roughly even.
    const lonFactor = 1 / Math.max(0.25, Math.cos((this.lat * Math.PI) / 180));
    const dLon = -dxPx * degPerPx * lonFactor;
    const dLat = dyPx * degPerPx;
    this.lon = normalizeLon(this.lon + dLon);
    this.lat = clamp(this.lat + dLat, -89, 89);
    this.velLon = dLon;
    this.velLat = dLat;
    this.transition = null;
    this.pauseAutoRotate(2500);
  }

  /** Called when a drag ends, to convert the last motion into coasting. */
  release(strength = 1) {
    this.velLon *= 12 * strength;
    this.velLat *= 12 * strength;
  }

  stopInertia() {
    this.velLon = 0;
    this.velLat = 0;
  }

  pauseAutoRotate(ms: number) {
    this.resumeAt = Math.max(this.resumeAt, performance.now() + ms);
  }

  /** Advances the camera by `dt` seconds. Returns true when anything moved. */
  step(dt: number, now: number): boolean {
    let moved = false;

    if (this.transition) {
      const t = clamp((now - this.transition.start) / this.transition.duration, 0, 1);
      const e = easeInOutCubic(t);
      const tr = this.transition;
      this.lon = normalizeLon(tr.fromLon + tr.dLon * e);
      this.lat = tr.fromLat + (tr.toLat - tr.fromLat) * e;
      this.zoom = tr.fromZoom + (tr.toZoom - tr.fromZoom) * e;
      if (t >= 1) this.transition = null;
      return true;
    }

    if (this.velLon !== 0 || this.velLat !== 0) {
      this.lon = normalizeLon(this.lon + this.velLon * dt);
      this.lat = clamp(this.lat + this.velLat * dt, -89, 89);
      // Exponential decay framed in seconds, so coasting feels the same at 60 and 144 Hz.
      const decay = Math.pow(0.0025, dt);
      this.velLon *= decay;
      this.velLat *= decay;
      if (Math.abs(this.velLon) < 0.02 && Math.abs(this.velLat) < 0.02) {
        this.velLon = 0;
        this.velLat = 0;
      }
      moved = true;
    }

    if (this.autoRotate && now >= this.resumeAt && this.velLon === 0) {
      this.lon = normalizeLon(this.lon + this.autoRotateSpeed * dt);
      moved = true;
    }

    return moved;
  }

  get isSettled(): boolean {
    return !this.transition && this.velLon === 0 && this.velLat === 0 && !this.autoRotate;
  }
}
