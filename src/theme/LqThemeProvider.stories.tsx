import type { Meta, StoryObj } from "@storybook/react";
import { fn, userEvent, within } from "storybook/test";
import { LqThemeProvider, useLqTheme } from "./ThemeProvider";
import { Panel } from "../components/primitives/Panel";
import { StatCard } from "../components/finance/StatCard";
import { Badge } from "../components/finance/Badge";
import { Button } from "../components/primitives/Button";
import { Input } from "../components/forms/Input";
import { PriceChangeTag } from "../components/finance/PriceChangeTag";
import { UserMenu } from "../components/finance/UserMenu";
import { Text } from "../components/primitives/Text";
import { UserIcon, LogoutIcon } from "../components/icons/icons";
import type { LqFont, LqPalette, LqSurface } from "./types";
import { REVENUE_TREND } from "../test-data/storyDemoData";

const pct = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

/** Un échantillon : une carte, une tuile, des pastilles, des boutons, un champ — de quoi voir ce que
 *  le thème change. */
function Sample() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20 }}>
      <Panel title="Commandes" meta="octobre">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <Badge tone="up">payée</Badge>
          <Badge tone="warning">en attente</Badge>
          <Badge tone="down">annulée</Badge>
          <PriceChangeTag value={12.4} format={pct} />
        </div>
      </Panel>
      <StatCard label="Revenu mensuel" value={"80 000 €"} delta={12.4} deltaFormat={pct} sparklineData={REVENUE_TREND} />
      <Input label="Client" placeholder="Lemoine SAS" />
      <div style={{ display: "flex", gap: 8 }}>
        <Button>Annuler</Button>
        <Button selected>Valider</Button>
      </div>
    </div>
  );
}

/** Une case de la comparaison : un fournisseur indépendant, avec sa légende. */
function Swatch({ palette, surface, caption }: { palette: LqPalette; surface: LqSurface; caption: string }) {
  return (
    <LqThemeProvider palette={palette} surface={surface} style={{ minWidth: 0 }}>
      <div style={{ padding: "12px 20px 0", fontSize: "0.75rem", color: "var(--lq-color-text-muted)" }}>{caption}</div>
      <Sample />
    </LqThemeProvider>
  );
}

/** Un panneau de réglages bâti sur `useLqTheme()` : il lit le thème courant et le change. */
function ThemeSettings() {
  const { palette, surface, font, setSurface, setFont } = useLqTheme();
  const fonts: LqFont[] = ["inter", "manrope", "sora", "space-grotesk", "ibm-plex-sans"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20 }}>
      <Text size="sm" muted>
        Thème lu par <code>useLqTheme()</code> : palette « {palette} », surface « {surface} », police « {font} ».
      </Text>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Button selected={surface === "light"} onClick={() => setSurface("light")}>
          Clair
        </Button>
        <Button selected={surface === "dark"} onClick={() => setSurface("dark")}>
          Sombre
        </Button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {fonts.map((f) => (
          <Button key={f} selected={font === f} onClick={() => setFont(f)}>
            {f}
          </Button>
        ))}
      </div>
      <Sample />
    </div>
  );
}

/**
 * Le fournisseur de thème du kit : palette, surface et police d'un sous-arbre.
 */
