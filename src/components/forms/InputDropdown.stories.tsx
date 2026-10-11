import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { InputDropdown, type InputDropdownOption } from "./InputDropdown";
import { SearchIcon } from "../icons";

const meta: Meta<typeof InputDropdown> = {
  title: "Forms/Input/InputDropdown",
  component: InputDropdown,
};
export default meta;
type Story = StoryObj<typeof InputDropdown>;

const COUNTRIES: InputDropdownOption[] = [
  { value: "FR", label: "France", group: "Europe" },
  { value: "DE", label: "Allemagne", group: "Europe" },
  { value: "IT", label: "Italie", group: "Europe" },
  { value: "ES", label: "Espagne", group: "Europe" },
  { value: "GB", label: "Royaume-Uni", group: "Europe" },
  { value: "CH", label: "Suisse", group: "Europe" },
  { value: "US", label: "États-Unis", group: "Amériques" },
  { value: "CA", label: "Canada", group: "Amériques" },
  { value: "BR", label: "Brésil", group: "Amériques" },
  { value: "JP", label: "Japon", group: "Asie-Pacifique" },
  { value: "CN", label: "Chine", group: "Asie-Pacifique" },
  { value: "AU", label: "Australie", group: "Asie-Pacifique" },
];

export const Default: Story = {
  name: "Filtrage en tapant",
  render: () => {
    const [value, setValue] = useState<string | null>("FR");
    return (
      <div style={{ maxWidth: 300 }}>
        <InputDropdown label="Pays" options={COUNTRIES} value={value} onChange={setValue} helperText="Tapez « ét » : États-Unis (sans tenir compte des accents)" />
      </div>
    );
  },
};

export const WithDescriptions: Story = {
  name: "Avec description et bouton d'effacement",
  render: () => {
    const [value, setValue] = useState<string | null>(null);
    const options: InputDropdownOption[] = [
      { value: "NVDA", label: "Nvidia", description: "NVDA · NASDAQ · Technologie" },
      { value: "MSFT", label: "Microsoft", description: "MSFT · NASDAQ · Technologie" },
      { value: "TTE.PA", label: "TotalEnergies", description: "TTE.PA · Euronext Paris · Énergie" },
      { value: "MC.PA", label: "LVMH", description: "MC.PA · Euronext Paris · Luxe" },
      { value: "^FCHI", label: "CAC 40", description: "^FCHI · Indice" },
      { value: "GC=F", label: "Or", description: "GC=F · Matière première", disabled: true },
    ];
    return (
      <div style={{ maxWidth: 360 }}>
        <InputDropdown
          label="Symbole"
          placeholder="Nom ou code…"
          leadingIcon={<SearchIcon size={14} />}
          options={options}
          value={value}
          onChange={setValue}
          onClear={() => setValue(null)}
        />
      </div>
    );
  },
};

const COMPANIES = ["Apple", "Amazon", "Alphabet", "AMD", "Airbus", "Air Liquide", "ASML", "AstraZeneca", "Adobe", "Allianz"];

export const ServerSearch: Story = {
  name: "Recherche côté serveur (filter={false})",
  render: () => {
    const [value, setValue] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<InputDropdownOption[]>([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      // Simule une requête réseau de 400 ms.
      const t = window.setTimeout(() => {
        setResults(COMPANIES.filter((n) => n.toLowerCase().includes(query.toLowerCase())).map((n) => ({ value: n, label: n })));
        setLoading(false);
      }, 400);
      return () => window.clearTimeout(t);
    }, [query]);
    return (
      <div style={{ maxWidth: 300 }}>
        <InputDropdown
          label="Entreprise"
          placeholder="Tapez « a »…"
          options={results}
          filter={false}
          loading={loading}
          onInputChange={setQuery}
          value={value}
          onChange={setValue}
          emptyMessage={query ? "Aucune entreprise" : "Commencez à taper"}
        />
      </div>
    );
  },
};

export const Sizes: Story = {
  name: "Tailles (small / normal)",
  render: () => {
    const [value, setValue] = useState<string | null>("US");
    return (
      <div style={{ maxWidth: 300, display: "flex", flexDirection: "column", gap: 16 }}>
        <InputDropdown size="small" label="Small" options={COUNTRIES} value={value} onChange={setValue} />
        <InputDropdown label="Normal (défaut)" options={COUNTRIES} value={value} onChange={setValue} />
      </div>
    );
  },
};

export const WithError: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(null);
    return (
      <div style={{ maxWidth: 300 }}>
        <InputDropdown label="Pays" options={COUNTRIES} value={value} onChange={setValue} error="Sélection requise" />
      </div>
    );
  },
};
