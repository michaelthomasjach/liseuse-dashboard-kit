import { Card, type CardProps } from "./Card";

export type ExpandableCardProps = Omit<CardProps, "expandable">;

/** A `Card` with `expandable` always on — a card with a "show more" toggle. Kept as its own named
 *  export purely for backward compatibility/discoverability; `Card` itself is what actually
 *  implements this (see that component's own `expandable` prop doc). */
export function ExpandableCard(props: ExpandableCardProps) {
  return <Card {...props} expandable />;
}
