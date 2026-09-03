// Stamps the Storybook sidebar with what was actually built (see .storybook/manager.ts). Run by
// the `prestorybook`/`prebuild-storybook` hooks, so both the dev server and a static build always
// have a fresh one — the whole point is telling a phone looking at a deployed build apart from a
// laptop looking at a dev server, which `version` alone can't do between releases.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Short SHA of HEAD, plus a "+" when the tree has uncommitted changes — a dev server almost
 *  always runs dirty, and that mark is what says "this isn't any commit you can check out". */
function describeCommit() {
  try {
    const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim().length > 0;
    return dirty ? `${sha}+` : sha;
  } catch {
    // No git, or not a checkout (a tarball install, CI without history) — the version and build
    // time below still identify the build well enough to be worth writing.
    return "nogit";
  }
}

const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const info = {
  version,
  commit: describeCommit(),
  // Minutes, not seconds: this is read off a phone screen, and the extra digits are noise.
  builtAt: new Date().toISOString().slice(0, 16).replace("T", " "),
};

writeFileSync(join(root, ".storybook", "buildInfo.json"), `${JSON.stringify(info, null, 2)}\n`);
console.log(`[storybook] v${info.version} · ${info.commit} · ${info.builtAt}`);
