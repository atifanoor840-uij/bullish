import { propApi } from "./propApi";

export const META_PIXEL_ID = "1152513827733713";

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

/**
 * Fires standard Meta Pixel events via window.fbq and logs to server-side pixel tracking.
 */
export function trackPixel(eventName: string, params?: Record<string, any>) {
  if (typeof window !== "undefined") {
    if (typeof window.fbq === "function") {
      try {
        if (params) {
          window.fbq("track", eventName, params);
        } else {
          window.fbq("track", eventName);
        }
      } catch (err) {
        console.warn("[MetaPixel] Failed to track event:", eventName, err);
      }
    }

    // Also notify internal tracking endpoint
    try {
      propApi.public
        .trackPixel({
          eventName,
          value: typeof params?.value === "number" ? params.value : undefined,
          currency: params?.currency || "USD",
          contentName: params?.content_name || undefined,
          contentIds: Array.isArray(params?.content_ids)
            ? params.content_ids.join(",")
            : params?.content_ids || undefined,
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
