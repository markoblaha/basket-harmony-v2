import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { Home, LogOut, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { Banner, Button, TextField } from "@/components/ui";
import { useHouseholds, useCreateHousehold } from "./api";

/** Prvé spustenie: založ domácnosť, alebo sa pridaj cez pozvánku. */
export function OnboardingPage() {
  const navigate = useNavigate();
  const households = useHouseholds();
  const create = useCreateHousehold();
  const [name, setName] = useState("Naša domácnosť");
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
      setLinkError("Toto nevyzerá ako odkaz na pozvánku.");
      return;
    }
    navigate(`/join/${token}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-5 py-10 pt-safe">
      <div>
        <h1 className="text-2xl font-bold">Vitaj!</h1>
        <p className="mt-1 text-text-2">
          Nákupný zoznam zdieľaš s domácnosťou. Založ novú, alebo sa pridaj k existujúcej cez pozvánku.
        </p>
      </div>

      <form onSubmit={createHousehold} className="flex flex-col gap-3 rounded-[var(--radius-surface)] bg-elevated p-4 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold">
          <Home className="size-5 text-primary" aria-hidden /> Založiť domácnosť
        </h2>
        <TextField label="Názov domácnosti" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        {create.isError && <Banner tone="danger">{errorMessage(create.error)}</Banner>}
        <Button type="submit" size="lg" block loading={create.isPending}>
          Založiť
        </Button>
      </form>

      <form onSubmit={openInvite} className="flex flex-col gap-3 rounded-[var(--radius-surface)] bg-elevated p-4 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold">
          <Mail className="size-5 text-primary" aria-hidden /> Mám pozvánku
        </h2>
        <TextField
          label="Odkaz na pozvánku"
          placeholder="https://…/join/…"
          value={link}
          error={linkError}
          onChange={(e) => {
            setLink(e.target.value);
            setLinkError(null);
          }}
        />
        <Button type="submit" variant="secondary" size="lg" block>
          Pokračovať
        </Button>
      </form>

      <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
        <LogOut className="size-4" aria-hidden /> Odhlásiť sa
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
