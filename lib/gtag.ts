declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function trackConversion(): void {
  if (typeof window === "undefined") return;
  window.gtag?.("event", "conversion", {
    send_to: "AW-17945851352/CEsWCLqI4IwcENjrn-1C",
  });
}
