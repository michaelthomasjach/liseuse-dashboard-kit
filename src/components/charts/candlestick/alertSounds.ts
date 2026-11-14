/**
 * Les sons des alertes, synthétisés avec Web Audio : aucun fichier audio à livrer ni à charger. Chaque valeur des
 * options par défaut du champ « Son » (AlertCreateModal) a sa propre signature, pour qu'on les distingue à l'écoute
 * — dans la fenêtre d'alerte (bouton ▶) comme au déclenchement, que l'application appelle avec la même fonction.
 */

export const ALERT_SOUND_OPTIONS = [
  { value: "none", label: "Aucun" },
  { value: "bell", label: "Cloche" },
  { value: "chime", label: "Carillon" },
  { value: "ding", label: "Ding" },
  { value: "alert", label: "Alerte" },
];

let sharedContext: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  sharedContext ??= new Ctor();
  // Un contexte créé avant tout geste de l'utilisateur démarre suspendu.
  if (sharedContext.state === "suspended") void sharedContext.resume();
  return sharedContext;
}

function tone(ctx: AudioContext, frequency: number, duration: number, delay = 0, type: OscillatorType = "sine", volume = 0.25) {
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Joue le son d'alerte `value` (« none » ou une valeur inconnue sans son de repli : rien). */
export function playAlertSound(value: string): void {
  if (!value || value === "none") return;
  const ctx = audioContext();
  if (!ctx) return;
  switch (value) {
    case "bell":
      tone(ctx, 660, 1.1, 0, "sine", 0.3);
      tone(ctx, 1320, 0.8, 0, "sine", 0.08);
      break;
    case "chime":
      tone(ctx, 523, 0.35);
      tone(ctx, 659, 0.35, 0.15);
      tone(ctx, 784, 0.6, 0.3);
      break;
    case "ding":
      tone(ctx, 1200, 0.35, 0, "triangle", 0.3);
      break;
    case "alert":
      for (let i = 0; i < 4; i++) tone(ctx, i % 2 === 0 ? 880 : 660, 0.13, i * 0.15, "square", 0.12);
      break;
    default:
      tone(ctx, 880, 0.3);
  }
}
