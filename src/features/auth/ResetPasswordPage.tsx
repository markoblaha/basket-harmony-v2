import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { Banner, Button, Spinner, TextField } from "@/components/ui";
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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">{t("auth.resetTitle")}</h1>
      {!session ? (
        <Banner tone="warning" title={t("auth.resetInvalidTitle")}>
          {t("auth.resetInvalidText")}
        </Banner>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <TextField
            label={t("auth.resetTitle")}
            type="password"
            autoComplete="new-password"
            hint={t("auth.passwordHint")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <Banner tone="danger">{error}</Banner>}
          <Button type="submit" size="lg" block loading={busy}>
            {t("auth.resetSave")}
          </Button>
        </form>
      )}
    </main>
  );
}
