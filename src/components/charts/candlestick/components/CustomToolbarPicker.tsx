import { Fragment, useMemo, useState } from "react";
import { Input } from "../../../forms/Input";
import { SearchIcon, ChevronUpIcon, ChevronDownIcon, CloseIcon, CheckIcon } from "../../../icons";
import type { CustomToolbarToolDef } from "../customToolbarCatalog";

export interface CustomToolbarPickerProps {
  /** Nom de la barre, pour les libellés. */
  name: string;
  catalog: CustomToolbarToolDef[];
  /** Outils déjà sur la barre, dans leur ordre. */
  tools: string[];
  onChange: (tools: string[]) => void;
}

/** Normalisé pour la recherche : sans accents ni majuscules. */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function CustomToolbarToolGlyph({ def }: { def: CustomToolbarToolDef }) {
  const Icon = def.icon;
  return Icon ? <Icon size={14} /> : <span className="lq-chart__custom-toolbar-glyph-text">{def.text}</span>;
}

/** Le « + » d'une barre personnalisée : ce qu'elle contient (réordonner, retirer — le mode édition, utilisable au doigt)
 *  puis tout le catalogue, avec une recherche ; un clic sur un outil l'ajoute à la barre, ou l'en retire s'il y est. */
export function CustomToolbarPicker({ name, catalog, tools, onChange }: CustomToolbarPickerProps) {
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(catalog.map((d) => [d.id, d])), [catalog]);
  const q = fold(query.trim());
  const matches = q ? catalog.filter((d) => fold(`${d.label} ${d.text ?? ""} ${d.group}`).includes(q)) : catalog;
  const groups: [string, CustomToolbarToolDef[]][] = [];
  for (const d of matches) {
    const last = groups[groups.length - 1];
    if (last && last[0] === d.group) last[1].push(d);
    else groups.push([d.group, [d]]);
  }
  const present = tools.filter((id) => byId.has(id));
  const move = (index: number, delta: number) => {
    const next = [...tools];
    const from = tools.indexOf(present[index]);
    const to = tools.indexOf(present[index + delta]);
    if (from < 0 || to < 0) return;
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  };

  return (
    <div className="lq-chart__custom-toolbar-picker" role="dialog" aria-label={`Outils de la barre ${name}`}>
      <Input
        size="small"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un outil, une unité, un indicateur"
        aria-label="Rechercher un outil"
        leadingIcon={<SearchIcon size={14} />}
        autoFocus
      />
      <div className="lq-chart__custom-toolbar-picker-list">
        {!q && (
          <>
            <div className="lq-chart__tool-menu-header">Dans la barre ({present.length})</div>
            {present.length === 0 && <div className="lq-chart__custom-toolbar-picker-empty">Aucun outil pour l'instant : choisissez-en ci-dessous.</div>}
            {present.map((id, i) => {
              const def = byId.get(id)!;
              return (
                <div key={id} className="lq-chart__custom-toolbar-picker-row">
                  <span className="lq-chart__custom-toolbar-picker-label">
                    <CustomToolbarToolGlyph def={def} />
                    {def.label}
                  </span>
                  <button type="button" className="lq-chart__pane-header-action" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Avancer ${def.label}`} title="Avancer dans la barre">
                    <ChevronUpIcon size={13} />
                  </button>
                  <button type="button" className="lq-chart__pane-header-action" disabled={i === present.length - 1} onClick={() => move(i, 1)} aria-label={`Reculer ${def.label}`} title="Reculer dans la barre">
                    <ChevronDownIcon size={13} />
                  </button>
                  <button type="button" className="lq-chart__pane-header-action" onClick={() => onChange(tools.filter((t) => t !== id))} aria-label={`Retirer ${def.label} de la barre`} title="Retirer de la barre">
                    <CloseIcon size={13} />
                  </button>
                </div>
              );
            })}
          </>
        )}
        {groups.length === 0 && <div className="lq-chart__custom-toolbar-picker-empty">Aucun outil ne correspond à « {query} ».</div>}
        {groups.map(([group, defs]) => (
          <Fragment key={group}>
            <div className="lq-chart__tool-menu-header">{group}</div>
            {defs.map((def) => {
              const on = tools.includes(def.id);
              return (
                <button
                  key={def.id}
                  type="button"
                  className={["lq-chart__tool-menu-option", on && "lq-chart__tool-menu-option--selected"].filter(Boolean).join(" ")}
                  aria-pressed={on}
                  onClick={() => onChange(on ? tools.filter((t) => t !== def.id) : [...tools, def.id])}
                  title={on ? "Déjà dans la barre : cliquer pour l'en retirer" : "Ajouter à la barre"}
                >
                  <CustomToolbarToolGlyph def={def} />
                  <span className="lq-chart__custom-toolbar-picker-option-label">{def.label}</span>
                  {on && <CheckIcon size={13} />}
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
