import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { Spinner } from "@/components/ui";
import { AuthLogo, AuthShell, Field, Note } from "./shell";
import { t } from "@/i18n";
import { useAuth } from "./AuthProvider";

/** Sem vedie odkaz z e-mailu "zabudnuté heslo". Supabase ťa ním dočasne prihlási. */
export function ResetPasswordPage() {
  const { loading, session, clearPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <Spinner />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError(t("auth.errPassword"));
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    clearPasswordRecovery();
    navigate("/", { replace: true });
  }

  return (
    <AuthShell>
      <AuthLogo />
      <h1 className="lt">{t("auth.resetTitle")}</h1>
      {!session ? (
        <Note tone="warn" title={t("auth.resetInvalidTitle")}>
          {t("auth.resetInvalidText")}
        </Note>
      ) : (
        <form onSubmit={submit} className="auth-form">
          <Field
            label={t("auth.resetTitle")}
            type="password"
            autoComplete="new-password"
            hint={t("auth.passwordHint")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <Note tone="danger">{error}</Note>}
          <button type="submit" className="btn pri full big" disabled={busy} aria-busy={busy || undefined}>
            {busy && <span className="auth-spin" aria-hidden />}
            {t("auth.resetSave")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
