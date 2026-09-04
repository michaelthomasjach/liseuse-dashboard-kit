import { useEffect, useState } from "react";
import { LqThemeProvider } from "../src/theme";
import { AllFeatures } from "../src/components/charts/CandlestickChart.stories";

// The story's own `render` is a plain function component — Storybook only ever calls it as one —
// so the app mounts it directly. Importing the story rather than copying it is deliberate: it owns
// ~450 lines of generated candles, watchlists, events, symbol profiles and alert plumbing, and the
// whole point of this app is to be *that*, on a phone. A copy would drift the first time either
// side changed. `@storybook/react` is imported there for types only, so nothing of Storybook's
// runtime ends up in this bundle.
const AllOptions = AllFeatures.render as () => React.ReactElement;

/** The event Chrome fires when a site meets the install criteria. Not in lib.dom, because it is a
 *  Chromium extension to the standard rather than part of it. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Offers the install, and only then.
 *
 *  Chrome stopped showing an install banner of its own years ago: meeting every criterion — HTTPS,
 *  a valid manifest, a service worker with a fetch handler — gets you a `beforeinstallprompt`
 *  event and nothing else. Without a listener the only route left is the browser's own ⋮ menu,
 *  which is exactly the "no install offer" this was. So the event is captured, its default
 *  suppressed, and it is replayed from a button of ours.
 *
 *  The button exists only while there is something to install: it never appears on iOS Safari
 *  (which has no such event — there, "Partager → Sur l'écran d'accueil" is the only way), and it
 *  disappears the moment the prompt is answered either way. */
function InstallButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // Chrome will not let the same event be used later unless its default is prevented first.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferred) return null;
  return (
    <button
      type="button"
      className="app-install"
      onClick={async () => {
        await deferred.prompt();
        // Answered either way, the event is spent — Chrome refuses to replay it.
        await deferred.userChoice;
        setDeferred(null);
      }}
    >
      Installer
    </button>
  );
}

/** E-ink on a light surface, fixed. These were Storybook toolbar globals, and briefly a pair of
 *  buttons in the corner here — but this app exists to be looked at on a device, and a control
 *  floating over the chart is one more thing between the finger and the thing being tested. */
export function App() {
  return (
    <LqThemeProvider palette="eink" surface="light" font="manrope">
      <div className="app-root">
        <AllOptions />
        <InstallButton />
      </div>
    </LqThemeProvider>
  );
}
