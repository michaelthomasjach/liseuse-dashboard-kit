import type { Candle } from "./interfaces/Candle.interface";
import type { ChartRangeAsk, ChartRangeAskKind, ChartRangeAskRequest } from "./interfaces/ChartRangeAsk.interface";

/** Les trois questions toutes faites de l'infobulle, dans l'ordre affiché. */
export const RANGE_ASK_OPTIONS: { kind: Exclude<ChartRangeAskKind, "custom">; label: string }[] = [
  { kind: "explain", label: "Expliquer ce mouvement de prix" },
  { kind: "events", label: "Trouver les évènements derrière ce mouvement" },
  { kind: "technicals", label: "Analyser la technique de cette zone" },
];

/** Repère en tête de la demande : un serveur qui le reconnaît y joint le dossier de la période (actualités, publications
 *  économiques, résultats). Forme : `[ANALYSE_DE_ZONE type=events du=2026-11-23T09:10:00.000Z au=…]`. */
export const RANGE_ASK_TAG = "ANALYSE_DE_ZONE";

const COMMON =
  "Fais une analyse approfondie, précise et argumentée, pas un résumé des chiffres : chaque affirmation s'appuie sur un chiffre de la zone, un niveau de prix, une date et une heure, ou une source du dossier de la période (cite [n]). Utilise tes outils pour compléter (actualités, contexte macro, indicateurs affichés : decrire_le_graphique, lire_une_zone). Si une cause n'est pas établie, dis-le et propose les hypothèses les plus probables, classées. Structure la réponse avec des titres courts et des puces ; pas de conclusion vague.";

const TASKS: Record<Exclude<ChartRangeAskKind, "custom">, string> = {
  explain: [
    "Tâche : EXPLIQUER CE MOUVEMENT DE PRIX.",
    "Sections attendues :",
    "1. Le mouvement en phases datées (départ, accélérations, retournements), avec prix et heures.",
    "2. Les causes, de la plus probable à la moins probable : publications économiques (écart au consensus), banques centrales et taux (anticipations, discours), inflation, actualité géopolitique (guerre, sanctions, élections, droits de douane), résultats d'entreprises, flux techniques (échéances d'options, journée des quatre sorcières, rebalancements, ouverture de Wall Street à 15 h 30 heure de Paris, prises de bénéfices).",
    "3. Les niveaux qui ont compté : supports et résistances touchés, cassés ou défendus.",
    "4. Ce que cela implique pour la suite et les niveaux à surveiller.",
  ].join("\n"),
  events: [
    "Tâche : TROUVER LES ÉVÈNEMENTS DERRIÈRE CE MOUVEMENT.",
    "Recense tous les évènements de la période (et de la veille) qui ont pu le provoquer : publications économiques (valeur publiée contre prévision), décisions et discours de banques centrales, chiffres d'inflation et d'emploi, actualité géopolitique (guerre, conflits, sanctions, élections, commerce), résultats des grandes sociétés, échéances d'options et journées des quatre sorcières.",
    "Pour chaque évènement : date et heure, ce qui s'est passé, surprise par rapport aux attentes, effet attendu sur ce marché, et la réaction visible sur le graphique (bougie, variation en points et en %).",
    "Classe-les par impact, puis dis ce que les évènements n'expliquent pas.",
  ].join("\n"),
  technicals: [
    "Tâche : ANALYSER LA TECHNIQUE DE CETTE ZONE.",
    "Sections attendues :",
    "1. Tendance et structure : plus hauts et plus bas successifs, cassures, rythme, comparaison avec la tendance d'avant la zone.",
    "2. Supports et résistances chiffrés (ceux de la structure technique ci-dessous, prix ronds, plus haut et plus bas de la zone) : lesquels ont tenu, lesquels ont cédé.",
    "3. Volumes et volatilité : où le volume a confirmé ou contredit le prix ; amplitude des bougies.",
    "4. Indicateurs affichés sur le graphique (lis-les avec decrire_le_graphique) et figures chartistes éventuelles.",
    "5. Échéances d'options proches (journée des quatre sorcières, échéance mensuelle, VIX) et leur effet possible (aimantation vers des prix ronds, volatilité).",
    "6. Scénarios haussier et baissier, chacun avec son déclencheur et son niveau d'invalidation.",
  ].join("\n"),
};

/** Bornes d'une zone : dates triées (la première sélectionnée peut être la plus récente). */
export function orderedRange(a: Date, b: Date): ChartRangeAsk {
  return a.getTime() <= b.getTime() ? { from: a, to: b } : { from: b, to: a };
}

