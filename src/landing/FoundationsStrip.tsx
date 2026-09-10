import { useLqTheme } from "../theme";

/** Semantic tokens rather than raw hexadecimal values: these are the names a consumer writes in
 *  their own CSS, and each one resolves differently in the four palette/surface combinations. */
const COLOR_TOKENS = [
  "--lq-color-bg",
  "--lq-color-panel",
  "--lq-color-text",
  "--lq-color-text-muted",
  "--lq-color-border",
  "--lq-color-fill",
  "--lq-color-up",
  "--lq-color-down",
  "--lq-color-green",
  "--lq-color-rose",
  "--lq-color-amber",
  "--lq-color-sky",
  "--lq-color-violet",
  "--lq-color-warning",
];

const TYPE_SCALE: { token: string; sample: string }[] = [
  { token: "--lq-text-h2", sample: "Titre de section" },
  { token: "--lq-text-h4", sample: "Sous-titre" },
  { token: "--lq-text-md", sample: "Texte courant" },
  { token: "--lq-text-sm", sample: "Légende de graphique" },
  { token: "--lq-text-xs", sample: "Mention et unité" },
];

const FONTS: { id: string; label: string }[] = [
  { id: "space-grotesk", label: "Space Grotesk" },
  { id: "manrope", label: "Manrope" },
  { id: "sora", label: "Sora" },
  { id: "inter", label: "Inter" },
  { id: "ibm-plex-sans", label: "IBM Plex Sans" },
];

/** The layer under every component: the CSS custom properties a consumer can read, override and
 *  build on. Shown live, so switching the palette in the toolbar repaints the swatches. */
export function FoundationsStrip() {
  const { font } = useLqTheme();

  return (
    <div className="lqx-foundations">
      <section className="lqx-found-card lqx-found-card--wide">
        <h3 className="lqx-found-card__title">Couleurs</h3>
        <p className="lqx-found-card__note">
          14 tokens sémantiques, redéfinis par palette et par surface. Un composant ne connaît
          jamais une valeur hexadécimale.
        </p>
        <ul className="lqx-swatches">
          {COLOR_TOKENS.map((token) => (
            <li key={token} className="lqx-swatch">
              <span className="lqx-swatch__chip" style={{ backgroundColor: `var(${token})` }} />
              <code className="lqx-swatch__name">{token.replace("--lq-color-", "")}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className="lqx-found-card">
        <h3 className="lqx-found-card__title">Échelle typographique</h3>
        <p className="lqx-found-card__note">
          Six niveaux de titre et cinq tailles de texte, en rem, avec leur interlignage.
        </p>
        <ul className="lqx-typescale">
          {TYPE_SCALE.map(({ token, sample }) => (
            <li key={token} className="lqx-typescale__row">
              <span style={{ fontSize: `var(${token})`, lineHeight: 1.25 }}>{sample}</span>
              <code className="lqx-typescale__token">{token}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className="lqx-found-card">
        <h3 className="lqx-found-card__title">Familles</h3>
        <p className="lqx-found-card__note">
          Cinq piles de polices, sélectionnables par la prop <code>font</code>. Celle qui est active
          est repérée ci-dessous. La police elle-même se charge côté application.
        </p>
        <ul className="lqx-fonts">
          {FONTS.map(({ id, label }) => (
            <li
              key={id}
              className={["lqx-fonts__row", id === font && "lqx-fonts__row--active"].filter(Boolean).join(" ")}
              style={{ fontFamily: `var(--lq-font-${id})` }}
            >
              <span>{label}</span>
              <span className="lqx-fonts__sample">Aa Bb 0123</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
