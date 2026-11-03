import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { I } from "@/mockup/ui";
import { AuthLogo, AuthShell, Field, Note } from "@/features/auth/shell";
import { t } from "@/i18n";
import { useHouseholds, useCreateHousehold } from "./api";

/** Prvé spustenie: založ domácnosť, alebo sa pridaj cez pozvánku. */
export function OnboardingPage() {
  const navigate = useNavigate();
  const households = useHouseholds();
  const create = useCreateHousehold();
  const [name, setName] = useState(() => t("onboarding.defaultName"));
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  if (households.data && households.data.length > 0) return <Navigate to="/" replace />;

  async function createHousehold(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await create.mutateAsync(name.trim());
      navigate("/", { replace: true });
    } catch {
      /* chyba sa zobrazí cez create.isError */
    }
  }

  function openInvite(e: FormEvent) {
    e.preventDefault();
    const token = extractToken(link);
    if (!token) {
      setLinkError(t("onboarding.linkInvalid"));
      return;
    }
    navigate(`/join/${token}`);
  }

  return (
    <AuthShell>
      <AuthLogo />
      <h1 className="lt">{t("onboarding.welcome")}</h1>
      <p className="meta auth-lead">{t("onboarding.intro")}</p>
      <form onSubmit={createHousehold} className="card auth-card">
        <div className="auth-card-h">
          <span className="th ic">
            <I n="house" />
          </span>
          <b>{t("onboarding.create")}</b>
        </div>
        <Field label={t("household.nameLabel")} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        {create.isError && <Note tone="danger">{errorMessage(create.error)}</Note>}
        <button type="submit" className="btn pri full" disabled={create.isPending} aria-busy={create.isPending || undefined}>
          {create.isPending && <span className="auth-spin" aria-hidden />}
          {t("onboarding.createButton")}
        </button>
      </form>
      <form onSubmit={openInvite} className="card auth-card">
        <div className="auth-card-h">
          <span className="th ic">
            <I n="link" />
          </span>
          <b>{t("onboarding.haveInvite")}</b>
        </div>
        <Field
          label={t("onboarding.linkLabel")}
          placeholder="https://…/join/…"
          value={link}
          error={linkError}
          onChange={(e) => {
            setLink(e.target.value);
            setLinkError(null);
          }}
        />
        <button type="submit" className="btn soft full">
          {t("onboarding.continue")}
        </button>
      </form>
      <button type="button" className="lnk c dng" onClick={() => supabase.auth.signOut()}>
        <I n="sign-out" />
        {t("more.signOut")}
      </button>
    </AuthShell>
  );
}

/** Z vloženého odkazu (alebo samotného kódu) vytiahne token pozvánky. */
export function extractToken(input: string): string | null {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/\/join\/([a-f0-9]{64})/i);
  if (fromUrl) return fromUrl[1]!.toLowerCase();
  if (/^[a-f0-9]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  return null;
}
