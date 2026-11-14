/**
 * Les sons des alertes, synthétisés avec Web Audio : aucun fichier audio à livrer ni à charger. Chaque son a sa
 * signature, et ils sont rangés par catégorie dans le champ « Son » d'AlertCreateModal (groupes de la liste) — on
 * les entend en s'arrêtant une seconde dessus, en les choisissant, par le bouton ▶, et au déclenchement (l'application
 * appelle la même fonction).
 */

/** Une note : fréquence (Hz), durée (s), départ (s), forme d'onde, volume, et glissement éventuel vers `to` (Hz). */
interface Note {
  f: number;
  d: number;
  at?: number;
  type?: OscillatorType;
  vol?: number;
  to?: number;
}

interface SoundDef {
  value: string;
  label: string;
  group: string;
  notes: Note[];
}

const arpeggio = (freqs: number[], step: number, d: number, type: OscillatorType = "sine", vol = 0.22): Note[] =>
  freqs.map((f, i) => ({ f, d, at: i * step, type, vol }));

const SOUNDS: SoundDef[] = [
  // Classiques : les quatre d'origine, valeurs gardées (des alertes existantes les portent).
  { value: "bell", label: "Cloche", group: "Classiques", notes: [{ f: 660, d: 1.1, vol: 0.3 }, { f: 1320, d: 0.8, vol: 0.08 }] },
  { value: "chime", label: "Carillon", group: "Classiques", notes: arpeggio([523, 659, 784], 0.15, 0.45) },
  { value: "ding", label: "Ding", group: "Classiques", notes: [{ f: 1200, d: 0.35, type: "triangle", vol: 0.3 }] },
  { value: "alert", label: "Alerte", group: "Classiques", notes: [0, 1, 2, 3].map((i) => ({ f: i % 2 === 0 ? 880 : 660, d: 0.13, at: i * 0.15, type: "square" as const, vol: 0.12 })) },
  // Doux : pour une alerte d'information, qu'on entend sans sursauter.
  { value: "soft-pop", label: "Bulle", group: "Doux", notes: [{ f: 420, d: 0.18, type: "sine", vol: 0.25, to: 820 }] },
  { value: "marimba", label: "Marimba", group: "Doux", notes: arpeggio([523, 784], 0.12, 0.35, "triangle", 0.25) },
  { value: "glass", label: "Cristal", group: "Doux", notes: [{ f: 1568, d: 0.9, vol: 0.12 }, { f: 2093, d: 0.7, at: 0.02, vol: 0.06 }] },
  { value: "harp", label: "Harpe", group: "Doux", notes: arpeggio([392, 494, 587, 784], 0.07, 0.6, "sine", 0.16) },
  { value: "notify", label: "Notification", group: "Doux", notes: arpeggio([880, 1175], 0.11, 0.25, "sine", 0.2) },
  // Urgents : pour ce qui demande d'agir tout de suite.
  { value: "siren", label: "Sirène", group: "Urgents", notes: [{ f: 600, d: 0.45, type: "sawtooth", vol: 0.1, to: 1100 }, { f: 1100, d: 0.45, at: 0.45, type: "sawtooth", vol: 0.1, to: 600 }] },
  { value: "buzzer", label: "Buzzer", group: "Urgents", notes: [{ f: 160, d: 0.5, type: "square", vol: 0.14 }] },
  { value: "triple-beep", label: "Triple bip", group: "Urgents", notes: [0, 1, 2].map((i) => ({ f: 1000, d: 0.09, at: i * 0.14, type: "square" as const, vol: 0.12 })) },
  { value: "klaxon", label: "Klaxon", group: "Urgents", notes: [{ f: 349, d: 0.3, type: "sawtooth", vol: 0.12 }, { f: 440, d: 0.3, type: "sawtooth", vol: 0.08 }, { f: 349, d: 0.3, at: 0.38, type: "sawtooth", vol: 0.12 }, { f: 440, d: 0.3, at: 0.38, type: "sawtooth", vol: 0.08 }] },
  // Marché : le sens du mouvement s'entend.
  { value: "rise", label: "Hausse", group: "Marché", notes: arpeggio([523, 659, 784, 1047], 0.09, 0.3, "triangle", 0.2) },
  { value: "fall", label: "Baisse", group: "Marché", notes: arpeggio([1047, 784, 659, 523], 0.09, 0.3, "triangle", 0.2) },
  { value: "cash", label: "Caisse", group: "Marché", notes: [{ f: 2637, d: 0.12, type: "square", vol: 0.08 }, { f: 3136, d: 0.5, at: 0.1, type: "triangle", vol: 0.14 }] },
  { value: "gong", label: "Gong", group: "Marché", notes: [{ f: 98, d: 2.2, vol: 0.32 }, { f: 196, d: 1.6, vol: 0.12 }, { f: 293, d: 1.2, vol: 0.06 }] },
  { value: "fanfare", label: "Fanfare", group: "Marché", notes: [...arpeggio([523, 659, 784], 0.12, 0.18, "sawtooth", 0.08), { f: 1047, d: 0.6, at: 0.36, type: "sawtooth", vol: 0.1 }] },
];

/** Options du champ « Son » : « Aucun », puis chaque son dans sa catégorie. */
export const ALERT_SOUND_OPTIONS: { value: string; label: string; group?: string }[] = [
  { value: "none", label: "Aucun" },
  ...SOUNDS.map(({ value, label, group }) => ({ value, label, group })),
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

function play(ctx: AudioContext, n: Note) {
  const start = ctx.currentTime + (n.at ?? 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = n.type ?? "sine";
  osc.frequency.setValueAtTime(n.f, start);
  if (n.to) osc.frequency.linearRampToValueAtTime(n.to, start + n.d);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(n.vol ?? 0.25, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + n.d + 0.02);
}

/** Joue le son d'alerte `value` (« none » : rien ; une valeur inconnue : un bip court). */
export function playAlertSound(value: string): void {
  if (!value || value === "none") return;
  const ctx = audioContext();
  if (!ctx) return;
  const notes = SOUNDS.find((s) => s.value === value)?.notes ?? [{ f: 880, d: 0.3 }];
  for (const n of notes) play(ctx, n);
}