/** Les bougies de la zone, bornes comprises. */
export function candlesInRange(data: Candle[], range: ChartRangeAsk): Candle[] {
  const from = range.from.getTime();
  const to = range.to.getTime();
  return data.filter((c) => {
    const t = c.date.getTime();
    return t >= from && t <= to;
  });
}

/** Les chiffres d'une zone : ouverture, clôture, variation, plus haut et plus bas (avec leur date), volume. Null sans
 *  bougie. */
export function rangeStats(candles: Candle[]) {
  if (candles.length === 0) return null;
  const first = candles[0];
  const last = candles[candles.length - 1];
  let high = first;
  let low = first;
  let volume = 0;
  let hasVolume = false;
  for (const c of candles) {
    if (c.high > high.high) high = c;
    if (c.low < low.low) low = c;
    if (typeof c.volume === "number") {
      volume += c.volume;
      hasVolume = true;
    }
  }
  const change = last.close - first.open;
  return {
    count: candles.length,
    open: first.open,
    close: last.close,
    change,
    changePct: first.open !== 0 ? (change / first.open) * 100 : null,
    high: high.high,
    highAt: high.date,
    low: low.low,
    lowAt: low.date,
    amplitudePct: low.low !== 0 ? ((high.high - low.low) / low.low) * 100 : null,
    volume: hasVolume ? volume : null,
  };
}

