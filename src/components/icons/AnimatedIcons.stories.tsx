import { useState, type ComponentType } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import * as Icons from "./icons";
import type { AnimatedIconProps, IconMotion } from "./IconBase";

const meta: Meta = {
  title: "Foundations/Animated Icons",
  parameters: { layout: "padded" },
};
export default meta;
type Story = StoryObj;

type AnyAnimatedIcon = ComponentType<AnimatedIconProps>;

/** Built from the module's own exports, exactly like the static gallery — a newly added icon shows
 *  up here on its own, animated, with no list to remember to update. Which is also what keeps the
 *  rule honest: an icon that forgets its `motion` appears in this gallery not moving, next to a
 *  hundred that do. */
const ENTRIES: { name: string; Icon: AnyAnimatedIcon }[] = Object.entries(Icons)
  .filter((entry): entry is [string, AnyAnimatedIcon] => entry[0].endsWith("Icon") && typeof entry[1] === "function")
  .map(([name, Icon]) => ({ name, Icon }))
  .sort((a, b) => a.name.localeCompare(b.name));

/** What each motion means, for the legend. The mapping from icon to motion lives on the icon
 *  itself (see `icons.tsx`); this only describes the vocabulary. */
const MOTIONS: { motion: IconMotion; description: string }[] = [
  { motion: "spin", description: "Un tour complet, lentement — soleil, engrenage, rafraîchir." },
  { motion: "pulse", description: "Respire : échelle et opacité ensemble — lune, batterie, info." },
  { motion: "sway", description: "Bascule de quelques degrés — vent, une ligne tracée, un pinceau." },
  { motion: "bob", description: "Monte et retombe — flèches, bougie, tout ce qui a un sens vertical." },
  { motion: "slide", description: "Part un peu de côté et revient — lecture, chevrons, avancer/reculer." },
  { motion: "ring", description: "Sonne : pivote depuis son attache, part large et s'amortit." },
  { motion: "blink", description: "Cligne — longtemps ouvert, brièvement fermé : œil, curseur, code." },
  { motion: "shake", description: "Sursaut nerveux, puis repos — erreur, fermeture, alerte." },
  { motion: "grow", description: "Gonfle depuis son centre — plus, zoom, plein écran." },
  { motion: "float", description: "Dérive, plus lent et plus doux que bob — nuage, calques, fichier." },
  { motion: "beat", description: "Deux battements puis une pause — activité, étoile, étincelle." },
  { motion: "tilt", description: "Penche depuis son coin bas-gauche — un couvercle, un rabat, une carte." },
  { motion: "flip", description: "Se retourne sur son axe vertical — copier, tout ce qui a deux faces." },
  { motion: "raindrop", description: "Tombe et s'efface. Posé sur des enfants, pas sur l'icône entière." },
];

export const Gallery: Story = {
  name: "Toutes les icônes, animées",
  render: function Render() {
    // Both at once by default: the point of the gallery is the comparison, and a grid where only
    // half the cards move is also how a missing `motion` gives itself away.
    const [animated, setAnimated] = useState(true);
    const [size, setSize] = useState(28);
    return (
      <div>
        <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 12, maxWidth: 720, lineHeight: 1.5 }}>
          Chaque icône porte sa propre animation de repos, choisie pour ce qu&apos;elle <em>veut dire</em> : une cloche
          sonne, un œil cligne, un rafraîchissement tourne. Elle est désactivée par défaut — une interface dense pleine
          d&apos;icônes qui bougent est illisible — et s&apos;allume instance par instance avec <code>animated</code> :{" "}
          <code>&lt;BellIcon animated /&gt;</code>. Tout est suspendu sous{" "}
          <code>prefers-reduced-motion: reduce</code>.
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, fontSize: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={animated} onChange={(e) => setAnimated(e.target.checked)} />
            <code>animated</code>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Taille
            <input type="range" min={16} max={64} value={size} onChange={(e) => setSize(Number(e.target.value))} />
            {size}px
          </label>
          <span style={{ opacity: 0.6 }}>{ENTRIES.length} icônes</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))", gap: 10 }}>
          {ENTRIES.map(({ name, Icon }) => (
            <div
              key={name}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "16px 8px",
                minHeight: 96,
                color: "var(--lq-color-text)",
                backgroundColor: "var(--lq-color-panel)",
                border: "1px solid var(--lq-color-border-subtle)",
                borderRadius: "var(--lq-radius-md, 8px)",
              }}
            >
              <Icon size={size} animated={animated} />
              <span style={{ fontSize: 11, textAlign: "center", opacity: 0.75, wordBreak: "break-word", lineHeight: 1.3 }}>
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

export const SideBySide: Story = {
  name: "Statique vs. animé",
  render: () => (
    <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left", padding: "8px 16px 8px 0" }}>Icône</th>
          <th style={{ textAlign: "center", padding: "8px 16px" }}>Statique</th>
          <th style={{ textAlign: "center", padding: "8px 16px" }}>
            <code>animated</code>
          </th>
        </tr>
      </thead>
      <tbody>
        {ENTRIES.map(({ name, Icon }) => (
          <tr key={name} style={{ borderTop: "1px solid rgba(128,128,128,0.2)" }}>
            <td style={{ padding: "10px 16px 10px 0", fontWeight: 600 }}>{name}</td>
            <td style={{ padding: 10, textAlign: "center" }}>
              <Icon size={30} />
            </td>
            <td style={{ padding: 10, textAlign: "center" }}>
              <Icon size={30} animated />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

export const Vocabulary: Story = {
  name: "Le vocabulaire des animations",
  render: () => (
    <div>
      <p style={{ fontSize: 13, opacity: 0.75, marginBottom: 16, maxWidth: 720, lineHeight: 1.5 }}>
        Un vocabulaire partagé plutôt qu&apos;une animation par icône. Une icône, ce sont quelques tracés dans une boîte
        de 24×24 : à cette taille, seules les transformations et l&apos;opacité se lisent, et aucune de ces quatorze
        animations ne dépend de la géométrie d&apos;un tracé — c&apos;est ce qui permet à cent icônes d&apos;en partager
        quatorze sans qu&apos;aucune ait à être réglée à la main.
      </p>
      <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          {MOTIONS.map(({ motion, description }) => (
            <tr key={motion} style={{ borderTop: "1px solid rgba(128,128,128,0.2)" }}>
              <td style={{ padding: "12px 16px 12px 0", textAlign: "center", width: 60 }}>
                <span className={`lq-icon-${motion}`} style={{ display: "inline-block", transformOrigin: "center" }}>
                  <Icons.SparkleIcon size={26} />
                </span>
              </td>
              <td style={{ padding: "12px 16px 12px 0", fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>
                {motion}
              </td>
              <td style={{ padding: "12px 0", opacity: 0.8 }}>{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ),
};
