import { useState } from "react";

export interface UseLinkGroupsArgs {
  defaultLinkGroups: number[][] | undefined;
  onLinkGroupsChange: ((groups: number[][]) => void) | undefined;
}

/** Which panels (by index) are linked together for crosshair sync (see `ChartWorkspace`) — each
 *  group is a plain array of panel indices, display-numbered "Groupe 1"/"Groupe 2"/… by position
 *  in `groups` itself rather than a stable id, matching how the modal always shows them (nothing
 *  else needs to refer back to "group 2" across a render where group 1 got dissolved). Uncontrolled
 *  the same way `drawings`/`indicators`/templates are elsewhere in this library: seeded once from
 *  `defaultLinkGroups`, every change reported back via `onLinkGroupsChange`. */
export function useLinkGroups({ defaultLinkGroups, onLinkGroupsChange }: UseLinkGroupsArgs) {
  const [groups, setGroups] = useState<number[][]>(defaultLinkGroups ?? []);

  function commitGroups(next: number[][]) {
    setGroups(next);
    onLinkGroupsChange?.(next);
  }

  // Links exactly `panelIndices` together as one group, regardless of where any of them
  // currently sit — pulled out of whatever group they were previously part of first (dissolving
  // that group too if fewer than 2 members are left in it), so linking is always "these panels,
  // and only these, are now a group" rather than merging into existing membership. Matches every
  // one of the three worked examples in the request this implements: linking {2,4} after {1,2}
  // was already linked leaves 1 on its own, not still grouped with nothing.
  function linkPanels(panelIndices: number[]) {
    const toLink = new Set(panelIndices);
    const survivingGroups = groups.map((g) => g.filter((i) => !toLink.has(i))).filter((g) => g.length >= 2);
    commitGroups([...survivingGroups, [...toLink].sort((a, b) => a - b)]);
  }

  function unlinkGroup(groupIndex: number) {
    commitGroups(groups.filter((_, i) => i !== groupIndex));
  }

  return { groups, linkPanels, unlinkGroup };
}
