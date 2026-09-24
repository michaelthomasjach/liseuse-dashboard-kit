import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { GuidedTour, type GuidedTourStep } from "./GuidedTour";
import { HomeIcon, SettingsIcon, SparkleIcon } from "../icons";

/**
 * La visite guidée : une carte qui se déplace de cible en cible, un anneau autour de ce qu'elle
 * présente, et des étapes d'accueil centrées. La troisième étape change d'onglet avant de s'afficher
 * (`onEnter`) : la cible n'existe qu'après.
 */
const meta: Meta<typeof GuidedTour> = {
  title: "Feedback/GuidedTour",
  component: GuidedTour,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof GuidedTour>;

const box = { padding: "10px 14px", border: "1px solid var(--lq-color-border)", borderRadius: 8, background: "var(--lq-color-panel)" };

export const Accueil: Story = {
  name: "Visite d'accueil",
  render: function Render() {
    const [open, setOpen] = useState(true);
    const [tab, setTab] = useState<"plan" | "stats">("plan");
    const [done, setDone] = useState<string | null>(null);
    const steps: GuidedTourStep[] = [
      {
        id: "hello",
        title: "Bienvenue dans votre entrepôt !",
        media: <SparkleIcon size={36} />,
        body: <p>En quelques étapes, on fait le tour de ce qui compte : le plan, la palette, les chiffres.</p>,
      },
      { id: "palette", selector: "[data-tour='palette']", title: "La palette", body: "Choisissez un élément, puis cliquez sur le terrain pour le poser.", media: <HomeIcon size={22} /> },
      {
        id: "stats",
        selector: "[data-tour='stats']",
        title: "Les chiffres",
        body: "Cet onglet s'est ouvert tout seul : l'étape a préparé l'écran avant de s'afficher.",
        placement: "below",
        onEnter: () => setTab("stats"),
      },
      { id: "missing", selector: "[data-tour='nulle-part']", title: "Une cible absente", body: "Sa cible n'apparaît jamais : l'étape est montrée au milieu plutôt que sautée.", waitMs: 600 },
      { id: "settings", selector: "[data-tour='settings']", title: "Les réglages", body: "Tout se règle ici.", media: <SettingsIcon size={22} />, placement: "left", onEnter: () => setTab("plan") },
      { id: "end", title: "À vous de jouer", body: "Posez votre premier rack : la visite se relance depuis le menu d'aide." },
    ];
    return (
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, padding: 24, minHeight: "90vh" }}>
        <aside data-tour="palette" style={{ ...box, minHeight: 300 }}>
          Palette
        </aside>
        <main style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" onClick={() => setTab("plan")} aria-pressed={tab === "plan"}>
              Plan
            </button>
            <button type="button" onClick={() => setTab("stats")} aria-pressed={tab === "stats"}>
              Statistiques
            </button>
            <span style={{ flex: 1 }} />
            <button type="button" onClick={() => setOpen(true)}>
              Relancer la visite
            </button>
            <button type="button" data-tour="settings">
              Réglages
            </button>
          </div>
          {tab === "plan" ? (
            <div style={{ ...box, height: 320 }}>Le plan</div>
          ) : (
            <div data-tour="stats" style={{ ...box, height: 160, width: 360 }}>
              Statistiques
            </div>
          )}
          <p style={{ fontSize: 12, opacity: 0.7 }}>{done ?? "Échap ferme, ← et → naviguent."}</p>
        </main>
        <GuidedTour open={open} steps={steps} onClose={() => setOpen(false)} onFinish={() => setDone("Visite terminée.")} onStepChange={(i, s) => setDone(`Étape ${i + 1} : ${s.id}`)} />
      </div>
    );
  },
};
