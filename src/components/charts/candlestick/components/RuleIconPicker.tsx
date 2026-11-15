import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../../primitives/Modal";
import { Input } from "../../../forms/Input";
import { InputNumber } from "../../../forms/InputNumber";
import { Select, type SelectOption } from "../../../forms/Select";
import { SearchIcon } from "../../../icons";
import { MarkerIcon } from "../../../icons/MarkerIcon";
import {
  MARKER_ICON_CATEGORIES,
  markerIconById,
  searchMarkerIcons,
  type MarkerIconCategory,
} from "../../../icons/markerIcons";
import type { RuleIcon, RuleIconPosition } from "../interfaces/IndicatorStyleRule.interface";
import { RULE_ICON_MAX_SIZE, RULE_ICON_MIN_SIZE, resolvedRuleIcon } from "../styleRules";

/**
 * Le choix de l'icône d'une règle de style conditionnel (« Ajouter une icône ») : un bouton qui montre l'icône choisie,
 * dans sa couleur, et ouvre une fenêtre de choix — une grille de toutes les icônes repères du kit (`MARKER_ICONS`),
 * avec une recherche (nom, synonymes, sans accents) et un filtre par catégorie. Un clic choisit et referme.
 */
export function RuleIconPicker({
  value,
  color,
  ariaLabel,
  onChange,
}: {
  /** Identifiant de l'icône choisie. */
  value: string;
  /** Couleur de l'aperçu sur le bouton et dans la grille. */
  color?: string;
  ariaLabel: string;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const def = markerIconById(value);
  return (
    <>
      <button
        type="button"
        className="lq-chart__rule-icon-button"
        onClick={() => setOpen(true)}
        aria-label={`${ariaLabel} : ${def.label}`}
        aria-haspopup="dialog"
        title={`${def.label} — changer d'icône`}
      >
        <span className="lq-chart__rule-icon-preview" style={color ? { color } : undefined}>
          <MarkerIcon icon={def.id} size={16} />
        </span>
      </button>
      {open && (
        <RuleIconModal
          value={def.id}
          color={color}
          onClose={() => setOpen(false)}
          onPick={(id) => {
            onChange(id);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

/** La fenêtre de choix d'une icône : recherche, catégories, grille. Exportée pour Storybook. */
export function RuleIconModal({ value, color, onClose, onPick }: { value: string; color?: string; onClose: () => void; onPick: (icon: string) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MarkerIconCategory | null>(null);
  const icons = useMemo(() => searchMarkerIcons(query, category), [query, category]);
  // Échap ne referme que cette fenêtre, pas celle des paramètres ouverte dessous (qui écoute aussi la fenêtre) :
  // intercepté à la capture, avant les écouteurs posés en phase de bouillonnement.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);
  const chips: { value: MarkerIconCategory | null; label: string }[] = [{ value: null, label: "Toutes" }, ...MARKER_ICON_CATEGORIES];
  return (
    <Modal open onClose={onClose} title="Choisir une icône" footer={null} className="lq-chart__icon-modal">
      <div className="lq-chart__icon-picker">
        <Input
          size="small"
          autoFocus
          leadingIcon={<SearchIcon size={14} />}
          placeholder="Rechercher (flèche, étoile, €…)"
          aria-label="Rechercher une icône"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="lq-chart__icon-categories" role="group" aria-label="Catégories d'icônes">
          {chips.map((c) => (
            <button
              key={c.value ?? "all"}
              type="button"
              className={["lq-chart__icon-category", category === c.value && "lq-chart__icon-category--active"].filter(Boolean).join(" ")}
              aria-pressed={category === c.value}
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
        {icons.length === 0 ? (
          <p className="lq-chart__icon-empty">Aucune icône ne correspond à « {query} ».</p>
        ) : (
          <div className="lq-chart__icon-grid" role="listbox" aria-label="Icônes">
            {icons.map((icon) => (
              <button
                key={icon.id}
                type="button"
                role="option"
                aria-selected={icon.id === value}
                className={["lq-chart__icon-cell", icon.id === value && "lq-chart__icon-cell--selected"].filter(Boolean).join(" ")}
                title={icon.label}
                aria-label={icon.label}
                onClick={() => onPick(icon.id)}
              >
                <span style={color ? { color } : undefined}>
                  <MarkerIcon icon={icon.id} size={22} />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/**
 * La ligne de réglages d'une icône, sous la phrase de la règle : taille et position (au-dessus, en dessous, et
 * « sur la courbe » pour un indicateur). `onCurve` : propose la position centrée sur le point de la courbe.
 */
export function RuleIconSettings({
  icon,
  onCurve,
  ariaPrefix,
  onChange,
}: {
  icon: RuleIcon | null | undefined;
  onCurve: boolean;
  ariaPrefix: string;
  onChange: (patch: Partial<RuleIcon>) => void;
}) {
  const resolved = resolvedRuleIcon(icon);
  const options: SelectOption<RuleIconPosition>[] = [
    { value: "above", label: onCurve ? "Au-dessus du point" : "Au-dessus de la bougie" },
    ...(onCurve ? [{ value: "on" as const, label: "Sur la courbe" }] : []),
    { value: "below", label: onCurve ? "En dessous du point" : "En dessous de la bougie" },
  ];
  const position = !onCurve && resolved.position === "on" ? "above" : resolved.position;
  return (
    <div className="lq-chart__rule-sentence lq-chart__rule-icon-settings">
      <span className="lq-chart__rule-group">
        <span className="lq-chart__rule-word">Taille</span>
        <span className="lq-chart__rule-pick lq-chart__rule-pick--number">
          <InputNumber
            size="small"
            step={1}
            min={RULE_ICON_MIN_SIZE}
            max={RULE_ICON_MAX_SIZE}
            value={resolved.size}
            aria-label={`Taille de l'icône, ${ariaPrefix}`}
            onChange={(v) => onChange({ size: v === "" ? undefined : Math.min(RULE_ICON_MAX_SIZE, Math.max(RULE_ICON_MIN_SIZE, Math.round(v))) })}
          />
        </span>
        <span className="lq-chart__rule-word">px</span>
      </span>
      <span className="lq-chart__rule-pick lq-chart__rule-pick--position">
        <Select size="small" ariaLabel={`Position de l'icône, ${ariaPrefix}`} value={position} options={options} onChange={(p) => onChange({ position: p })} />
      </span>
    </div>
  );
}
