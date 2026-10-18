import type { ReactNode } from "react";
import { MoreVertical, Share } from "lucide-react";

/**
 * The written fallback for installing Pocket.
 *
 * iOS never fires `beforeinstallprompt`, and Chrome withholds it until it
 * decides the site qualifies — so on both, the honest answer to "install" is a
 * short set of steps for the browser the person is actually holding. The copy
 * lives here rather than in one screen because it is shown in two places: the
 * in-app gate and the entry dialog on the landing page.
 */
export function installSteps(ios: boolean): { icon: ReactNode; text: string }[] {
  return ios
    ? [
        {
          icon: <Share size={16} aria-hidden />,
          text: "Tap the Share button in Safari's toolbar.",
        },
        { icon: <span aria-hidden>＋</span>, text: 'Choose "Add to Home Screen".' },
        { icon: <span aria-hidden>p</span>, text: 'Tap "Add" — Pocket appears with your apps.' },
      ]
    : [
        {
          icon: <MoreVertical size={16} aria-hidden />,
          text: "Open the browser menu (⋮ or ⋯).",
        },
        { icon: <span aria-hidden>↓</span>, text: 'Tap "Install app" or "Add to Home screen".' },
        { icon: <span aria-hidden>p</span>, text: "Confirm — Pocket opens full screen." },
      ];
}