const num = (v: number) => (Math.abs(v) >= 1000 ? v.toFixed(2) : Number(v.toPrecision(6)).toString());
const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)} %`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Plus hauts et plus bas locaux (pivots de `k` bougies de chaque côté), regroupés en niveaux à `tol` près : les prix
 *  touchés plusieurs fois forment les supports et les résistances. */
function pivotLevels(candles: Candle[], k: number, tol: number) {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = k; i < candles.length - k; i++) {
    const win = candles.slice(i - k, i + k + 1);
    if (win.every((c) => c.high <= candles[i].high)) highs.push(candles[i].high);
    if (win.every((c) => c.low >= candles[i].low)) lows.push(candles[i].low);
  }
  const cluster = (xs: number[]) => {
    const out: { price: number; touches: number }[] = [];
    for (const x of [...xs].sort((a, b) => a - b)) {
      const hit = out.find((o) => Math.abs(o.price - x) <= tol);
      if (hit) {
        hit.price = (hit.price * hit.touches + x) / (hit.touches + 1);
        hit.touches += 1;
      } else out.push({ price: x, touches: 1 });
    }
    return out.sort((a, b) => b.touches - a.touches || b.price - a.price).slice(0, 4);
  };
  return { resistances: cluster(highs), supports: cluster(lows) };
}

/** Troisième vendredi d'un mois (UTC). */
function thirdFriday(year: number, month: number): Date {
  const d = new Date(Date.UTC(year, month, 1));
  const offset = (5 - d.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + 14));
}

/** Échéances d'options autour de la zone (5 jours avant à 10 jours après) : mensuelles (3e vendredi), journées des
 *  quatre sorcières (3e vendredi de mars, juin, septembre, décembre) et VIX (mercredi 30 jours avant le 3e vendredi du
 *  mois suivant). */
export function optionExpiries(range: ChartRangeAsk): string[] {
  const lo = range.from.getTime() - 5 * 86_400_000;
  const hi = range.to.getTime() + 10 * 86_400_000;
  const out: { t: number; text: string }[] = [];
  const start = new Date(lo);
  for (let i = -1; i <= 2; i++) {
    const y = start.getUTCFullYear();
    const m = start.getUTCMonth() + i;
    const tf = thirdFriday(y + Math.floor(m / 12), ((m % 12) + 12) % 12);
    const quad = [2, 5, 8, 11].includes(tf.getUTCMonth());
    out.push({ t: tf.getTime(), text: `${tf.toISOString().slice(0, 10)} : ${quad ? "journée des quatre sorcières (options et contrats à terme trimestriels sur indices et actions)" : "échéance mensuelle des options (3e vendredi)"}` });
    const next = thirdFriday(y + Math.floor((m + 1) / 12), (((m + 1) % 12) + 12) % 12);
    const vix = new Date(next.getTime() - 30 * 86_400_000);
    out.push({ t: vix.getTime(), text: `${vix.toISOString().slice(0, 10)} : échéance des options sur le VIX` });
  }
  return out
    .filter((o) => o.t >= lo && o.t <= hi)
    .sort((a, b) => a.t - b.t)
    .filter((o, i, all) => i === 0 || o.text !== all[i - 1].text)
    .map((o) => {
      const inside = o.t >= range.from.getTime() - 86_400_000 && o.t <= range.to.getTime();
      return `${o.text}${inside ? " — dans la zone" : o.t < range.from.getTime() ? " — juste avant la zone" : " — juste après la zone"}`;
    });
}

/** La structure technique d'une zone, en lignes de texte : tendance d'avant, supports et résistances, plus fortes
 *  bougies, écarts d'ouverture, volatilité et volume comparés à avant la zone, échéances d'options. */
export function rangeStructure(data: Candle[], range: ChartRangeAsk, formatDate: (d: Date) => string): string[] {
  const candles = candlesInRange(data, range);
  if (candles.length === 0) return [];
  const start = data.indexOf(candles[0]);
  const before = data.slice(Math.max(0, start - candles.length), start);
  const lines: string[] = [];
  if (before.length > 1) {
    const ch = before[before.length - 1].close - before[0].open;
    lines.push(`Avant la zone (${before.length} bougies) : ${pct((ch / before[0].open) * 100)} (${formatDate(before[0].date)} → ${formatDate(before[before.length - 1].date)}).`);
  }
  const ranges = candles.map((c) => c.high - c.low);
  const meanRange = avg(ranges);
  const tol = Math.max(meanRange * 0.6, Math.abs(candles[0].open) * 0.0005);
  const k = candles.length >= 40 ? 3 : 2;
  const { supports, resistances } = pivotLevels([...before.slice(-k), ...candles], k, tol);
  if (supports.length) lines.push(`Supports (plus bas locaux regroupés) : ${supports.map((s) => `${num(s.price)} (${s.touches} contact${s.touches > 1 ? "s" : ""})`).join(", ")}.`);
  if (resistances.length) lines.push(`Résistances (plus hauts locaux regroupés) : ${resistances.map((s) => `${num(s.price)} (${s.touches} contact${s.touches > 1 ? "s" : ""})`).join(", ")}.`);
  const moves = candles.map((c) => ({ c, d: c.close - c.open })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 4);
  lines.push(`Plus fortes bougies : ${moves.map((m) => `${formatDate(m.c.date)} ${m.d >= 0 ? "+" : ""}${num(m.d)} (${pct((m.d / m.c.open) * 100)})`).join(" ; ")}.`);
  const gaps: string[] = [];
  for (let i = 1; i < candles.length; i++) {
    const g = candles[i].open - candles[i - 1].close;
    if (Math.abs(g) > meanRange * 1.5) gaps.push(`${formatDate(candles[i].date)} ${g >= 0 ? "+" : ""}${num(g)}`);
  }
  if (gaps.length) lines.push(`Écarts d'ouverture marqués : ${gaps.slice(0, 5).join(" ; ")}.`);
  const beforeRange = avg(before.map((c) => c.high - c.low));
  lines.push(`Amplitude moyenne d'une bougie : ${num(meanRange)}${beforeRange ? ` (avant la zone : ${num(beforeRange)}, soit ×${(meanRange / beforeRange).toFixed(2)})` : ""}.`);
  const vols = candles.map((c) => c.volume).filter((v): v is number => typeof v === "number");
  if (vols.length) {
    const vMean = avg(vols);
    const vBefore = avg(before.map((c) => c.volume).filter((v): v is number => typeof v === "number"));
    const peak = candles.reduce((a, b) => ((b.volume ?? 0) > (a.volume ?? 0) ? b : a));
    lines.push(`Volume moyen par bougie : ${Math.round(vMean)}${vBefore ? ` (avant la zone : ${Math.round(vBefore)}, soit ×${(vMean / vBefore).toFixed(2)})` : ""} ; pic ${Math.round(peak.volume ?? 0)} le ${formatDate(peak.date)}.`);
  }
  const exp = optionExpiries(range);
  if (exp.length) lines.push("Échéances d'options proches :", ...exp.map((e) => `- ${e}`));
  return lines;
}

/** Au-delà, les bougies sont échantillonnées pour que la demande reste courte (la première et la dernière restent). */
const MAX_PROMPT_CANDLES = 50;

function sample(candles: Candle[]): Candle[] {
  if (candles.length <= MAX_PROMPT_CANDLES) return candles;
  const step = (candles.length - 1) / (MAX_PROMPT_CANDLES - 1);
  return Array.from({ length: MAX_PROMPT_CANDLES }, (_, i) => candles[Math.round(i * step)]);
}

/** Une valeur d'indicateur en texte : un nombre, ou les champs numériques d'un objet (« macd=1.2 signal=0.8 »). */
function valueText(v: unknown): string {
  if (typeof v === "number") return Number.isFinite(v) ? num(v) : "";
  if (v && typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => typeof x === "number" && Number.isFinite(x))
      .map(([k, x]) => `${k}=${num(x as number)}`)
      .join(" ");
  }
  return "";
}

