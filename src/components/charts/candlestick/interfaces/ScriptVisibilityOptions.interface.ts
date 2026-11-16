/** Bascule « Public / Privé » des scripts dans l'éditeur — voir `ChartWorkspaceProps.scriptVisibility`. */
export interface ScriptVisibilityOptions {
  /** L'offre du compte permet-elle les scripts privés ? Sinon la bascule reste sur « Public », verrouillée. */
  privateAllowed: boolean;
  /** Statut des nouveaux scripts. Défaut « public ». */
  defaultVisibility?: "public" | "private";
  /** Lien vers les offres qui incluent les scripts privés, montré quand la bascule est verrouillée. */
  upgradeHref?: string;
  /** Ou une action de l'application (ouvrir sa page des offres), à la place du lien. */
  onUpgrade?: () => void;
}
