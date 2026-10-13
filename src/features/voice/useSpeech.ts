/**
 * Rozpoznávanie reči v prehliadači (Web Speech API, jazyk podľa nastavenia aplikácie).
 *
 * Prehliadač počúva nepretržite: priebežný text (interim) ukazujeme živo, a keď
 * človek spraví pauzu, prehliadač vetu „uzavrie“ (final) – tá ide na rozbor.
 * Chrome po chvíli ticha počúvanie sám ukončí; kým je režim zapnutý, hneď ho
 * znova spustíme, takže pre človeka mikrofón beží stále.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getLocale } from "@/i18n";

type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
};

function ctor(): (new () => Rec) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type SpeechError = "denied" | "unavailable" | null;

/**
 * Jeden rozpoznávač na celé otvorenie aplikácie. Safari sa na povolenie pýta pri
 * každom novom rozpoznávači; keď ten istý používame znova, opýta sa najviac raz.
 */
let shared: Rec | null = null;

export function useSpeech(onFinal: (text: string) => void) {
  const supported = typeof window !== "undefined" && !!ctor();
  const [listening, setListening] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<SpeechError>(null);
  const want = useRef(false);
  const rec = useRef<Rec | null>(null);
  const restarts = useRef(0);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  const boot = useCallback(() => {
    const C = ctor();
    if (!C) return;
    shared ??= new C();
    const r = shared;
    r.lang = getLocale() === "en" ? "en-GB" : "sk-SK";
    r.continuous = true;
    r.interimResults = true;
    r.onspeechstart = () => {
      restarts.current = 0;
      setHearing(true);
    };
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        const t = res[0].transcript;
        if (res.isFinal) {
          if (t.trim()) cb.current(t.trim());
        } else live += t;
      }
      setInterim(live.trim());
      setHearing(!!live.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        want.current = false;
        setError("denied");
      } else if (e.error === "audio-capture" || e.error === "network") {
        setError("unavailable");
      }
    };
    r.onend = () => {
      setHearing(false);
      setInterim("");
      if (want.current) {
        // Chrome aj Safari po tichu skončia – pokračujeme, kým je režim zapnutý.
        // Pri dlhom tichu reštartujeme zriedkavejšie, aby sa prehliadač zbytočne nebudil.
        restarts.current++;
        setTimeout(() => {
          if (!want.current) return;
          try {
            r.start();
          } catch {
            /* už beží */
          }
        }, restarts.current > 6 ? 1200 : 150);
      } else setListening(false);
    };
    rec.current = r;
  }, []);

  const start = useCallback(() => {
    if (!ctor()) return;
    setError(null);
    boot();
    want.current = true;
    setListening(true);
    try {
      rec.current!.start();
    } catch {
      /* už beží */
    }
  }, [boot]);

  const stop = useCallback(() => {
    want.current = false;
    setListening(false);
    setHearing(false);
    setInterim("");
    try {
      rec.current?.stop();
    } catch {
      /* nebeží */
    }
  }, []);

  useEffect(
    () => () => {
      // Nezahadzujeme ho (abort) – zastavíme a necháme na ďalšie otvorenie.
      want.current = false;
      try {
        rec.current?.stop();
      } catch {
        /* nebeží */
      }
    },
    [],
  );

  return { supported, listening, hearing, interim, error, start, stop };
}

/** Jemná haptika (Android; iPhone vibrácie z webu nepovolí). */
export function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* nepodporované */
  }
}
