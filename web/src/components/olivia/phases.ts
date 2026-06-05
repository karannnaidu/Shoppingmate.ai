// The five launcher phases, mirrored 1:1 from the live <shoppingmate-widget>
// (packages/widget/src/ui/pill.ts). Keeping the names identical means the
// marketing page reads as a faithful preview of the real product.
export type OliviaPhase = "resting" | "incoming" | "connecting" | "connected" | "error";

export const OLIVIA = {
  name: "Olivia",
  role: "concierge",
  // Served from web/public/widget/personas alongside the widget bundle.
  avatar: "/widget/personas/concierge.png",
  initial: "O",
} as const;

type Chrome = {
  caption: string;
  /** tailwind text-colour class for the caption */
  captionClass: string;
  /** whether the caption should blink (incoming) */
  captionBlink?: boolean;
  /** name line shown bold */
  name: string;
  /** presence dot colour */
  presence: "online" | "offline";
};

export function chromeForPhase(phase: OliviaPhase): Chrome {
  switch (phase) {
    case "incoming":
      return {
        caption: "INCOMING CALL",
        captionClass: "text-fuchsia",
        captionBlink: true,
        name: OLIVIA.name,
        presence: "online",
      };
    case "connecting":
      return { caption: "THINKING", captionClass: "text-emerald-400", name: OLIVIA.name, presence: "online" };
    case "connected":
      return { caption: "CONNECTED", captionClass: "text-emerald-400", name: OLIVIA.name, presence: "online" };
    case "error":
      return { caption: "TAP TO RETRY", captionClass: "text-rose-400", name: OLIVIA.name, presence: "offline" };
    default:
      return {
        caption: "AI ASSISTANT",
        captionClass: "text-white/40",
        name: `Talk to ${OLIVIA.name}`,
        presence: "online",
      };
  }
}
