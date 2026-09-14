import { Modal } from "../../../primitives/Modal";
import type { MarketStateSettings } from "../marketStateSettings";
import "./MarketStateHelpModal.css";

export interface MarketStateHelpModalProps {
  open: boolean;
  onClose: () => void;
  /** Read only to print the reader's own neutral band in the drawing, rather than the default —
   *  an explanation that describes settings someone has already changed is worse than none. */
  settings: MarketStateSettings;
}

const AXES: { label: string; what: string; reads: string }[] = [
  {
    label: "TREND",
    what: "Dans quel sens le marché est orienté, et avec quelle conviction.",
    reads: "50 = sans direction. Haut = orienté à la hausse, bas = à la baisse.",
  },
  {
    label: "VOL",
    what: "L'amplitude des mouvements, rapportée à l'habitude de cet instrument.",
    reads: "100 = agité comme jamais sur la fenêtre. Ni bon ni mauvais en soi — d'où son poids nul par défaut dans le signal.",
  },
  {
    label: "FLOW",
    what: "Si les échanges accompagnent le mouvement ou le subissent.",
    reads: "50 = volume ordinaire. Haut = le mouvement est porté par du volume réel.",
  },
  {
    label: "MOM",
    what: "La vitesse du mouvement en cours, indépendamment de sa direction de fond.",
    reads: "50 = à l'équilibre.",
  },
  {
    label: "RISK",
    what: "Ce qui joue contre une position : volatilité, repli, absence de tendance, proximité d'un niveau.",
    reads: "Bas vaut mieux que haut. C'est le seul axe compté à l'envers dans le signal.",
  },
];

/** The scale the signal is read on, drawn rather than described: 0 to 100, the neutral band in the
 *  middle, short on the left and long on the right. A sentence saying "58 is a weak long" is a
 *  sentence the reader has to hold in their head; a picture of where 58 falls is not. */
function SignalScale({ band }: { band: number }) {
  const low = 50 - band;
  const high = 50 + band;
  return (
    <svg className="lq-ms-help__scale" viewBox="0 0 300 46" role="img" aria-label={`Échelle du signal, bande neutre de ${low} à ${high}`}>
      <rect x="0" y="10" width="300" height="12" fill="var(--lq-color-down)" opacity="0.18" />
      <rect x={low * 3} y="10" width={(high - low) * 3} height="12" fill="var(--lq-color-text-muted)" opacity="0.18" />
      <rect x={high * 3} y="10" width={300 - high * 3} height="12" fill="var(--lq-color-up)" opacity="0.18" />
      <line x1="150" y1="6" x2="150" y2="26" stroke="var(--lq-color-text)" strokeWidth="1" />
      <text x="4" y="38" className="lq-ms-help__scale-text">
        0 · short franc
      </text>
      <text x="150" y="38" textAnchor="middle" className="lq-ms-help__scale-text">
        {low}–{high} · neutre
      </text>
      <text x="296" y="38" textAnchor="end" className="lq-ms-help__scale-text">
        100 · long franc
      </text>
    </svg>
  );
}

/** The vote, drawn: one bar split three ways. What the three cells at the top of the readout are,
 *  and the thing that makes them different from the single figure at the bottom. */
function StanceBar() {
  return (
    <svg className="lq-ms-help__stance" viewBox="0 0 300 34" role="img" aria-label="Exemple de répartition : 5 sources longues, 2 neutres, 1 short">
      <rect x="0" y="8" width="187" height="14" fill="var(--lq-color-up)" opacity="0.35" />
      <rect x="187" y="8" width="75" height="14" fill="var(--lq-color-text-muted)" opacity="0.3" />
      <rect x="262" y="8" width="38" height="14" fill="var(--lq-color-down)" opacity="0.35" />
      <text x="93" y="31" textAnchor="middle" className="lq-ms-help__scale-text">
        LONG 62 %
      </text>
      <text x="224" y="31" textAnchor="middle" className="lq-ms-help__scale-text">
        NEUTRE 25 %
      </text>
      <text x="296" y="31" textAnchor="end" className="lq-ms-help__scale-text">
        SHORT 13 %
      </text>
    </svg>
  );
}

/** What every part of the Market State readout means.
 *
 *  Written because the two numbers it leads with answer different questions and look like they
 *  answer the same one: the three cells at the top are a *vote*, the figure at the bottom is an
 *  *average*, and a reader with no way to know that will eventually see them disagree and conclude
 *  the panel is broken. Everything else here follows from explaining that one distinction properly.
 */
