import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./Card";
import { Highlight } from "./Highlight";
import { PanelRow } from "./Panel";
import { Sparkline } from "../charts/Sparkline";
import { IconButton } from "./IconButton";
import { Button } from "./Button";
import { MoreHorizontalIcon } from "../icons";
import type { SurfaceTone } from "./tone";

const meta: Meta<typeof Card> = {
  title: "Primitives/Card",
  component: Card,
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Static: Story = {
  name: "Statique (toujours visible)",
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Card title="Détail de l'ordre" meta="Exécuté">
        <PanelRow label="Type" value="Marché" />
        <PanelRow label="Frais" value="1,99 €" />
        <PanelRow label="Compte" value="PEA" />
      </Card>
    </div>
  ),
};

export const WithFooter: Story = {
  name: "Avec pied de carte",
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Card title="Frais et conditions" footer={<span style={{ fontSize: 12, opacity: 0.7 }}>Mis à jour le 11/06/2026</span>}>
        <PanelRow label="Frais de courtage" value="0,5 %" />
        <PanelRow label="Frais de tenue de compte" value="0 €" />
      </Card>
    </div>
  ),
};

export const NoHeader: Story = {
  name: "Sans en-tête",
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Card>
        <PanelRow label="Type" value="Marché" />
        <PanelRow label="Frais" value="1,99 €" />
      </Card>
    </div>
  ),
};

export const Bare: Story = {
  name: "Bare (sans bordure)",
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Card title="Résumé" bare>
        <PanelRow label="Type" value="Marché" />
      </Card>
    </div>
  ),
};

export const ExpandableOpen: Story = {
  name: "expandable — ouverte par défaut",
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Card title="Détail de l'ordre" meta="Exécuté" summary="12 AAPL @ 226,34 € — 2 714,08 €" expandable defaultOpen>
        <PanelRow label="Type" value="Marché" />
        <PanelRow label="Frais" value="1,99 €" />
        <PanelRow label="Compte" value="PEA" />
        <PanelRow label="Date" value="11/06/2026 09:34" />
      </Card>
    </div>
  ),
};

export const ExpandableCollapsed: Story = {
  name: "expandable — repliée par défaut",
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Card title="Frais et conditions" meta="voir le détail" expandable>
        <PanelRow label="Frais de courtage" value="0,5 %" />
        <PanelRow label="Frais de tenue de compte" value="0 €" />
      </Card>
    </div>
  ),
};

export const HighlightTile: Story = {
  name: "highlight — tuile KPI (Highlight)",
  render: () => (
    <div style={{ maxWidth: 220 }}>
      <Highlight title="52-week high">
        <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: 2 }}>191,22 $</div>
        <div style={{ fontSize: "0.8rem", opacity: 0.65, marginTop: 4 }}>3,6 % en dessous</div>
        <div style={{ marginTop: 12 }}>
          <Sparkline data={[142, 148, 145, 151, 157, 154, 162, 168, 165, 172, 178, 175, 183, 188, 191]} width={220} height={36} area />
        </div>
      </Highlight>
    </div>
  ),
};

const TONES: { tone: SurfaceTone; title: string; value: string; note: string }[] = [
  { tone: "default", title: "Ventes de la semaine", value: "14 000 €", note: "Sans ton : la carte ordinaire" },
  { tone: "accent", title: "Ventes de la semaine", value: "23 000 €", note: "65 % de moins que le mois dernier" },
  { tone: "success", title: "Ventes de la semaine", value: "14 000 €", note: "60 % au-dessus" },
  { tone: "info", title: "Nouveaux comptes", value: "312", note: "+18 cette semaine" },
  { tone: "danger", title: "Incidents ouverts", value: "7", note: "3 critiques" },
  { tone: "warning", title: "Charge serveur", value: "82 %", note: "Seuil d'alerte à 90 %" },
  { tone: "dark", title: "Aujourd'hui", value: "30°", note: "Ressenti pluvieux" },
];

const TREND = [12, 14, 13, 17, 16, 19, 18, 22, 21, 25];

/** Chaque ton remplit la carte de la couleur du thème du même nom ; la sparkline posée dedans passe en
 *  contraste d'elle-même, parce que la carte redéfinit l'accent pour ses enfants. */
export const Tones: Story = {
  name: "tone — tuiles pleines",
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16, maxWidth: 1040 }}>
      {TONES.map((t) => (
        <Card key={t.tone} tone={t.tone} title={t.title} meta={t.tone} onRefresh={() => {}}>
          <div style={{ fontSize: "1.75rem", fontWeight: 600 }}>{t.value}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--lq-color-text-muted)", marginTop: 4 }}>{t.note}</div>
          <div style={{ marginTop: 12 }}>
            <Sparkline data={TREND} width={200} height={36} area />
          </div>
        </Card>
      ))}
    </div>
  ),
};

