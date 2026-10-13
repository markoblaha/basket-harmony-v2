import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { Home, LogOut, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { Banner, Button, TextField } from "@/components/ui";
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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-5 py-10 pt-safe">
      <div>
        <h1 className="text-2xl font-bold">{t("onboarding.welcome")}</h1>
        <p className="mt-1 text-text-2">{t("onboarding.intro")}</p>
      </div>

      <form onSubmit={createHousehold} className="flex flex-col gap-3 rounded-[var(--radius-surface)] bg-elevated p-4 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold">
          <Home className="size-5 text-primary" aria-hidden /> {t("onboarding.create")}
        </h2>
        <TextField label={t("household.nameLabel")} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        {create.isError && <Banner tone="danger">{errorMessage(create.error)}</Banner>}
        <Button type="submit" size="lg" block loading={create.isPending}>
          {t("onboarding.createButton")}
        </Button>
      </form>

      <form onSubmit={openInvite} className="flex flex-col gap-3 rounded-[var(--radius-surface)] bg-elevated p-4 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold">
          <Mail className="size-5 text-primary" aria-hidden /> {t("onboarding.haveInvite")}
        </h2>
        <TextField
          label={t("onboarding.linkLabel")}
          placeholder="https://…/join/…"
          value={link}
          error={linkError}
          onChange={(e) => {
            setLink(e.target.value);
            setLinkError(null);
          }}
        />
        <Button type="submit" variant="secondary" size="lg" block>
          {t("onboarding.continue")}
        </Button>
      </form>

      <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
        <LogOut className="size-4" aria-hidden /> {t("more.signOut")}
      </Button>
    </main>
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