export function MarketStateHelpModal({ open, onClose, settings }: MarketStateHelpModalProps) {
  if (!open) return null;
  const band = settings.neutralBand;

  return (
    <Modal
      open
      onClose={onClose}
      title="Comprendre l'état du marché"
      size="wide"
      footer={
        <div className="lq-chart__edit-drawing-footer">
          <button type="button" className="lq-chart__confirm-button" onClick={onClose}>
            Fermer
          </button>
        </div>
      }
    >
      <div className="lq-ms-help">
        <p className="lq-ms-help__lead">
          Ce panneau lit les indicateurs présents sur le graphique et les résume. Il n'ajoute aucune donnée : tout ce qu'il
          affiche vient de ce qui est déjà à l'écran, plus deux mesures tirées du prix et du volume seuls. Chaque chiffre
          s'ouvre sur le détail de ce qui l'a produit — c'est la règle de ce panneau, un nombre qu'on ne peut pas
          discuter ne vaut rien.
        </p>

        <section className="lq-ms-help__section">
          <h4 className="lq-ms-help__title">Les trois cases du haut : le vote</h4>
          <p>
            Chaque source — un indicateur, ou l'une des deux mesures de base — lit le marché sur une échelle de 0 à 100.
            Ses propres seuils décident du camp dans lequel elle tombe : au-dessus du seuil « long » elle vote long,
            en dessous du seuil « short » elle vote short, entre les deux elle est neutre. Les trois cases sont la part
            du poids total que représente chaque camp. Elles totalisent toujours 100 %.
          </p>
          <StanceBar />
          <p className="lq-ms-help__note">
            Les seuils de chaque source se règlent dans la roue crantée, à côté de cette icône. Une source dont l'axe ne
            compte pas dans le signal ne vote pas non plus ici.
          </p>
        </section>

        <section className="lq-ms-help__section">
          <h4 className="lq-ms-help__title">La case du bas : la moyenne</h4>
          <p>
            Le signal est une moyenne pondérée des axes, lue du côté long : 0 est un short franc, 100 un long franc, 50 le
            milieu. Entre {50 - band} et {50 + band} il est dit neutre — les axes se contredisent trop pour qu'il dise
            quoi que ce soit. Le pourcentage affiché est retourné du côté où il tombe : un signal à 26 s'affiche
            « SHORT 74 % », parce que c'est ainsi qu'il se lit.
          </p>
          <SignalScale band={band} />
        </section>

        <section className="lq-ms-help__section">
          <h4 className="lq-ms-help__title">Pourquoi les deux peuvent ne pas dire la même chose</h4>
          <p>
            Parce qu'ils répondent à deux questions différentes. Le vote dit <em>combien</em> de sources penchent d'un
            côté ; la moyenne dit <em>avec quelle force</em>. Huit sources mollement longues font un vote « LONG 100 % »
            et un signal à 57. Une source très longue contre trois légèrement shorts fait l'inverse. Quand les deux
            divergent, c'est une information sur le marché — un accord sans conviction, ou une conviction isolée — pas
            une incohérence du panneau.
          </p>
        </section>

        <section className="lq-ms-help__section">
          <h4 className="lq-ms-help__title">Les cinq axes</h4>
          <dl className="lq-ms-help__axes">
            {AXES.map((axis) => (
              <div key={axis.label} className="lq-ms-help__axis">
                <dt>{axis.label}</dt>
                <dd>
                  {axis.what}
                  <span className="lq-ms-help__note"> {axis.reads}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="lq-ms-help__note">
            Cliquer une ligne ouvre la liste de ce qui l'a nourrie : quel indicateur, ce qu'il vaut actuellement, ce que
            ça donne sur 100, son poids, et le calcul avec les nombres de cette bougie déjà remplacés.
          </p>
        </section>

        <section className="lq-ms-help__section">
          <h4 className="lq-ms-help__title">Les zones colorées sur le graphique</h4>
          <p>
            La case « Surligner les zones » teinte le graphique de la lecture faite à chaque bougie : vert pour long, gris
            pour neutre, rouge pour short. C'est la même fonction que celle qui remplit ce panneau, calculée barre par
            barre — la couleur sous une bougie dit donc exactement ce que dirait le panneau en la survolant. Les trois
            couleurs se règlent juste en dessous de la case.
          </p>
        </section>

        <section className="lq-ms-help__section">
          <h4 className="lq-ms-help__title">La bougie lue</h4>
          <p>
            Tout ce que montre ce panneau décrit <em>une</em> bougie : la dernière visible, ou celle que survole le
            pointeur. Sa date est rappelée en bas du panneau, pour qu'une lecture survolée ne soit jamais prise pour la
            lecture du moment.
          </p>
        </section>
      </div>
    </Modal>
  );
}
