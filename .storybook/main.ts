import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  // Copied verbatim to the root of the build: the PWA manifest, its icons and the service worker
  // (see preview-head.html, which links them). They have to sit beside `iframe.html` because that
  // is the page being installed — a story opened directly, with no Storybook chrome around it, is
  // the whole point on a phone.
  staticDirs: ["./public"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  // This repo lives inside a OneDrive-synced folder — OneDrive's own sync layer can briefly lock
  // or swap out a file mid-write right as Vite's native file watcher (chokidar) tries to read it,
  // throwing an EBUSY/EPERM/ENOENT that isn't caught anywhere in that watcher's own internals and
  // crashes the whole Node process with no stack trace to show for it (matches "the dev server
  // just dies silently, no error printed" reports). Polling reads each watched file on a plain
  // interval instead of relying on native OS filesystem-change events, so it never races OneDrive
  // that way — the standard fix for this exact class of issue on cloud-synced/networked/
  // virtualized filesystems. Costs a bit more CPU than native watching; worth it here since a
  // silent crash is far more disruptive than that overhead.
  viteFinal: async (viteConfig) => {
    viteConfig.server = {
      ...viteConfig.server,
      watch: {
        ...viteConfig.server?.watch,
        usePolling: true,
        interval: 300,
      },
    };
    return viteConfig;
  },
};

export default config;
