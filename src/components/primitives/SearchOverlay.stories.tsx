import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { SearchOverlay } from "./SearchOverlay";
import { Button } from "./Button";

const meta: Meta<typeof SearchOverlay> = {
  title: "Primitives/SearchOverlay",
  component: SearchOverlay,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof SearchOverlay>;

const CLIENTS = ["Lemoine SAS", "Atelier Nord", "Groupe Vallée", "Mercier & Fils", "Studio Bélier", "Cabinet Roux"];

/** Ouvert par le bouton, ou en tapant une lettre n'importe où sur la page. */
export const TypeAnywhere: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const hits = CLIENTS.filter((c) => c.toLowerCase().includes(query.trim().toLowerCase()));
    return (
      <div style={{ padding: 32 }}>
        <Button onClick={() => setOpen(true)}>Rechercher</Button>
        <p>… ou tapez une lettre n'importe où.</p>
        <SearchOverlay
          open={open}
          onClose={() => {
            setOpen(false);
            setQuery("");
          }}
          query={query}
          onQueryChange={setQuery}
          onTypeToOpen={(first) => {
            setQuery(first);
            setOpen(true);
          }}
          brand={<strong>Finance Kit</strong>}
          hint="Entrée pour lancer la recherche"
          sections={query.trim() ? [{ id: "clients", title: `Clients : ${query}`, results: hits.map((c) => ({ id: c, label: c, details: "Client actif" })) }] : []}
        />
      </div>
    );
  },
};