const meta = {
  title: "Foundations/LqThemeProvider",
  component: LqThemeProvider,
  parameters: {
    docs: {
      description: {
        component: [
          "Le **fournisseur de thème** du kit. Il enveloppe un sous-arbre dans un `<div class=\"lq-root\">` qui porte les variables `--lq-*` de la palette, de la surface et de la police choisies : c'est là que **tous** les composants du kit lisent leurs couleurs, rayons et espacements. Sans lui, un composant du kit n'a pas de thème.",
          "",
          "### Dans ce Storybook",
          "",
          "Chaque story est déjà enveloppée dans un `LqThemeProvider` piloté par la barre d'outils : **Palette** (e-ink par défaut), **Surface** et **Typo**. Les fournisseurs posés dans les stories ci-dessous s'imbriquent dans celui-là.",
          "",
          "### Les props",
          "",
          "- **`palette`** — `\"eink\"` (défaut : papier et encre, monochrome, pour une liseuse) ou `\"color\"` (tablette rétroéclairée, couleurs franches). Posée en `data-lq-palette`. Dans les deux, le kit garde des angles droits.",
          "- **`surface`** — `\"light\"` (défaut) ou `\"dark\"`. Posée en `data-lq-surface`.",
          "- **`font`** — `\"manrope\"` (défaut), `\"inter\"`, `\"sora\"`, `\"space-grotesk\"`, `\"ibm-plex-sans\"`. Elle choisit seulement la **pile** de polices (`--lq-font-family`, en style en ligne) : l'application doit charger la fonte elle-même. Ce Storybook charge les cinq.",
          "- **`className`** — classe ajoutée à `.lq-root`. **Omise sur un fournisseur imbriqué, elle est reprise du fournisseur englobant** : c'est ce qui la fait suivre jusque dans les portails (menus, notifications, modales), que le kit ré-enveloppe dans un fournisseur sans classe. C'est le point d'accroche d'une couche de thème qui redéfinit les variables `--lq-*` sous un sélecteur plus spécifique (`.ma-classe.lq-root[…]`). `className=\"\"` refuse la classe englobante.",
          "- **`style`** — styles du `<div class=\"lq-root\">`, fusionnés avec la variable de police.",
          "",
          "### Contrôlé ou non",
          "",
          "Chaque réglage est **contrôlé** quand sa prop est fournie, **non contrôlé** sinon (il part alors de sa valeur par défaut). Les composants du sous-arbre lisent et changent le thème avec `useLqTheme()` : `{ palette, surface, font, setPalette, setSurface, setFont }`. Un setter appelle toujours `onPaletteChange` / `onSurfaceChange` / `onFontChange` ; il ne change l'affichage que si le réglage est non contrôlé — sinon, à vous de repasser la nouvelle valeur.",
          "",
          "### Imbrication",
          "",
          "Les fournisseurs s'imbriquent : chacun repose ses variables et peint son propre fond (`--lq-color-bg`), ce qui permet de montrer deux modes côte à côte ou une zone sombre dans une page claire.",
        ].join("\n"),
      },
    },
  },
  args: {
    palette: "eink",
    surface: "light",
    font: "manrope",
    className: "",
    children: null,
    onPaletteChange: fn(),
    onSurfaceChange: fn(),
    onFontChange: fn(),
  },
  argTypes: {
    palette: { control: "inline-radio", options: ["eink", "color"] },
    surface: { control: "inline-radio", options: ["light", "dark"] },
    font: { control: "select", options: ["inter", "manrope", "sora", "space-grotesk", "ibm-plex-sans"] },
    className: { control: "text" },
    style: { control: false },
    children: { control: false },
  },
  render: (args) => (
    <LqThemeProvider {...args}>
      <Sample />
    </LqThemeProvider>
  ),
} satisfies Meta<typeof LqThemeProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Défaut",
  parameters: {
    docs: {
      description: {
        story:
          "Un fournisseur qui fixe ses trois réglages : il ignore ceux de la barre d'outils. Changez `palette`, `surface` et `font` dans les contrôles.",
      },
    },
  },
};

export const SideBySide: Story = {
  name: "Côte à côte",
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 1 }}>
      <Swatch palette="eink" surface="light" caption="eink · clair" />
      <Swatch palette="eink" surface="dark" caption="eink · sombre" />
      <Swatch palette="color" surface="light" caption="color · clair" />
      <Swatch palette="color" surface="dark" caption="color · sombre" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Quatre fournisseurs imbriqués, chacun avec ses variables et son fond : les deux palettes du kit, dans leurs deux surfaces.",
      },
    },
  },
};

export const Uncontrolled: Story = {
  name: "Réglages depuis l'intérieur",
  render: (args) => (
    <LqThemeProvider palette={args.palette} onSurfaceChange={args.onSurfaceChange} onFontChange={args.onFontChange}>
      <ThemeSettings />
    </LqThemeProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "`surface` et `font` ne sont pas passées : le fournisseur les tient lui-même (partant de « light » et « manrope »), et le panneau les change avec `useLqTheme()`. Les rappels `onSurfaceChange` / `onFontChange` sont appelés à chaque changement — voyez l'onglet Actions.",
      },
    },
  },
};

export const InheritedClass: Story = {
  name: "Zone sombre et portail",
  render: () => (
    <LqThemeProvider surface="dark">
      <div style={{ padding: 20, minHeight: 220 }}>
        <Text size="sm" muted>
          Fournisseur imbriqué en surface sombre : le menu, rendu dans un portail hors de l'arbre, reprend sa palette, sa surface et sa
          classe.
        </Text>
        <div style={{ marginTop: 12 }}>
          <UserMenu
            name="Claire Lemoine"
            subtitle="Directrice financière"
            items={[
              { id: "profil", label: "Mon profil", icon: <UserIcon size={16} /> },
              { id: "sortie", label: "Se déconnecter", icon: <LogoutIcon size={16} />, danger: true },
            ]}
          />
        </div>
      </div>
    </LqThemeProvider>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { expanded: false }));
  },
  parameters: {
    docs: {
      description: {
        story:
          "Une zone sombre dans une page claire : ce fournisseur ne fixe que `surface`. Le menu ouvert, rendu hors de l'arbre, garde la surface sombre — le kit ré-enveloppe ses portails dans un fournisseur qui reprend le thème englobant.",
      },
    },
  },
};
