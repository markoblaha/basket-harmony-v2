import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Check, Eye, EyeOff, ShoppingBasket } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { Banner, Button, TextField, cx } from "@/components/ui";

type Mode = "signin" | "signup" | "forgot";

/**
 * Prihlasovacia obrazovka. Na mobile pod sebou: ukážka zoznamu, Google, e-mail.
 * Na počítači vľavo ukážka, vpravo formulár.
 */
export function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Ak sa prihlásenie cez Google nepodarí, Supabase nás vráti s ?error=... v adrese.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const description = params.get("error_description") ?? hash.get("error_description");
    if (description) setError(`Prihlásenie cez Google sa nepodarilo: ${description}`);
  }, [params]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
  };

  async function google() {
    setError(null);
    setBusy("google");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Po prihlásení sa Google vráti presne sem (napr. na pozvánku).
        redirectTo: `${window.location.origin}${next}`,
        queryParams: { prompt: "select_account" },
      },
    });
    // Pri úspechu prehliadač odíde na stránku Googlu; sem sa dostaneme len pri chybe.
    if (error) {
      setBusy(null);
      setError(errorMessage(error));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Zadaj e-mail.");
      return;
    }
    if (mode !== "forgot" && password.length < 8) {
      setError("Heslo musí mať aspoň 8 znakov.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("Zadaj svoje meno – uvidia ho členovia domácnosti.");
      return;
    }
    setBusy("email");
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate(next, { replace: true });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: `${window.location.origin}${next}` },
        });
        if (error) throw error;
        if (data.session) navigate(next, { replace: true });
        else setNotice("Účet je vytvorený. Potvrď ho cez odkaz, ktorý ti prišiel e-mailom.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("Ak účet s týmto e-mailom existuje, poslali sme naň odkaz na zmenu hesla.");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Ľavá strana / horná časť: čo aplikácia robí */}
      <aside className="relative overflow-hidden bg-[#1b1815] px-6 pb-10 pt-[calc(env(safe-area-inset-top)+2rem)] text-[#fbf9f5] lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-14">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#fbf9f5] text-[#1b1815]">
            <ShoppingBasket className="size-6" aria-hidden />
          </div>
          <span className="text-lg font-semibold tracking-tight">Basket Harmony</span>
        </div>

        <div className="mt-8 max-w-md lg:mt-0">
          <h1 className="text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] lg:text-5xl">
            Nákupný zoznam, ktorý vidí celá domácnosť.
          </h1>
          <p className="mt-3 text-base leading-relaxed text-[#fbf9f5]/75 lg:mt-5 lg:text-lg">
            Kto je v obchode, má pred sebou všetko, čo ste doplnili. Aj to, čo pribudlo počas nákupu.
          </p>
        </div>

        <ListPreview />
      </aside>

      {/* Formulár */}
      <main className="flex items-start justify-center px-5 py-8 lg:items-center lg:px-12">
        <div className="w-full max-w-sm">
          {mode === "forgot" ? (
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight">Zabudnuté heslo</h2>
              <p className="mt-1 text-text-2">Pošleme ti odkaz, cez ktorý si nastavíš nové heslo.</p>
            </div>
          ) : (
            <>
              <div role="tablist" aria-label="Prihlásenie alebo registrácia" className="mb-6 grid grid-cols-2 rounded-xl bg-surface p-1">
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    type="button"
                    aria-selected={mode === m}
                    onClick={() => switchMode(m)}
                    className={cx(
                      "min-h-11 rounded-[0.6rem] text-[0.95rem] font-semibold transition-colors",
                      mode === m ? "bg-elevated text-text shadow-sm" : "text-text-2",
                    )}
                  >
                    {m === "signin" ? "Prihlásiť sa" : "Nový účet"}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={google}
                disabled={busy !== null}
                aria-busy={busy === "google" || undefined}
                className="flex min-h-13 w-full items-center justify-center gap-3 rounded-[var(--radius-control)] border border-line-strong/70 bg-elevated px-4 text-base font-semibold text-text shadow-sm transition-colors active:bg-pressed disabled:opacity-60"
              >
                {busy === "google" ? "Presmerúvam na Google…" : "Pokračovať cez Google"}
              </button>

              <div className="my-6 flex items-center gap-3 text-sm text-text-3">
                <span className="h-px flex-1 bg-line" />
                alebo e-mailom
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}

          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {mode === "signup" && (
              <TextField
                label="Tvoje meno"
                hint="Uvidia ho členovia domácnosti."
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
              />
            )}
            <TextField
              label="E-mail"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {mode !== "forgot" && (
              <div className="relative">
                <TextField
                  label="Heslo"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  hint={mode === "signup" ? "Aspoň 8 znakov." : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="[&_input]:pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Skryť heslo" : "Zobraziť heslo"}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-[1.85rem] flex size-11 items-center justify-center rounded-lg text-text-3 active:bg-pressed"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            )}

            {error && <Banner tone="danger">{error}</Banner>}
            {notice && <Banner tone="success">{notice}</Banner>}

            <Button type="submit" size="lg" block loading={busy === "email"} disabled={busy !== null}>
              {mode === "signin" ? "Prihlásiť sa" : mode === "signup" ? "Vytvoriť účet" : "Poslať odkaz"}
            </Button>
          </form>

          <div className="mt-4 flex justify-center">
            {mode === "signin" && (
              <Button variant="ghost" onClick={() => switchMode("forgot")}>
                Zabudol som heslo
              </Button>
            )}
            {mode === "forgot" && (
              <Button variant="ghost" onClick={() => switchMode("signin")}>
                Späť na prihlásenie
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/** Ukážka, ako vyzerá spoločný zoznam počas nákupu. */
function ListPreview() {
  const rows = [
    { name: "Mlieko polotučné", meta: "2 l", done: true },
    { name: "Rožky", meta: "6×", done: true },
    { name: "Jablká", meta: "1 kg", done: false },
  ];
  return (
    <figure
      aria-label="Ukážka spoločného zoznamu"
      className="mt-8 hidden max-w-sm rotate-[-1.5deg] rounded-2xl bg-[#fbf9f5] p-4 text-[#1b1815] shadow-2xl shadow-black/30 sm:block lg:mt-0"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-semibold">Nakupuješ</span>
        <span className="text-sm tabular-nums text-[#1b1815]/60">2 / 4</span>
      </div>
      <ul className="divide-y divide-[#1b1815]/10">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-3 py-2.5">
            <span
              className={cx(
                "flex size-6 items-center justify-center rounded-full border-2",
                r.done ? "border-[#d2401f] bg-[#d2401f] text-white" : "border-[#1b1815]/30",
              )}
            >
              {r.done && <Check className="size-3.5" strokeWidth={3} />}
            </span>
            <span className={cx("flex-1", r.done && "text-[#1b1815]/45 line-through")}>{r.name}</span>
            <span className="text-sm text-[#1b1815]/55">{r.meta}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-xl bg-[#ece5f3] p-3">
        <p className="text-sm text-[#1b1815]/70">Lucia chce pridať</p>
        <p className="font-semibold">Olivový olej</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center text-sm font-semibold">
          <span className="rounded-lg bg-white/70 py-1.5">Odmietnuť</span>
          <span className="rounded-lg bg-[#d2401f] py-1.5 text-white">Pridať</span>
        </div>
      </div>
    </figure>
  );
}

/** Po prihlásení sa vrátime len na adresu v rámci aplikácie (nie na cudzí web). */
export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
