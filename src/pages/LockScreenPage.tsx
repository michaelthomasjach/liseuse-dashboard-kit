import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Avatar } from "../components/finance/Avatar";
import { InputPassword } from "../components/forms/InputPassword";
import { Button } from "../components/primitives/Button";
import { UnlockIcon } from "../components/icons";
import "./LockScreenPage.css";

export interface LockScreenPageProps {
  /** Le nom de la personne dont la session est verrouillée — un vrai `<h1>`. */
  name: string;
  /** Photo ; sans, l'avatar montre les initiales de `name`. */
  avatarSrc?: string;
  /** La petite ligne au-dessus du nom. */
  eyebrow?: string;
  /** Appelé à l'envoi avec le mot de passe saisi (Entrée ou bouton). S'il rend une promesse, le
   *  formulaire reste occupé jusqu'à ce qu'elle soit tenue ou rompue ; le champ est vidé si elle est
   *  rompue. Un champ vide n'appelle rien : le focus revient au champ. */
  onUnlock: (password: string) => void | Promise<unknown>;
  /** Message d'erreur sous le champ (mot de passe refusé). */
  error?: string;
  /** Occupé, contrôlé — remplace l'état déduit de la promesse de `onUnlock`. */
  unlocking?: boolean;
  unlockLabel?: string;
  passwordLabel?: string;
  /** Défaut « Votre mot de passe ». Court à dessein : le champ fait moins de 300 px de large, un
   *  texte plus long y était rogné. */
  passwordPlaceholder?: string;
  /** Ajoute le lien « Ce n'est pas vous ? » : un bouton s'il y a `onSwitchUser`, sinon un lien vers
   *  `switchUserHref`. */
  onSwitchUser?: () => void;
  switchUserHref?: string;
  switchUserLabel?: string;
  /** Heure et date affichées en grand au-dessus, déjà formatées. Rien n'est affiché sans elles : la
   *  page ne lit pas l'horloge elle-même. */
  time?: ReactNode;
  date?: ReactNode;
  /** Marque posée en haut de l'écran. */
  logo?: ReactNode;
  /** Contenu libre en bas de l'écran (mention légale, lien d'aide). */
  footer?: ReactNode;
  /** Occupe au moins toute la hauteur de la fenêtre (`100dvh`). Sans, la page remplit son
   *  conteneur (`min-height: 100%`). */
  fullHeight?: boolean;
  className?: string;
}

/** Écran de verrouillage : la session reste ouverte, seule la saisie du mot de passe la rend. */
export function LockScreenPage({
  name,
  avatarSrc,
  eyebrow = "Session verrouillée",
  onUnlock,
  error,
  unlocking,
  unlockLabel = "Déverrouiller",
  passwordLabel = "Mot de passe",
  passwordPlaceholder = "Votre mot de passe",
  onSwitchUser,
  switchUserHref,
  switchUserLabel = "Ce n'est pas vous ?",
  time,
  date,
  logo,
  footer,
  fullHeight = false,
  className,
}: LockScreenPageProps) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = unlocking ?? pending;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!password) {
      inputRef.current?.focus();
      return;
    }
    const result = onUnlock(password);
    if (!(result instanceof Promise)) return;
    setPending(true);
    result.then(
      () => setPending(false),
      () => {
        setPending(false);
        setPassword("");
        inputRef.current?.focus();
      }
    );
  }

  const hasClock = time !== undefined || date !== undefined;

  return (
    <div className={["lq-lock-screen-page", fullHeight && "lq-lock-screen-page--full-height", className].filter(Boolean).join(" ")}>
      {logo && <div className="lq-lock-screen-page__logo">{logo}</div>}

      <div className="lq-lock-screen-page__center">
        {hasClock && (
          <div className="lq-lock-screen-page__clock">
            {time !== undefined && <div className="lq-lock-screen-page__time">{time}</div>}
            {date !== undefined && <div className="lq-lock-screen-page__date">{date}</div>}
          </div>
        )}

        <div className="lq-lock-screen-page__identity">
          <Avatar name={name} src={avatarSrc} size={72} className="lq-lock-screen-page__avatar" />
          <div>
            {eyebrow && <p className="lq-lock-screen-page__eyebrow">{eyebrow}</p>}
            <h1 className="lq-lock-screen-page__name">{name}</h1>
          </div>
        </div>

        <form className="lq-lock-screen-page__form" onSubmit={submit} noValidate aria-busy={busy || undefined}>
          {/* Le nom d'utilisateur, invisible, aide le gestionnaire de mots de passe à choisir le bon compte. */}
          <input type="text" name="username" autoComplete="username" value={name} readOnly hidden />
          <InputPassword
            ref={inputRef}
            label={passwordLabel}
            placeholder={passwordPlaceholder}
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
            readOnly={busy}
          />
          <Button type="submit" block selected aria-disabled={busy || undefined} icon={<UnlockIcon size={16} />}>
            {unlockLabel}
          </Button>
        </form>

        {(onSwitchUser || switchUserHref) &&
          (onSwitchUser ? (
            <button type="button" className="lq-lock-screen-page__switch" onClick={onSwitchUser}>
              {switchUserLabel}
            </button>
          ) : (
            <a className="lq-lock-screen-page__switch" href={switchUserHref}>
              {switchUserLabel}
            </a>
          ))}
      </div>

      {footer && <div className="lq-lock-screen-page__footer">{footer}</div>}
    </div>
  );
}
