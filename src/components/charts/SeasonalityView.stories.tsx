import { useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { BarChart } from "./BarChart";
import { SeasonalityView } from "./SeasonalityView";
import { computeSeasonality } from "./internal/seasonality";
import { BOUGIES_KAPA, BOUGIES_NOVA, MOIS_COURTS } from "../../test-data/storyDemoData";
import { CODE_LISIBLE, SOURCE_ABREGEE, pourcent } from "../../test-data/storyChartFormat";

/**
 * La saisonnalité d'un titre : le parcours de l'année en cours contre celui des années passées.
 */
const meta = {
  title: "Charts/SeasonalityView",
  component: SeasonalityView,
  parameters: {
    ...CODE_LISIBLE,
    docs: {
      source: SOURCE_ABREGEE,
      description: {
        component: [
          "La vue de saisonnalité : à partir de bougies quotidiennes sur plusieurs années, la performance **cumulée depuis le 1er janvier**, séance après séance, de l'année en cours face à la moyenne des années précédentes — ou de chaque année séparément. C'est la vue qu'ouvre le bouton « Saisonnalité » d'un `CandlestickChart` (prop `seasonality`) ; elle s'emploie aussi seule.",
          "",
          "**Quand l'utiliser** — pour savoir si un titre a des saisons : un mois de mai régulièrement faible, une fin d'année porteuse. Il faut plusieurs années de séances dans `data` : avec une ou deux, la moyenne n'est que du bruit.",
          "",
          "**Anatomie** — un en-tête : bouton retour (`onBack`, obligatoire — c'est la seule sortie quand la vue remplace le graphique), le titre « `symbol` — Saisonnalité », et le mode d'affichage, *Année en cours* (défaut) ou *Années indépendantes*. Un rail d'icônes à gauche : réglages d'affichage (colorer l'aire sous la courbe ou entre deux courbes), choix des années incluses (avec des raccourcis par cycle électoral américain), règle de mesure, moyenne au survol, réinitialisation du zoom. Le tracé est un `LineAreaChart` à l'axe des prix à droite, gradué par mois ; la ligne du 0 % marque l'équilibre. `height` fixe la hauteur du tracé ; `showHeader={false}` retire l'en-tête ; `mobile` resserre l'axe pour un écran étroit.",
          "",
          "**Interactions** — celles de `LineAreaChart` : molette pour zoomer, glisser pour se déplacer, survol pour lire les valeurs à une séance donnée.",
          "",
          "**Le calcul seul** — `computeSeasonality(data, granularite, anneesExclues)` est exporté à part, sans React : granularité `\"day\"`, `\"week\"`, `\"month\"`, `\"quarter\"` ou `\"year\"`, et la liste des années à écarter. Il rend des `buckets` (un par séance, semaine, mois…) avec leur `average` et le détail par année — de quoi bâtir sa propre vue (voir « Le calcul seul »).",
          "",
          "**Thème** — celui de `LineAreaChart` et de `CandlestickChart` : séries sur la palette catégorielle (`--lq-color-accent`, `--lq-color-green`…), aires signées en `--lq-color-up` / `--lq-color-down`, axes en `--lq-color-text-muted`, grille et séparations `--lq-color-border-subtle` ; en-tête et rail suivent `--lq-color-panel`, `--lq-color-hover` et `--lq-radius-sm`.",
        ].join("\n"),
      },
    },
  },
  args: { data: BOUGIES_NOVA, symbol: "NOVA", height: 340, onBack: fn() },
  argTypes: { data: { control: false }, onBack: { control: false } },
} satisfies Meta<typeof SeasonalityView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Défaut",
  parameters: {
    docs: {
      description: {
        story: "Sept ans de séances de NOVA (fictives) : l'année 2026 contre la moyenne de 2019 à 2025. Le mode « Années indépendantes », dans l'en-tête, trace une courbe par année. Le décrochage de la moyenne sur les toutes dernières séances de décembre vient du calcul : les 261e et 262e séances n'existent que dans les années qui en comptent autant, et la moyenne n'y repose plus que sur deux années.",
      },
    },
  },
};

export const ShortHistory: Story = {
  name: "Historique court",
  args: { data: BOUGIES_KAPA, symbol: "KAPA" },
  parameters: {
    docs: {
      description: {
        story: "Trois ans seulement : la « moyenne » ne porte que sur deux années et se lit avec prudence.",
      },
    },
  },
};

export const WithoutHeader: Story = {
  name: "Sans en-tête",
  args: { showHeader: false, height: 300 },
  parameters: {
    docs: {
      description: {
        story: "`showHeader={false}` : ni retour, ni titre, ni choix du mode. À réserver au cas où l'en-tête du graphique hôte est lui-même masqué.",
      },
    },
  },
};

export const Mobile: Story = {
  name: "Écran étroit",
  args: { mobile: true, height: 300 },
  render: (args) => (
    <div style={{ maxWidth: 390 }}>
      <SeasonalityView {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "`mobile` réduit la gouttière de l'axe des prix à celle du graphique de cours sur téléphone, pour que l'échelle ne saute pas d'une vue à l'autre.",
      },
    },
  },
};

function CalculSeul() {
  const mensuel = useMemo(
    () =>
      computeSeasonality(BOUGIES_NOVA, "month", [2026])
        .buckets.filter((b) => b.index >= 0)
        .map((b) => ({ id: `m${b.index}`, label: MOIS_COURTS[b.index], value: Math.round(b.average * 10) / 10 })),
    [],
  );
  return <BarChart data={mensuel} height={260} formatValue={pourcent} colorByValue zoomable={false} />;
}

export const ComputeOnly: Story = {
  name: "Le calcul seul",
  render: () => <CalculSeul />,
  parameters: {
    docs: {
      source: {
        code: [
          "const mensuel = computeSeasonality(bougies, \"month\", [2026]) // 2026 exclue : années closes seulement",
          "  .buckets.filter((b) => b.index >= 0) // sans le point d'ancrage du 1er janvier",
          "  .map((b) => ({ id: `m${b.index}`, label: MOIS_COURTS[b.index], value: b.average }));",
          "",
          "<BarChart data={mensuel} formatValue={pourcent} colorByValue zoomable={false} />",
        ].join("\n"),
      },
      description: {
        story: "`computeSeasonality` sans la vue : le parcours moyen cumulé de NOVA à la fin de chaque mois, années 2019 à 2025, rendu par un `BarChart`. Le bucket d'indice −1 est l'ancrage commun à 0 % du 1er janvier, qu'on écarte ici.",
      },
    },
  },
};
