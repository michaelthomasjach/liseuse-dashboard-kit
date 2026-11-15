import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ScriptDocsAsk } from "./ScriptDocsAsk";
import { ScriptDocumentationModal } from "./ScriptDocumentationModal";
import type { AskScriptDocs } from "../docsSearch/scriptDocsAnswer";

const meta: Meta<typeof ScriptDocsAsk> = {
  title: "Charts/CandlestickChart/Demander à la documentation",
  component: ScriptDocsAsk,
  parameters: {
    docs: {
      description: {
        component:
          "Une question en français sur le langage de scripting. La recherche locale choisit les passages de la documentation (index construit depuis la référence de l'API) ; l'IA de l'application (`onAskDocs`) ne reçoit que ces passages et répond existe / partiellement / n'existe pas. Sa réponse est vérifiée avant affichage : une fonction absente des passages n'apparaît jamais comme un lien, un exemple de code qui n'est pas dans la documentation est écarté.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof ScriptDocsAsk>;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Une IA simulée : répond comme le ferait un modèle, en citant les numéros d'extraits. Pour la
 *  question type (« plusieurs unités de temps »), la vraie réponse de la documentation. */
const simulatedAi: AskScriptDocs = async (question, excerpts) => {
  await wait(700);
  const resample = excerpts.find((e) => e.signature?.startsWith("market.resample"));
  const available = excerpts.find((e) => e.signature?.startsWith("market.availableTimeframes"));
  if (resample) {
    return {
      verdict: "partiel",
      explanation:
        "Oui, dans un sens : market.resample(interval) agrège les barres du graphique vers une unité de temps plus longue (\"4h\", \"1d\" sur un graphique en 1 h), sans fuite vers le futur, et se lit comme market.*. Une unité plus fine que celle du graphique renvoie « aucune donnée », et il n'existe pas de chargement de données d'une autre unité de temps ; market.availableTimeframes() ne fait que lister celles du sélecteur.",
      references: [resample.id, ...(available ? [available.id] : [])],
      example: 'const journalier = market.resample("1d");\nconst tendance = ta.ema(journalier.series("close", 100), 50);',
    };
  }
  return {
    verdict: excerpts.length ? "existe" : "absent",
    explanation: excerpts.length
      ? `D'après la documentation, voyez « ${excerpts[0].signature ?? excerpts[0].title} ».`
      : `Pas trouvé dans la documentation pour « ${question} ».`,
    references: excerpts.slice(0, 2).map((e) => e.id),
    example: null,
  };
};

/** Recherche locale et réponse simulée : posez « Peut-on utiliser plusieurs unités de temps ? ». */
export const AvecIA: Story = {
  name: "Avec l'IA (réponse simulée)",
  args: { onAskDocs: simulatedAi, defaultQuestion: "Peut-on utiliser plusieurs unités de temps ?" },
  render: (args) => {
    const [last, setLast] = useState<string | null>(null);
    return (
      <div style={{ maxWidth: 760 }}>
        <ScriptDocsAsk {...args} onNavigate={setLast} />
        {last && <p style={{ fontSize: 12, opacity: 0.7 }}>Lien cliqué : #{last}</p>}
      </div>
    );
  },
};

/** Sans IA (offre sans IA, quota atteint, IA indisponible) : les passages trouvés seulement. */
export const RechercheSeule: Story = {
  name: "Recherche locale seule",
  args: { aiNotice: "Réponse de l'IA non incluse dans votre offre : voici les passages de la documentation qui en parlent.", defaultQuestion: "mémoriser une valeur entre les bougies" },
  render: (args) => (
    <div style={{ maxWidth: 760 }}>
      <ScriptDocsAsk {...args} onNavigate={() => undefined} />
    </div>
  ),
};

/** Une fonction qui n'existe pas : signalée, avec les noms proches qui existent ; l'IA, elle, ne peut
 *  pas la faire apparaître (sa réponse ci-dessous en cite une inventée, écartée à l'affichage). */
export const FonctionInexistante: Story = {
  name: "Fonction inexistante",
  args: {
    defaultQuestion: "Existe-t-il market.orderFlow() ?",
    onAskDocs: async (_q, excerpts) => {
      await wait(500);
      return {
        verdict: "absent",
        explanation: "Pas trouvé dans la documentation. market.orderFlow n'existe pas ; le plus proche est market.volume(offset?), le volume échangé pendant la barre.",
        references: [...excerpts.slice(0, 1).map((e) => e.id), "lq-script-docs-heading-market-market-orderflow"],
        example: "market.orderFlow();",
      };
    },
  },
  render: (args) => (
    <div style={{ maxWidth: 760 }}>
      <ScriptDocsAsk {...args} onNavigate={() => undefined} />
    </div>
  ),
};

/** Dans la documentation complète : l'encadré en tête, les liens font défiler jusqu'à la section. */
export const DansLaDocumentation: Story = {
  name: "Dans la documentation de l'éditeur",
  render: () => (
    <div style={{ height: 720 }}>
      <ScriptDocumentationModal open detached onClose={() => undefined} onAskDocs={simulatedAi} />
    </div>
  ),
};
