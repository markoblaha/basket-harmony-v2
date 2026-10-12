/**
 * Kto je prihlásený. Supabase si prihlásenie pamätá v prehliadači; tu len
 * počúvame jeho zmeny (prihlásenie, odhlásenie, obnovenie tokenu, obnova hesla)
 * a sprístupníme ich celej aplikácii.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  /** true po kliknutí na odkaz z e-mailu "zabudnuté heslo" */
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      // Po odhlásení zmažeme všetky údaje z pamäte, aby ich nevidel ďalší používateľ.
      if (event === "SIGNED_OUT") queryClient.clear();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{
        loading,
        session,
        user: session?.user ?? null,
        passwordRecovery,
        clearPasswordRecovery: () => setPasswordRecovery(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth mimo AuthProvider");
  return ctx;
}

export function useUserId(): string {
  const { user } = useAuth();
  if (!user) throw new Error("Používateľ nie je prihlásený");
  return user.id;
}
