import { Modal } from "../../../../primitives/Modal";
import { DetachWindowIcon } from "../../../../icons";
import { DetachedWindow } from "../../components/DetachedWindow";
import "./Broker.css";

export interface BrokerHelpModalProps {
  open: boolean;
  onClose: () => void;
  /** The separate window this content has been moved to, when the host offers that. All four are
   *  optional together: detaching is a feature a host opts into, and one that does not should not
   *  have to invent three callbacks and a null to open a help dialog. Omitted, the modal simply
   *  has no "open in a window" button. */
  detachedWindow?: Window | null;
  onDetach?: () => void;
  onDetachedClose?: () => void;
  themeSource?: HTMLElement | null;
}

/** The three routes a signal can take, drawn. The difference between them is who decides, and that
 *  is easier to see than to read. */
function ModesDiagram() {
  return (
    <svg className="lq-broker-help__figure" viewBox="0 0 460 150" role="img" aria-label="Les trois modes de passage d'ordres">
      <rect x="0" y="62" width="92" height="30" className="lq-broker-help__box" />
      <text x="46" y="81" textAnchor="middle" className="lq-broker-help__box-title">
        signal
      </text>

      <path d="M96 77 H132" className="lq-broker-help__arrow" markerEnd="url(#lq-broker-arrow)" />

      <rect x="136" y="8" width="150" height="30" className="lq-broker-help__box" />
      <text x="211" y="27" textAnchor="middle" className="lq-broker-help__box-title">
        Manuel
      </text>
      <rect x="136" y="62" width="150" height="30" className="lq-broker-help__box" />
      <text x="211" y="81" textAnchor="middle" className="lq-broker-help__box-title">
        Confirmation
      </text>
      <rect x="136" y="116" width="150" height="30" className="lq-broker-help__box lq-broker-help__box--live" />
      <text x="211" y="135" textAnchor="middle" className="lq-broker-help__box-title">
        Automatique
      </text>

      <path d="M290 23 H336" className="lq-broker-help__arrow" markerEnd="url(#lq-broker-arrow)" />
      <path d="M290 77 H336" className="lq-broker-help__arrow" markerEnd="url(#lq-broker-arrow)" />
      <path d="M290 131 H336" className="lq-broker-help__arrow" markerEnd="url(#lq-broker-arrow)" />

      <text x="342" y="27" className="lq-broker-help__box-sub">
        un ticket, vous cliquez
      </text>
      <text x="342" y="72" className="lq-broker-help__box-sub">
        un compte à rebours,
      </text>
      <text x="342" y="85" className="lq-broker-help__box-sub">
        abandonné s&apos;il expire
      </text>
      <text x="342" y="135" className="lq-broker-help__box-sub">
        parti, si armé
      </text>

      <defs>
        <marker id="lq-broker-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--lq-color-text-muted)" />
        </marker>
      </defs>
    </svg>
  );
}

