import { Modal } from "../../../primitives/Modal";
import { DetachWindowIcon } from "../../../icons";
import { DetachedWindow } from "./DetachedWindow";
import type { MarketStateSettings } from "../marketStateSettings";
import "./MarketStateHelpModal.css";

export interface MarketStateHelpModalProps {
  open: boolean;
  onClose: () => void;
  /** Read only to print the reader's own neutral band in the drawings, rather than the default —
   *  an explanation describing settings someone has already changed is worse than none. */
  settings: MarketStateSettings;
  /** The window this has been torn off into, or null. */
  detachedWindow: Window | null;
  onDetach: () => void;
  onDetachedClose: () => void;
  themeSource: HTMLElement | null;
}

/** One step of the pipeline, drawn. The whole panel is this same thing repeated, and seeing it once
 *  makes every number in it readable. */
function PipelineDiagram() {
  return (
    <svg className="lq-ms-help__figure" viewBox="0 0 460 96" role="img" aria-label="Un indicateur devient un score sur 100, puis un camp">
      <rect x="2" y="24" width="110" height="40" className="lq-ms-help__box" />
      <text x="57" y="42" textAnchor="middle" className="lq-ms-help__box-title">
        RSI(14)
      </text>
      <text x="57" y="56" textAnchor="middle" className="lq-ms-help__box-sub">
        vaut 63,4
      </text>

      <path d="M118 44 H160" className="lq-ms-help__arrow" markerEnd="url(#lq-ms-help-arrow)" />
      <text x="139" y="36" textAnchor="middle" className="lq-ms-help__box-sub">
        traduit
      </text>

      <rect x="166" y="24" width="110" height="40" className="lq-ms-help__box" />
      <text x="221" y="42" textAnchor="middle" className="lq-ms-help__box-title">
        68 / 100
      </text>
      <text x="221" y="56" textAnchor="middle" className="lq-ms-help__box-sub">
        son score
      </text>

      <path d="M282 44 H324" className="lq-ms-help__arrow" markerEnd="url(#lq-ms-help-arrow)" />
      <text x="303" y="36" textAnchor="middle" className="lq-ms-help__box-sub">
        seuils
      </text>

      <rect x="330" y="24" width="126" height="40" className="lq-ms-help__box lq-ms-help__box--up" />
      <text x="393" y="42" textAnchor="middle" className="lq-ms-help__box-title">
        vote LONG
      </text>
      <text x="393" y="56" textAnchor="middle" className="lq-ms-help__box-sub">
        68 ≥ seuil 60
      </text>

      <defs>
        <marker id="lq-ms-help-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--lq-color-text-muted)" />
        </marker>
      </defs>
    </svg>
  );
}

/** The scale the signal is read on: 0 to 100, the neutral band in the middle. */
function SignalScale({ band }: { band: number }) {
  const low = 50 - band;
  const high = 50 + band;
  return (
    <svg className="lq-ms-help__figure" viewBox="0 0 460 60" role="img" aria-label={`Échelle du signal, bande neutre de ${low} à ${high}`}>
      <rect x="0" y="14" width="460" height="18" fill="var(--lq-color-down)" opacity="0.2" />
      <rect x={(low / 100) * 460} y="14" width={((high - low) / 100) * 460} height="18" fill="var(--lq-color-text-muted)" opacity="0.2" />
      <rect x={(high / 100) * 460} y="14" width={460 - (high / 100) * 460} height="18" fill="var(--lq-color-up)" opacity="0.2" />
      <line x1="230" y1="8" x2="230" y2="38" stroke="var(--lq-color-text)" strokeWidth="1" />
      <text x="4" y="52" className="lq-ms-help__box-sub">
        0 · short franc
      </text>
      <text x="230" y="52" textAnchor="middle" className="lq-ms-help__box-sub">
        {low} à {high} · aucun camp
      </text>
      <text x="456" y="52" textAnchor="end" className="lq-ms-help__box-sub">
        100 · long franc
      </text>
      <text x="230" y="10" textAnchor="middle" className="lq-ms-help__box-sub">
        50
      </text>
    </svg>
  );
}

