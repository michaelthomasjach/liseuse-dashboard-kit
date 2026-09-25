import type { ReactNode } from "react";
import { MoonIcon, SunIcon } from "../icons";
import "./AnalogClock.css";

/**
 * Une petite horloge à aiguilles — l'heure d'une simulation, d'une partie, d'un fuseau.
 *
 * ## Des secondes, et rien d'autre
 *
 * Un jeu ne compte pas en dates : il compte des secondes depuis le début de la partie. L'horloge
 * prend donc un nombre de secondes, **l'heure du jour ou le temps absolu** — elle en garde le reste
 * modulo 86 400 — et en tire ses deux aiguilles. La petite fait le tour en douze heures, la grande
 * en une ; les douze graduations disent les heures, les quatre plus longues les quarts.
 *
 * À côté du cadran, en option : l'heure en chiffres (`showDigital`), un soleil ou une lune selon
 * `night`, le jour de la partie (`day`) et une légende (`caption`) — le trafic, la météo, ce que
 * l'application veut dire du moment.
 *
 * Tout vient des jetons du thème : le cadran est un panneau, les aiguilles sont à l'accent, et la
 * palette e-ink les ramène à l'encre.
 */
export interface AnalogClockProps {
  /** L'heure, en secondes : l'heure du jour, ou un temps absolu dont on garde le reste modulo 86 400. */
  seconds: number;
  /** Le diamètre du cadran, en pixels. Défaut : 30. */
  size?: number;
  /** L'heure en chiffres à côté du cadran, « 14:05 ». Défaut : oui. */
  showDigital?: boolean;
  /** Le jour de la partie : « Jour 3 », sous l'heure. */
  day?: number;
  /** Une légende sous l'heure, après le jour. */
  caption?: ReactNode;
  /** La nuit : une lune devant l'heure ; le jour (`false`), un soleil ; absent, rien. */
  night?: boolean;
  /** Un libellé accessible ; par défaut, l'heure et le jour en toutes lettres. */
  label?: string;
  className?: string;
}

const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");

export function AnalogClock({ seconds, size = 30, showDigital = true, day, caption, night, label, className }: AnalogClockProps) {
  const t = ((seconds % 86400) + 86400) % 86400;
  const hours = t / 3600;
  const minutes = (t % 3600) / 60;
  const text = `${pad(hours)}:${pad(minutes)}`;
  const hand = (turns: number, length: number, cls: string) => {
    const a = turns * Math.PI * 2 - Math.PI / 2;
    return <line className={cls} x1={16} y1={16} x2={16 + Math.cos(a) * length} y2={16 + Math.sin(a) * length} />;
  };
  const aria = label ?? `${text}${day !== undefined ? `, jour ${day}` : ""}`;
  const withText = showDigital || day !== undefined || caption !== undefined;
  return (
    <div className={["lq-analog-clock", className].filter(Boolean).join(" ")} role="timer" aria-label={aria} title={aria}>
      <svg className="lq-analog-clock__dial" viewBox="0 0 32 32" width={size} height={size} aria-hidden>
        <circle className="lq-analog-clock__face" cx={16} cy={16} r={14.5} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const r0 = i % 3 === 0 ? 10.8 : 12;
          return <line key={i} className={["lq-analog-clock__tick", i % 3 === 0 && "lq-analog-clock__tick--major"].filter(Boolean).join(" ")} x1={16 + Math.cos(a) * r0} y1={16 + Math.sin(a) * r0} x2={16 + Math.cos(a) * 13.5} y2={16 + Math.sin(a) * 13.5} />;
        })}
        {hand((hours % 12) / 12, 8, "lq-analog-clock__hand lq-analog-clock__hand--hour")}
        {hand(minutes / 60, 11.5, "lq-analog-clock__hand lq-analog-clock__hand--minute")}
        <circle className="lq-analog-clock__pin" cx={16} cy={16} r={1.4} />
      </svg>
      {withText && (
        <div className="lq-analog-clock__text">
          {showDigital && (
            <span className="lq-analog-clock__time">
              {night !== undefined && <span className="lq-analog-clock__sky">{night ? <MoonIcon size={13} /> : <SunIcon size={13} />}</span>}
              {text}
            </span>
          )}
          {(day !== undefined || caption !== undefined) && (
            <span className="lq-analog-clock__caption">
              {day !== undefined && `Jour ${day}`}
              {day !== undefined && caption !== undefined && " · "}
              {caption}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