function HelpBody() {
  return (
    <div className="lq-broker-help">
      <p className="lq-broker-help__lead">
        Cette bibliothèque <strong>ne se connecte à aucun courtier</strong> et n&apos;en fournit aucun.
      </p>

      <section className="lq-broker-help__section">
        <h4 className="lq-broker-help__title">1 · Qui fait quoi</h4>
        <p>
          Elle affiche les formulaires, assemble les ordres, applique vos plafonds et tient le journal. Tous les appels
          qui sortent du navigateur appartiennent à l&apos;application qui l&apos;utilise, via un{" "}
          <strong>adaptateur</strong> qu&apos;elle fournit.
        </p>
        <p>
          Ce n&apos;est pas une limite à contourner, c&apos;est la conception. Une bibliothèque front qui garderait vos
          identifiants les garderait <strong>dans un navigateur</strong>, lisibles par quiconque ouvre les outils de
          développement. Et une bibliothèque front qui passerait les ordres elle-même les passerait depuis une page que
          n&apos;importe qui peut inspecter.
        </p>
        <p className="lq-broker-help__note">
          Ce que vous tapez dans la fenêtre de connexion part directement à cet adaptateur. Rien n&apos;est conservé
          ici : ni au-delà de la fenêtre, ni dans le navigateur.
        </p>
      </section>

      <section className="lq-broker-help__section">
        <h4 className="lq-broker-help__title">2 · Les trois modes</h4>
        <ModesDiagram />
        <p>
          <strong>Manuel</strong> — un signal prépare un ticket pré-rempli. Rien ne part sans un clic.
        </p>
        <p>
          <strong>Confirmation</strong> — un signal ouvre un ordre en attente avec un compte à rebours. Non confirmé à
          temps, il est <strong>abandonné, jamais envoyé en retard</strong> : le marché sur lequel il a été calculé
          n&apos;existe plus.
        </p>
        <p>
          <strong>Automatique</strong> — un signal part, tant que l&apos;automatisation est <strong>armée</strong>.
          C&apos;est le seul mode qui peut engager de l&apos;argent sans personne devant l&apos;écran.
        </p>
      </section>

      <section className="lq-broker-help__section">
        <h4 className="lq-broker-help__title">3 · L&apos;armement</h4>
        <p>
          Le mode automatique ne suffit pas : il faut l&apos;armer. L&apos;armement <strong>survit au rechargement de
          la page</strong> — c&apos;est un choix de configuration assumé, et cela veut dire qu&apos;un onglet rouvert
          peut recommencer à passer des ordres sans action de votre part.
        </p>
        <p>
          C&apos;est pourquoi le bandeau d&apos;armement est ce qu&apos;il y a de plus visible dans le panneau, et
          pourquoi il rappelle l&apos;environnement. Il se désarme seul dans quatre cas :
        </p>
        <ul className="lq-broker-help__list">
          <li>un plafond dépassé,</li>
          <li>un ordre rejeté par le courtier,</li>
          <li>un changement de mode,</li>
          <li>une déconnexion.</li>
        </ul>
        <p className="lq-broker-help__note">
          Le bouton <strong>« Tout couper »</strong> désarme, abandonne ce qui attendait et revient en manuel. Il ne
          ferme <em>pas</em> vos positions : fermer est une opération de marché à part entière, et un bouton de sécurité
          qui vend tout seul n&apos;est pas une sécurité.
        </p>
      </section>

      <section className="lq-broker-help__section">
        <h4 className="lq-broker-help__title">4 · Les plafonds</h4>
        <p>Ils s&apos;appliquent à tout, quel que soit le mode, et sont demandés à la connexion.</p>
        <ul className="lq-broker-help__list">
          <li>
            <strong>Taille max. par ordre</strong> — au-delà, refusé.
          </li>
          <li>
            <strong>Ordres par jour</strong> — tentatives comprises : un ordre rejeté par le courtier a quand même
            consommé un essai, et une stratégie qui se fait rejeter cinquante fois est exactement ce à quoi sert ce
            plafond.
          </li>
          <li>
            <strong>Perte max. du jour</strong> — calculée sur le résultat que <em>votre</em> application rapporte.
            Cette bibliothèque ne voit aucune exécution ; si l&apos;information n&apos;est pas transmise, le panneau
            affiche « perte du jour inconnue » plutôt que de laisser croire à un garde-fou qui ne peut pas se
            déclencher.
          </li>
          <li>
            <strong>Risque max. par ordre</strong> — taille × distance au stop. Inconnu si le courtier ne donne pas la
            valeur du tick, et un risque inconnu est affiché comme tel, jamais comme zéro.
          </li>
        </ul>
        <p>
          En mode automatique, deux choses de plus sont <strong>exigées</strong> : un stop, et un risque chiffrable. Ce
          sont les deux que quelqu&apos;un devant l&apos;écran aurait remarquées.
        </p>
        <p className="lq-broker-help__note">
          Ces deux exigences valent tant que le mode est automatique, y compris pour un ordre que vous tapez vous-même :
          le mode décrit le régime dans lequel se trouve la connexion, pas seulement la provenance d&apos;un ordre.
        </p>
      </section>

      <section className="lq-broker-help__section">
        <h4 className="lq-broker-help__title">5 · Doublons et ré-essais</h4>
        <p>
          Chaque ordre porte un <strong>identifiant client</strong> généré une fois. Renvoyé tel quel à chaque
          tentative, il permet à un courtier qui l&apos;honore de ne pas ouvrir deux positions à partir d&apos;une seule
          intention — un double-clic, un ré-essai après un délai d&apos;attente.
        </p>
        <p>
          <strong>Aucun ré-essai automatique.</strong> Un ordre en échec est signalé et s&apos;arrête là : cette
          bibliothèque ne peut pas savoir si un ordre expiré est réellement passé, et se tromper là-dessus coûte de
          l&apos;argent.
        </p>
      </section>

      <section className="lq-broker-help__section">
        <h4 className="lq-broker-help__title">6 · Le journal</h4>
        <p>
          Toutes les tentatives y figurent, <strong>y compris celles refusées ici</strong>, avant d&apos;atteindre le
          courtier. « Pourquoi rien ne s&apos;est passé » est la question que cette fonctionnalité recevra le plus
          souvent, et un journal qui n&apos;enregistre que les succès ne peut pas y répondre.
        </p>
      </section>
    </div>
  );
}

export function BrokerHelpModal({ open, onClose, detachedWindow = null, onDetach, onDetachedClose, themeSource = null }: BrokerHelpModalProps) {
  // Both, not just the window: the detached view needs somewhere to report its own closing, and a
  // host that gave a window but no `onDetachedClose` would leave it unclosable from inside.
  if (detachedWindow !== null && onDetachedClose !== undefined) {
    return (
      <DetachedWindow target={detachedWindow} themeSource={themeSource} title="Passage d'ordres" onClose={onDetachedClose} layout="page">
        <HelpBody />
      </DetachedWindow>
    );
  }
  if (!open) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title="Passer des ordres depuis une stratégie"
      size="wide"
      headerActions={
        // No button at all when the host did not offer detaching — an affordance for a feature
        // that is not there is worse than its absence.
        onDetach === undefined ? undefined : (
          <button
            type="button"
            className="lq-broker__header-help"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onDetach}
            aria-label="Ouvrir dans une nouvelle fenêtre"
            title="Ouvrir dans une nouvelle fenêtre"
          >
            <DetachWindowIcon size={14} />
          </button>
        )
      }
      footer={
        <div className="lq-chart__edit-drawing-footer">
          <button type="button" className="lq-chart__confirm-button" onClick={onClose}>
            Fermer
          </button>
        </div>
      }
    >
      <HelpBody />
    </Modal>
  );
}
