import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { CalendarHeatmap } from "./CalendarHeatmap";
import type { CalendarHeatmapDatum } from "./CalendarHeatmap";

const meta: Meta<typeof CalendarHeatmap> = {
  title: "Charts/CalendarHeatmap",
  component: CalendarHeatmap,
};
export default meta;
type Story = StoryObj<typeof CalendarHeatmap>;

const DAY = 86_400_000;
const END = Date.UTC(2026, 10, 15);
const key = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Pseudo-hasard reproductible : la story rend la même chose à chaque ouverture. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Un an d'usage : `rate` = part des jours où le compte passe, plus fréquent en semaine. */
function year(rate: number, seed: number): CalendarHeatmapDatum[] {
  const r = rng(seed);
  return Array.from({ length: 365 }, (_, i) => {
    const t = END - (364 - i) * DAY;
    const weekend = [0, 6].includes(new Date(t).getUTCDay());
    const on = r() < (weekend ? rate / 2 : rate);
    return { date: key(t), value: on ? Math.round(5 + r() * 120) : 0 };
  });
}

const fmt = (v: number) => `${v.toLocaleString("fr-FR")} requête${v > 1 ? "s" : ""}`;

export const Recurrent: Story = {
  name: "Compte récurrent",
  render: () => (
    <div style={{ maxWidth: 820 }}>
      <CalendarHeatmap data={year(0.75, 7)} formatValue={fmt} ariaLabel="Jours d'utilisation du site sur 12 mois" />
    </div>
  ),
};

export const Occasional: Story = {
  name: "Compte occasionnel",
  render: () => (
    <div style={{ maxWidth: 820 }}>
      <CalendarHeatmap data={year(0.08, 3)} formatValue={fmt} ariaLabel="Jours d'utilisation du site sur 12 mois" />
    </div>
  ),
};

/** Jours sans mesure (`value: null`) : simple contour, distincts d'un jour sans activité. */
export const MissingData: Story = {
  name: "Jours sans donnée",
  render: () => {
    const data = year(0.6, 11).map((d, i) => (i < 200 ? { ...d, value: null } : d));
    return (
      <div style={{ maxWidth: 820 }}>
        <CalendarHeatmap data={data} formatValue={(v) => `${v} connexions simultanées`} ariaLabel="Pic de connexions simultanées par jour" />
      </div>
    );
  },
};

/** Clic (ou Entrée) sur un jour : le jour choisi est entouré, l'application en montre le détail. */
export const Clickable: Story = {
  name: "Jour cliquable, infobulle propre",
  render: () => {
    const [day, setDay] = useState<string | null>(key(END - 3 * DAY));
    const data = year(0.5, 5).map((d) => ({
      ...d,
      tooltip: (
        <>
          <div className="lq-chart-tooltip__title">{new Date(`${d.date}T00:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}</div>
          <div>{d.value ? `${d.value} utilisateurs` : "Personne"}</div>
        </>
      ),
    }));
    return (
      <div style={{ maxWidth: 820, display: "grid", gap: 8 }}>
        <CalendarHeatmap data={data} selectedDate={day} onDateClick={setDay} color="var(--lq-color-green, var(--lq-color-accent))" ariaLabel="Utilisateurs par jour" />
        <span style={{ fontSize: 13 }}>Jour choisi : {day ?? "aucun"}</span>
      </div>
    );
  },
};

/** Largeur d'un téléphone : les cases gardent une taille lisible, le calendrier défile et s'ouvre sur les dernières semaines. */
export const Phone: Story = {
  name: "Téléphone (défilement)",
  render: () => (
    <div style={{ width: 340, border: "1px dashed var(--lq-color-border-subtle)", padding: 8 }}>
      <CalendarHeatmap data={year(0.4, 9)} formatValue={fmt} ariaLabel="Jours d'utilisation du site sur 12 mois" />
    </div>
  ),
};
