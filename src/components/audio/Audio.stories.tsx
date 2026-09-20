import { useEffect, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { BalanceControl } from "./BalanceControl";
import { LevelMeter, type LevelMeterChannel } from "./LevelMeter";
import { Equalizer, type EqualizerBand } from "./Equalizer";
import { Card } from "../primitives/Card";
import { Button } from "../primitives/Button";

const meta: Meta = {
  title: "Audio/Balance, Niveaux, Égaliseur",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

const TEN_BANDS: EqualizerBand[] = [
  { id: "31", label: "31", gain: 0 },
  { id: "62", label: "62", gain: 2 },
  { id: "125", label: "125", gain: 3.5 },
  { id: "250", label: "250", gain: 1 },
  { id: "500", label: "500", gain: -1.5 },
  { id: "1k", label: "1 k", gain: -2 },
  { id: "2k", label: "2 k", gain: 0.5 },
  { id: "4k", label: "4 k", gain: 3 },
  { id: "8k", label: "8 k", gain: 4.5 },
  { id: "16k", label: "16 k", gain: 2.5 },
];

const FLAT = TEN_BANDS.map((b) => ({ ...b, gain: 0 }));

/** Fait vivre deux voies comme un vrai signal : le niveau bouge vite, la crête retombe lentement.
 *  C'est bien l'appelant qui possède cette mécanique — le composant, lui, ne fait que dessiner ce
 *  qu'on lui donne (voir sa propre doc). */
function useFakeSignal(active: boolean) {
  const [channels, setChannels] = useState<LevelMeterChannel[]>([
    { id: "l", label: "L", value: -60, peak: -60 },
    { id: "r", label: "R", value: -60, peak: -60 },
  ]);
  const peaks = useRef<[number, number]>([-60, -60]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setChannels((current) =>
        current.map((channel, i) => {
          const target = -34 + Math.random() * 33 + Math.sin(Date.now() / 420 + i) * 6;
          const value = Math.max(-60, Math.min(0, target));
          // La crête tient sa valeur puis redescend de 0,7 dB par trame.
          peaks.current[i] = value > peaks.current[i] ? value : Math.max(value, peaks.current[i] - 0.7);
          return { ...channel, value, peak: peaks.current[i] };
        })
      );
    }, 90);
    return () => clearInterval(id);
  }, [active]);

  return channels;
}

export const Ensemble: Story = {
  name: "Les trois ensemble",
  render: function Render() {
    const [balance, setBalance] = useState(0);
    const [bands, setBands] = useState(TEN_BANDS);
    const channels = useFakeSignal(true);

    return (
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr) 190px", alignItems: "start", maxWidth: 760 }}>
        <Card title="Égaliseur" meta="10 BANDES">
          <Equalizer bands={bands} onChange={setBands} showValues />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Button onClick={() => setBands(FLAT)}>Plat</Button>
            <Button onClick={() => setBands(TEN_BANDS)}>Rétablir</Button>
          </div>
        </Card>

        <Card title="Sortie" meta="STÉRÉO">
          <div style={{ display: "flex", justifyContent: "center", paddingBlock: 4 }}>
            <LevelMeter channels={channels} showScale showValue length={170} />
          </div>
          <div style={{ marginTop: 16 }}>
            <BalanceControl value={balance} onChange={setBalance} label="Balance" />
          </div>
        </Card>
      </div>
    );
  },
};

export const Balance: Story = {
  name: "Balance",
  render: function Render() {
    const [a, setA] = useState(0);
    const [b, setB] = useState(-38);
    const [c, setC] = useState(100);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 380 }}>
        <BalanceControl value={a} onChange={setA} label="Centrée" />
        <BalanceControl value={b} onChange={setB} label="Vers la gauche" />
        <BalanceControl value={c} onChange={setC} label="À fond à droite" />
        <BalanceControl value={20} onChange={() => {}} label="Désactivée" disabled />
        <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5, margin: 0 }}>
          Glisser ou cliquer sur la piste. Le cran au centre rattrape les valeurs proches de 0 — sans lui, on n&apos;atterrit
          jamais pile au milieu à la souris. Les flèches du clavier, elles, franchissent le cran : une flèche vaut
          exactement un pas. Double-clic (ou <code>Début</code>) pour recentrer.
        </p>
      </div>
    );
  },
};

