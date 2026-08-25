import type { Preview } from "@storybook/react";
import { LqThemeProvider } from "../src/theme";
import type { LqFont, LqPalette, LqSurface } from "../src/theme";

export const globalTypes = {
  lqPalette: {
    name: "Palette",
    description: "E-ink (N&B) or color tablet",
    defaultValue: "eink" as LqPalette,
    toolbar: {
      icon: "contrast",
      items: [
        { value: "eink", title: "E-ink (N&B)" },
        { value: "color", title: "Tablette couleur" },
      ],
      dynamicTitle: true,
    },
  },
  lqSurface: {
    name: "Surface",
    description: "Light or dark surface",
    defaultValue: "light" as LqSurface,
    toolbar: {
      icon: "mirror",
      items: [
        { value: "light", title: "Clair" },
        { value: "dark", title: "Sombre" },
      ],
      dynamicTitle: true,
    },
  },
  lqFont: {
    name: "Typo",
    description: "Display typeface",
    defaultValue: "manrope" as LqFont,
    toolbar: {
      icon: "font",
      items: [
        { value: "space-grotesk", title: "Space Grotesk" },
        { value: "manrope", title: "Manrope" },
        { value: "sora", title: "Sora" },
        { value: "inter", title: "Inter" },
        { value: "ibm-plex-sans", title: "IBM Plex Sans" },
      ],
      dynamicTitle: true,
    },
  },
};

const preview: Preview = {
  // Generates a "Docs" entry per story file with a "Show code" toggle under each canvas —
  // lets consumers copy-paste the exact JSX a story renders straight out of Storybook.
  tags: ["autodocs"],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "fullscreen",
  },
  decorators: [
    (Story, context) => {
      const palette = context.globals.lqPalette as LqPalette;
      const surface = context.globals.lqSurface as LqSurface;
      const font = context.globals.lqFont as LqFont;
      return (
        <LqThemeProvider palette={palette} surface={surface} font={font}>
          <div style={{ minHeight: "100vh", padding: "32px", backgroundColor: "var(--lq-color-bg)" }}>
            <Story />
          </div>
        </LqThemeProvider>
      );
    },
  ],
};

export default preview;
