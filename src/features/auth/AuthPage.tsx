import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { Seg } from "@/mockup/ui";
import { AuthLogo, AuthShell, Field, Note } from "./shell";
import { LOCALES, t, useLocale } from "@/i18n";

type Mode = "signin" | "signup" | "forgot";

/**
 * Prihlasovacia obrazovka vo vzhľade tém: logo, čo appka robí, Prihlásiť / Nový účet, Google, e-mail.
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
    <AuthShell>
      <div className="auth-top">
        <AuthLogo />
        <LanguageSwitch />
      </div>
      <h1 className="lt">{t("auth.heroTitle")}</h1>
      <p className="meta auth-lead">{t("auth.heroText")}</p>

      {mode === "forgot" ? (
        <div className="auth-sub">
          <h2 className="ttl serif">{t("auth.forgotTitle")}</h2>
          <p className="meta">{t("auth.forgotText")}</p>
        </div>
      ) : (
        <>
          <Seg<"signin" | "signup">
            items={[
              ["signin", t("auth.signIn")],
              ["signup", t("auth.signUp")],
            ]}
            value={mode}
            onChange={switchMode}
          />
          <button type="button" className="btn soft full big auth-google" onClick={google} disabled={busy !== null} aria-busy={busy === "google" || undefined}>
            <GoogleMark />
            {busy === "google" ? t("auth.googleBusy") : t("auth.google")}
          </button>
          <div className="auth-or">
            <span />
            {t("auth.orEmail")}
            <span />
          </div>
        </>
      )}

      <form onSubmit={submit} className="auth-form" noValidate>
        {mode === "signup" && (
          <Field label={t("auth.nameLabel")} hint={t("auth.nameHint")} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        )}
        <Field label={t("auth.emailLabel")} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {mode !== "forgot" && (
          <Field
            label={t("auth.passwordLabel")}
            type={showPassword ? "text" : "password"}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            hint={mode === "signup" ? t("auth.passwordHint") : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            trailing={
              <button
                type="button"
                className="ib flat sm"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            }
          />
        )}
        {error && <Note tone="danger">{error}</Note>}
        {notice && <Note tone="ok">{notice}</Note>}
        <button type="submit" className="btn pri full big" disabled={busy !== null} aria-busy={busy === "email" || undefined}>
          {busy === "email" ? <span className="auth-spin" aria-hidden /> : null}
          {mode === "signin" ? t("auth.signIn") : mode === "signup" ? t("auth.createAccount") : t("auth.sendLink")}
        </button>
      </form>

      {mode === "signin" && (
        <button type="button" className="lnk c" onClick={() => switchMode("forgot")}>
          {t("auth.forgotLink")}
        </button>
      )}
      {mode === "forgot" && (
        <button type="button" className="lnk c" onClick={() => switchMode("signin")}>
          {t("auth.backToSignIn")}
        </button>
      )}
      {mode === "signup" && (
        <p className="hint">
          <span>
            {t("legal.signupNote")}{" "}
            <Link to="/terms" className="lnk">
              {t("legal.linkTerms")}
            </Link>
            {" · "}
            <Link to="/privacy" className="lnk">
              {t("legal.linkPrivacy")}
            </Link>
          </span>
        </p>
      )}
    </AuthShell>
  );
}

/** Logo Google (štyri farby) – ľudia tlačidlo podľa neho hľadajú. */
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Malý prepínač jazyka hore: nový človek ho potrebuje ešte pred prihlásením. */
function LanguageSwitch() {
  const { locale, setLocale } = useLocale();
  return (
    <div role="group" aria-label={t("auth.language")} className="auth-lang">
      {LOCALES.map((code) => (
        <button key={code} type="button" onClick={() => setLocale(code)} aria-pressed={locale === code} className={locale === code ? "on" : ""}>
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