export const BalancePersonnalisee: Story = {
  name: "Balance — extrémités et format sur mesure",
  render: function Render() {
    const [value, setValue] = useState(-25);
    return (
      <div style={{ maxWidth: 380 }}>
        <BalanceControl
          value={value}
          onChange={setValue}
          label="Répartition"
          leftLabel="Avant"
          rightLabel="Arrière"
          detent={0}
          formatValue={(v) => (v === 0 ? "50 / 50" : `${50 - v / 2} / ${50 + v / 2}`)}
        />
      </div>
    );
  },
};

export const Niveaux: Story = {
  name: "Niveaux",
  render: function Render() {
    const [running, setRunning] = useState(true);
    const channels = useFakeSignal(running);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <Button onClick={() => setRunning((r) => !r)}>{running ? "Figer" : "Relancer"}</Button>

        <div style={{ display: "flex", gap: 40, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Vertical, avec échelle et valeurs</div>
            <LevelMeter channels={channels} showScale showValue />
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Continu (segments=0)</div>
            <LevelMeter channels={channels} segments={0} showValue />
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Fin, sans crête</div>
            <LevelMeter channels={channels.map(({ peak: _peak, ...rest }) => rest)} thickness={5} length={110} />
          </div>
        </div>

        <div style={{ maxWidth: 420 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>Horizontal</div>
          <LevelMeter channels={channels} orientation="horizontal" showScale showValue />
        </div>
      </div>
    );
  },
};

/** Les zones chaude et écrêtage sont posées sur l'échelle, pas sur le signal : elles restent à la
 *  même hauteur quoi qu'il arrive, comme sur un appareil. */
export const NiveauxZones: Story = {
  name: "Niveaux — zones et écrêtage",
  render: () => (
    <div style={{ display: "flex", gap: 40 }}>
      <LevelMeter
        showScale
        showValue
        channels={[
          { id: "a", label: "−24", value: -24, peak: -20 },
          { id: "b", label: "−8", value: -8, peak: -5 },
          { id: "c", label: "−2", value: -2, peak: -0.4 },
          { id: "d", label: "0", value: 0, peak: 0 },
        ]}
      />
      <div style={{ fontSize: 12, opacity: 0.7, maxWidth: 300, lineHeight: 1.6 }}>
        Par défaut la zone chaude commence à −6 dB et l&apos;écrêtage à −1 dB. La crête retenue se lit comme un trait fin
        au-dessus de la barre ; c&apos;est à l&apos;appelant de la faire redescendre, le composant dessine ce qu&apos;on lui
        donne.
      </div>
    </div>
  ),
};

export const Egaliseur: Story = {
  name: "Égaliseur",
  render: function Render() {
    const [bands, setBands] = useState(TEN_BANDS);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
        <Equalizer bands={bands} onChange={setBands} showValues />
        <div style={{ display: "flex", gap: 8 }}>
          <Button onClick={() => setBands(FLAT)}>Plat</Button>
          <Button onClick={() => setBands(bands.map((b) => ({ ...b, gain: Math.round((Math.random() * 20 - 10) * 2) / 2 })))}>
            Au hasard
          </Button>
        </div>
        <p style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.5, margin: 0 }}>
          Glisser un curseur, ou cliquer n&apos;importe où dans sa colonne. Double-clic (ou <code>Début</code>) remet la bande
          à plat. La courbe passe par les poignées : c&apos;est la réponse que l&apos;ensemble des réglages produit, ce
          qu&apos;une rangée de curseurs indépendants ne montre pas.
        </p>
      </div>
    );
  },
};

export const EgaliseurCinqBandes: Story = {
  name: "Égaliseur — cinq bandes, ±6 dB",
  render: function Render() {
    const [bands, setBands] = useState<EqualizerBand[]>([
      { id: "low", label: "Graves", gain: 3 },
      { id: "lowmid", label: "Bas-médium", gain: -1 },
      { id: "mid", label: "Médium", gain: 0 },
      { id: "himid", label: "Haut-médium", gain: 1.5 },
      { id: "high", label: "Aigus", gain: 4 },
    ]);
    return (
      <div style={{ maxWidth: 460 }}>
        <Equalizer bands={bands} onChange={setBands} range={6} step={0.5} unit="" height={130} showValues />
      </div>
    );
  },
};

/** Sans `onChange` le composant devient un afficheur de réponse : rien ne bouge, la courbe reste. */
export const EgaliseurLectureSeule: Story = {
  name: "Égaliseur — lecture seule",
  render: () => (
    <div style={{ maxWidth: 460 }}>
      <Equalizer bands={TEN_BANDS} height={120} />
    </div>
  ),
};
