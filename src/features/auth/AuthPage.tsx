import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ShoppingBasket } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/errors";
import { Banner, Button, TextField } from "@/components/ui";

type Mode = "signin" | "signup" | "forgot";

const TITLES: Record<Mode, string> = {
  signin: "Prihlásenie",
  signup: "Nový účet",
  forgot: "Zabudnuté heslo",
};

export function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (mode !== "forgot" && password.length < 8) {
      setError("Heslo musí mať aspoň 8 znakov.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        navigate(next, { replace: true });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: `${window.location.origin}${next}`,
          },
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
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10 pt-safe">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary text-on-primary">
          <ShoppingBasket className="size-7" aria-hidden />
        </div>
        <p className="text-sm font-medium text-text-2">Basket Harmony</p>
        <h1 className="text-2xl font-bold">{TITLES[mode]}</h1>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {mode === "signup" && (
          <TextField
            label="Tvoje meno"
            hint="Uvidia ho členovia domácnosti."
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            required
          />
        )}
        <TextField
          label="E-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {mode !== "forgot" && (
          <TextField
            label="Heslo"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            hint={mode === "signup" ? "Aspoň 8 znakov." : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        )}

        {error && <Banner tone="danger">{error}</Banner>}
        {notice && <Banner tone="success">{notice}</Banner>}

        <Button type="submit" size="lg" block loading={busy}>
          {mode === "signin" ? "Prihlásiť sa" : mode === "signup" ? "Vytvoriť účet" : "Poslať odkaz"}
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-1 text-sm">
        {mode === "signin" && (
          <>
            <Button variant="ghost" onClick={() => switchMode("signup")}>
              Nemáš účet? Zaregistruj sa
            </Button>
            <Button variant="ghost" onClick={() => switchMode("forgot")}>
              Zabudol som heslo
            </Button>
          </>
        )}
        {mode !== "signin" && (
          <Button variant="ghost" onClick={() => switchMode("signin")}>
            Späť na prihlásenie
          </Button>
        )}
      </div>
    </main>
  );
}

/** Po prihlásení sa vrátime len na adresu v rámci aplikácie (nie na cudzí web). */
export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
