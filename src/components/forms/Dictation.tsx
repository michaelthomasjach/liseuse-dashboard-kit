import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { MicIcon } from "../icons";
import "./Dictation.css";

/**
 * Dictée vocale d'un champ de texte, avec la reconnaissance vocale du navigateur (Web Speech API : Chrome, Edge,
 * Safari). Le texte reconnu s'écrit dans le champ au fil de la parole — d'abord provisoire, puis définitif — à la suite
 * de ce qui y était déjà, comme une saisie au clavier : le champ reçoit de vrais évènements `input`, si bien qu'un champ
 * React contrôlé (`value` + `onChange`) suit sans rien de plus. Sans reconnaissance vocale (Firefox), rien n'est affiché.
 */

interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  isFinal: boolean;
  0: SpeechAlternative;
}
interface SpeechEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

/** Constructeur de reconnaissance vocale du navigateur, s'il en a un. */
export function speechRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Field = HTMLInputElement | HTMLTextAreaElement;

/** Écrit une valeur dans un champ comme le ferait le clavier : React (champ contrôlé) reçoit l'évènement `input`. */
function writeValue(el: Field, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Texte de départ suivi d'une espace, pour que la dictée ne colle pas au dernier mot. */
const withSpace = (text: string): string => (text && !/\s$/.test(text) ? `${text} ` : text);

export interface DictationOptions {
  /** Langue de la reconnaissance (BCP 47). Défaut `"fr-FR"`. */
  lang?: string;
}

export interface DictationState {
  /** Le navigateur sait reconnaître la voix. */
  supported: boolean;
  listening: boolean;
  /** Dernière erreur en clair (micro refusé, aucun son…), effacée au départ suivant. */
  error: string | null;
  toggle: () => void;
  stop: () => void;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Micro refusé : autorisez-le dans le navigateur.",
  "service-not-allowed": "Micro refusé : autorisez-le dans le navigateur.",
  "no-speech": "Aucune parole entendue.",
  "audio-capture": "Aucun micro détecté.",
  network: "Reconnaissance vocale injoignable (réseau).",
};

/** Dictée dans le champ `field` : un appui la lance, un second l'arrête (elle s'arrête aussi seule après un silence). */
export function useDictation(field: RefObject<Field | null>, { lang = "fr-FR" }: DictationOptions = {}): DictationState {
  const Ctor = speechRecognition();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  // Texte du champ au départ de la dictée, et ce qui a déjà été dicté pour de bon.
  const base = useRef("");
  const finalText = useRef("");
  // Dernière valeur écrite par la dictée : si le champ n'y est plus, l'utilisateur l'a modifié entre-temps.
  const written = useRef("");

  const stop = useCallback(() => {
    rec.current?.stop();
  }, []);

  useEffect(() => () => rec.current?.abort(), []);

  const toggle = useCallback(() => {
    if (!Ctor) return;
    if (rec.current) {
      rec.current.stop();
      return;
    }
    const el = field.current;
    if (!el || el.disabled || el.readOnly) return;
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    const start = el.value;
    base.current = withSpace(start);
    finalText.current = "";
    written.current = start;
    r.onresult = (e) => {
      const target = field.current;
      if (!target) return;
      // Le champ a été modifié pendant l'écoute (texte effacé ou retouché) : la dictée repart de ce qu'il contient
      // maintenant, sans réécrire ce qu'elle avait déjà dicté.
      if (target.value !== written.current) {
        base.current = withSpace(target.value);
        finalText.current = "";
      }
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i] as SpeechResult;
        if (res.isFinal) finalText.current += res[0].transcript;
        else interim += res[0].transcript;
      }
      const spoken = `${finalText.current}${interim}`.replace(/\s+/g, " ").trimStart();
      // Première lettre en capitale quand la dictée commence le champ.
      const text = base.current.trim() ? spoken : spoken.charAt(0).toUpperCase() + spoken.slice(1);
      const value = `${base.current}${text}`;
      written.current = value;
      writeValue(target, value);
    };
    r.onerror = (e) => setError(ERRORS[e.error] ?? (e.error === "aborted" ? null : "La dictée s'est interrompue."));
    r.onend = () => {
      rec.current = null;
      setListening(false);
      field.current?.focus();
    };
    setError(null);
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      rec.current = null;
      setListening(false);
    }
  }, [Ctor, field, lang]);

  return { supported: Ctor !== null, listening, error, toggle, stop };
}

export interface DictationButtonProps extends DictationOptions {
  /** Le champ où écrire. */
  field: RefObject<Field | null>;
  disabled?: boolean;
  className?: string;
  /** Taille de l'icône. Défaut 16. */
  size?: number;
}

/**
 * Bouton micro d'un champ : appui pour dicter, appui pour arrêter ; il bat pendant l'écoute. Invisible si le navigateur
 * ne sait pas reconnaître la voix. Un message bref s'affiche en infobulle en cas d'erreur (micro refusé…).
 */
export function DictationButton({ field, disabled, className, size = 16, lang }: DictationButtonProps) {
  const d = useDictation(field, lang ? { lang } : {});
  if (!d.supported) return null;
  const label = d.listening ? "Arrêter la dictée" : "Dicter au micro";
  return (
    <button
      type="button"
      className={["lq-dictation", d.listening && "lq-dictation--on", d.error && "lq-dictation--error", className].filter(Boolean).join(" ")}
      aria-label={label}
      aria-pressed={d.listening}
      title={d.error ?? label}
      disabled={disabled}
      // Garde le focus dans le champ : la dictée écrit là où l'on était.
      onMouseDown={(e) => e.preventDefault()}
      onClick={d.toggle}
    >
      <MicIcon size={size} />
    </button>
  );
}
