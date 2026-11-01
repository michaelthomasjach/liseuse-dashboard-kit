import { useId, useState, type ReactNode } from "react";
import { Avatar } from "../components/finance/Avatar";
import { Tabs } from "../components/primitives/Tabs";
import "./ProfilePage.css";

type ProfileTabId = "about" | "activity" | "settings";

export interface ProfilePageProps {
  /** Nom affiché sous la bannière — un vrai `<h1>`. */
  name: string;
  /** Fonction, poste (« Responsable produit chez … »). */
  role?: ReactNode;
  /** Ville, pays. Précédée d'un repère de lieu. */
  location?: ReactNode;
  /** Une ou deux phrases de présentation sous l'identité. */
  bio?: ReactNode;
  /** Photo ; sans, l'avatar montre les initiales de `name`. */
  avatarSrc?: string;
  /** Image de bannière (URL ou data URI), recadrée pour couvrir. */
  bannerSrc?: string;
  /** Sans `bannerSrc` : une couleur pleine (n'importe quelle valeur CSS, `var(--lq-…)` comprise).
   *  Sans les deux, la bannière est une illustration de vagues dessinée aux couleurs du thème. */
  bannerColor?: string;
  /** Boutons d'action à droite de l'identité (« Suivre », « Message », « Modifier le profil »). */
  actions?: ReactNode;
  /** Chiffres-clés sous l'identité : abonnés, projets, ancienneté… */
  stats?: { label: string; value: ReactNode }[];
  /** Contenu de l'onglet « À propos ». Un onglet n'apparaît que si son contenu est fourni. */
  about?: ReactNode;
  /** Contenu de l'onglet « Activité ». */
  activity?: ReactNode;
  /** Contenu de l'onglet « Réglages ». */
  settings?: ReactNode;
  /** Libellés des onglets. */
  tabLabels?: Partial<Record<ProfileTabId, string>>;
  /** Onglet ouvert, contrôlé. */
  tab?: ProfileTabId;
  /** Onglet ouvert au départ, non contrôlé. Défaut : le premier fourni. */
  defaultTab?: ProfileTabId;
  onTabChange?: (tab: ProfileTabId) => void;
  /** Fiche d'informations en tête de la colonne latérale : une ligne par entrée. */
  info?: { label: string; value: ReactNode }[];
  /** Titre de la fiche `info`. */
  infoTitle?: string;
  /** Contenu libre de la colonne latérale, sous la fiche `info` (des `Card`, une liste de contacts). */
  sidebar?: ReactNode;
  /** Occupe au moins toute la hauteur de la fenêtre (`100dvh`). Sans, la page remplit son
   *  conteneur (`min-height: 100%`). */
  fullHeight?: boolean;
  className?: string;
}

const DEFAULT_TAB_LABELS: Record<ProfileTabId, string> = {
  about: "À propos",
  activity: "Activité",
  settings: "Réglages",
};

function MapPinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

/** Bannière par défaut : des vagues superposées, peintes avec les variables du thème — elle suit
 *  donc la palette et la surface, contrairement à une image. */
function DefaultBanner() {
  return (
    <svg className="lq-profile-page__waves" viewBox="0 0 1200 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path className="lq-profile-page__wave lq-profile-page__wave--1" d="M0 150 C 200 90 380 210 600 150 S 1000 80 1200 140 V240 H0Z" />
      <path className="lq-profile-page__wave lq-profile-page__wave--2" d="M0 185 C 240 130 420 235 660 180 S 1020 130 1200 175 V240 H0Z" />
      <path className="lq-profile-page__wave lq-profile-page__wave--3" d="M0 215 C 180 185 420 250 700 210 S 1050 190 1200 205 V240 H0Z" />
      <circle className="lq-profile-page__wave lq-profile-page__wave--sun" cx="930" cy="118" r="30" />
    </svg>
  );
}

