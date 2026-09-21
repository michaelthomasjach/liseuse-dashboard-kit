import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { RackV2 } from "./RackV2";
import { RackItem } from "./RackItem";
import { RACK_ITEM_KINDS, RACK_ITEM_LABEL } from "./rackItems";
import type { RackV2Slot } from "./RackV2";
import { NumberField } from "../forms";

const meta: Meta<typeof RackV2> = {
  title: "Warehouse/Étagère V2",
  component: RackV2,
};
export default meta;
type Story = StoryObj<typeof RackV2>;

export const Boite: Story = {
  name: "La boîte",
  args: {
    width: 8,
    depth: 2,
    height: 2.4,
    cellSize: 34,
    posts: true,
    braces: true,
    feet: true,
    footHeight: 0.17,
    postSize: 0.22,
    deckThickness: 0.2,
    slotsX: 4,
    contents: ["carton", "interdit", null, "bidon"],
  },
  render: (args) => (
    <div style={{ padding: 40 }}>
      <RackV2 {...args} />
    </div>
  ),
};

/** Chaque sorte est décrite une fois et vue de deux caméras : de trois quarts pour l'étagère, de
 *  dessus pour un plan. Un bidon est un cylindre ici et un disque là *parce que c'est un bidon* —
 *  les deux vues ne peuvent pas diverger. */
export const Catalogue: Story = {
  name: "Ce qu'on pose dessus",
  render: () => (
    <div style={{ display: "flex", gap: 28, padding: 40, flexWrap: "wrap" }}>
      {RACK_ITEM_KINDS.map((kind) => (
        <div key={kind} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: 120 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", height: 130 }}>
            <RackItem kind={kind} view="iso" cellSize={34} />
          </div>
          <RackItem kind={kind} view="plan" cellSize={26} />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{RACK_ITEM_LABEL[kind]}</span>
        </div>
      ))}
    </div>
  ),
};

/** Le plateau du bas se divise en portions, et chaque portion porte un élément — ou rien, ou un
 *  interdit. C'est l'unité de « quelque part où poser quelque chose » : remplir une étagère est
 *  affaire de nommer des choses, pas de les placer. Cliquer un bouton fait défiler les états. */
export const Portions: Story = {
  name: "Portions du plateau",
  render: function Render() {
    const [slots, setSlots] = useState(4);
    const [contents, setContents] = useState<RackV2Slot[]>(["carton", "interdit", "boite", "bouteille"]);

    const cycle = (i: number) => {
      const order: RackV2Slot[] = [...RACK_ITEM_KINDS, "interdit", null];
      setContents((current) => {
        const next = [...current];
        while (next.length < slots) next.push(null);
        const at = order.indexOf(next[i] ?? null);
        next[i] = order[(at + 1) % order.length];
        return next;
      });
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: 32, alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ width: 150 }}>
            <NumberField
              label="Portions"
              size="small"
              value={slots}
              min={1}
              max={8}
              step={1}
              onChange={(next) => setSlots(next === "" ? 1 : Math.max(1, Math.min(8, next)))}
            />
          </div>
          {Array.from({ length: slots }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => cycle(i)}
              style={{ font: "inherit", fontSize: "0.7rem", padding: "6px 10px", cursor: "pointer" }}
            >
              {i + 1} ·{" "}
              {contents[i] === "interdit"
                ? "interdit"
                : contents[i]
                  ? RACK_ITEM_LABEL[contents[i] as Exclude<RackV2Slot, "interdit" | null>]
                  : "vide"}
            </button>
          ))}
        </div>
        <RackV2 width={slots * 2} depth={2} height={2.4} cellSize={38} posts braces feet slotsX={slots} contents={contents} />
      </div>
    );
  },
};

/** Trois champs pour les dimensions d'une étagère, trois pour le nombre d'étagères sur chaque axe.
 *  Les étagères se touchent : une enfilade d'étagères, c'est des étagères poussées l'une contre
 *  l'autre, et un espace entre deux est quelque chose qu'on obtient en demandant deux blocs. */
