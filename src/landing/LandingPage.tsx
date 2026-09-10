import { useState, type ReactNode } from "react";
import { LqThemeProvider, useLqTheme, type LqPalette, type LqSurface } from "../theme";
import { Button } from "../components/primitives/Button";
import { Card } from "../components/primitives/Card";
import { CodeBlock } from "../components/primitives/CodeBlock";
import { CandlestickChart, type ChartEvent } from "../components/charts/CandlestickChart";
import { Sparkline } from "../components/charts/Sparkline";
import { StatCard } from "../components/finance/StatCard";
import { Badge } from "../components/finance/Badge";
import { PortfolioSummaryWidget } from "../components/finance-widgets/PortfolioSummaryWidget";
import { WatchlistWidget } from "../components/finance-widgets/WatchlistWidget";
import { DashboardGrid, DashboardGridItem } from "../components/widgets/DashboardGrid";
import { ClockWidget } from "../components/widgets/ClockWidget";
import { WeatherWidget } from "../components/widgets/WeatherWidget";
import { MetricListWidget } from "../components/widgets/MetricListWidget";
import { LightsWidget } from "../components/widgets/LightsWidget";
import { EnergyWidget } from "../components/widgets/EnergyWidget";
import { ArrowRightIcon, PartlyCloudyIcon, SolarPanelIcon, SunIcon } from "../components/icons";
import { generateCandles, generateSeries, SAMPLE_HOLDINGS } from "../test-data/financeSampleData";
import { AppShowcase } from "./AppShowcase";
import { CatalogStrip } from "./CatalogStrip";
import { ChartGallery } from "./ChartGallery";
import { Laptop, Phone, Tablet } from "./DeviceFrames";
import { FormsShowcase } from "./FormsShowcase";
import { FoundationsStrip } from "./FoundationsStrip";
import {
  DECORATORS,
  FAQ,
  FEATURES,
  FIGURES,
  INSTALL_SNIPPET,
  LINKS,
  SCRIPT_SNIPPET,
  USAGE_SNIPPET,
} from "./landingContent";
import "./LandingPage.css";

// Generated once at module scope, not per render: every one of these feeds a chart that would
// otherwise redraw against a brand-new series on each parent re-render (the theme tiles alone
// re-render whenever the toolbar font changes).
const HERO_CANDLES = generateCandles(420, 168, 21);
const PORTFOLIO_SERIES = generateSeries(120, 40_000, 6);
const THEME_SPARK = [11.2, 11.6, 11.4, 12.1, 12.6, 12.4, 13.1, 13.7, 13.5, 14.2];

const HERO_EVENTS: ChartEvent[] = [
  { date: HERO_CANDLES[112].date, kind: "earnings", label: "Résultats T2 : BPA 1,51 $ (attendu 1,48 $)" },
  { date: HERO_CANDLES[248].date, kind: "dividend", label: "Dividende détaché : 0,62 $/action" },
  { date: HERO_CANDLES[338].date, kind: "news", label: "Annonce d'un partenariat stratégique" },
];

/** Storybook renders every story inside its own iframe, so a plain `href` would load a second,
 *  nested Storybook inside the canvas. Navigating `window.top` is what actually moves the manager
 *  (sidebar selection and address bar included). */
function openStory(path: string) {
  const target = window.top ?? window;
  target.location.href = `${target.location.pathname}?path=${path}`;
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="lqx-figure">
      <span className="lqx-figure__value">{value}</span>
      <span className="lqx-figure__label">{label}</span>
    </div>
  );
}

/** One of the four palette × surface combinations, painted by its own nested provider.
 *
 *  Nesting is the point of the section: the library's whole theming story is "two data attributes
 *  on `.lq-root`, nothing else", and the only way to *show* that rather than assert it is to put
 *  the four combinations on screen at once. `font` is threaded down from the ambient theme so the
 *  Storybook toolbar's typeface switch still reaches inside the tiles. */
