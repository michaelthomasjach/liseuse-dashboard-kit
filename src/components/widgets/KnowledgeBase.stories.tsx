import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { KnowledgeBase, type KnowledgeEntry } from "./KnowledgeBase";

/**
 * Le guide d'un jeu de gestion d'entrepôt. Essayez « tranformateur » (une faute), « energie » (sans
 * accent), « quai camion » (deux mots, tous deux requis), ou un début de mot : « prép ».
 */
const meta: Meta<typeof KnowledgeBase> = {
  title: "Widgets/KnowledgeBase",
  component: KnowledgeBase,
};
export default meta;
type Story = StoryObj<typeof KnowledgeBase>;

const ENTRIES: KnowledgeEntry[] = [
  {
    id: "goal",
    title: "Le but du jeu",
    category: "Bases",
    keywords: ["objectif", "gagner", "score"],
    summary: "Faire tourner un entrepôt rentable : recevoir, stocker, préparer et expédier les commandes à temps.",
    paragraphs: ["Chaque commande livrée à l'heure rapporte sa recette et de la réputation. Une commande en retard rapporte moins, et la réputation baisse."],
    tips: ["Commencez petit : un quai, quelques racks, un poste d'emballage."],
    related: ["dock", "picking"],
  },
  {
    id: "dock",
    title: "Les quais",
    category: "Transport",
    keywords: ["camion", "semi-remorque", "réception", "expédition", "truck"],
    summary: "Là où les camions se mettent à quai, en marche arrière, pour être chargés ou déchargés.",
    paragraphs: ["Un quai sert à la réception ou à l'expédition. Plus il a de places, plus il traite de camions à la fois.", "Aux heures de pointe, les camions arrivent au pas : prévoyez de la marge."],
    tips: ["Un transpalette au quai double le débit de chargement.", "Les camions électriques livrent de nuit sans gêner le voisinage."],
    related: ["goal", "energy"],
  },
  {
    id: "picking",
    title: "La préparation de commandes",
    category: "Stockage",
    keywords: ["picking", "préparateur", "commande", "colis"],
    summary: "Aller chercher les articles d'une commande dans les rayons et les réunir en colis.",
    paragraphs: ["Le temps de préparation dépend de la distance parcourue : rapprochez les articles qui partent le plus souvent du poste d'emballage."],
    related: ["goal"],
  },
  {
    id: "energy",
    title: "L'énergie",
    category: "Énergie",
    keywords: ["électricité", "facture", "transformateur", "solaire", "kWh"],
    summary: "L'entrepôt consomme : éclairage de fond, machines et froid. Le prix du kWh change avec l'heure.",
    paragraphs: ["Un transformateur trop petit bride les machines. Des panneaux solaires en toiture réduisent la facture de jour."],
    tips: ["Faites tourner la chambre froide en heures creuses."],
    related: ["cold"],
  },
  {
    id: "cold",
    title: "La chambre froide",
    category: "Stockage",
    keywords: ["froid", "frais", "surgelé", "négatif", "positif"],
    summary: "Pour stocker les produits frais (positive) ou surgelés (négative).",
    paragraphs: ["Une chambre froide consomme beaucoup : elle représente souvent la moitié de la facture d'énergie."],
    related: ["energy"],
  },
];

export const Guide: Story = {
  name: "Le guide du jeu",
  render: () => (
    <div style={{ height: 560 }}>
      <KnowledgeBase entries={ENTRIES} placeholder="Rechercher : quai, transformateur, froid…" />
    </div>
  ),
};

/** L'application tient l'entrée ouverte et la requête : un bouton ouvre le guide sur « L'énergie ». */
export const Controle: Story = {
  name: "Piloté par l'application",
  render: function Render() {
    const [id, setId] = useState<string | null>("dock");
    const [query, setQuery] = useState("");
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setId("energy")}>Ouvrir « L'énergie »</button>
          <button type="button" onClick={() => setQuery("tranformateur")}>Chercher « tranformateur »</button>
          <span style={{ fontSize: 12 }}>Ouverte : {id}</span>
        </div>
        <KnowledgeBase entries={ENTRIES} selectedId={id} onSelect={setId} query={query} onQueryChange={setQuery} categories={["Bases", "Stockage", "Transport", "Énergie"]} />
      </div>
    );
  },
};

/** Sur un écran étroit, la liste passe au-dessus de l'entrée. */
export const Etroit: Story = {
  name: "Sur un écran étroit",
  render: () => (
    <div style={{ width: 380 }}>
      <KnowledgeBase entries={ENTRIES} />
    </div>
  ),
};