/** Au plus tant d'indicateurs dans la demande (les premiers affichés). */
const MAX_PROMPT_INDICATORS = 12;

/**
 * Les indicateurs affichés sur la zone : pour chacun, sa valeur aux mêmes bougies échantillonnées que les cours, puis
 * sa valeur au début et à la fin de la zone, pour que l'IA lise RSI, MACD, moyennes… sans les recalculer.
 */
export function indicatorLines(data: Candle[], candles: Candle[], indicators: { label: string; values: unknown[] }[]): string[] {
  if (!indicators.length || !candles.length) return [];
  const indexOf = new Map(data.map((c, i) => [c, i]));
  const picked = sample(candles);
  const lines: string[] = ["Indicateurs affichés sur le graphique, aux mêmes bougies — date;valeur :"];
  for (const ind of indicators.slice(0, MAX_PROMPT_INDICATORS)) {
    const rows = picked
      .map((c) => {
        const i = indexOf.get(c);
        const text = i === undefined ? "" : valueText(ind.values[i]);
        return text ? `${c.date.toISOString()};${text}` : null;
      })
      .filter((r): r is string => r !== null);
    if (!rows.length) continue;
    lines.push(`${ind.label} :`, ...rows);
  }
  return lines.length > 1 ? lines : [];
}

/** La demande complète envoyée pour une zone : d'abord la tâche (propre à chaque option) et ses consignes, puis le
 *  contexte (symbole, unité de temps, dates), les chiffres, la structure technique et un échantillon des bougies. */
export function buildRangeAskRequest(args: {
  kind: ChartRangeAskKind;
  question?: string;
  range: ChartRangeAsk;
  data: Candle[];
  symbol?: string;
  timeframe?: string;
  formatDate: (d: Date) => string;
  /** Indicateurs affichés et leurs valeurs, alignées sur `data` (une par bougie). */
  indicators?: { label: string; values: unknown[] }[];
}): ChartRangeAskRequest {
  const { kind, range, data, symbol, timeframe, formatDate } = args;
  const candles = candlesInRange(data, range);
  const label = kind === "custom" ? (args.question ?? "").trim() : RANGE_ASK_OPTIONS.find((o) => o.kind === kind)!.label;
  const stats = rangeStats(candles);
  const lines: string[] = [`[${RANGE_ASK_TAG} type=${kind} du=${range.from.toISOString()} au=${range.to.toISOString()}${symbol ? ` symbole=${symbol.replace(/\s+/g, "_")}` : ""}]`];
  lines.push(kind === "custom" ? `Tâche : RÉPONDRE À CETTE QUESTION SUR LA ZONE — « ${label} »` : TASKS[kind], COMMON, "");
  lines.push(
    `Zone sélectionnée sur le graphique${symbol ? ` de ${symbol}` : ""}${timeframe ? ` (unité de temps ${timeframe})` : ""} : du ${formatDate(range.from)} au ${formatDate(range.to)}, ${candles.length} bougie${candles.length > 1 ? "s" : ""}.`
  );
  if (stats) {
    lines.push(
      `Chiffres : ouverture ${num(stats.open)}, clôture ${num(stats.close)}, variation ${stats.change >= 0 ? "+" : ""}${num(stats.change)}${stats.changePct === null ? "" : ` (${pct(stats.changePct)})`} ; plus haut ${num(stats.high)} (${formatDate(stats.highAt)}), plus bas ${num(stats.low)} (${formatDate(stats.lowAt)}), amplitude ${stats.amplitudePct === null ? "?" : pct(stats.amplitudePct)}${stats.volume !== null ? ` ; volume total ${Math.round(stats.volume)}` : ""}.`,
      "Structure technique calculée :",
      ...rangeStructure(data, range, formatDate),
    );
    const rows = sample(candles).map((c) => `${c.date.toISOString()};${num(c.open)};${num(c.high)};${num(c.low)};${num(c.close)}${typeof c.volume === "number" ? `;${Math.round(c.volume)}` : ""}`);
    lines.push(`Bougies${rows.length < candles.length ? ` (${rows.length} sur ${candles.length}, échantillonnées)` : ""} — date;ouverture;haut;bas;clôture;volume :`, ...rows);
    lines.push(...indicatorLines(data, candles, args.indicators ?? []));
  }
  const summary = `${label}\n(zone du ${formatDate(range.from)} au ${formatDate(range.to)}, ${candles.length} bougie${candles.length > 1 ? "s" : ""})`;
  return { kind, question: label, from: range.from, to: range.to, candles, symbol, timeframe, prompt: lines.join("\n"), summary };
}
