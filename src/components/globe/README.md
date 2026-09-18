# InteractiveGlobe

A rotating, zoomable 3D globe that draws points, great-circle flows and animated particles on the
GPU. Domain-agnostic: it takes coordinates and ids, and hands ids back on interaction.

```tsx
import { InteractiveGlobe, LqThemeProvider } from "@michaelthomasjach/liseuse-dashboard-kit";
import "@michaelthomasjach/liseuse-dashboard-kit/style.css";

<LqThemeProvider palette="color" surface="dark">
  <div style={{ height: "70vh" }}>
    <InteractiveGlobe
      autoRotate
      nodes={[
        { id: "fr", lon: 2.35, lat: 48.86, label: "France" },
        { id: "ir", lon: 51.39, lat: 35.69, label: "Iran" },
      ]}
      flows={[{ id: "oil", from: "ir", to: "fr", intensity: 0.8, bidirectional: true }]}
      onNodeClick={({ node }) => console.log(node.id)}
    />
  </div>
</LqThemeProvider>;
```

The component fills its parent, so **give the parent a height**. It has no intrinsic one.

## Why it is built this way

### WebGL, not Three.js or SVG

| Option | Verdict |
| --- | --- |
| SVG / DOM | A dot globe is ~12 000 points. That many elements re-laid-out per frame is not viable. |
| Canvas 2D | Workable, but the CPU must project all 12 000 dots **every frame**. |
| Three.js / R3F | ~600 KB plus a peer dependency this library does not otherwise need, and react-three-fiber re-introduces one React component per rendered object. |
| **Raw WebGL 1** | Chosen. Dots are a static vertex buffer; rotation is a `mat3` uniform. Per-frame CPU work is a handful of uniform writes. |

No dependency was added for any of this: `d3`, `topojson-client` and `world-atlas` were already
here for `WorldExposureMap`, and the globe reuses the same country topology for its land mask.

### Flows are interpolated on the GPU

An arc vertex carries only its two **endpoints** and its own parameter `t`. The great-circle
interpolation (slerp) and the altitude bump happen in the vertex shader. So the flow buffers are
written once when the data changes and never touched again while the camera spins — the per-frame
cost of 1 200 flows is identical to that of 5.

Particles use the same trick with `t = fract(phase + uTime * speed)`, which is why they animate
with no JavaScript running at all.

### Two canvases

WebGL draws the sphere, dots, arcs, particles and points. A 2D canvas on top draws **text only** —
glyph atlases would be the only way to do labels in GL, and the globe never shows more than a few
dozen at a time, so the atlas would buy nothing.

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `nodes` | `GlobeNode[]` | `[]` | Points, and the lookup table for flow endpoints. |
| `flows` | `GlobeFlow[]` | `[]` | Arcs. Endpoints may be node ids or `[lon, lat]`. |
| `markers` | `GlobeMarker[]` | `[]` | Secondary points above the flow layer. |
| `autoRotate` | `boolean` | `false` | Pauses on interaction, resumes ~2.5 s later. |
| `autoRotateSpeed` | `number` | `4` | Degrees of longitude per second. |
| `animateFlows` | `boolean` | `true` | False keeps arcs, stops particles. |
| `quality` | `"low" \| "medium" \| "high"` | `"high"` | Dot density; `"low"` also disables particles. |
| `maxAnimatedFlows` | `number` | `90` | Only the strongest flows get particles. |
| `labelMode` | `"none" \| "auto" \| "all"` | `"auto"` | `"auto"` thins labels per zoom tier. |
| `theme` | `GlobeTheme` | `--lq-*` tokens | Any CSS color, `var()` and `color-mix()` included. |
| `initialView` | `Partial<GlobeView>` | `{lon:10,lat:25,zoom:1}` | Read once at mount; use the ref afterwards. |
| `selectedNodeId` | `string \| null` | `null` | Ringed, and dims everything it does not touch. |
| `highlightedFlowIds` | `string[]` | `[]` | Lifted out of the dimming. |
| `interactive` | `boolean` | `true` | False = decorative: no drag, zoom or hit-testing. |
| `overlay` | `ReactNode` | — | Absolutely positioned HUD above the canvases. |
| `fallback` | `ReactNode` | — | Shown when the browser has no WebGL. |

