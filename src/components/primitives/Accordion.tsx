import { useId, type ReactNode } from "react";
import { PlusIcon } from "../icons/icons";
import "./Accordion.css";

export interface AccordionItem {
  /** Identifiant stable (clé React). */
  id: string;
  /** Intitulé toujours visible (la question). */
  title: ReactNode;
  /** Contenu révélé à l'ouverture (la réponse). */
  content: ReactNode;
  /** Ouvert au premier affichage. */
  defaultOpen?: boolean;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** Nom commun : un seul élément ouvert à la fois (attribut `name` des <details>). */
  exclusive?: boolean;
  className?: string;
  /** Libellé accessible de la liste. */
  ariaLabel?: string;
}

/**
 * Liste de questions repliables (FAQ, aide) sur des <details> natifs : ouverture au clavier, lus par les lecteurs
 * d'écran, présents dans la page pour les moteurs de recherche. L'ouverture et la fermeture sont animées : la hauteur
 * glisse (navigateurs qui savent animer `::details-content`), le contenu apparaît en fondu en descendant légèrement, et
 * le « + » tourne en « × ». Animations réduites : rien ne bouge.
 */
export function Accordion({ items, exclusive = false, className, ariaLabel }: AccordionProps) {
  const id = useId();
  const name = exclusive ? `lq-accordion-${id}` : undefined;
  return (
    <div className={`lq-accordion${className ? ` ${className}` : ""}`} role="list" aria-label={ariaLabel}>
      {items.map((it) => (
        <details key={it.id} className="lq-accordion__item" role="listitem" name={name} open={it.defaultOpen || undefined}>
          <summary className="lq-accordion__summary">
            <span className="lq-accordion__title">{it.title}</span>
            <PlusIcon size={18} aria-hidden="true" className="lq-accordion__icon" />
          </summary>
          <div className="lq-accordion__content">{it.content}</div>
        </details>
      ))}
    </div>
  );
}
