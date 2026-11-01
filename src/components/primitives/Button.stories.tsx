import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Button, type ButtonTone, type ButtonVariant } from "./Button";
import { StarIcon, ArrowRightIcon, BellIcon, PlusIcon, CheckIcon } from "../icons";

const meta: Meta<typeof Button> = {
  title: "Primitives/Button",
  component: Button,
  args: { children: "Allumer" },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {};
export const Selected: Story = { args: { selected: true } };
export const Block: Story = { args: { children: "Fermer", block: true, selected: true } };

export const Group: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Button selected>Blanc chaud</Button>
      <Button>Blanc doux</Button>
      <Button>Blanc neutre</Button>
      <Button>Blanc froid</Button>
      <Button>Lumière du jour</Button>
    </div>
  ),
};

export const WithIcon: Story = {
  name: "Avec icône (survolez pour l'animation)",
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Button icon={<PlusIcon size={16} />}>Nouvel ordre</Button>
      <Button icon={<ArrowRightIcon size={16} />} iconPosition="trailing">
        Voir tout
      </Button>
    </div>
  ),
};

export const ToggleMode: Story = {
  name: "Mode toggle (ton + icône d'état animée)",
  render: () => {
    const [starred, setStarred] = useState(false);
    const [alerting, setAlerting] = useState(true);
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button icon={<StarIcon size={16} />} selectedIcon={<StarIcon size={16} fill="currentColor" />} selected={starred} onClick={() => setStarred((s) => !s)}>
          {starred ? "Dans la watchlist" : "Ajouter à la watchlist"}
        </Button>
        <Button icon={<BellIcon size={16} />} selectedIcon={<CheckIcon size={16} />} selected={alerting} onClick={() => setAlerting((a) => !a)}>
          {alerting ? "Alerte active" : "Activer l'alerte"}
        </Button>
      </div>
    );
  },
};

const TONES: ButtonTone[] = ["default", "primary", "success", "info", "danger", "warning"];
const VARIANTS: ButtonVariant[] = ["solid", "outline", "ghost", "link"];

/** `tone` : la couleur d'une action (`primary` = l'accent). Un ton ne pose pas `aria-pressed`. En e-ink, tous pleins et noirs. */
export const Tones: Story = {
  name: "tone — couleurs d'action",
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {TONES.map((t) => (
        <Button key={t} tone={t}>
          {t}
        </Button>
      ))}
    </div>
  ),
};

/** `variant` : plein (défaut), bordé, fantôme, lien — croisé avec chaque ton. */
export const Variants: Story = {
  name: "variant — formes",
  render: () => (
    <div style={{ display: "grid", gap: 8 }}>
      {VARIANTS.map((v) => (
        <div key={v} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <code style={{ width: 64 }}>{v}</code>
          {TONES.map((t) => (
            <Button key={t} tone={t} variant={v}>
              {t}
            </Button>
          ))}
        </div>
      ))}
    </div>
  ),
};

/** `loading` : spinner à la place de l'icône, ou par-dessus le libellé (la largeur ne bouge pas) ; clics ignorés, `aria-busy`. */
export const Loading: Story = {
  name: "loading — occupé",
  render: function Render() {
    const [busy, setBusy] = useState(true);
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Button tone="primary" loading={busy}>
          Enregistrer
        </Button>
        <Button icon={<PlusIcon size={16} />} loading={busy}>
          Nouvel ordre
        </Button>
        <Button tone="danger" variant="outline" loading={busy}>
          Supprimer
        </Button>
        <Button variant="ghost" onClick={() => setBusy((b) => !b)}>
          {busy ? "Arrêter" : "Relancer"}
        </Button>
      </div>
    );
  },
};
