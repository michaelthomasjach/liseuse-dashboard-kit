/** Categorical color cycle shared by charts that render multiple series/slices. */
export const CHART_PALETTE = [
  "var(--lq-color-accent)",
  "var(--lq-color-green)",
  "var(--lq-color-amber)",
  "var(--lq-color-sky)",
  "var(--lq-color-rose)",
  "var(--lq-color-violet)",
];

/** The same six hues, each also stepped down in *strength* by mixing it toward the background.
 *
 *  That second axis is what keeps a multi-colour chart legible under the e-ink palette, where every
 *  accent token deliberately collapses to `--lq-color-text` (see tokens.css) and the six entries
 *  above become six identical blocks. Mixed at a descending share they stay six distinguishable
 *  tones when the hues go away, and remain six distinct colours when they do not.
 *
 *  `ProgressBar` does the same thing with its own hand-kept copy of this list — it lives outside
 *  `charts/` and has no business reaching into this folder. */
const RAMP_STRENGTHS = [100, 86, 72, 58, 46, 34];
export const CHART_PALETTE_RAMP = CHART_PALETTE.map(
  (hue, i) => `color-mix(in srgb, ${hue} ${RAMP_STRENGTHS[i % RAMP_STRENGTHS.length]}%, var(--lq-color-bg))`
);
