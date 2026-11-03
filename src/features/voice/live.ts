/**
 * Živý prepis reči (Hlas 2.0) – Gemini Live, model gemini-3.5-transcribe-live.
 *
 * Telefón sa pripojí priamo cez WebSocket s krátkodobým jednorazovým tokenom (edge funkcia
 * voice-live-token; kľúč Gemini ostáva na serveri, nastavenie relácie je v tokene zamknuté).
 * Zvuk sa posiela len počas reči (rozpozná useRecorder), po vete príde „audioStreamEnd“ a server
 * hneď vráti hotovú vetu. Počas reči chodí priebežný text (interim) – ukazuje sa v „Počujem“.
 *
 * Cena: ~0,9 centa za minútu reči (ticho sa neposiela). Pri chybe spojenia appka prejde na
 * pôvodné posielanie viet po kúskoch (parse-voice), takže hlas funguje ďalej.
 */
import { supabase } from "@/lib/supabase";
import { currentHouseholdId } from "@/features/household/current";
import { getLocale } from "@/i18n";

const WS = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";
const RATE = 16_000;
/** ~100 ms zvuku v jednej správe (odporúčanie Google). */
const CHUNK = RATE / 10;
/** Token platí 6 minút – novú reláciu otvoríme skôr, medzi vetami. */
const RENEW_MS = 5 * 60_000;

type Token = { token: string; setup: Record<string, unknown>; expiresAt: string };
export type LiveHandlers = { onInterim: (text: string) => void; onFinal: (text: string) => void; onDown: () => void };

async function fetchToken(): Promise<Token> {
  const { data, error } = await supabase.functions.invoke("voice-live-token", {
    body: { household_id: currentHouseholdId(), locale: getLocale() },
  });
  if (error || !data?.token) throw new Error(typeof data?.error === "string" ? data.error : "AI_UNAVAILABLE");
  return data as Token;
}

const b64 = (pcm: Int16Array) => {
  const bytes = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** Jedna relácia živého prepisu (najviac ~6 minút; obnoví sa sama medzi vetami). */
export class LiveTranscriber {
  private ws: WebSocket | null = null;
  private ready: Promise<void> | null = null;
  private openedAt = 0;
  private buf = new Int16Array(CHUNK);
  private fill = 0;
  private closed = false;
  private connecting = false;
  /** Prevzorkovanie na 16 kHz: zvyšok z predošlého kúska a priebežné zosilnenie tichého mikrofónu. */
  private pos = 0;
  private peak = 0.05;
  constructor(private h: LiveHandlers) {}

  /** Pripojí sa (alebo obnoví reláciu). Vyhodí chybu, ak sa nedá – appka potom použije pôvodný spôsob. */
  connect(): Promise<void> {
    // Práve sa pripája, alebo je spojenie čerstvé – nový token netreba (každý token = relácia = náklad).
    if (this.ready && (this.connecting || (this.ws && this.ws.readyState <= 1 && Date.now() - this.openedAt < RENEW_MS))) return this.ready;
    this.drop();
    this.closed = false;
    this.connecting = true;
    this.ready = (async () => {
      const tok = await fetchToken();
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`${WS}?access_token=${encodeURIComponent(tok.token)}`);
        this.ws = ws;
        this.openedAt = Date.now();
        const timer = setTimeout(() => reject(new Error("LIVE_TIMEOUT")), 6000);
        ws.onopen = () => ws.send(JSON.stringify({ setup: tok.setup }));
        ws.onmessage = async (ev) => {
          const text = typeof ev.data === "string" ? ev.data : await (ev.data as Blob).text();
          let m: Record<string, unknown>;
          try {
            m = JSON.parse(text);
          } catch {
            return;
          }
          if (m.setupComplete) {
            clearTimeout(timer);
            resolve();
            return;
          }
          const sc = m.serverContent as { interimInputTranscription?: { text?: string }; inputTranscription?: { text?: string } } | undefined;
          const interim = sc?.interimInputTranscription?.text;
          if (interim) this.h.onInterim(interim);
          const final = sc?.inputTranscription?.text?.trim();
          if (final) this.h.onFinal(final);
        };
        ws.onerror = () => {
          clearTimeout(timer);
          reject(new Error("LIVE_ERROR"));
        };
        ws.onclose = () => {
          clearTimeout(timer);
          reject(new Error("LIVE_CLOSED"));
          if (this.ws === ws) {
            this.ws = null;
            this.ready = null;
            if (!this.closed) this.h.onDown();
          }
        };
      });
    })();
    const mine = this.ready;
    mine.then(
      () => {
        if (this.ready === mine) this.connecting = false;
      },
      () => {
        if (this.ready === mine) {
          this.connecting = false;
          this.ready = null;
        }
      },
    );
    return mine;
  }

  get open() {
    return !!this.ws && this.ws.readyState === 1;
  }

  /** Kúsok zvuku z mikrofónu (ľubovoľná vzorkovacia frekvencia) → 16 kHz PCM po ~100 ms. */
  push(data: Float32Array, fromRate: number) {
    if (!this.open) return;
    for (let i = 0; i < data.length; i++) this.peak = Math.max(this.peak * 0.99995, Math.abs(data[i]!));
    const gain = Math.min(6, Math.max(1, 0.5 / this.peak));
    const ratio = fromRate / RATE;
    // Zníženie vzorkovania priemerom okna (stačí na reč).
    let p = this.pos;
    while (p + ratio <= data.length) {
      const a = Math.floor(p);
      const b = Math.max(a + 1, Math.floor(p + ratio));
      let sum = 0;
      for (let j = a; j < b; j++) sum += data[j]!;
      const v = Math.max(-1, Math.min(1, (sum / (b - a)) * gain));
      this.buf[this.fill++] = v < 0 ? v * 0x8000 : v * 0x7fff;
      if (this.fill === CHUNK) this.flush();
      p += ratio;
    }
    this.pos = p - data.length;
  }

  private flush() {
    if (!this.fill || !this.open) return;
    const data = b64(this.buf.subarray(0, this.fill));
    this.fill = 0;
    this.ws!.send(JSON.stringify({ realtimeInput: { audio: { data, mimeType: `audio/pcm;rate=${RATE}` } } }));
  }

  /** Koniec vety (podľa ticha v telefóne) – server hneď uzavrie prepis. */
  end() {
    this.flush();
    this.pos = 0;
    if (this.open) this.ws!.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
  }

  private drop() {
    const ws = this.ws;
    this.ws = null;
    this.ready = null;
    this.connecting = false;
    this.fill = 0;
    if (ws && ws.readyState <= 1) ws.close();
  }

  close() {
    this.closed = true;
    this.drop();
  }
}