/** Page de profil : bannière, avatar en chevauchement, identité et actions, chiffres-clés, onglets
 *  (À propos / Activité / Réglages, contenus passés en slots) et une colonne d'informations. */
export function ProfilePage({
  name,
  role,
  location,
  bio,
  avatarSrc,
  bannerSrc,
  bannerColor,
  actions,
  stats,
  about,
  activity,
  settings,
  tabLabels,
  tab,
  defaultTab,
  onTabChange,
  info,
  infoTitle = "Informations",
  sidebar,
  fullHeight = false,
  className,
}: ProfilePageProps) {
  const labels = { ...DEFAULT_TAB_LABELS, ...tabLabels };
  const panels = { about, activity, settings };
  const available = (Object.keys(panels) as ProfileTabId[]).filter((id) => panels[id] !== undefined && panels[id] !== null);
  const [internalTab, setInternalTab] = useState<ProfileTabId | undefined>(defaultTab);
  const requested = tab ?? internalTab;
  const current = requested && available.includes(requested) ? requested : available[0];
  const panelId = useId();
  const infoTitleId = useId();

  function select(id: string) {
    const next = id as ProfileTabId;
    if (tab === undefined) setInternalTab(next);
    onTabChange?.(next);
  }

  const hasAside = Boolean((info && info.length > 0) || sidebar);

  return (
    <div className={["lq-profile-page", fullHeight && "lq-profile-page--full-height", className].filter(Boolean).join(" ")}>
      <div
        className={["lq-profile-page__banner", !bannerSrc && !bannerColor && "lq-profile-page__banner--illustrated"].filter(Boolean).join(" ")}
        style={bannerSrc ? undefined : bannerColor ? { background: bannerColor } : undefined}
      >
        {bannerSrc ? <img src={bannerSrc} alt="" /> : !bannerColor && <DefaultBanner />}
      </div>

      <header className="lq-profile-page__header">
        <Avatar name={name} src={avatarSrc} size={104} className="lq-profile-page__avatar" />
        <div className="lq-profile-page__identity">
          <h1 className="lq-profile-page__name">{name}</h1>
          {role && <p className="lq-profile-page__role">{role}</p>}
          {location && (
            <p className="lq-profile-page__location">
              <MapPinIcon />
              {location}
            </p>
          )}
        </div>
        {actions && <div className="lq-profile-page__actions">{actions}</div>}
      </header>

      {(bio || (stats && stats.length > 0)) && (
        <div className="lq-profile-page__intro">
          {bio && <div className="lq-profile-page__bio">{bio}</div>}
          {stats && stats.length > 0 && (
            <dl className="lq-profile-page__stats">
              {stats.map((stat) => (
                <div key={stat.label} className="lq-profile-page__stat">
                  <dt>{stat.label}</dt>
                  <dd>{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      <div className={["lq-profile-page__body", hasAside && "lq-profile-page__body--with-aside"].filter(Boolean).join(" ")}>
        {current && (
          <section className="lq-profile-page__main">
            {available.length > 1 && <Tabs items={available.map((id) => ({ id, label: labels[id] }))} value={current} onChange={select} className="lq-profile-page__tabs" />}
            <div id={panelId} className="lq-profile-page__panel" role={available.length > 1 ? "tabpanel" : undefined} aria-label={labels[current]} tabIndex={available.length > 1 ? 0 : undefined}>
              {panels[current]}
            </div>
          </section>
        )}

        {hasAside && (
          <aside className="lq-profile-page__aside">
            {info && info.length > 0 && (
              <section className="lq-profile-page__info" aria-labelledby={infoTitleId}>
                <h2 id={infoTitleId} className="lq-profile-page__info-title">
                  {infoTitle}
                </h2>
                <dl>
                  {info.map((row) => (
                    <div key={row.label} className="lq-profile-page__info-row">
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
            {sidebar}
          </aside>
        )}
      </div>
    </div>
  );
}
