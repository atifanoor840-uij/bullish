import { propApi } from "./propApi";

export const META_PIXEL_ID = "1129264893163158";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

const cookie = (name: string) =>
  document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.slice(name.length + 1);

/**
 * Fires standard Meta Pixel events via window.fbq and logs to server-side pixel tracking.
 */
export function trackPixel(eventName: string, params?: Record<string, any>) {
  if (typeof window !== "undefined") {
    // Same id goes to the browser pixel and the server (Conversions API) so Meta counts it once.
    const eventId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    if (typeof window.fbq === "function") {
      try {
        window.fbq("track", eventName, params ?? {}, { eventID: eventId });
      } catch (err) {
        console.warn("[MetaPixel] Failed to track event:", eventName, err);
      }
    }

    // Server side: logs the event and forwards it to the Meta Conversions API.
    try {
      const fbp = cookie("_fbp");
      const fbc = cookie("_fbc");
      const value = params?.["value"];
      const ids = params?.["content_ids"];
      const contentIds = Array.isArray(ids) ? ids.join(",") : ids ? String(ids) : "";
      const contentName = params?.["content_name"] ? String(params["content_name"]) : "";
      propApi.public
        .trackPixel({
          eventName,
          eventId,
          ...(fbp ? { fbp } : {}),
          ...(fbc ? { fbc } : {}),
          ...(typeof value === "number" ? { value } : {}),
          currency: String(params?.["currency"] || "USD"),
          ...(contentName ? { contentName } : {}),
          ...(contentIds ? { contentIds } : {}),
          eventSourceUrl: window.location.href,
        })
        .catch(() => {});
    } catch {
      // ignore network errors
    }
  }
}

/**
 * Fires custom Meta Pixel events.
 */
export function trackCustomPixel(eventName: string, params?: Record<string, any>) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    try {
      if (params) {
        window.fbq("trackCustom", eventName, params);
      } else {
        window.fbq("trackCustom", eventName);
      }
    } catch (err) {
      console.warn("[MetaPixel] Failed to track custom event:", eventName, err);
    }
  }
}
