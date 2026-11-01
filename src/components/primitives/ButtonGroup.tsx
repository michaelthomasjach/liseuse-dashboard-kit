import { useState, type ReactNode } from "react";
import { Button } from "./Button";
import { IconButton } from "./IconButton";
import "./ButtonGroup.css";

/** Un bouton du mode sélection (`items`). Sans `label`, le bouton est carré et ne porte que
 *  l'icône : `ariaLabel` devient alors son seul nom accessible. */
export interface ButtonGroupItem {
  value: string;
  label?: ReactNode;
  icon?: ReactNode;
  /** Nom accessible d'un bouton sans libellé (sinon, le libellé suffit). */
  ariaLabel?: string;
  disabled?: boolean;
}

interface ButtonGroupBaseProps {
  /** Les boutons, quand le groupe n'est qu'une juxtaposition d'actions (`Button`, `IconButton`).
   *  Ignoré dès que `items` est fourni. */
  children?: ReactNode;
  /** Le mode sélection : le groupe rend lui-même ses boutons et tient `aria-pressed` à jour. */
  items?: ButtonGroupItem[];
  /** `"horizontal"` (défaut) : les boutons côte à côte ; `"vertical"` : empilés, même largeur. */
  orientation?: "horizontal" | "vertical";
  /** `"md"` (défaut) : la hauteur de `Button` ; `"sm"` : un cran plus dense, pour un en-tête ou une barre d'outils. */
  size?: "sm" | "md";
  /** Le groupe prend toute la largeur et partage la place entre ses boutons. */
  block?: boolean;
  /** Nom du groupe pour un lecteur d'écran (« Alignement », « Vue »…). */
  ariaLabel?: string;
  className?: string;
}

interface ButtonGroupSingleProps extends ButtonGroupBaseProps {
  /** `"single"` (défaut) : un seul bouton enfoncé à la fois, comme des boutons radio. */
  selection?: "single";
  /** Valeur enfoncée (contrôlé). `null` : aucune. */
  value?: string | null;
  /** Valeur enfoncée au départ (non contrôlé). */
  defaultValue?: string | null;
  onChange?: (value: string) => void;
}

interface ButtonGroupMultipleProps extends ButtonGroupBaseProps {
  /** `"multiple"` : chaque bouton s'enfonce et se relâche seul, comme des cases à cocher (gras, italique…). */
  selection: "multiple";
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
}

export type ButtonGroupProps = ButtonGroupSingleProps | ButtonGroupMultipleProps;

/**
 * Des boutons accolés : bordures fusionnées, coins arrondis seulement aux extrémités.
 *
 * Deux usages. En **juxtaposition**, `children` reçoit des `Button` ou `IconButton` quelconques et le
 * groupe ne fait que les souder. En **sélection**, `items` décrit les boutons et le groupe tient leur
 * état enfoncé (`aria-pressed`) : un seul à la fois (`selection="single"`) ou chacun le sien
 * (`selection="multiple"`), contrôlé par `value`/`onChange` ou libre avec `defaultValue`.
 */
export function ButtonGroup(props: ButtonGroupProps) {
  const { children, items, orientation = "horizontal", size = "md", block, ariaLabel, className } = props;
  const multiple = props.selection === "multiple";

  const [inner, setInner] = useState<string | string[] | null>(() => props.defaultValue ?? (multiple ? [] : null));
  const current = props.value !== undefined ? props.value : inner;

  const isPressed = (value: string) =>
    Array.isArray(current) ? current.includes(value) : current === value;

  const press = (value: string) => {
    if (props.selection === "multiple") {
      const list = Array.isArray(current) ? current : [];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      if (props.value === undefined) setInner(next);
      props.onChange?.(next);
    } else {
      if (props.value === undefined) setInner(value);
      if (current !== value) props.onChange?.(value);
    }
  };

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={[
        "lq-button-group",
        `lq-button-group--${orientation}`,
        `lq-button-group--${size}`,
        block && "lq-button-group--block",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {items
        ? items.map((item) => {
            const pressed = isPressed(item.value);
            if (item.label == null) {
              return (
                <IconButton
                  key={item.value}
                  icon={item.icon}
                  ariaLabel={item.ariaLabel ?? item.value}
                  aria-pressed={pressed}
                  disabled={item.disabled}
                  className={pressed ? "lq-button-group__item--pressed" : undefined}
                  onClick={() => press(item.value)}
                />
              );
            }
            return (
              <Button
                key={item.value}
                icon={item.icon}
                selected={pressed}
                aria-label={item.ariaLabel}
                disabled={item.disabled}
                className={pressed ? "lq-button-group__item--pressed" : undefined}
                onClick={() => press(item.value)}
              >
                {item.label}
              </Button>
            );
          })
        : children}
    </div>
  );
}
