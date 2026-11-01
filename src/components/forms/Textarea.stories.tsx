import { useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Textarea } from "./Textarea";

/** La zone de texte sur plusieurs lignes, de la famille d'`Input`. */
const meta: Meta<typeof Textarea> = {
  title: "Forms/Input/Textarea",
  component: Textarea,
};
export default meta;
type Story = StoryObj<typeof Textarea>;

const wrap = (node: ReactNode) => <div style={{ maxWidth: 420 }}>{node}</div>;

export const Default: Story = {
  render: function Render() {
    const [value, setValue] = useState("");
    return wrap(<Textarea label="Description" placeholder="Décrivez la demande…" value={value} onChange={(e) => setValue(e.target.value)} />);
  },
};

export const WithHelper: Story = {
  render: () => wrap(<Textarea label="Notes internes" helperText="Visibles par l'équipe seulement." rows={4} />),
};

export const WithError: Story = {
  render: () => wrap(<Textarea label="Motif du refus" defaultValue="Trop court" error="Au moins 20 caractères" />),
};

export const Success: Story = {
  render: () => wrap(<Textarea label="Message" defaultValue="Merci pour votre retour, nous revenons vers vous sous 48 h." success="Message prêt à l'envoi" />),
};

/** `showCount` et `maxLength` : « 42 / 280 », en couleur d'alerte à 90 %. */
export const WithCount: Story = {
  render: () =>
    wrap(
      <Textarea
        label="Publication"
        maxLength={280}
        showCount
        defaultValue="La v2.4 part en production cet après-midi. Merci à tous pour la semaine de recette."
        helperText="Les mentions @ notifient les personnes citées."
      />
    ),
};

/** `autoResize` : de 1 à 6 lignes, puis le champ défile. */
export const AutoResize: Story = {
  render: function Render() {
    const [value, setValue] = useState("Tapez plusieurs lignes :\nle champ grandit avec son contenu,");
    return wrap(<Textarea label="Commentaire" autoResize minRows={1} maxRows={6} value={value} onChange={(e) => setValue(e.target.value)} />);
  },
};

export const NoResize: Story = {
  render: () => wrap(<Textarea label="Adresse de livraison" rows={3} resize="none" placeholder={"12 rue des Lilas\n75011 Paris"} />),
};

export const Disabled: Story = {
  render: () => wrap(<Textarea label="Conditions" disabled defaultValue="Ce texte ne peut pas être modifié." />),
};

export const LabelInside: Story = {
  render: () => wrap(<Textarea label="Votre message" labelPosition="inside" required rows={4} />),
};