export const Atelier: Story = {
  name: "Dimensionner et multiplier",
  render: function Render() {
    const [size, setSize] = useState({ x: 6, y: 2, z: 2.4 });
    const [count, setCount] = useState({ x: 2, y: 2, z: 2 });
    const [foot, setFoot] = useState(0.17);

    // Le dessin grandit avec ce qu'on lui demande ; la case rétrécit pour que le tout reste
    // regardable sans faire défiler à chaque frappe.
    const cellSize = Math.max(8, Math.min(40, 260 / Math.max(size.x * count.x, size.y * count.y)));

    const field = (
      label: string,
      value: number,
      onChange: (next: number) => void,
      { min, max, step }: { min: number; max: number; step: number }
    ) => (
      <NumberField
        label={label}
        size="small"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(next) => onChange(next === "" ? min : Math.max(min, Math.min(max, next)))}
      />
    );

    const dimension = { min: 1, max: 20, step: 0.5 };
    const quantity = { min: 1, max: 8, step: 1 };

    return (
      <div style={{ display: "flex", gap: 32, alignItems: "flex-start", padding: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, width: 220 }}>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <legend style={{ padding: 0, fontSize: "0.75rem", fontWeight: 700 }}>Dimensions d'une étagère</legend>
            {field("X — longueur", size.x, (x) => setSize((s) => ({ ...s, x })), dimension)}
            {field("Y — profondeur", size.y, (y) => setSize((s) => ({ ...s, y })), dimension)}
            {field("Z — hauteur", size.z, (z) => setSize((s) => ({ ...s, z })), dimension)}
            {field("Pieds", foot, setFoot, { min: 0, max: 3, step: 0.05 })}
          </fieldset>

          <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <legend style={{ padding: 0, fontSize: "0.75rem", fontWeight: 700 }}>Nombre d'étagères</legend>
            {field("X — en enfilade", count.x, (x) => setCount((c) => ({ ...c, x })), quantity)}
            {field("Y — en rangées", count.y, (y) => setCount((c) => ({ ...c, y })), quantity)}
            {field("Z — empilées", count.z, (z) => setCount((c) => ({ ...c, z })), quantity)}
          </fieldset>

          <p style={{ margin: 0, fontSize: "0.68rem", color: "var(--lq-color-text-muted)" }}>
            {count.x * count.y * count.z} étagère{count.x * count.y * count.z > 1 ? "s" : ""} ·{" "}
            {(size.x * count.x).toFixed(1)} × {(size.y * count.y).toFixed(1)} × {(size.z * count.z).toFixed(1)} cases
          </p>
        </div>

        <div style={{ flex: "1 1 400px", minWidth: 0, overflow: "auto" }}>
          <RackV2
            width={size.x}
            depth={size.y}
            height={size.z}
            countX={count.x}
            countY={count.y}
            countZ={count.z}
            cellSize={cellSize}
            posts
            braces
            feet
            footHeight={foot}
          />
        </div>
      </div>
    );
  },
};

/** `posts` remplace les quatre arêtes verticales par de vrais poteaux, `braces` ajoute la diagonale
 *  de contreventement dans chaque cadre d'about — le membre qui fait d'une étagère autre chose que
 *  quatre pieds sous deux plateaux. */
export const Poteaux: Story = {
  name: "Poteaux et contreventement",
  render: () => (
    <div style={{ display: "flex", gap: 64, alignItems: "flex-end", padding: 40, flexWrap: "wrap" }}>
      <RackV2 width={6} depth={2} height={2.4} cellSize={40} posts braces feet />
      <RackV2 width={6} depth={2} height={2.4} cellSize={40} braces feet />
    </div>
  ),
};

/** Trois proportions, pour vérifier que la boîte reste une boîte : longue et basse, cubique, haute
 *  et étroite. Les poteaux gardent leur section d'une étagère à l'autre — c'est une pièce d'acier,
 *  pas une fraction de la boîte. */
export const Proportions: Story = {
  name: "Proportions",
  render: () => (
    <div style={{ display: "flex", gap: 48, alignItems: "flex-end", padding: 40, flexWrap: "wrap" }}>
      <RackV2 width={10} depth={2} height={1.5} cellSize={30} posts braces feet slotsX={4} contents={["carton", "boite", "interdit", "bidon"]} />
      <RackV2 width={4} depth={4} height={4} cellSize={30} posts braces feet slotsX={2} slotsY={2} contents={["carton", "interdit", "bouteille", "boite"]} />
      <RackV2 width={2} depth={2} height={6} cellSize={30} posts braces feet contents={["palette"]} />
    </div>
  ),
};