function ThemeTile({ palette, surface, label }: { palette: LqPalette; surface: LqSurface; label: string }) {
  const { font } = useLqTheme();
  return (
    <div className="lqx-theme-tile">
      <LqThemeProvider palette={palette} surface={surface} font={font}>
        <div className="lqx-theme-tile__preview">
          <StatCard label="Valeur du portefeuille" value="42 380 €" delta={3.4} sparklineData={THEME_SPARK} />
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            <Badge tone="up">+3,4 %</Badge>
            <Badge tone="neutral">6 positions</Badge>
          </div>
          <div style={{ marginTop: 14 }}>
            <Sparkline data={THEME_SPARK} colorByTrend area width={220} height={38} />
          </div>
        </div>
      </LqThemeProvider>
      <div className="lqx-theme-tile__label">
        <span>{label}</span>
        <span className="lqx-theme-tile__code">
          {palette}/{surface}
        </span>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: (typeof FEATURES)[number]) {
  return (
    <article className="lqx-feature">
      <span className="lqx-feature__icon">
        <Icon size={19} />
      </span>
      <h3 className="lqx-feature__title">{title}</h3>
      <p className="lqx-feature__body">{body}</p>
    </article>
  );
}

function SectionHead({ eyebrow, title, lead }: { eyebrow: string; title: ReactNode; lead: ReactNode }) {
  return (
    <header className="lqx-section__head">
      <span className="lqx-eyebrow">{eyebrow}</span>
      <h2 className="lqx-section__title">{title}</h2>
      <p className="lqx-section__lead">{lead}</p>
    </header>
  );
}

/** The e-ink home dashboard, sized for the tablet frame. */
function HomeDashboardScreen() {
  return (
    // Two columns normally, one when the tablet itself gets narrow. Routed through a custom
    // property because `columns` lands as an inline style, which no media query could
    // otherwise override.
    <DashboardGrid columns="var(--lqx-tablet-cols, 1fr 1fr)" gap="10px" style={{ padding: 12 }}>
      <DashboardGridItem>
        <ClockWidget time="09:34" date="Jeudi 11 juin" icon={<SunIcon />} />
        <MetricListWidget
          title="Intérieur"
          meta="4 pièces"
          rows={[
            { id: "salon", label: "Salon", value: "19,5°" },
            { id: "bureau", label: "Bureau", value: "19,0°" },
            { id: "parents", label: "Chambre parents", value: "19,6°" },
            { id: "sdb", label: "Salle de bain", value: "18,8°" },
          ]}
        />
      </DashboardGridItem>
      <DashboardGridItem>
        <WeatherWidget
          icon={<PartlyCloudyIcon />}
          temperature="12"
          condition="Partiellement nuageux"
          min="11"
          max="21"
          precipitation="0 %"
        />
        <LightsWidget
          meta="3 allumées"
          lights={[
            { id: "cuisine", label: "Cuisine", on: true, level: 76, statusText: "76 %" },
            { id: "sejour", label: "Séjour", on: true, level: 80, statusText: "80 %" },
            { id: "bureau", label: "Bureau", on: false, level: 0, statusText: "éteint" },
          ]}
        />
        <EnergyWidget
          rows={[
            {
              id: "solar",
              icon: <SolarPanelIcon />,
              label: "Solaire produit aujourd'hui",
              value: "1,0 kWh",
              details: ["442 W à l'instant"],
            },
            { id: "battery", label: "Batterie maison", value: "62 %", gaugePercent: 62 },
          ]}
        />
      </DashboardGridItem>
    </DashboardGrid>
  );
}

export interface LandingPageProps {
  /** Shown in the hero's eyebrow. Read from package.json by the story, so this file never has to
   *  be edited on a release. */
  version: string;
}

export function LandingPage({ version }: LandingPageProps) {
  // The hero chart is the component itself, not a picture of it: whatever a visitor does to it
  // here (zoom, pan, draw, switch display mode) is what the library does in an application.
  const [timeframe, setTimeframe] = useState("1d");

  return (
    <div className="lqx-landing">
      <div className="lqx-backdrop" aria-hidden="true">
        <div className="lqx-backdrop__glow" />
      </div>

      <header className="lqx-hero">
        <span className="lqx-eyebrow">React 18 · TypeScript · v{version}</span>
        <h1 className="lqx-hero__title">
          De la liseuse e-ink au <span className="lqx-hero__accent">terminal de trading</span>.
        </h1>
        <p className="lqx-hero__lead">
          96 composants React et 11 graphiques D3, avec un moteur de scripting qui tourne dans un
          Web Worker et un assistant IA relié au graphique. Quatre thèmes sont livrés : e-ink ou
          couleur, sur surface claire ou sombre. Ils sont pilotés par variables CSS, donc il n'y a
          aucune classe conditionnelle à écrire.
        </p>

        <div className="lqx-hero__actions">
          <Button selected icon={<ArrowRightIcon size={15} />} iconPosition="trailing" onClick={() => openStory(LINKS.candlestick)}>
            Ouvrir le graphique complet
          </Button>
          <Button onClick={() => openStory(LINKS.homeDashboard)}>Le tableau de bord maison</Button>
          <Button onClick={() => openStory(LINKS.primitives)}>Parcourir les composants</Button>
        </div>

        <div className="lqx-hero__install">
          <CodeBlock code={INSTALL_SNIPPET} language="bash" />
        </div>

        <div className="lqx-hero__stage">
          <p className="lqx-hero__hint">
            Ce graphique est le composant lui-même, en état de marche : zoomez à la molette, tirez
            sur un axe, tracez une tendance, changez la palette dans la barre d'outils.
          </p>
          <Laptop caption="CandlestickChart, avec son volume, ses événements, ses indicateurs et ses outils de dessin">
            <CandlestickChart
              data={HERO_CANDLES}
              symbol="MSFT"
              height={392}
              showVolume
              zoomable
              showIndicators
              drawingTools
              events={HERO_EVENTS}
              timeframes={[
                { group: "Jours", options: [{ label: "1 jour", value: "1d" }, { label: "1 semaine", value: "1w" }] },
              ]}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
            />
          </Laptop>
        </div>

        <div className="lqx-figures">
          {FIGURES.map((f) => (
            <Figure key={f.label} {...f} />
          ))}
        </div>
      </header>

      <section className="lqx-section">
        <SectionHead
          eyebrow="Thèmes"
          title="Un composant, quatre rendus."
          lead={
            <>
              Palette et surface sont deux attributs de données posés sur <code>.lq-root</code>.
              Les quatre tuiles ci-dessous contiennent le même <code>StatCard</code>, le même{" "}
              <code>Badge</code> et la même <code>Sparkline</code>. Aucun code conditionnel, aucune
              feuille de style dupliquée.
            </>
          }
        />
        <div className="lqx-themes">
          <ThemeTile palette="eink" surface="light" label="E-ink · clair" />
          <ThemeTile palette="eink" surface="dark" label="E-ink · sombre" />
          <ThemeTile palette="color" surface="light" label="Couleur · clair" />
          <ThemeTile palette="color" surface="dark" label="Couleur · sombre" />
        </div>
      </section>

      <section className="lqx-section">
        <SectionHead
          eyebrow="Fondations"
          title="Ce qu'il y a sous les composants."
          lead="Les composants lisent des variables CSS et jamais des valeurs en dur. Vous pouvez redéfinir ces variables pour habiller vos propres éléments dans le même langage visuel. Ce qui suit se repeint quand vous changez de palette dans la barre d'outils."
        />
        <FoundationsStrip />
      </section>

      <section className="lqx-section">
        <SectionHead
          eyebrow="Un seul kit"
          title="Du salon au bureau."
          lead="La domotique tourne sur une liseuse posée dans l'entrée, le portefeuille sur un téléphone. Les deux écrans ci-dessous sont faits des mêmes composants et des mêmes tokens."
        />
        <div className="lqx-gallery">
          <Tablet caption="Tableau de bord maison, palette eink sur surface claire">
            <LqThemeProvider palette="eink" surface="light">
              <HomeDashboardScreen />
            </LqThemeProvider>
          </Tablet>
          <div className="lqx-gallery__pair">
            <Phone caption="Portefeuille, palette color sur surface sombre">
              <LqThemeProvider palette="color" surface="dark">
                <div style={{ padding: "40px 14px 30px", display: "grid", gap: 12 }}>
                  <PortfolioSummaryWidget
                    meta="6 positions"
                    value="42 380 €"
                    delta={3.4}
                    series={PORTFOLIO_SERIES}
                    formatY={(v) => `${(v / 1000).toFixed(0)} k€`}
                    formatX={(x) => (x as Date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  />
                  <WatchlistWidget
                    items={SAMPLE_HOLDINGS.slice(0, 3).map((h) => ({
                      id: h.id,
                      symbol: h.symbol,
                      name: h.name,
                      quantity: h.quantity,
                      price: h.price,
                      change: h.change,
                    }))}
                  />
                </div>
              </LqThemeProvider>
            </Phone>
          </div>
        </div>
      </section>

      <section className="lqx-section">
        <SectionHead
          eyebrow="Un écran entier"
          title="Une application montée avec le kit."
          lead="L'écran ci-dessous est fait de sept composants de la bibliothèque, sans une ligne de mise en page écrite pour l'occasion. La barre latérale, le fil d'Ariane et le menu utilisateur en font partie."
        />
        <AppShowcase />
      </section>

      <section className="lqx-section">
        <SectionHead
          eyebrow="Graphiques"
          title="Huit des onze graphiques, en fonctionnement."
          lead="Chacun reçoit ses données brutes et se charge des échelles, des axes, du survol et du redimensionnement. Le nom sous chaque cadre ouvre sa documentation."
        />
        <ChartGallery open={openStory} />
      </section>

      <section className="lqx-section">
        <SectionHead
          eyebrow="Ce qu'il y a dedans"
          title="Un catalogue documenté."
          lead="Chaque composant arrive avec ses props typées et sa page de documentation. Les 200 stories de la barre latérale sont cette documentation."
        />
        <div className="lqx-features">
          {FEATURES.map((f) => (
            <Feature key={f.title} {...f} />
          ))}
        </div>
      </section>

      <section className="lqx-section">
        <SectionHead
          eyebrow="Scripting"
          title="Vos propres indicateurs, dans le navigateur."
          lead="Le code s'écrit dans l'éditeur du graphique et s'exécute dans un Web Worker. Un décorateur sur la première ligne dit ce que le script est, et l'API disponible s'ajuste en conséquence."
        />
        <div className="lqx-script-split">
          <CodeBlock code={SCRIPT_SNIPPET} filename="golden-cross.js" highlight="javascript" showLineNumbers />
          <div className="lqx-decorators">
            {DECORATORS.map((d) => (
              <article key={d.name} className="lqx-decorator">
                <code className="lqx-decorator__name">{d.name}</code>
                <p className="lqx-decorator__what">{d.what}</p>
                <p className="lqx-decorator__gets">{d.gets}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lqx-section">
        <SectionHead
          eyebrow="Formulaires"
          title="Les champs de saisie aussi."
          lead="18 composants de formulaire, contrôlés de bout en bout par votre propre état. Le panneau ci-dessous fonctionne : tapez dedans, ouvrez le calendrier, déplacez les curseurs."
        />
        <div className="lqx-forms-wrap">
          <FormsShowcase />
        </div>
      </section>

      <section className="lqx-section">
        <SectionHead
          eyebrow="Le catalogue"
          title="Et les petites briques."
          lead="Boutons, bascules, jauges, badges, étiquettes, barres de progression. Celles qui suivent réagissent au clic. Le nom sous une cellule ouvre sa documentation."
        />
        <CatalogStrip open={openStory} />
      </section>

      <section className="lqx-section">
        <SectionHead
          eyebrow="Prise en main"
          title="Deux fichiers suffisent."
          lead="Un .npmrc qui route le scope vers GitHub Packages, et un provider autour de votre application. Il n'y a ni Tailwind à installer ni thème à générer."
        />
        <div className="lqx-code-split">
          <CodeBlock code={INSTALL_SNIPPET} language="bash" />
          <CodeBlock code={USAGE_SNIPPET} filename="App.tsx" highlight="javascript" showLineNumbers />
        </div>
      </section>

      <section className="lqx-section">
        <SectionHead
          eyebrow="Questions"
          title="Ce qu'on demande le plus souvent."
          lead="Six réponses vérifiables dans le code. Cliquez une question pour la déplier."
        />
        <div className="lqx-faq">
          {FAQ.map((entry) => (
            <Card key={entry.question} expandable title={entry.question}>
              <p className="lqx-faq__answer">{entry.answer}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="lqx-section">
        <div className="lqx-cta">
          <div className="lqx-cta__glow" aria-hidden="true" />
          <h2 className="lqx-cta__title">Ouvrez une story.</h2>
          <p className="lqx-cta__lead">
            Tout ce que montre cette page vient de la barre latérale, dans la version {version}
            {" "}publiée. Rien n'a été mis en scène pour la photo.
          </p>
          <div className="lqx-cta__install">
            <CodeBlock code={INSTALL_SNIPPET} language="bash" />
          </div>
          <div className="lqx-cta__actions">
            <Button selected icon={<ArrowRightIcon size={15} />} iconPosition="trailing" onClick={() => openStory(LINKS.candlestick)}>
              Le graphique, toutes options
            </Button>
            <Button onClick={() => openStory(LINKS.charts)}>Graphiques</Button>
            <Button onClick={() => openStory(LINKS.forms)}>Formulaires</Button>
            <Button onClick={() => openStory(LINKS.icons)}>Icônes</Button>
            <Button onClick={() => openStory(LINKS.typography)}>Typographie</Button>
            <Button onClick={() => openStory(LINKS.pages)}>Pages</Button>
          </div>
        </div>
      </section>

      <p className="lqx-footnote">
        <code>@michaelthomasjach/liseuse-dashboard-kit</code> v{version}, publié sur GitHub
        Packages. <code>react</code>, <code>react-dom</code> et <code>d3</code> restent des
        peerDependencies.
      </p>
    </div>
  );
}
