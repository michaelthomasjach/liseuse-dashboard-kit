import { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../primitives/Button";
import { LevelMeter, type LevelMeterChannel } from "./LevelMeter";

/**
 * Un signal stéréo qui bouge comme de la musique, sans hasard : une somme de sinus d'un compteur.
 * La crête tient puis redescend de 0,7 dB par trame — c'est l'appelant qui la fait vivre, le
 * `LevelMeter` ne dessine que ce qu'on lui donne.
 */
function useSignal(running: boolean) {
  const [channels, setChannels] = useState<LevelMeterChannel[]>([
    { id: "g", label: "G", value: -24, peak: -18 },
    { id: "d", label: "D", value: -22, peak: -16 },
  ]);
  const peaks = useRef<[number, number]>([-60, -60]);
  const tick = useRef(0);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const t = ++tick.current;
      setChannels((current) =>
        current.map((c, i) => {
          const raw = -18 + 9 * Math.sin(t / 3.1 + i) + 5 * Math.sin(t / 1.3 + 2 * i) + 3 * Math.sin(t / 0.7);
          const value = Math.max(-60, Math.min(0, raw));
          peaks.current[i] = value > peaks.current[i] ? value : Math.max(value, peaks.current[i] - 0.7);
          return { ...c, value, peak: peaks.current[i] };
        })
      );
    }, 90);
    return () => window.clearInterval(id);
  }, [running]);
  return channels;
}

/**
 * Des vumètres : une barre par canal, une crête tenue, une zone chaude, un voyant d'écrêtage et, au
 * besoin, l'échelle en dB.
 */
const meta = {
  title: "Audio/LevelMeter",
  component: LevelMeter,
  parameters: {
    docs: {
      description: {
        component: [
          "Des **vumètres** : une barre par canal, une **crête** tenue au-dessus, une **zone chaude**, un **voyant d'écrêtage** et, en option, l'échelle et la valeur de chaque canal.",
          "",
          "**Quand l'utiliser** — pour un niveau qui bouge vite et dont on surveille les pointes : un signal audio, un débit, une charge en temps réel. Pour une charge face à une capacité, lue au calme, `DemandMeters` ; pour une seule valeur bornée, `ProgressBar` ou `LevelGauge`.",
          "",
          "**Un affichage, pas une mesure** — le composant dessine les nombres qu'on lui donne. La balistique — à quelle vitesse la barre retombe, combien de temps la crête tient — appartient à ce qui produit le signal : chaque hôte audio a déjà son avis là-dessus, et un vumètre qui inventerait le sien contredirait ce qu'il mesure.",
          "",
          "**Données** — chaque canal (`LevelMeterChannel`) a un `id`, une `value`, et au besoin un `label` (« G », « D », un bus) et un `peak`. Sans crête, un vumètre est illisible sur un vrai signal : la barre passe son temps sous la pointe qui comptait.",
          "",
          "**Échelle et zones** — `range` (défaut `[-60, 0]` dBFS) ; `warnAt` (−6 dB) ouvre la zone chaude, `clipAt` (−1 dB) l'écrêtage et allume le voyant. Pour un pourcentage : `range={[0, 100]}` et `unit=\"\"`.",
          "",
          "**Variantes** — `orientation` (`vertical`, la forme d'une tranche de console, ou `horizontal`), `segments` (24 blocs par défaut — le vumètre que tout le monde sait lire ; `0` pour une barre continue), `showScale`, `showValue`, `thickness` (10 px) et `length` (140 px en vertical, toute la largeur en horizontal).",
          "",
          "**Thème** — `--lq-color-fill` (niveau), `--lq-color-warning` (zone chaude), `--lq-color-danger` (écrêtage), `--lq-color-fill-track`, `--lq-color-border`, `--lq-color-bg`, `--lq-color-text`, `--lq-color-text-muted`, `--lq-radius-sm`, `--lq-space-2`.",
        ].join("\n"),
      },
    },
  },
  args: {
    channels: [
      { id: "g", label: "G", value: -14, peak: -9 },
      { id: "d", label: "D", value: -11, peak: -4 },
    ],
    orientation: "vertical",
    range: [-60, 0],
    unit: "dB",
    warnAt: -6,
    clipAt: -1,
    segments: 24,
    showScale: true,
    showValue: true,
    thickness: 10,
    length: 150,
  },
  argTypes: {
    channels: { control: "object" },
    range: { control: "object" },
    orientation: { control: "inline-radio", options: ["vertical", "horizontal"] },
    segments: { control: { type: "range", min: 0, max: 48, step: 1 } },
    thickness: { control: { type: "range", min: 4, max: 24, step: 1 } },
    length: { control: { type: "range", min: 80, max: 400, step: 10 } },
  },
} satisfies Meta<typeof LevelMeter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Défaut",
  parameters: { docs: { description: { story: "Deux canaux figés ; le droit a une crête dans la zone chaude." } } },
};

export const Live: Story = {
  name: "Signal en direct",
  render: function Render(args) {
    const [running, setRunning] = useState(true);
    const channels = useSignal(running);
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
        <LevelMeter {...args} channels={channels} />
        <Button onClick={() => setRunning((r) => !r)}>{running ? "Figer" : "Relancer"}</Button>
      </div>
    );
  },
  parameters: { docs: { description: { story: "Un signal produit par la story : c'est elle qui fait retomber les crêtes, le vumètre ne fait que dessiner." } } },
};

export const Horizontal: Story = {
  name: "Horizontal",
  args: { orientation: "horizontal", length: undefined },
  render: function Render(args) {
    const channels = useSignal(true);
    return (
      <div style={{ maxWidth: 520 }}>
        <LevelMeter {...args} channels={channels} />
      </div>
    );
  },
};

export const Continuous: Story = {
  name: "Barre continue",
  args: { segments: 0 },
  parameters: { docs: { description: { story: "`segments={0}` : une barre lisse plutôt que des blocs." } } },
};

export const Zones: Story = {
  name: "Zones et écrêtage",
  args: {
    showScale: false,
    channels: [
      { id: "a", label: "−24", value: -24, peak: -20 },
      { id: "b", label: "−8", value: -8, peak: -5 },
      { id: "c", label: "0", value: 0, peak: 0 },
    ],
  },
  parameters: { docs: { description: { story: "Un niveau sage, un niveau chaud, un niveau qui écrête : le voyant s'allume au-delà de `clipAt`." } } },
};

export const Percent: Story = {
  name: "En pourcentage",
  args: {
    range: [0, 100],
    unit: " %",
    warnAt: 80,
    clipAt: 95,
    segments: 20,
    channels: [
      { id: "cpu", label: "CPU", value: 62, peak: 71 },
      { id: "ram", label: "RAM", value: 84, peak: 86 },
      { id: "io", label: "E/S", value: 31, peak: 48 },
    ],
  },
  parameters: { docs: { description: { story: "Hors de l'audio : `range={[0, 100]}`, une unité en pour cent, des seuils à 80 et 95." } } },
};