### Events

`onNodeClick`, `onNodeHover`, `onFlowClick`, `onFlowHover` receive `{ node|flow, x, y }` where
`x`/`y` are CSS pixels relative to the globe's own box — ready to position a tooltip in `overlay`.

`onBackgroundClick` fires for a click that hit nothing. `onViewChange` is throttled (half a degree
/ 1 % zoom). `onLodChange` fires when the zoom tier changes.

### Ref handle

```ts
const ref = useRef<InteractiveGlobeHandle>(null);

ref.current.focusNode("fr", { zoom: 2.4, durationMs: 900 });
ref.current.focusLonLat(2.35, 48.86);
ref.current.setView({ zoom: 3 });   // immediate
ref.current.getView();              // { lon, lat, zoom }
ref.current.resetView();
ref.current.zoomBy(1.4);
ref.current.projectNode("fr");      // { x, y } | null when behind the globe
ref.current.getFps();
```

## Level of detail

Zoom maps onto five tiers — `world`, `regional`, `country`, `actor`, `detail`. Set `minLod` on a
node, flow or marker to hide it until the camera gets there:

```tsx
{ id: "sg", lon: 103.82, lat: 1.35, label: "Singapore", minLod: "regional" }
```

The component enforces the tiers and thins labels to fit; **what** belongs at each tier is the
product's decision, which is why `minLod` is per item rather than a policy baked in here.

## Density management

When a selection or a highlight set is active, everything outside it is drawn at ~22 % opacity
rather than hidden — the secondary material still has to be visible enough to show that it exists.
Labels are ranked (selection → hover → `weight`) and placed greedily with collision rejection, up
to a per-tier budget.

## Performance notes

- Buffers are rebuilt only when data, options or the LOD tier change — never per frame.
- `bufferSubData` reuses the existing allocation whenever the new data fits.
- A settled globe with `animateFlows={false}` issues **no draw calls at all**.
- Rendering pauses when the globe scrolls out of view (`IntersectionObserver`) or the tab is hidden.
- Device pixel ratio is capped at 2.
- `prefers-reduced-motion: reduce` disables auto-rotation and particles, `autoRotate` notwithstanding.
- Hover resolution runs at most once per frame, not once per `pointermove`.

### What is and is not measured

The structural claim — that per-frame CPU work does not grow with the flow count — follows from the
design: the arc and particle buffers are written once per data change, and a frame writes a `mat3`
and a couple of floats. There is no per-flow JavaScript in the loop to grow.

Frame rate itself is **GPU-bound and therefore machine-dependent**, and was not measured for this
release: the only automated environment available was headless Chrome, which has no GPU and
rasterises WebGL through SwiftShader in-process. Any number from there describes a software
rasteriser, not this component. Open the `StressTest` story (400 nodes / 1 200 flows) on real
hardware for a figure that means something.

## Theming

Colors default to `--lq-*` tokens, so a globe inside `<LqThemeProvider>` follows palette and
surface changes automatically — the engine watches `data-lq-palette` / `data-lq-surface` on
`.lq-root` and re-reads its colors. Override individually:

```tsx
<InteractiveGlobe theme={{ land: "#3b4a63", atmosphere: "var(--lq-color-sky)", lattice: "none" }} />
```

`lattice: "none"` drops the all-over dot lattice and leaves only landmasses.

## Limitations

- Orthographic projection only — there is no perspective camera or surface-level fly-through.
- Land dots need `getImageData`; in a webview that blocks it, the globe falls back to the lattice.
- One WebGL context per mounted globe. Browsers cap these at ~16.
