import { addons } from "storybook/manager-api";
import { create } from "storybook/theming/create";
import { version } from "../package.json";

// Puts the package version beside the sidebar logo, so a phone and a laptop can be compared at a
// glance. Read straight from package.json rather than stamped in by a build step: the version is
// bumped on every commit (see CLAUDE.md / the release convention), so it already moves as often as
// the build does, and a named import lets the bundler take that one field rather than the whole
// manifest.
addons.setConfig({
  theme: create({
    base: "light",
    brandTitle: `liseuse-dashboard-kit v${version}`,
  }),
});
