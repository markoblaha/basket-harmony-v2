import { useCallback, useRef, useState } from "react";
import { interpretAudio } from "./api";
import { recorderSupported, useRecorder } from "./useRecorder";
import { useSpeech } from "./useSpeech";

/**
 * Diktovanie do poľa bez zvukov systému: mikrofón sa potichu nahráva po vetách a vetu prepíše server.
 * Rozpoznávanie reči v prehliadači (pri spustení a zastavení pípne – iPhone aj Android) sa použije
 * len tam, kde nahrávanie nejde.
 */
export function useDictation(onText: (text: string) => void, vocab: string[] = []) {
  const silent = recorderSupported();
  const textRef = useRef(onText);
  textRef.current = onText;
  const [interim, setInterim] = useState("");
  const vocabRef = useRef(vocab);
  vocabRef.current = vocab;
  const [failed, setFailed] = useState(false);
  /** Počet viet, ktoré server ešte spracúva. */
  const [pending, setPending] = useState(0);

  const rec = useRecorder(
    useCallback((wav: string) => {
      setPending((p) => p + 1);
      void interpretAudio({ mime: "audio/wav", data: wav }, [], null, vocabRef.current).then((res) => {
        setPending((p) => p - 1);
        if (!res) return setFailed(true);
        if (res.transcript) {
          setInterim(res.transcript);
          textRef.current(res.transcript);
        }
      });
    }, []),
  );
  const speech = useSpeech(useCallback((t: string) => textRef.current(t), []));

  const start = useCallback(() => {
    setInterim("");
    setFailed(false);
    if (silent) rec.start();
    else speech.start();
  }, [silent, rec, speech]);
  const stop = useCallback(() => (silent ? rec.stop() : speech.stop()), [silent, rec, speech]);

  return silent
    ? { supported: true, interim, hearing: rec.hearing, busy: pending > 0, error: rec.error ?? (failed ? "failed" : null), start, stop }
    : { supported: speech.supported, interim: speech.interim, hearing: speech.hearing, busy: false, error: speech.error, start, stop };
}
