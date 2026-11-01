import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ProfilePage } from "./ProfilePage";
import { Button } from "../components/primitives/Button";
import { Card } from "../components/primitives/Card";
import { Checkbox } from "../components/forms/Checkbox";
import { Badge } from "../components/finance/Badge";
import { Avatar } from "../components/finance/Avatar";
import { DEMO_AVATAR, DEMO_BANNER } from "../test-data/pagesData";

const meta: Meta<typeof ProfilePage> = {
  title: "Pages/ProfilePage",
  component: ProfilePage,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof ProfilePage>;

const ABOUT = (
  <div style={{ display: "grid", gap: 12, lineHeight: 1.6 }}>
    <p style={{ margin: 0 }}>
      Responsable produit depuis 2019, Claire pilote l'espace client et le tableau de bord des conseillers. Avant cela, huit ans de conseil en organisation
      pour des réseaux bancaires.
    </p>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Badge>Recherche utilisateur</Badge>
      <Badge>Accessibilité</Badge>
      <Badge>Tableaux de bord</Badge>
    </div>
  </div>
);

const ACTIVITY = (
  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
    {[
      ["Aujourd'hui, 9 h 12", "a publié la feuille de route du quatrième trimestre"],
      ["Hier, 17 h 40", "a commenté « Refonte de l'écran des virements »"],
      ["28 octobre", "a fermé 14 tickets du lot « Exports »"],
    ].map(([when, what]) => (
      <li key={when} style={{ display: "grid", gap: 2 }}>
        <span style={{ fontSize: "0.8rem", color: "var(--lq-color-text-muted)" }}>{when}</span>
        <span>Claire {what}</span>
      </li>
    ))}
  </ul>
);

function Settings() {
  const [mail, setMail] = useState(true);
  const [digest, setDigest] = useState(false);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Checkbox checked={mail} onChange={setMail} label="Recevoir un e-mail à chaque mention" />
      <Checkbox checked={digest} onChange={setDigest} label="Résumé hebdomadaire le lundi matin" />
    </div>
  );
}

const STATS = [
  { label: "Abonnés", value: "1 284" },
  { label: "Projets", value: 37 },
  { label: "Ancienneté", value: "6 ans" },
];

const INFO = [
  { label: "E-mail", value: "claire.lemoine@exemple.fr" },
  { label: "Téléphone", value: "06 12 34 56 78" },
  { label: "Équipe", value: "Produit" },
  { label: "Arrivée", value: "mars 2019" },
];

const TEAM = (
  <Card title="Équipe">
    <div style={{ display: "grid", gap: 10 }}>
      {["Hugo Martin", "Inès Benali", "Paul Roux"].map((n) => (
        <div key={n} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={n} size={28} />
          <span>{n}</span>
        </div>
      ))}
    </div>
  </Card>
);

const ACTIONS = (
  <>
    <Button>Message</Button>
    <Button selected>Suivre</Button>
  </>
);

export const Default: Story = {
  render: () => (
    <ProfilePage
      name="Claire Lemoine"
      role="Responsable produit chez Lemoine & Associés"
      location="Lyon, France"
      bio="Je fabrique des outils que les conseillers ont envie d'ouvrir le matin."
      avatarSrc={DEMO_AVATAR}
      actions={ACTIONS}
      stats={STATS}
      about={ABOUT}
      activity={ACTIVITY}
      settings={<Settings />}
      info={INFO}
      sidebar={TEAM}
    />
  ),
};

export const ImageBanner: Story = {
  render: () => (
    <ProfilePage
      name="Claire Lemoine"
      role="Responsable produit"
      location="Lyon, France"
      avatarSrc={DEMO_AVATAR}
      bannerSrc={DEMO_BANNER}
      actions={ACTIONS}
      stats={STATS}
      about={ABOUT}
      activity={ACTIVITY}
      info={INFO}
    />
  ),
};

export const ColorBanner: Story = {
  render: () => (
    <ProfilePage
      name="Hugo Martin"
      role="Développeur front"
      bannerColor="var(--lq-color-fill-track)"
      actions={<Button>Modifier le profil</Button>}
      about={<p style={{ margin: 0 }}>Un seul onglet fourni : pas de barre d'onglets, le contenu s'affiche directement.</p>}
    />
  ),
};

export const InFrame: Story = {
  render: () => (
    <div style={{ width: 420, height: 640, overflow: "auto", border: "1px solid var(--lq-color-border)" }}>
      <ProfilePage
        name="Claire Lemoine"
        role="Responsable produit"
        location="Lyon, France"
        avatarSrc={DEMO_AVATAR}
        actions={ACTIONS}
        stats={STATS}
        about={ABOUT}
        activity={ACTIVITY}
        info={INFO}
      />
    </div>
  ),
};
