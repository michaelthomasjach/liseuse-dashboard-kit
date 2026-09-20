import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { WysiwygEditor } from "./WysiwygEditor";
import { Card } from "../primitives/Card";
import { CodeBlock } from "../primitives/CodeBlock";

const SAMPLE = `<h2>Note de séance — 18 septembre</h2>
<p>Le portefeuille a <b>repassé son plus haut de juin</b>, porté surtout par la poche technologique.</p>
<ul><li>Renforcer la ligne <i>MSCI World</i> au prochain versement</li><li>Alléger l'exposition obligataire</li></ul>
<blockquote>On ne solde rien avant la publication des résultats du trimestre.</blockquote>`;

const meta: Meta<typeof WysiwygEditor> = {
  title: "Forms/WysiwygEditor",
  component: WysiwygEditor,
};
export default meta;
type Story = StoryObj<typeof WysiwygEditor>;

export const Default: Story = {
  name: "Défaut",
  render: () => (
    <div style={{ maxWidth: 640 }}>
      <WysiwygEditor
        label="Note"
        placeholder="Écrivez votre note…"
        helperText="Gras, italique, titres, listes, citation, lien — la barre d'outils agit sur la sélection."
        defaultValue={SAMPLE}
      />
    </div>
  ),
};

export const Vide: Story = {
  name: "Vide (placeholder)",
  render: () => (
    <div style={{ maxWidth: 640 }}>
      <WysiwygEditor label="Description" placeholder="Décrivez la stratégie en quelques lignes…" />
    </div>
  ),
};

/** `value` + `onChange` : le HTML produit est du HTML ordinaire, pas un arbre propriétaire. */
export const Controle: Story = {
  name: "Contrôlé (le HTML produit)",
  render: function Render() {
    const [html, setHtml] = useState("<p>Tapez ici et regardez le HTML dessous.</p>");
    return (
      <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
        <WysiwygEditor label="Contenu" value={html} onChange={setHtml} minHeight={140} />
        <Card title="Sortie" meta="onChange">
          <CodeBlock language="markup" code={html} />
        </Card>
      </div>
    );
  },
};

export const AvecAlignement: Story = {
  name: "Barre d'outils personnalisée (avec alignement)",
  render: () => (
    <div style={{ maxWidth: 720 }}>
      <WysiwygEditor
        label="Article"
        toolbar={[
          ["block"],
          ["bold", "italic", "underline", "strike"],
          ["alignLeft", "alignCenter", "alignRight", "alignJustify"],
          ["bulletList", "orderedList"],
          ["link", "code", "clear"],
          ["undo", "redo"],
        ]}
        defaultValue="<p>Sélectionnez ce paragraphe et essayez les quatre alignements.</p>"
      />
    </div>
  ),
};

export const Minimal: Story = {
  name: "Minimal (trois boutons)",
  render: () => (
    <div style={{ maxWidth: 480 }}>
      <WysiwygEditor
        label="Commentaire"
        toolbar={[["bold", "italic", "link"]]}
        minHeight={90}
        placeholder="Un commentaire court…"
      />
    </div>
  ),
};

export const Erreur: Story = {
  name: "État d'erreur",
  render: () => (
    <div style={{ maxWidth: 640 }}>
      <WysiwygEditor label="Description" error="La description est obligatoire." minHeight={120} placeholder="Obligatoire" />
    </div>
  ),
};

export const LectureSeule: Story = {
  name: "Lecture seule (visionneuse)",
  render: () => (
    <div style={{ maxWidth: 640 }}>
      <WysiwygEditor label="Note archivée" readOnly value={SAMPLE} />
    </div>
  ),
};

export const HauteurMax: Story = {
  name: "Hauteur maximale (défilement)",
  render: () => (
    <div style={{ maxWidth: 640 }}>
      <WysiwygEditor
        label="Journal"
        minHeight={120}
        maxHeight={220}
        defaultValue={`${SAMPLE}${SAMPLE}`}
        helperText="Au-delà de 220 px, la zone défile au lieu de pousser la page."
      />
    </div>
  ),
};

export const DansUneCarte: Story = {
  name: "Dans une carte",
  render: () => (
    <div style={{ maxWidth: 680 }}>
      <Card title="Thèse d'investissement" meta="BROUILLON">
        <WysiwygEditor
          toolbar={[["block"], ["bold", "italic"], ["bulletList", "orderedList"], ["link"]]}
          minHeight={200}
          defaultValue={SAMPLE}
        />
      </Card>
    </div>
  ),
};
