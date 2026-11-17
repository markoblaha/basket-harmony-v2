/**
 * Upozornenia do telefónu (Web Push): zapnutie, vypnutie a nastavenia na účte.
 * iPhone ich dovolí len v appke pridanej na plochu (iOS 16.4+); Android a počítač aj v prehliadači.
 * Odber sa uloží v DB (save_push_subscription), posiela ich funkcia push-send podľa udalostí v DB.
 */
import { supabase } from "@/lib/supabase";
import type { NotifKind } from "@/lib/settings";
import { getLocale } from "@/i18n";

const KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export type PushState = "unsupported" | "install" | "denied" | "off" | "on";

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

function keyBytes(b64: string): Uint8Array {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export async function pushState(): Promise<PushState> {
  if (!KEY || !("serviceWorker" in navigator)) return "unsupported";
  if (!("PushManager" in window) || typeof Notification === "undefined") return isIOS() && !standalone() ? "install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

const b64 = (buf: ArrayBuffer | null) => (buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "");

/** Zapne upozornenia na tomto zariadení. Volať z ťuknutia (prehliadač sa pýta na povolenie). */
export async function enablePush(prefs: Record<NotifKind, boolean>): Promise<PushState> {
  if (!KEY) return "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) as BufferSource }));
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: b64(sub.getKey("p256dh")),
    p_auth: b64(sub.getKey("auth")),
    p_locale: getLocale(),
    p_prefs: prefs,
  });
  if (error) throw error;
  return "on";
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.rpc("remove_push_subscription", { p_endpoint: sub.endpoint });
  await sub.unsubscribe().catch(() => undefined);
}

/** Voľby upozornení platia pre všetky moje zariadenia (aj pre upozornenia do telefónu). */
export async function syncPushPrefs(prefs: Record<NotifKind, boolean>): Promise<void> {
  await supabase.rpc("set_push_prefs", { p_prefs: prefs, p_locale: getLocale() });
}
