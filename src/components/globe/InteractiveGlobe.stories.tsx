import { useMemo, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { InteractiveGlobe } from "./InteractiveGlobe";
import type { GlobeFlow, GlobeNode, InteractiveGlobeHandle } from "./types";
import { Button } from "../primitives/Button";
import { Panel } from "../primitives/Panel";

const meta: Meta<typeof InteractiveGlobe> = {
  title: "Map/Interactive Globe",
  component: InteractiveGlobe,
  parameters: { layout: "fullscreen" },
};
export default meta;

type Story = StoryObj<typeof InteractiveGlobe>;

const CITIES: GlobeNode[] = [
  { id: "us", lon: -77.04, lat: 38.91, label: "United States", weight: 10, size: 7 },
  { id: "fr", lon: 2.35, lat: 48.86, label: "France", weight: 9, size: 6 },
  { id: "de", lon: 13.4, lat: 52.52, label: "Germany", weight: 8, size: 6 },
  { id: "cn", lon: 116.4, lat: 39.9, label: "China", weight: 10, size: 7 },
  { id: "jp", lon: 139.69, lat: 35.69, label: "Japan", weight: 7, size: 6 },
  { id: "in", lon: 77.21, lat: 28.61, label: "India", weight: 7, size: 6 },
  { id: "ir", lon: 51.39, lat: 35.69, label: "Iran", weight: 6, size: 5 },
  { id: "qa", lon: 51.53, lat: 25.29, label: "Qatar", weight: 5, size: 5 },
  { id: "sa", lon: 46.72, lat: 24.71, label: "Saudi Arabia", weight: 6, size: 5 },
  { id: "ru", lon: 37.62, lat: 55.75, label: "Russia", weight: 7, size: 6 },
  { id: "ng", lon: 3.38, lat: 6.52, label: "Nigeria", weight: 4, size: 5, minLod: "regional" },
  { id: "br", lon: -47.93, lat: -15.78, label: "Brazil", weight: 6, size: 6 },
  { id: "sg", lon: 103.82, lat: 1.35, label: "Singapore", weight: 5, size: 5, minLod: "regional" },
  { id: "no", lon: 10.75, lat: 59.91, label: "Norway", weight: 4, size: 5, minLod: "regional" },
  { id: "nl", lon: 4.9, lat: 52.37, label: "Netherlands", weight: 5, size: 5, minLod: "regional" },
];

const LINKS: GlobeFlow[] = [
  { id: "ir-fr", from: "ir", to: "fr", intensity: 0.75, bidirectional: true },
  { id: "qa-fr", from: "qa", to: "fr", intensity: 0.62 },
  { id: "us-fr", from: "us", to: "fr", intensity: 0.9, bidirectional: true },
  { id: "cn-de", from: "cn", to: "de", intensity: 0.85 },
  { id: "cn-fr", from: "cn", to: "fr", intensity: 0.7 },
  { id: "sa-jp", from: "sa", to: "jp", intensity: 0.66 },
  { id: "ru-cn", from: "ru", to: "cn", intensity: 0.58 },
  { id: "br-cn", from: "br", to: "cn", intensity: 0.5 },
  { id: "ng-in", from: "ng", to: "in", intensity: 0.42, style: "dashed" },
  { id: "no-nl", from: "no", to: "nl", intensity: 0.45 },
  { id: "sg-us", from: "sg", to: "us", intensity: 0.55, style: "dashed" },
];

export const Default: Story = {
  render: () => (
    <div style={{ height: "100vh", background: "var(--lq-color-bg)" }}>
      <InteractiveGlobe autoRotate nodes={CITIES} flows={LINKS} />
    </div>
  ),
};

/** Click a point to select it; everything it does not touch drops back. */
export const Selection: Story = {
  render: function SelectionStory() {
    const [selected, setSelected] = useState<string | null>("fr");
    const ref = useRef<InteractiveGlobeHandle>(null);
    const node = CITIES.find((c) => c.id === selected);

    return (
      <div style={{ height: "100vh", background: "var(--lq-color-bg)", position: "relative" }}>
        <InteractiveGlobe
          ref={ref}
          nodes={CITIES}
          flows={LINKS}
          selectedNodeId={selected}
          onNodeClick={({ node: n }) => {
            setSelected(n.id);
            ref.current?.focusNode(n.id, { zoom: 2 });
          }}
          onBackgroundClick={() => setSelected(null)}
          overlay={
            node && (
              <div style={{ position: "absolute", top: 24, right: 24, width: 260 }}>
                <Panel title={node.label} meta={`${node.lat.toFixed(1)}°, ${node.lon.toFixed(1)}°`}>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--lq-color-text-muted)" }}>
                    {LINKS.filter((l) => l.from === node.id || l.to === node.id).length} linked flows
                  </p>
                  <div style={{ marginTop: 12 }}>
                    <Button onClick={() => ref.current?.resetView()}>Reset view</Button>
                  </div>
                </Panel>
              </div>
            )
          }
        />
      </div>
    );
  },
};

/**
 * 400 nodes and 1 200 flows. The frame counter in the corner is the point of this story: the arc
 * and particle buffers are written once and then advanced entirely on the GPU, so spinning this is
 * no more expensive than spinning an empty globe.
 */
export const StressTest: Story = {
  render: function StressStory() {
    const ref = useRef<InteractiveGlobeHandle>(null);
    const [fps, setFps] = useState(0);

    const { nodes, flows } = useMemo(() => {
      const n: GlobeNode[] = [];
      for (let i = 0; i < 400; i++) {
        // Deterministic pseudo-random placement — a fixed scene makes runs comparable.
        const a = i * 2.399963;
        n.push({
          id: `n${i}`,
          lon: ((a * 57.2958) % 360) - 180,
          lat: Math.asin(1 - (2 * (i + 0.5)) / 400) * 57.2958,
          size: 3,
          minLod: i % 4 === 0 ? "world" : "regional",
        });
      }
      const f: GlobeFlow[] = [];
      for (let i = 0; i < 1200; i++) {
        f.push({
          id: `f${i}`,
          from: `n${i % 400}`,
          to: `n${(i * 7 + 13) % 400}`,
          intensity: ((i % 10) + 1) / 10,
          style: i % 5 === 0 ? "dashed" : "solid",
        });
      }
      return { nodes: n, flows: f };
    }, []);

    return (
      <div style={{ height: "100vh", background: "var(--lq-color-bg)" }}>
        <InteractiveGlobe
          ref={ref}
          autoRotate
          nodes={nodes}
          flows={flows}
          labelMode="none"
          onViewChange={() => setFps(ref.current?.getFps() ?? 0)}
          overlay={
            <div
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                font: "600 12px var(--lq-font-mono)",
                color: "var(--lq-color-text-muted)",
              }}
            >
              {nodes.length} nodes · {flows.length} flows · {fps} fps
            </div>
          }
        />
      </div>
    );
  },
};

/** No interaction, no labels — the globe as a background element. */
export const Decorative: Story = {
  render: () => (
    <div style={{ height: "100vh", background: "var(--lq-color-bg)" }}>
      <InteractiveGlobe
        autoRotate
        autoRotateSpeed={2}
        interactive={false}
        labelMode="none"
        quality="medium"
        nodes={CITIES}
        flows={LINKS}
      />
    </div>
  ),
};
