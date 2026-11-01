import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { MusicPlayerWidget } from "./MusicPlayerWidget";

const meta: Meta<typeof MusicPlayerWidget> = {
  title: "Widgets/MusicPlayerWidget",
  component: MusicPlayerWidget,
};
export default meta;
type Story = StoryObj<typeof MusicPlayerWidget>;

export const Default: Story = {
  render: () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(5);
    return (
      <div style={{ maxWidth: 320 }}>
        <MusicPlayerWidget
          title="I've Never Met Her"
          artist="Ally Salort · I've Never Met Her - Single"
          isPlaying={isPlaying}
          onPlayPause={() => setIsPlaying((p) => !p)}
          onPrev={() => {}}
          onNext={() => {}}
          volume={volume}
        />
        <div style={{ marginTop: 12 }}>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </div>
      </div>
    );
  },
};

export const AdjustableVolume: Story = {
  render: () => {
    const [isPlaying, setIsPlaying] = useState(true);
    const [volume, setVolume] = useState(35);
    const [muted, setMuted] = useState(false);
    return (
      <div style={{ maxWidth: 320 }}>
        <MusicPlayerWidget
          title="La Javanaise"
          artist="Serge Gainsbourg · Confidentiel"
          isPlaying={isPlaying}
          onPlayPause={() => setIsPlaying((p) => !p)}
          volume={volume}
          onVolumeChange={setVolume}
          muted={muted}
          onMuteChange={setMuted}
        />
      </div>
    );
  },
};
