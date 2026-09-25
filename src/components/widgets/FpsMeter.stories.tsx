import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { FpsMeter } from "./FpsMeter";

/**
 * Le compteur d'images, en surimpression dans un coin. Par défaut il mesure la page ; une charge
 * artificielle (« Ralentir ») montre le passage à l'ambre puis au rouge.
 */
const meta: Meta<typeof FpsMeter> = {
  title: "Widgets/FpsMeter",
  component: FpsMeter,
};
export default meta;
type Story = StoryObj<typeof FpsMeter>;

export const Coins: Story = {
  name: "Dans les quatre coins",
  render: function Render() {
    const [load, setLoad] = useState(0);
    const [tick, setTick] = useState(0);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
          Ralentir :
          {[0, 20, 40].map((ms) => (
            <button
              key={ms}
              type="button"
              onClick={() => {
                setLoad(ms);
                setTick((t) => t + 1);
              }}
              aria-pressed={load === ms}
            >
              {ms === 0 ? "non" : `${ms} ms par image`}
            </button>
          ))}
        </div>
        <div style={{ position: "relative", height: 260, border: "1px solid var(--lq-color-border)", background: "var(--lq-color-panel)" }}>
          <FpsMeter />
          <FpsMeter position="top-left" compact />
          <FpsMeter position="top-right" showGraph={false} label="Page" />
          <FpsMeter position="bottom-left" compact showGraph={false} />
          {load > 0 && <BusyLoop key={tick} ms={load} />}
        </div>
      </div>
    );
  },
};

/** Occupe chaque image du navigateur pendant `ms` millisecondes, tant qu'elle est montée. */
function BusyLoop({ ms }: { ms: number }) {
  useEffect(() => {
    let handle = 0;
    const loop = () => {
      const until = performance.now() + ms;
      while (performance.now() < until) {
        /* on attend */
      }
      handle = requestAnimationFrame(loop);
    };
    handle = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(handle);
  }, [ms]);
  return null;
}
