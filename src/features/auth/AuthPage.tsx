import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Check, Eye, EyeOff, ShoppingBasket } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { Banner, Button, TextField, cx } from "@/components/ui";
import { LOCALES, t, useLocale } from "@/i18n";

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
    if (description) setError(t("auth.googleFailed", { reason: description }));
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
      setError(t("auth.errEmail"));
      return;
    }
    if (mode !== "forgot" && password.length < 8) {
      setError(t("auth.errPassword"));
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError(t("auth.errName"));
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
        else setNotice(t("auth.noticeCreated"));
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice(t("auth.noticeReset"));
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
      {/* Panel je v oboch vzhľadoch tmavý (data-theme-scope), farby berie z rolí tmavej témy. */}
      <aside
        data-theme-scope="dark"
        className="relative overflow-hidden bg-surface px-6 pb-8 pt-[calc(env(safe-area-inset-top)+2rem)] text-text lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-14"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-on-primary">
            <ShoppingBasket className="size-5" strokeWidth={2} aria-hidden />
          </div>
          <span className="text-lg font-semibold">Basket Harmony</span>
        </div>

        <div className="mt-8 max-w-md lg:mt-0">
          <h1 className="text-3xl font-semibold lg:text-5xl lg:leading-[1.08]">{t("auth.heroTitle")}</h1>
          <p className="mt-3 text-base text-text-2 lg:mt-6 lg:text-lg">{t("auth.heroText")}</p>
        </div>

        <ListPreview />
      </aside>

      {/* Formulár */}
      <main className="flex items-start justify-center px-6 py-8 lg:items-center lg:px-12">
        <div className="w-full max-w-sm">
          <LanguageSwitch />
          {mode === "forgot" ? (
            <div className="mb-6">
              <h2 className="text-2xl font-semibold">{t("auth.forgotTitle")}</h2>
              <p className="mt-1 text-text-2">{t("auth.forgotText")}</p>
            </div>
          ) : (
            <>
              <div role="tablist" aria-label={t("auth.modeLabel")} className="mb-6 grid grid-cols-2 rounded-xl bg-sunken p-1">
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    type="button"
                    aria-selected={mode === m}
                    onClick={() => switchMode(m)}
                    className={cx(
                      "min-h-11 rounded-lg text-callout font-strong transition-colors duration-200",
                      mode === m ? "bg-elevated text-text shadow-card" : "text-text-2",
                    )}
                  >
                    {m === "signin" ? t("auth.signIn") : t("auth.signUp")}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={google}
                disabled={busy !== null}
                aria-busy={busy === "google" || undefined}
                className="flex min-h-12 w-full items-center justify-center gap-3 rounded-[var(--radius-control)] bg-surface px-4 text-base font-strong text-text shadow-[inset_0_0_0_1px_var(--line-strong)] transition-colors active:bg-pressed disabled:opacity-60"
              >
                {busy === "google" ? t("auth.googleBusy") : t("auth.google")}
              </button>

              <div className="my-6 flex items-center gap-3 text-sm text-text-3">
                <span className="h-px flex-1 bg-line" />
                {t("auth.orEmail")}
                <span className="h-px flex-1 bg-line" />
              </div>
            </>
          )}

          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            {mode === "signup" && (
              <TextField
                label={t("auth.nameLabel")}
                hint={t("auth.nameHint")}
                autoComplete="given-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
              />
            )}
            <TextField
              label={t("auth.emailLabel")}
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {mode !== "forgot" && (
              <div className="relative">
                <TextField
                  label={t("auth.passwordLabel")}
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  hint={mode === "signup" ? t("auth.passwordHint") : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="[&_input]:pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
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
              {mode === "signin" ? t("auth.signIn") : mode === "signup" ? t("auth.createAccount") : t("auth.sendLink")}
            </Button>
          </form>

          <div className="mt-4 flex justify-center">
            {mode === "signin" && (
              <Button variant="ghost" onClick={() => switchMode("forgot")}>
                {t("auth.forgotLink")}
              </Button>
            )}
            {mode === "forgot" && (
              <Button variant="ghost" onClick={() => switchMode("signin")}>
                {t("auth.backToSignIn")}
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
    { name: t("auth.previewMilk"), meta: "2 l", done: true },
    { name: t("auth.previewRolls"), meta: "6×", done: true },
    { name: t("auth.previewApples"), meta: "1 kg", done: false },
  ];
  return (
    <figure
      aria-label={t("auth.previewLabel")}
      className="mt-8 hidden max-w-sm rounded-2xl bg-surface p-4 text-text shadow-raised sm:block lg:mt-0"
    >
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-semibold">{t("auth.previewShopping")}</span>
        <span className="text-sm tabular-nums text-text-2">2 / 4</span>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-3 py-3">
            <span
              className={cx(
                "flex size-6 items-center justify-center rounded-sm border-2",
                r.done ? "border-primary bg-primary text-on-primary" : "border-line-strong",
              )}
            >
              {r.done && <Check className="size-3.5" strokeWidth={2.4} />}
            </span>
            <span className={cx("flex-1", r.done && "text-text-3 line-through")}>{r.name}</span>
            <span className="text-sm text-text-2">{r.meta}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-xl bg-person-soft p-3">
        <p className="text-sm text-text-2">{t("auth.previewRequest")}</p>
        <p className="font-semibold">{t("auth.previewOil")}</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center text-sm font-strong">
          <span className="rounded-lg bg-surface py-2 text-danger">{t("auth.previewDecline")}</span>
          <span className="rounded-lg bg-primary py-2 text-on-primary">{t("auth.previewAdd")}</span>
        </div>
      </div>
    </figure>
  );
}

/** Malý prepínač jazyka nad formulárom: nový človek ho potrebuje ešte pred prihlásením. */
function LanguageSwitch() {
  const { locale, setLocale } = useLocale();
  return (
    <div role="group" aria-label={t("auth.language")} className="mb-6 flex justify-end gap-1">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={cx(
            "min-h-11 min-w-11 rounded-lg px-3 text-xs font-semibold tracking-wider transition-colors duration-200",
            locale === code ? "bg-primary-soft text-primary" : "text-text-2 active:bg-pressed",
          )}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Po prihlásení sa vrátime len na adresu v rámci aplikácie (nie na cudzí web). */
export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
