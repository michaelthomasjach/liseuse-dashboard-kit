import { PRIMITIVE_USAGE_BY_STORY } from "../src/storybookPrimitiveUsage";

/** Les primitives sur lesquelles la story repose, avec un lien vers leur documentation.
 *
 *  Demandé explicitement : « quand tu utilises un composant dans le storybook qui provient des
 *  primitives, je veux que tu ajoutes le lien vers le composant primitive pour facilement avoir
 *  accès à la documentation ». La liste est dérivée des imports du code (voir
 *  `scripts/generatePrimitiveUsage.cjs`) plutôt qu'écrite story par story : à plus de deux cents
 *  stories, une liste tenue à la main serait fausse dès la première refactorisation.
 *
 *  Rendu au-dessus du canvas, discrètement : c'est un raccourci de lecture, pas un élément de la
 *  démonstration. `top` cible la fenêtre de Storybook depuis l'iframe du canvas — sans quoi le lien
 *  ouvrirait la page de doc *dans* le cadre de la story. */
export function PrimitiveLinks({ title }: { title?: string }) {
  const used = title ? PRIMITIVE_USAGE_BY_STORY[title] : undefined;
  if (!used || used.length === 0) return null;
  return (
    <nav
      aria-label="Primitives utilisées"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        gap: "6px",
        marginBottom: "16px",
        fontSize: "11px",
        color: "var(--lq-color-text-muted)",
      }}
    >
      <span>Primitives utilisées :</span>
      {used.map(({ name, docsId }) => (
        <a
          key={name}
          href={`?path=/docs/${docsId}`}
          target="_top"
          style={{
            color: "var(--lq-color-text)",
            textDecoration: "none",
            border: "1px solid var(--lq-color-border)",
            borderRadius: "4px",
            padding: "1px 6px",
          }}
        >
          {name}
        </a>
      ))}
    </nav>
  );
}