/** The same eight sources, read two ways — which is the one thing worth understanding here. */
function DisagreementDiagram() {
  return (
    <svg
      className="lq-ms-help__figure"
      viewBox="0 0 460 132"
      role="img"
      aria-label="Deux marchés différents : huit sources faibles, contre une forte contre trois faibles"
    >
      <text x="0" y="12" className="lq-ms-help__box-title">
        A · huit sources, toutes un peu longues
      </text>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={i * 58} y="18" width="50" height="14" fill="var(--lq-color-up)" opacity="0.35" />
      ))}
      <text x="0" y="46" className="lq-ms-help__box-sub">
        vote LONG 100 % · signal 57 — tout le monde est d&apos;accord, personne n&apos;est convaincu
      </text>

      <text x="0" y="80" className="lq-ms-help__box-title">
        B · une source très longue, trois un peu shorts
      </text>
      <rect x="0" y="86" width="50" height="14" fill="var(--lq-color-up)" opacity="0.85" />
      {[1, 2, 3].map((i) => (
        <rect key={i} x={i * 58} y="86" width="50" height="14" fill="var(--lq-color-down)" opacity="0.3" />
      ))}
      <text x="0" y="114" className="lq-ms-help__box-sub">
        vote SHORT 75 % · signal 56 — la majorité penche short, la force est du côté long
      </text>
    </svg>
  );
}

const AXES: { label: string; what: string; reads: string }[] = [
  { label: "TREND", what: "Le sens du marché.", reads: "50 = aucune direction. Au-dessus, il monte. En dessous, il descend." },
  { label: "MOM", what: "La vitesse du mouvement en cours.", reads: "50 = à l'équilibre. Indépendant du sens de fond." },
  { label: "VOL", what: "L'amplitude des mouvements.", reads: "Rapportée à l'habitude de cet instrument. 100 = agité comme jamais." },
  { label: "FLOW", what: "Le volume derrière le mouvement.", reads: "50 = volume ordinaire. Haut = du vrai monde échange." },
  { label: "RISK", what: "Ce qui joue contre une position.", reads: "Bas vaut mieux que haut. Seul axe compté à l'envers." },
];

/** What every part of the Market State readout means.
 *
 *  Written because the two figures the panel leads with answer different questions and look like
 *  they answer the same one. Short paragraphs and drawings rather than prose: this is read once, in
 *  a hurry, by someone who has just noticed two numbers disagreeing — not studied. */
