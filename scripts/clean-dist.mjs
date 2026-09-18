/**
 * Removes `dist/` before a build.
 *
 * `build.emptyOutDir` cannot be relied on here, and neither can `fs.rmSync(dir, {recursive: true})`:
 * in this OneDrive-synced folder the recursive delete is refused *and reports success anyway* — it
 * neither throws nor removes anything, which is the same quirk vite.config.lib.ts documents. Deleting
 * the entries individually and then the now-empty directories does work (verified: `unlinkSync` and
 * `rmdirSync` both succeed on the exact paths `rmSync` silently skips), which is why this walks the
 * tree by hand instead of making the one call that ought to be enough.
 *
 * A leftover `dist/` is not merely untidy. Two things go wrong:
 *   - vite-plugin-dts skips re-emitting per-file declarations that already look current, so a stale
 *     tree ships type definitions missing whatever was added since. That is exactly how
 *     `InteractiveGlobe` came out of a green build exported at runtime but absent from `index.d.ts`.
 *   - Output files renamed between builds survive as orphans and get published, which is how the
 *     pre-`es/`/`cjs/` flat chunks lingered after the layout changed.
 *
 * Best-effort: a file that genuinely cannot be removed (sync client holding a handle) is reported
 * rather than fatal, because a warning beats a build that refuses to run.
 */
import { existsSync, readdirSync, rmdirSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");

let failures = 0;

/** Depth-first: a directory can only be removed once it is empty. */
function removeTree(path) {
  let entries;
  try {
    entries = readdirSync(path, { withFileTypes: true });
  } catch (err) {
    failures++;
    console.warn(`[clean-dist] could not read ${path}: ${err.message}`);
    return;
  }

  for (const entry of entries) {
    const child = join(path, entry.name);
    // `isDirectory()` is false for a symlink to one, and following it could delete outside dist —
    // an unlink on the link itself is both correct and safe.
    if (entry.isDirectory()) {
      removeTree(child);
    } else {
      try {
        unlinkSync(child);
      } catch (err) {
        failures++;
        console.warn(`[clean-dist] could not remove ${child}: ${err.message}`);
      }
    }
  }

  try {
    rmdirSync(path);
  } catch (err) {
    failures++;
    console.warn(`[clean-dist] could not remove directory ${path}: ${err.message}`);
  }
}

if (!existsSync(dist)) {
  process.exit(0);
}

removeTree(dist);

if (existsSync(dist)) {
  console.warn(
    `[clean-dist] ${dist} still exists after ${failures} failure(s) — declarations and orphaned ` +
      `output files may be stale.`
  );
}