/** Le petit cercle de l'en-tête : la fonction rend une promesse, la carte se voile jusqu'à ce qu'elle
 *  soit tenue (ici 1,6 s). */
export const Refresh: Story = {
  name: "onRefresh — rafraîchir (promesse)",
  render: () => (
    <div style={{ maxWidth: 400 }}>
      <Card title="Chiffre d'affaires" onRefresh={() => new Promise((resolve) => setTimeout(resolve, 1600))}>
        <PanelRow label="Webarch" value="2 563" />
        <PanelRow label="Pages" value="1 204" />
      </Card>
    </div>
  ),
};

/** `refreshing` contrôlé : le voile et l'anneau qui tourne, figés pour la capture. */
export const Refreshing: Story = {
  name: "refreshing — en cours (contrôlé)",
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 320px))", gap: 16 }}>
      <Card title="Chiffre d'affaires" onRefresh={() => {}} refreshing>
        <PanelRow label="Webarch" value="2 563" />
        <PanelRow label="Pages" value="1 204" />
      </Card>
      <Card title="Ventes de la semaine" tone="success" onRefresh={() => {}} refreshing>
        <div style={{ fontSize: "1.75rem", fontWeight: 600 }}>14 000 €</div>
      </Card>
    </div>
  ),
};

/** `controls` à côté du cercle ; sans titre, l'en-tête se réduit à ses contrôles, posés dans le coin. */
export const Controls: Story = {
  name: "controls — en-tête et coin",
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 300px))", gap: 16 }}>
      <Card title="Tableau du jour" controls={<IconButton size="sm" icon={<MoreHorizontalIcon size={16} />} ariaLabel="Plus d'options" />} onRefresh={() => {}}>
        <PanelRow label="Pages Extended" value="1 000 €" />
        <PanelRow label="Pages Support" value="12 €" />
      </Card>
      <Card onRefresh={() => {}}>
        <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>Sans titre</div>
        <div style={{ fontSize: "0.85rem", color: "var(--lq-color-text-muted)" }}>Le cercle se pose dans le coin.</div>
      </Card>
      <Card title="Détail" expandable defaultOpen onRefresh={() => {}}>
        <PanelRow label="Type" value="Marché" />
        <PanelRow label="Frais" value="1,99 €" />
      </Card>
    </div>
  ),
};

const SALES = [
  { label: "Pages Extended", value: "1 000 €" },
  { label: "Pages Support", value: "12 €" },
  { label: "Webarch", value: "2 563 €" },
  { label: "Licence équipe", value: "4 800 €" },
  { label: "Licence poste", value: "320 €" },
  { label: "Module analytique", value: "1 450 €" },
];

/** Le bouton de l'en-tête détache la carte et la pose sur toute la fenêtre ; Échap ou le même
 *  bouton la rendent à sa place, dans la grille, sans que ses voisines aient bougé. */
export const Maximizable: Story = {
  name: "maximizable — plein écran",
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 320px))", gap: 16 }}>
      <Card title="Ventes du jour" meta="6 produits" maximizable onRefresh={() => {}}>
        {SALES.map((s) => (
          <PanelRow key={s.label} label={s.label} value={s.value} />
        ))}
      </Card>
      <Card title="Tendance" maximizable controls={<IconButton size="sm" icon={<MoreHorizontalIcon size={16} />} ariaLabel="Plus d'options" />}>
        <Sparkline data={TREND} width={260} height={60} area />
      </Card>
      <Card tone="accent" maximizable>
        <div style={{ fontSize: "1.75rem", fontWeight: 600 }}>23 000 €</div>
        <div style={{ fontSize: "0.8rem", color: "var(--lq-color-text-muted)", marginTop: 4 }}>Sans titre : le bouton se pose dans le coin.</div>
      </Card>
    </div>
  ),
};

/** `maximized` contrôlé, ouvert d'emblée : la carte couvre le cadre de la story. Le bouton, Échap et
 *  le bouton extérieur passent tous par `onMaximizedChange`. */
export const MaximizedControlled: Story = {
  name: "maximized — contrôlé",
  render: function Render() {
    const [maximized, setMaximized] = useState(true);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
        <div>
          <Button onClick={() => setMaximized(true)}>Agrandir depuis l'extérieur</Button>
        </div>
        <Card title="Détail de l'ordre" meta="Exécuté" maximized={maximized} onMaximizedChange={setMaximized} footer={<span style={{ fontSize: 12, opacity: 0.7 }}>Échap pour revenir</span>}>
          <PanelRow label="Type" value="Marché" />
          <PanelRow label="Frais" value="1,99 €" />
          <PanelRow label="Compte" value="PEA" />
          <PanelRow label="Date" value="11/06/2026 09:34" />
        </Card>
      </div>
    );
  },
};
