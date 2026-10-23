/**
 * Nahrávanie hlasu po vetách – pre iPhone a appku spustenú z plochy, kde prehliadač
 * reč nerozpozná (Web Speech je tam zakázaný alebo sa pýta pri každej vete).
 *
 * Mikrofón beží stále; podľa hlasitosti poznáme, kedy človek hovorí. Keď spraví
 * pauzu (~0,8 s), úsek reči sa zabalí do krátkeho WAV (16 kHz, mono) a ide na server,
 * kde ho Gemini prepíše a rozoberie naraz (parse-voice). Nič sa neukladá.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const RATE = 16_000;
const SILENCE_MS = 650;
const MIN_SPEECH_MS = 350;
const MAX_SEGMENT_MS = 14_000;
const PRE_ROLL_MS = 300;

type Ctx = AudioContext;
let shared: Ctx | null = null;

function audioContext(): Ctx | null {
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  if (!shared || shared.state === "closed") shared = new C();
  return shared;
}

/**
 * Zavolaj priamo v ťuknutí na tlačidlo hlasu: iPhone pustí zvuk len z ťuknutia,
 * neskôr (po otvorení obrazovky) by AudioContext ostal „uspatý“.
 */
/**
 * Zvuk appky úplne vypneme, keď sa nenahráva: inak ho iPhone pri každom minimalizovaní a návrate appky
 * uspí a zobudí – a to je počuť (aj v tichom režime). Pri ďalšom ťuknutí na hlas sa vytvorí znova.
 */
let recording = 0;
function releaseAudio() {
  if (recording > 0 || !shared) return;
  const c = shared;
  shared = null;
  void c.close().catch(() => undefined);
}
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => document.hidden && releaseAudio());

export function primeAudio() {
  try {
    void audioContext()?.resume();
  } catch {
    /* nepodporované */
  }
}

export const recorderSupported = () =>
  typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);

/** Úsek reči → WAV (PCM 16 bit) v base64. */
function toWav(chunks: Float32Array[], fromRate: number): string {
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const ratio = fromRate / RATE;
  const n = Math.floor(total / ratio);
  const pcm = new Int16Array(n);
  // Jednoduché zníženie vzorkovania priemerom (stačí na reč).
  let ci = 0;
  let off = 0;
  let pos = 0;
  for (let i = 0; i < n; i++) {
    const end = (i + 1) * ratio;
    let sum = 0;
    let cnt = 0;
    while (pos < end && ci < chunks.length) {
      sum += chunks[ci]![off]!;
      cnt++;
      pos++;
      if (++off >= chunks[ci]!.length) {
        ci++;
        off = 0;
      }
    }
    const v = Math.max(-1, Math.min(1, cnt ? sum / cnt : 0));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const buf = new ArrayBuffer(44 + pcm.byteLength);
  const dv = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => dv.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  dv.setUint32(4, 36 + pcm.byteLength, true);
  str(8, "WAVE");
  str(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, RATE, true);
  dv.setUint32(28, RATE * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  str(36, "data");
  dv.setUint32(40, pcm.byteLength, true);
  new Int16Array(buf, 44).set(pcm);
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export type RecorderError = "denied" | "unavailable" | null;

export function useRecorder(onSegment: (wavBase64: string) => void) {
  const supported = recorderSupported();
  const [listening, setListening] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [error, setError] = useState<RecorderError>(null);
  const cb = useRef(onSegment);
  cb.current = onSegment;
  const stopRef = useRef<(() => void) | null>(null);
  const want = useRef(false);
  const starting = useRef(false);

  const stop = useCallback(() => {
    want.current = false;
    stopRef.current?.();
    stopRef.current = null;
    setListening(false);
    setHearing(false);
    releaseAudio();
  }, []);

  const start = useCallback(async () => {
    want.current = true;
    if (stopRef.current || starting.current || !supported) return;
    setError(null);
    setListening(true);
    let stream: MediaStream;
    starting.current = true;
    try {
      // Obyčajné nahrávanie, NIE režim hovoru: potlačenie ozveny/šumu a automatická hlasitosť prepnú iPhone do „hovoru“,
      // čo pri zapnutí a vypnutí mikrofónu počuť (aj v tichom režime). AI si so surovým zvukom poradí.
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    } catch (e) {
      starting.current = false;
      want.current = false;
      setListening(false);
      setError((e as { name?: string })?.name === "NotAllowedError" || (e as { name?: string })?.name === "SecurityError" ? "denied" : "unavailable");
      return;
    }
    starting.current = false;
    // Medzitým zatvorené alebo pozastavené – mikrofón hneď vypneme.
    if (!want.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    const ctx = audioContext();
    if (!ctx) {
      stream.getTracks().forEach((t) => t.stop());
      setListening(false);
      setError("unavailable");
      return;
    }
    await ctx.resume().catch(() => undefined);
    recording++;
    const src = ctx.createMediaStreamSource(stream);
    // ScriptProcessor je zastaraný, ale jediný funguje všade (aj starší iPhone) bez ďalšieho súboru.
    const proc = ctx.createScriptProcessor(2048, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(proc);
    proc.connect(mute);
    mute.connect(ctx.destination);

    const rate = ctx.sampleRate;
    const msPer = (2048 / rate) * 1000;
    const pre: Float32Array[] = [];
    let seg: Float32Array[] = [];
    let speaking = false;
    let speechMs = 0;
    let silenceMs = 0;
    let segMs = 0;
    let floor = 0.004;

    const flush = () => {
      if (speaking && speechMs >= MIN_SPEECH_MS) cb.current(toWav(seg, rate));
      seg = [];
      speaking = false;
      speechMs = 0;
      silenceMs = 0;
      segMs = 0;
      setHearing(false);
    };

    proc.onaudioprocess = (e) => {
      const data = new Float32Array(e.inputBuffer.getChannelData(0));
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i]! * data[i]!;
      const rms = Math.sqrt(sum / data.length);
      // Prah reči sa prispôsobí hluku v miestnosti.
      const loud = rms > Math.max(0.012, floor * 3);
      if (!loud) floor = floor * 0.95 + rms * 0.05;
      if (!speaking) {
        pre.push(data);
        while (pre.length * msPer > PRE_ROLL_MS) pre.shift();
        if (loud) {
          speaking = true;
          seg = [...pre];
          pre.length = 0;
          speechMs = msPer;
          segMs = seg.length * msPer;
          setHearing(true);
        }
        return;
      }
      seg.push(data);
      segMs += msPer;
      if (loud) {
        speechMs += msPer;
        silenceMs = 0;
      } else silenceMs += msPer;
      if (silenceMs >= SILENCE_MS || segMs >= MAX_SEGMENT_MS) flush();
    };

    stopRef.current = () => {
      proc.onaudioprocess = null;
      flush();
      try {
        src.disconnect();
        proc.disconnect();
        mute.disconnect();
      } catch {
        /* už odpojené */
      }
      stream.getTracks().forEach((t) => t.stop());
      recording--;
      releaseAudio();
    };
  }, [supported]);

  useEffect(
    () => () => {
      stopRef.current?.();
      releaseAudio();
    },
    [],
  );

  return { supported, listening, hearing, error, start: () => void start(), stop };
}