function HelpBody({ settings }: { settings: MarketStateSettings }) {
  const band = settings.neutralBand;
  return (
    <div className="lq-ms-help">
      <p className="lq-ms-help__lead">
        Ce panneau lit les indicateurs qui sont <strong>déjà sur le graphique</strong> et les résume. Il n&apos;ajoute
        aucune donnée.
      </p>

      <section className="lq-ms-help__section">
        <h4 className="lq-ms-help__title">1 · Comment une source devient un vote</h4>
        <p>
          Chaque indicateur est traduit en un <strong>score sur 100</strong>. Puis deux seuils décident de son camp.
        </p>
        <PipelineDiagram />
        <p>
          Au-dessus du seuil haut, la source vote <strong>long</strong>. En dessous du seuil bas, elle vote{" "}
          <strong>short</strong>. Entre les deux, elle est <strong>neutre</strong>.
        </p>
        <p className="lq-ms-help__note">Les deux seuils se règlent source par source, dans la roue crantée.</p>
      </section>

      <section className="lq-ms-help__section">
        <h4 className="lq-ms-help__title">2 · Les trois cases du haut : qui vote quoi</h4>
        <p>
          Elles comptent les voix. Chaque case est la <strong>part du poids total</strong> qui lit le marché dans ce
          sens-là.
        </p>
        <p>
          Les trois font toujours 100 %. Une source dont l&apos;axe ne compte pas dans le signal ne vote pas ici non
          plus.
        </p>
      </section>

      <section className="lq-ms-help__section">
        <h4 className="lq-ms-help__title">3 · La case du bas : la force</h4>
        <p>
          Le signal est une <strong>moyenne pondérée des cinq axes</strong>, lue du côté long.
        </p>
        <SignalScale band={band} />
        <p>
          Entre <strong>{50 - band}</strong> et <strong>{50 + band}</strong>, il est neutre : les axes se contredisent
          trop pour dire quoi que ce soit.
        </p>
        <p>
          Le pourcentage est retourné du côté où il tombe. Un signal à 26 s&apos;affiche <strong>SHORT 74 %</strong>,
          parce que c&apos;est ainsi qu&apos;il se lit.
        </p>
      </section>

      <section className="lq-ms-help__section">
        <h4 className="lq-ms-help__title">4 · Pourquoi les deux peuvent se contredire</h4>
        <p>
          Parce qu&apos;ils ne répondent pas à la même question. Le vote dit <strong>combien</strong> de sources
          penchent d&apos;un côté. La moyenne dit <strong>avec quelle force</strong>.
        </p>
        <DisagreementDiagram />
        <p>
          Quand les deux divergent, c&apos;est une information sur le marché : un accord sans conviction, ou une
          conviction isolée. <strong>Ce n&apos;est pas une incohérence du panneau.</strong>
        </p>
      </section>

      <section className="lq-ms-help__section">
        <h4 className="lq-ms-help__title">5 · Les cinq axes</h4>
        <dl className="lq-ms-help__axes">
          {AXES.map((axis) => (
            <div key={axis.label} className="lq-ms-help__axis">
              <dt>{axis.label}</dt>
              <dd>
                <strong>{axis.what}</strong>
                <span className="lq-ms-help__note"> {axis.reads}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="lq-ms-help__note">
          Cliquer une ligne ouvre ce qui l&apos;a nourrie : quel indicateur, ce qu&apos;il vaut, ce que ça donne sur 100,
          son poids, et le calcul avec les nombres de cette bougie déjà remplacés.
        </p>
      </section>

      <section className="lq-ms-help__section">
        <h4 className="lq-ms-help__title">6 · Les zones colorées</h4>
        <p>
          La case « Surligner les zones » teinte le graphique : <strong>vert</strong> pour long, <strong>gris</strong>{" "}
          pour neutre, <strong>rouge</strong> pour short.
        </p>
        <p>
          C&apos;est la même fonction que celle qui remplit ce panneau, calculée <strong>barre par barre</strong>. La
          couleur sous une bougie dit donc exactement ce que dirait le panneau en la survolant.
        </p>
      </section>

      <section className="lq-ms-help__section">
        <h4 className="lq-ms-help__title">7 · Une seule bougie à la fois</h4>
        <p>
          Tout ce qui est affiché décrit <strong>une</strong> bougie : la dernière visible, ou celle que survole le
          pointeur.
        </p>
        <p className="lq-ms-help__note">Sa date est rappelée en bas du panneau.</p>
      </section>
    </div>
  );
}

export function MarketStateHelpModal({
  open,
  onClose,
  settings,
  detachedWindow,
  onDetach,
  onDetachedClose,
  themeSource,
}: MarketStateHelpModalProps) {
  if (detachedWindow !== null) {
    return (
      <DetachedWindow
        target={detachedWindow}
        themeSource={themeSource}
        title="Comprendre l'état du marché"
        onClose={onDetachedClose}
        layout="page"
      >
        <HelpBody settings={settings} />
      </DetachedWindow>
    );
  }

  if (!open) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Comprendre l'état du marché"
      size="wide"
      headerActions={
        <button
          type="button"
          className="lq-ms-help__detach"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDetach}
          aria-label="Ouvrir dans une nouvelle fenêtre"
          title="Ouvrir dans une nouvelle fenêtre"
        >
          <DetachWindowIcon size={14} />
        </button>
      }
      footer={
        <div className="lq-chart__edit-drawing-footer">
          <button type="button" className="lq-chart__confirm-button" onClick={onClose}>
            Fermer
          </button>
        </div>
      }
    >
      <HelpBody settings={settings} />
    </Modal>
  );
}
